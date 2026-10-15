const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { deferred, loadPage } = require('./page-harness')

function media(exercise, exerciseId = 0, request = async () => ({ code: 0, data: {} })) {
  let definition
  const calls = []
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../components/exercise-media/exercise-media.js'), 'utf8'), {
    Component: value => { definition = value },
    require: () => ({ request: (url, method) => { calls.push({ url, method }); return request(url, method) } })
  })
  const component = {
    ...definition.methods,
    data: { ...definition.data, exercise, exerciseId },
    setData(update, done) { Object.assign(this.data, update); done?.() },
    detach() { definition.lifetimes.detached.call(this) }
  }
  return { component, calls }
}

test('GIF is shown before static cover or video, without an unnecessary request', async () => {
  const { component: c, calls } = media({ gif_url: 'demo.gif', video_url: 'demo.mp4', image_url: 'cover.jpg' }, 3)
  await c.loadMedia()
  assert.equal(c.data.src, 'demo.gif')
  assert.equal(c.data.isVideo, false)
  assert.equal(c.data.loading, true)
  c.onLoad(); assert.equal(c.data.loading, false)
  assert.equal(calls.length, 0)
})

test('legacy MP4 in GIF field uses video controls', async () => {
  const { component: c } = media({ gif_url: 'demo.MP4?version=2' })
  await c.loadMedia()
  assert.equal(c.data.isVideo, true)
})

test('cover-only plan data fetches demonstration without altering plan sets or IDs', async () => {
  const exercise = { image_url: 'cover.jpg', goal_exercise_id: 91, sets: 3, reps: 10 }
  const { component: c, calls } = media(exercise, 3, async () => ({ code: 0, data: { id: 3, gif_url: 'demo.gif', sets: 999 } }))
  await c.loadMedia()
  assert.deepEqual(calls, [{ url: '/exercises/3', method: 'GET' }])
  assert.equal(c.data.src, 'demo.gif')
  assert.deepEqual(exercise, { image_url: 'cover.jpg', goal_exercise_id: 91, sets: 3, reps: 10 })
})

test('missing GIF, media failure and retry always leave an honest display state', async () => {
  const { component: c } = media({ gif_url: 'demo.gif', image_url: 'cover.jpg' })
  await c.loadMedia()
  c.onError()
  assert.equal(c.data.src, 'cover.jpg')
  assert.equal(c.data.fetchError, true)
  assert.match(c.data.message, /失败/)
  c.onError()
  assert.equal(c.data.failed, true)
  assert.equal(c.data.loading, false)
  c.retry()
  assert.equal(c.data.src, 'demo.gif')
  assert.equal(c.data.failed, false)
  assert.equal(c.data.fetchError, false)
  const still = media({ image_url: 'cover.jpg' }).component
  await still.loadMedia()
  assert.equal(still.data.message, '动作图片')
})

test('failed metadata fetch is retryable while retaining the cover', async () => {
  let fail = true
  const { component: c } = media({ image_url: 'cover.jpg' }, 3, async () => {
    if (fail) throw Error('offline')
    return { code: 0, data: { gif_url: 'demo.gif' } }
  })
  await c.loadMedia()
  assert.equal(c.data.src, 'cover.jpg')
  assert.equal(c.data.fetchError, true)
  fail = false; await c.loadMedia()
  assert.equal(c.data.src, 'demo.gif')
  assert.equal(c.data.fetchError, false)
})

test('late metadata with the same cover does not restart the loading indicator', async () => {
  const pending = deferred()
  const { component: c } = media({ image_url: 'cover.jpg' }, 3, () => pending.promise)
  const work = c.loadMedia()
  c.onLoad()
  pending.resolve({ code: 0, data: { image_url: 'cover.jpg' } }); await work
  assert.equal(c.data.loading, false)
  assert.equal(c.data.message, '动作图片')
})

test('late responses cannot replace a new exercise or update a closed popup', async () => {
  const pending = deferred()
  const { component: c } = media({ image_url: 'old.jpg' }, 1, () => pending.promise)
  const work = c.loadMedia()
  c.data.exercise = { gif_url: 'new.gif' }; await c.loadMedia()
  pending.resolve({ code: 0, data: { gif_url: 'old.gif' } }); await work
  assert.equal(c.data.src, 'new.gif')
  const next = deferred()
  const closed = media({}, 2, () => next.promise).component
  const loading = closed.loadMedia(); closed.detach()
  next.resolve({ code: 0, data: { gif_url: 'closed.gif' } }); await loading
  assert.notEqual(closed.data.src, 'closed.gif')
})

test('preview opens the selected exercise without navigation, joining or recording progress', () => {
  const { page, calls } = loadPage('pages/goal/detail.js', () => { throw Error('must not request') }, {}, {
    wx: { navigateTo() { throw Error('must stay on plan') } }
  })
  page.setData({ partialSets: { 91: [true, false] }, progressDate: '2026-10-15' })
  page.showExercisePreview({ currentTarget: { dataset: { item: { id: 91, exercise_id: 3, exercise: { name: '测试动作', gif_url: 'demo.gif' } } } } })
  assert.equal(page.data.previewExerciseId, 3)
  assert.equal(page.data.previewExercise.gif_url, 'demo.gif')
  page.closeExercisePreview()
  assert.equal(page.data.previewExercise, null)
  assert.deepEqual(page.data.partialSets, { 91: [true, false] })
  assert.equal(page.data.progressDate, '2026-10-15')
  assert.equal(calls.length, 0)
})

test('picker resets scroll on category/open, preserves sets and discards cancelled choices', () => {
  const { page } = loadPage('pages/goal/create.js', () => {})
  page.setData({ selectedExercises: [{ exercise_id: 1, name: 'A', sets: 2, reps: 8 }], exerciseList: [{ id: 1, name: 'A', _category: 'upper' }, { id: 2, name: 'B', _category: 'lower' }] })
  const event = item => ({ currentTarget: { dataset: { item } } })
  page.addExercise()
  page.selectExercise(event({ id: 2 }))
  page.switchCategory({ currentTarget: { dataset: { category: 'upper' } } })
  assert.equal(page.data.modalScrollTarget, 'exercise-list-start')
  page.closeExerciseModal(); page.addExercise()
  assert.equal(page.data.selectedCount, 1)
  assert.equal(page.data.exerciseList[1]._selected, false)
  page.selectExercise(event({ id: 2 })); page.confirmExercises()
  assert.equal(page.data.showExerciseModal, false)
  assert.equal(page.data.selectedExercises[0].sets, 2)
  assert.equal(page.data.selectedExercises[0].reps, 8)
  assert.equal(page.data.selectedExercises[1].sets, 3)
})
