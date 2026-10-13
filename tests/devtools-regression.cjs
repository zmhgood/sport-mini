const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const out=require('node:path').join(require('node:os').tmpdir(),'sport-mini-regression')
fs.mkdirSync(out,{recursive:true})
const result={date:'2026-10-13',scope:'official devtools local code with synthetic API responses',productionWrites:false,checks:[]}
const save=()=>fs.writeFileSync(out+'/regression-20261013-runtime.json',JSON.stringify(result,null,2))
let activeMini
const cleanup=async()=>{if(!activeMini)return;await activeMini.restoreWxMethod('request').catch(()=>{});await activeMini.restoreWxMethod('showModal').catch(()=>{});await activeMini.restoreWxMethod('getAccountInfoSync').catch(()=>{});await activeMini.evaluate(()=>{if(getApp().__regression)getApp().__regression.restore()}).catch(()=>{});activeMini.disconnect()}
const timer=setTimeout(async()=>{result.error='test deadline exceeded';save();await cleanup();process.exit(2)},110000)
;(async()=>{
 const m=await auto.connect({wsEndpoint:process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9420'});activeMini=m
 const route=async url=>{await m.evaluate(u=>{wx.reLaunch({url:u});return true},url);for(let i=0;i<100;i++){const p=await m.currentPage();if(p.path===url.split('?')[0].replace(/^\//,''))return p;await new Promise(r=>setTimeout(r,100))}throw Error('route failed: '+url)}
 const yes=(name,value)=>{assert(value,name);result.checks.push(name);save();console.log('PASS '+name)}
 const settled=async(p)=>{for(let n=0;n<50;n++){if(!await p.data('loading'))return;await p.waitFor(100)}throw Error('loading timeout')}
 try {
  yes('simulator-only',(await m.systemInfo()).platform==='devtools')
  await m.evaluate(()=>{
    const keys=['token','userId','userInfo','currentFamilyId'];const old={};keys.forEach(k=>old[k]=wx.getStorageSync(k))
    const qa={mode:'success',joined:false,completed:0,writes:[],restore(){keys.forEach(k=>old[k] ? wx.setStorageSync(k,old[k]):wx.removeStorageSync(k));delete getApp().__regression}}
    getApp().__regression=qa;wx.setStorageSync('token','local-synthetic');wx.setStorageSync('userId',7);wx.setStorageSync('userInfo',{id:7,nick_name:'测试用户'});wx.removeStorageSync('currentFamilyId')
  })
  await m.mockWxMethod('showModal',{confirm:true,cancel:false})
  await m.mockWxMethod('request',function(options){
      const qa=getApp().__regression
      const path=options.url.replace(/^https?:\/\/[^/]+\/api/,'');const method=options.method||'GET'
      if(method!=='GET')qa.writes.push({path,data:options.data})
      const ex={id:1,name:'完整动作示例',image_url:'/images/exercise/default-exercise.jpg',muscle_group_id:3,target_muscle:'下肢',sets:3,reps:10,duration:10,difficulty:'简单'}
      const family={id:901,name:'测试家庭',invite_code:'AB12CD',members:[{user_id:7,role:'admin',user:{nick_name:'测试用户'}}]}
      let data={}
      if(path==='/families')data=[family]
      else if(path==='/family/901')data=family
      else if(path.startsWith('/goals/family'))data=[]
      else if(path==='/goals/902/members'){qa.joined=true}
      else if(path==='/goals/902/complete'){qa.completed=options.data.completed_sets}
      else if(path==='/goals/902/progress')data={member_stats:qa.joined?[{user_id:7,user_name:'测试用户',total_sets:3,completed_sets:qa.completed,exercise_stats:[{goal_exercise_id:3,target_sets:3,completed_sets:qa.completed,reps:10,exercise_name:'完整动作示例'}]}]:[]}
      else if(path==='/goals/902')data={id:902,name:'测试目标',members:qa.joined?[{user_id:7}]:[],exercises:[{id:3,exercise_id:1,sets:3,reps:10,exercise:ex}]}
      else if(path==='/exercises')data={list:qa.mode==='empty'?[]:[ex]}
      else if(path==='/exercises/1')data=ex
      else if(path==='/user/info')data={id:7,nick_name:'测试用户'}
      else if(path==='/family/join')data=family
      else if(path.includes('stats')||path.includes('goals'))data=[]
      const fail=qa.mode==='error'&&path.startsWith('/exercises')
      if(fail) return {statusCode:503,data:{code:503,message:'模拟网络错误'}}
      return {statusCode:200,data:{code:0,data}}
  })
  console.log('STEP goal');let p=await route('/pages/goal/detail?id=902');await settled(p)
  await p.callMethod('startExercise',{currentTarget:{dataset:{item:(await p.data('goal')).exercises[0]}}});await p.waitFor(600)
  p=await m.currentPage();yes('nonparticipant-joins-before-workout',p.path==='pages/goal/progress'&&await m.evaluate(()=>getApp().__regression.joined))
  for(const item of await p.$$('.set-item'))await item.tap()
  yes('three-selected-sets-show-100-percent',await p.data('completedPercent')===100)
  await (await p.$('.btn-submit')).tap();await p.waitFor(200)
  yes('progress-submit-succeeds-once',await p.data('submitted')&&await m.evaluate(()=>getApp().__regression.writes.filter(x=>x.path.endsWith('/complete')).length===1))
  for(let i=0;i<100;i++){p=await m.currentPage();if(p.path==='pages/goal/detail'&&!await p.data('loading')&&(await p.data('exerciseStatus'))?.[3]?.is_done)break;await new Promise(r=>setTimeout(r,100))}
  result.returnState={path:p.path,exerciseStatus:await p.data('exerciseStatus'),fixture:await m.evaluate(()=>({joined:getApp().__regression.joined,completed:getApp().__regression.completed,pages:getCurrentPages().map(p=>p.route)}))}
  yes('return-refreshes-goal-completion',(await p.data('exerciseStatus'))?.[3]?.is_done===true)
  p=await route('/pages/family/family');await settled(p)
  const button=await p.$('.invite-share');yes('invite-is-wechat-share-button',(await button.attribute('open-type'))==='share')
  const share=await p.callMethod('onShareAppMessage');yes('share-recipient-route-carries-code',share.path==='/pages/family/join?type=join&code=AB12CD')
  p=await route(share.path);yes('invitation-prefilled-without-joining',await p.data('inviteCode')==='AB12CD'&&await m.evaluate(()=>!getApp().__regression.writes.some(x=>x.path==='/family/join')))
  await(await p.$('.btn-submit')).tap();for(let i=0;i<100;i++){p=await m.currentPage();if(p.path==='pages/family/family')break;await new Promise(r=>setTimeout(r,100))}await settled(p)
  yes('invitation-join-lands-on-family',p.path==='pages/family/family'&&await m.evaluate(()=>wx.getStorageSync('currentFamilyId')===901))
  p=await route('/pages/muscle/muscle');await settled(p)
  yes('exercise-image-preserves-entire-image',(await(await p.$('.exercise-image')).attribute('mode'))==='aspectFit')
  await m.screenshot({path:out+'/regression-20261013-muscle.png'})
  const icon=await p.$('custom-tab-bar .tab-icon')
  if(icon){const size=await icon.size();result.tabIconSize=size;yes('tab-icons-at-least-30-css-pixels',Number(size.width)>=30&&Number(size.height)>=30)}
  else result.tabIconSize='custom component requires screenshot review'
  await m.evaluate(()=>{getApp().__regression.mode='error'});await p.callMethod('getExercises');await settled(p)
  yes('list-network-error-shows-retry-no-fake-content',!!await p.$('button')&&!await p.$('.exercise-card')&&!!await p.data('loadError'))
  await m.evaluate(()=>{getApp().__regression.mode='empty'});await(await p.$('button')).tap();await settled(p)
  yes('list-retry-can-show-real-empty',!await p.data('loadError')&&(await p.data('exercises')).length===0)
  await m.evaluate(()=>{getApp().__regression.mode='error'});p=await route('/pages/exercise/exercise?id=1');await settled(p)
  yes('detail-failure-does-not-invent-data',!await p.data('exercise')&&!!await p.$('button'))
  await m.evaluate(()=>{getApp().__regression.mode='success'});await(await p.$('button')).tap();await settled(p)
  yes('detail-retry-recovers-real-data',(await p.data('exercise')).name==='完整动作示例')
  p=await route('/pages/profile/profile')
  yes('profile-develop-footer-has-no-invented-version',(await(await p.$('.footer-text')).text()).trim()==='爸妈动起来 开发版')
  const settings=await p.$$('.setting-value')
  yes('unfinished-settings-never-claim-to-be-configured',await Promise.all(settings.slice(3).map(s=>s.text())).then(values=>values.length===4&&values.every(v=>v==='暂未开放')))
  await m.mockWxMethod('getAccountInfoSync',{miniProgram:{envVersion:'trial',version:''}})
  await p.callMethod('loadVersion')
  yes('trial-footer-does-not-reuse-release-number',(await(await p.$('.footer-text')).text()).trim()==='爸妈动起来 体验版')
  await m.mockWxMethod('getAccountInfoSync',{miniProgram:{envVersion:'release',version:'1.0.20261013.1'}})
  await p.callMethod('loadVersion')
  yes('release-footer-reads-platform-version',(await(await p.$('.footer-text')).text()).trim()==='爸妈动起来 v1.0.20261013.1')
  await m.restoreWxMethod('getAccountInfoSync')
  await p.callMethod('loadVersion')
  await m.pageScrollTo(99999)
  await m.screenshot({path:out+'/profile-display-20261013.png'})
  result.completed=true;save()
 } finally {
   await m.restoreWxMethod('request').catch(()=>{});await m.restoreWxMethod('showModal').catch(()=>{});await m.restoreWxMethod('getAccountInfoSync').catch(()=>{});await m.evaluate(()=>{if(getApp().__regression)getApp().__regression.restore()}).catch(()=>{})
   await route('/pages/index/index').catch(()=>{})
   m.disconnect();clearTimeout(timer)
 }
})().catch(e=>{result.error=e.message;save();console.error(e.message);process.exitCode=1;clearTimeout(timer)})
