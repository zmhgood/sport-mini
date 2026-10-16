const test = require('node:test')
const assert = require('node:assert/strict')
const { loadAllExercises } = require('../utils/exercise-category')
const { deferred } = require('./page-harness')
const ok = list => ({ code: 0, data: { list, total: list.length } })

test('concurrent consumers share the complete paginated catalogue', async () => {
  const first = deferred(), pages = []
  const api = { request: async (_, method, params) => {
    pages.push(params.page)
    if (params.page === 1) return first.promise
    return { code: 0, data: { list: [{ id: 101 }], total: 101 } }
  } }
  const a = loadAllExercises(api), b = loadAllExercises(api)
  first.resolve({ code: 0, data: { list: Array.from({ length: 100 }, (_, id) => ({ id })), total: 101 } })
  const [home, muscle] = await Promise.all([a, b])
  assert.equal(home.length, 101); assert.deepEqual(home, muscle)
  assert.deepEqual(pages, [1, 2])
  assert.deepEqual(await loadAllExercises(api), home)
  assert.deepEqual(pages, [1, 2])
})

test('catalogue expires after one minute and caches a genuine empty result', async t => {
  t.mock.method(Date, 'now', () => now)
  let now = 1000, calls = 0
  const api = { request: async () => { calls++; return ok([]) } }
  await loadAllExercises(api)
  now += 59999; await loadAllExercises(api); assert.equal(calls, 1)
  now++; await loadAllExercises(api); assert.equal(calls, 2)
})

test('a failed later page is not cached and a retry starts at page one', async () => {
  let fail = true
  const pages = []
  const api = { request: async (_, method, params) => {
    pages.push(params.page)
    if (params.page === 2) throw Error('network unavailable')
    return { code: 0, data: { list: [{ id: 1 }], total: fail ? 2 : 1 } }
  } }
  await assert.rejects(loadAllExercises(api), /network unavailable/)
  fail = false
  assert.deepEqual(await loadAllExercises(api), [{ id: 1 }])
  assert.deepEqual(pages, [1, 2, 1])
})

test('catalogues from separate API environments cannot share cached data', async () => {
  const a = { request: async () => ok([{ id: 1 }]) }
  const b = { request: async () => ok([{ id: 2 }]) }
  assert.deepEqual(await loadAllExercises(a), [{ id: 1 }])
  assert.deepEqual(await loadAllExercises(b), [{ id: 2 }])
})
