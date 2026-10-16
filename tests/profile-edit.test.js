const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPage, deferred } = require('./page-harness')

function setup(request, original = { nick_name: '原昵称', gender: 2, age: 65, height: 170, weight: 66, health_status: '原备注' }) {
  const storage = { userInfo: { ...original } }
  const events = [], writes = []
  let server = { ...original }
  const make = () => {
    const { page } = loadPage('pages/profile-edit/profile-edit.js', async (url, method, data) => {
      if (method === 'PUT') writes.push({ ...data })
      if (request) return request(url, method, data)
      if (method === 'PUT') server = { ...server, ...data }
      return { code: 0, data: { ...server } }
    }, storage, { setTimeout: fn => fn(), wx: {
      showToast: event => events.push(event.title), navigateBack: () => events.push('back')
    } })
    page.setData = update => {
      for (const [key, value] of Object.entries(update)) {
        const parts = key.split('.')
        if (parts.length === 2) page.data[parts[0]][parts[1]] = value
        else page.data[key] = value
      }
    }
    page.loadUserInfo()
    return page
  }
  return { page: make(), make, storage, events, writes }
}

test('profile preserves integer fields through input, save, readback and reopen', async () => {
  const s = setup()
  s.page.onWeightInput({ detail: { value: '67' } })
  s.page.onNickNameInput({ detail: { value: '新昵称' } })
  await s.page.onSave()
  assert.equal(s.writes[0].weight, 67)
  assert.equal(s.make().data.userInfo.weight, 67)
  assert.equal(s.make().data.userInfo.nick_name, '新昵称')
  assert.ok(s.events.includes('保存成功'))
})

for (const [field, method, values] of [
  ['age', 'onAgeInput', ['0', '-1', '151', '2.5', '20x']],
  ['height', 'onHeightInput', ['0', '49', '251', '170.5', '170x']],
  ['weight', 'onWeightInput', ['0', '19.9', '301', '66x', 'Infinity']]
]) {
  for (const value of values) test(`profile rejects ${field}=${value} without a write`, async () => {
    const s = setup()
    s.page.data.userInfo[field] = value
    await s.page.onSave()
    assert.equal(s.writes.length, 0)
    assert.ok(s.events.some(x => x.includes('正确')))
  })
}

test('profile clearing optional fields persists and reopens empty', async () => {
  const s = setup()
  for (const method of ['onAgeInput', 'onHeightInput', 'onWeightInput', 'onHealthStatusInput']) s.page[method]({ detail: { value: '' } })
  s.page.onGenderChange({ detail: { value: '0' } })
  await s.page.onSave()
  assert.deepEqual([s.writes[0].age, s.writes[0].height, s.writes[0].weight, s.writes[0].gender], [0, 0, 0, 0])
  const p = s.make()
  assert.equal(p.data.userInfo.age, null)
  assert.equal(p.data.userInfo.health_status, '')
})

test('profile cancel does not change saved data', () => {
  const s = setup()
  s.page.onNickNameInput({ detail: { value: '取消修改' } })
  s.page.onCancel()
  assert.equal(s.make().data.userInfo.nick_name, '原昵称')
  assert.equal(s.writes.length, 0)
})

for (const failure of ['network', 'business', 'readback']) test(`profile ${failure} failure preserves cache and permits retry`, async () => {
  let fail = true
  const s = setup(async (url, method, data) => {
    if (fail && failure === 'network') throw Error('网络请求失败')
    if (fail && failure === 'business') return { code: 500, message: '保存失败' }
    if (fail && failure === 'readback' && method === 'GET') throw Error('资料读回失败，请重试')
    return { code: 0, data: method === 'GET' ? { nick_name: '新昵称', gender: 2 } : data }
  })
  s.page.onNickNameInput({ detail: { value: '新昵称' } })
  await s.page.onSave()
  assert.equal(s.storage.userInfo.nick_name, '原昵称')
  assert.equal(s.page.data.loading, false)
  assert.ok(!s.events.includes('保存成功'))
  fail = false
  await s.page.onSave()
  assert.equal(s.storage.userInfo.nick_name, '新昵称')
})

test('profile concurrent and post-success taps submit only once', async () => {
  const gate = deferred()
  const s = setup(async (url, method) => method === 'PUT' ? gate.promise : { code: 0, data: { nick_name: '服务器回读', gender: 0 } })
  const pending = s.page.onSave()
  await s.page.onSave()
  assert.equal(s.writes.length, 1)
  gate.resolve({ code: 0 })
  await pending
  await s.page.onSave()
  assert.equal(s.writes.length, 1)
  assert.equal(s.storage.userInfo.nick_name, '服务器回读')
})

for (const [field, method] of [['age', 'onAgeInput'], ['height', 'onHeightInput'], ['weight', 'onWeightInput']]) {
  test(`profile ${field} blocks decimal, negative and text input without changing value`, () => {
    const s = setup()
    const previous = s.page.data.userInfo[field]
    for (const value of ['66.5', '-', '-1', '12x', '1e2', ' 20']) {
      assert.equal(s.page[method]({ detail: { value } }), String(previous))
      assert.equal(s.page.data.userInfo[field], previous)
    }
    assert.ok(s.events.includes('只能输入整数'))
  })
}

for (const [age, height, weight] of [[1, 50, 20], [150, 250, 300]]) {
  test(`profile accepts inclusive numeric boundaries ${age}/${height}/${weight}`, async () => {
    const s = setup()
    s.page.onAgeInput({ detail: { value: String(age) } })
    s.page.onHeightInput({ detail: { value: String(height) } })
    s.page.onWeightInput({ detail: { value: String(weight) } })
    await s.page.onSave()
    assert.deepEqual([s.writes[0].age, s.writes[0].height, s.writes[0].weight], [age, height, weight])
  })
}
