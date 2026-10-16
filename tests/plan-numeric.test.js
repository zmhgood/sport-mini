const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage } = require('./page-harness')

function setup() {
  const notices = [], writes = []
  const { page } = loadPage('pages/goal/create.js', async (url, method, data) => {
    writes.push(data)
    return { code: 0, data: { id: 1 } }
  }, {}, { wx: { showToast: e => notices.push(e.title) } })
  page.setData({ familyId: 1, membersLoaded: true, name: '测试计划', planType: 'personal', executorId: 1,
    selectedExercises: [{ exercise_id: 1, sets: 3, reps: 10 }] })
  return { page, notices, writes }
}

for (const [field, method, max] of [['sets', 'onSetsInput', 100], ['reps', 'onRepsInput', 1000]]) {
  for (const value of ['', 0, -1, 1.5, max + 1, Infinity]) test(`plan blocks invalid ${field}=${value}`, async () => {
    const s = setup()
    s.page.data.selectedExercises[0][field] = value
    await s.page.createGoal()
    assert.equal(s.writes.length, 0)
    assert.ok(s.notices.some(x => x.includes('请输入')))
  })
  test(`plan ${field} rejects pasted non-integers without truncation`, () => {
    const s = setup(), previous = s.page.data.selectedExercises[0][field]
    for (const value of ['1.5', '-1', '2x', '1e3']) {
      assert.equal(s.page[method]({ currentTarget: { dataset: { index: 0 } }, detail: { value } }), String(previous))
      assert.equal(s.page.data.selectedExercises[0][field], previous)
    }
  })
}

for (const [sets, reps] of [[1, 1], [100, 1000]]) test(`plan accepts boundary ${sets}/${reps}`, async () => {
  const s = setup()
  s.page.onSetsInput({ currentTarget: { dataset: { index: 0 } }, detail: { value: String(sets) } })
  s.page.onRepsInput({ currentTarget: { dataset: { index: 0 } }, detail: { value: String(reps) } })
  await s.page.createGoal()
  assert.equal(s.writes.length, 1)
  assert.equal(s.writes[0].exercises[0].sets, sets)
  assert.equal(s.writes[0].exercises[0].reps, reps)
})
