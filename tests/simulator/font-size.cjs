// Official WeChat simulator. Synthetic identities, all backend writes rejected.
const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const output = process.env.MINI_QA_OUTPUT || '/tmp/sport-font-layout'
const label = process.argv[2] || 'current-device'
fs.mkdirSync(output, { recursive: true })
const report = { label, checks: [], exceptions: [], screenshots: [], productionWrites: 0 }
let mini
const save = () => fs.writeFileSync(path.join(output, label + '.json'), JSON.stringify(report, null, 2))
const check = (name, pass, detail) => { report.checks.push({ name, pass: !!pass, detail }); save(); assert.ok(pass, name) }
const wait = async (condition, name) => {
  const start = Date.now()
  while (Date.now() - start < 10000) {
    if (await condition()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error('timeout: ' + name)
}
const timer = setTimeout(async () => { report.error = 'deadline'; save(); await cleanup(); process.exit(2) }, 180000)
async function route(url) {
  const page = await mini.reLaunch(url)
  const expected = url.split('?')[0].slice(1)
  assert.equal(page.path, expected, 'official SDK route')
  await page.waitFor(250)
  return page
}

async function fields(selectors) {
  return mini.evaluate(selectors => new Promise(resolve => {
    const q = wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0])
    selectors.forEach(selector => q.select(selector).fields({ rect: true, size: true, computedStyle: ['font-size', 'line-height'] }))
    q.exec(resolve)
  }), selectors)
}
async function capture(name) {
  if (process.env.MINI_QA_SCREENSHOTS === '0') { report.screenshotStatus = 'not captured; visual review pending'; return }
  const file = path.join(output, label + '-' + name + '.png')
  await mini.screenshot({ path: file }); report.screenshots.push(file); save()
}
;(async () => {
  try {
    mini = await auto.connect({ wsEndpoint: process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9420' })
    mini.on('exception', error => { report.exceptions.push(String(error)); save() })
    const info = await mini.systemInfo()
    report.device = { model: info.model, width: info.windowWidth, height: info.windowHeight, safeBottom: info.screenHeight - info.safeArea.bottom }
    check('official simulator', info.platform === 'devtools', report.device)
    await mini.evaluate(() => {
      const snapshot = {}; wx.getStorageInfoSync().keys.forEach(key => { snapshot[key] = wx.getStorageSync(key) })
      getApp().__fontQa = { snapshot, writes: [], menus: [] }
      wx.setStorageSync('token', 'synthetic-local-session'); wx.setStorageSync('userId', 901)
      wx.setStorageSync('userInfo', { id: 901, nick_name: '模拟成员甲' }); wx.setStorageSync('currentFamilyId', 901)
      wx.setStorageSync('fontSizePreference', 'standard')
    })
    await mini.mockWxMethod('request', options => {
      const qa = getApp().__fontQa
      const route = options.url.replace(/^https?:\/\/[^/]+\/api/, '').split('?')[0]
      if ((options.method || 'GET') !== 'GET') { qa.writes.push(route); return { statusCode: 403, data: { code: 403 } } }
      const members = [901, 902].map(id => ({ user_id: id, role: id === 901 ? 'admin' : 'member', user: { id, nick_name: id === 901 ? '模拟成员甲' : '模拟长昵称成员乙', avatar_url: '/images/default-avatar.svg' } }))
      const exercise = { id: 3, name: '椅子深蹲完整动作示范', target_muscle: '大腿、臀部肌群', image_url: '/images/exercise/default-exercise.jpg' }
      const exercises = Array.from({ length: 4 }, (_, i) => ({ id: 91 + i, exercise_id: 3, sets: 3, reps: 10, exercise }))
      const family = { id: 901, name: '模拟家庭', invite_code: 'SYN901', members }
      let data = []
      if (route === '/families') data = [family]
      else if (route === '/goals/families') data = [{ family_id: 901, family_name: '模拟家庭', goals: [] }]
      else if (route === '/family/901') data = family
      else if (route === '/family/members') data = members
      else if (route === '/goals/901') data = { id: 901, family_id: 901, name: '每日锻炼共同计划', plan_type: 'shared', current_date: '2026-10-15', can_manage: true, is_participating: true, is_active: true, members, exercises }
      else if (route === '/goals/901/progress') data = { date: '2026-10-15', exercises, member_stats: members.map(member => ({ user_id: member.user_id, user_name: member.user.nick_name, total_sets: 12, completed_sets: 0, exercise_stats: exercises.map(item => ({ goal_exercise_id: item.id, exercise_name: exercise.name, completed_sets: 0, target_sets: 3 })) })) }
      else if (route === '/exercises/3') data = exercise
      else if (route === '/exercises') data = { list: [exercise], total: 1 }
      else if (route === '/user/statistics') data = { totalDays: 1, totalSets: 3 }
      else if (route === '/user/week-stats') data = { stats: [], weekRange: '模拟日期', canGoPrev: false, canGoNext: false }
      return { statusCode: 200, data: { code: 0, data } }
    })
    await mini.mockWxMethod('showActionSheet', options => { getApp().__fontQa.menus.push(options.itemList); return { tapIndex: -1 } })
    let page = await mini.currentPage()
    assert.equal(page.path, 'pages/index/index', 'Compile original project to home before this runner')
    await mini.evaluate(() => wx.setStorageSync('fontSizePreference', 'extraLarge'))
    await page.callMethod('onShow')
    await wait(async () => (await page.data('families')).length > 0, 'home families')
    await (await page.$('.family-switch')).trigger('tap')
    await wait(async () => (await mini.currentPage()).path === 'pages/family/family', 'home family route')
    page = await mini.currentPage()
    await wait(async () => !!await page.$('.action-buttons'), 'family actions')
    check('home opens family members and plans', (await mini.currentPage()).path === 'pages/family/family')
    await mini.pageScrollTo(100000)
    await capture('family-page-extra-large')
    await page.callMethod('goCreate')
    await wait(async () => (await mini.currentPage()).path === 'pages/family/join', 'family create route')
    check('family create opens create form', await (await mini.currentPage()).data('type') === 'create')
    await mini.evaluate(() => wx.setStorageSync('fontSizePreference', 'standard'))
    page = await route('/pages/profile/profile')
    await wait(async () => !!await page.$('.footer'), 'profile render')
    await page.callMethod('goToSetting', { currentTarget: { dataset: { id: 'fontSize' } } })
    await wait(async () => (await mini.currentPage()).path === 'pages/font-size/font-size', 'setting navigation')
    check('font setting opens from profile', (await mini.currentPage()).path === 'pages/font-size/font-size')
    page = await mini.currentPage()
    await page.waitFor(600)
    await wait(async () => !!await page.$('.preview-name'), 'font preview')
    let standard
    for (const [index, id, scale] of [[0, 'standard', 1], [1, 'large', 1.15], [2, 'extraLarge', 1.3]]) {
      const options = await page.$$('.font-option'); await options[index].trigger('tap')
      await wait(async () => await page.data('fontSizeId') === id, 'font selected')
      const [title, button] = await fields(['.preview-name', '.font-option'])
      const size = parseFloat(title['font-size']); if (!standard) standard = size
      check(id + ' changes actual rendered font', size > 0 && Math.abs(size / standard - scale) < .03, { title, standard })
      check(id + ' choice touch target fits viewport', button.height >= 44 && button.left >= 0 && button.right <= report.device.width + 1, button)
    }
    await capture('font-extra-large')
    page = await route('/pages/font-size/font-size')
    check('relaunch preserves font preference', await page.data('fontSizeId') === 'extraLarge')
    page = await route('/pages/profile/profile')
    await wait(async () => !!await page.$('.footer'), 'profile reload')
    check('profile displays selected size', (await page.data('settings')).find(item => item.id === 'fontSize').value === '特大')
    await mini.pageScrollTo(99999)
    const [profileFooter] = await fields(['.footer'])
    const bar = await mini.evaluate(() => new Promise(resolve => {
      const tab = getCurrentPages().slice(-1)[0].getTabBar(), q = wx.createSelectorQuery().in(tab)
      q.select('.tab-bar').boundingClientRect(); q.selectAll('.tab-text').boundingClientRect(); q.exec(resolve)
    }))
    check('large text stays inside navigation safe area', bar[1].every(item => item.bottom <= bar[0].bottom - report.device.safeBottom + 1), bar)
    check('profile content remains above navigation', profileFooter.bottom <= bar[0].top + 1, { profileFooter, bar: bar[0] })
    const footerText = await (await page.$('.footer')).text()
    check('profile footer keeps app version without tagline', footerText.includes('爸妈动起来') && !footerText.includes('专为老年人'))
    await capture('profile-bottom')
    page = await route('/pages/goal/detail?id=901')
    await wait(async () => !await page.data('loading') && !!await page.$('.exercise-main .exercise-image'), 'plan loaded')
    const [title, more] = await fields(['.goal-name', '.more-toggle'])
    check('plan title and menu do not overlap', title.right <= more.left + 1 && more.height >= 44, { title, more })
    await (await page.$('.more-toggle')).trigger('tap')
    await wait(async () => await mini.evaluate(() => getApp().__fontQa.menus.length > 0), 'menu opened')
    check('management actions use native menu', (await mini.evaluate(() => getApp().__fontQa.menus[0])).join(',') === '编辑计划,暂停计划,退出共同计划')
    await mini.pageScrollTo(420)
    await wait(async () => !!await page.$('.primary-action'), 'buttons rendered')
    const [card, image, complete, partial] = await fields(['.exercise-item', '.exercise-image', '.primary-action', '.partial-toggle'])
    check('image stays inside card without standalone demonstration button', !await page.$('.exercise-demo') && image.left >= card.left - 1 && image.right <= card.right + 1 && image.height >= 44, { card, image })
    check('completion controls align and fit card', Math.abs(complete.top - partial.top) < 1 && Math.abs(complete.height - partial.height) < 1 && Math.abs(complete.width - partial.width) <= 1 && complete.right <= partial.left + 1 && partial.right <= card.right + 1 && complete.height >= 48, { complete, partial, card })
    await capture('plan-actions-extra-large')
    const imageScroll = await mini.evaluate(() => new Promise(resolve => {
      const q = wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0])
      q.select('.exercise-image').boundingClientRect(); q.selectViewport().scrollOffset(); q.exec(resolve)
    }))
    await mini.pageScrollTo(Math.max(0, imageScroll[1].scrollTop + imageScroll[0].top - 80))
    await wait(async () => {
      const [image] = await fields(['.exercise-image'])
      return Math.abs(image.top - 80) <= 1
    }, 'image scroll finishes before tapping')
    await (await page.$('.exercise-main .exercise-image')).tap()
    await wait(async () => !!await page.$('.preview-panel'), 'demonstration popup')
    const [preview, close] = await fields(['.preview-panel', '.preview-close'])
    check('large text preview fits screen and close is reachable', preview.left >= 0 && preview.right <= report.device.width + 1 && preview.top >= 0 && preview.bottom <= report.device.height + 1 && close.height >= 44, { preview, close })
    await (await page.$('.preview-close')).trigger('tap')
    await wait(async () => !await page.data('previewExercise'), 'preview closed')
    await (await page.$('.partial-toggle')).trigger('tap')
    await wait(async () => Object.keys(await page.data('partialSets')).length === 1, 'partial set controls')
    check('partial controls still expand', Object.keys(await page.data('partialSets')).length === 1)
    page = await route('/pages/family/family')
    await wait(async () => !await page.data('loading') && (await page.data('families')).length === 1, 'family loaded')
    await page.setData({ family: { ...(await page.data('family')), name: '模拟家庭长名称用于检查换行与成员数量' } })
    const [familyName, memberCount] = await fields(['.family-name', '.member-count'])
    check('family count stays on one line beside a long name', familyName.right <= memberCount.left + 1 && memberCount.height <= parseFloat(memberCount['line-height']) + 16 * report.device.width / 750 + 1, { familyName, memberCount })
    const memberLayout = await mini.evaluate(() => new Promise(resolve => {
      const q = wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0])
      q.selectAll('.member-item').boundingClientRect(); q.selectAll('.member-info').boundingClientRect(); q.select('.member-actions').boundingClientRect(); q.exec(resolve)
    }))
    check('member name and management actions remain inside the row', memberLayout[1][1].right <= memberLayout[2].left + 1 && memberLayout[2].right <= memberLayout[0][1].right + 1, memberLayout)
    await capture('family-members-extra-large')
    await page.callMethod('goCreate')
    await wait(async () => (await mini.currentPage()).path === 'pages/family/join', 'create family navigation')
    page = await mini.currentPage()
    await page.waitFor(600) // Finish the native navigateTo transition before the next route.
    check('existing-family member can create without leaving', await page.data('type') === 'create' && await mini.evaluate(() => wx.getStorageSync('currentFamilyId')) === 901)
    report.productionWrites = await mini.evaluate(() => getApp().__fontQa.writes.length)
    check('no backend writes attempted', report.productionWrites === 0)
    check('no uncaught runtime errors', report.exceptions.length === 0, report.exceptions)
    report.completed = true
  } catch (error) { report.error = String(error.stack || error); process.exitCode = 1 }
  finally { clearTimeout(timer); await cleanup() }
})()

async function cleanup() {
  if (mini) {
    await mini.restoreWxMethod('request').catch(() => {})
    await mini.restoreWxMethod('showActionSheet').catch(() => {})
    await mini.evaluate(() => {
      const qa = getApp().__fontQa
      if (!qa) return
      wx.getStorageInfoSync().keys.forEach(key => wx.removeStorageSync(key))
      Object.keys(qa.snapshot).forEach(key => wx.setStorageSync(key, qa.snapshot[key]))
      delete getApp().__fontQa
    }).then(() => { report.storageRestored = true }).catch(error => { report.cleanupError = String(error); process.exitCode = 1 })
    mini.disconnect()
  }
  save(); console.log(JSON.stringify({ report: path.join(output, label + '.json'), checks: report.checks.length, completed: report.completed, error: report.error }))
}
