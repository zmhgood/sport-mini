const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, visibleText } = require('./page-harness')

function home() {
  const destinations = [], storage = {}
  const { page } = loadPage('pages/index/index.js', () => { throw Error('unexpected request') }, storage, {
    wx: { navigateTo: ({ url }) => destinations.push(url) }
  })
  const tab = { data: { selected: 2, hidden: false }, setData(update) { Object.assign(this.data, update) } }
  page.getTabBar = () => tab
  page.loadFamilyGoals = () => {}
  return { page, tab, destinations, storage }
}

test('family sheet hides navigation and closing restores it on every opening', () => {
  const { page, tab } = home()
  for (let i = 0; i < 3; i++) {
    page.switchFamily()
    assert.equal(page.data.showFamilyPopup, true)
    assert.equal(tab.data.hidden, true)
    page.closeFamilyPopup()
    assert.equal(page.data.showFamilyPopup, false)
    assert.equal(tab.data.hidden, false)
  }
})

test('choosing a family closes sheet, restores navigation and preserves selection', () => {
  const { page, tab, storage } = home()
  page.data.families = [{ id: 4, name: '家庭甲' }, { id: 5, name: '家庭乙' }]
  page.switchFamily()
  page.selectFamily({ currentTarget: { dataset: { id: 5 } } })
  assert.equal(storage.currentFamilyId, 5)
  assert.equal(page.data.currentFamily.name, '家庭乙')
  assert.equal(page.data.showFamilyPopup, false)
  assert.equal(tab.data.hidden, false)
})

test('join action restores navigation before opening child page', () => {
  const { page, tab, destinations } = home()
  page.switchFamily()
  page.goToJoinFamily()
  assert.equal(page.data.showFamilyPopup, false)
  assert.equal(tab.data.hidden, false)
  assert.deepEqual(destinations, ['/pages/family/join?type=join'])
})

test('leaving home with an open sheet restores navigation', () => {
  const { page, tab } = home()
  page.switchFamily()
  page.onHide()
  assert.equal(page.data.showFamilyPopup, false)
  assert.equal(tab.data.hidden, false)
})

test('returning home clears stale sheet and selects the home tab', () => {
  const { page, tab } = home()
  page.checkLogin = page.getRecommendExercises = page.updateProgress = () => {}
  page.switchFamily()
  page.onShow()
  assert.equal(page.data.showFamilyPopup, false)
  assert.equal(tab.data.hidden, false)
  assert.equal(tab.data.selected, 0)
})

test('home popup also works before a tab component is available', () => {
  const { page } = home()
  page.getTabBar = () => null
  assert.doesNotThrow(() => { page.switchFamily(); page.closeFamilyPopup() })
})

test('family list template includes long names, selected state and join control', () => {
  const { page } = home()
  page.data.families = [{ id: 4, name: '这是一个很长的模拟家庭名称用于检查换行' }]
  page.data.currentFamily = { id: 4 }
  page.switchFamily()
  const text = visibleText('pages/index/index.wxml', page.data)
  assert.match(text, /这是一个很长的模拟家庭名称用于检查换行.*✓.*加入其他家庭/)
  page.closeFamilyPopup()
  assert.doesNotMatch(visibleText('pages/index/index.wxml', page.data), /选择家庭.*加入其他家庭/)
})
