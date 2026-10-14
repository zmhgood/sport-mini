const auto = require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator')
const fs = require('node:fs')
const label = process.argv[2] || 'baseline'
const out = process.env.MINI_QA_OUTPUT || require('node:path').join(require('node:os').tmpdir(), 'sport-mini-layout-qa')
fs.mkdirSync(out,{recursive:true})
const result = {label, cases: [], exceptions: [], writes: [], scope: 'official simulator, synthetic fixtures, requests blocked/mocked'}
let m
const save = () => fs.writeFileSync(`${out}/pages-${label}.json`, JSON.stringify(result, null, 2))
const timer = setTimeout(() => {result.error='deadline';save();m?.disconnect();process.exit(2)}, 90000)
const checks = []
const check = (name, pass, detail) => {checks.push({name, pass:!!pass, detail});save()}
const longName = '模拟长名称用于检查文字换行与按钮展示'
const ex = {id:901,name:longName,image_url:'/images/muscle/leg.jpg',image:'/images/muscle/leg.jpg',sets:3,reps:10,target_muscle:longName,difficulty:'简单'}
async function rects(selectors) {
 return m.evaluate(sels=>new Promise(resolve=>{const q=wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0]);sels.forEach(s=>q.select(s).boundingClientRect());q.exec(resolve)}), selectors)
}
async function page(url, signature, data) {
 let p = await m.reLaunch(url)
 if(p.path !== url.split('?')[0].slice(1)) throw Error('route mismatch '+p.path)
 const start=Date.now()
 while(!await p.$(signature) && Date.now()-start<4000) await p.waitFor(100)
 if(!await p.$(signature)) throw Error('template unavailable '+signature)
 if(data) await p.setData(data)
 await p.waitFor(200)
 return p
}
async function bounds(selector, bottom = false, touch = false) {
 const r=(await rects([selector]))[0], d=result.device
 check(selector+' horizontal bounds', !!r && r.left>=-1 && r.right<=d.windowWidth+1, r)
 if(bottom) check(selector+' above safe bottom', !!r && (!touch || r.top>=-1) && r.bottom<=d.windowHeight-(d.screenHeight-d.safeArea.bottom)+1, r)
 if(touch) check(selector+' touch height', !!r && r.height>=44, r)
}
async function run(name, fn) {
 if(process.env.QA_CASE && !process.env.QA_CASE.split(',').includes(name))return;
 const item={name,checks:[]};result.cases.push(item)
 checks.length=0
 try{await fn();item.checks=[...checks]}catch(e){item.error=e.message;item.checks=[...checks];if(e.message==='timeout')throw e}
 save()
}
(async()=>{
 m=await auto.connect({wsEndpoint:process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9420'})
 result.device=await m.systemInfo()
 if(result.device.platform!=='devtools') throw Error('simulator only')
 m.on('exception',e=>{result.exceptions.push(e.message);save()})
 await m.evaluate(()=>{getApp().__layoutWrites=[]})
 await m.mockWxMethod('request',function(o){
  const path=o.url.replace(/^https?:\/\/[^/]+\/api/,'')
  if((o.method||'GET')!=='GET'){getApp().__layoutWrites.push(path);return {statusCode:403,data:{code:403,message:'禁止测试业务写入'}}}
  const ex={id:901,name:'模拟动作',image_url:'/images/muscle/leg.jpg',sets:3,reps:10,target_muscle:'模拟肌肉',difficulty:'简单'}
  let data=[]
  if(path==='/configs')data={site_name:'爸妈动起来'}
  else if(path.startsWith('/user/history')||path==='/exercises')data={list:[],total:0}
  else if(path.startsWith('/exercises/'))data=ex
  else if(/\/progress/.test(path))data={member_stats:[]}
  else if(/^\/goals\/\d+$/.test(path))data={id:902,name:'模拟目标',members:[],exercises:[{id:903,exercise_id:901,sets:3,reps:10,exercise:ex}]}
  return {statusCode:200,data:{code:0,data}}
 })
 await run('login',async()=>{
  const p=await page('/pages/login/login','.wechat-btn')
  await p.callMethod('wechatLogin');await p.waitFor(100)
  await m.pageScrollTo(99999)
  await bounds('.confirm-btn',true,true);await bounds('.nickname-input');await bounds('.privacy-section',true)
  const input=await p.$('.nickname-input');await input.input('模拟昵称')
  check('nickname input updates state',await p.data('wechatNickName')==='模拟昵称')
  await input.tap();await p.waitFor(100)
  result.keyboardObservation={softwareKeyboardNotReproduced:true,viewportHeight:await m.callWxMethod('getSystemInfoSync').then(x=>x.windowHeight),inputFocus:await input.property('focus')}
  await m.callWxMethod('hideKeyboard')
 })
 await run('profile edit',async()=>{
  const p=await page('/pages/profile-edit/profile-edit','.form-card',{userInfo:{nick_name:longName,gender:2,age:80,height:160,weight:60,health_status:longName.repeat(5)}})
  await bounds('.input');const caption=(await rects(['.textarea-item .label']))[0];check('health label uses available width without orphan line',caption.height<=48*result.device.windowWidth/750,caption);await bounds('.gender-picker');const picker=(await rects(['.picker']))[0],row=(await rects(['.form-item']))[0];check('gender picker aligns to field right',Math.abs(picker.right-row.right)<2,{picker,row});await bounds('.picker-text')
  await m.pageScrollTo(99999)
  await bounds('.btn-save',true,true);await bounds('.btn-cancel',true,true);await bounds('.textarea')
  const area=await p.$('.textarea');await area.input('模拟备注');check('textarea updates state',(await p.data('userInfo')).health_status==='模拟备注')
 })
 for(const type of ['join','create']) await run('family '+type,async()=>{
  const p=await page('/pages/family/join?type='+type,'.form-section')
  await m.pageScrollTo(99999);await bounds('.btn-submit',true,true);await bounds('.form-input')
  await(await p.$('.form-input')).input(type==='join'?'ABC123':'模拟家庭')
  check('family input updates state',await p.data(type==='join'?'inviteCode':'name')===(type==='join'?'ABC123':'模拟家庭'))
 })
 await run('goal detail',async()=>{
  const p=await page('/pages/goal/detail?id=902','.goal-header',{loading:false,loadError:'',goal:{id:902,name:longName.repeat(3),memberCount:2,exerciseCount:6,exercises:Array.from({length:6},(_,i)=>({id:903+i,sets:3,reps:10,exercise:ex}))},progress:{member_stats:[]},memberProgressList:[{user_id:901,user_name:longName.repeat(2),total_sets:18,completed_sets:0,progress_percent:0}]})
  await bounds('.goal-name');await bounds('.exercise-name');await bounds('.btn-start',false,true)
  await m.pageScrollTo(99999);await bounds('.member-name-small');await bounds('.member-progress-text');await bounds('.member-progress-item',true)
 })
 await run('workout',async()=>{
  const p=await page('/pages/goal/progress?goal_id=902&exercise='+encodeURIComponent(JSON.stringify({...ex,goal_exercise_id:903})),'.sets-list',{progressLoading:false,progressError:'',loading:false,submitted:false})
  await bounds('.exercise-image');await bounds('.exercise-name');await bounds('.btn-submit',true,true)
  await m.pageScrollTo(99999)
  const [allSets,button]=await m.evaluate(()=>new Promise(resolve=>{const q=wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0]);q.selectAll('.set-item').boundingClientRect();q.select('.submit-section').boundingClientRect();q.exec(resolve)}));const last=allSets.slice(-1)[0]
  check('last set above submit bar',last.bottom<=button.top+1,{last,button})
  for(const e of await p.$$('.set-item'))await e.trigger('tap')
  await p.waitFor(100);check('selection reaches 100%',await p.data('completedPercent')===100)
 })
 await run('exercise detail',async()=>{
  const p=await page('/pages/exercise/exercise?id=901','.cover-image',{loading:false,loadError:'',exercise:{...ex,targetMuscle:longName,description:longName.repeat(10),calories:1,image:'/images/muscle/leg.jpg'}})
  await bounds('.cover-image');await bounds('.exercise-name');await bounds('.difficulty-tag');await bounds('.info-value')
  await m.pageScrollTo(99999);await bounds('.description',true)
 })

 await run('create goal',async()=>{
  const p=await page('/pages/goal/create?family_id=901','.name-input',{members:[{user_id:901,user:{nick_name:longName},selected:true}],selectedMemberCount:1,selectedExercises:Array.from({length:6},(_,i)=>({exercise_id:901+i,name:longName,sets:3,reps:10}))})
  await bounds('.btn-submit',true,true)
  const fields=await p.$$('.config-input');await fields[0].input('4')
  check('set count input updates state',(await p.data('selectedExercises'))[0].sets===4)
  await m.pageScrollTo(99999)
  const [inputs,submit]=await m.evaluate(()=>new Promise(resolve=>{const q=wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0]);q.selectAll('.config-input').boundingClientRect();q.select('.submit-section').boundingClientRect();q.exec(resolve)}))
  check('all number inputs inside page',inputs.every(r=>r.left>=0&&r.right<=result.device.windowWidth),inputs)
  check('last input above submit',inputs.slice(-1)[0].bottom<=submit.top+1,{input:inputs.slice(-1)[0],submit})
 })
 await run('progress view',async()=>{
  const stats=[{goal_exercise_id:903,exercise_name:longName,target_sets:3,completed_sets:1,reps:10,status:'in_progress',color:'#3B82F6',segment_width:100,fill_width:33}]
  const p=await page('/pages/goal/progress?goal_id=902','.container',{exercise:null,progressLoading:false,progressError:'',myProgress:{completed_sets:1,total_sets:3,exercise_stats:stats,progress:33},otherProgress:[{user_id:904,user_name:longName.repeat(2),total_sets:3,completed_sets:1,exercise_stats:stats}]})
  await bounds('.control-btn',false,true);await bounds('.progress-control');await bounds('.member-name')
  await m.pageScrollTo(99999);await bounds('.member-progress-item',true)
 })
 await run('empty progress refresh',async()=>{
  const p=await page('/pages/goal/progress?goal_id=902','.progress-mode',{currentUserId:901,myProgress:{user_id:901,total_sets:3,completed_sets:1,exercise_stats:[]},otherProgress:[{user_id:902,user_name:'模拟旧成员',total_sets:3,completed_sets:1,exercise_stats:[]}]})
  await p.callMethod('loadProgress');await p.waitFor(200)
  check('empty refresh explicitly clears personal stats',(await p.data()).myProgress===null)
  check('empty refresh independent logic state is null',await m.evaluate(()=>getCurrentPages().slice(-1)[0].data.myProgress===null))
  check('empty refresh clears prior other members',(await p.data('otherProgress')).length===0)
  check('stale progress controls disappear',!await p.$('.overall-progress')&&!await p.$('.member-progress-item'))
 })
 await run('family detail',async()=>{
  const p=await page('/pages/family/family','.container',{loading:false,loadError:'',families:[{id:901,name:longName.repeat(2)}],family:{id:901,name:longName.repeat(2),invite_code:'ABC123'},members:[{id:901,user_id:901,role:'admin',user:{nick_name:longName}},{id:902,user_id:902,role:'member',user:{nick_name:longName}}],goals:[],isAdmin:true,currentUserId:901})
  await bounds('.family-name');await bounds('.invite-share',false,true);await bounds('.member-name')
  await m.pageScrollTo(99999);await bounds('.action-buttons .btn-secondary',true,true);await bounds('.action-buttons .btn-danger',true,true)
 })
 await run('history',async()=>{
  const p=await page('/pages/history/history','.container',{loading:false,total:6,hasMore:false,historyList:Array.from({length:6},(_,i)=>({goalId:901,date:'模拟日期'+i,goalName:longName,exercises:[{id:901,name:longName}],progress:33,progressSvg:''}))})
  await bounds('.history-goal-name');await bounds('.exercise-tag')
  await m.pageScrollTo(99999);await bounds('.no-more',true)
 })
 await run('goal list',async()=>{
  const p=await page('/pages/goal/goal','.container',{goals:Array.from({length:6},(_,i)=>({id:901+i,name:longName.repeat(3),memberCount:2,exerciseCount:6}))})
  await bounds('.goal-name');await bounds('.goal-arrow')
  await m.pageScrollTo(99999)
  const items=await m.evaluate(()=>new Promise(resolve=>wx.createSelectorQuery().in(getCurrentPages().slice(-1)[0]).selectAll('.goal-item').boundingClientRect().exec(r=>resolve(r[0]))))
  check('last goal card above safe bottom',items.slice(-1)[0].bottom<=result.device.windowHeight-(result.device.screenHeight-result.device.safeArea.bottom)+1,items.slice(-1)[0])
 })
 for(const name of ['agreement','privacy']) await run(name,async()=>{
  const p=await page('/pages/'+name+'/'+name,'.content')
  await bounds('.content');await m.pageScrollTo(99999);await bounds('.content',true)
 })
 await run('media viewer',async()=>{
  const p=await page('/pages/gif-viewer/gif-viewer?src='+encodeURIComponent('/images/muscle/leg.jpg')+'&title='+encodeURIComponent('模拟媒体展示'),'.gif-image')
  await bounds('.gif-image',true);await bounds('.tip-text',true)
  const media=(await rects(['.gif-image']))[0];check('media fits full viewport',media.top>=-1&&media.bottom<=result.device.windowHeight+1,media)
  check('media preserves full aspect',await(await p.$('.gif-image')).attribute('mode')==='aspectFit')
 })
 result.writes=await m.evaluate(()=>getApp().__layoutWrites)
 result.completed=result.cases.length>0&&result.cases.every(c=>!c.error&&c.checks.every(x=>x.pass))&&result.exceptions.length===0&&result.writes.length===0;save();if(!result.completed)process.exitCode=1
 console.log(JSON.stringify({device:{width:result.device.windowWidth,height:result.device.windowHeight},cases:result.cases.map(c=>({name:c.name,passed:c.checks.filter(x=>x.pass).length,failed:c.checks.filter(x=>!x.pass).map(x=>x.name),error:c.error})),exceptions:result.exceptions,writes:result.writes,keyboard:result.keyboardObservation}))
})().catch(e=>{result.error=e.message;save();console.error(e.message);process.exitCode=1}).finally(async()=>{if(m){await m.restoreWxMethod('request').catch(()=>{});await m.evaluate(()=>{delete getApp().__layoutWrites}).catch(()=>{});m.disconnect()}clearTimeout(timer)})
