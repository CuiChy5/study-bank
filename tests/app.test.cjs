const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../docs/app.js'),'utf8');
function app(config={}){
 const elements=new Map(),storage=new Map();
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',innerHTML:'',hidden:false,classList:{toggle(){},add(){},remove(){}},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(selector);};
 const context=vm.createContext({window:{STUDY_CONFIG:config,addEventListener(){}},document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){},hidden:false},location:{hash:'',href:'http://localhost/'},history:{replaceState(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL,Date,console,structuredClone,setTimeout:()=>0,clearTimeout(){},setInterval(){},crypto:require('node:crypto').webcrypto});
 context.fetch=()=>new Promise(()=>{});
 vm.runInContext(source,context);return {run:s=>vm.runInContext(s,context),element,context};
}
test('weighted totals combine manual history and per-student cumulative records once',()=>{
 const a=app();a.run("state.questions=[{id:'q1',base_attempts:10,base_errors:2}];state.records=[{question_id:'q1',attempts:2,errors:1},{question_id:'other',attempts:100,errors:100}]");
 assert.equal(a.run('metrics(state.questions[0]).attempts'),12);
 assert.equal(a.run('metrics(state.questions[0]).errors'),3);
 assert.equal(a.run('pct(metrics(state.questions[0]).errors,metrics(state.questions[0]).attempts)'),25);
 assert.equal(a.run('pct(0,0)'),0);
});
test('student mode does not render management actions or individual records',()=>{
 const a=app();assert.equal(a.element('#add').hidden,true);
 assert.ok(!a.element('#content').innerHTML.includes('data-edit='));
 a.run("state.records=[{student_label:'PRIVATE-S001'}];renderStudents()");
 assert.ok(!a.element('#content').innerHTML.includes('PRIVATE-S001'));
 assert.match(a.element('#content').innerHTML,/个人学情仅教师可见/);
 assert.throws(()=>a.run('editQuestion()'),/请先登录教师账号/);
});
test('search, chapter, difficulty and error sorting work together',()=>{
 const a=app();a.run("state.questions=[{id:'a',content:'集合问题',chapter:'一',section:'1',subject:'数学',difficulty:2,base_attempts:10,base_errors:2},{id:'b',content:'集合问题二',chapter:'一',section:'2',subject:'数学',difficulty:2,base_attempts:4,base_errors:3},{id:'c',content:'其他',chapter:'二',section:'1',subject:'数学',difficulty:1,base_attempts:1,base_errors:0}];state.search='集合';state.chapter='一';state.level='2';state.sort='error'");
 assert.equal(a.run("filtered().map(q=>q.id).join(',')"),'b,a');
 a.run("state.search='不存在'");assert.equal(a.run('filtered().length'),0);
});
test('public question content and image URLs cannot inject markup or javascript',()=>{
 const a=app();assert.equal(a.run("safeImage('javascript:alert(1)')"),'');
 assert.equal(a.run("safeImage('data:image/svg+xml,<svg onload=alert(1)>')"),'');
 const card=a.run("questionCard({id:'q',content:'<img src=x onerror=alert(1)>',chapter:'一',section:'1',difficulty:1,images:[],created_at:'2026-11-10'})");
 assert.ok(card.includes('&lt;img'));assert.ok(!card.includes('<img src=x'));
});
test('live mode uses server aggregates without counting private rows twice',()=>{
 const a=app({url:'https://example.supabase.co',key:'public'});
 a.run("state.records=[{question_id:'q',attempts:2,errors:1}]");
 assert.equal(a.run("metrics({id:'q',attempts:12,errors:3,base_attempts:10}).attempts"),12);
});
test('API request uses teacher bearer token and rejects non-OK responses',async()=>{
 const a=app({url:'https://example.supabase.co',key:'public'});let request;
 a.context.fetch=async(url,options)=>{request={url,options};return {ok:false,status:403,text:async()=>JSON.stringify({message:'permission denied'})};};
 a.run("state.session={access_token:'test-teacher-token',expires_at:Date.now()/1000+3600}");
 await assert.rejects(a.run("api('/rest/v1/questions',{method:'POST',body:{content:'test'}})"),/permission denied/);
 assert.equal(request.options.headers.Authorization,'Bearer test-teacher-token');
 assert.equal(request.options.headers.apikey,'public');
});
