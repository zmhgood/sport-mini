// Real WeChat/network checks. No mocks; never print login codes or credentials.
// Avatar upload requires --upload-avatar and uses a synthetic PNG, without changing profile.
const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const output = process.env.MINI_QA_OUTPUT || '/tmp/sport-domain-network'
const root = path.resolve(__dirname, '../../..')
const report = { checks: [], avatarProfileChanged: false, screenshot: null }
fs.mkdirSync(output, { recursive: true })
let mini
const timer = setTimeout(() => { save(); mini?.disconnect(); process.exit(2) }, 120000)
function save() { fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2)) }
;(async () => {
  try {
    const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
    const privatePath = path.join(root, 'project.private.config.json')
    const local = fs.existsSync(privatePath) ? JSON.parse(fs.readFileSync(privatePath, 'utf8')) : {}
    assert.equal(local.setting?.urlCheck ?? project.setting?.urlCheck, true, 'Enable domain checks before testing')
    mini = await auto.connect({ wsEndpoint: process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9460' })
    report.result = await mini.evaluate(uploadAvatar => {
      const base = 'https://www.dosport.online/api'
      const result = {}
      const request = (url, method = 'GET', data = {}, token = '') => new Promise(resolve => wx.request({
        url, method, data, timeout: 15000,
        header: token ? { Authorization: 'Bearer ' + token } : {},
        success: r => resolve(r), fail: e => resolve({ error: e.errMsg })
      }))
      let token = ''
      let avatarPath = ''
      const imageInfo = src => new Promise(resolve => wx.getImageInfo({
        src, success: r => resolve({ width: r.width, height: r.height }), fail: e => resolve({ error: e.errMsg })
      }))
      return request('https://example.invalid/domain-check').then(r => {
        result.unlistedRejected = /url not in domain list/.test(r.error || '')
        if (!result.unlistedRejected) throw Error('Domain enforcement not proven; refusing login/upload')
        return new Promise(resolve => wx.login({ timeout: 15000, success: resolve, fail: e => resolve({ error: e.errMsg }) }))
      }).then(login => {
        if (!login.code) throw Error('wx.login did not return a code')
        return request(base + '/auth/login', 'POST', { code: login.code })
      }).then(r => {
        token = r.data && r.data.data && r.data.data.token
        result.login = { status: r.statusCode, code: r.data && r.data.code, authenticated: !!token, error: r.error }
        if (!token) throw Error('Real login failed')
        return request(base + '/user/info', 'GET', {}, token)
      }).then(r => {
        result.profileRead = r.statusCode === 200 && r.data.code === 0
        if (!uploadAvatar) { result.avatar = { skipped: 'Pass --upload-avatar to upload synthetic media' }; return }
        avatarPath = wx.env.USER_DATA_PATH + '/domain-check-avatar.png'
        wx.getFileSystemManager().writeFileSync(avatarPath, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2bS8AAAAASUVORK5CYII=', 'base64')
        return new Promise(resolve => wx.uploadFile({
          url: base + '/upload/image', filePath: avatarPath, name: 'file',
          header: { Authorization: 'Bearer ' + token }, timeout: 20000,
          success: r => resolve(r), fail: e => resolve({ error: e.errMsg })
        })).then(r => {
          let body; try { body = JSON.parse(r.data) } catch (_) {}
          result.avatar = { status: r.statusCode, code: body && body.code, error: r.error }
          if (body && body.code === 0 && body.data.url) {
            result.avatarUrl = body.data.url
            return imageInfo(body.data.url).then(info => { result.avatar.image = info })
          }
        })
      }).then(() => request(base + '/exercises', 'GET', { page: 1, page_size: 100 })).then(r => {
        const data = r.data && r.data.data
        const list = Array.isArray(data) ? data : (data && data.list) || []
        const item = list.find(x => /\.gif(?:\?|$)/i.test(x.gif_url || ''))
        if (!item) { result.gif = { error: 'No GIF in public exercise list' }; return }
        result.gifUrl = item.gif_url
        return imageInfo(item.gif_url).then(info => { result.gif = info })
      }).catch(e => { result.failure = e.message }).then(() => {
        token = ''
        if (avatarPath) { try { wx.getFileSystemManager().unlinkSync(avatarPath) } catch (_) {} }
        return result
      })
    }, process.argv.includes('--upload-avatar'))
    const r = report.result
    // getImageInfo uses the download allowlist; the app renders with <image>.
    // Observe the actual component's native load/error callbacks separately.
    async function renderMedia(src, label) {
      if (!src) return false
      const page = await mini.reLaunch('/pages/goal/progress')
      await page.setData({ exercise: { name: label, gif_url: src, image_url: src, sets: 1, reps: 1 }, progressLoading: false })
      const component = await page.$('exercise-media')
      const start = Date.now()
      let state
      do {
        state = await component.data()
        if (!state.loading) break
        await page.waitFor(200)
      } while (Date.now() - start < 15000)
      const pass = !state.loading && !state.failed && state.src === src
      await mini.screenshot({ path: path.join(output, label + '.png') })
      return pass
    }
    r.gifRendered = await renderMedia(r.gifUrl, 'gif-native-render')
    r.avatarRendered = await renderMedia(r.avatarUrl, 'avatar-native-render')
    report.checks = [
      { name: 'unlisted domain rejected', pass: r.unlistedRejected === true },
      { name: 'real WeChat login', pass: r.login?.authenticated === true },
      { name: 'authenticated profile read', pass: r.profileRead === true },
      { name: 'GIF native image load', pass: r.gifRendered }
    ]
    if (process.argv.includes('--upload-avatar')) report.checks.push({ name: 'synthetic avatar upload and native load', pass: r.avatar?.status === 200 && r.avatar?.code === 0 && r.avatarRendered })
    if (r.gifUrl) {
      const page = await mini.reLaunch('/pages/gif-viewer/gif-viewer?title=域名校验示范&src=' + encodeURIComponent(r.gifUrl))
      await page.waitFor(1200)
      report.screenshot = path.join(output, 'gif-viewer.png')
      await mini.screenshot({ path: report.screenshot })
    }
    save()
    console.log(JSON.stringify({ checks: report.checks, failure: r.failure }))
    assert.ok(report.checks.every(c => c.pass), 'Some real-network checks failed; inspect result.json')
  } catch (e) { report.error = e.message; save(); console.error(e.message); process.exitCode = 1 }
  finally { mini?.disconnect(); clearTimeout(timer) }
})()
