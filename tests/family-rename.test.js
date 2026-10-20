const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, visibleText, deferred } = require('./page-harness')

function fixture(request = async () => ({ code: 0, data: { id: 4, name: '新家' } })) {
  const writes = [], storage = { currentFamilyId: 4 }
  const { page } = loadPage('pages/family/family.js', async (...args) => { writes.push(args); return request(...args) }, storage)
  page.setData({ loading: false, isAdmin: true, family: { id: 4, name: '旧家', invite_code: 'ABC123' }, families: [{ id: 4, name: '旧家' }, { id: 5, name: '其他家' }] })
  return { page, writes, storage }
}

test('only admins see and can open the name editor; cancel does not write', () => {
  const f = fixture()
  assert.match(visibleText('pages/family/family.wxml', f.page.data), /修改家庭名称/)
  f.page.editFamilyName()
  assert.equal(f.page.data.familyNameDraft, '旧家')
  assert.match(visibleText('pages/family/family.wxml', f.page.data), /保存名称/)
  f.page.cancelFamilyNameEdit()
  assert.equal(f.page.data.familyNameEditing, false)
  assert.equal(f.writes.length, 0)
  f.page.setData({ isAdmin: false })
  assert.doesNotMatch(visibleText('pages/family/family.wxml', f.page.data), /修改家庭名称|保存名称/)
  f.page.editFamilyName()
  assert.equal(f.page.data.familyNameEditing, false)
})

test('successful rename targets selected family ID, trims name and keeps unrelated state', async () => {
  const f = fixture()
  f.page.editFamilyName()
  f.page.onFamilyNameInput({ detail: { value: ' 新家 ' } })
  await f.page.saveFamilyName()
  assert.equal(f.writes[0][0], '/family/4/name')
  assert.equal(f.writes[0][1], 'PUT')
  assert.equal(f.writes[0][2].name, '新家')
  assert.equal(f.page.data.family.name, '新家')
  assert.equal(f.page.data.families[0].name, '新家')
  assert.equal(f.page.data.families[1].name, '其他家')
  assert.equal(f.page.data.family.invite_code, 'ABC123')
  assert.equal(f.storage.currentFamilyId, 4)
  assert.match(f.page.onShareAppMessage().title, /新家/)
  assert.equal(f.page.data.familyNameEditing, false)
})

for (const draft of ['   ', '家'.repeat(65), '家庭\n名称']) {
  test('invalid name is rejected before any request: ' + JSON.stringify(draft.slice(0, 10)), async () => {
    const f = fixture()
    f.page.editFamilyName(); f.page.setData({ familyNameDraft: draft })
    await f.page.saveFamilyName()
    assert.equal(f.writes.length, 0)
    assert.match(f.page.data.familyNameError, /1～64/)
  })
}

test('input limit counts Unicode characters instead of splitting emoji', () => {
  const f = fixture()
  f.page.onFamilyNameInput({ detail: { value: '😀'.repeat(65) } })
  assert.equal(Array.from(f.page.data.familyNameDraft).length, 64)
  assert.equal(f.page.data.familyNameDraft, '😀'.repeat(64))
})

test('pending save suppresses duplicates, cancellation and family switching', async () => {
  const gate = deferred(), f = fixture(() => gate.promise)
  f.page.editFamilyName(); f.page.setData({ familyNameDraft: '新家' })
  const save = f.page.saveFamilyName()
  assert.equal(f.page.data.renameSaving, true)
  await f.page.saveFamilyName(); f.page.cancelFamilyNameEdit(); f.page.onFamilyChange({ detail: { value: '1' } })
  assert.equal(f.writes.length, 1)
  assert.equal(f.page.data.familyNameEditing, true)
  assert.equal(f.storage.currentFamilyId, 4)
  gate.resolve({ code: 0, data: { id: 4, name: '新家' } }); await save
  assert.equal(f.page.data.renameSaving, false)
})

for (const response of ['network', 'forbidden', 'business']) {
  test(`${response} failure keeps draft and current family for retry`, async () => {
    const f = fixture(async () => {
      if (response === 'business') return { code: 400, message: '名称无效' }
      throw Error(response === 'forbidden' ? '只有家庭管理员可以修改家庭名称' : '网络请求失败')
    })
    f.page.editFamilyName(); f.page.setData({ familyNameDraft: '新家' })
    await f.page.saveFamilyName()
    assert.equal(f.page.data.familyNameDraft, '新家')
    assert.equal(f.page.data.familyNameEditing, true)
    assert.ok(f.page.data.familyNameError)
    assert.equal(f.page.data.family.name, '旧家')
    assert.equal(f.page.data.renameSaving, false)
  })
}

test('lost admin role and switched family cannot submit a stale editor', async () => {
  const f = fixture()
  f.page.editFamilyName(); f.page.setData({ isAdmin: false })
  await f.page.saveFamilyName()
  assert.equal(f.writes.length, 0)
  f.page.setData({ isAdmin: true, family: { id: 5, name: '其他家' } })
  await f.page.saveFamilyName()
  assert.equal(f.writes.length, 0)
})

test('a late response never renames a different currently selected family', async () => {
  const gate = deferred(), f = fixture(() => gate.promise)
  f.page.editFamilyName(); f.page.setData({ familyNameDraft: '新家' })
  const save = f.page.saveFamilyName()
  f.page.setData({ family: { id: 5, name: '其他家' } })
  gate.resolve({ code: 0, data: { id: 4, name: '新家' } }); await save
  assert.equal(f.page.data.family.name, '其他家')
  assert.equal(f.page.data.families[0].name, '新家')
})
