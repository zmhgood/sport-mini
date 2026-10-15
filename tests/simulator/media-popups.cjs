// Official simulator only. Synthetic accounts/plans; every API write is rejected.
const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const output = process.env.MINI_QA_OUTPUT || '/tmp/sport-media-popups'
const label = process.argv[2] || Date.now().toString()
const hold = process.argv.includes('--hold-picker')
fs.mkdirSync(output, { recursive: true })
const report = { label, checks: [], exceptions: [], screenshots: [], productionWrites: 0 }
let mini
const save = () => fs.writeFileSync(path.join(output, `${label}.json`), JSON.stringify(report, null, 2))
const check = (name, pass, detail) => { report.checks.push({ name, pass: !!pass, detail }); save(); assert.ok(pass, name) }
const timeout = setTimeout(() => { report.error = 'deadline'; save(); mini?.disconnect(); process.exit(2) }, 90000)
const wait = async (fn, name, duration = 8000) => {
  const start = Date.now()
  while (Date.now() - start < duration) {
    if (await fn()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error(`timeout: ${name}`)
}
async function route(url) {
  await mini.evaluate(url => { wx.reLaunch({ url }); return true }, url)
  const expected = url.split('?')[0].slice(1)
  await wait(async () => await mini.evaluate(() => getCurrentPages().slice(-1)[0]?.route) === expected, expected)
  await new Promise(resolve => setTimeout(resolve, 200))
  const page = await mini.currentPage()
  assert.equal(page.path, expected)
  return page
}
const rects = selectors => mini.evaluate(selectors => new Promise(resolve => {
  const q = wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0])
  selectors.forEach(selector => q.select(selector).boundingClientRect())
  q.selectViewport().scrollOffset(); q.exec(resolve)
}), selectors)
async function capture(name) {
  const file = path.join(output, `${label}-${name}.png`)
  await mini.screenshot({ path: file }); report.screenshots.push(file); save()
}
async function picker() {
  const page = await route('/pages/goal/create?family_id=901')
  await wait(async () => await page.data('membersLoaded'), 'members')
  await page.setData({ isAdmin: true, currentUserId: 901, executorId: 901, name: '模拟锻炼计划', members: [{ user_id: 901, selected: true, user: { nick_name: '模拟成员' } }], selectedExercises: Array.from({ length: 8 }, (_, i) => ({ exercise_id: 100 + i, name: '模拟已选动作' + i, sets: 3, reps: 10 })) })
  await mini.pageScrollTo(240)
  await page.callMethod('addExercise')
  await wait(async () => !!await page.$('.modal-content'), 'picker')
  const [panel, body, footer, button, viewport] = await rects(['.modal-content', '.modal-body', '.modal-footer', '.btn-confirm'])
  check('picker fits screen', panel.top >= 0 && panel.bottom <= report.device.height + 1, panel)
  check('scrolling list stays above footer', body.bottom <= footer.top + 1 && body.height > 80, { body, footer })
  check('confirmation visible and tappable', button.height >= 44 && button.bottom <= report.device.height - report.device.safeBottom + 1, button)
  const scroll = await page.$('.modal-body')
  await scroll.scrollTo(0, 9999)
  await wait(async () => await scroll.property('scrollTop') > 0, 'list scroll')
  const after = await rects(['.btn-confirm'])
  check('footer fixed while list scrolls', Math.abs(after[0].top - button.top) < 1, after[0])
  check('page stays still behind picker', after[1].scrollTop === viewport.scrollTop, after[1])
  await capture('picker-bottom')
  const items = await page.$$('.exercise-option')
  await items[items.length - 1].trigger('tap')
  await wait(async () => (await page.data('exerciseList')).some(e => e.id === 123 && e._selected), 'last item selected')
  await page.callMethod('confirmExercises')
  check('last action can be selected', (await page.data('selectedExercises')).some(e => e.exercise_id === 123))
  await page.callMethod('addExercise')
  await (await page.$('.modal-body')).scrollTo(0, 500)
  await page.callMethod('switchCategory', { currentTarget: { dataset: { category: 'upper' } } })
  await wait(async () => await (await page.$('.modal-body')).property('scrollTop') === 0, 'category reset')
  check('category resets scroll', await (await page.$('.modal-body')).property('scrollTop') === 0)
  if (hold) {
    await page.callMethod('switchCategory', { currentTarget: { dataset: { category: 'all' } } })
    report.nativeInputBaseline = await rects(['.modal-body', '.modal-footer', '.exercise-option'])
    report.holdingPicker = true
  } else {
    await (await page.$('.modal-close')).trigger('tap')
    await wait(async () => !await page.data('showExerciseModal'), 'picker dismissed')
    check('close dismisses picker', !await page.data('showExerciseModal'))
  }
}
;(async () => {
  try {
    mini = await auto.connect({ wsEndpoint: process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9420' })
    mini.on('exception', err => { report.exceptions.push(String(err)); save() })
    const info = await mini.systemInfo()
    report.device = { model: info.model, width: info.windowWidth, height: info.windowHeight, safeBottom: Math.max(0, info.screenHeight - (info.safeArea?.bottom || info.screenHeight)) }
    await mini.evaluate(() => {
      getApp().__mediaQA = { writes: 0, exercise: { id: 3, name: '椅子深蹲', image_url: 'https://sport-online-1407507629.cos.ap-chengdu.myqcloud.com/uploads/images/2026/04/10/1775803351625101565.jpeg', gif_url: 'https://sport-online-1407507629.cos.ap-chengdu.myqcloud.com/uploads/images/2026/04/14/1776157467421687598.gif' } }
    })
    await mini.mockWxMethod('request', options => {
      const qa = getApp().__mediaQA
      if ((options.method || 'GET') !== 'GET') { qa.writes++; return { statusCode: 403, data: { message: 'QA rejects writes' } } }
      const route = options.url.replace(/^https?:\/\/[^/]+\/api/, '').split('?')[0]
      let data = []
      if (route === '/exercises/3') data = qa.exercise
      else if (route === '/exercises') data = { list: Array.from({ length: 24 }, (_, i) => ({ id: 100 + i, name: '模拟动作长名称 ' + i, target_muscle: '模拟目标肌肉', muscle_group_id: i % 3 + 1 })), total: 24 }
      else if (route === '/family/901') data = { id: 901, name: '模拟家庭', members: [{ user_id: 901, role: 'admin' }] }
      else if (route === '/family/members') data = [{ user_id: 901, role: 'admin', user: { nick_name: '模拟成员' } }]
      else if (route === '/goals/901') data = { id: 901, name: '模拟共同计划', plan_type: 'shared', current_date: '2026-10-15', is_participating: true, is_active: true, members: [], exercises: [{ id: 91, exercise_id: 3, sets: 3, reps: 10, exercise: qa.exercise }] }
      else if (route === '/goals/901/progress') data = { date: '2026-10-15', member_stats: [], exercises: [] }
      return { statusCode: 200, data: { code: 0, data } }
    })
    let page = await route('/pages/goal/detail?id=901')
    await wait(async () => !await page.data('loading'), 'plan loaded')
    await wait(async () => !!await page.$('.exercise-main'), 'exercise card rendered')
    const progressBefore = JSON.stringify(await page.data('exerciseStatus'))
    await (await page.$('.exercise-main')).trigger('tap')
    await wait(async () => !!await page.$('.preview-panel'), 'preview')
    let media = await page.$('exercise-media')
    await wait(async () => !await media.data('loading'), 'GIF loaded', 20000)
    check('card opens GIF popup', (await media.data('src')).endsWith('.gif') && !await media.data('failed'), await media.data('message'))
    check('media is animation rather than video', !await media.data('isVideo'))
    const [panel, close] = await rects(['.preview-panel', '.preview-close'])
    check('preview fits screen', panel.top >= 0 && panel.bottom <= report.device.height + 1 && close.height >= 44 && close.width === 44, { panel, close })
    await capture('preview')
    await (await page.$('.preview-close')).trigger('tap')
    await wait(async () => !await page.data('previewExercise') && !await page.$('.preview-panel'), 'preview dismissed')
    check('preview leaves progress untouched', !await page.data('previewExercise') && JSON.stringify(await page.data('exerciseStatus')) === progressBefore)
    await (await page.$('.exercise-main')).trigger('tap')
    await wait(async () => !!await page.$('.preview-backdrop'), 'reopened preview')
    await (await page.$('.preview-backdrop')).trigger('tap')
    await wait(async () => !await page.data('previewExercise'), 'backdrop dismissed')
    check('backdrop closes preview', !await page.data('previewExercise'))
    const exercise = await mini.evaluate(() => ({ ...getApp().__mediaQA.exercise, goal_exercise_id: 91, sets: 3, reps: 10 }))
    page = await route('/pages/goal/progress?goal_id=901&exercise=' + encodeURIComponent(JSON.stringify(exercise)))
    await wait(async () => !!await page.$('exercise-media'), 'inline media rendered')
    media = await page.$('exercise-media')
    await wait(async () => !await media.data('loading'), 'inline GIF loaded', 20000)
    check('progress shows inline GIF', (await media.data('src')).endsWith('.gif') && !await media.data('failed'))
    await capture('progress-gif')
    await mini.pageScrollTo(9999)
    const [sets, submit] = await rects(['.sets-section', '.btn-submit'])
    check('groups visible above submit at page bottom', sets.bottom <= submit.top && submit.bottom <= report.device.height - report.device.safeBottom + 1, { sets, submit })
    await media.callMethod('onError')
    await wait(async () => !await media.data('loading'), 'cover fallback')
    check('broken GIF shows cover and retry', await media.data('fetchError') && (await media.data('src')).endsWith('.jpeg'))
    await picker()
    check('no attempted writes', await mini.evaluate(() => getApp().__mediaQA.writes) === 0)
    check('no runtime exceptions', report.exceptions.length === 0)
    report.completed = true
  } catch (error) { report.error = error.stack; process.exitCode = 1 }
  finally {
    if (mini && !report.holdingPicker) {
      await mini.restoreWxMethod('request').catch(() => {})
      await mini.evaluate(() => { delete getApp().__mediaQA }).catch(() => {})
    }
    mini?.disconnect(); clearTimeout(timeout); save()
    console.log(JSON.stringify({ file: path.join(output, `${label}.json`), device: report.device, passed: report.checks.filter(c => c.pass).length, error: report.error, hold: report.holdingPicker }))
  }
})()
