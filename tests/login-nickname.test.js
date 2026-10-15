const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

async function login(existingName, enteredName, avatarPath = '', pageCount = 1) {
  let definition
  const updates = []
  const navigation = []
  const storage = {}
  const app = { globalData: {} }
  const api = {
    auth: {
      wechatLogin: async () => ({ code: 0, data: { token: 'test-token', userInfo: { id: 1, nick_name: existingName, avatar_url: 'old-avatar' } } }),
      updateUserInfo: async data => { updates.push(data) },
      getUserInfo: async () => ({ code: 0, data: { id: 1, nick_name: updates.at(-1)?.nick_name || existingName } })
    },
    upload: async () => ({ data: { url: 'new-avatar' } })
  }
  const wx = {
    login: ({ success }) => success({ code: 'test-code' }),
    showLoading() {}, hideLoading() {}, showToast() {}, switchTab: () => navigation.push('home'), navigateBack: () => navigation.push('back'),
    setStorageSync: (key, value) => { storage[key] = value },
    removeStorageSync: key => { delete storage[key] }
  }
  const filename = path.join(__dirname, '../pages/login/login.js')
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    getApp: () => app, require: name => name.endsWith('/api') ? api : require(path.resolve(path.dirname(filename), name)), Page: value => { definition = value }, wx, getCurrentPages: () => Array(pageCount).fill({}), setTimeout: fn => fn(), console
  }, { filename })
  const page = { ...definition, data: { ...definition.data, agreePrivacy: true, wechatNickName: enteredName, wechatAvatarUrl: avatarPath } }
  page.setData = update => Object.assign(page.data, update)
  let profile
  page.startWeChatLogin = value => { profile = value }
  page.confirmWechatLogin()
  await page.doWeChatLogin(profile)
  return { updates, navigation, userInfo: app.globalData.userInfo }
}

test('empty nickname preserves an existing custom nickname while updating the avatar', async () => {
  const { updates, userInfo } = await login('原有昵称', '  ', 'chosen-avatar')
  assert.equal(updates.length, 1)
  assert.equal(updates[0].nick_name, '')
  assert.equal(updates[0].avatar_url, 'new-avatar')
  assert.equal(userInfo.nick_name, '原有昵称')
})

test('empty nickname and avatar do not send a profile update for an existing user', async () => {
  const { updates, userInfo } = await login('原有昵称', '')
  assert.equal(updates.length, 0)
  assert.equal(userInfo.nick_name, '原有昵称')
})

test('new account without a nickname receives the display fallback', async () => {
  const { updates } = await login('', '')
  assert.equal(updates.length, 1)
  assert.equal(updates[0].nick_name, '微信用户')
})

test('an explicitly entered nickname replaces the old one', async () => {
  const { updates } = await login('原有昵称', ' 新昵称 ')
  assert.equal(updates.length, 1)
  assert.equal(updates[0].nick_name, '新昵称')
})

test('successful login returns to invitation page rather than losing its code', async () => {
  const { navigation } = await login('测试用户', '', '', 2)
  assert.deepEqual(navigation, ['back'])
})

test('cold launch login goes to home when no previous page exists', async () => {
  const { navigation } = await login('测试用户', '', '', 1)
  assert.deepEqual(navigation, ['home'])
})
