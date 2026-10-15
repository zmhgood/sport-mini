const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { FONT_OPTIONS, getFontSize, withFontSize, applyFontSize } = require('../utils/font-size')
const { loadPage } = require('./page-harness')

function platform(storage) {
  return { getStorageSync: key => storage[key], setStorageSync: (key, value) => { storage[key] = value } }
}

test('missing or corrupt font preference falls back without changing identity data', () => {
  for (const value of [undefined, 'invalid', 1.3, { scale: 4 }]) {
    const storage = { fontSizePreference: value, token: 'synthetic-session', userId: 7 }
    assert.equal(getFontSize(platform(storage)).id, 'standard')
    assert.equal(storage.userId, 7)
    assert.equal(storage.token, 'synthetic-session')
  }
})

test('every registered page applies persisted font styles on show without losing lifecycle results', () => {
  let calls = 0
  const storage = { fontSizePreference: 'extraLarge' }
  const definition = withFontSize({ data: { businessValue: 3 }, onShow(value) { calls++; return value } }, platform(storage))
  const page = { ...definition, data: { ...definition.data }, setData(value) { Object.assign(this.data, value) } }
  const tab = { setData(value) { Object.assign(this, value) } }; page.getTabBar = () => tab
  assert.equal(page.onShow('kept'), 'kept')
  assert.equal(page.data.businessValue, 3)
  assert.equal(page.data.fontSizeId, 'extraLarge')
  assert.match(tab.fontPageStyle, /1.3/)
  storage.fontSizePreference = 'standard'
  page.onShow()
  assert.equal(calls, 2)
  assert.equal(page.data.fontSizeId, 'standard')
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8'))
  for (const route of app.pages) {
    assert.match(fs.readFileSync(route + '.js', 'utf8'), /withFontSize/)
    assert.match(fs.readFileSync(route + '.wxml', 'utf8'), /page-meta page-style="\{\{fontPageStyle\}\}/)
  }
})

test('font choices save, survive a fresh page, and update the profile setting label', () => {
  const storage = { userId: 7, currentFamilyId: 9 }
  const notices = []
  const { page } = loadPage('pages/font-size/font-size.js', () => { throw Error('font setting must not request backend') }, storage, { wx: { showToast: value => notices.push(value.title) } })
  for (const option of FONT_OPTIONS) {
    page.selectFontSize({ currentTarget: { dataset: { id: option.id } } })
    assert.equal(storage.fontSizePreference, option.id)
    assert.equal(page.data.fontSizeLabel, option.label)
    const fresh = loadPage('pages/font-size/font-size.js', () => {}, storage).page
    fresh.onShow()
    assert.equal(fresh.data.fontSizeId, option.id)
    const profile = loadPage('pages/profile/profile.js', () => {}, storage).page
    applyFontSize(profile, platform(storage))
    assert.equal(profile.data.settings.find(item => item.id === 'fontSize').value, option.label)
  }
  assert.equal(notices.length, 3)
  assert.equal(storage.userId, 7)
  assert.equal(storage.currentFamilyId, 9)
})

test('failed save preserves selected preference and shows a retryable error', () => {
  const storage = { fontSizePreference: 'large' }, notices = []
  const { page } = loadPage('pages/font-size/font-size.js', () => {}, storage, { wx: {
    setStorageSync: () => { throw Error('storage failure') }, showToast: value => notices.push(value.title)
  } })
  page.onShow()
  page.selectFontSize({ currentTarget: { dataset: { id: 'extraLarge' } } })
  assert.equal(page.data.fontSizeId, 'large')
  assert.equal(storage.fontSizePreference, 'large')
  assert.equal(notices[0], '保存失败，请重试')
})

test('font setting survives logout and invalid selection never changes it', () => {
  const storage = { token: 'synthetic', fontSizePreference: 'large' }
  const { page } = loadPage('pages/profile/profile.js', () => {}, storage, { wx: { showModal: options => options.success({ confirm: true }) } })
  page.handleLogout()
  assert.equal(storage.token, undefined)
  assert.equal(storage.fontSizePreference, 'large')
  const setting = loadPage('pages/font-size/font-size.js', () => {}, storage).page
  setting.selectFontSize({ currentTarget: { dataset: { id: 'invalid' } } })
  assert.equal(storage.fontSizePreference, 'large')
})

test('font scale is capped at 30 percent and accepts only the three named choices', () => {
  assert.equal(FONT_OPTIONS.length, 3)
  assert(FONT_OPTIONS.every(item => item.scale >= 1 && item.scale <= 1.3))
  assert.equal(Math.max(...FONT_OPTIONS.map(item => item.scale)), 1.3)
})
