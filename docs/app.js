'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfg = window.STUDY_CONFIG || {};
const live = Boolean(cfg.url && cfg.key);
const state = { page:'questions', questions:[], records:[], teacher:false, session:null, search:'', chapter:'', level:'', sort:'new', busy:false, lastSync:null };
const DEMO_KEY = 'zhixu-demo-v1';
const LEVELS = ['','基础','巩固','提升','挑战','综合'];
const demoQuestions = [
 {id:'demo-1',chapter:'第一章 · 集合与逻辑',section:'1.1 集合的概念',subject:'数学 · 示例',content:'已知集合 A = {x | −2 ≤ x < 3}，B = {x | 0 < x ≤ 5}。\n求 A ∩ B，并在数轴上表示结果。',answer:'A ∩ B = {x | 0 < x < 3}。注意两个端点均不包含。',difficulty:2,base_attempts:24,base_errors:7,images:[],created_at:'2026-11-10T00:00:00Z'},
 {id:'demo-2',chapter:'第一章 · 集合与逻辑',section:'1.2 常用逻辑用语',subject:'数学 · 示例',content:'写出命题“所有实数的平方都是正数”的否定，并判断原命题的真假。',answer:'否定：存在一个实数，它的平方不是正数。原命题为假，反例为 0。',difficulty:1,base_attempts:30,base_errors:4,images:[],created_at:'2026-11-09T00:00:00Z'},
 {id:'demo-3',chapter:'第二章 · 函数',section:'2.1 函数的概念',subject:'数学 · 示例',content:'函数 f(x) = √(x + 1) / (x − 2) 的定义域是什么？\n请写出推导过程。',answer:'根号内要求 x ≥ −1；分母要求 x ≠ 2。因此定义域为 [−1, 2) ∪ (2, +∞)。',difficulty:3,base_attempts:20,base_errors:9,images:[],created_at:'2026-11-08T00:00:00Z'}
];
const total = q => ({ attempts:Number(q.base_attempts||0) + state.records.filter(r=>r.question_id===q.id).reduce((n,r)=>n+r.attempts,0), errors:Number(q.base_errors||0) + state.records.filter(r=>r.question_id===q.id).reduce((n,r)=>n+r.errors,0) });
const metrics = q => live ? {attempts:Number(q.attempts||0),errors:Number(q.errors||0)} : total(q);
const pct = (e,a) => a ? Math.round(e / a * 100) : 0;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function fail(error){console.error(error);toast(error.message || '操作失败，请重试');}
function saveDemo(){localStorage.setItem(DEMO_KEY,JSON.stringify({questions:state.questions,records:state.records}));}
async function api(path,{method='GET',body,raw=false}={}){
 if(state.session && state.session.expires_at < Date.now()/1000+60){
  const res=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:state.session.refresh_token})});
  if(!res.ok){state.session=null;state.teacher=false;state.records=[];render();throw Error('登录已过期，请重新登录');}
  const token=await res.json();state.session={...token,expires_at:Date.now()/1000+token.expires_in};
 }
 const headers={apikey:cfg.key};
 if(state.session?.access_token)headers.Authorization='Bearer '+state.session.access_token;
 if(!raw)headers['Content-Type']='application/json';
 if(path.startsWith('/rest/'))headers.Prefer='return=representation';
 const res=await fetch(cfg.url.replace(/\/$/,'')+path,{method,headers,body:body===undefined?undefined:raw?body:JSON.stringify(body)});
 const text=await res.text();let data;try{data=text?JSON.parse(text):null;}catch{data=null;}
 if(!res.ok)throw Error(data?.message||data?.error_description||data?.msg||'服务器请求失败（'+res.status+'）');
 return data;
}
async function load(quiet=false){
 if(state.busy)return;state.busy=true;
 try{
  if(live){const questions=await api('/rest/v1/question_public?select=*&order=created_at.desc');let records=[];if(state.teacher)records=await api('/rest/v1/student_records?select=*&order=student_label.asc');state.questions=questions;state.records=records;}
  else {const raw=localStorage.getItem(DEMO_KEY);if(raw){const data=JSON.parse(raw);state.questions=data.questions;state.records=data.records;}else{state.questions=structuredClone(demoQuestions);state.records=[];}}
  state.lastSync=new Date();$('#connection').textContent=live?'已同步 · '+state.lastSync.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'本地演示';$('#connection').classList.toggle('live',live);render();
 }catch(e){$('#connection').textContent='同步失败';if(!quiet)fail(e);$('#notice').textContent='数据同步失败，请检查网络及数据库配置。当前页面可能不是最新数据。';}finally{state.busy=false;}
}
function render(){
 const teacher=state.teacher;
 $('#notice').textContent=live?'公开题库已连接云端 · 每 10 秒自动刷新 · 教师登录后可维护内容和查看个人学情。':'演示模式：所有题目与数据均为示例，只保存在此浏览器，不会同步给学生。连接数据库后可正式使用。';
 $('#account').innerHTML=teacher?'◉ <span>'+(live?'教师已登录':'教师演示中')+'<small>点击退出管理</small></span>':'◉ <span>教师入口<small>登录后维护题库与学情</small></span>';
 $('#add').hidden=!teacher;
 const titles={questions:['章节题库','每一小节，都有收获。','整理学过的题目，找到值得再练一次的知识。'],overview:['复习概览','看见进步，找到方向。','从完成次数和错误率，发现下一次复习的重点。'],students:['学生学情','关注每一位学生的进展。','个人记录仅教师可见；公开页面只显示题目汇总。']};
 const t=titles[state.page];$('#crumb').textContent=t[0];$('#heading').textContent=t[1];$('#subtitle').textContent=t[2];
 document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===state.page));
 const sums=state.questions.reduce((a,q)=>{const m=metrics(q);return {attempts:a.attempts+m.attempts,errors:a.errors+m.errors};},{attempts:0,errors:0});
 const sections=new Set(state.questions.map(q=>q.chapter+' / '+q.section)).size;
 $('#stats').innerHTML=[['题库总量',state.questions.length,'道','每一道题，都是一次积累'],['已整理小节',sections,'节','按章节，建立知识脉络'],['累计完成',sums.attempts,'次','逐人记录与全班补录的合计'],['整体错误率',sums.attempts?pct(sums.errors,sums.attempts):'—',sums.attempts?'%':'','错误次数 ÷ 完成次数']].map(([l,n,u,note])=>`<div class="stat"><div class="stat-label">${l}</div><div class="stat-number">${n}<small>${u}</small></div><div class="stat-note">${note}</div></div>`).join('');
 if(state.page==='questions')renderQuestions();else if(state.page==='overview')renderOverview();else renderStudents();
}
function filtered(){
 let qs=state.questions.filter(q=>(!state.chapter||q.chapter===state.chapter)&&(!state.level||q.difficulty===Number(state.level))&&(!state.search||[q.content,q.chapter,q.section,q.subject].join(' ').toLowerCase().includes(state.search.toLowerCase())));
 return qs.sort((a,b)=>state.sort==='error'?pct(metrics(b).errors,metrics(b).attempts)-pct(metrics(a).errors,metrics(a).attempts):state.sort==='level'?b.difficulty-a.difficulty:String(b.created_at).localeCompare(String(a.created_at)));
}
function renderQuestions(){
 const qs=filtered();const chapters=[...new Set(state.questions.map(q=>q.chapter))];
 $('#content').innerHTML=`<div class="toolbar"><div class="section-title">全部题目 <small>${qs.length} 道题目</small></div><input id="search" class="search" placeholder="搜索题目、章节或知识点…" aria-label="搜索题目" value="${esc(state.search)}"></div><div class="filters"><select id="chapter" aria-label="章节"><option value="">全部章节</option>${chapters.map(c=>`<option ${state.chapter===c?'selected':''}>${esc(c)}</option>`).join('')}</select><select id="level" aria-label="难度"><option value="">全部难度</option>${LEVELS.slice(1).map((l,i)=>`<option value="${i+1}" ${state.level===String(i+1)?'selected':''}>${i+1} 级 · ${l}</option>`).join('')}</select><select id="sort" aria-label="排序"><option value="new">最近添加</option><option value="error" ${state.sort==='error'?'selected':''}>错误率从高到低</option><option value="level" ${state.sort==='level'?'selected':''}>难度从高到低</option></select></div><div id="questionList">${qs.length?qs.map(questionCard).join(''):'<div class="empty"><b>还没有符合条件的题目</b>试试其他关键词，或由教师添加第一道题。</div>'}</div>`;
 $('#search').oninput=e=>{state.search=e.target.value;const qs=filtered();$('#questionList').innerHTML=qs.length?qs.map(questionCard).join(''):'<div class="empty">没有匹配的题目</div>';$('.section-title small').textContent=qs.length+' 道题目';};
 ['chapter','level','sort'].forEach(id=>$('#'+id).onchange=e=>{state[id]=e.target.value;renderQuestions();});
}
function safeImage(src){try{const u=new URL(src,location.href);return (u.protocol==='https:' || (!live && /^data:image\/(png|jpeg|webp|gif);base64,/.test(src)))?esc(src):'';}catch{return '';}}
function questionCard(q){const m=metrics(q),p=pct(m.errors,m.attempts);return `<article class="question"><div><div class="q-top"><span class="badge">${esc(q.subject||'通用')}</span><span>${esc(q.chapter)} / ${esc(q.section)}</span><span class="badge level-${q.difficulty}">${q.difficulty} 级 · ${LEVELS[q.difficulty]}</span></div><h3>${esc(q.content)}</h3><div class="question-images">${(q.images||[]).map((src,i)=>{const safe=safeImage(src);return safe?`<a href="${safe}" target="_blank" rel="noopener"><img src="${safe}" alt="题目配图 ${i+1}" loading="lazy"></a>`:'';}).join('')}</div>${q.answer?`<details><summary>查看答案与解析</summary><p>${esc(q.answer)}</p></details>`:''}<div class="q-meta">${esc(q.created_at.slice(0,10))} 添加</div></div><div class="q-side"><div><div class="q-numbers"><div><strong>${m.attempts}</strong><small>完成次数</small></div><div><strong>${m.attempts?p+'%':'—'}</strong><small>错误率</small></div></div><div class="bar"><i style="width:${p}%"></i></div><small class="muted">${m.errors} 次错误 / ${m.attempts} 次完成</small></div>${state.teacher?`<div class="actions"><button data-edit="${esc(q.id)}">编辑题目</button><button data-record="${esc(q.id)}">记录学情</button></div>`:''}</div></article>`;}
function renderOverview(){
 const chapters=[...new Set(state.questions.map(q=>q.chapter))];
 const rows=chapters.map(ch=>{const qs=state.questions.filter(q=>q.chapter===ch);const a=qs.reduce((n,q)=>n+metrics(q).attempts,0),e=qs.reduce((n,q)=>n+metrics(q).errors,0);return `<div class="chapter-row"><div>${esc(ch)}<br><small class="muted">${qs.length} 道题 · ${a} 次完成</small></div><div class="bar"><i style="width:${pct(e,a)}%"></i></div><span>${a?pct(e,a)+'%':'暂无记录'}</span></div>`;}).join('');
 const hard=state.questions.filter(q=>metrics(q).attempts>0).sort((a,b)=>pct(metrics(b).errors,metrics(b).attempts)-pct(metrics(a).errors,metrics(a).attempts)).slice(0,5);
 $('#content').innerHTML=`<div class="panel"><h2>章节错误率</h2><p class="muted">优先复习错误率较高的章节；样本次数较少时，数据仅供参考。</p>${rows||'<p>添加题目后，这里会展示章节统计。</p>'}</div><div class="toolbar"><div class="section-title">值得再练一次 <small>按错误率排序 · 最多 5 道</small></div></div>${hard.map(questionCard).join('')||'<div class="empty">还没有完成记录</div>'}`;
}
function renderStudents(){
 if(!state.teacher){$('#content').innerHTML='<div class="empty"><b>个人学情仅教师可见</b><p>学生可以在章节题库中查看题目和全班汇总。</p><button class="primary" data-login>教师登录</button></div>';return;}
 $('#content').innerHTML=`<div class="toolbar"><div class="section-title">个人学习记录 <small>${state.records.length} 条</small></div><button class="secondary" id="export">导出学情 CSV</button></div><div class="hint">使用学号或化名。每条记录保存该学生在该题上的累计次数；同一学生请保持编号一致。此处记录会自动计入公开题目汇总，勿再重复补录。</div><div class="panel table-wrap"><table><thead><tr><th>学生编号 / 化名</th><th>小节 / 题目</th><th>完成次数</th><th>错误次数</th><th>错误率</th><th>操作</th></tr></thead><tbody>${state.records.map(r=>{const q=state.questions.find(q=>q.id===r.question_id);return `<tr><td>${esc(r.student_label)}</td><td>${esc(q?.section||'题目已移除')}<br><small class="muted">${esc(q?.content.slice(0,35))}</small></td><td>${r.attempts}</td><td>${r.errors}</td><td>${r.attempts?pct(r.errors,r.attempts)+'%':'—'}</td><td><button data-record="${esc(r.question_id)}" data-student="${esc(r.student_label)}">修改</button></td></tr>`;}).join('')||'<tr><td colspan="6">暂无记录。请在题目卡片上点击“记录学情”。</td></tr>'}</tbody></table></div>`;
 $('#export').onclick=()=>{const rows=[['学生编号','题目','完成次数','错误次数','错误率'],...state.records.map(r=>[r.student_label,state.questions.find(q=>q.id===r.question_id)?.content||'',r.attempts,r.errors,r.attempts?pct(r.errors,r.attempts)+'%':''])];const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');download(csv,'学情记录.csv','text/csv;charset=utf-8');};
}
function download(text,name,type){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function modal(title,body){$('#dialogContent').innerHTML=`<div class="modal-head"><h2>${title}</h2><button data-close aria-label="关闭">✕</button></div><div class="modal-body">${body}</div>`;if(!$('#dialog').open)$('#dialog').showModal();}
function errorInModal(e){const el=$('#formError');if(el)el.textContent=e.message||String(e);else fail(e);}
function requireTeacher(){if(!state.teacher)throw Error('请先登录教师账号');}
async function login(){
 if(state.teacher){modal('退出管理','<p>退出后恢复学生浏览模式。</p><button class="primary" id="logout">退出登录</button>');$('#logout').onclick=async()=>{try{if(live)await api('/auth/v1/logout',{method:'POST'});}catch(e){console.error(e);}finally{state.session=null;state.teacher=false;state.records=[];$('#dialog').close();await load();}};return;}
 if(!live){state.teacher=true;render();toast('已进入教师演示，数据仅保存在本机');return;}
 modal('教师登录','<p>仅管理员授权的教师账号可以维护数据。学生浏览题库无需登录。</p><form id="loginForm"><label class="field">邮箱<input name="email" type="email" autocomplete="username" required></label><label class="field">密码<input name="password" type="password" autocomplete="current-password" required></label><div id="formError" class="error" role="alert"></div><div class="modal-actions"><button class="primary" type="submit">登录</button></div></form>');
 $('#loginForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const fd=new FormData(e.target);const token=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email:fd.get('email'),password:fd.get('password')}});state.session={...token,expires_at:Date.now()/1000+token.expires_in};const teacher=await api('/rest/v1/rpc/is_teacher',{method:'POST',body:{}});if(!teacher){state.session=null;throw Error('此账号尚未获得教师权限，请联系管理员。');}state.teacher=true;$('#dialog').close();await load();toast('登录成功');}catch(err){errorInModal(err);}finally{button.disabled=false;}};
}
function editQuestion(id){
 requireTeacher();const q=state.questions.find(q=>q.id===id);let images=[...(q?.images||[])];let pending=[];
 modal(q?'编辑题目':'添加一道复习题',`<form id="questionForm"><div class="form-grid"><label class="field">学科 / 年级<input name="subject" maxlength="80" value="${esc(q?.subject||'')}" placeholder="例如：高一数学"></label><label class="field">难度等级<select name="difficulty">${LEVELS.slice(1).map((l,i)=>`<option value="${i+1}" ${q?.difficulty===i+1?'selected':''}>${i+1} 级 · ${l}</option>`).join('')}</select></label><label class="field">章节<input name="chapter" maxlength="100" required value="${esc(q?.chapter||'')}" placeholder="例如：第一章 · 集合"></label><label class="field">小节<input name="section" maxlength="100" required value="${esc(q?.section||'')}" placeholder="例如：1.1 集合的概念"></label><label class="field full">题目文字<textarea name="content" maxlength="20000" placeholder="输入题干，也可以仅上传题目图片…">${esc(q?.content||'')}</textarea></label><label class="field full">题目图片 <small>最多 6 张，每张不超过 3 MB；支持 PNG / JPG / WebP / GIF。</small><input id="imageFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple></label><div id="imagePreview" class="image-preview full"></div><label class="field full">答案与解析（可选，公开可查看）<textarea name="answer" maxlength="20000">${esc(q?.answer||'')}</textarea></label><label class="field">全班补录：完成次数<input name="base_attempts" type="number" min="0" max="1000000" step="1" value="${q?.base_attempts||0}" required></label><label class="field">全班补录：错误次数<input name="base_errors" type="number" min="0" max="1000000" step="1" value="${q?.base_errors||0}" required></label></div><div class="hint">错误率自动计算。全班补录用于未逐人登记的历史数据；个人学情记录会额外计入汇总，请勿重复输入。</div><div id="formError" class="error" role="alert"></div><div class="modal-actions">${q?'<button type="button" class="secondary danger" id="deleteQuestion">删除题目</button>':''}<button type="button" class="secondary" data-close>取消</button><button class="primary" type="submit">${live?'保存并公开':'保存到本地演示'}</button></div></form>`);
 function previews(){ $('#imagePreview').innerHTML=images.map((s,i)=>`<figure><img src="${safeImage(s)}" alt="配图 ${i+1}"><button type="button" data-remove-image="${i}">移除</button></figure>`).join('')+pending.map((f,i)=>`<figure><span class="badge">${esc(f.name)}</span><button type="button" data-remove-pending="${i}">移除</button></figure>`).join('');}
 previews();$('#imagePreview').onclick=e=>{if(e.target.dataset.removeImage!==undefined)images.splice(Number(e.target.dataset.removeImage),1);if(e.target.dataset.removePending!==undefined)pending.splice(Number(e.target.dataset.removePending),1);previews();};
 $('#imageFiles').onchange=e=>{try{const files=[...e.target.files];if(images.length+pending.length+files.length>6)throw Error('每题最多 6 张图片');if(files.some(f=>f.size>3*1024*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(f.type)))throw Error('请上传 3 MB 以内的 PNG、JPG、WebP 或 GIF 图片');pending.push(...files);previews();$('#formError').textContent='';}catch(err){errorInModal(err);}e.target.value='';};
 if(q)$('#deleteQuestion').onclick=()=>{modal('删除这道题目？','<p>同时删除该题关联的个人学情记录。此操作无法撤销。</p><div id="formError" class="error"></div><div class="modal-actions"><button class="secondary" data-close>取消</button><button id="confirmDelete" class="primary">确认删除</button></div>');$('#confirmDelete').onclick=async e=>{e.target.disabled=true;try{if(live)await api('/rest/v1/questions?id=eq.'+encodeURIComponent(q.id),{method:'DELETE'});else{state.questions=state.questions.filter(v=>v.id!==q.id);state.records=state.records.filter(r=>r.question_id!==q.id);saveDemo();}$('#dialog').close();await load();toast('题目已删除');}catch(err){errorInModal(err);e.target.disabled=false;}};};
 $('#questionForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;const uploaded=[];try{
  const fd=new FormData(e.target),data=Object.fromEntries(fd);['difficulty','base_attempts','base_errors'].forEach(k=>data[k]=Number(data[k]));['chapter','section','subject','content','answer'].forEach(k=>data[k]=data[k].trim());
  if(!data.chapter||!data.section)throw Error('请填写章节和小节');if(!data.content&&!images.length&&!pending.length)throw Error('请至少填写题目文字或上传图片');if(data.base_errors>data.base_attempts)throw Error('错误次数不能超过完成次数');
  const newImages=[];
  for(const file of pending){if(live){const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[file.type];const path=crypto.randomUUID()+'.'+extension;await api('/storage/v1/object/question-images/'+path,{method:'POST',body:file,raw:true});uploaded.push(path);newImages.push(cfg.url.replace(/\/$/,'')+'/storage/v1/object/public/question-images/'+path);}else newImages.push(await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file);}));}
  data.images=[...images,...newImages];
  if(live){if(q){const updated=await api('/rest/v1/questions?id=eq.'+encodeURIComponent(q.id)+'&updated_at=eq.'+encodeURIComponent(q.updated_at),{method:'PATCH',body:data});if(!updated.length)throw Error('题目已被其他窗口修改，请关闭后刷新再编辑');}else await api('/rest/v1/questions',{method:'POST',body:data});}
  else {const previous=structuredClone(state.questions);if(q)Object.assign(q,data);else state.questions.unshift({...data,id:crypto.randomUUID(),created_at:new Date().toISOString()});try{saveDemo();}catch{state.questions=previous;throw Error('浏览器存储空间不足，请减少图片或连接正式数据库');}}
  $('#dialog').close();await load();toast('题目已保存');
 }catch(err){errorInModal(err);}finally{button.disabled=false;}};
}
function editRecord(questionId,label=''){
 requireTeacher();const q=state.questions.find(q=>q.id===questionId);if(!q)return;const r=state.records.find(r=>r.question_id===questionId&&r.student_label===label);
 modal('记录学生学情',`<p>${esc(q.section)} · ${esc(q.content.slice(0,70)||'图片题目')}</p><form id="recordForm"><label class="field">学生编号 / 化名<input name="student_label" value="${esc(label)}" maxlength="60" required ${r?'readonly':''} placeholder="例如：S001"></label><div class="form-grid"><label class="field">累计完成次数<input name="attempts" type="number" min="0" max="1000000" step="1" value="${r?.attempts||0}" required></label><label class="field">累计错误次数<input name="errors" type="number" min="0" max="1000000" step="1" value="${r?.errors||0}" required></label></div><div class="hint">输入累计值而非本次增量。错误次数 ≤ 完成次数。保存后会自动更新题目汇总。</div><div id="formError" class="error" role="alert"></div><div class="modal-actions"><button type="button" class="secondary" data-close>取消</button><button class="primary" type="submit">保存记录</button></div></form>`);
 $('#recordForm').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{const fd=new FormData(e.target),data={question_id:questionId,student_label:fd.get('student_label').trim(),attempts:Number(fd.get('attempts')),errors:Number(fd.get('errors'))};if(!data.student_label)throw Error('请输入学生编号');if(data.errors>data.attempts)throw Error('错误次数不能超过完成次数');if(live){const existing=state.records.find(x=>x.question_id===questionId&&x.student_label===data.student_label);if(existing){const result=await api('/rest/v1/student_records?id=eq.'+encodeURIComponent(existing.id)+'&updated_at=eq.'+encodeURIComponent(existing.updated_at),{method:'PATCH',body:data});if(!result.length)throw Error('记录已被修改，请刷新后重试');}else await api('/rest/v1/student_records',{method:'POST',body:data});}else{const previous=structuredClone(state.records);const existing=state.records.find(x=>x.question_id===questionId&&x.student_label===data.student_label);if(existing)Object.assign(existing,data);else state.records.push({...data,id:crypto.randomUUID()});try{saveDemo();}catch{state.records=previous;throw Error('浏览器存储失败');}}$('#dialog').close();await load();toast('学情已更新');}catch(err){errorInModal(err);}finally{e.submitter.disabled=false;}};
}
function settings(){modal('从演示到正式题库',`<p>${live?'已配置云端连接。':'当前尚未配置数据库，数据仅保存在此浏览器。'}</p><ol><li>将项目上传到你的 GitHub 仓库，启用 Pages。</li><li>创建 Supabase 项目，在 SQL Editor 执行项目内的 <b>supabase/schema.sql</b>。</li><li>在 Authentication 创建教师账号，按说明添加教师权限。</li><li>在 site/config.js 填写项目 URL 和公开 publishable / anon key 后重新部署。</li></ol><div class="hint">公开题目及图片对所有访问者可见；个人学情由数据库权限保护，仅授权教师可读写。不要把 service_role 密钥或学生名单提交到 GitHub。</div><p>详细步骤见项目 README.md。正式连接后每 10 秒刷新；页面隐藏时暂停，返回后立即刷新。</p>${!live?'<div class="modal-actions"><button class="secondary" id="backupDemo">导出演示备份</button></div>':''}`);if(!live)$('#backupDemo').onclick=()=>download(JSON.stringify({questions:state.questions,records:state.records},null,2),'演示备份.json','application/json');}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.nav){state.page=b.dataset.nav;history.replaceState(null,'','#'+state.page);render();}if(b.hasAttribute('data-close'))$('#dialog').close();if(b.hasAttribute('data-login'))login();if(b.dataset.edit)editQuestion(b.dataset.edit);if(b.dataset.record)editRecord(b.dataset.record,b.dataset.student||'');}catch(err){fail(err);}});
$('#account').onclick=login;$('#add').onclick=()=>editQuestion();$('#settings').onclick=settings;$('#refresh').onclick=()=>load();
if(['questions','overview','students'].includes(location.hash.slice(1)))state.page=location.hash.slice(1);
if(cfg.title)document.title=cfg.title;
load();setInterval(()=>{if(live&&!document.hidden)load(true);},10000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true);});
window.addEventListener('storage',e=>{if(!live&&e.key===DEMO_KEY)load(true);});
