// Local contract probes. No network, real accounts, storage or database writes.
// Kept separate from *.test.js: known failures remain visible until fixed.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { deferred, loadPage } = require('./page-harness')
const ok = data => ({ code: 0, data })
const results = []

async function probe(id, source, run) {
  try {
    await run()
    results.push({ id, source, status: 'PASS' })
  } catch (err) {
    results.push({ id, source, status: err instanceof assert.AssertionError ? 'FAIL' : 'ERROR', message: err.message })
  }
}

// Execute the actual Vue arrow function with synthetic dependencies, not its copy.
function adminFunction(file, name, next, context) {
  const source = fs.readFileSync(path.resolve(process.env.QA_ADMIN_ROOT || path.resolve(__dirname, '../../admin'), file), 'utf8')
  const start = source.indexOf(`const ${name} = `)
  const end = source.indexOf(`\nconst ${next} = `, start)
  if (start < 0 || end < 0) throw Error(`Cannot locate ${name}`)
  return vm.runInNewContext(`(${source.slice(start + `const ${name} = `.length, end).trim()})`, { listRequestId: 0, detailRequestId: 0, loadError: { value: '' }, ...context })
}

async function main() {
  await probe('CAT-01', 'pages/index/index.js:86', async () => {
    const { page } = loadPage('pages/index/index.js', async () => ok({ list: [
      { id: 202, muscle_group_id: 2 }, { id: 204, muscle_group_id: 4 }
    ] }))
    await page.getRecommendExercises()
    assert.equal(page.data.recommendExercises.find(x => x.id === 202).category, 'upper')
    assert.equal(page.data.recommendExercises.find(x => x.id === 204).category, 'core')
  })
  await probe('CAT-02', 'pages/muscle/muscle.js:75', async () => {
    const { page } = loadPage('pages/muscle/muscle.js', async () => ok({ list: [
      { id: 202, muscle_group_id: 2 }, { id: 207, muscle_group_id: 7 },
      { id: 204, muscle_group_id: 4 }, { id: 203, muscle_group_id: 3 }
    ] }))
    page.setData({ currentTab: 0 })
    await page.getExercises()
    assert.deepEqual(Array.from(page.data.exercises, x => x.id), [202, 207], 'Upper limb tab must include upper/shoulder and exclude core/lower')
  })
  await probe('GOAL-05', 'pages/goal/create.js:239', async () => {
    const wait = deferred()
    const { page, calls } = loadPage('pages/goal/create.js', () => wait.promise)
    page.setData({ familyId: 700, membersLoaded: true, name: 'Synthetic goal', planType: 'personal', executorId: 701,
      selectedExercises: [{ exercise_id: 702, sets: 3, reps: 10 }] })
    const pending = [page.createGoal(), page.createGoal()]
    const count = calls.length
    wait.resolve(ok({ id: 703 })); await Promise.all(pending)
    assert.equal(count, 1, 'Two concurrent handlers must produce one create request')
  })
  await probe('PROF-03', 'pages/profile-edit/profile-edit.js:88', async () => {
    const wait = deferred()
    let writes = 0
    const { page } = loadPage('pages/profile-edit/profile-edit.js', (url, method) => {
      if (method === 'PUT') { writes++; return wait.promise }
      return Promise.resolve(ok({ id: 701, nick_name: 'Synthetic' }))
    })
    const pending = [page.onSave(), page.onSave()]
    wait.resolve(ok()); await Promise.all(pending)
    await page.onSave()
    assert.equal(writes, 1, 'Save must guard duplicate invocation through success and readback')
  })
  await probe('AUTH-06', 'pages/profile/profile.js:304', async () => {
    const storage = { token: 'synthetic-token', userInfo: { id: 701 }, userId: 701, currentFamilyId: 700 }
    const { page } = loadPage('pages/profile/profile.js', async () => ok(), storage,
      { wx: { showModal: ({ success }) => success({ confirm: true }) } })
    page.handleLogout()
    assert.equal(storage.userId, undefined, 'Logout must clear account-specific identity')
    assert.equal(storage.currentFamilyId, undefined, 'Logout must clear account-specific family selection')
  })
  await probe('STAT-14', 'pages/profile/profile.js:146', async () => {
    const old = deferred(), recent = deferred()
    const { page } = loadPage('pages/profile/profile.js', url => url.includes('=-1') ? old.promise : recent.promise)
    page.loadWeekStats(-1); page.loadWeekStats(0)
    recent.resolve(ok({ stats: [], weekRange: 'current', canGoPrev: true, canGoNext: false }))
    await new Promise(resolve => setImmediate(resolve))
    old.resolve(ok({ stats: [], weekRange: 'previous', canGoPrev: true, canGoNext: true }))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(page.data.currentWeekOffset, 0, 'Late old response must not replace the latest selected week')
  })
  await probe('LOAD-07', 'pages/goal/progress.js:40', async () => {
    const { page } = loadPage('pages/goal/progress.js', async () => ok())
    assert.doesNotThrow(() => page.onLoad({ goal_id: '703', exercise: '%not-json' }),
      'Invalid or outdated route data must show an error rather than crash')
  })
  await probe('ADM-04', 'admin/src/views/users/index.vue:158', async () => {
    const users = { value: [] }, pagination = { page: 1, pageSize: 10, total: 0 }
    await adminFunction('src/views/users/index.vue', 'loadUsers', 'handleSearch', {
      users, pagination, loading: { value: false }, searchForm: {},
      request: { get: async () => { throw Error('synthetic network failure') } }
    })()
    assert.equal(users.value.length, 0, 'A failed real request must never introduce invented users')
  })
  await probe('ADM-05', 'admin/src/views/families/index.vue:131', async () => {
    let sent
    await adminFunction('src/views/families/index.vue', 'loadFamilies', 'handleSearch', {
      families: { value: [] }, pagination: { page: 1, pageSize: 10, total: 0 },
      loading: { value: false }, searchForm: { keyword: 'Synthetic family' },
      getFamilies: async data => { sent = data; return ok({ list: [], total: 0 }) }, console
    })()
    assert.equal(sent.keyword, 'Synthetic family', 'Family search must send the entered keyword')
  })
  await probe('ADM-06', 'admin/src/views/families/index.vue:125', async () => {
    const name = adminFunction('src/views/families/index.vue', 'getCreatorName', 'loadFamilies', {})
    assert.equal(name({ creator_id: 701, members: [
      { user_id: 701, role: 'member', user: { nick_name: 'Creator' } },
      { user_id: 704, role: 'admin', user: { nick_name: 'New admin' } }
    ] }), 'Creator', 'Creator and current administrator are distinct roles')
  })
  await probe('ADM-07', 'admin/src/views/comments/index.vue:143', async () => {
    const row = { id: 705, status: 1 }, messages = []
    await adminFunction('src/views/comments/index.vue', 'handleToggleStatus', 'handleDelete', {
      ElMessageBox: { confirm: async () => {} }, ElMessage: { success: msg => messages.push(msg), error() {} },
      request: { put: async () => { throw Error('synthetic save failure') } }, loadComments() {}
    })(row)
    assert.equal(messages.length, 0, 'Failed moderation must not show success')
    assert.equal(row.status, 1, 'Failed moderation must preserve the existing state')
  })
  await probe('ADM-08', 'admin/src/views/exercises/index.vue:277', async () => {
    const form = {}
    adminFunction('src/views/exercises/index.vue', 'handleEdit', 'handleSubmit', {
      form, resetForm() {}, isEdit: { value: false }, dialogVisible: { value: false }
    })({ id: 702, name: 'Synthetic action', video_url: 'https://example.invalid/qa.mp4', sort: 19 })
    assert.equal(form.video_url, 'https://example.invalid/qa.mp4', 'Editing a name must preserve the existing video')
    assert.equal(form.sort, 19, 'Editing a name must preserve the existing sort order')
  })
  await probe('WORK-04', 'pages/goal/progress.js:129', async () => {
    const wait = deferred()
    const { page, calls } = loadPage('pages/goal/progress.js', () => wait.promise)
    page.setData({ goalId: 703, exercise: { goal_exercise_id: 702, sets: 3 }, completedSets: 3 })
    const pending = [page.submitProgress(), page.submitProgress()]
    const count = calls.length
    wait.resolve(ok()); await Promise.all(pending)
    await page.submitProgress()
    assert.equal(count, 1); assert.equal(calls.length, 1)
  })
  const report = { date: '2026-10-13', scope: 'Actual page/Vue functions with synthetic dependencies; not real DB or phone verification', results }
  const output = process.env.QA_RISK_REPORT || '/tmp/qa-risk-audit-20261013.json'
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
  for (const result of results) console.log(`${result.status} ${result.id}`)
  console.log(`Report: ${output}`)
  if (results.some(x => x.status !== 'PASS')) process.exitCode = 1
}

main().catch(err => { console.error(err); process.exitCode = 1 })
