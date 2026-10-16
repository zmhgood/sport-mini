const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs = require('node:fs')
const assert = require('node:assert/strict')
let mini
const result = { checks: [], complete: false }
;(async () => {
 try {
  mini = await auto.connect({wsEndpoint:process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9472'})
  assert.equal((await mini.systemInfo()).platform,'devtools')
  await mini.evaluate(() => {
   const app = getApp()
   app._qaCatalogueRequests = 0; app._qaCatalogueMode = 'ok'; app._qaTimeOffset = 0
   app._qaOriginalNow = Date.now
   Date.now = () => getApp()._qaOriginalNow() + getApp()._qaTimeOffset
  })
  await mini.mockWxMethod('request', options => {
   if (options.url.includes('/exercises')) {
    getApp()._qaCatalogueRequests++
    if (getApp()._qaCatalogueMode === 'error') return {statusCode:503,data:{code:503,message:'Synthetic failure'}}
    return {statusCode:200,data:{code:0,data:{total:2,list:[{id:901,name:'Synthetic upper',muscle_group:{name:'上肢'}},{id:902,name:'Synthetic lower',muscle_group:{name:'下肢'}}]}}}
   }
   return {statusCode:503,data:{code:503}}
  })
  let page = await mini.reLaunch('/pages/index/index')
  await page.waitFor(300)
  result.checks.push({name:'home catalogue',pass:(await page.data('recommendExercises')).length===2})
  page = await mini.reLaunch('/pages/muscle/muscle')
  await page.setData({currentTab:2}); await page.callMethod('getExercises')
  result.checks.push({name:'category filtering',pass:(await page.data('exercises'))[0]?.id===902})
  page = await mini.reLaunch('/pages/goal/create')
  await page.callMethod('loadExercises')
  result.checks.push({name:'plan catalogue',pass:(await page.data('exerciseList')).length===2})
  result.initialCatalogueRequestCount = await mini.evaluate(() => getApp()._qaCatalogueRequests)
  result.checks.push({name:'three pages share one catalogue request',pass:result.initialCatalogueRequestCount===1})
  page = await mini.reLaunch('/pages/muscle/muscle')
  await page.setData({currentTab:0}); await page.callMethod('getExercises')
  result.checks.push({name:'cached category switching',pass:(await page.data('exercises'))[0]?.id===901 && await mini.evaluate(()=>getApp()._qaCatalogueRequests)===1})
  await mini.evaluate(()=>{ getApp()._qaTimeOffset += 61000 })
  await page.callMethod('getExercises')
  result.checks.push({name:'expired catalogue refreshes',pass:await mini.evaluate(()=>getApp()._qaCatalogueRequests)===2})
  await mini.evaluate(()=>{ getApp()._qaTimeOffset += 61000; getApp()._qaCatalogueMode='error' })
  await page.callMethod('getExercises')
  result.checks.push({name:'failed refresh shows retry and releases loading',pass:await page.data('loadError')==='Synthetic failure' && await page.data('loading')===false})
  await mini.evaluate(()=>{ getApp()._qaCatalogueMode='ok' })
  await page.callMethod('getExercises')
  result.checks.push({name:'failure is not cached and retry succeeds',pass:await mini.evaluate(()=>getApp()._qaCatalogueRequests)===4 && (await page.data('exercises'))[0]?.id===901 && await page.data('loadError')===''})
  result.totalCatalogueRequestsBeforeCleanup = await mini.evaluate(()=>getApp()._qaCatalogueRequests)
  result.complete = result.checks.every(x=>x.pass)
  if (!result.complete) process.exitCode=1
 } catch(e) { result.error=e.message; process.exitCode=1 }
 finally {
  if(mini) {
   // Expire and reject the synthetic catalogue so no mocked items remain cached.
   try {
    await mini.evaluate(()=>{ getApp()._qaTimeOffset += 61000; getApp()._qaCatalogueMode='error' })
    const page = await mini.currentPage(); await page.callMethod('getExercises')
    result.syntheticCacheRemoved = true
   } catch(e) { result.cleanupError=e.message; process.exitCode=1 }
   await mini.evaluate(()=>{
    const app=getApp(); if(app._qaOriginalNow) Date.now=app._qaOriginalNow
    for(const key of ['_qaCatalogueRequests','_qaCatalogueMode','_qaTimeOffset','_qaOriginalNow']) delete app[key]
   }).catch(()=>{})
   await mini.restoreWxMethod('request').catch(()=>{})
   mini.disconnect()
  }
  fs.writeFileSync(process.env.MINI_QA_RESULT || '/tmp/sport-catalogue-simulator-complete.json',JSON.stringify(result,null,2))
  console.log(JSON.stringify(result))
 }
})()
