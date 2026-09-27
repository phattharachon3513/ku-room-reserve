const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const fmt = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
const state = { date: new Date(), type: '', room: null, user: null, lang: localStorage.getItem('ku-lang') || 'th', loading: false };
let renderVersion = 0;
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const API_BASE = 'https://ku-room-reserve-production.up.railway.app';

const api = (action, options = {}) =>
  fetch(`${API_BASE}/api/index.php?action=upload-room-image`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  })
  .then(async response => {
    let data = {};
    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      if (
        response.status === 401 &&
        data.code === 'AUTH_REQUIRED' &&
        state.user
      ) {
        state.user = null;
        updateUser();
        toast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'info');
      }

      throw new Error(
        data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      );
    }

    return data;
  });
function toast(message, type = 'info') { const item = document.createElement('div'); item.className = `toast ${type}`; item.setAttribute('role','status'); item.textContent = message; document.body.append(item); requestAnimationFrame(() => item.classList.add('show')); setTimeout(() => item.remove(), 3600); }
function setBusy(button, busy, label) { if (!button) return; button.disabled = busy; if (busy) { button.dataset.label = button.textContent; button.textContent = label || 'กำลังดำเนินการ…'; } else if (button.dataset.label) { button.textContent = button.dataset.label; delete button.dataset.label; } }
function openModal(html) { $('#modalContent').innerHTML = html; $('#modal').classList.add('show'); const focus = $('#modalContent input, #modalContent select, #modalContent button'); focus?.focus(); }
function closeModal() { $('#modal').classList.remove('show'); $('#modalContent').innerHTML = ''; state.room = null; }
function dateText(date) { return new Intl.DateTimeFormat(state.lang === 'en' ? 'en-GB' : 'th-TH', {dateStyle:'long'}).format(new Date(`${date}T00:00:00`)); }

async function render() {
  const version = ++renderVersion;
  const button = $('#searchBtn'); setBusy(button, true, state.lang === 'en' ? 'Searching…' : 'กำลังค้นหา…');
  const q = new URLSearchParams({ date: $('#dateFilter').value, time: $('#timeFilter').value });
  if ($('#buildingFilter').value) q.set('building', $('#buildingFilter').value);
  if ($('#floorFilter').value) q.set('floor', $('#floorFilter').value);
  if (state.type) q.set('type', state.type);
  try {
    const data = await api(`rooms&${q}`); if (version !== renderVersion) return; const list = data.rooms || [];
    $('#resultCount').textContent = state.lang === 'en' ? `${list.length} rooms` : `พบ ${list.length} ห้อง`;
    $('#roomList').innerHTML = list.length ? list.map(roomCard).join('') : `<div class="card empty-state" role="status">${state.lang === 'en' ? 'No classrooms match your search.' : 'ไม่พบห้องที่ตรงกับเงื่อนไข ลองเปลี่ยนวันหรือช่วงเวลา'}</div>`;
    renderCalendar();
  } catch (error) { if (version === renderVersion) toast(error.message, 'error'); }
  finally { if (version === renderVersion) setBusy(button, false); }
}
function roomCard(r) { const taken = Number(r.taken) > 0; return `<article class="room-card" data-room-id="${r.id}"><img loading="lazy" alt="${esc(r.building)} ห้อง ${esc(r.room_no)}" src="${esc(r.image_url || 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=300&q=80')}"><div class="room-info"><h4>${esc(r.building)} ห้อง ${esc(r.room_no)} <em>ห้อง${esc(r.room_type)}</em></h4><p>ชั้น ${esc(r.floor)} · ${esc(r.building)}</p><small><i class="fa-solid fa-users"></i> ความจุ ${esc(r.capacity)} ที่นั่ง</small></div><div class="availability"><b class="${taken?'busy':''}">${taken ? 'ไม่ว่าง' : 'ว่าง'}</b><small>${esc($('#timeFilter').value.replace('-', ' - '))}</small><button type="button" data-book-room="${r.id}">${taken ? 'ดูรายละเอียด' : 'เลือกห้อง'}</button></div></article>`; }
function renderCalendar() { const d = state.date; $('#calendarLabel').textContent = new Intl.DateTimeFormat(state.lang === 'en' ? 'en-GB' : 'th-TH', {month:'long', year:'numeric'}).format(d); const start = new Date(d.getFullYear(), d.getMonth(), 1); const total = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); let html = ''; for (let i=0; i<(start.getDay()+6)%7; i++) html += '<span aria-hidden="true"></span>'; for (let n=1; n<=total; n++) { const ds = fmt(new Date(d.getFullYear(),d.getMonth(),n)); html += `<span role="button" tabindex="0" aria-label="${dateText(ds)}" class="${ds===fmt(state.date)?'today':''}" data-calendar-date="${ds}">${n}</span>`; } $('#calendarDays').innerHTML = html; }
function pickDate(ds) { state.date = new Date(`${ds}T00:00:00`); $('#dateFilter').value = ds; render(); }

function openBooking(id) {
  state.room = id; const selected = $(`[data-room-id="${id}"]`); const title = selected?.querySelector('h4')?.textContent || 'ห้องเรียน'; const busy = selected?.querySelector('.busy'); const u = state.user;
  if (busy) { openModal(`<h2>รายละเอียดการจอง</h2><p class="modal-sub">${esc(title)} · ${dateText($('#dateFilter').value)}</p><div id="roomSchedule"><p class="empty">กำลังโหลดตาราง…</p></div>`); api(`schedule&date=${$('#dateFilter').value}`).then(data => { const rows = (data.bookings||[]).filter(x => Number(x.room_id) === Number(id)); $('#roomSchedule').innerHTML = rows.length ? rows.map(x => `<div class="schedule"><b>${esc(x.start_time.slice(0,5))}–${esc(x.end_time.slice(0,5))}</b><span>${esc(x.teacher)} · ${esc(x.subject)}</span></div>`).join('') : '<p class="empty">ไม่พบรายละเอียดการจอง</p>'; }).catch(e => toast(e.message,'error')); return; }
  if (!u) { openModal(`<h2>เข้าสู่ระบบเพื่อจองห้อง</h2><p class="modal-sub">${esc(title)} · ${dateText($('#dateFilter').value)}</p><p>คุณสามารถดูตารางได้โดยไม่ต้องเข้าสู่ระบบ การจองต้องใช้บัญชีอาจารย์ที่ได้รับการอนุมัติแล้ว</p><button type="button" class="confirm-btn" id="modalLogin">เข้าสู่ระบบอาจารย์</button><button type="button" class="text-btn" id="modalRegister">สมัครบัญชีอาจารย์</button>`); $('#modalLogin').onclick = () => openAuth('login'); $('#modalRegister').onclick = () => openAuth('register'); return; }
  if (u.role === 'teacher' && u.status !== 'active') { toast('บัญชีของคุณอยู่ระหว่างรอแอดมินอนุมัติ', 'error'); return; }
  openModal(`<h2>จองห้องเรียน</h2><p class="modal-sub">${esc(title)} · ${dateText($('#dateFilter').value)}</p><form id="bookingForm"><label>หัวข้อ / รายวิชา<input class="input" name="subject" maxlength="180" required placeholder="เช่น CS101 กลุ่ม 1"></label><label>ช่วงเวลา<select class="input" name="time"><option value="${esc($('#timeFilter').value)}">${esc($('#timeFilter').value.replace('-', ' - '))}</option>${['08:00-12:00','13:00-16:00','08:00-16:00'].filter(t=>t!==$('#timeFilter').value).map(t=>`<option value="${t}">${t.replace('-', ' - ')}</option>`).join('')}</select></label><button type="submit" class="confirm-btn">ตรวจสอบรายละเอียด</button></form>`);
  $('#bookingForm').addEventListener('submit', event => { event.preventDefault(); const form=event.target; const [start_time,end_time]=form.time.value.split('-'); const subject=form.subject.value.trim(); openModal(`<h2>ยืนยันการจอง</h2><p class="modal-sub">ตรวจสอบรายละเอียดก่อนส่งคำขอ</p><div class="schedule"><div><b>ห้อง</b><span>${esc(title)}</span></div><div><b>วันที่</b><span>${dateText($('#dateFilter').value)}</span></div><div><b>เวลา</b><span>${start_time}–${end_time}</span></div><div><b>หัวข้อ</b><span>${esc(subject)}</span></div></div><button type="button" class="confirm-btn" id="commitBooking">ยืนยันการจอง</button><button type="button" class="text-btn" id="editBooking">กลับไปแก้ไข</button>`); $('#editBooking').onclick=()=>openBooking(id); $('#commitBooking').onclick=async e=>{const btn=e.currentTarget;setBusy(btn,true,'กำลังตรวจสอบห้อง…');try{await api('book',{method:'POST',body:JSON.stringify({room_id:id,date:$('#dateFilter').value,start_time,end_time,subject})});closeModal();toast('ยืนยันการจองเรียบร้อยแล้ว','success');render();}catch(error){toast(error.message,'error');if(error.message.includes('ถูกจอง'))render();}finally{setBusy(btn,false);}}; });
}

function openAuth(mode = 'login') { const register = mode === 'register'; openModal(`<h2>${register?'สมัครบัญชีอาจารย์':'เข้าสู่ระบบอาจารย์'}</h2><p class="modal-sub">ใช้บัญชีอีเมลมหาวิทยาลัย เช่น user@ku.th</p><form id="authForm">${register?'<label>ชื่อ-นามสกุล<input class="input" name="name" autocomplete="name" required></label>':''}<label>อีเมลมหาวิทยาลัย<input class="input" name="email" type="email" autocomplete="email" placeholder="user@ku.th" pattern="^[^@\\s]+@ku\\.th$" required></label><label>รหัสผ่าน<input class="input" name="password" type="password" minlength="8" autocomplete="${register?'new-password':'current-password'}" required></label><button type="submit" class="confirm-btn">${register?'ส่งคำขอสมัคร':'เข้าสู่ระบบ'}</button></form><button type="button" class="text-btn" id="switchAuth">${register?'มีบัญชีแล้ว? เข้าสู่ระบบ':'ยังไม่มีบัญชี? สมัครอาจารย์'}</button>`); $('#switchAuth').onclick = () => openAuth(register ? 'login' : 'register'); $('#authForm').onsubmit = async event => { event.preventDefault(); const form = event.target; const email = form.email.value.trim().toLowerCase(); if (!/^[^@\s]+@ku\.th$/i.test(email)) { toast('กรุณาใช้อีเมลที่ลงท้ายด้วย @ku.th เช่น user@ku.th','error'); form.email.focus(); return; } const submit = form.querySelector('button'); setBusy(submit,true,register?'กำลังส่งคำขอ…':'กำลังเข้าสู่ระบบ…'); try { const result = await api(register?'register':'login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))}); if (register) { closeModal(); toast('ส่งคำขอแล้ว รอแอดมินตรวจสอบบัญชีของคุณ','success'); } else { state.user = result.user; updateUser(); setActive(null); closeModal(); toast('เข้าสู่ระบบสำเร็จ','success'); } } catch (error) { toast(error.message,'error'); } finally { setBusy(submit,false); } }; }

function updateUser() { const u=state.user; $('#userName').textContent=u?.name||'ผู้ชมทั่วไป'; $('#userRole').textContent=u?.role==='admin'?'ผู้ดูแลระบบ':u?.role==='teacher'?'อาจารย์':'ดูตารางการจอง'; $('#topUser').textContent=u?.name||'ผู้ชมทั่วไป'; $('#loginNav').hidden=!!u; $('#logoutBtn').hidden=!u; $('#adminNav').hidden=!(u?.role==='admin'); if(u?.role==='teacher'&&u.status!=='active') $('#userRole').textContent='รออนุมัติ'; }
function setActive(action) { const target = action==='login' ? $('#loginNav') : action==='admin' ? $('#adminNav') : action==='schedule' ? $('[data-action="schedule"]') : action==='rooms' ? $('[data-action="rooms"]') : $('.sidebar nav a:first-child'); $$('.sidebar nav a').forEach(a => a.classList.toggle('active', a===target)); }
async function showSchedule() { setActive('schedule'); try { const data=await api(`schedule&date=${$('#dateFilter').value}`); openModal(`<h2>ตารางการจอง</h2><p class="modal-sub">${dateText($('#dateFilter').value)}</p><div class="schedule">${data.bookings?.length ? data.bookings.map(b=>`<div><b>${esc(b.start_time.slice(0,5))}–${esc(b.end_time.slice(0,5))} · ${esc(b.building)} ${esc(b.room_no)}</b><span>${esc(b.teacher)} · ${esc(b.subject)}</span></div>`).join('') : '<p class="empty">วันนี้ยังไม่มีการจอง</p>'}</div>`); } catch(e) { toast(e.message,'error'); } }
async function showAdmin() { if (state.user?.role!=='admin') return toast('หน้านี้สำหรับแอดมินเท่านั้น','error'); setActive('admin'); try { const data=await api('admin-users'); const pending=(data.users||[]).filter(u=>u.status==='pending'); openModal(`<h2>จัดการระบบ</h2><p class="modal-sub">คำขออาจารย์ที่รออนุมัติ ${pending.length} รายการ</p><div class="schedule">${pending.length?pending.map(u=>`<div><b>${esc(u.name)}</b><span>${esc(u.email)}<button type="button" class="text-btn approve-user" data-id="${u.id}">อนุมัติ</button></span></div>`).join(''):'<p class="empty">ไม่มีคำขอรออนุมัติ</p>'}</div><form id="roomForm"><h3>เพิ่มห้องเรียน</h3><label>อาคาร<input class="input" name="building" placeholder="อาคาร 1" required></label><label>ชั้น<input class="input" name="floor" type="number" min="1" required></label><label>เลขห้อง<input class="input" name="room_no" required></label><label>ประเภทห้อง<input class="input" name="room_type" placeholder="บรรยาย" required></label><label>ความจุ<input class="input" name="capacity" type="number" min="1" required></label><button type="submit" class="confirm-btn">เพิ่มห้อง</button></form>`); $$('.approve-user').forEach(button=>button.onclick=async()=>{setBusy(button,true,'กำลังอนุมัติ…');try{await api('review-user',{method:'POST',body:JSON.stringify({user_id:button.dataset.id,status:'active'})});toast('อนุมัติบัญชีอาจารย์แล้ว','success');showAdmin();}catch(e){toast(e.message,'error');setBusy(button,false);}}); $('#roomForm').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('button');setBusy(submit,true,'กำลังบันทึก…');try{await api('add-room',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});closeModal();toast('เพิ่มห้องเรียนแล้ว','success');render();}catch(x){toast(x.message,'error');}finally{setBusy(submit,false);}}; } catch(e) { toast(e.message,'error'); } }

const dict={th:{headline:'ระบบจองห้องเรียน มหาวิทยาลัยเกษตรศาสตร์',title:'จองห้องเรียน',booking:'จองห้องเรียน',today:'ตารางการจองวันนี้',rooms:'ห้องเรียนทั้งหมด',login:'เข้าสู่ระบบอาจารย์',search:'ค้นหา'},en:{headline:'Kasetsart University Classroom Booking',title:'Classroom booking',booking:'Book a classroom',today:"Today's bookings",rooms:'All classrooms',login:'Teacher login',search:'Search'}};
function applyLocale(){const d=dict[state.lang];document.documentElement.lang=state.lang;$('#langBtn').textContent=state.lang==='en'?'EN⌄':'TH⌄';$('.topbar h1').textContent=d.headline;$('.content>h2').textContent=d.title;const nav=$$('.sidebar nav a');nav[0].querySelector('span').textContent=d.booking;nav[1].querySelector('span').textContent=d.today;nav[2].querySelector('span').textContent=d.rooms;$('#loginNav span').textContent=d.login;$('#searchBtn').innerHTML=`<i class="fa-solid fa-magnifying-glass"></i> ${d.search}`;render();}

$('#dateFilter').value=fmt(state.date); $('#dateFilter').min=fmt(new Date());
$('#roomList').addEventListener('click', e=>{const button=e.target.closest('[data-book-room]');if(button)openBooking(Number(button.dataset.bookRoom));});
$('#searchBtn').onclick=()=>render(); ['dateFilter','timeFilter','buildingFilter','floorFilter'].forEach(id=>$('#'+id).addEventListener('change',()=>{if(id==='dateFilter')state.date=new Date(`${$('#dateFilter').value}T00:00:00`);render();}));
$$('.chips button').forEach(button=>button.addEventListener('click',()=>{$$('.chips button').forEach(x=>x.classList.remove('selected'));button.classList.add('selected');state.type=button.dataset.type||'';render();}));
$('#calendarDays').addEventListener('click',e=>{const date=e.target.closest('[data-calendar-date]')?.dataset.calendarDate;if(date)pickDate(date);}); $('#calendarDays').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const date=e.target.closest('[data-calendar-date]')?.dataset.calendarDate;if(date){e.preventDefault();pickDate(date);}}});
$('#prevDay').onclick=()=>{state.date.setDate(state.date.getDate()-1);pickDate(fmt(state.date));}; $('#nextDay').onclick=()=>{state.date.setDate(state.date.getDate()+1);pickDate(fmt(state.date));};
$("[data-action=\"booking\"]").onclick=e=>{e.preventDefault();setActive("booking");$("#booking").scrollIntoView({behavior:"smooth"});}; $("#loginNav").onclick=e=>{e.preventDefault();setActive("login");openAuth("login");}; $("#adminNav").onclick=e=>{e.preventDefault();showAdmin();}; $("[data-action=\"schedule\"]").onclick=e=>{e.preventDefault();showSchedule();}; $("[data-action=\"rooms\"]").onclick=e=>{e.preventDefault();setActive("rooms");state.type="";$("#buildingFilter").value="";$("#floorFilter").value="";$(".chips button",document).forEach(x=>x.classList.toggle("selected",!x.dataset.type));render();};
$('#logoutBtn').onclick=async()=>{if(!confirm('ต้องการออกจากระบบใช่หรือไม่?'))return;const button=$('#logoutBtn');button.disabled=true;try{await api('logout');state.user=null;updateUser();setActive();toast('ออกจากระบบแล้ว','success');}catch(e){toast(e.message,'error');}finally{button.disabled=false;}};
$('#closeModal').onclick=closeModal; $('#modal').onclick=e=>{if(e.target.id==='modal')closeModal();}; document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modal').classList.contains('show'))closeModal();});
$('#langBtn').onclick=()=>{const existing=$('.lang-menu');if(existing){existing.remove();return;}const menu=document.createElement('div');menu.className='lang-menu';menu.innerHTML='<button type="button" data-lang="th">ไทย (TH)</button><button type="button" data-lang="en">English (EN)</button>';$('.topbar').append(menu);menu.onclick=e=>{const lang=e.target.dataset.lang;if(lang){state.lang=lang;localStorage.setItem('ku-lang',lang);menu.remove();applyLocale();}};};
$('.menu-toggle').setAttribute('role','button'); $('.menu-toggle').setAttribute('tabindex','0'); $('.menu-toggle').setAttribute('aria-label','แสดงหรือซ่อนเมนู'); const toggleNav=()=>$('.sidebar nav').classList.toggle('nav-collapsed'); $('.menu-toggle').onclick=toggleNav; $('.menu-toggle').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleNav();}}; const bell=$('.top-actions .fa-bell'); bell.setAttribute('role','button');bell.setAttribute('tabindex','0');bell.setAttribute('aria-label','การแจ้งเตือน');bell.onclick=()=>toast(state.user?'ยังไม่มีการแจ้งเตือนใหม่':'เข้าสู่ระบบเพื่อดูการแจ้งเตือน','info');bell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();bell.click();}};
(async()=>{try{const x=await api('me');state.user=x.user;updateUser();}catch{} applyLocale();})(); if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');









/* Page-level navigation layer: keeps the existing visual system and gives each sidebar destination its own workspace. */
state.view = 'booking';
function showBookingPage(){state.view='booking';$('#pageView').hidden=true;$('.layout').hidden=false;$('.content>h2').textContent=state.lang==='en'?'Classroom booking':'จองห้องเรียน';setActive('booking');}
async function showRoomsPage(filter='all'){
  state.view='rooms';setActive('rooms');$('.layout').hidden=true;$('.content>h2').textContent=state.lang==='en'?'All classrooms':'ห้องเรียนทั้งหมด';const panel=$('#pageView');panel.hidden=false;panel.innerHTML=`<section class="card page-panel"><div class="page-heading"><div><h3>ห้องเรียนทั้งหมด</h3><p>เลือกอาคารหรือดูเฉพาะห้องที่ว่างในวันที่ ${esc(dateText($('#dateFilter').value))}</p></div><button type="button" class="text-btn" id="backToBooking"><i class="fa-solid fa-arrow-left"></i> กลับไปจองห้อง</button></div><div class="page-tabs" role="tablist"><button type="button" data-room-filter="all" class="selected">ทั้งหมด</button><button type="button" data-room-filter="available">ห้องว่าง</button><button type="button" data-room-filter="อาคาร 1">อาคาร 1</button><button type="button" data-room-filter="อาคาร 2">อาคาร 2</button><button type="button" data-room-filter="อาคาร 3">อาคาร 3</button></div><div class="page-result-meta" id="pageResultMeta">กำลังโหลดข้อมูล…</div><div class="room-list" id="pageRoomList"><p class="empty">กำลังโหลดข้อมูลห้อง…</p></div></section>`;
  $('#backToBooking').onclick=showBookingPage;$$('[data-room-filter]',panel).forEach(b=>b.onclick=()=>showRoomsPage(b.dataset.roomFilter));
  const buttons=$$('[data-room-filter]',panel);buttons.forEach(b=>b.classList.toggle('selected',b.dataset.roomFilter===filter));
  try{const q=new URLSearchParams({date:$('#dateFilter').value,time:$('#timeFilter').value});if(filter!=='all'&&filter!=='available')q.set('building',filter);const data=await api(`rooms&${q}`);let rooms=data.rooms||[];if(filter==='available')rooms=rooms.filter(r=>Number(r.taken)===0);$('#pageResultMeta').textContent=`พบ ${rooms.length} ห้อง`;$('#pageRoomList').innerHTML=rooms.length?rooms.map(roomCard).join(''):'<p class="empty">ไม่พบห้องตามตัวกรองนี้</p>';$('#pageRoomList').addEventListener('click',e=>{const b=e.target.closest('[data-book-room]');if(b)openBooking(Number(b.dataset.bookRoom));},{once:true});}catch(e){$('#pageRoomList').innerHTML='<p class="empty">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</p>';toast(e.message,'error');}
}
async function showSchedulePage(){state.view='schedule';setActive('schedule');$('.layout').hidden=true;$('.content>h2').textContent=state.lang==='en'?"Today's bookings":'ตารางการจองวันนี้';const panel=$('#pageView');panel.hidden=false;panel.innerHTML=`<section class="card page-panel"><div class="page-heading"><div><h3>ตารางการจองวันนี้</h3><p>${esc(dateText($('#dateFilter').value))}</p></div><button type="button" class="text-btn" id="scheduleBack"><i class="fa-solid fa-arrow-left"></i> กลับไปจองห้อง</button></div><div id="pageSchedule" class="schedule"><p class="empty">กำลังโหลดตาราง…</p></div></section>`;$('#scheduleBack').onclick=showBookingPage;try{const data=await api(`schedule&date=${$('#dateFilter').value}`);$('#pageSchedule').innerHTML=data.bookings?.length?data.bookings.map(b=>`<div><b>${esc(b.start_time.slice(0,5))}–${esc(b.end_time.slice(0,5))} · ${esc(b.building)} ${esc(b.room_no)}</b><span>${esc(b.teacher)} · ${esc(b.subject)}</span></div>`).join(''):'<p class="empty">วันนี้ยังไม่มีการจอง</p>';}catch(e){$('#pageSchedule').innerHTML='<p class="empty">โหลดตารางไม่สำเร็จ</p>';toast(e.message,'error');}}
const oldOpenAuth=openAuth;openAuth=function(mode='login'){state.modalOrigin='login';oldOpenAuth(mode);};
const oldCloseModal=closeModal;closeModal=function(){const origin=state.modalOrigin;oldCloseModal();state.modalOrigin='';if(origin==='login')setActive('booking');};
$('#loginNav').hidden=false;$('#loginNav').onclick=e=>{e.preventDefault();if(state.user){$('#logoutBtn').click();}else{setActive('login');openAuth('login');}};
const oldUpdateUser=updateUser;updateUser=function(){oldUpdateUser();const u=state.user;$('#loginNav').hidden=false;const icon=$('#loginNav i');const label=$('#loginNav span');if(u){icon.className='fa-solid fa-right-from-bracket';label.textContent=state.lang==='en'?'Sign out':'ออกจากระบบ';$('#loginNav').title=state.lang==='en'?'Sign out':'ออกจากระบบ';}else{icon.className='fa-solid fa-right-to-bracket';label.textContent=state.lang==='en'?'Teacher login':'เข้าสู่ระบบอาจารย์';$('#loginNav').title=state.lang==='en'?'Teacher login':'เข้าสู่ระบบอาจารย์';}};
$('[data-action="booking"]').onclick=e=>{e.preventDefault();showBookingPage();};$('[data-action="rooms"]').onclick=e=>{e.preventDefault();showRoomsPage('all');};$('[data-action="schedule"]').onclick=e=>{e.preventDefault();showSchedulePage();};
// Apply the final identity/navigation state after all handlers are installed.
updateUser();
setActive(state.view === 'rooms' ? 'rooms' : state.view === 'schedule' ? 'schedule' : 'booking');

/* Admin workspace + session hydration layer. It extends the existing visual system
   without replacing the page shell. The API remains the source of truth for all
   permissions and room mutations. */
const AUTH_IDLE_MS = 30 * 60 * 1000;
const AUTH_ACTIVITY_KEY = 'ku-auth-last-activity';
let authHydrated = false;
let activityTimer = null;

function markAuthActivity() {
  if (!state.user) return;
  const now = Date.now();
  const previous = Number(localStorage.getItem(AUTH_ACTIVITY_KEY) || 0);
  if (now - previous > 60 * 1000) localStorage.setItem(AUTH_ACTIVITY_KEY, String(now));
  if (activityTimer) clearTimeout(activityTimer);
  activityTimer = setTimeout(checkAuthIdle, AUTH_IDLE_MS + 1000);
}

async function expireAuthSession(message = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่') {
  try { await api('logout'); } catch (_) {}
  state.user = null;
  localStorage.removeItem(AUTH_ACTIVITY_KEY);
  updateUser();
  if (state.view === 'admin') showBookingPage();
  toast(message, 'info');
}

function checkAuthIdle() {
  if (!state.user) return;
  const last = Number(localStorage.getItem(AUTH_ACTIVITY_KEY) || Date.now());
  if (Date.now() - last >= AUTH_IDLE_MS) expireAuthSession();
  else {
    if (activityTimer) clearTimeout(activityTimer);
    activityTimer = setTimeout(checkAuthIdle, AUTH_IDLE_MS - (Date.now() - last) + 1000);
  }
}

['click', 'keydown', 'pointerdown', 'touchstart'].forEach(type =>
  document.addEventListener(type, markAuthActivity, { passive: true })
);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkAuthIdle(); });

/* Do not let the first synchronous render overwrite the server session while
   /me is still being checked. The backend remains authoritative after refresh. */
const hydratedUpdateUser = updateUser;
updateUser = function () {
  if (!authHydrated && state.user == null) return;
  hydratedUpdateUser();
  $('#loginNav').style.visibility = 'visible';
  if (state.user) { localStorage.setItem(AUTH_ACTIVITY_KEY, localStorage.getItem(AUTH_ACTIVITY_KEY) || String(Date.now())); markAuthActivity(); }
};
// Prevent a stale login label from flashing while the server session is hydrated.
$('#loginNav').style.visibility = 'hidden';

function roomFeatures(room) {
  if (!room) return [];
  if (Array.isArray(room.features)) return room.features.map(String).filter(Boolean);
  if (typeof room.features === 'string') {
    try { const parsed = JSON.parse(room.features); if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean); } catch (_) {}
    return room.features.split(',').map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function roomAdminCard(room) {
  const image = room.image_url || 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=500&q=80';
  const features = roomFeatures(room);
  const active = Number(room.active) === 1;
  return `<article class="room-card admin-room-card" data-admin-room-id="${esc(room.id)}">
    <img loading="lazy" src="${esc(image)}" alt="${esc(room.building)} ห้อง ${esc(room.room_no)}">
    <div class="room-info"><h4>${esc(room.building)} ห้อง ${esc(room.room_no)} <em>${esc(room.room_type)}</em></h4>
      <p>ชั้น ${esc(room.floor)} · ความจุ ${esc(room.capacity)} ที่นั่ง</p>
      <small>${features.length ? esc(features.join(' · ')) : 'ยังไม่ได้ระบุอุปกรณ์'} · ${active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</small>
    </div><div class="availability admin-room-actions">
      <b class="${active ? '' : 'busy'}">${active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}</b>
      <button type="button" class="text-btn edit-room-btn" data-room-id="${esc(room.id)}">แก้ไข</button>
      ${active ? `<button type="button" class="text-btn danger delete-room-btn" data-room-id="${esc(room.id)}">ลบห้อง</button>` : `<button type="button" class="text-btn restore-room-btn" data-room-id="${esc(room.id)}">เปิดใช้งาน</button>`}
    </div></article>`;
}

async function uploadRoomImage(file) {
  const data = new FormData(); data.append('image', file);
  const response = await fetch('api/index.php?action=upload-room-image', {method:'POST', credentials:'include', body:data});
  const result = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(result.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
  return result.image_url;
}

function roomEditor(room = null) {
  const editing = !!room;
  const features = roomFeatures(room).join(', ');
  openModal(`<h2>${editing ? 'แก้ไขข้อมูลห้อง' : 'เพิ่มห้องเรียน'}</h2>
    <p class="modal-sub">${editing ? 'ปรับข้อมูลห้องเดิม แล้วกดบันทึกเพื่อเผยแพร่ให้ผู้ใช้งานเห็น' : 'เพิ่มห้องใหม่ให้ผู้ใช้งานค้นหาและจองได้ทันที'}</p>
    <form id="roomEditorForm" class="room-editor-form">
      <div class="filter-grid"><label>อาคาร<input class="input" name="building" required maxlength="120" value="${esc(room?.building || '')}" placeholder="อาคาร 1"></label>
      <label>ชั้น<input class="input" name="floor" required type="number" min="1" max="200" value="${esc(room?.floor || '')}" placeholder="1"></label></div>
      <div class="filter-grid"><label>เลขห้อง<input class="input" name="room_no" required maxlength="50" value="${esc(room?.room_no || '')}" placeholder="101"></label>
      <label>ประเภทห้อง<input class="input" name="room_type" required maxlength="80" value="${esc(room?.room_type || '')}" placeholder="บรรยาย"></label></div>
      <label>ความจุ (ที่นั่ง)<input class="input" name="capacity" required type="number" min="1" max="10000" value="${esc(room?.capacity || '')}" placeholder="120"></label>
      <label>รูปภาพห้อง <small>(อัปโหลด JPG, PNG, WebP ไม่เกิน 5 MB)</small><input class="input" name="image_file" id="roomImageFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
      <label>หรือใช้ลิงก์รูปภาพ <small>(ถ้ามี)</small><input class="input" name="image_url" type="url" maxlength="500" value="${esc(room?.image_url || '')}" placeholder="https://..."></label>
      <img id="roomImagePreview" class="room-image-preview" src="${esc(room?.image_url || '')}" alt="ตัวอย่างรูปห้อง" ${room?.image_url ? '' : 'hidden'}>
      <label>อุปกรณ์ / สิ่งอำนวยความสะดวก <small>(คั่นด้วยเครื่องหมายจุลภาค)</small><input class="input" name="features" maxlength="1000" value="${esc(features)}" placeholder="โปรเจคเตอร์, ไมโครโฟน, เครื่องเสียง"></label>
      <label class="checkbox-line"><input type="checkbox" name="active" ${!room || Number(room.active) === 1 ? 'checked' : ''}> เปิดให้ค้นหาและจองห้องนี้</label>
      <div class="modal-actions"><button type="button" class="text-btn" id="cancelRoomEdit">ยกเลิก</button><button type="submit" class="confirm-btn">${editing ? 'บันทึกการแก้ไข' : 'เพิ่มห้องเรียน'}</button></div>
    </form>`);
  $('#cancelRoomEdit').onclick = closeModal;
  $('#roomImageFile').onchange = event => { const file=event.target.files?.[0]; if(!file) return; if(file.size>5*1024*1024){toast('รูปภาพต้องมีขนาดไม่เกิน 5 MB','error');event.target.value='';return;} const preview=$('#roomImagePreview'); preview.src=URL.createObjectURL(file); preview.hidden=false; };
  $('#roomEditorForm').onsubmit = async event => {
    event.preventDefault();
    const form = event.target;
    const submit = form.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(form));
    values.active = form.active.checked ? 1 : 0;
    values.features = values.features.split(',').map(v => v.trim()).filter(Boolean);
    if (editing) values.room_id = room.id;
    setBusy(submit, true, editing ? 'กำลังบันทึก…' : 'กำลังเพิ่มห้อง…');
    try {
      const imageFile=form.image_file.files?.[0]; if(imageFile) values.image_url=await uploadRoomImage(imageFile);
      delete values.image_file;
      await api(editing ? 'edit-room' : 'add-room', { method: 'POST', body: JSON.stringify(values) });
      closeModal(); toast(editing ? 'บันทึกข้อมูลห้องแล้ว' : 'เพิ่มห้องเรียนแล้ว', 'success');
      await loadAdminWorkspace();
    } catch (error) { toast(error.message, 'error'); }
    finally { setBusy(submit, false); }
  };
}

function adminConfirm(title, text, action, successMessage) {
  openModal(`<h2>${esc(title)}</h2><p class="modal-sub">${esc(text)}</p><div class="modal-actions"><button type="button" class="text-btn" id="cancelAdminConfirm">ยกเลิก</button><button type="button" class="confirm-btn danger" id="confirmAdminAction">ยืนยัน</button></div>`);
  $('#cancelAdminConfirm').onclick = closeModal;
  $('#confirmAdminAction').onclick = async event => {
    const button = event.currentTarget; setBusy(button, true, 'กำลังดำเนินการ…');
    try { await action(); closeModal(); toast(successMessage, 'success'); await loadAdminWorkspace(); }
    catch (error) { toast(error.message, 'error'); }
    finally { setBusy(button, false); }
  };
}

async function loadAdminWorkspace() {
  if (state.user?.role !== 'admin') return;
  const root = $('#adminWorkspace'); if (!root) return;
  const status = $('#adminRoomStatus');
  if (status) status.textContent = 'กำลังโหลดรายการห้อง…';
  try {
    const [roomsData, usersData] = await Promise.all([api('admin-rooms'), api('admin-users')]);
    const rooms = roomsData.rooms || [];
    const pending = (usersData.users || []).filter(user => user.status === 'pending');
    root.dataset.rooms = JSON.stringify(rooms);
    const roomList = $('#adminRoomList');
    if (roomList) roomList.innerHTML = rooms.length ? rooms.map(roomAdminCard).join('') : '<p class="empty">ยังไม่มีห้องเรียนในระบบ</p>';
    if (status) status.textContent = `ทั้งหมด ${rooms.length} ห้อง · เปิดใช้งาน ${rooms.filter(r => Number(r.active) === 1).length} ห้อง`;
    const pendingBox = $('#adminPendingUsers');
    const badge=$('#adminPendingBadge'); if(badge){badge.textContent=pending.length;badge.hidden=pending.length===0;}
    if (pendingBox) pendingBox.innerHTML = pending.length ? pending.map(user => `<div class="approval-row"><div><b>${esc(user.name)}</b><small>${esc(user.email)}</small></div><div class="approval-actions"><button class="approve-user" type="button" data-id="${esc(user.id)}">อนุมัติ</button><button class="reject-user" type="button" data-id="${esc(user.id)}">ไม่อนุมัติ</button></div></div>`).join('') : '<p class="empty">ไม่มีคำขออาจารย์ที่รออนุมัติ</p>';
  } catch (error) {
    if (status) status.textContent = 'โหลดรายการห้องไม่สำเร็จ';
    toast(error.message, 'error');
  }
}

async function showAdmin() {
  if (state.user?.role !== 'admin') { toast('หน้านี้สำหรับแอดมินเท่านั้น', 'error'); return; }
  state.view = 'admin'; setActive('admin'); $('.layout').hidden = true; $('.content>h2').textContent='จัดการระบบ';
  const panel = $('#pageView'); panel.hidden = false;
  panel.innerHTML = `<section class="card page-panel admin-workspace" id="adminWorkspace">
    <div class="page-heading"><div><h3>จัดการระบบ</h3><p>เลือกงานที่ต้องการจากแท็บด้านล่าง</p></div><button type="button" class="text-btn" id="adminBack"><i class="fa-solid fa-arrow-left"></i> กลับไปจองห้อง</button></div>
    <div class="admin-tabs"><button type="button" class="admin-tab selected" data-admin-tab="rooms">จัดการห้อง</button><button type="button" class="admin-tab" data-admin-tab="approvals">อนุมัติคำขอ <span class="admin-badge" id="adminPendingBadge" hidden>0</span></button></div>
    <section id="adminRoomsPane"><div class="admin-toolbar"><div><strong>รายการห้องเรียน</strong><div class="page-result-meta" id="adminRoomStatus">กำลังโหลดรายการห้อง…</div></div><button type="button" class="confirm-btn" id="addRoomBtn"><i class="fa-solid fa-plus"></i> เพิ่มห้องเรียน</button></div>
    <div class="admin-room-filters"><label>ค้นหาห้อง<input class="input" id="adminRoomSearch" placeholder="อาคาร หรือเลขห้อง"></label><label>สถานะ<select class="input" id="adminRoomStatusFilter"><option value="all">ทั้งหมด</option><option value="active">เปิดใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></label></div>
    <div class="room-list admin-room-list" id="adminRoomList"><p class="empty">กำลังโหลดข้อมูลห้อง…</p></div></section>
    <section id="adminApprovalsPane" class="admin-approvals" hidden><h4>คำขออาจารย์</h4><p class="modal-sub">ตรวจสอบคำขอและเลือกอนุมัติหรือไม่อนุมัติ</p><div id="adminPendingUsers"><p class="empty">กำลังโหลดคำขอ…</p></div></section>
  </section>`;
  $('#adminBack').onclick = showBookingPage;
  $('#addRoomBtn').onclick = () => roomEditor();
  $('#adminRoomSearch').oninput = filterAdminRooms;
  $('#adminRoomStatusFilter').onchange = filterAdminRooms;
  $$('.admin-tab').forEach(tab=>tab.onclick=()=>{const target=tab.dataset.adminTab;$$('.admin-tab').forEach(x=>x.classList.toggle('selected',x===tab));$('#adminRoomsPane').hidden=target!=='rooms';$('#adminApprovalsPane').hidden=target!=='approvals';});
  $('#adminRoomList').onclick = event => {
    const target = event.target.closest('[data-room-id]'); if (!target) return;
    const rooms = JSON.parse($('#adminWorkspace').dataset.rooms || '[]'); const room = rooms.find(item => Number(item.id) === Number(target.dataset.roomId)); if (!room) return;
    if (target.classList.contains('edit-room-btn')) roomEditor(room);
    if (target.classList.contains('delete-room-btn')) adminConfirm('ลบห้องเรียน?', `ห้อง ${room.building} ${room.room_no} จะถูกซ่อนจากการค้นหาและการจอง`, () => api('delete-room', { method: 'POST', body: JSON.stringify({ room_id: room.id }) }), 'ลบห้องเรียนแล้ว');
    if (target.classList.contains('restore-room-btn')) adminConfirm('เปิดใช้งานห้อง?', `ห้อง ${room.building} ${room.room_no} จะกลับมาให้ค้นหาและจองได้`, () => api('restore-room', { method: 'POST', body: JSON.stringify({ room_id: room.id }) }), 'เปิดใช้งานห้องแล้ว');
  };
  $('#adminPendingUsers').onclick = async event => {
    const approve = event.target.closest('.approve-user'); const reject = event.target.closest('.reject-user'); const button=approve||reject; if (!button) return;
    const status=approve?'active':'rejected'; const message=approve?'อนุมัติอาจารย์รายนี้ใช่หรือไม่?':'ไม่อนุมัติคำขออาจารย์รายนี้ใช่หรือไม่?';
    adminConfirm(approve?'อนุมัติคำขอ':'ไม่อนุมัติคำขอ',message,()=>api('review-user',{method:'POST',body:JSON.stringify({user_id:button.dataset.id,status})}),approve?'อนุมัติบัญชีแล้ว':'ไม่อนุมัติคำขอแล้ว');
  };
  await loadAdminWorkspace();
}

function filterAdminRooms() {
  const root = $('#adminWorkspace'); const list = $('#adminRoomList'); if (!root || !list) return;
  const term = ($('#adminRoomSearch')?.value || '').trim().toLowerCase(); const status = $('#adminRoomStatusFilter')?.value || 'all';
  const rooms = JSON.parse(root.dataset.rooms || '[]').filter(room => {
    const matchesTerm = !term || `${room.building} ${room.room_no} ${room.room_type}`.toLowerCase().includes(term);
    const matchesStatus = status === 'all' || (status === 'active' ? Number(room.active) === 1 : Number(room.active) !== 1);
    return matchesTerm && matchesStatus;
  });
  list.innerHTML = rooms.length ? rooms.map(roomAdminCard).join('') : '<p class="empty">ไม่พบห้องตามตัวกรอง</p>';
}

// Replace the earlier modal based admin action with the full page workspace.
$('[data-action="admin"]').onclick = event => { event.preventDefault(); showAdmin(); };

// Rehydrate the current user once, then update controls. A refresh therefore
// keeps the authenticated navigation state instead of flashing teacher login.
(async function hydrateSession() {
  try {
    const result = await api('me');
    state.user = result.user || null;
    const last = Number(localStorage.getItem(AUTH_ACTIVITY_KEY) || 0);
    if (state.user && last && Date.now() - last >= AUTH_IDLE_MS) await expireAuthSession();
  } catch (_) { state.user = null; }
  authHydrated = true;
  updateUser();
  if (state.user) markAuthActivity();
})();

