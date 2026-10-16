const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage } = require('./page-harness')

function familyPage(request) {
  const modals = [], toasts = [], storage = { currentFamilyId: 4 }
  const { page, calls } = loadPage('pages/family/family.js', request, storage, {
    wx: { showModal: value => modals.push(value), showToast: value => toasts.push(value) }
  })
  page.setData({ family: { id: 4, name: '测试家庭' } })
  let reloads = 0
  page.loadFamilies = () => { reloads++ }
  return { page, calls, modals, toasts, storage, reloads: () => reloads }
}

for (const reason of ['请先转移管理员权限或移除其他成员', '您不是该家庭成员', '网络请求失败']) {
  test(`leave failure explains ${reason} and preserves the selected family`, async () => {
    const f = familyPage(async () => { throw new Error(reason) })
    await f.page.leaveFamily()
    await f.modals[0].success({ confirm: true })
    assert.equal(f.modals[1].title, '无法退出家庭')
    assert.equal(f.modals[1].content, reason)
    assert.equal(f.modals[1].showCancel, false)
    assert.equal(f.storage.currentFamilyId, 4)
    assert.equal(f.reloads(), 0)
    assert.equal(f.toasts.length, 0)
  })
}

test('leave handles a business error returned with HTTP success', async () => {
  const f = familyPage(async () => ({ code: 400, message: '请先转移管理员权限或移除其他成员' }))
  await f.page.leaveFamily()
  await f.modals[0].success({ confirm: true })
  assert.equal(f.modals[1].content, '请先转移管理员权限或移除其他成员')
  assert.equal(f.storage.currentFamilyId, 4)
  assert.equal(f.reloads(), 0)
})

test('cancel leaves membership untouched; successful leave clears selection and reloads', async () => {
  const requests = []
  const f = familyPage(async (...args) => { requests.push(args); return { code: 0 } })
  await f.page.leaveFamily()
  await f.modals[0].success({ confirm: false })
  assert.equal(f.calls.length, 0)
  assert.equal(f.storage.currentFamilyId, 4)
  await f.page.leaveFamily()
  await f.modals[1].success({ confirm: true })
  assert.equal(requests[0][0], '/family/leave')
  assert.equal(requests[0][1], 'POST')
  assert.equal(requests[0][2].family_id, 4)
  assert.equal(f.storage.currentFamilyId, undefined)
  assert.equal(f.reloads(), 1)
  assert.equal(f.toasts[0].title, '已退出')
})
