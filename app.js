(function(){
'use strict';
/* ---------------- ছোট সহায়ক ---------------- */
const BN = '০১২৩৪৫৬৭৮৯';
const bn = v => String(v).replace(/\d/g, d => BN[d]);
const en = v => String(v ?? '').replace(/[০-৯]/g, d => BN.indexOf(d));
const MONTHS = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
const DAYS = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const num = v => { const n = parseFloat(en(v)); return isNaN(n) ? 0 : n; };
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2,'0');

function fmtDate(iso){ if(!iso) return ''; const [y,m,d] = iso.split('-'); return bn(`${d}.${m}.${y}`); }
function dayName(iso){ if(!iso) return ''; const [y,m,d] = iso.split('-').map(Number); return DAYS[new Date(y,m-1,d).getDay()]; }
function tl(t){
  if(!t) return '....';
  const [h,m] = t.split(':').map(Number);
  const part = h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : 'সন্ধ্যা';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${part} ${bn(h12)}.${bn(pad(m))}`;
}

/* ---------------- ডিফল্ট ---------------- */
const DEFAULT_SETTINGS = {
  name:'', designation:'', office:'', hq:'', supervisor:'', vehicle:'অফিসিয়াল গাড়ি',
  dep:'10:10', arr:'10:40', move:'13:00', ret:'17:20', blocksPerTrip:'2', diaryLayout:'columns',
  defaultPurpose:'প্রদর্শনী পর্যবেক্ষণ, মাঠ পরিদর্শন ও কৃষকদের পরামর্শ প্রদান',
  abbrText:'উপজেলা কৃষি অফিস = উ.কৃ.অফি.\nইউনিয়ন = ইউনি.',
  purposeList:['প্রদর্শনী পর্যবেক্ষণ','মাঠ পরিদর্শন','কৃষকদের পরামর্শ প্রদান','উঠান বৈঠক পরিচালনা','সার ও কীটনাশকের দোকান পরিদর্শন','এসএএও-এর কার্যক্রম তদারকি','বালাই পরিস্থিতি পর্যবেক্ষণ'],
  blocks:[], recurring:[],
  activities:[
    'প্রদর্শনীর সার্বিক অবস্থা ও অন্যান্য কার্যক্রম পর্যবেক্ষণ',
    'বীজতলা স্থাপন ও অন্যান্য কার্যক্রম পর্যবেক্ষণ',
    'প্রদর্শনী, রবি ফসলের মাঠ এবং সার ও কীটনাশকের দোকান পরিদর্শন',
    'প্রদর্শনী, রোপা আমন শস্য কর্তন এবং সার ও কীটনাশকের দোকান পরিদর্শন',
    'ক্ষতিকর পোকামাকড় দমনের জন্য আলোর ফাঁদ স্থাপনের পরামর্শ প্রদান'
  ],
  projects:['পার্টনার','রাজস্ব']
};

/* ---------------- স্টোরেজ: Supabase বা ডেমো ---------------- */
const CFG = window.APP_CONFIG || {};
const CLOUD = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
const sb = CLOUD ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
let USER = null;

const Store = {
  async getProfile(){
    if(!CLOUD) return lsGet('profile');
    const {data, error} = await sb.from('profiles').select('data').eq('user_id', USER.id).maybeSingle();
    if(error) throw error; return data ? data.data : null;
  },
  async saveProfile(d){
    if(!CLOUD) return lsSet('profile', d);
    const {error} = await sb.from('profiles').upsert({user_id:USER.id, data:d, updated_at:new Date().toISOString()});
    if(error) throw error;
  },
  async getMonth(ym){
    if(!CLOUD) return lsGet('m-'+ym);
    const {data, error} = await sb.from('tour_months').select('data').eq('user_id', USER.id).eq('ym', ym).maybeSingle();
    if(error) throw error; return data ? data.data : null;
  },
  async saveMonth(ym, d){
    if(!CLOUD){ lsSet('m-'+ym, d); const idx = lsGet('months') || {}; idx[ym] = new Date().toISOString(); return lsSet('months', idx); }
    const {error} = await sb.from('tour_months').upsert({user_id:USER.id, ym, data:d, updated_at:new Date().toISOString()});
    if(error) throw error;
  },
  async myUpazila(){
    const {data:m, error} = await sb.from('upazila_members').select('upazila_id,role').eq('user_id', USER.id).maybeSingle();
    if(error) throw error; if(!m) return null;
    const {data:u, error:e2} = await sb.from('upazilas').select('id,district,name,data').eq('id', m.upazila_id).maybeSingle();
    if(e2) throw e2; return u ? Object.assign(u, {role:m.role}) : null;
  },
  async saveUpazila(id, d){
    const {error} = await sb.from('upazilas').update({data:d, updated_at:new Date().toISOString()}).eq('id', id);
    if(error) throw error;
  },
  async rpc(fn, args){ const {data, error} = await sb.rpc(fn, args || {}); if(error) throw error; return data; },
  async listMonths(){
    if(!CLOUD){ const idx = lsGet('months') || {}; return Object.keys(idx).sort().reverse().map(ym => ({ym, updated_at:idx[ym]})); }
    const {data, error} = await sb.from('tour_months').select('ym,updated_at').eq('user_id', USER.id).order('ym', {ascending:false});
    if(error) throw error; return data || [];
  }
};
function lsGet(k){ try{ const v = localStorage.getItem('bhromon:'+k); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem('bhromon:'+k, JSON.stringify(v)); }catch(e){} }

/* ---------------- সংরক্ষণ (দেরিতে, একসাথে) ---------------- */
let S = clone(DEFAULT_SETTINGS);
let M = null, curYM = '', curDoc = 'advance';
const pending = {};
function setSaveState(t){ $('saveState').textContent = t; }
function queue(key, fn){
  setSaveState('সংরক্ষণ হচ্ছে…');
  clearTimeout(pending[key]?.t);
  pending[key] = {fn, t:setTimeout(() => run(key), 900)};
}
async function run(key){
  const p = pending[key]; if(!p) return; delete pending[key];
  try{ await p.fn(); if(!Object.keys(pending).length) setSaveState('সংরক্ষিত'); }
  catch(e){ console.error(e); setSaveState('সংরক্ষণ হয়নি, ইন্টারনেট দেখুন'); }
}
async function flush(){ await Promise.all(Object.keys(pending).map(k => { clearTimeout(pending[k].t); return run(k); })); }
const SHARED_KEYS = ['hq','blocks','projects','purposeList','activities','recurring'];
let U = null; // বর্তমান উপজেলা {id, district, name, role, data}
const canEditShared = () => !U || U.role === 'admin';
function sharedPart(){ const d = {}; SHARED_KEYS.forEach(k => d[k] = clone(S[k] ?? DEFAULT_SETTINGS[k])); return d; }
function applyShared(d){ if(!d) return; SHARED_KEYS.forEach(k => { if(d[k] !== undefined) S[k] = clone(d[k]); }); }
const saveSettings = () => {
  queue('profile', () => Store.saveProfile(clone(S)));
  if(U && U.role === 'admin'){ const id = U.id, d = sharedPart(); queue('upazila', () => Store.saveUpazila(id, d)); }
};
const saveMonth = () => { const ym = curYM, d = clone(M); queue('m-'+ym, () => Store.saveMonth(ym, d)); };
window.addEventListener('beforeunload', e => { if(Object.keys(pending).length){ flush(); e.preventDefault(); e.returnValue=''; } });

/* ---------------- লগইন ---------------- */
let signupMode = false;
function authMsg(t, err){ $('aMsg').textContent = t; $('aMsg').className = 'msg' + (err ? ' err' : ''); }
function setMode(sign){
  signupMode = sign;
  $('nameWrap').hidden = !sign;
  $('tabLogin').className = 'btn' + (sign ? '' : ' leaf'); $('tabSignup').className = 'btn' + (sign ? ' leaf' : '');
  $('tabLogin').setAttribute('aria-pressed', !sign); $('tabSignup').setAttribute('aria-pressed', sign);
  $('aSubmit').textContent = sign ? 'অ্যাকাউন্ট খুলুন' : 'লগইন করুন';
  $('aPass').autocomplete = sign ? 'new-password' : 'current-password';
  authMsg('');
}
$('tabLogin').onclick = () => setMode(false);
$('tabSignup').onclick = () => setMode(true);
function authErr(e){
  const m = (e && e.message) || '';
  if(/Invalid login/i.test(m)) return 'ইমেইল বা পাসওয়ার্ড ভুল।';
  if(/not confirmed/i.test(m)) return 'ইমেইল এখনো নিশ্চিত করা হয়নি। ইনবক্সে পাঠানো লিংকে চাপুন।';
  if(/already registered/i.test(m)) return 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে। লগইন করুন।';
  if(/least 6/i.test(m)) return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।';
  return 'সমস্যা হয়েছে: ' + m;
}
$('aSubmit').onclick = async () => {
  const email = $('aEmail').value.trim(), password = $('aPass').value;
  if(!email || !password) return authMsg('ইমেইল ও পাসওয়ার্ড দিন।', true);
  $('aSubmit').disabled = true;
  try{
    if(signupMode){
      const name = $('aName').value.trim();
      const {data, error} = await sb.auth.signUp({email, password, options:{data:{name}, emailRedirectTo: location.origin + location.pathname}});
      if(error) throw error;
      if(!data.session) authMsg('অ্যাকাউন্ট খোলা হয়েছে। ইমেইলে পাঠানো লিংকে চাপ দিয়ে নিশ্চিত করুন, তারপর লগইন করুন।');
    } else {
      const {error} = await sb.auth.signInWithPassword({email, password});
      if(error) throw error;
    }
  }catch(e){ authMsg(authErr(e), true); }
  $('aSubmit').disabled = false;
};
$('aForgot').onclick = async () => {
  const email = $('aEmail').value.trim();
  if(!email) return authMsg('আগে ইমেইল লিখুন।', true);
  const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname});
  authMsg(error ? authErr(error) : 'পাসওয়ার্ড বদলানোর লিংক ইমেইলে পাঠানো হয়েছে।', !!error);
};
$('logout').onclick = async () => {
  await flush();
  if(CLOUD){ await sb.auth.signOut(); location.reload(); }
};

/* ---------------- ট্যাব ---------------- */
function openTab(name){
  document.querySelectorAll('nav.tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + name));
  if(name === 'docs') renderDoc();
  if(name === 'archive') renderArchive();
}
document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => openTab(b.dataset.tab));

/* ---------------- সেটআপ ---------------- */
function renderSetup(){
  document.querySelectorAll('[data-s]').forEach(i => { i.value = S[i.dataset.s] ?? ''; });
  $('acts').value = S.activities.join('\n');
  $('projects').value = S.projects.join('\n');
  $('purposeList').value = (S.purposeList || []).join('\n');
  renderBlocks(); renderRecs(); fillLists(); applyLock(); renderUpazila();
}
function applyLock(){
  const lock = !canEditShared();
  const sel = ['[data-s="hq"]','#blocksBody input','#blocksBody button','#bulk','#bulkAdd','#addBlock','#recList input','#recList select','#recList button','#addRec','#acts','#projects','#purposeList'];
  document.querySelectorAll(sel.join(',')).forEach(el => { el.disabled = lock; });
  document.querySelectorAll('[data-locknote]').forEach(el => { el.hidden = !lock; });
}
function fillLists(){
  $('dlActs').innerHTML = S.activities.map(a => `<option value="${esc(a)}">`).join('');
  $('dlProjects').innerHTML = S.projects.map(a => `<option value="${esc(a)}">`).join('');
}
document.querySelectorAll('[data-s]').forEach(i => i.addEventListener('input', () => { S[i.dataset.s] = i.value; saveSettings(); }));
$('acts').oninput = e => { S.activities = e.target.value.split('\n').map(s=>s.trim()).filter(Boolean); fillLists(); saveSettings(); };
$('purposeList').oninput = e => { S.purposeList = e.target.value.split('\n').map(s=>s.trim()).filter(Boolean); saveSettings(); };
$('projects').oninput = e => { S.projects = e.target.value.split('\n').map(s=>s.trim()).filter(Boolean); fillLists(); saveSettings(); };

function renderBlocks(){
  $('blocksBody').innerHTML = S.blocks.length ? S.blocks.map(b => `
    <tr data-id="${b.id}">
      <td><input data-k="name" value="${esc(b.name)}" aria-label="ব্লক"></td>
      <td><input data-k="union" value="${esc(b.union)}" aria-label="ইউনিয়ন"></td>
      <td><input data-k="saao" value="${esc(b.saao)}" aria-label="এসএএও"></td>
      <td><input data-k="km" inputmode="decimal" value="${esc(b.km)}" aria-label="দূরত্ব"></td>
      <td><button class="btn ghost small danger" data-del="${b.id}" aria-label="মুছুন">✕</button></td>
    </tr>`).join('') : `<tr><td colspan="5" class="hint">এখনো কোনো ব্লক নেই। নিচের বাক্সে একসাথে তালিকা দিন।</td></tr>`;
  applyLock();
}
$('blocksBody').addEventListener('input', e => {
  const tr = e.target.closest('tr'); if(!tr || !tr.dataset.id) return;
  const b = S.blocks.find(x => x.id === tr.dataset.id); const k = e.target.dataset.k;
  const old = b.name; b[k] = e.target.value;
  if(k === 'name' && M) M.rows.forEach(r => (r.visits||[]).forEach(v => { if(v.block === old) v.block = b.name; }));
  saveSettings();
});
$('blocksBody').addEventListener('click', e => {
  const id = e.target.dataset.del; if(!id) return;
  S.blocks = S.blocks.filter(b => b.id !== id); renderBlocks(); saveSettings();
});
$('addBlock').onclick = () => { S.blocks.push({id:uid(), name:'', union:'', saao:'', km:''}); renderBlocks(); saveSettings(); };
$('bulkAdd').onclick = () => {
  const have = new Set(S.blocks.map(b => b.name));
  $('bulk').value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
    const [name, union='', saao='', km=''] = l.split(/[,،]/).map(x => x.trim());
    if(name && !have.has(name)){ S.blocks.push({id:uid(), name, union, saao, km:en(km)}); have.add(name); }
  });
  $('bulk').value = ''; renderBlocks(); saveSettings();
};

/* ---------------- উপজেলা ---------------- */
const DISTRICTS = ['ঢাকা','গাজীপুর','নারায়ণগঞ্জ','নরসিংদী','মানিকগঞ্জ','মুন্সীগঞ্জ','ফরিদপুর','গোপালগঞ্জ','মাদারীপুর','রাজবাড়ী','শরীয়তপুর','কিশোরগঞ্জ','টাঙ্গাইল',
  'চট্টগ্রাম','কক্সবাজার','রাঙ্গামাটি','বান্দরবান','খাগড়াছড়ি','কুমিল্লা','ব্রাহ্মণবাড়িয়া','চাঁদপুর','ফেনী','লক্ষ্মীপুর','নোয়াখালী',
  'রাজশাহী','নওগাঁ','নাটোর','চাঁপাইনবাবগঞ্জ','পাবনা','সিরাজগঞ্জ','বগুড়া','জয়পুরহাট',
  'খুলনা','বাগেরহাট','সাতক্ষীরা','যশোর','ঝিনাইদহ','মাগুরা','নড়াইল','কুষ্টিয়া','চুয়াডাঙ্গা','মেহেরপুর',
  'বরিশাল','ভোলা','পটুয়াখালী','পিরোজপুর','ঝালকাঠি','বরগুনা','সিলেট','মৌলভীবাজার','হবিগঞ্জ','সুনামগঞ্জ',
  'রংপুর','দিনাজপুর','ঠাকুরগাঁও','পঞ্চগড়','নীলফামারী','লালমনিরহাট','কুড়িগ্রাম','গাইবান্ধা','ময়মনসিংহ','জামালপুর','শেরপুর','নেত্রকোনা'].sort((a,b)=>a.localeCompare(b,'bn'));
let upList = null, upDistrict = '';
function upErr(e){
  const m = (e && e.message) || '';
  if(/upazila_exists/.test(m)) return 'এই নামে উপজেলা আগেই আছে। তালিকা থেকে যোগ দিন।';
  if(/last_admin/.test(m)) return 'আপনি একমাত্র অ্যাডমিন। আগে অন্য কাউকে অ্যাডমিন করুন।';
  if(/not_admin/.test(m)) return 'এটা শুধু অ্যাডমিন করতে পারেন।';
  return 'সমস্যা হয়েছে: ' + m;
}
const cleanName = t => t.trim().replace(/\s*(উপজেলা|জেলা)$/,'').trim();
async function refreshShared(){
  U = await Store.myUpazila();
  if(U) applyShared(U.data);
  renderSetup(); if(M) renderRows();
}
async function renderUpazila(){
  const box = $('upBox');
  if(!CLOUD){ box.hidden = true; return; }
  box.hidden = false;
  if(U){
    box.innerHTML = `<h2>আমার উপজেলা</h2>
      <p style="margin:0">${esc(U.name)}, ${esc(U.district)} <span class="badge ${U.role==='admin'?'ad':''}">${U.role === 'admin' ? 'অ্যাডমিন' : 'সদস্য'}</span></p>
      <p class="hint">${U.role === 'admin' ? 'রওয়ানার স্থান, ব্লক, প্রকল্প, উদ্দেশ্য ও নির্দিষ্ট ভ্রমণের তালিকা আপনি বদলালে উপজেলার সবার জন্য বদলাবে।' : 'রওয়ানার স্থান, ব্লক, প্রকল্প, উদ্দেশ্য ও নির্দিষ্ট ভ্রমণের তালিকা উপজেলার অ্যাডমিন ঠিক করেন। নিজের নাম, পদবি ও সময় আপনি বদলাতে পারবেন।'}</p>
      <details><summary>উপজেলার সদস্য</summary><div class="members" id="memList"><p class="hint">লোড হচ্ছে…</p></div></details>
      <div class="acts"><button class="btn small ghost danger" id="upLeave">উপজেলা ছাড়ুন</button></div>
      <div class="msg" id="upMsg"></div>`;
    $('upLeave').onclick = async () => {
      if(!confirm('উপজেলা ছাড়লে যৌথ তালিকা আর আপডেট হবে না, এখনকার কপিটা আপনার কাছে থাকবে। ছাড়বেন?')) return;
      try{ await Store.rpc('leave_upazila'); U = null; renderSetup(); }catch(e){ $('upMsg').textContent = upErr(e); $('upMsg').className = 'msg err'; }
    };
    box.querySelector('details').addEventListener('toggle', e => { if(e.target.open) loadMembers(); });
    return;
  }
  box.innerHTML = `<h2>আপনার উপজেলা বাছাই করুন</h2>
    <p class="hint">উপজেলায় যোগ দিলে সেখানকার ব্লক, এসএএও, দূরত্ব, প্রকল্প ও উদ্দেশ্যের তালিকা একবারে পেয়ে যাবেন, নিজে লিখতে হবে না।</p>
    <label class="f"><span>জেলা</span><select id="upDist"><option value="">জেলা বাছুন</option>${DISTRICTS.map(d => `<option ${d===upDistrict?'selected':''}>${d}</option>`).join('')}</select></label>
    <div id="upChoices"></div><div class="msg" id="upMsg"></div>`;
  $('upDist').onchange = e => { upDistrict = e.target.value; renderChoices(); };
  if(upDistrict) renderChoices();
}
async function renderChoices(){
  const el = $('upChoices'); if(!upDistrict){ el.innerHTML = ''; return; }
  el.innerHTML = '<p class="hint">লোড হচ্ছে…</p>';
  try{ upList = await Store.rpc('list_upazilas'); }catch(e){ el.innerHTML = '<p class="hint">তালিকা আনা যায়নি। ইন্টারনেট দেখুন।</p>'; return; }
  const list = upList.filter(u => u.district === upDistrict);
  el.innerHTML = (list.length ? `<p class="hint" style="margin-top:8px">এই জেলায় যে উপজেলাগুলো আগে থেকে আছে, আপনারটায় চাপ দিন:</p>
      <div class="uplist">${list.map(u => `<button class="btn" data-join="${u.id}"><span>${esc(u.name)}</span><small class="status">${bn(u.members)} জন</small></button>`).join('')}</div>`
      : `<p class="hint" style="margin-top:8px">এই জেলায় এখনো কোনো উপজেলা তৈরি হয়নি।</p>`) +
    `<details ${list.length ? '' : 'open'}><summary>তালিকায় আপনার উপজেলা নেই? নতুন তৈরি করুন</summary>
      <label class="f"><span>উপজেলার নাম</span><input id="upName" placeholder="যেমন: রাউজান"></label>
      <p class="hint">তৈরি করলে আপনি অ্যাডমিন হবেন, আর আপনার এখনকার ব্লক ও তালিকা উপজেলার তালিকা হয়ে যাবে।</p>
      <button class="btn leaf small" id="upCreate">উপজেলা তৈরি করুন</button></details>`;
  el.querySelectorAll('[data-join]').forEach(b => b.onclick = async () => {
    if(!confirm('যোগ দিলে উপজেলার তালিকা আপনার এখনকার ব্লক ও তালিকার জায়গায় বসবে। যোগ দেবেন?')) return;
    try{ await Store.rpc('join_upazila', {p_id: b.dataset.join}); await refreshShared(); }catch(e){ $('upMsg').textContent = upErr(e); $('upMsg').className = 'msg err'; }
  });
  $('upCreate').onclick = async () => {
    const name = cleanName($('upName').value);
    if(!name) return;
    if(list.some(u => u.name === name)) { $('upMsg').textContent = 'এই নামে উপজেলা আগেই আছে। উপরের তালিকা থেকে যোগ দিন।'; $('upMsg').className = 'msg err'; return; }
    try{ await Store.rpc('create_upazila', {p_district: upDistrict, p_name: name, p_data: sharedPart()}); await refreshShared(); }
    catch(e){ $('upMsg').textContent = upErr(e); $('upMsg').className = 'msg err'; }
  };
}
async function loadMembers(){
  const el = $('memList');
  try{
    const ms = await Store.rpc('list_members');
    el.innerHTML = ms.map(m => `<div><span>${esc(m.name || 'নাম দেওয়া হয়নি')}<br><small>${esc(m.designation)}</small></span>
      <span>${m.role === 'admin' ? '<span class="badge ad">অ্যাডমিন</span>' : '<span class="badge">সদস্য</span>'}
      ${U.role === 'admin' && m.user_id !== USER.id ? `<button class="btn small" data-role="${m.role==='admin'?'member':'admin'}" data-uid="${m.user_id}">${m.role==='admin'?'সদস্য করুন':'অ্যাডমিন করুন'}</button>` : ''}</span></div>`).join('');
    el.querySelectorAll('[data-role]').forEach(b => b.onclick = async () => {
      try{ await Store.rpc('set_member_role', {p_user: b.dataset.uid, p_role: b.dataset.role}); loadMembers(); }
      catch(e){ $('upMsg').textContent = upErr(e); $('upMsg').className = 'msg err'; }
    });
  }catch(e){ el.innerHTML = '<p class="hint">সদস্য তালিকা আনা যায়নি।</p>'; }
}

/* নির্দিষ্ট মাসিক ভ্রমণ */
const NTH = [['1','প্রথম'],['2','দ্বিতীয়'],['3','তৃতীয়'],['4','চতুর্থ'],['last','শেষ']];
function renderRecs(){
  $('recList').innerHTML = S.recurring.map(r => `
  <div class="rec" data-id="${r.id}">
    <div class="g2">
      <label class="f"><span>গন্তব্য</span><input data-k="dest" value="${esc(r.dest)}" placeholder="যেমন: জেলা কৃষি অফিস, চট্টগ্রাম"></label>
      <label class="f"><span>উদ্দেশ্য</span><input data-k="purpose" value="${esc(r.purpose)}" placeholder="যেমন: মাসিক সমন্বয় সভায় যোগদান"></label>
    </div>
    <div class="g4">
      <label class="f"><span>কবে</span><select data-k="rule"><option value="nth" ${r.rule==='nth'?'selected':''}>মাসের নির্দিষ্ট বার</option><option value="date" ${r.rule==='date'?'selected':''}>মাসের নির্দিষ্ট তারিখ</option></select></label>
      ${r.rule === 'date'
        ? `<label class="f"><span>তারিখ</span><input data-k="day" inputmode="numeric" value="${esc(r.day)}"></label><span></span>`
        : `<label class="f"><span>কততম</span><select data-k="n">${NTH.map(([v,t]) => `<option value="${v}" ${r.n===v?'selected':''}>${t}</option>`).join('')}</select></label>
           <label class="f"><span>বার</span><select data-k="dow">${DAYS.map((d,i) => `<option value="${i}" ${String(r.dow)===String(i)?'selected':''}>${d}</option>`).join('')}</select></label>`}
      <label class="f"><span>আসা-যাওয়া (কিমি)</span><input data-k="km" inputmode="decimal" value="${esc(r.km)}"></label>
    </div>
    <div class="g4">
      <label class="f"><span>রওয়ানা</span><input type="time" data-k="dep" value="${r.dep}"></label>
      <label class="f"><span>পৌঁছানো</span><input type="time" data-k="arr" value="${r.arr}"></label>
      <label class="f"><span>ফেরা</span><input type="time" data-k="ret" value="${r.ret}"></label>
      <label class="f"><span>যানবাহন</span><input data-k="vehicle" value="${esc(r.vehicle)}"></label>
    </div>
    <button class="btn ghost small danger" data-del="${r.id}">এই নির্দিষ্ট ভ্রমণ মুছুন</button>
  </div>`).join('');
  applyLock();
}
$('recList').addEventListener('input', e => {
  const box = e.target.closest('.rec'); const k = e.target.dataset.k; if(!box || !k) return;
  const r = S.recurring.find(x => x.id === box.dataset.id); r[k] = e.target.value;
  if(k === 'rule') renderRecs();
  saveSettings();
});
$('recList').addEventListener('click', e => {
  const id = e.target.dataset.del; if(!id) return;
  S.recurring = S.recurring.filter(r => r.id !== id); renderRecs(); saveSettings();
});
$('addRec').onclick = () => {
  S.recurring.push({id:uid(), dest:'', purpose:'মাসিক সমন্বয় সভায় যোগদান', rule:'nth', n:'2', dow:'4', day:'', km:'', dep:'08:30', arr:'10:30', ret:'16:30', vehicle:'মোটর সাইকেল'});
  renderRecs(); saveSettings();
};
function recDate(r, y, m){
  const last = new Date(y, m, 0).getDate();
  if(r.rule === 'date'){ const d = parseInt(en(r.day)); return d >= 1 && d <= last ? `${y}-${pad(m)}-${pad(d)}` : null; }
  const hits = [];
  for(let d=1; d<=last; d++) if(new Date(y, m-1, d).getDay() === Number(r.dow)) hits.push(d);
  const d = r.n === 'last' ? hits[hits.length-1] : hits[Number(r.n)-1];
  return d ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/* ---------------- মাসের ডাটা ---------------- */
function emptyMonth(){ return {holidays:'', tours:10, rows:[], locked:false, advance:null, lockedAt:null}; }
async function loadMonth(ym){
  await flush();
  curYM = ym; $('month').value = ym;
  try{ M = (await Store.getMonth(ym)) || emptyMonth(); }
  catch(e){ M = emptyMonth(); setSaveState('এই মাসের তথ্য আনা যায়নি, ইন্টারনেট দেখুন'); }
  renderPlan();
}
$('month').onchange = e => { if(e.target.value) loadMonth(e.target.value); };
$('holidays').oninput = e => { M.holidays = e.target.value; saveMonth(); };
$('tours').oninput = e => { M.tours = e.target.value; saveMonth(); };

const blockOf = name => S.blocks.find(b => b.name === name);
function newVisit(block, work){ return {block: block || '', saao:'', project:'', farmers:'', work: work || ''}; }
function newField(date){
  return {id:uid(), kind:'field', date, visits:[newVisit()], purposes:[], purpose:'', dest:'', dep:S.dep, arr:S.arr, move:S.move, ret:S.ret, vehicle:S.vehicle, km:'', cancelled:false, reason:'', custom:''};
}
function newOther(date, r){
  return {id:uid(), kind:'other', date, visits:[], dest: r ? r.dest : '', purpose: r ? r.purpose : '',
    dep: r ? r.dep : S.dep, arr: r ? r.arr : S.arr, move:'', ret: r ? r.ret : S.ret, vehicle: r ? r.vehicle : S.vehicle,
    km: r ? r.km : '', cancelled:false, reason:'', custom:''};
}
function workingDays(ym, holidayStr){
  const [y,m] = ym.split('-').map(Number);
  const hol = new Set(en(holidayStr).split(/[,\s]+/).map(Number).filter(Boolean));
  const out = []; const last = new Date(y, m, 0).getDate();
  for(let d=1; d<=last; d++){
    const dow = new Date(y, m-1, d).getDay();
    if(dow === 5 || dow === 6 || hol.has(d)) continue;
    out.push(`${y}-${pad(m)}-${pad(d)}`);
  }
  return out;
}
function generate(){
  const [y, mo] = curYM.split('-').map(Number);
  const blocks = S.blocks.filter(b => b.name.trim());
  if(!blocks.length){ $('genHint').textContent = 'আগে সেটআপে ব্লকের তালিকা দিন।'; return; }
  const rows = [];
  const fixed = new Set();
  S.recurring.forEach(r => { const d = recDate(r, y, mo); if(d && r.dest){ rows.push(newOther(d, r)); fixed.add(d); } });
  const days = workingDays(curYM, M.holidays).filter(d => !fixed.has(d));
  const n = Math.min(Math.max(1, parseInt(en(M.tours)) || 1), days.length);
  const per = Math.min(blocks.length, Math.max(1, parseInt(S.blocksPerTrip) || 1));
  const acts = S.activities.length ? S.activities : ['প্রদর্শনী পর্যবেক্ষণ'];
  let bi = ((y * 12 + mo) * n * per) % blocks.length;
  for(let i=0; i<n; i++){
    const r = newField(days[Math.floor(i * days.length / n)]);
    r.purposes = (S.purposeList || []).slice(0, 3);
    r.visits = [];
    for(let j=0; j<per; j++){
      r.visits.push(newVisit(blocks[bi % blocks.length].name, acts[(i + j*2) % acts.length]));
      bi++;
    }
    rows.push(r);
  }
  M.rows = rows.sort((a,b) => a.date.localeCompare(b.date));
  $('genHint').textContent = `${bn(n)}টি মাঠ ভ্রমণ${fixed.size ? ` ও ${bn(fixed.size)}টি নির্দিষ্ট ভ্রমণ` : ''} বসানো হয়েছে। প্রতিটি খুলে প্রদর্শনীর কৃষক ও কাজ ঠিক করে নিন।`;
  renderRows(); saveMonth();
}
$('gen').onclick = () => {
  if(M.locked) return alert('অগ্রিম সূচি চূড়ান্ত করা আছে। নতুন সূচি তৈরি করতে আগে "চূড়ান্ত বাতিল" করুন।');
  if(M.rows.length && !confirm('এই মাসের বর্তমান সূচি মুছে নতুন তৈরি হবে। চালিয়ে যাবেন?')) return;
  generate();
};
function firstDay(){ return `${curYM}-01`; }
$('addField').onclick = () => { const r = newField(firstDay()); M.rows.push(r); openId = r.id; renderRows(); saveMonth(); };
$('addOther').onclick = () => { const r = newOther(firstDay()); M.rows.push(r); openId = r.id; renderRows(); saveMonth(); };

/* অগ্রিম সূচি চূড়ান্ত করা */
function unionLabel(u){ u = (u || '').trim(); if(!u) return ''; return /(ইউনিয়ন|পৌরসভা)$/.test(u) ? u : u + ' ইউনিয়ন'; }
function joinBn(a){ return a.length <= 1 ? a.join('') : a.slice(0,-1).join(', ') + ' ও ' + a[a.length-1]; }
function placesOf(r){
  if(r.kind !== 'field') return r.dest;
  const groups = [];
  r.visits.filter(v => v.block).forEach(v => {
    const u = unionLabel((blockOf(v.block) || {}).union);
    let g = groups.find(x => x.u === u); if(!g){ g = {u, b:[]}; groups.push(g); }
    g.b.push(v.block);
  });
  return groups.map(g => g.u ? `${g.u} (${joinBn(g.b)} ব্লক)` : `${joinBn(g.b)} ব্লক`).join(', ');
}
function advPurpose(r){
  const list = [...(r.purposes || []), ...(r.purpose ? [r.purpose] : [])];
  if(r.kind === 'field' && !list.length) list.push(S.defaultPurpose);
  return list.join('\n');
}
function fmtPurpose(t){ return esc(joinBn(String(t || '').split('\n').filter(Boolean))); }
function placeKey(r){ return r.kind === 'field' ? 'B:' + r.visits.map(v => v.block).filter(Boolean).join('|') : 'D:' + r.dest; }
function sameAsAdvance(s, r){ return s.date === r.date && (s.key != null ? s.key === placeKey(r) : s.place === placesOf(r)); }
function snapshot(){ return M.rows.filter(r => !r.cancelled).map(r => ({id:r.id, date:r.date, place:placesOf(r), key:placeKey(r), purpose:advPurpose(r)})); }
function renderLock(){
  const b = $('lockBox');
  if(M.locked){
    b.innerHTML = `<div><strong>অগ্রিম সূচি চূড়ান্ত</strong><div class="hint" style="margin:2px 0 0">এখন যেকোনো ভ্রমণ বদলালে সংশোধিত সূচিতে নিজে থেকে দেখাবে। ভ্রমণ না হলে "বাতিল" দিন, মুছবেন না।</div></div>
      <button class="btn small" id="unlock">চূড়ান্ত বাতিল</button>`;
    $('unlock').onclick = () => { if(confirm('চূড়ান্ত বাতিল করলে সংরক্ষিত অগ্রিম সূচি মুছে যাবে। এর পর আবার চূড়ান্ত করতে হবে। চালিয়ে যাবেন?')){ M.locked = false; M.advance = null; renderPlan(); saveMonth(); } };
  } else {
    b.innerHTML = `<div><strong>অগ্রিম সূচি এখনো চূড়ান্ত নয়</strong><div class="hint" style="margin:2px 0 0">জমা দেওয়ার দিন চূড়ান্ত করুন। এরপর সব পরিবর্তন সংশোধিত সূচিতে আলাদা করে দেখাবে।</div></div>
      <button class="btn leaf small" id="lock" ${M.rows.length ? '' : 'disabled'}>অগ্রিম সূচি চূড়ান্ত করুন</button>`;
    $('lock').onclick = () => { M.locked = true; M.advance = snapshot(); M.lockedAt = new Date().toISOString(); renderPlan(); saveMonth(); };
  }
}
function statusOf(r){
  if(!M.locked) return r.cancelled ? 'cancel' : '';
  const s = (M.advance || []).find(a => a.id === r.id);
  if(!s) return r.cancelled ? 'cancel' : 'added';
  if(r.cancelled) return 'cancel';
  return sameAsAdvance(s, r) ? '' : 'changed';
}
const BADGE = {changed:'<span class="badge ch">পরিবর্তিত</span>', cancel:'<span class="badge cn">বাতিল</span>', added:'<span class="badge ad">অতিরিক্ত</span>'};

/* ---------------- বিবরণ তৈরি ---------------- */
// শুধু ভ্রমণ বিবরণীর যাত্রা, গন্তব্য ও প্রত্যাবর্তন কলামে সংক্ষিপ্ত রূপ; পুরো শব্দ মিললে তবেই (যেমন "অফিসার" বদলাবে না)
function abbr(t){
  const pairs = String(S.abbrText || '').split('\n').map(l => l.split('=')).filter(x => x.length === 2)
    .map(([a,b]) => [a.trim(), b.trim()]).filter(([a]) => a).sort((x,y) => y[0].length - x[0].length);
  let out = String(t ?? '');
  pairs.forEach(([a,b]) => {
    const re = new RegExp('(?<![\u0980-\u09FF])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\u0980-\u09FF])', 'g');
    out = out.replace(re, b);
  });
  return out;
}
function autoKm(r){
  if(r.kind === 'other') return num(r.km);
  const ks = r.visits.map(v => num((blockOf(v.block) || {}).km));
  return ks.length ? Math.max(...ks) * 2 : 0;
}
const kmOf = r => (r.kind === 'field' && r.km !== '' && r.km != null) ? num(r.km) : autoKm(r);
function saaoOf(v){ return v.saao || (blockOf(v.block) || {}).saao || ''; }
function workOf(v){
  let pre = '';
  if(v.project) pre = `${v.project} প্রকল্পের আওতায় স্থাপিত প্রদর্শনীর ${v.farmers ? `কৃষক ${v.farmers} এর ` : ''}`;
  else if(v.farmers) pre = `কৃষক ${v.farmers} এর `;
  return pre + (v.work || 'মাঠ পরিদর্শন');
}
function narrative(r){
  if(r.custom && r.custom.trim()) return r.custom.trim();
  const veh = (r.vehicle || '').trim(), km = kmOf(r);
  const tail = `${veh ? ` ${veh}যোগে ভ্রমণ সম্পন্ন করা হয়েছে।` : ''} আসা-যাওয়ায় ${km ? bn(km) : '....'} কিঃ মিঃ`;
  if(r.kind === 'other'){
    return `অদ্য ${tl(r.dep)} ঘটিকার সময় ${S.hq || '....'} হতে ${r.dest || '....'} এর উদ্দেশ্যে রওয়ানা দিয়া ${tl(r.arr)} ঘটিকার সময় সেখানে পৌঁছি। তথায় ${r.purpose || '....'} শেষে ${tl(r.ret)} ঘটিকায় নিজ কর্মস্থলে ফেরৎ আসি।` + tail;
  }
  const v = r.visits.filter(x => x.block);
  if(!v.length) return 'ব্লক বাছাই করুন।';
  const s0 = saaoOf(v[0]);
  let t = `অদ্য ${tl(r.dep)} ঘটিকার সময় ${S.hq || '....'} হতে ${v.map(x=>x.block).join(', ')} ব্লকের উদ্দেশ্যে রওয়ানা দিয়া ${tl(r.arr)} ঘটিকার সময় ${v.length > 1 ? 'প্রথমে ' : ''}${v[0].block} ব্লকে পৌঁছি। তথায় ${s0 ? `সংশ্লিষ্ট ব্লকের এসএএও জনাব ${s0} কে সাথে নিয়া ` : ''}${workOf(v[0])}`;
  for(let i=1; i<v.length; i++){
    const s = saaoOf(v[i]);
    t += ` শেষে ${i === 1 ? `${tl(r.move)} ঘটিকার সময় ` : ''}${v[i].block} ব্লকে যাই${s ? ` এবং তথায় উক্ত ব্লকের এসএএও জনাব ${s} কে উপস্থিত পাই। তাঁকে সাথে নিয়া তাঁহার ব্লকের ` : '। তথায় '}${v[i].work ? workOf(v[i]) : 'মাঠ পরিদর্শন'}`;
  }
  return t + ` শেষে ${tl(r.ret)} ঘটিকায় নিজ কর্মস্থলে ফেরৎ আসি।` + tail;
}

/* ---------------- ভ্রমণ কার্ড ---------------- */
let openId = null;
function renderPlan(){
  $('holidays').value = M.holidays || '';
  $('tours').value = M.tours || '';
  $('genHint').textContent = M.rows.length ? '' : 'এই মাসের কোনো সূচি নেই। "স্বয়ংক্রিয় সূচি তৈরি করুন" চাপুন।';
  renderRows();
}
function blockOptions(sel){
  const names = S.blocks.map(b => b.name).filter(Boolean);
  if(sel && !names.includes(sel)) names.unshift(sel);
  return `<option value="">ব্লক বাছুন</option>` + names.map(n => `<option ${n===sel?'selected':''}>${esc(n)}</option>`).join('');
}
function summaryText(r){ return (r.kind === 'field' ? placesOf(r) : r.dest) || 'স্থান দেওয়া হয়নি'; }
function cardHtml(r, i){
  const st = statusOf(r), isF = r.kind === 'field';
  const inSnap = M.locked && (M.advance || []).some(a => a.id === r.id);
  return `<details class="trip ${isF ? '' : 'other'} ${r.cancelled ? 'cancel' : ''}" data-id="${r.id}" ${openId === r.id ? 'open' : ''}>
  <summary><div><div class="d">${bn(i+1)}. ${fmtDate(r.date)}, ${dayName(r.date)}</div><div class="p" data-sum>${esc(summaryText(r))}</div></div><div data-badge>${BADGE[st] || ''}</div></summary>
  <div class="body">
    <div class="kind"><button data-kind="field" aria-pressed="${isF}">মাঠ ভ্রমণ</button><button data-kind="other" aria-pressed="${!isF}">সভা / অন্য ভ্রমণ</button></div>
    <div class="g2">
      <label class="f"><span>তারিখ</span><input type="date" data-k="date" value="${r.date}"></label>
      ${isF ? '' : `<label class="f"><span>গন্তব্য</span><input data-k="dest" value="${esc(r.dest)}" placeholder="যেমন: জেলা কৃষি অফিস, চট্টগ্রাম"></label>`}
    </div>
    ${isF ? `<div class="f"><span class="hint" style="display:block;margin:6px 0 2px">অগ্রিম সূচির উদ্দেশ্য (একাধিক বাছাই করা যায়)</span>
      <div class="chips">${[...new Set([...(S.purposeList || []), ...(r.purposes || [])])].map(p => `<button type="button" data-pp="${esc(p)}" aria-pressed="${(r.purposes || []).includes(p)}">${esc(p)}</button>`).join('')}</div>
      <input data-k="purpose" value="${esc(r.purpose)}" placeholder="তালিকায় না থাকলে এখানে লিখুন (ঐচ্ছিক)"></div>` : ''}
    ${isF ? r.visits.map((v, j) => `
      <div class="visit">
        <div class="vh"><span>${bn(j+1)}ম ব্লক</span>${r.visits.length > 1 ? `<button class="btn ghost small danger" data-rmv="${j}">সরান</button>` : ''}</div>
        <div class="g2">
          <label class="f"><span>ব্লক</span><select data-k="visits.${j}.block">${blockOptions(v.block)}</select></label>
          <label class="f"><span>এসএএও</span><input data-k="visits.${j}.saao" value="${esc(v.saao)}" placeholder="${esc((blockOf(v.block)||{}).saao || 'নাম')}"></label>
          <label class="f"><span>প্রকল্প</span><input data-k="visits.${j}.project" list="dlProjects" value="${esc(v.project)}" placeholder="না থাকলে খালি"></label>
          <label class="f"><span>প্রদর্শনীর কৃষক</span><input data-k="visits.${j}.farmers" value="${esc(v.farmers)}" placeholder="যেমন: নেপাল বড়ুয়া, মাস্টার দুলাল"></label>
        </div>
        <label class="f"><span>কাজ</span><input data-k="visits.${j}.work" list="dlActs" value="${esc(v.work)}"></label>
      </div>`).join('') + `<button class="btn small" data-addv>আরেকটি ব্লক যোগ</button>`
    : `<label class="f"><span>উদ্দেশ্য</span><input data-k="purpose" value="${esc(r.purpose)}" placeholder="যেমন: মাসিক সমন্বয় সভায় যোগদান"></label>`}
    <div class="g4">
      <label class="f"><span>রওয়ানা</span><input type="time" data-k="dep" value="${r.dep}"></label>
      <label class="f"><span>পৌঁছানো</span><input type="time" data-k="arr" value="${r.arr}"></label>
      ${isF && r.visits.length > 1 ? `<label class="f"><span>পরের ব্লকে</span><input type="time" data-k="move" value="${r.move}"></label>` : ''}
      <label class="f"><span>ফেরা</span><input type="time" data-k="ret" value="${r.ret}"></label>
    </div>
    <div class="g2">
      <label class="f"><span>যানবাহন</span><input data-k="vehicle" value="${esc(r.vehicle)}"></label>
      <label class="f"><span>আসা-যাওয়া (কিমি)</span><input data-k="km" inputmode="decimal" value="${esc(r.km)}" placeholder="${isF ? 'স্বয়ংক্রিয়: ' + bn(autoKm(r)) : ''}"></label>
    </div>
    <label class="f"><span>ভ্রমণ বিবরণীতে যা যাবে</span><div class="preview" data-prev>${esc(narrative(r))}</div></label>
    <label class="f"><span>নিজে লিখতে চাইলে (খালি রাখলে উপরের লেখাই যাবে)</span><textarea data-k="custom" style="min-height:70px">${esc(r.custom)}</textarea></label>
    <div class="acts">
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-k="cancelled" ${r.cancelled ? 'checked' : ''}> ভ্রমণ হয়নি (বাতিল)</label>
      ${inSnap ? '' : `<button class="btn ghost small danger" data-delrow>মুছে ফেলুন</button>`}
    </div>
    ${(st && st !== '') ? `<label class="f"><span>পরিবর্তনের কারণ</span><input data-k="reason" list="dlReasons" value="${esc(r.reason)}" placeholder="তালিকা থেকে বাছুন বা লিখুন"></label>` : ''}
  </div></details>`;
}
function renderRows(){
  M.rows.sort((a,b) => a.date.localeCompare(b.date));
  $('rows').innerHTML = M.rows.map(cardHtml).join('');
  renderLock();
}
function rowOf(el){ const c = el.closest('.trip'); return c ? [c, M.rows.find(r => r.id === c.dataset.id)] : [null, null]; }
function setPath(obj, path, val){ const p = path.split('.'); let o = obj; while(p.length > 1) o = o[p.shift()]; o[p[0]] = val; }
function refreshCard(card, r){
  card.querySelector('[data-prev]').textContent = narrative(r);
  card.querySelector('[data-sum]').textContent = summaryText(r);
  const st = statusOf(r);
  card.querySelector('[data-badge]').innerHTML = BADGE[st] || '';
  const hasReason = !!card.querySelector('[data-k="reason"]');
  if(!!st !== hasReason) rerender(r.id);
}
function rerender(id){ openId = id; const y = window.scrollY; renderRows(); window.scrollTo(0, y); }
$('rows').addEventListener('input', e => {
  const [card, r] = rowOf(e.target); const k = e.target.dataset.k; if(!r || !k) return;
  setPath(r, k, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
  if(k === 'date' || k === 'cancelled' || /\.block$/.test(k)) rerender(r.id); else refreshCard(card, r);
  saveMonth();
});
$('rows').addEventListener('click', e => {
  const t = e.target; const [, r] = rowOf(t); if(!r) return;
  if(t.dataset.pp != null){
    r.purposes = r.purposes || [];
    const p = t.dataset.pp, i = r.purposes.indexOf(p);
    if(i >= 0) r.purposes.splice(i, 1); else r.purposes.push(p);
    t.setAttribute('aria-pressed', i < 0); saveMonth(); return;
  }
  if(t.dataset.kind){ if(r.kind !== t.dataset.kind){ r.kind = t.dataset.kind; if(r.kind === 'field' && !r.visits.length) r.visits = [newVisit()]; rerender(r.id); saveMonth(); } }
  else if(t.hasAttribute('data-addv')){ r.visits.push(newVisit()); rerender(r.id); saveMonth(); }
  else if(t.dataset.rmv){ r.visits.splice(Number(t.dataset.rmv), 1); rerender(r.id); saveMonth(); }
  else if(t.hasAttribute('data-delrow')){ if(confirm('এই ভ্রমণটি মুছে ফেলবেন?')){ M.rows = M.rows.filter(x => x.id !== r.id); renderRows(); saveMonth(); } }
});
$('rows').addEventListener('toggle', e => { if(e.target.open) openId = e.target.dataset.id; }, true);

/* ---------------- কাগজ ---------------- */
function ymParts(){ const [y,m] = curYM.split('-').map(Number); return {y, m}; }
function govHeader(title){
  const {y,m} = ymParts();
  return `<div class="gov"><div>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div><div class="t2">কৃষি সম্প্রসারণ অধিদপ্তর</div><div>${esc(S.office)}</div></div>
  <h3>${title}</h3>
  <div class="meta"><span>মাস: ${MONTHS[m-1]}, ${bn(y)}</span><span>নাম: ${esc(S.name) || '..........'}</span><span>পদবি: ${esc(S.designation) || '..........'}</span></div>`;
}
function signBlock(){
  return `<div class="sign"><div>দাখিলকারীর স্বাক্ষর ও তারিখ<br>${esc(S.name)}<br>${esc(S.designation)}</div><div>অনুমোদনকারীর স্বাক্ষর ও তারিখ<br>${esc(S.supervisor)}</div></div>`;
}
function docAdvance(){
  const list = M.locked ? M.advance : snapshot();
  return govHeader('অগ্রিম ভ্রমণসূচি') + `<table><thead><tr><th style="width:6%">ক্রমিক</th><th style="width:11%">তারিখ</th><th style="width:10%">বার</th><th style="width:22%">ভ্রমণের স্থান</th><th style="width:43%">ভ্রমণের উদ্দেশ্য</th><th style="width:8%">মন্তব্য</th></tr></thead><tbody>
  ${[...list].sort((a,b)=>a.date.localeCompare(b.date)).map((a,i) => `<tr><td class="c">${bn(i+1)}</td><td class="c">${fmtDate(a.date)}</td><td class="c">${dayName(a.date)}</td><td>${esc(a.place)}</td><td>${fmtPurpose(a.purpose)}</td><td></td></tr>`).join('')}
  </tbody></table>` + signBlock();
}
function docRevised(){
  const snap = M.advance || [];
  const items = [];
  snap.forEach(s => {
    const r = M.rows.find(x => x.id === s.id);
    if(!r || r.cancelled) items.push({sort:s.date, old:s, now:null, reason: r ? r.reason : ''});
    else items.push({sort:s.date, old:s, now:r, reason:r.reason, same: sameAsAdvance(s, r)});
  });
  M.rows.filter(r => !r.cancelled && !snap.some(s => s.id === r.id)).forEach(r => items.push({sort:r.date, old:null, now:r, reason:r.reason}));
  items.sort((a,b) => a.sort.localeCompare(b.sort));
  return govHeader('সংশোধিত ভ্রমণসূচি') + `<table><thead>
  <tr><th rowspan="2">ক্রমিক</th><th colspan="2">অগ্রিম ভ্রমণসূচি অনুযায়ী</th><th colspan="3">সংশোধিত ভ্রমণসূচি</th><th rowspan="2">পরিবর্তনের কারণ</th></tr>
  <tr><th>তারিখ</th><th>স্থান</th><th>তারিখ</th><th>স্থান</th><th>উদ্দেশ্য</th></tr></thead><tbody>
  ${items.map((it,i) => `<tr><td class="c">${bn(i+1)}</td>
    ${it.old ? `<td class="c">${fmtDate(it.old.date)}</td><td>${esc(it.old.place)}</td>` : `<td class="c" colspan="2">অগ্রিম সূচিতে ছিল না</td>`}
    ${it.now ? `<td class="c">${fmtDate(it.now.date)}</td><td>${esc(placesOf(it.now))}</td><td>${fmtPurpose(advPurpose(it.now))}</td>` : `<td class="c" colspan="3">ভ্রমণ বাতিল</td>`}
    <td>${it.same ? 'অপরিবর্তিত' : esc(it.reason)}</td></tr>`).join('')}
  </tbody></table>` + signBlock();
}
function docDiary(){
  const {y,m} = ymParts();
  const list = M.rows.filter(r => !r.cancelled).sort((a,b) => a.date.localeCompare(b.date));
  let total = 0; list.forEach(r => total += kmOf(r));
  if(S.diaryLayout === 'narrative'){
    return `<h3>${esc(S.name)}, ${esc(S.designation)} এর ${MONTHS[m-1]}/${bn(String(y).slice(2))} ইং মাসের ভ্রমণ বিবরণীঃ</h3>
    <table><thead><tr><th style="width:95px">তারিখ</th><th>ভ্রমণের বিবরণ</th></tr></thead><tbody>
    ${list.map(r => `<tr><td class="c">${fmtDate(r.date)}</td><td class="j">${esc(narrative(r))}</td></tr>`).join('')}
    <tr><td class="r"><b>মোট</b></td><td><b>আসা-যাওয়ায় ${bn(total)} কিঃ মিঃ</b></td></tr></tbody></table>` + signBlock();
  }
  return govHeader('ভ্রমণ বিবরণী') + `<table><thead><tr><th>ক্রমিক</th><th>তারিখ ও বার</th><th>যাত্রা (স্থান ও সময়)</th><th>গন্তব্য</th><th>প্রত্যাবর্তন (স্থান ও সময়)</th><th>দূরত্ব, আসা-যাওয়া (কিমি)</th><th style="width:42%">সম্পাদিত কাজের বিবরণ</th></tr></thead><tbody>
  ${list.map((r,i) => `<tr><td class="c">${bn(i+1)}</td><td class="c">${fmtDate(r.date)}<br>${dayName(r.date)}</td>
    <td>${esc(abbr(S.hq))}<br>${tl(r.dep)}</td><td>${esc(abbr(r.kind === 'field' ? placesOf(r) : r.dest))}</td><td>${esc(abbr(S.hq))}<br>${tl(r.ret)}</td>
    <td class="r">${kmOf(r) ? bn(kmOf(r)) : ''}</td><td class="j">${esc(narrative(r))}</td></tr>`).join('')}
  <tr><td colspan="5" class="r"><b>মোট</b></td><td class="r"><b>${bn(total)}</b></td><td></td></tr></tbody></table>
  <p class="cert">প্রত্যয়ন করা যাচ্ছে যে, উপরোক্ত ভ্রমণসমূহ সরকারি কাজে সম্পাদিত হয়েছে।</p>` + signBlock();
}
function docHtml(){ return curDoc === 'advance' ? docAdvance() : curDoc === 'revised' ? docRevised() : docDiary(); }
function renderDoc(){
  const w = [];
  if(!M.rows.length) w.push('এই মাসের কোনো ভ্রমণ নেই। "মাসের ভ্রমণ" থেকে সূচি তৈরি করুন।');
  if(!S.name || !S.hq) w.push('সেটআপে নাম, পদবি ও রওয়ানার স্থান দিন।');
  if(curDoc === 'revised' && !M.locked) w.push('সংশোধিত সূচির জন্য আগে অগ্রিম সূচি চূড়ান্ত করতে হবে।');
  if(curDoc === 'advance' && !M.locked && M.rows.length) w.push('অগ্রিম সূচি এখনো চূড়ান্ত নয়। জমা দেওয়ার পর "মাসের ভ্রমণ" থেকে চূড়ান্ত করুন।');
  if(curDoc === 'diary'){
    const noKm = M.rows.filter(r => !r.cancelled && !kmOf(r)).length;
    if(noKm) w.push(`${bn(noKm)}টি ভ্রমণের দূরত্ব নেই। সেটআপে ব্লকের দূরত্ব দিন বা ভ্রমণে কিমি লিখুন।`);
  }
  $('docWarn').innerHTML = w.map(x => `<div class="warn">${x}</div>`).join('');
  $('sheet').innerHTML = (curDoc === 'revised' && !M.locked) ? '' : docHtml();
}
$('docSeg').onclick = e => {
  const d = e.target.dataset.doc; if(!d) return; curDoc = d;
  document.querySelectorAll('#docSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.doc === d));
  renderDoc();
};
const DOC_CSS = `body{margin:0;font-family:"Nikosh","SolaimanLipi","Tiro Bangla",serif;font-size:13pt;line-height:1.5;color:#000}
.gov{text-align:center}.gov .t2{font-size:15pt;font-weight:bold}
h3{text-align:center;font-size:15pt;margin:10pt 0 6pt;text-decoration:underline}
.meta{display:flex;justify-content:space-between;margin:6pt 0}.meta span{margin-right:30pt}
table{width:100%;border-collapse:collapse;margin-top:6pt}th,td{border:1px solid #000;padding:3pt 5pt;vertical-align:top;text-align:left}
th{text-align:center}td.c{text-align:center}td.r{text-align:right}td.j{text-align:justify}.cert{margin-top:12pt}
.sign{display:flex;justify-content:space-between;margin-top:40pt}.sign div{text-align:center;min-width:200pt;border-top:1px dotted #000;padding-top:3pt}`;
const TITLES = {advance:'অগ্রিম ভ্রমণসূচি', revised:'সংশোধিত ভ্রমণসূচি', diary:'ভ্রমণ বিবরণী'};
function canExport(){ if(curDoc === 'revised' && !M.locked){ alert('আগে অগ্রিম সূচি চূড়ান্ত করুন।'); return false; } return true; }
$('dlWord').onclick = () => {
  if(!canExport()) return;
  // Word এই HTML ফাইলটি সরাসরি খোলে ও এডিট করা যায়; আড়াআড়ি A4 পাতা
  const signTable = docHtml().replace(/<div class="sign"><div>(.*?)<\/div><div>(.*?)<\/div><\/div>/,
    '<table style="margin-top:40pt;border:none"><tr><td style="border:none;text-align:center">$1</td><td style="border:none;text-align:center">$2</td></tr></table>');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${TITLES[curDoc]}</title><style>${DOC_CSS}
@page Section1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:36pt 36pt 36pt 36pt}div.Section1{page:Section1}</style></head>
<body><div class="Section1">${signTable}</div></body></html>`;
  const blob = new Blob(['\ufeff', html], {type:'application/msword'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${TITLES[curDoc]}-${curYM}.doc`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('print').onclick = () => {
  if(!canExport()) return;
  const w = window.open('', '_blank');
  if(!w) return alert('পপ-আপ বন্ধ আছে। ব্রাউজারে এই সাইটের জন্য পপ-আপ চালু করুন।');
  w.document.write(`<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><title>${TITLES[curDoc]} ${curYM}</title>
<link href="https://fonts.googleapis.com/css2?family=Tiro+Bangla&display=swap" rel="stylesheet"><style>${DOC_CSS}@page{size:A4 landscape;margin:12mm}</style></head>
<body>${docHtml()}<script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))<\/script></body></html>`);
  w.document.close();
};

/* ---------------- পুরোনো মাস ---------------- */
async function renderArchive(){
  $('monthList').innerHTML = '<p class="hint">লোড হচ্ছে…</p>';
  try{
    const list = await Store.listMonths();
    $('monthList').innerHTML = list.length ? list.map(x => { const [y,m] = x.ym.split('-').map(Number);
      return `<a data-ym="${x.ym}"><span>${MONTHS[m-1]} ${bn(y)}</span><span class="status">${x.updated_at ? 'সর্বশেষ বদল: ' + fmtDate(x.updated_at.slice(0,10)) : ''}</span></a>`; }).join('')
      : '<p class="hint">এখনো কোনো মাস সংরক্ষিত হয়নি।</p>';
  }catch(e){ $('monthList').innerHTML = '<p class="hint">তালিকা আনা যায়নি। ইন্টারনেট সংযোগ দেখুন।</p>'; }
}
$('monthList').onclick = async e => { const a = e.target.closest('a[data-ym]'); if(!a) return; await loadMonth(a.dataset.ym); openTab('plan'); };

/* ---------------- শুরু ---------------- */
let started = false;
async function startApp(user){
  if(started) return; started = true;
  USER = user;
  $('authView').hidden = true; $('appView').hidden = false;
  $('demoBanner').hidden = CLOUD; $('logout').hidden = !CLOUD;
  try{
    const p = await Store.getProfile();
    S = Object.assign(clone(DEFAULT_SETTINGS), p || {});
    if(!p && user && user.user_metadata && user.user_metadata.name){ S.name = user.user_metadata.name; saveSettings(); }
  }catch(e){ setSaveState('সেটআপ আনা যায়নি, ইন্টারনেট দেখুন'); }
  if(CLOUD){ try{ U = await Store.myUpazila(); if(U) applyShared(U.data); }catch(e){ console.error(e); } }
  $('whoName').textContent = S.name || (user && user.email) || '';
  renderSetup();
  const now = new Date();
  await loadMonth(`${now.getFullYear()}-${pad(now.getMonth()+1)}`);
  if(!S.blocks.length || (CLOUD && !U)) openTab('setup');
}
async function boot(){
  if(!CLOUD){ startApp(null); return; }
  sb.auth.onAuthStateChange(async (ev, session) => {
    if(ev === 'PASSWORD_RECOVERY'){
      const p = prompt('নতুন পাসওয়ার্ড দিন (কমপক্ষে ৬ অক্ষর)');
      if(p){ const {error} = await sb.auth.updateUser({password:p}); alert(error ? authErr(error) : 'পাসওয়ার্ড বদলানো হয়েছে।'); }
    }
    if(session && session.user) startApp(session.user);
  });
  const {data} = await sb.auth.getSession();
  if(data.session) startApp(data.session.user);
  else { $('authView').hidden = false; setMode(false); }
}
boot();
})();
