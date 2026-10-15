const test = require('node:test')
const assert = require('node:assert/strict')
const { deferred, loadPage, visibleText } = require('./page-harness')
const ok = data => ({ code: 0, data })

test('home shows own scheduled actions without counting observer families as tasks', async () => {
  const data = [{ family_id: 1, family_name: '家庭一', goals: [] }, { family_id: 2, family_name: '家庭二', goals: [{ id: 3, plan_type: 'personal', total_exercises: 2, today_completed: 1 }] }]
  const { page } = loadPage('pages/index/index.js', async () => ok(data), { token: 'synthetic' })
  await page.loadFamilyGoals()
  assert.equal(page.data.families.length, 2)
  assert.equal(page.data.hasTodayTasks, true)
  assert.equal(page.data.totalPendingGoals, 1)
})

test('home distinguishes a real empty schedule from a failed request and can retry', async () => {
  let fail = true
  const { page } = loadPage('pages/index/index.js', async () => fail ? { code: 500 } : ok([{ family_id: 1, family_name: '家庭一', goals: [] }]), { token: 'synthetic' })
  page.setData({ isLoggedIn: true, userInfo: {} })
  await page.loadFamilyGoals()
  assert.match(page.data.goalsError, /重试/)
  assert.ok(!visibleText('pages/index/index.wxml', page.data).includes('今日无安排'))
  fail = false
  await page.loadFamilyGoals()
  assert.equal(page.data.goalsError, '')
  assert.equal(page.data.hasTodayTasks, false)
  assert.match(visibleText('pages/index/index.wxml', page.data), /今日无安排/)
})

test('week bars compare completed sets, independent of mutable plan requirements', async () => {
  let denominator = 100
  const { page } = loadPage('pages/profile/profile.js', async () => ok({ stats: [{ count: 2, totalSets: denominator }, { count: 4, totalSets: denominator }] }), { token: 'synthetic' })
  await page.loadWeekStats(0)
  const original = page.data.weekStats.map(row => row.barPercent)
  denominator = 2
  await page.loadWeekStats(0)
  assert.deepEqual(original, [50, 100])
  assert.deepEqual(page.data.weekStats.map(row => row.barPercent), original)
})

test('today load cannot restore old family tasks after logout', async () => {
  const pending = deferred(), storage = { token: 'synthetic-old' }
  const { page } = loadPage('pages/index/index.js', () => pending.promise, storage)
  const load = page.loadFamilyGoals()
  delete storage.token
  await page.loadFamilyGoals()
  pending.resolve(ok([{ family_id: 1, goals: [{ id: 1 }] }]))
  await load
  assert.equal(page.data.families.length, 0)
  assert.equal(page.data.hasTodayTasks, false)
  assert.equal(page.data.goalsLoading, false)
})

test('switching account starts its own task request and ignores the stale response', async () => {
  const old = deferred(), storage = { token: 'synthetic-old' }
  let calls = 0
  const { page } = loadPage('pages/index/index.js', () => ++calls === 1 ? old.promise : ok([{ family_id: 2, goals: [] }]), storage)
  const load = page.loadFamilyGoals()
  storage.token = 'synthetic-new'
  await page.loadFamilyGoals()
  old.resolve(ok([{ family_id: 1, goals: [{ id: 1 }] }]))
  await load
  assert.equal(calls, 2)
  assert.equal(page.data.currentFamily.id, 2)
  assert.equal(page.data.hasTodayTasks, false)
})
