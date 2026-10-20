const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, visibleText } = require('./page-harness')

function load(file, storage = { token: 'synthetic-token' }) {
  const routes = [], tabs = []
  const { page } = loadPage(file, async () => ({ code: 0, data: [] }), storage, {
    wx: { navigateTo: value => routes.push(value.url), switchTab: value => tabs.push(value.url) }
  })
  return { page, routes, tabs }
}

test('home family header and both profile family entries open the same registered page', () => {
  const home = load('pages/index/index.js'), profile = load('pages/profile/profile.js')
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/index/index.wxml'), 'utf8')
  assert.match(wxml, /class="family-switch"[^\n]+bindtap="goToFamily"/)
  assert.match(wxml, /class="family-arrow">›/)
  assert.doesNotMatch(wxml, /family-popup|switchFamily/)
  home.page.goToFamily()
  profile.page.goToSetting({ currentTarget: { dataset: { id: 'family' } } })
  assert.deepEqual(home.routes, profile.routes)
  assert.deepEqual(home.routes, ['/pages/family/family'])
  const profileWxml = fs.readFileSync(path.join(__dirname, '../pages/profile/profile.wxml'), 'utf8')
  assert.match(profileWxml, /class="header-family"[^>]+bindtap="goToSetting" data-id="family"/)
  assert.equal(profile.page.data.settings.find(s => s.id === 'family').name, '家庭成员和计划')
})

test('multi-family selection stays in family page and refreshes selection without changing membership', () => {
  const storage = { token: 'synthetic-token', currentFamilyId: 4 }
  const f = load('pages/family/family.js', storage)
  const selection = []
  f.page.setData({ families: [{ id: 4 }, { id: 5 }] })
  f.page.loadFamilies = () => selection.push(storage.currentFamilyId)
  f.page.onFamilyChange({ detail: { value: '1' } })
  assert.equal(storage.currentFamilyId, 5)
  assert.deepEqual(selection, [5])
  assert.equal(f.routes.length, 0)
  f.page.goCreate(); f.page.goJoin()
  assert.deepEqual(f.routes, ['/pages/family/join?type=create', '/pages/family/join?type=join'])
})

test('home return keeps bottom navigation visible and refreshes the selected family', async () => {
  const storage = { token: 'synthetic-token', currentFamilyId: 5 }
  const { page } = loadPage('pages/index/index.js', async () => ({ code: 0, data: [
    { family_id: 4, family_name: '家庭甲', goals: [] }, { family_id: 5, family_name: '家庭乙', goals: [] }
  ] }), storage)
  const tab = { setData(value) { Object.assign(this, value) } }
  page.getTabBar = () => tab
  page.checkLogin = page.getRecommendExercises = page.updateProgress = () => {}
  page.onShow()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(tab.hidden, false)
  assert.equal(tab.selected, 0)
  assert.equal(page.data.currentFamily.id, 5)
})

test('home login opens login directly; logged-in avatar opens the profile tab', () => {
  const guest = load('pages/index/index.js', {}), member = load('pages/index/index.js')
  guest.page.goToProfile(); member.page.goToProfile()
  assert.deepEqual(guest.routes, ['/pages/login/login'])
  assert.equal(guest.tabs.length, 0)
  assert.deepEqual(member.tabs, ['/pages/profile/profile'])
})

test('guest private settings open login but font preference stays available', () => {
  const f = load('pages/profile/profile.js', {})
  for (const id of ['family', 'goals', 'profile', 'fontSize']) f.page.goToSetting({ currentTarget: { dataset: { id } } })
  assert.deepEqual(f.routes, ['/pages/login/login', '/pages/login/login', '/pages/login/login', '/pages/font-size/font-size'])
})

test('home without a family offers both create and join with distinct forms', () => {
  const f = load('pages/index/index.js')
  f.page.setData({ isLoggedIn: true, userInfo: {}, goalsLoading: false, hasTodayTasks: false })
  const text = visibleText('pages/index/index.wxml', f.page.data)
  assert.match(text, /创建家庭/)
  assert.match(text, /加入家庭/)
  f.page.goToCreateFamily()
  f.page.goToJoinFamily()
  assert.deepEqual(f.routes, ['/pages/family/join?type=create', '/pages/family/join?type=join'])
})

test('home family onboarding stays hidden during loading, errors, guest mode or existing membership', () => {
  for (const state of [
    { isLoggedIn: true, goalsLoading: true },
    { isLoggedIn: true, goalsLoading: false, goalsError: '今日安排加载失败，请重试' },
    { isLoggedIn: false, goalsLoading: false },
    { isLoggedIn: true, goalsLoading: false, families: [{ id: 1 }], currentFamily: { name: '测试家庭' } }
  ]) {
    const f = load('pages/index/index.js')
    f.page.setData({ userInfo: {}, ...state })
    const text = visibleText('pages/index/index.wxml', f.page.data)
    assert.doesNotMatch(text, /创建家庭|加入家庭/)
    if (state.families) assert.match(text, /看看家人的安排/)
  }
})

test('home share title invites the whole family to exercise', () => {
  const f = load('pages/index/index.js')
  assert.equal(f.page.onShareAppMessage().title, '爸妈动起来 - 带着家人一起动起来吧')
  assert.equal(f.page.onShareAppMessage().path, '/pages/index/index')
})

test('legacy home action handlers use registered destinations and tab navigation', () => {
  const f = load('pages/index/index.js')
  f.page.startTodayExercise(); f.page.goToMuscle(); f.page.goToGoalList()
  assert.deepEqual(f.tabs, ['/pages/muscle/muscle', '/pages/muscle/muscle'])
  assert.deepEqual(f.routes, ['/pages/goal/goal'])
})

test('literal page destinations are registered and tab pages use switchTab or reLaunch', () => {
  const root = path.join(__dirname, '..'), config = require('../app.json')
  const tabs = new Set(config.tabBar.list.map(item => item.pagePath))
  const files = fs.readdirSync(path.join(root, 'pages'), { recursive: true }).filter(file => file.endsWith('.js'))
  let routes = 0
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, 'pages', file), 'utf8')
    for (const [, method, destination] of source.matchAll(/wx\.(navigateTo|redirectTo|switchTab|reLaunch)\(\{\s*url:\s*['"`]([^'"`]+)/g)) {
      if (!destination.startsWith('/pages/')) continue
      const page = destination.slice(1).split('?')[0]
      assert.ok(config.pages.includes(page), `${file}: ${page} must be registered`)
      if (tabs.has(page)) assert.ok(['switchTab', 'reLaunch'].includes(method), `${file}: ${page} is a tab`)
      routes++
    }
  }
  assert.ok(routes > 20)
})
