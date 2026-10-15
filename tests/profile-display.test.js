const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, visibleText } = require('./page-harness')

for (const [envVersion, version, expected] of [
  ['release', '1.0.20261012.2', 'v1.0.20261012.2'],
  ['trial', '1.0.20261013.1', 'v1.0.20261013.1'],
  ['develop', '', '开发版'],
  ['trial', '', '体验版'],
  ['release', '', '正式版'],
  ['unknown', '', '版本信息暂不可用']
]) {
  test(`profile footer reflects ${envVersion} version ${version || '(unavailable)'}`, () => {
    const { page } = loadPage('pages/profile/profile.js', async () => ({ code: 0 }), {}, {
      wx: { getAccountInfoSync: () => ({ miniProgram: { envVersion, version } }) }
    })
    page.loadVersion()
    const text = visibleText('pages/profile/profile.wxml', page.data)
    assert.match(text, new RegExp(`爸妈动起来 ${expected.replaceAll('.', '\\.')}`))
    assert.doesNotMatch(text, /v1\.0\.0/)
    assert.doesNotMatch(text, /专为老年人设计的肌肉锻炼助手/)
  })
}

test('unimplemented settings disclose their status without navigation or configured values', () => {
  const notices = [], routes = []
  const { page } = loadPage('pages/profile/profile.js', async () => ({ code: 0 }), {}, {
    wx: { showToast: value => notices.push(value), navigateTo: value => routes.push(value) }
  })
  const unfinished = ['voice', 'reminder', 'emergency']
  for (const id of unfinished) {
    assert.equal(page.data.settings.find(item => item.id === id).value, '暂未开放')
    page.goToSetting({ currentTarget: { dataset: { id } } })
  }
  assert.equal(routes.length, 0)
  assert.equal(notices.length, 3)
  assert(notices.every(item => item.title === '功能开发中'))
  const text = visibleText('pages/profile/profile.wxml', page.data)
  assert.doesNotMatch(text, /开启|每日 8:00/)
})

test('implemented settings still open their existing pages', () => {
  const routes = []
  const { page } = loadPage('pages/profile/profile.js', async () => ({ code: 0 }), {}, {
    wx: { navigateTo: value => routes.push(value.url) }
  })
  for (const id of ['family', 'goals', 'profile', 'fontSize']) page.goToSetting({ currentTarget: { dataset: { id } } })
  assert.deepEqual(routes, ['/pages/family/family', '/pages/goal/goal', '/pages/profile-edit/profile-edit', '/pages/font-size/font-size'])
})
