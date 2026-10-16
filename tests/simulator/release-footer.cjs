const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const project = process.env.MINI_RELEASE_PROJECT
if (!project) throw Error('MINI_RELEASE_PROJECT must point to the prepared upload package')
const manifest = JSON.parse(fs.readFileSync(path.join(project, 'source-manifest.json')))
const output = process.env.MINI_QA_OUTPUT || '/tmp/sport-release-footer'
fs.mkdirSync(output, { recursive: true })
const report = { version: manifest.version, commit: manifest.commit, checks: [], complete: false }
let mini
const check = (name, pass, detail) => { report.checks.push({ name, pass, detail }); assert.ok(pass, name) }
;(async () => {
  try {
    mini = await auto.connect({ wsEndpoint: process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9474' })
    report.device = await mini.systemInfo()
    assert.equal(report.device.platform, 'devtools')
    await mini.mockWxMethod('request', () => ({ statusCode: 503, data: { code: 503 } }))
    await mini.mockWxMethod('getAccountInfoSync', () => ({ miniProgram: { envVersion: 'trial', version: '' } }))
    const page = await mini.reLaunch('/pages/profile/profile')
    await page.callMethod('loadVersion')
    const footer = await page.$('.footer-text')
    check('trial without API version shows packaged version', (await footer.text()).includes(`v${manifest.version}`))
    for (const [envVersion, version, expected] of [
      ['trial', '1.0.0', `v${manifest.version}`],
      ['release', '2.0.0', 'v2.0.0'],
      ['develop', '', '开发版'],
      ['trial', '', `v${manifest.version}`]
    ]) {
      await mini.mockWxMethod('getAccountInfoSync', value => ({ miniProgram: value }), { envVersion, version })
      await page.callMethod('loadVersion')
      check(`${envVersion}/${version || 'empty'} selects correct version`, await page.data('versionText') === expected)
    }
    for (const scale of [1, 1.3]) {
      const style = `--app-font-scale: ${scale}; --app-tab-height: ${112 + Math.round((scale - 1) * 50)}rpx;`
      await page.setData({ fontPageStyle: style })
      await mini.evaluate(value => {
        const pages = getCurrentPages(), tab = pages[pages.length - 1].getTabBar()
        if (tab) tab.setData({ fontPageStyle: value })
      }, style)
      await mini.pageScrollTo(100000)
      await page.waitFor(300)
      const rects = await mini.evaluate(() => new Promise(resolve => {
        const pages = getCurrentPages(), page = pages[pages.length - 1]
        page.createSelectorQuery().select('.footer-text').boundingClientRect(footer => {
          page.getTabBar().createSelectorQuery().select('.tab-bar').boundingClientRect(tab => resolve({ footer, tab })).exec()
        }).exec()
      }))
      check(`footer visible above navigation at scale ${scale}`, rects.footer && rects.tab && rects.footer.top >= 0 && rects.footer.bottom <= rects.tab.top + 1, rects)
      await mini.screenshot({ path: path.join(output, `footer-${scale}.png`) })
    }
    report.complete = true
  } catch (err) { report.error = err.message; process.exitCode = 1 }
  finally {
    if (mini) {
      await mini.restoreWxMethod('getAccountInfoSync').catch(() => {})
      await mini.restoreWxMethod('request').catch(() => {})
      mini.disconnect()
    }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ complete: report.complete, checks: report.checks.length, version: report.version, error: report.error }))
  }
})()
