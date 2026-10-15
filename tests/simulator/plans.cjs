const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const output = '/tmp/sport-plan-simulator'
fs.mkdirSync(output, { recursive: true })
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const attemptPath = path.join(output, `plans-${runId}.json`)
const result = {
  runId,
  attemptFile: attemptPath,
  status: 'running',
  scope: 'official WeChat DevTools simulator; synthetic wx.request responses; no production writes',
  productionWrites: 0,
  checks: [],
  screenshots: [],
  exceptions: []
}
let mini
let timer
const save = () => fs.writeFileSync(attemptPath, JSON.stringify(result, null, 2) + '\n')
const promoteValidRun = () => {
  const valid = result.completed === true && result.error === undefined &&
    result.status === 'completed' && result.storageBackup?.restored === true && result.productionWrites === 0 &&
    result.syntheticWriteCount > 0 && result.checks.length > 0 && result.checks.every(item => item.pass)
  if (valid) fs.copyFileSync(attemptPath, path.join(output, 'plans.json'))
}
const check = (name, pass, detail) => {
  result.checks.push({ name, pass: !!pass, detail })
  save()
  console.log(JSON.stringify({ check: name, pass: !!pass }))
  assert.ok(pass, name)
}
const waitFor = async (fn, label, timeout = 8000) => {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await fn()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`timeout: ${label}`)
}
const page = async route => {
  await mini.reLaunch(route)
  const current = await mini.currentPage()
  assert.equal(current.path, route.split('?')[0].slice(1), `route ${route}`)
  return current
}
const settled = async current => {
  try { await waitFor(async () => !await current.data('loading'), `${current.path} loading`) }
  catch (error) {
    result.settledFailure = {
      path: current.path,
      data: await current.data(),
      requests: await mini.evaluate(() => getApp().__plansQa.requests)
    }
    save()
    throw error
  }
}
const capture = async name => {
  if (process.env.MINI_QA_SCREENSHOTS === '0') { result.screenshotStatus = 'not captured; visual review pending'; return }
  const file = path.join(output, `${name}.png`)
  await mini.screenshot({ path: file })
  result.screenshots.push(file)
  save()
}
const readText = async element => element ? (await element.text()).trim() : ''
const findByText = async (elements, text) => {
  for (const element of elements) if ((await readText(element)).includes(text)) return element
  return null
}

save()

function mockResponse(options) {
  const qa = getApp().__plansQa
  const rawPath = options.url.replace(/^https?:\/\/[^/]+\/api/, '')
  const [route, query = ''] = rawPath.split('?')
  const method = (options.method || 'GET').toUpperCase()
  const data = options.data || {}
  qa.requests.push({ route, query, method })
  // A real HTTP response owns its JSON data; page decoration must not mutate server fixtures.
  const response = payload => ({ statusCode: 200, data: { code: 0, data: JSON.parse(JSON.stringify(payload)) } })
  const failure = message => ({ statusCode: 503, data: { code: 503, message } })

  if (method !== 'GET') qa.writes.push({ route, method, data })
  if (route === '/family/members') {
    if (qa.failNextMembers) { qa.failNextMembers = false; return failure('模拟成员读取失败') }
    return response(qa.family.members)
  }
  if (route === '/family/901') return response(qa.family)
  if (route === '/families') return response([qa.family])
  if (route === '/exercises') return response({ list: [qa.exercise], total: 1 })
  if (route === '/exercises/31') return response(qa.exercise)
  if (route === '/goals/family') return response(Object.values(qa.goals))
  if (route === '/goals') {
    const id = 910 + qa.created.length
    const goal = {
      id,
      family_id: 901,
      name: data.name,
      plan_type: data.plan_type,
      executor_id: data.executor_id,
      is_active: true,
      can_manage: true,
      is_participating: data.plan_type === 'shared' && (data.member_ids || []).includes(7),
      members: data.plan_type === 'personal' ? [qa.member(data.executor_id)] : (data.member_ids || []).map(qa.member),
      exercises: (data.exercises || []).map((item, index) => qa.goalExercise(item.exercise_id, item.sets, item.reps, id * 10 + index))
    }
    qa.goals[id] = goal
    qa.created.push({ request: data, goal })
    return response({ id })
  }
  const goalMatch = route.match(/^\/goals\/(\d+)$/)
  if (method === 'PUT' && goalMatch) {
    const goal = qa.goals[Number(goalMatch[1])]
    if (goal) {
      if (data.is_active !== undefined) goal.is_active = data.is_active
      if (data.name !== undefined) goal.name = data.name
      if (data.exercises !== undefined) goal.pending_exercises = data.exercises.map((item, index) => qa.goalExercise(item.exercise_id, item.sets, item.reps, goal.id * 10 + index))
      goal.pending_effective_date = '2026-10-16'
    }
    return response({ pending_effective_date: goal && goal.pending_effective_date, current_date: goal && goal.current_date })
  }
  if (goalMatch) {
    if (qa.failNextGoal) { qa.failNextGoal = false; return failure('模拟目标读取失败') }
    return qa.goals[Number(goalMatch[1])] ? response(qa.goals[Number(goalMatch[1])]) : response(null)
  }
  const progressMatch = route.match(/^\/goals\/(\d+)\/progress$/)
  if (progressMatch) {
    if (qa.failNextProgress) { qa.failNextProgress = false; return failure('模拟进度读取失败') }
    const goal = qa.goals[Number(progressMatch[1])]
    if (!goal) return response(null)
    const dateMatch = query.match(/(?:^|&)date=([^&]*)/)
    const selectedDate = dateMatch ? decodeURIComponent(dateMatch[1]) : ''
    const date = selectedDate || goal.current_date
    const dateExercises = selectedDate && selectedDate !== goal.current_date
      ? [{ id: goal.id * 10 + 9, exercise_id: 39, sets: 2, reps: 6, exercise: { id: 39, name: '旧日期动作', image_url: '/images/exercise/default-exercise.jpg', target_muscle: '上肢' } }]
      : goal.exercises
    const participants = goal.plan_type === 'personal'
      ? [qa.member(goal.executor_id)]
      : goal.members
    const memberStats = participants.map(member => {
      const exercises = (dateExercises || []).map(ex => {
        const completed = qa.completed[`${goal.id}:${member.user_id}:${date}:${ex.id}`] || 0
        return { goal_exercise_id: ex.id, exercise_name: ex.exercise.name, target_sets: ex.sets, completed_sets: completed, reps: ex.reps, status: completed >= ex.sets ? 'done' : completed ? 'in_progress' : 'pending' }
      })
      const totalSets = exercises.reduce((sum, ex) => sum + ex.target_sets, 0)
      const completedSets = exercises.reduce((sum, ex) => sum + ex.completed_sets, 0)
      return { user_id: member.user_id, user_name: member.user.nick_name, is_current_member: true, total_sets: totalSets, completed_sets: completedSets, progress: totalSets ? Math.round(completedSets / totalSets * 100) : 0, exercise_stats: exercises }
    })
    return response({ date, exercises: dateExercises, member_stats: memberStats })
  }
  const joinMatch = route.match(/^\/goals\/(\d+)\/members$/)
  if (method === 'POST' && joinMatch) {
    const goal = qa.goals[Number(joinMatch[1])]
    if (goal && !goal.members.some(member => member.user_id == data.user_id)) goal.members.push(qa.member(data.user_id))
    if (goal) goal.is_participating = data.user_id == 7
    return response({})
  }
  if (method === 'DELETE' && /\/members\/me$/.test(route)) {
    const id = Number(route.split('/')[2])
    const goal = qa.goals[id]
    if (goal) { goal.members = goal.members.filter(member => member.user_id != 7); goal.is_participating = false }
    return response({})
  }
  const completeMatch = route.match(/^\/goals\/(\d+)\/complete$/)
  if (method === 'POST' && completeMatch) {
    const goal = qa.goals[Number(completeMatch[1])]
    const exercise = goal && goal.exercises.find(item => item.id == data.goal_exercise_id)
    const memberId = goal && goal.plan_type === 'personal' ? goal.executor_id : 7
    if (exercise) qa.completed[`${goal.id}:${memberId}:${data.date}:${exercise.id}`] = data.completed_sets
    return response({})
  }
  return response([])
}

;(async () => {
  timer = setTimeout(async () => {
    result.error = 'simulator run exceeded 240 seconds'
    save()
    await cleanup()
    process.exit(2)
  }, 240000)
  try {
    mini = await auto.connect({
      wsEndpoint: process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9420'
    })
    const system = await mini.systemInfo()
    result.device = { platform: system.platform, width: system.windowWidth, height: system.windowHeight, safeBottom: system.screenHeight - system.safeArea.bottom, model: system.model }
    check('official DevTools simulator', system.platform === 'devtools', result.device)

    const snapshot = await mini.evaluate(() => {
      const keys = wx.getStorageInfoSync().keys || []
      const saved = {}
      keys.forEach(key => { saved[key] = wx.getStorageSync(key) })
      getApp().__plansQa = {
        storageSnapshot: saved,
        requests: [], writes: [], created: [], completed: {},
        failNextMembers: false, failNextGoal: false, failNextProgress: false,
        current_date: '2026-10-15',
        member: id => ({ user_id: Number(id), role: Number(id) === 7 ? 'admin' : 'member', user: { id: Number(id), nick_name: Number(id) === 7 ? '模拟爸爸' : '模拟妈妈', avatar_url: '/images/default-avatar.svg' } }),
        goalExercise: (exerciseId, sets, reps, id) => ({ id, exercise_id: exerciseId, sets, reps, exercise: { id: exerciseId, name: '模拟抬腿动作', image_url: '/images/exercise/default-exercise.jpg', target_muscle: '下肢' } }),
        restore() {
          const current = wx.getStorageInfoSync().keys || []
          current.forEach(key => wx.removeStorageSync(key))
          Object.keys(this.storageSnapshot).forEach(key => wx.setStorageSync(key, this.storageSnapshot[key]))
          delete getApp().__plansQa
        }
      }
      const qa = getApp().__plansQa
      qa.family = { id: 901, name: '模拟家庭', invite_code: 'SYN901', members: [qa.member(7), qa.member(8)] }
      qa.exercise = { id: 31, name: '模拟抬腿动作', image_url: '/images/exercise/default-exercise.jpg', gif_url: '', video_url: '', target_muscle: '下肢', description: '模拟示范动作说明。', difficulty: '简单', sets: 3, reps: 10, calories: 5 }
      const goal = (id, planType, executorId, members, exerciseId = 31) => ({
        id, family_id: 901, name: planType === 'personal' ? '模拟个人计划' : '模拟共同计划', plan_type: planType,
        executor_id: executorId, members: members.map(qa.member), exercises: [qa.goalExercise(exerciseId, 3, 10, id * 10 + 1), qa.goalExercise(32, 3, 8, id * 10 + 2)],
        can_manage: true, is_participating: members.includes(7), is_active: true, current_date: qa.current_date,
        pending_effective_date: '2026-10-16', pending_exercises: [qa.goalExercise(32, 4, 12, id * 10 + 1)]
      })
      qa.goals = { 902: goal(902, 'personal', 7, [7]), 903: goal(903, 'shared', null, []), 904: goal(904, 'personal', 7, [7]) }
      wx.setStorageSync('token', 'simulator-synthetic-token')
      wx.setStorageSync('userId', 7)
      wx.setStorageSync('userInfo', { id: 7, nick_name: '模拟爸爸' })
      wx.setStorageSync('currentFamilyId', 901)
      return { keyCount: keys.length }
    })
    result.storageBackup = { backedUpKeys: snapshot.keyCount, restored: false }
    mini.on('exception', error => { result.exceptions.push(String(error.message || error).slice(0, 250)); save() })
    await mini.mockWxMethod('request', mockResponse)
    await mini.mockWxMethod('showModal', { confirm: true, cancel: false })

    let current = await page('/pages/family/family')
    await settled(current)
    await waitFor(async () => !!await current.$('.family-info'), 'family data')
    const createLinks = await current.$$('.section-action')
    const createButton = await findByText(createLinks, '创建计划')
    if (!createButton) throw new Error('create-plan link not found')
    await createButton.tap()
    await waitFor(async () => (await mini.currentPage()).path === 'pages/goal/create', 'create route')
    current = await mini.currentPage()
    await waitFor(async () => await current.data('membersLoaded') && (await current.data('exerciseList')).length > 0, 'create form data')
    await (await current.$('.name-input')).input('模拟为妈妈创建的个人计划')
    const personalTypes = await current.$$('.plan-type')
    await personalTypes[0].tap()
    const memberChoices = await current.$$('.member-item')
    if (memberChoices.length < 2) throw new Error('admin should see both synthetic family members')
    await memberChoices[1].tap()
    await (await current.$('.add-btn')).tap()
    await waitFor(async () => await current.data('showExerciseModal'), 'exercise picker open')
    await (await current.$$('.exercise-option'))[0].trigger('tap')
    await (await current.$('.btn-confirm')).trigger('tap')
    await waitFor(async () => await current.data('showExerciseModal') === false && (await current.data('selectedExercises')).length === 1, 'exercise selected')
    await mini.pageScrollTo(99999)
    await capture('personal-create-small-screen-bottom')
    const geometry = await mini.evaluate(() => new Promise(resolve => {
      const q = wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0])
      q.select('.name-input').boundingClientRect(); q.select('.submit-section').boundingClientRect(); q.select('.btn-submit').boundingClientRect()
      q.exec(resolve)
    }))
    check('create form bottom action is reachable on compact simulator', !!geometry[1] && geometry[2].height >= 44 && geometry[2].bottom <= system.windowHeight - result.device.safeBottom + 1, geometry)
    const submit = await current.$('.btn-submit')
    const personalFormData = await current.data()
    result.personalFormState = {
      planType: personalFormData.planType,
      executorId: personalFormData.executorId,
      currentUserId: personalFormData.currentUserId,
      membersLoaded: personalFormData.membersLoaded,
      goalLoaded: personalFormData.goalLoaded,
      selectedExerciseCount: personalFormData.selectedExercises.length,
      name: personalFormData.name,
      disabled: await submit.attribute('disabled')
    }
    save()
    check('personal form is enabled after fixture loading', result.personalFormState.disabled !== 'true' && result.personalFormState.executorId == 8 && result.personalFormState.selectedExerciseCount === 1, result.personalFormState)
    await submit.trigger('tap')
    try { await waitFor(async () => (await mini.evaluate(() => getApp().__plansQa.created.length)) === 1, 'personal creation mocked write') }
    catch (error) {
      result.afterSubmit = await mini.evaluate(() => ({ requests: getApp().__plansQa.requests, writes: getApp().__plansQa.writes, created: getApp().__plansQa.created.length }))
      result.submitDisabledAfterTap = await submit.attribute('disabled')
      save()
      throw error
    }
    const personalPayload = await mini.evaluate(() => getApp().__plansQa.created[0].request)
    check('personal plan uses chosen executor only', personalPayload.plan_type === 'personal' && personalPayload.executor_id === 8 && !('member_ids' in personalPayload), personalPayload)
    await waitFor(async () => (await mini.currentPage()).path === 'pages/family/family', 'return to family after first create', 5000)
    current = await mini.currentPage()
    await mini.navigateTo('/pages/goal/create?family_id=901')
    await waitFor(async () => (await mini.currentPage()).path === 'pages/goal/create', 'second create route')
    current = await mini.currentPage()
    await waitFor(async () => await current.data('membersLoaded') && (await current.data('exerciseList')).length > 0, 'second create data')
    await (await current.$('.name-input')).input('模拟自愿参加的共同计划')
    const sharedTypes = await current.$$('.plan-type')
    await sharedTypes[1].tap()
    await (await current.$('.self-participation')).tap()
    await (await current.$('.add-btn')).tap()
    await waitFor(async () => await current.data('showExerciseModal'), 'shared picker')
    await (await current.$$('.exercise-option'))[0].trigger('tap')
    await (await current.$('.btn-confirm')).trigger('tap')
    await waitFor(async () => await current.data('showExerciseModal') === false, 'shared exercise selected')
    await (await current.$('.btn-submit')).trigger('tap')
    await waitFor(async () => (await mini.evaluate(() => getApp().__plansQa.created.length)) === 2, 'shared creation mocked write')
    const sharedPayload = await mini.evaluate(() => getApp().__plansQa.created[1].request)
    check('shared plan can be created without auto-enrolling others', sharedPayload.plan_type === 'shared' && Array.isArray(sharedPayload.member_ids) && sharedPayload.member_ids.length === 0, sharedPayload)
    await waitFor(async () => (await mini.currentPage()).path === 'pages/family/family', 'return to family after second create', 5000)

    current = await page('/pages/goal/detail?id=903')
    await settled(current)
    check('unjoined shared plan offers voluntary join', !!await current.$('.join-action'))
    await (await current.$('.join-action')).tap()
    await waitFor(async () => (await current.data('goal')).is_participating === true, 'shared plan join')
    const joinWrite = await mini.evaluate(() => getApp().__plansQa.writes.find(write => write.route === '/goals/903/members'))
    check('shared plan join includes only current user', !!joinWrite && joinWrite.data.user_id === 7, joinWrite)
    await mini.pageScrollTo(0)
    await mini.mockWxMethod('showActionSheet', options => {
      getApp().__plansQa.lastMenu = options.itemList
      return { tapIndex: options.itemList.indexOf('退出共同计划') }
    })
    await (await current.$('.more-toggle')).trigger('tap')
    await waitFor(async () => await mini.evaluate(() => !!getApp().__plansQa.lastMenu), 'native menu captured')
    check('shared participant can find exit under more', (await mini.evaluate(() => getApp().__plansQa.lastMenu)).includes('退出共同计划'))
    await waitFor(async () => (await current.data('goal')).is_participating === false, 'leave shared plan')
    check('shared exit uses self membership endpoint', await mini.evaluate(() => getApp().__plansQa.writes.some(write => write.route === '/goals/903/members/me' && write.method === 'DELETE')))

    current = await page('/pages/goal/create?id=904&family_id=901')
    await waitFor(async () => await current.data('goalLoaded') && await current.data('membersLoaded'), 'edit form data')
    const pendingExercise = (await current.data('selectedExercises'))[0]
    check('edit form displays pending exercise from server', pendingExercise.exercise_id === 32 && pendingExercise.sets === 4 && pendingExercise.reps === 12, pendingExercise)
    const editMemberItems = await current.$$('.member-item')
    check('edit form shows only the assigned member as read-only', editMemberItems.length === 1 && (await editMemberItems[0].attribute('class')).includes('read-only') && (await readText(await current.$('.plan-hint'))).includes('不可修改'), { count: editMemberItems.length, className: editMemberItems.length ? await editMemberItems[0].attribute('class') : '', hint: await readText(await current.$('.plan-hint')) })
    check('new and edit forms use the plan-name label', (await readText((await current.$$('.section-title'))[0])) === '计划名称')
    await capture('pending-edit-small-screen')

    current = await page('/pages/goal/detail?id=902')
    await settled(current)
    check('personal detail shows current-day controls', await current.data('canSubmit') === true, { date: await current.data('progressDate'), currentDate: await current.data('currentDate') })
    await mini.pageScrollTo(99999)
    const cardGeometry = await mini.evaluate(() => new Promise(resolve => {
      const q = wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0])
      q.select('.exercise-item').boundingClientRect(); q.select('.exercise-main').boundingClientRect(); q.select('.exercise-name').boundingClientRect(); q.select('.exercise-demo').boundingClientRect(); q.select('.exercise-actions').boundingClientRect(); q.select('.primary-action').boundingClientRect()
      q.exec(resolve)
    }))
    check('compact detail keeps action text wide and controls below the exercise', cardGeometry[2].width >= 100 && cardGeometry[4].top >= cardGeometry[1].bottom - 1 && cardGeometry[4].right <= cardGeometry[0].right + 1 && cardGeometry[5].height >= 44, cardGeometry)
    await capture('personal-detail-small-screen')
    await (await current.$('.primary-action')).trigger('tap')
    await waitFor(async () => (await current.data('exerciseStatus'))[9021]?.is_done === true, 'all sets recorded')
    const allWrite = await mini.evaluate(() => getApp().__plansQa.writes.find(write => write.route === '/goals/902/complete'))
    check('one-tap action records all goal sets', !!allWrite && allWrite.data.completed_sets === 3 && allWrite.data.date === '2026-10-15', allWrite)
    const completedButton = await current.$('.primary-action')
    const disabledAttribute = await completedButton.attribute('disabled')
    check('completed action is disabled after refresh', disabledAttribute !== null && (await completedButton.text()).includes('已完成'), { disabledAttribute, label: await completedButton.text() })

    const partialToggle = (await current.$$('.partial-toggle'))[1]
    await partialToggle.trigger('tap')
    await waitFor(async () => (await current.$$('.partial-set')).length === 3, 'partial set controls open')
    const sets = await current.$$('.partial-set')
    if (sets.length !== 3) throw new Error(`expected 3 partial set controls, got ${sets.length}`)
    await sets[0].trigger('tap'); await sets[1].trigger('tap')
    await (await current.$('.partial-save')).trigger('tap')
    await waitFor(async () => (await current.data('exerciseStatus'))[9022]?.completed_sets === 2, 'partial sets saved')
    const partialWrite = await mini.evaluate(() => getApp().__plansQa.writes.find(write => write.route === '/goals/902/complete' && write.data.completed_sets === 2))
    check('partial completion writes selected set count', !!partialWrite && partialWrite.data.date === '2026-10-15', partialWrite)

    await mini.mockWxMethod('showActionSheet', options => {
      getApp().__plansQa.lastMenu = options.itemList
      return { tapIndex: options.itemList.indexOf('暂停计划') }
    })
    await (await current.$('.more-toggle')).trigger('tap')
    await waitFor(async () => (await current.data('goal')).is_active === false && await current.data('actionLoading') === false, 'plan paused')
    const pauseMenu = await mini.evaluate(() => getApp().__plansQa.lastMenu)
    check('manager more menu exposes edit and pause controls', pauseMenu.includes('编辑计划') && pauseMenu.includes('暂停计划'))
    await mini.mockWxMethod('showActionSheet', options => {
      getApp().__plansQa.lastMenu = options.itemList
      return { tapIndex: options.itemList.indexOf('恢复计划') }
    })
    await (await current.$('.more-toggle')).trigger('tap')
    await waitFor(async () => (await current.data('goal')).is_active === true && await current.data('actionLoading') === false, 'plan resumed')
    check('paused plan exposes resume control', (await mini.evaluate(() => getApp().__plansQa.lastMenu)).includes('恢复计划'))
    await waitFor(async () => (await current.data('goal')).is_active === true && await current.data('actionLoading') === false, 'plan resumed')

    current = await page('/pages/goal/detail?id=902&date=2026-10-14')
    await settled(current)
    check('historical date is visibly read-only', await current.data('historicalView') === true && await current.data('canSubmit') === false && (await readText(await current.$('.readonly-action'))).includes('历史进度仅供查看'))
    const historicalGoal = await current.data('goal')
    const sectionTitles = await current.$$('.section-title')
    check('historical progress uses the old-date exercise snapshot after today was edited', historicalGoal.exerciseCount === 1 && historicalGoal.exercises[0].exercise.name === '旧日期动作' && (await findByText(sectionTitles, '2026-10-14 进度')), { exerciseCount: historicalGoal.exerciseCount, exercise: historicalGoal.exercises[0]?.exercise?.name, title: await Promise.all(sectionTitles.map(readText)) })
    await capture('historical-read-only-small-screen')
    const writesBeforeHistory = await mini.evaluate(() => getApp().__plansQa.writes.length)
    await current.callMethod('completeAll', { currentTarget: { dataset: { item: (await current.data('goal')).exercises[0] } } })
    check('historical completion attempt creates no write', await mini.evaluate(() => getApp().__plansQa.writes.length) === writesBeforeHistory)

    await mini.evaluate(() => { getApp().__plansQa.failNextMembers = true })
    current = await page('/pages/goal/create?family_id=901')
    await waitFor(async () => !!await current.data('membersError'), 'member loading error')
    check('member loading failure blocks submission and offers retry', await current.data('membersLoaded') === false && !!await current.$('.retry-button') && await current.$('.btn-submit').then(button => button.property('disabled')).then(value => value === true))
    await (await current.$('.retry-button')).tap()
    await waitFor(async () => await current.data('membersLoaded') && !await current.data('membersError'), 'member retry success')
    check('member retry recovers the form', await current.data('membersLoaded') === true)

    await mini.evaluate(() => { getApp().__plansQa.failNextGoal = true })
    current = await page('/pages/goal/create?id=904&family_id=901')
    await waitFor(async () => !!await current.data('goalError'), 'goal loading error')
    check('edit loading failure blocks save and offers retry', await current.data('goalLoaded') === false && !!await current.$('.retry-button') && await current.$('.btn-submit').then(button => button.property('disabled')).then(value => value === true))
    await (await current.$('.retry-button')).tap()
    await waitFor(async () => await current.data('goalLoaded') && await current.data('membersLoaded'), 'goal retry success')
    check('goal retry restores pending edit data', (await current.data('selectedExercises'))[0].sets === 4)

    current = await page('/pages/goal/detail?id=902')
    await settled(current)
    check('returning from history restores the current exercise revision', (await current.data('goal')).exercises[0].exercise_id === 31)
    const demo = await current.$('.exercise-main .exercise-image')
    if (!demo) throw new Error('exercise demo image not rendered')
    const writesBeforeDemo = await mini.evaluate(() => getApp().__plansQa.writes.length)
    await demo.tap()
    await waitFor(async () => !!await current.$('.preview-panel'), 'exercise preview popup')
    const media = await current.$('exercise-media')
    await waitFor(async () => !await media.data('loading'), 'static demonstration loaded')
    check('exercise image opens inline preview on the plan page', (await mini.currentPage()).path === 'pages/goal/detail' && (await current.data('previewExercise')).name === '模拟抬腿动作')
    check('cover-only exercise does not remain loading', await media.data('message') === '动作图片' && !await media.data('failed'))
    await capture('exercise-demo-small-screen')
    await (await current.$('.preview-close')).tap()
    await waitFor(async () => !await current.data('previewExercise'), 'exercise preview close')
    check('preview creates no progress writes', await mini.evaluate(() => getApp().__plansQa.writes.length) === writesBeforeDemo)

    result.requestCount = await mini.evaluate(() => getApp().__plansQa.requests.length)
    result.syntheticWriteCount = await mini.evaluate(() => getApp().__plansQa.writes.length)
    check('all requests were intercepted and writes remained synthetic', result.productionWrites === 0 && result.syntheticWriteCount > 0)
    check('no uncaught simulator exceptions', result.exceptions.length === 0, result.exceptions)
    result.completed = result.checks.every(item => item.pass)
    result.status = result.completed ? 'completed' : 'failed'
    save()
    console.log(JSON.stringify({ device: result.device, checks: result.checks.length, failed: result.checks.filter(item => !item.pass).map(item => item.name), screenshots: result.screenshots, requests: result.requestCount, syntheticWrites: result.syntheticWriteCount }))
  } catch (error) {
    result.error = String(error.message || error)
    result.status = 'failed'
    if (mini) {
      result.failureContext = await mini.evaluate(() => ({
        pageStack: getCurrentPages().map(page => ({ route: page.route, loading: page.data.loading, loadError: page.data.loadError })),
        requests: getApp().__plansQa.requests,
        writes: getApp().__plansQa.writes
      })).catch(() => null)
    }
    save()
    throw error
  } finally {
    clearTimeout(timer)
    await cleanup()
  }
})().catch(error => {
  console.error(error.message || error)
  process.exitCode = 1
})

async function cleanup() {
  if (!mini) return
  await mini.restoreWxMethod('request').catch(() => {})
  await mini.restoreWxMethod('showModal').catch(() => {})
  await mini.restoreWxMethod('showActionSheet').catch(() => {})
  await mini.evaluate(() => {
    if (getApp().__plansQa) getApp().__plansQa.restore()
  }).then(() => { result.storageBackup.restored = true; save(); promoteValidRun() }).catch(error => {
    result.storageRestoreError = String(error.message || error).slice(0, 250)
    save()
  })
  mini.disconnect()
}
