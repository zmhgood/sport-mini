const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, visibleText } = require('./page-harness')
const template = 'pages/goal/progress.wxml'
const stats = id => ({ user_id: id, user_name: 'Test member', completed_sets: 1, total_sets: 3, exercise_stats: [{ exercise_name: 'Test exercise', target_sets: 3, completed_sets: 1 }] })
function pageFor(members) {
  const { page } = loadPage('pages/goal/progress.js', () => Promise.resolve({ code: 0, data: { member_stats: members } }))
  page.data.currentUserId = 7
  page.data.goalId = 9
  page.data.myProgress = stats(7)
  return page
}

test('empty progress clears previous personal stats with an explicit null', async () => {
  const page = pageFor([])
  await page.loadProgress()
  assert.equal(page.data.myProgress, null)
  assert.equal(page.data.otherProgress.length, 0)
  assert.match(visibleText(template, page.data), /暂无锻炼进度/)
  assert.doesNotMatch(visibleText(template, page.data), /今日锻炼进度/)
})

test('only other members clears previous personal stats and retains their progress', async () => {
  const page = pageFor([stats(8)])
  await page.loadProgress()
  assert.equal(page.data.myProgress, null)
  assert.equal(page.data.otherProgress.length, 1)
  assert.equal(page.data.otherProgress[0].user_id, 8)
  const text = visibleText(template, page.data)
  assert.doesNotMatch(text, /暂无锻炼进度|今日锻炼进度/)
  assert.match(text, /Test member/)
})

test('matching personal stats retains normal progress calculations', async () => {
  const page = pageFor([stats(7), stats(8)])
  await page.loadProgress()
  assert.equal(page.data.myProgress.user_id, 7)
  assert.equal(page.data.myProgress.exercise_stats[0].segment_width, 100)
  assert.equal(page.data.myProgress.exercise_stats[0].fill_width, 33)
  assert.equal(page.data.otherProgress[0].user_id, 8)
  assert.match(visibleText(template, page.data), /今日锻炼进度/)
})
