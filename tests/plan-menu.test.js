const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, visibleText } = require('./page-harness')

function detail(goal) {
  let sheet
  const routes = [], writes = []
  const { page } = loadPage('pages/goal/detail.js', async (...args) => { writes.push(args); return { code: 0 } }, {}, { wx: { showActionSheet: value => { sheet = value }, navigateTo: value => routes.push(value.url) } })
  page.setData({ goal: { exercises: [], ...goal }, progress: { member_stats: [] }, goalId: 12, loading: false })
  page.loadDetails = async () => {}
  return { page, routes, writes, sheet: () => sheet }
}

test('native menu shows only permitted actions and cancellation does not write', () => {
  const { page, writes, sheet } = detail({ can_manage: true, plan_type: 'shared', is_participating: true, is_active: true })
  page.toggleMore()
  assert.deepEqual(Array.from(sheet().itemList), ['编辑计划', '暂停计划', '退出共同计划'])
  sheet().complete()
  assert.equal(page.data.showMore, false)
  assert.equal(writes.length, 0)
  page.data.goal = { can_manage: false, plan_type: 'personal' }
  assert.equal(page.getMoreActions().length, 0)
  assert.doesNotMatch(visibleText('pages/goal/detail.wxml', page.data), /更多/)
})

test('menu dispatches existing edit and active handlers and avoids duplicate openings', async () => {
  const { page, routes, writes, sheet } = detail({ family_id: 9, can_manage: true, plan_type: 'personal', is_active: true })
  page.toggleMore()
  const first = sheet()
  page.toggleMore()
  assert.equal(sheet(), first)
  sheet().success({ tapIndex: 0 }); sheet().complete()
  assert.equal(routes[0], '/pages/goal/create?id=12&family_id=9')
  page.toggleMore(); sheet().success({ tapIndex: 1 }); sheet().complete()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(writes[0][2].is_active, false)
  page.data.goal.is_active = false
  assert.equal(page.getMoreActions()[1].label, '恢复计划')
})

test('ordinary shared participant has only leave action; lost management permission prevents writes', () => {
  const { page, writes, sheet } = detail({ can_manage: false, plan_type: 'shared', is_participating: true })
  assert.deepEqual(Array.from(page.getMoreActions(), item => item.label), ['退出共同计划'])
  page.data.goal.can_manage = true; page.toggleMore()
  page.data.goal.can_manage = false
  sheet().success({ tapIndex: 1 }); sheet().complete()
  assert.equal(writes.length, 0)
})

test('existing family still exposes a create action without changing membership or selected family', () => {
  const storage = { currentFamilyId: 4 }, routes = []
  const { page } = loadPage('pages/family/family.js', () => {}, storage, { wx: { navigateTo: value => routes.push(value.url) } })
  page.setData({ loading: false, families: [{ id: 4 }], family: { name: '模拟家庭' }, members: [], goals: [] })
  assert.match(visibleText('pages/family/family.wxml', page.data), /创建新家庭/)
  page.goCreate()
  assert.equal(routes[0], '/pages/family/join?type=create')
  assert.equal(storage.currentFamilyId, 4)
})

test('home family entry navigates without hiding bottom navigation', () => {
  const routes = [], { page } = loadPage('pages/index/index.js', () => {}, { token: 'synthetic-token' }, { wx: { navigateTo: value => routes.push(value.url) } })
  const tab = { setData(value) { Object.assign(this, value) } }; page.getTabBar = () => tab
  page.checkLogin = page.getRecommendExercises = page.updateProgress = page.loadFamilyGoals = () => {}
  page.onShow()
  page.goToFamily()
  assert.equal(tab.hidden, false)
  assert.equal(routes[0], '/pages/family/family')
})
