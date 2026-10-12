const test = require('node:test')
const assert = require('node:assert/strict')
const { deferred, loadPage, visibleText } = require('./page-harness')
const familyJS = 'pages/family/family.js'
const familyWXML = 'pages/family/family.wxml'
const goalJS = 'pages/goal/detail.js'
const goalWXML = 'pages/goal/detail.wxml'
const ok = data => ({ code: 0, data })
const family = { id: 4, name: 'Test family', members: [{ user_id: 7, role: 'admin', user: { nick_name: 'Test user' } }] }
const goal = () => ({ id: 9, name: 'Test goal', members: [{ user_id: 7 }], exercises: [{ id: 3, exercise_id: 1, sets: 3, reps: 10, exercise: { name: 'Test exercise' } }] })
const progress = () => ({ member_stats: [{ user_id: 7, user_name: 'Test user', completed_sets: 1, total_sets: 3, exercise_stats: [{ goal_exercise_id: 3, completed_sets: 1, target_sets: 3 }] }] })
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
function familyReplies(url) {
  if (url === '/families') return Promise.resolve(ok([{ id: 4 }]))
  if (url === '/family/4') return Promise.resolve(ok(family))
  return Promise.resolve(ok([goal()]))
}
function goalPage(request) {
  const result = loadPage(goalJS, request, { userId: 7 })
  result.page.onLoad({ id: 9, date: '2026-10-12' })
  return result
}

test('family initially renders loading, never a false no-family message', async () => {
  const list = deferred(), detail = deferred(), goals = deferred()
  const { page } = loadPage(familyJS, url => url === '/families' ? list.promise : url === '/family/4' ? detail.promise : goals.promise, { userId: 7 })
  assert.match(visibleText(familyWXML, page.data), /正在加载/)
  assert.doesNotMatch(visibleText(familyWXML, page.data), /未加入家庭|暂无家庭目标/)
  const work = page.loadFamilies()
  list.resolve(ok([{ id: 4 }]))
  await flush()
  detail.resolve(ok(family))
  await flush()
  assert.match(visibleText(familyWXML, page.data), /正在加载/)
  goals.resolve(ok([goal()]))
  await work
  const text = visibleText(familyWXML, page.data)
  assert.match(text, /Test family/)
  assert.match(text, /Test goal/)
  assert.match(text, /管理员/)
  assert.doesNotMatch(text, /未加入家庭|暂无家庭目标/)
})

test('genuine empty family renders only after a successful list response', async () => {
  const { page, calls } = loadPage(familyJS, () => Promise.resolve(ok([])))
  await page.loadFamilies()
  assert.match(visibleText(familyWXML, page.data), /您还未加入家庭/)
  assert.equal(calls.length, 1)
})

test('family with no goals shows the genuine goal-empty state', async () => {
  const { page } = loadPage(familyJS, url => url.startsWith('/goals/') ? Promise.resolve(ok([])) : familyReplies(url), { userId: 7 })
  await page.loadFamilies()
  assert.match(visibleText(familyWXML, page.data), /暂无家庭目标/)
  assert.doesNotMatch(visibleText(familyWXML, page.data), /未加入家庭/)
})

for (const failing of ['/families', '/family/4', '/goals/family?family_id=4']) {
  for (const failure of ['business', 'network']) {
    test(`family ${failing} ${failure} failure shows retry, never empty; retry recovers`, async () => {
      let fail = true
      const { page } = loadPage(familyJS, url => {
        if (url === failing && fail) return failure === 'network' ? Promise.reject(new Error('offline')) : Promise.resolve({ code: 1 })
        return familyReplies(url)
      }, { userId: 7 })
      await page.loadFamilies()
      const text = visibleText(familyWXML, page.data)
      assert.match(text, /加载失败.*重试/)
      assert.doesNotMatch(text, /未加入家庭|暂无家庭目标|Test family/)
      fail = false
      await page.loadFamilies()
      assert.match(visibleText(familyWXML, page.data), /Test family/)
    })
  }
}

test('family lifecycle deduplicates pending loads and refreshes on return', async () => {
  const wait = deferred()
  const { page, calls } = loadPage(familyJS, () => wait.promise)
  if (page.onLoad) page.onLoad()
  page.onShow(); page.onShow()
  assert.equal(calls.length, 1)
  wait.resolve(ok([])); await flush()
  page.onShow(); await flush()
  assert.equal(calls.length, 2)
})

test('cached family selection and switching retain correct member role', async () => {
  const storage = { userId: 7, currentFamilyId: 5 }
  const { page } = loadPage(familyJS, url => {
    if (url === '/families') return Promise.resolve(ok([{ id: 4 }, { id: 5 }]))
    if (url.startsWith('/family/')) return Promise.resolve(ok({ ...family, id: Number(url.split('/').pop()) }))
    return Promise.resolve(ok([]))
  }, storage)
  await page.loadFamilies()
  assert.equal(page.data.family.id, 5)
  assert.equal(page.data.currentFamilyIndex, 1)
  page.onFamilyChange({ detail: { value: '0' } }); await flush()
  assert.equal(storage.currentFamilyId, 4)
  assert.equal(page.data.family.id, 4)
  assert.equal(page.data.isAdmin, true)
})

test('family failed refresh hides stale content and retry restores it', async () => {
  let fail = false
  const { page } = loadPage(familyJS, url => fail ? Promise.reject(new Error('offline')) : familyReplies(url), { userId: 7 })
  await page.loadFamilies(); fail = true
  await page.loadFamilies()
  assert.doesNotMatch(visibleText(familyWXML, page.data), /Test family|未加入家庭/)
  fail = false; await page.loadFamilies()
  assert.match(visibleText(familyWXML, page.data), /Test family/)
})

test('goal waits for both detail and progress, never exposes provisional zero counts', async () => {
  const detail = deferred(), stats = deferred()
  const { page } = goalPage(url => url.includes('/progress') ? stats.promise : detail.promise)
  const work = page.loadDetails()
  detail.resolve(ok(goal())); await flush()
  assert.match(visibleText(goalWXML, page.data), /正在加载/)
  assert.doesNotMatch(visibleText(goalWXML, page.data), /0人参与|0个动作|Test goal/)
  stats.resolve(ok(progress())); await work
  const text = visibleText(goalWXML, page.data)
  assert.match(text, /1人参与/); assert.match(text, /1个动作/)
  assert.match(text, /Test exercise/)
  assert.equal(page.data.exerciseStatus[3].has_progress, true)
  assert.equal(page.data.memberProgressList[0].progress_percent, 33)
  assert.equal(page.data.progress.member_stats[0].exercise_stats[0].fill_width, 33)
})

test('legitimate zero-member goal can display zero after successful completion', async () => {
  const { page } = goalPage(url => Promise.resolve(ok(url.includes('/progress') ? { member_stats: [] } : { name: 'Empty goal', members: [], exercises: [] })))
  await page.loadDetails()
  assert.match(visibleText(goalWXML, page.data), /0人参与/)
  assert.match(visibleText(goalWXML, page.data), /0个动作/)
})

for (const part of ['detail', 'progress']) {
  for (const failure of ['business', 'network', 'null']) {
    test(`goal ${part} ${failure} failure shows retry, then recovers`, async () => {
      let fail = true
      const { page } = goalPage(url => {
        const current = url.includes('/progress') ? 'progress' : 'detail'
        if (current === part && fail) return failure === 'network' ? Promise.reject(new Error('offline')) : Promise.resolve(failure === 'null' ? ok(null) : { code: 1 })
        return Promise.resolve(ok(current === 'progress' ? progress() : goal()))
      })
      await page.loadDetails()
      const text = visibleText(goalWXML, page.data)
      assert.match(text, /加载失败.*重试/)
      assert.doesNotMatch(text, /0人参与|0个动作|Test goal/)
      fail = false; await page.loadDetails()
      assert.match(visibleText(goalWXML, page.data), /Test goal/)
    })
  }
}

test('goal lifecycle deduplicates requests and refreshes both data sets on return', async () => {
  const detail = deferred(), stats = deferred()
  const { page, calls } = goalPage(url => url.includes('/progress') ? stats.promise : detail.promise)
  page.onShow(); page.onShow()
  assert.equal(calls.length, 2)
  assert.equal(calls[1], '/goals/9/progress?date=2026-10-12')
  detail.resolve(ok(goal())); stats.resolve(ok(progress())); await flush()
  page.onShow(); await flush()
  assert.equal(calls.length, 4)
})

test('a late result from a failed goal attempt cannot overwrite a successful retry', async () => {
  const oldProgress = deferred()
  let retry = false
  const { page } = goalPage(url => {
    if (!retry) return url.includes('/progress') ? oldProgress.promise : Promise.resolve({ code: 1 })
    return Promise.resolve(ok(url.includes('/progress') ? progress() : goal()))
  })
  await page.loadDetails(); retry = true; await page.loadDetails()
  oldProgress.resolve(ok({ member_stats: [] })); await flush()
  assert.equal(page.data.memberProgressList.length, 1)
  assert.match(visibleText(goalWXML, page.data), /Test goal/)
})
