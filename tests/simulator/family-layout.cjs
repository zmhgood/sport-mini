const auto=require(process.env.MINI_AUTOMATOR_PATH || 'miniprogram-automator');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.MINI_QA_OUTPUT || require('node:path').join(require('node:os').tmpdir(),'sport-mini-layout-qa'), label=process.argv[2]||'current';
fs.mkdirSync(out,{recursive:true});
let m;const result={label,scope:'Official original-project simulator; synthetic fixtures; requests mocked; no production writes',checks:[],exceptions:[]};
const save=()=>fs.writeFileSync(`${out}/layout-${label}.json`,JSON.stringify(result,null,2));
const timer=setTimeout(()=>{result.error='60 second test timeout';save();m?.disconnect();process.exit(2)},60000);
const check=(name,ok,detail)=>{result.checks.push({name,pass:!!ok,detail});save();assert(ok,name)};
(async()=>{m=await auto.connect({wsEndpoint:process.env.MINI_AUTOMATOR_ENDPOINT || 'ws://127.0.0.1:9420'});const info=await m.systemInfo();assert.equal(info.platform,'devtools');
result.device={width:info.windowWidth,height:info.windowHeight,screenHeight:info.screenHeight,safeBottom:info.screenHeight-info.safeArea.bottom,platform:info.platform,model:info.model,fontSize:info.fontSizeSetting};
m.on('exception',e=>result.exceptions.push(String(e.message||'runtime exception').slice(0,180)));
await m.evaluate(()=>{getApp().__familyLayoutWrites=[]});
await m.mockWxMethod('request',function(opts){if((opts.method||'GET')!=='GET'){getApp().__familyLayoutWrites.push(opts.url.replace(/^https?:\/\/[^/]+\/api/,''));return {statusCode:403,data:{code:403,message:'测试禁止写入'}}}return {statusCode:200,data:{code:0,data:opts.url.includes('/members')?[]:opts.url.includes('/exercises')?{list:[]}:[]}}});
let p=await m.currentPage();if(p.path!=='pages/index/index')p=await m.reLaunch('/pages/index/index');
const ready=Date.now();while(!await p.$('.header')&&Date.now()-ready<8000)await p.waitFor(100);check('home template ready',!!await p.$('.header'));
const rects=async selectors=>m.evaluate(sels=>new Promise(resolve=>{const q=wx.createSelectorQuery();for(const s of sels)q.select(s).boundingClientRect();q.exec(resolve)}),selectors);
const tabs=async()=>m.evaluate(()=>new Promise(resolve=>{const tab=getCurrentPages().slice(-1)[0].getTabBar();wx.createSelectorQuery().in(tab).select('.tab-bar').boundingClientRect().exec(rows=>resolve({bar:rows[0],hidden:tab.data.hidden,selected:tab.data.selected}));}));
for(const n of [1,12]){
const families=Array.from({length:n},(_,i)=>({id:901+i,name:i?'这是一个很长的家庭名称用于检查小屏换行与成员家庭切换 '+(i+1):'模拟家庭'}));
await p.setData({isLoggedIn:true,families,currentFamily:families[0]});await (await p.$('.family-switch')).trigger('tap');await p.waitFor(350);
let box; for(let i=0;i<80;i++){box=await rects(['.family-popup-content','.family-list','.join-family-btn']);if(box[0]&&box[0].bottom<=info.windowHeight+1)break;await p.waitFor(100)} const [sheet,list,button]=box;const tab=await tabs();
check(`family-${n}: navigation hidden`,tab.hidden===true&&(!tab.bar||tab.bar.height===0),tab);
check(`family-${n}: sheet fits viewport`,sheet.top>=0&&sheet.bottom<=info.windowHeight+1,sheet);
check(`family-${n}: join above home indicator`,button.top>=sheet.top&&button.bottom<=info.windowHeight-result.device.safeBottom+1,button);
check(`family-${n}: button touch height`,button.height>=44,button);
check(`family-${n}: list leaves footer space`,list.bottom<=button.top+1,list);
if(process.env.MINI_QA_SCREENSHOTS === '1')await m.screenshot({path:`${out}/family-${label}-${n}.png`});
if(n===12){const view=await p.$('.family-list');await view.scrollTo(0,9999);check('long list actually scrolls',await view.property('scrollTop')>0,await view.property('scrollTop'));const after=(await rects(['.join-family-btn']))[0];check('long list keeps join button fixed',Math.abs(after.top-button.top)<1,after)}
await (await p.$('.family-popup-close')).trigger('tap');check(`family-${n}: closing restores navigation`,!!(await tabs()).bar);
}
result.navigationSkipped='SDK navigateBack is unreliable; verify visible return through DevTools native menu separately';
result.writes=await m.evaluate(()=>getApp().__familyLayoutWrites);check('no business writes',result.writes.length===0);check('no runtime exceptions',result.exceptions.length===0);result.completed=true;save();console.log(JSON.stringify({device:result.device,checks:result.checks.length,passed:result.checks.filter(x=>x.pass).length,exceptions:result.exceptions}));
})().catch(e=>{result.error=e.message;save();console.error(e.message);process.exitCode=1}).finally(async()=>{if(m){await m.restoreWxMethod('request').catch(()=>{});await m.evaluate(()=>{delete getApp().__familyLayoutWrites}).catch(()=>{});m.disconnect()}clearTimeout(timer)});
