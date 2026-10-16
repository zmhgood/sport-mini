// Render loading/error states with synthetic data; never write to the backend.
const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const output = process.env.MINI_QA_OUTPUT || '/tmp/sport-profile-status'
fs.mkdirSync(output, { recursive: true })
const report = { checks: [], screenshots: [], writes: [], scope: 'Official simulator layout; synthetic data' }
let mini, preference
const save = () => fs.writeFileSync(path.join(output, 'profile-status.json'), JSON.stringify(report, null, 2))
const check = (name, pass, detail) => { report.checks.push({ name, pass, detail }); save(); assert.ok(pass, name) }
const timer = setTimeout(() => { report.error = 'deadline'; save(); mini?.disconnect(); process.exit(2) }, 60000)
;(async () => {
  mini = await auto.connect({ wsEndpoint: process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9461' })
  report.device = await mini.systemInfo()
  preference = await mini.evaluate(() => wx.getStorageSync('fontSizePreference'))
  await mini.evaluate(() => { getApp().__statusWrites = [] })
  await mini.mockWxMethod('request', options => {
    if ((options.method || 'GET') !== 'GET') getApp().__statusWrites.push(options.method)
    return { statusCode: 503, data: { code: 503, message: '模拟请求失败' } }
  })
  const page = await mini.reLaunch('/pages/profile/profile')
  await page.waitFor(400)
  for (const font of ['standard', 'extraLarge']) {
    await mini.evaluate(value => wx.setStorageSync('fontSizePreference', value), font)
    await page.callMethod('onShow')
    for (const state of ['loading', 'error']) {
      await page.setData({ isLoggedIn: false, statisticsLoading: state === 'loading', statisticsError: state === 'error' ? '统计加载失败，请重试' : '' })
      await page.waitFor(200)
      const rects = await mini.evaluate(() => new Promise(resolve => {
        const q = wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0])
        q.select('.stats-card').boundingClientRect()
        q.select('.stats-status').boundingClientRect()
        q.selectAll('.stat-item').boundingClientRect()
        q.select('.stats-status button').boundingClientRect()
        q.exec(resolve)
      }))
      const [card, status, items, button] = rects
      check(font + ' ' + state + ': status above values', items.length === 2 && items.every(item => item.top >= status.bottom), rects)
      check(font + ' ' + state + ': card stays in viewport', card.left >= 0 && card.right <= report.device.windowWidth + 1, card)
      check(font + ' ' + state + ': values remain side by side', Math.abs(items[0].top - items[1].top) < 1 && items[0].right <= items[1].left, items)
      if (button) check(font + ': retry touch target', button.height >= 44 && button.left >= card.left && button.right <= card.right, button)
      const file = path.join(output, font + '-' + state + '.png')
      await mini.screenshot({ path: file }); report.screenshots.push(file)
    }
  }
  report.writes = await mini.evaluate(() => getApp().__statusWrites)
  check('no business writes', report.writes.length === 0)
  report.complete = true
})().catch(error => { report.error = error.message; process.exitCode = 1 }).finally(async () => {
  if (mini) {
    await mini.restoreWxMethod('request').catch(() => {})
    if (preference !== undefined) await mini.evaluate(value => { if (value) wx.setStorageSync('fontSizePreference', value); else wx.removeStorageSync('fontSizePreference'); delete getApp().__statusWrites }, preference).catch(() => {})
    mini.disconnect()
  }
  clearTimeout(timer); save()
  console.log(JSON.stringify({ complete: report.complete, checks: report.checks.length, error: report.error, device: report.device && { width: report.device.windowWidth, height: report.device.windowHeight } }))
})
