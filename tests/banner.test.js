const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { loadPage, deferred } = require('./page-harness')
const { DEFAULT_BANNER_IMAGE } = require('../utils/banner')
const item = (id, title = '测试标题') => ({ id, title, description: '测试说明', image_url: `https://assets.example.test/uploads/images/${id}.jpg`, enabled: true })
const reply = items => ({ code: 0, data: { configured: true, items } })

function fixture(request) {
  const routes = []
  const f = loadPage('pages/index/index.js', request, {}, { wx: { navigateTo: value => routes.push(value), switchTab: value => routes.push(value) } })
  return { ...f, routes }
}

test('home loads ordered public banners without login and ignores arbitrary jump fields', async () => {
  const f = fixture(async (url, method) => {
    assert.equal(url, '/banners'); assert.equal(method, 'GET')
    return reply([{ ...item(2), path: '/pages/login/login' }, item(1)])
  })
  await f.page.getBannerList()
  assert.deepEqual(Array.from(f.page.data.bannerList, x => x.id), [2, 1])
  assert.equal(f.page.data.bannerList[0].path, undefined)
  assert.equal(f.routes.length, 0)
  const wxml = fs.readFileSync('pages/index/index.wxml', 'utf8').split('<!-- 多家庭待完成任务 -->')[0].split('<!-- 轮播图 -->')[1]
  assert.doesNotMatch(wxml, /bindtap|catchtap/)
})

test('unconfigured uses one local default while configured empty means intentionally hidden', async () => {
  let response = { code: 0, data: { configured: false, items: [] } }
  const f = fixture(async () => response)
  await f.page.getBannerList()
  assert.equal(f.page.data.bannerList.length, 1)
  assert.equal(f.page.data.bannerList[0].image_url, DEFAULT_BANNER_IMAGE)
  response = reply([]); await f.page.getBannerList()
  assert.equal(f.page.data.bannerList.length, 0)
  const wxml = fs.readFileSync('pages/index/index.wxml', 'utf8')
  assert.match(wxml, /<swiper wx:if="{{bannerList.length > 0}}"/)
  assert.match(wxml, /autoplay="{{bannerList.length > 1}}"/)
})

test('failure preserves last good items or intentionally empty state and permits retry', async () => {
  let fail = true, response = reply([item(1)])
  const f = fixture(async () => { if (fail) throw Error('offline'); return response })
  await f.page.getBannerList(); assert.equal(f.page.data.bannerList[0].image_url, DEFAULT_BANNER_IMAGE)
  fail = false; await f.page.getBannerList()
  fail = true; await f.page.getBannerList(); assert.equal(f.page.data.bannerList[0].id, 1)
  response = reply([]); fail = false; await f.page.getBannerList()
  fail = true; await f.page.getBannerList(); assert.equal(f.page.data.bannerList.length, 0)
})

test('duplicate refreshes share the ongoing request', async () => {
  const gate = deferred(), f = fixture(() => gate.promise)
  const first = f.page.getBannerList(); await f.page.getBannerList()
  assert.equal(f.calls.length, 1)
  gate.resolve(reply([item(1)])); await first
  assert.equal(f.page._bannerLoading, false)
})

for (const data of [null, { configured: true, items: null }, { configured: true, items: [item(1), item(1)] },
  { configured: true, items: [{ ...item(1), enabled: false }] }, { configured: true, items: [{ ...item(1), image_url: 'javascript:alert(1)' }] },
  { configured: true, items: [{ ...item(1), id: 9007199254740992 }] }, { configured: true, items: Array.from({ length: 11 }, (_, i) => item(i + 1)) }]) {
  test('malformed public payload cannot replace the last valid list: ' + JSON.stringify(data).slice(0, 45), async () => {
    let response = reply([item(7)])
    const f = fixture(async () => response)
    await f.page.getBannerList(); response = { code: 0, data }; await f.page.getBannerList()
    assert.equal(f.page.data.bannerList[0].id, 7)
  })
}

test('failed image falls back only once and does not alter other slides', async () => {
  const f = fixture(async () => reply([item(1), item(2)]))
  await f.page.getBannerList()
  f.page.onBannerImageError({ currentTarget: { dataset: { index: 0 } } })
  assert.equal(f.page.data.bannerList[0].image_url, DEFAULT_BANNER_IMAGE)
  assert.equal(f.page.data.bannerList[1].image_url, item(2).image_url)
  const count = f.page.snapshots.length
  f.page.onBannerImageError({ currentTarget: { dataset: { index: 0 } } })
  f.page.onBannerImageError({ currentTarget: { dataset: { index: -1 } } })
  assert.equal(f.page.snapshots.length, count)
})
