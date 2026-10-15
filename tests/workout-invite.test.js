const test = require('node:test')
const assert = require('node:assert/strict')
const { deferred, loadPage } = require('./page-harness')
const ok = data => ({ code: 0, data })
const exercise = { id: 3, exercise_id: 1, sets: 3, reps: 10, exercise: { name: '测试动作' } }
function detail(request, confirm = true, members = []) {
  const navigations = [], errors = []
  let modalCount = 0
  const result = loadPage('pages/goal/detail.js', request, { userId: 7 }, { wx: {
    showModal: ({ success }) => { modalCount++; success({ confirm }) },
    navigateTo: ({ url }) => navigations.push(url),
    showToast: ({ title }) => errors.push(title)
  } })
  result.page.onLoad({ id: 9 })
  result.page.setData({ loading: false, goal: { plan_type: 'shared', is_participating: members.some(member => member.user_id == 7), members }, currentUserId: 7 })
  return { ...result, navigations, errors, get modalCount() { return modalCount } }
}
test('shared-plan join sends only the current user; returning does not join twice', async () => {
  const writes = []
  const { page, navigations, modalCount } = detail(async (url, method, data) => {
    if (method === 'POST') { writes.push({ url, data }); return ok() }
    return ok({ members: [{ user_id: 7 }], exercises: [exercise] })
  })
  page.loadDetails = async () => page.setData({ goal: { ...page.data.goal, is_participating: true, members: [{ user_id: 7 }] } })
  await page.joinGoal()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].url, '/goals/9/members')
  assert.equal(writes[0].data.user_id, 7)
  assert.equal(modalCount, 0)
  assert.equal(navigations.length, 0)
  await page.joinGoal()
  assert.equal(writes.length, 1)
})
test('personal plans cannot be joined by a non-executor', async () => {
  const { page, calls, navigations } = detail(() => { throw Error('unexpected') })
  page.setData({ goal: { plan_type: 'personal', executor_id: 8, is_participating: false } })
  await page.joinGoal(); assert.equal(calls.length, 0); assert.equal(navigations.length, 0)
})
test('shared-plan join failure preserves error and does not navigate', async () => {
  const { page, navigations, errors } = detail(async () => { throw Error('无权限操作') })
  await page.joinGoal(); assert.equal(navigations.length, 0); assert.equal(errors[0], '无权限操作'); assert.equal(page.data.starting, false)
})
test('existing participant cannot join again or navigate to workout automatically', async () => {
  const { page, calls, navigations } = detail(() => { throw Error('unexpected') }, true, [{ user_id: 7 }])
  await page.joinGoal(); assert.equal(calls.length, 0); assert.equal(navigations.length, 0)
})
test('double join cannot create duplicate membership while pending', async () => {
  const wait = deferred()
  const { page, calls } = detail(url => url.endsWith('/members') ? wait.promise : Promise.resolve(ok({ members: [{ user_id: 7 }] })))
  const first = page.joinGoal(); await Promise.resolve(); await page.joinGoal()
  assert.equal(calls.length, 1); wait.resolve(ok()); await first
})
function progress(request) {
  const errors = []
  const result = loadPage('pages/goal/progress.js', request, {}, { wx: { showToast: ({ title }) => errors.push(title) } })
  result.page.setData({ goalId: 9, exercise: { goal_exercise_id: 3, sets: 3 }, completedSets: 3 })
  return { ...result, errors }
}
test('submit sends absolute completed sets once and stays locked after success', async () => {
  const wait = deferred(), payloads = []
  const { page, calls } = progress((url, method, data) => { payloads.push(data); return wait.promise })
  const first = page.submitProgress(); await page.submitProgress(); assert.equal(calls.length, 1)
  wait.resolve(ok()); await first; await page.submitProgress(); assert.equal(calls.length, 1)
  assert.equal(payloads[0].goal_exercise_id, 3); assert.equal(payloads[0].completed_sets, 3)
  assert.equal(page.data.submitted, true)
})
test('submit failure exposes backend reason and allows retry', async () => {
  let fail = true
  const { page, errors } = progress(async () => { if (fail) throw Error('您不是该目标成员，请先加入目标'); return ok() })
  await page.submitProgress(); assert.match(errors[0], /不是该目标成员/); assert.equal(page.data.loading, false)
  fail = false; await page.submitProgress(); assert.equal(page.data.submitted, true)
})
test('loading or failed progress cannot overwrite existing sets by submitting', async () => {
  const { page, calls } = progress(async () => ok())
  page.setData({ progressLoading: true }); await page.submitProgress()
  page.setData({ progressLoading: false, progressError: '网络错误' }); await page.submitProgress()
  assert.equal(calls.length, 0)
})
test('zero sets rejected locally', async () => {
  const { page, calls, errors } = progress(async () => ok()); page.setData({ completedSets: 0 })
  await page.submitProgress(); assert.equal(calls.length, 0); assert.match(errors[0], /至少完成一组/)
})
test('admin share card opens recipient join page with code; no sender navigation', () => {
  const { page, calls } = loadPage('pages/family/family.js', () => { throw Error('unexpected') })
  page.setData({ isAdmin: true, family: { name: '测试家庭', invite_code: 'AB12CD' } })
  assert.equal(page.onShareAppMessage().path, '/pages/family/join?type=join&code=AB12CD')
  page.setData({ isAdmin: false }); assert.equal(page.onShareAppMessage().path, '/pages/index/index')
  assert.equal(calls.length, 0)
})
test('invited guest retains invitation while navigating to login; never joins automatically', async () => {
  const navigation = []
  const { page, calls } = loadPage('pages/family/join.js', () => { throw Error('unexpected') }, {}, { wx: { navigateTo: ({ url }) => navigation.push(url) } })
  page.onLoad({ code: 'ab12cd' }); assert.equal(page.data.type, 'join'); assert.equal(calls.length, 0)
  await page.joinFamily(); assert.equal(page.data.inviteCode, 'AB12CD'); assert.equal(calls.length, 0)
  assert.equal(navigation[0], '/pages/login/login')
})
test('join normalizes code, suppresses duplicates and redirects cold-launch visitor to family', async () => {
  const wait = deferred(), destinations = [], payloads = []
  const { page, calls } = loadPage('pages/family/join.js', (url, method, data) => { payloads.push(data); return wait.promise }, { token: 'fixture' }, {
    setTimeout: fn => fn(), wx: { redirectTo: ({ url }) => destinations.push(url) }
  })
  page.onLoad({ type: 'join', code: 'ab12cd' }); const first = page.joinFamily(); await page.joinFamily()
  assert.equal(calls.length, 1); assert.equal(payloads[0].invite_code, 'AB12CD')
  wait.resolve(ok()); await first; assert.equal(destinations[0], '/pages/family/family')
})
for (const reason of ['邀请码无效', '您已加入该家庭', '网络请求失败']) {
  test(`join displays ${reason} and permits retry`, async () => {
    const messages = []
    const { page } = loadPage('pages/family/join.js', async () => { throw Error(reason) }, { token: 'fixture' }, { wx: { showToast: ({ title }) => messages.push(title) } })
    page.onLoad({ code: 'AB12CD' }); await page.joinFamily()
    assert.equal(messages[0], reason); assert.equal(page.data.loading, false)
  })
}
