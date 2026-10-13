const test = require('node:test')
const assert = require('node:assert/strict')
const { deferred, loadPage, visibleText } = require('./page-harness')
const ok = data => ({ code: 0, data })
test('exercise count appears only after a successful response, including a genuine zero', async () => {
  const pending = deferred()
  const { page } = loadPage('pages/muscle/muscle.js', () => pending.promise)
  const work = page.getExercises()
  const render = () => visibleText('pages/muscle/muscle.wxml', page.data)
  assert.match(render(), /加载中/)
  assert.doesNotMatch(render(), /共0个动作/)
  pending.reject(Error('网络错误')); await work
  assert.doesNotMatch(render(), /共0个动作/)
  page.setData({ loadError: '', exercises: [] })
  assert.match(render(), /共0个动作/)
  assert.match(render(), /暂无相关锻炼/)
})
test('rapid category changes never let an old response overwrite the selected category', async () => {
  const first = deferred(), second = deferred()
  let requestCount = 0
  const { page } = loadPage('pages/muscle/muscle.js', () => ++requestCount === 1 ? first.promise : second.promise)
  const old = page.getExercises(); page.setData({ currentTab: 2 }); const latest = page.getExercises()
  second.resolve(ok({ list: [{ id: 3, muscle_group_id: 3, name: '下肢动作' }] })); await latest
  first.resolve(ok({ list: [{ id: 1, muscle_group_id: 2, name: '上肢动作' }] })); await old
  assert.equal(page.data.exercises[0].id, 3); assert.equal(page.data.loading, false)
})
test('stale category failures cannot replace a newer success', async () => {
  const old = deferred()
  let requestCount = 0
  const { page } = loadPage('pages/muscle/muscle.js', () => ++requestCount === 1 ? old.promise : Promise.resolve(ok({ list: [{ id: 3, muscle_group_id: 3 }] })))
  const work = page.getExercises(); page.setData({ currentTab: 2 }); await page.getExercises()
  old.reject(Error('old request failed')); await work
  assert.equal(page.data.loadError, ''); assert.equal(page.data.exercises[0].id, 3)
})
for (const business of [false, true]) {
  test(`category ${business ? 'business' : 'network'} failure shows retry without fake exercises; recovery and real empty`, async () => {
    let fail = true
    const { page } = loadPage('pages/muscle/muscle.js', async () => {
      if (!fail) return ok({ list: [] })
      if (business) return { code: 400, message: '加载错误' }
      throw Error('加载错误')
    })
    await page.getExercises(); assert.equal(page.data.exercises.length, 0)
    const text = visibleText('pages/muscle/muscle.wxml', page.data)
    assert.match(text, /加载错误.*重试/); assert.doesNotMatch(text, /暂无相关锻炼/)
    fail = false; await page.getExercises(); assert.match(visibleText('pages/muscle/muscle.wxml', page.data), /暂无相关锻炼/)
  })
}
test('exercise detail error shows retry and never invents exercise data', async () => {
  let fail = true
  const { page } = loadPage('pages/exercise/exercise.js', async () => { if (fail) throw Error('动作不存在'); return ok({ id: 9, name: '测试', video_url: 'https://example.com/demo.mp4' }) })
  page.setData({ exerciseId: 9 }); await page.retryLoad()
  assert.equal(page.data.exercise, null); assert.match(visibleText('pages/exercise/exercise.wxml', page.data), /动作不存在.*重试/)
  fail = false; await page.retryLoad(); assert.equal(page.data.exercise.gif_url, 'https://example.com/demo.mp4')
})
test('home failures expose retry rather than mock recommendation IDs', async () => {
  const { page } = loadPage('pages/index/index.js', async () => { throw Error('服务暂不可用') })
  await page.getRecommendExercises(); assert.equal(page.data.recommendExercises.length, 0)
  assert.equal(page.data.recommendError, '服务暂不可用'); assert.equal(page.data.recommendLoading, false)
})
test('refresh recommendations retains selected category', async () => {
  const { page } = loadPage('pages/index/index.js', async () => ok({ list: [{ id: 1, muscle_group_id: 1 }, { id: 3, muscle_group_id: 3 }] }))
  page.setData({ currentCategory: 'lower' }); await page.getRecommendExercises()
  assert.equal(page.data.filteredExercises.length, 1); assert.equal(page.data.filteredExercises[0].id, 3)
})
for (const [src, video] of [['https://example.com/demo.gif', false], ['https://example.com/demo.mp4?ver=2', true]]) {
  test(`media viewer routes ${video ? 'video' : 'gif'} to correct component`, () => {
    const { page } = loadPage('pages/gif-viewer/gif-viewer.js', () => {})
    page.onLoad({ src: encodeURIComponent(src), title: encodeURIComponent('测试动作') })
    assert.equal(page.data.src, src); assert.equal(page.data.isVideo, video)
  })
}
