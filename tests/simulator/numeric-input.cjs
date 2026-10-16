// Real WXML input binding checks with synthetic data; no backend writes.
const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs = require('node:fs')
const assert = require('node:assert/strict')
const output = process.env.MINI_QA_OUTPUT || '/tmp/sport-numeric-input'
fs.mkdirSync(output, { recursive: true })
const report = { checks: [], complete: false }
let mini
const check = (name, pass) => { report.checks.push({ name, pass }); assert.ok(pass, name) }
;(async () => {
  try {
    mini = await auto.connect({ wsEndpoint: process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9466' })
    report.device = await mini.systemInfo()
    await mini.mockWxMethod('request', () => ({ statusCode: 503, data: { code: 503 } }))
    let page = await mini.reLaunch('/pages/profile-edit/profile-edit')
    await page.setData({ userInfo: { nick_name: '模拟资料', gender: 0, age: 65, height: 170, weight: 67, health_status: '' } })
    const inputs = await page.$$('.input')
    for (const [i, field, value] of [[1, 'age', '65'], [2, 'height', '170'], [3, 'weight', '67']]) {
      check(field + ' uses integer keyboard', await inputs[i].attribute('type') === 'number')
      for (const invalid of ['66.5', '-1', '1e2']) {
        await inputs[i].input(invalid)
        await page.waitFor(100)
        check(field + ' rejects ' + invalid, String(await inputs[i].value()) === value && String(await page.data('userInfo.' + field)) === value)
      }
      await inputs[i].input('')
      await page.waitFor(100)
      check(field + ' can clear', (await page.data('userInfo'))[field] === null && await inputs[i].value() === '')
      await inputs[i].input(value)
    }
    await mini.screenshot({ path: output + '/profile.png' })
    page = await mini.reLaunch('/pages/goal/create')
    await page.setData({ selectedExercises: [{ exercise_id: 1, name: '模拟动作', sets: 3, reps: 10 }], membersLoaded: true, planType: 'personal', executorId: 1, name: '模拟计划' })
    const counts = await page.$$('.config-input')
    for (const [i, field, value] of [[0, 'sets', '3'], [1, 'reps', '10']]) {
      await counts[i].input('1.5')
      await page.waitFor(100)
      check(field + ' rejects decimal in rendered input', String(await counts[i].value()) === value)
      await counts[i].input('')
      check(field + ' remains empty while editing', (await page.data('selectedExercises'))[0][field] === '')
    }
    report.complete = true
  } catch (e) { report.error = e.message; process.exitCode = 1 }
  finally {
    if (mini) { await mini.restoreWxMethod('request').catch(() => {}); mini.disconnect() }
    fs.writeFileSync(output + '/result.json', JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ complete: report.complete, checks: report.checks.length, error: report.error }))
  }
})()
