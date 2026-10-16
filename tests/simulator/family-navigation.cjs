const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const output = process.env.MINI_QA_OUTPUT || '/tmp/sport-family-navigation'
fs.mkdirSync(output, { recursive: true })
const report = { checks: [], complete: false }
let mini
const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2))
const check = (name, pass) => { report.checks.push({ name, pass: !!pass }); assert.ok(pass, name) }
const timer = setTimeout(() => { report.error = 'Simulator timeout'; save(); mini?.disconnect(); process.exit(2) }, 60000)
async function route(expected) {
  for (let i = 0; i < 50; i++) {
    const page = await mini.currentPage()
    if (page.path === expected) { await page.waitFor(300); return page }
    await page.waitFor(100)
  }
  throw Error(`Did not reach ${expected}`)
}
;(async () => {
  try {
    mini = await auto.connect({ wsEndpoint: process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9472' })
    report.device = await mini.systemInfo()
    assert.equal(report.device.platform, 'devtools')
    await mini.evaluate(() => {
      const keys = ['token', 'userId', 'userInfo', 'currentFamilyId', 'fontSizePreference']
      getApp().__navigationQa = { backup: keys.map(key => [key, wx.getStorageSync(key)]), writes: [] }
      wx.setStorageSync('token', 'synthetic-token')
      wx.setStorageSync('userId', 901)
      wx.setStorageSync('userInfo', { id: 901, nick_name: '模拟成员' })
      wx.setStorageSync('currentFamilyId', 901)
    })
    await mini.mockWxMethod('request', options => {
      const route = options.url.replace(/^https?:\/\/[^/]+\/api/, '').split('?')[0]
      if ((options.method || 'GET') !== 'GET') {
        getApp().__navigationQa.writes.push(route)
        return { statusCode: 403, data: { code: 403 } }
      }
      const families = [901, 902].map(id => ({ id, name: `模拟家庭${id}`, members: [{ user_id: 901, role: 'admin', user: { nick_name: '模拟成员' } }] }))
      let data = []
      if (route === '/families') data = families
      else if (route === '/goals/families') data = families.map(f => ({ family_id: f.id, family_name: f.name, goals: [] }))
      else if (/^\/family\/\d+$/.test(route)) data = families.find(f => f.id === Number(route.split('/').pop()))
      else if (route === '/exercises') data = { list: [] }
      else if (route === '/user/info') data = { id: 901, nick_name: '模拟成员' }
      return { statusCode: 200, data: { code: 0, data } }
    })
    for (const font of process.env.MINI_QA_FONT ? [process.env.MINI_QA_FONT] : ['standard', 'extraLarge']) {
      await mini.evaluate(value => wx.setStorageSync('fontSizePreference', value), font)
      let page = await mini.reLaunch('/pages/index/index')
      await page.waitFor(500)
      const header = await page.$('.family-switch')
      check(`${font}: home family entry rendered`, !!header)
      check(`${font}: retired family sheet absent`, !await page.$('.family-popup'))
      await mini.screenshot({ path: path.join(output, `home-${font}.png`) })
      await header.trigger('tap')
      page = await route('pages/family/family')
      check(`${font}: home opens family page`, !!await page.$('.family-card'))
      check(`${font}: multi-family picker remains available`, !!await page.$('.family-selector picker'))
      await page.callMethod('onFamilyChange', { detail: { value: '1' } })
      await page.waitFor(300)
      check(`${font}: selected family changes`, (await page.data('family')).id === 902)
      await mini.navigateBack()
      page = await route('pages/index/index')
      check(`${font}: home reflects selected family after return`, (await page.data('currentFamily')).id === 902)
      check(`${font}: home navigation visible after return`, await mini.evaluate(() => !getCurrentPages().at(-1).getTabBar().data.hidden))
      page = await mini.reLaunch('/pages/profile/profile')
      await page.waitFor(400)
      await page.callMethod('goToSetting', { currentTarget: { dataset: { id: 'family' } } })
      await route('pages/family/family')
      check(`${font}: profile family entry reaches same page`, true)
    }
    check('no business writes', await mini.evaluate(() => getApp().__navigationQa.writes.length === 0))
    report.complete = true
  } catch (err) { report.error = err.message; process.exitCode = 1 }
  finally {
    clearTimeout(timer)
    if (mini) {
      await mini.evaluate(() => {
        for (const [key, value] of getApp().__navigationQa.backup) {
          if (value === '') wx.removeStorageSync(key)
          else wx.setStorageSync(key, value)
        }
        delete getApp().__navigationQa
      }).catch(() => {})
      await mini.restoreWxMethod('request').catch(() => {})
      mini.disconnect()
    }
    save()
    console.log(JSON.stringify({ complete: report.complete, checks: report.checks.length, error: report.error }))
  }
})()
