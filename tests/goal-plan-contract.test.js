const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { loadPage } = require('./page-harness')

const ok = data => ({ code: 0, data })
const selectedExercise = { exercise_id: 31, name: '坐姿抬腿', sets: 3, reps: 10 }

function createPage() {
  const requests = []
  const { page } = loadPage('pages/goal/create.js', async (url, method, data) => {
    requests.push({ url, method, data })
    return ok({ id: 12 })
  }, { userId: 7 })
  page.setData({ familyId: 4, currentUserId: 7, membersLoaded: true, name: '每日锻炼', members: [{ user_id: 7 }, { user_id: 8 }], selectedExercises: [selectedExercise] })
  return { page, requests }
}

test('personal plan creates for only the selected executor without selecting other members', async () => {
  const { page, requests } = createPage()
  page.setData({ planType: 'personal', executorId: 8 })
  await page.createGoal()
  const request = requests[0]
  assert.equal(request.method, 'POST')
  assert.equal(request.url, '/goals?family_id=4')
  assert.equal(request.data.plan_type, 'personal')
  assert.equal(request.data.executor_id, 8)
  assert.equal('member_ids' in request.data, false)
  assert.deepEqual(JSON.parse(JSON.stringify(request.data.exercises)), [{ exercise_id: 31, sets: 3, reps: 10 }])
  assert.ok(request.data.request_id)
})

test('shared plan creation can opt out and never includes another member', async () => {
  const { page, requests } = createPage()
  page.setData({ planType: 'shared', participateInShared: false })
  await page.createGoal()
  assert.equal(requests[0].data.plan_type, 'shared')
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].data.member_ids)), [])
  page._completed = false
  page.setData({ loading: false, participateInShared: true })
  await page.createGoal()
  assert.deepEqual(JSON.parse(JSON.stringify(requests[1].data.member_ids)), [7])
})

test('editing sends only editable fields and displays server effective date', async () => {
  const requests = []
  const notices = []
  const { page } = loadPage('pages/goal/create.js', async (url, method, data) => {
    requests.push({ url, method, data })
    return ok({ pending_effective_date: '2026-10-16' })
  }, { userId: 7 }, { wx: { showToast: ({ title }) => notices.push(title) } })
  page.setData({ isEditing: true, goalId: 12, familyId: 4, membersLoaded: true, goalLoaded: true, executorId: 7, name: '计划', selectedExercises: [selectedExercise] })
  await page.createGoal()
  assert.equal(requests[0].url, '/goals/12')
  assert.equal(requests[0].method, 'PUT')
  assert.equal(requests[0].data.name, '计划')
  assert.equal('plan_type' in requests[0].data, false)
  assert.equal('executor_id' in requests[0].data, false)
  assert.match(notices[0], /2026-10-16/)
})

test('edit form prefers the server-saved pending exercise schedule', async () => {
  const { page } = loadPage('pages/goal/create.js', async () => ok({
    name: '目标', plan_type: 'personal', executor_id: 7, pending_effective_date: '2026-10-16',
    exercises: [{ exercise_id: 1, sets: 2, reps: 8, exercise: { name: '当前动作' } }],
    pending_exercises: [{ exercise_id: 2, sets: 4, reps: 9, exercise: { name: '待生效动作' } }]
  }))
  await page.loadGoal(12)
  assert.equal(page.data.selectedExercises[0].name, '待生效动作')
  assert.equal(page.data.selectedExercises[0].sets, 4)
  assert.equal(page.data.goalLoaded, true)
})

test('legacy goal without a plan type is treated as a shared plan', async () => {
  const { page } = loadPage('pages/goal/create.js', async () => ok({ name: '旧计划', exercises: [] }))
  await page.loadGoal(12)
  assert.equal(page.data.planType, 'shared')
})

test('editing keeps the assigned member read-only and labels the field as the plan name', () => {
  const { page } = loadPage('pages/goal/create.js', async () => ok({}))
  page.setData({ isEditing: true, executorId: 8, members: [{ user_id: 7 }, { user_id: 8, selected: true }] })
  page.onExecutorChange({ currentTarget: { dataset: { id: 7 } } })
  assert.equal(page.data.executorId, 8)
  const template = fs.readFileSync('pages/goal/create.wxml', 'utf8')
  assert.match(template, /section-title">计划名称/)
  assert.match(template, /每天自动安排；家庭管理员可为家人创建/)
  assert.match(template, /执行成员仅展示，不可修改/)
  assert.match(template, /isEditing \? item\.user_id == executorId/)
})

test('member and goal loading errors block submit and can be retried', async () => {
  let failMembers = true
  let failGoal = true
  const requests = []
  const { page } = loadPage('pages/goal/create.js', async (url, method, data) => {
    requests.push({ url, method, data })
    if (url.startsWith('/family/members') && failMembers) return { code: 1 }
    if (url === '/goals/12' && failGoal) return { code: 1 }
    if (url.startsWith('/family/members')) return ok([{ user_id: 7 }])
    if (url === '/family/4') return ok({ members: [{ user_id: 7, role: 'admin' }] })
    if (url === '/goals/12') return ok({ name: '计划', plan_type: 'personal', executor_id: 7, exercises: [selectedExercise] })
    return ok({})
  }, { userId: 7 })
  page.setData({ familyId: 4, goalId: 12, isEditing: true, name: '计划', executorId: 7, selectedExercises: [selectedExercise] })

  await page.loadMembers()
  await page.loadGoal()
  await page.createGoal()
  assert.equal(requests.some(request => request.method === 'PUT'), false)
  assert.ok(page.data.membersError)
  assert.ok(page.data.goalError)

  failMembers = false
  failGoal = false
  await page.loadMembers()
  await page.retryLoadGoal()
  assert.equal(page.data.membersLoaded, true)
  assert.equal(page.data.goalLoaded, true)
  await page.createGoal()
  assert.equal(requests.some(request => request.method === 'PUT'), true)
})

test('detail completion is limited to the assigned participant and sends service date', async () => {
  const requests = []
  const { page } = loadPage('pages/goal/detail.js', async (url, method, data) => {
    requests.push({ url, method, data })
    return ok({})
  }, { userId: 7 })
  page.setData({ goalId: 12, currentUserId: 7, canRecord: false, canSubmit: false, goal: { plan_type: 'personal', executor_id: 8, current_date: '2026-10-15' }, progressDate: '2026-10-15' })
  await page.completeAll({ currentTarget: { dataset: { item: { id: 22, sets: 3 } } } })
  assert.equal(requests.length, 0)
  page.setData({ canRecord: true, canSubmit: true, goal: { plan_type: 'personal', executor_id: 7, current_date: '2026-10-15' } })
  page.loadDetails = async () => {}
  await page.completeAll({ currentTarget: { dataset: { item: { id: 22, sets: 3 } } } })
  assert.equal(requests[0].url, '/goals/12/complete')
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].data)), { goal_exercise_id: 22, completed_sets: 3, date: '2026-10-15' })
})

test('historical goal view cannot submit completion for the selected past date', async () => {
  const requests = []
  const { page } = loadPage('pages/goal/detail.js', async (url, method, data) => {
    requests.push({ url, method, data })
    return ok({})
  }, { userId: 7 })
  page.setData({ goalId: 12, currentUserId: 7, canRecord: true, canSubmit: false,
    selectedDate: '2026-10-14', progressDate: '2026-10-14',
    goal: { plan_type: 'personal', executor_id: 7, current_date: '2026-10-15' } })
  await page.completeAll({ currentTarget: { dataset: { item: { id: 22, sets: 3 } } } })
  assert.equal(requests.length, 0)
  assert.equal(page.mayRecord(), false)
})

test('historical detail uses the exercise snapshot that was effective on that date', async () => {
  const { page } = loadPage('pages/goal/detail.js', async () => ok({}), { userId: 7 })
  const todayExercise = { id: 23, exercise_id: 32, sets: 4, reps: 12, exercise: { name: '今天修改后的动作' } }
  const oldExercise = { id: 22, exercise_id: 31, sets: 2, reps: 6, exercise: { name: '旧日期动作' } }
  page.setData({ goalId: 12, currentUserId: 7, selectedDate: '2026-10-14' })
  page.loadGoal = async () => ({
    id: 12, plan_type: 'personal', executor_id: 7, current_date: '2026-10-15',
    exercises: [todayExercise], exerciseCount: 1
  })
  page.loadProgress = async () => ({
    progress: { date: '2026-10-14', exercises: [oldExercise], member_stats: [] },
    exerciseStatus: {}, memberProgressList: []
  })

  await page.loadDetails()
  assert.equal(page.data.historicalView, true)
  assert.equal(page.data.canSubmit, false)
  assert.equal(page.data.goal.exercises[0].exercise.name, '旧日期动作')
  assert.equal(page.data.goal.exerciseCount, 1)
  const template = fs.readFileSync('pages/goal/detail.wxml', 'utf8')
  assert.match(template, /historicalView \? progressDate \+ ' 进度' : '今日进度'/)
})

test('any family member can open the exercise demonstration page and completed action is disabled', async () => {
  const navigation = []
  const { page } = loadPage('pages/goal/detail.js', async () => ok(), {}, { wx: { navigateTo: ({ url }) => navigation.push(url) } })
  page.openExercise({ currentTarget: { dataset: { item: { exercise_id: 31 } } } })
  assert.equal(navigation[0], '/pages/exercise/exercise?id=31')
  const template = fs.readFileSync('pages/goal/detail.wxml', 'utf8')
  assert.match(template, /查看动作示范/)
  assert.match(template, /disabled="\{\{actionLoading \|\| exerciseStatus\[item\.id\]\.is_done\}\}"/)
})

test('joining a shared plan sends only the current user without an extra prompt', async () => {
  const calls = []
  let modalCount = 0
  const { page } = loadPage('pages/goal/detail.js', async (url, method, data) => {
    calls.push({ url, method, data })
    return ok({})
  }, { userId: 7 }, { wx: { showModal: () => { modalCount++ } } })
  page.setData({ goalId: 12, currentUserId: 7, goal: { plan_type: 'shared', is_participating: false } })
  page.loadDetails = async () => {}
  await page.joinGoal()
  assert.equal(modalCount, 0)
  assert.equal(calls[0].url, '/goals/12/members')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].data.user_id, 7)
})

test('leaving a shared plan uses the self endpoint after a simple confirmation', async () => {
  const calls = []
  let dialog
  const { page } = loadPage('pages/goal/detail.js', async (url, method, data) => {
    calls.push({ url, method, data })
    return ok({})
  }, {}, { wx: { showModal: options => { dialog = options } } })
  page.setData({ goalId: 12, goal: { plan_type: 'shared', is_participating: true } })
  page.loadDetails = async () => {}
  page.leaveGoal()
  await dialog.success({ confirm: true })
  assert.equal(calls[0].url, '/goals/12/members/me')
  assert.equal(calls[0].method, 'DELETE')
})

test('only managers can pause a plan', async () => {
  const calls = []
  const { page } = loadPage('pages/goal/detail.js', async (url, method, data) => {
    calls.push({ url, method, data })
    return ok({})
  })
  page.setData({ goalId: 12, goal: { can_manage: false } })
  await page.setGoalActive({ currentTarget: { dataset: { active: 'false' } } })
  assert.equal(calls.length, 0)
  page.setData({ goal: { can_manage: true } })
  page.loadDetails = async () => {}
  await page.setGoalActive({ currentTarget: { dataset: { active: 'false' } } })
  assert.equal(calls[0].url, '/goals/12')
  assert.equal(calls[0].method, 'PUT')
  assert.equal(calls[0].data.is_active, false)
})

test('progress page uses the service business date for completion requests', async () => {
  const requests = []
  const { page } = loadPage('pages/goal/progress.js', async (url, method, data) => {
    requests.push({ url, method, data })
    return ok({ date: '2026-10-15', member_stats: [] })
  }, { userId: 7 })
  page.setData({ goalId: 12, exercise: { goal_exercise_id: 22, sets: 3 }, completedSets: 2 })
  await page.loadExerciseProgress()
  await page.submitProgress()
  assert.equal(requests[0].url, '/goals/12/progress')
  assert.equal(requests[1].data.date, '2026-10-15')
})

test('detail template keeps participation and management controls scoped to contract fields', () => {
  const template = fs.readFileSync('pages/goal/detail.wxml', 'utf8')
  assert.match(template, /goal\.can_manage/)
  assert.match(template, /加入并开始/)
  assert.match(template, /完成全部/)
  assert.match(template, /部分完成/)
  assert.doesNotMatch(template, /审批|填写原因/)
})
