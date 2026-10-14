const auto=require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs=require('node:fs'),assert=require('node:assert/strict')
const out=process.env.MINI_QA_OUTPUT || require('node:path').join(require('node:os').tmpdir(),'sport-mini-layout-qa'),label=process.argv[2]||'surfaces'
fs.mkdirSync(out,{recursive:true})
let m
const result={label,scope:'original official simulator, synthetic data and mocked requests, no production writes',navigationInput:'official SDK route methods; page button navigation not covered by this runner',selectionInput:'WXML tap event with independent state readback; SDK pointer tap unreliable',checks:[],exceptions:[]}
const save=()=>fs.writeFileSync(`${out}/surfaces-${label}.json`,JSON.stringify(result,null,2))
const timer=setTimeout(()=>{result.error='90 second deadline';save();m?.disconnect();process.exit(2)},90000)
function check(name,pass,detail){result.checks.push({name,pass:!!pass,detail});save();assert(pass,name)}
async function settle(fn){const start=Date.now();let ok;do{ok=await fn();if(ok)return true;await new Promise(r=>setTimeout(r,100))}while(Date.now()-start<3000);return false}
async function routeReady(path){
 const start=Date.now();let actual
 do{actual=await m.evaluate(()=>getCurrentPages().slice(-1)[0]?.route);if(actual===path)break;await new Promise(r=>setTimeout(r,100))}while(Date.now()-start<8000)
 check('route '+path,actual===path,actual)
 let page=await m.currentPage()
 if(page.path!==actual){m.disconnect();m=await auto.connect({wsEndpoint:process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9420'});page=await m.currentPage();result.cacheRefreshes=(result.cacheRefreshes||0)+1}
 const signature=({'pages/index/index':'.header','pages/profile/profile':'.footer','pages/family/family':'.family-card','pages/goal/create':'.name-input','pages/muscle/muscle':'.tabs'})[path]; if(signature){const ready=Date.now();while(!await page.$(signature)&&Date.now()-ready<8000)await page.waitFor(100);check('rendered template '+path,!!await page.$(signature),signature)}
 return page
}
async function rects(selectors){return m.evaluate(sels=>new Promise(resolve=>{const q=wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0]);for(const s of sels)q.select(s).boundingClientRect();q.exec(resolve)}),selectors)}
async function tabLayout(index){
 const data=await m.evaluate(()=>new Promise(resolve=>{const tab=getCurrentPages().slice(-1)[0].getTabBar();const q=wx.createSelectorQuery().in(tab);q.select('.tab-bar').boundingClientRect();q.selectAll('.tab-icon').boundingClientRect();q.selectAll('.tab-text').boundingClientRect();q.exec(rows=>resolve({rows,selected:tab.data.selected,hidden:tab.data.hidden}));}))
 const [bar,icons,labels]=data.rows,info=result.device
 check('tab '+index+' selected and visible',data.selected===index&&!data.hidden&&bar.height>0,data)
 check('tab '+index+' contents inside safe bounds',icons.length===3&&labels.length===3&&labels.every((r,i)=>r.top>=icons[i].bottom-1&&r.bottom<=info.height-info.safeBottom+1),data)
 if(process.env.MINI_QA_SCREENSHOTS === '1')await m.screenshot({path:`${out}/surface-${label}-tab${index}.png`})
}
;(async()=>{
 m=await auto.connect({wsEndpoint:process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9420'})
 const info=await m.systemInfo();assert.equal(info.platform,'devtools')
 result.device={model:info.model,width:info.windowWidth,height:info.windowHeight,safeBottom:info.screenHeight-info.safeArea.bottom,fontSize:info.fontSizeSetting}
 m.on('exception',e=>result.exceptions.push(String(e.message||'runtime exception').slice(0,200)))
 await m.evaluate(()=>{getApp().__compatWrites=[]})
 await m.mockWxMethod('request',function(opts){
  const path=opts.url.replace(/^https?:\/\/[^/]+\/api/,'')
  if((opts.method||'GET')!=='GET'){getApp().__compatWrites.push(path);return {statusCode:403,data:{code:403,message:'测试禁止写入'}}}
  const member={user_id:901,role:'admin',user:{id:901,nick_name:'这是模拟家庭成员的很长昵称',avatar_url:'/images/default-avatar.svg'}}
  const family={id:901,name:'模拟家庭',invite_code:'ABC123',members:[member]}
  const ex={id:901,name:'模拟完整展示动作',image_url:'/images/muscle/leg.jpg',image:'/images/muscle/leg.jpg',target_muscle:'这是用于检查换行的很长目标肌肉名称',targetMuscle:'这是用于检查换行的很长目标肌肉名称',sets:3,reps:10,duration:10,difficulty:'简单',muscle_group_id:3}
  let data=[]
  if(path.startsWith('/exercises'))data={list:[ex],total:1}
  else if(path==='/families')data=[family]
  else if(path.startsWith('/family/members'))data=[member]
  else if(path==='/family/901')data=family
  else if(path==='/user/statistics')data={totalDays:1,totalExercises:2,totalMinutes:10,totalSets:6}
  else if(path.startsWith('/user/week-stats'))data={stats:[],weekRange:'模拟日期范围',canGoPrev:true,canGoNext:false}
  return {statusCode:200,data:{code:0,data}}
 })
 let p=await m.currentPage();if(p.path!=='pages/index/index'){await m.reLaunch('/pages/index/index');p=await routeReady('pages/index/index')}check('start on home',p.path==='pages/index/index',p.path)
 await tabLayout(0)
 await m.reLaunch('/pages/profile/profile');p=await routeReady('pages/profile/profile')
 await p.setData({isLoggedIn:true,userInfo:{id:901,nick_name:'用于兼容性验证的很长测试昵称',avatar_url:'/images/default-avatar.svg'}})
 await tabLayout(2)
 await m.pageScrollTo(99999)
 const [footer]=await rects(['.footer']);const tabTop=result.device.height-result.device.safeBottom-112*result.device.width/750
 check('profile footer above navigation when at end',footer.bottom<=tabTop+1,footer)
 if(process.env.MINI_QA_SCREENSHOTS === '1')await m.screenshot({path:`${out}/surface-${label}-profile-bottom.png`})
 await m.reLaunch('/pages/family/family');p=await routeReady('pages/family/family')
 await p.waitFor(300);await p.setData({loading:false,loadError:'',family:{id:901,name:'模拟长名称家庭检查展示',invite_code:'ABC123'},members:[{id:1,user_id:901,role:'admin',user:{nick_name:'模拟管理员'}},{id:2,user_id:902,role:'member',user:{nick_name:'模拟普通成员长名称'}}],isAdmin:true,currentUserId:901})
 if(process.env.MINI_QA_SCREENSHOTS === '1')await m.screenshot({path:`${out}/surface-${label}-family.png`})
 await m.reLaunch('/pages/goal/create?family_id=901');p=await routeReady('pages/goal/create');await p.waitFor(200)
 const [section,button]=await rects(['.submit-section','.btn-submit'])
 check('create submit touch height',button.height>=44,button);
 check('create submit above safe area',button.bottom<=result.device.height-result.device.safeBottom+1,{section,button})
 const members=Array.from({length:12},(_,i)=>({id:901+i,user_id:901+i,user:{nick_name:'模拟长姓名成员'+i},selected:true}))
 const items=Array.from({length:15},(_,i)=>({id:900+i,name:'模拟长动作名称用于检查换行 '+i,target_muscle:'模拟目标肌肉长文字',_category:'lower',_categoryName:'下肢'}))
 await p.setData({members,selectedMemberCount:12,exerciseList:items,filteredExerciseList:items})
 if(process.env.MINI_QA_SCREENSHOTS === '1')await m.screenshot({path:`${out}/surface-${label}-create.png`})
 await p.callMethod('addExercise');await p.waitFor(200)
 const [modal,body,footer2,confirm]=await rects(['.modal-content','.modal-body','.modal-footer','.btn-confirm'])
 check('picker fits viewport',modal.top>=0&&modal.bottom<=result.device.height+1,modal)
 check('picker body cannot cover footer',body.bottom<=footer2.top+1,{body,footer:footer2})
 check('picker confirm touch height',confirm.height>=44,confirm);
 check('picker confirm above safe area',confirm.bottom<=result.device.height-result.device.safeBottom+1,confirm)
 const [optionName,optionTarget,category]=await rects(['.option-name','.option-target','.option-category']);check('action name and target occupy separate lines',optionTarget.top>=optionName.bottom-1,{optionName,optionTarget});check('long text leaves category space',optionName.right<=category.left+1&&optionTarget.right<=category.left+1,{optionName,optionTarget,category});
 const scroll=await p.$('.modal-body');await scroll.scrollTo(0,9999)
 check('picker list actually scrolls',await scroll.property('scrollTop')>0,await scroll.property('scrollTop'))
 const [afterConfirm]=await rects(['.btn-confirm']);check('picker scroll keeps confirm fixed',Math.abs(afterConfirm.top-confirm.top)<1,afterConfirm)
 if(process.env.MINI_QA_SCREENSHOTS === '1')await m.screenshot({path:`${out}/surface-${label}-picker.png`})
 await scroll.scrollTo(0,0);await settle(async()=>await scroll.property('scrollTop')===0);await(await p.$$('.exercise-option'))[0].trigger('tap');const first=await settle(async()=>await p.data('selectedCount')===1);check('first action selection works',first,{count:await p.data('selectedCount'),scrollTop:await scroll.property('scrollTop')})
 await scroll.scrollTo(0,9999);await settle(async()=>await scroll.property('scrollTop')>0);await(await p.$$('.exercise-option'))[14].trigger('tap');check('last scrolled action selection works',await settle(async()=>await p.data('selectedCount')===2),{count:await p.data('selectedCount')})
 await(await p.$('.btn-confirm')).trigger('tap');check('confirm closes picker',await settle(async()=>await p.data('showExerciseModal')===false))
 const selected=await p.data('selectedExercises');check('confirm retains exactly chosen actions',selected.length===2&&selected[0].exercise_id===900&&selected[1].exercise_id===914,selected.map(x=>x.exercise_id))
 await m.reLaunch('/pages/family/family');p=await routeReady('pages/family/family');check('family reopens after picker',p.path==='pages/family/family')
 await m.reLaunch('/pages/profile/profile');p=await routeReady('pages/profile/profile');await tabLayout(2)
 await m.reLaunch('/pages/muscle/muscle');p=await routeReady('pages/muscle/muscle');await tabLayout(1)
 const ready=Date.now();while(await p.data('loading')&&Date.now()-ready<5000)await p.waitFor(100)
 await p.setData({loading:false,loadError:'',currentTab:2,exercises:[{id:901,name:'模拟完整展示动作及很长的动作标题',image:'/images/muscle/leg.jpg',targetMuscle:'模拟较长目标肌肉名称用于检查换行及横向溢出',sets:3,duration:10,difficulty:'简单'}]})
 await m.pageScrollTo(150)
 const [card,image,name,value]=await rects(['.exercise-card','.exercise-image','.exercise-name','.info-value'])
 check('exercise image fits card',image.left>=card.left-1&&image.right<=card.right+1&&image.top>=card.top-1&&image.bottom<=card.bottom+1,{card,image})
 check('exercise image preserves full aspect',await(await p.$('.exercise-image')).attribute('mode')==='aspectFit')
 check('long action and muscle text stay inside card',name.right<=card.right+1&&value.right<=card.right+1,{card,name,value})
 if(process.env.MINI_QA_SCREENSHOTS === '1')await m.screenshot({path:`${out}/surface-${label}-muscle.png`})
 await m.reLaunch('/pages/index/index');p=await routeReady('pages/index/index');await tabLayout(0)
 result.writes=await m.evaluate(()=>getApp().__compatWrites);check('no business writes',result.writes.length===0)
 check('no runtime exceptions',result.exceptions.length===0);result.completed=true;save();console.log(JSON.stringify({device:result.device,checks:result.checks.length,exceptions:result.exceptions}))
})().catch(e=>{result.error=e.message;save();console.error(e.message);process.exitCode=1}).finally(async()=>{if(m){await m.restoreWxMethod('request').catch(()=>{});await m.evaluate(()=>{delete getApp().__compatWrites}).catch(()=>{});m.disconnect()}clearTimeout(timer)})
