const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, deferred } = require('./page-harness')
const { categoryForExercise, loadAllExercises } = require('../utils/exercise-category')
const ok = data => ({ code: 0, data })

test('category name wins over legacy ID and aggregates anatomical subgroups', () => {
  assert.equal(categoryForExercise({ muscle_group_id: 1, muscle_group: { name: '核心' } }), 'core')
  assert.equal(categoryForExercise({ muscle_group_id: 7 }), 'upper')
  assert.equal(categoryForExercise({ muscle_group_id: 9 }), 'lower')
  assert.equal(categoryForExercise({ muscle_group: { name: '全身' } }), 'all')
})

test('exercise loader consumes all pages and rejects partial or invalid responses', async () => {
  const pages = []
  const items = await loadAllExercises({ request: async (url, method, params) => {
    pages.push(params.page)
    return ok({ list: Array.from({ length: params.page === 1 ? 100 : 1 }, (_, i) => ({ id: (params.page - 1) * 100 + i })), total: 101 })
  } })
  assert.equal(items.length, 101)
  assert.deepEqual(pages, [1, 2])
  await assert.rejects(loadAllExercises({ request: async () => ({ code: 500, message: 'synthetic failure' }) }), /synthetic failure/)
  await assert.rejects(loadAllExercises({ request: async () => ok({ bad: true }) }), /格式错误/)
})

test('profile caches server readback, not fields only sent by the client', async () => {
  const storage = { userInfo: { id: 701, nick_name: 'Old name' } }
  const methods = []
  const { page } = loadPage('pages/profile-edit/profile-edit.js', async (url, method) => {
    methods.push(method)
    return method === 'PUT' ? ok() : ok({ id: 701, nick_name: 'Canonical name', gender: 2, height: 170, weight: 66.5 })
  }, storage)
  page.setData({ userInfo: { nick_name: 'Submitted name', gender: 1 } })
  await page.onSave()
  assert.deepEqual(methods, ['PUT', 'GET'])
  assert.equal(storage.userInfo.nick_name, 'Canonical name')
  assert.equal(storage.userInfo.gender, 2)
  assert.equal(storage.userInfo.weight, 66.5)
})

test('old identity response cannot repopulate statistics after logout', async () => {
  const pending = deferred(), storage = { token: 'synthetic-user-one', userInfo: { id: 701 }, userId: 701 }
  const { page } = loadPage('pages/profile/profile.js', () => pending.promise, storage,
    { wx: { showModal: ({ success }) => success({ confirm: true }) } })
  page.loadStatistics()
  page.handleLogout()
  storage.token = 'synthetic-user-two'
  pending.resolve(ok({ totalDays: 17, totalSets: 19 }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.data.statistics.totalDays, 0)
  assert.equal(page.data.statistics.totalSets, 0)
})

test('statistics failures are explicit and can recover without inventing zero data', async () => {
  let fail = true
  const { page } = loadPage('pages/profile/profile.js', async () => fail ? { code: 500 } : ok({ totalDays: 2, totalSets: 5 }), { token: 'synthetic' })
  page.setData({ statistics: { totalDays: 9, totalSets: 17 } })
  await page.loadStatistics()
  assert.match(page.data.statisticsError, /加载失败/)
  assert.equal(page.data.statistics.totalSets, 17)
  assert.equal(page.data.statisticsLoading, false)
  fail = false
  await page.loadStatistics()
  assert.equal(page.data.statisticsError, '')
  assert.equal(page.data.statistics.totalSets, 5)
})

test('late family error cannot erase the next identity family statistics', async () => {
  const pending = deferred(), storage = { token: 'synthetic-first' }
  const { page } = loadPage('pages/profile/profile.js', () => pending.promise, storage)
  const load = page.loadFamilyStatistics()
  storage.token = 'synthetic-second'
  page.setData({ familyStats: [{ family_id: 4, total_sets: 8 }] })
  pending.reject(new Error('old failure'))
  await load
  assert.equal(page.data.familyStats[0].family_id, 4)
  assert.equal(page.data.familyStatsError, '')
})

test('progress overview distinguishes loading, failure and true empty progress', async () => {
  const { page } = loadPage('pages/goal/progress.js', async () => ({ code: 500, message: 'synthetic failure' }))
  await page.loadProgress()
  assert.equal(page.data.progressError, 'synthetic failure')
  assert.equal(page.data.progressLoading, false)
})

test('departed participant history stays visible but current participant count excludes it', async () => {
  const { page } = loadPage('pages/goal/detail.js', async url => url.endsWith('/progress') ? ok({ member_stats: [
    { user_id: 701, is_current_member: true }, { user_id: 702, is_current_member: false, completed_sets: 3 }
  ] }) : ok({ id: 901, members: [{ user_id: 701 }, { user_id: 702 }], exercises: [] }))
  page.setData({ goalId: 901 })
  await page.loadDetails()
  assert.equal(page.data.goal.memberCount, 1)
  assert.equal(page.data.memberProgressList.length, 2)
  assert.equal(page.data.memberProgressList[1].is_current_member, false)
})
