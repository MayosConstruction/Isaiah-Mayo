// Mayo Construction CRM — front end (plain JavaScript, no build step).
'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $('#view');
const PEOPLE = ['Both', 'Isaiah', 'Moss'];
const ESTIMATE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'];
const IN_CATEGORIES = ['Job payment', 'Deposit', 'Other income'];
const OUT_CATEGORIES = ['Materials', 'Fuel', 'Tools & equipment', 'Subcontractor', 'Dump / disposal', 'Insurance', 'Vehicle', 'Permits', 'Office / phone', 'Other expense'];
const DOC_KINDS = ['Signed contract', 'Unsigned contract', 'Change order', 'Receipt', 'Photo', 'Other'];
let me = null;
let customersCache = null;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) {
  const v = Number(n) || 0;
  return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return dateStr(new Date()); }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDate(s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (!s) return '';
  return parseDate(s).toLocaleDateString('en-US', opts);
}
function fmtLongDate(s) { return fmtDate(s, { month: 'long', day: 'numeric', year: 'numeric' }); }
function fmtTime(t) {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${pad(m)}${ap}`;
}
function relDay(s) {
  const diff = Math.round((parseDate(s) - parseDate(todayStr())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return fmtDate(s);
}

async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mayo-crm' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/login') { showLogin(); throw new Error('Please log in'); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return out;
}

async function customers(force) {
  if (!customersCache || force) customersCache = await api('GET', '/customers');
  return customersCache;
}
function customerName(id) {
  const c = (customersCache || []).find((x) => x.id === id);
  return c ? c.name : '';
}
function customerOptions(selected, blankLabel = '— None —') {
  return `<option value="">${blankLabel}</option>` +
    (customersCache || []).map((c) => `<option value="${c.id}" ${c.id === Number(selected) ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}
function options(list, selected) {
  return list.map((v) => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

// Modal: openModal(html, { onSubmit(data, form), onDelete, onReady(body) })
function openModal(html, { onSubmit, onDelete, onReady } = {}) {
  const dlg = $('#modal');
  const body = $('#modal-body');
  body.innerHTML = html;
  const form = $('form', body);
  if (form && onSubmit) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', form);
      if (btn) btn.disabled = true;
      try {
        await onSubmit(formData(form), form);
        dlg.close();
      } catch (err) {
        alert(err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }
  const del = $('[data-delete]', body);
  if (del && onDelete) {
    del.addEventListener('click', async () => {
      if (!confirm('Delete this? This cannot be undone.')) return;
      try { await onDelete(); dlg.close(); } catch (err) { alert(err.message); }
    });
  }
  $$('[data-close]', body).forEach((b) => b.addEventListener('click', () => dlg.close()));
  if (onReady) onReady(body);
  dlg.showModal();
}
function modalActions(isEdit) {
  return `<div class="modal-actions">
    ${isEdit ? '<button type="button" class="btn danger left" data-delete>Delete</button>' : ''}
    <button type="button" class="btn" data-close>Cancel</button>
    <button type="submit" class="btn primary">Save</button>
  </div>`;
}

function estimateTotals(est) {
  const items = typeof est.items === 'string' ? JSON.parse(est.items || '[]') : (est.items || []);
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const tax = subtotal * (Number(est.tax_rate) || 0) / 100;
  return { items, subtotal, tax, total: subtotal + tax };
}

// ---------------------------------------------------------------------------
// Shared forms (used from several pages)
// ---------------------------------------------------------------------------
async function editTodo(todo = {}, after) {
  await customers();
  const isEdit = !!todo.id;
  openModal(`
    <form>
      <h2>${isEdit ? 'Edit to-do' : 'New to-do'}</h2>
      <label>What needs done? <input name="title" required value="${esc(todo.title)}"></label>
      <div class="form-grid">
        <label>Due date <input type="date" name="due_date" value="${esc(todo.due_date)}"></label>
        <label>Who <select name="assigned_to">${options(PEOPLE, todo.assigned_to || 'Both')}</select></label>
      </div>
      <label>Customer (optional) <select name="customer_id">${customerOptions(todo.customer_id)}</select></label>
      <label>Notes <textarea name="notes">${esc(todo.notes)}</textarea></label>
      ${isEdit ? `<label class="row"><input type="checkbox" name="done" ${todo.done ? 'checked' : ''}> Done</label>` : ''}
      ${modalActions(isEdit)}
    </form>`, {
    onSubmit: async (d) => {
      if (isEdit) await api('PUT', `/todos/${todo.id}`, d); else await api('POST', '/todos', d);
      toast('Saved'); after && after();
    },
    onDelete: async () => { await api('DELETE', `/todos/${todo.id}`); toast('Deleted'); after && after(); },
  });
}

async function editEvent(ev = {}, after) {
  await customers();
  const isEdit = !!ev.id;
  openModal(`
    <form>
      <h2>${isEdit ? 'Edit appointment' : 'New appointment'}</h2>
      <label>What <input name="title" required value="${esc(ev.title)}" placeholder="e.g. Measure deck, Start roof job"></label>
      <div class="form-grid">
        <label>Date <input type="date" name="date" required value="${esc(ev.date || todayStr())}"></label>
        <label>Who <select name="assigned_to">${options(PEOPLE, ev.assigned_to || 'Both')}</select></label>
        <label>Start time <input type="time" name="start_time" value="${esc(ev.start_time)}"></label>
        <label>End time <input type="time" name="end_time" value="${esc(ev.end_time)}"></label>
      </div>
      <label>Customer (optional) <select name="customer_id">${customerOptions(ev.customer_id)}</select></label>
      <label>Location <input name="location" value="${esc(ev.location)}" placeholder="Address"></label>
      <label>Notes <textarea name="notes">${esc(ev.notes)}</textarea></label>
      ${modalActions(isEdit)}
    </form>`, {
    onSubmit: async (d) => {
      if (isEdit) await api('PUT', `/events/${ev.id}`, d); else await api('POST', '/events', d);
      toast('Saved'); after && after();
    },
    onDelete: async () => { await api('DELETE', `/events/${ev.id}`); toast('Deleted'); after && after(); },
    onReady: (body) => {
      // Fill location from the customer's address if blank.
      $('[name=customer_id]', body).addEventListener('change', (e) => {
        const loc = $('[name=location]', body);
        const c = customersCache.find((x) => x.id === Number(e.target.value));
        if (c && c.address && !loc.value) loc.value = c.address;
      });
    },
  });
}

async function editTransaction(tx = {}, after) {
  await customers();
  const isEdit = !!tx.id;
  const type = tx.type || 'in';
  openModal(`
    <form>
      <h2>${isEdit ? 'Edit entry' : 'Add money in / out'}</h2>
      <div class="tabs" id="type-tabs">
        <button type="button" class="btn ${type === 'in' ? 'active' : ''}" data-type="in">Money in</button>
        <button type="button" class="btn ${type === 'out' ? 'active' : ''}" data-type="out">Money out</button>
      </div>
      <input type="hidden" name="type" value="${type}">
      <div class="form-grid">
        <label>Amount ($) <input type="number" step="0.01" min="0" name="amount" required value="${esc(tx.amount)}" inputmode="decimal"></label>
        <label>Date <input type="date" name="date" required value="${esc(tx.date || todayStr())}"></label>
        <label>Category <input name="category" list="cat-list" value="${esc(tx.category)}"></label>
        <label id="paid-by-label">Paid with <select name="paid_by">${options(['Business', 'Isaiah', 'Moss'], tx.paid_by || 'Business')}</select></label>
      </div>
      <datalist id="cat-list"></datalist>
      <label>Customer / job (optional) <select name="customer_id">${customerOptions(tx.customer_id)}</select></label>
      <label>Description <input name="description" value="${esc(tx.description)}" placeholder="e.g. Lumber from Lowe's, Smith deposit"></label>
      ${modalActions(isEdit)}
    </form>`, {
    onSubmit: async (d) => {
      if (d.type === 'in') d.paid_by = null;
      if (isEdit) await api('PUT', `/transactions/${tx.id}`, d); else await api('POST', '/transactions', d);
      toast('Saved'); after && after();
    },
    onDelete: async () => { await api('DELETE', `/transactions/${tx.id}`); toast('Deleted'); after && after(); },
    onReady: (body) => {
      const setType = (t) => {
        $('[name=type]', body).value = t;
        $$('#type-tabs .btn', body).forEach((b) => b.classList.toggle('active', b.dataset.type === t));
        $('#cat-list', body).innerHTML = (t === 'in' ? IN_CATEGORIES : OUT_CATEGORIES).map((c) => `<option value="${esc(c)}">`).join('');
        $('#paid-by-label', body).classList.toggle('hidden', t === 'in');
      };
      $$('#type-tabs .btn', body).forEach((b) => b.addEventListener('click', () => setType(b.dataset.type)));
      setType(type);
    },
  });
}

async function editCustomer(c = {}, after) {
  const isEdit = !!c.id;
  openModal(`
    <form>
      <h2>${isEdit ? 'Edit customer' : 'New customer'}</h2>
      <label>Name <input name="name" required value="${esc(c.name)}"></label>
      <div class="form-grid">
        <label>Phone <input type="tel" name="phone" value="${esc(c.phone)}"></label>
        <label>Email <input type="email" name="email" value="${esc(c.email)}"></label>
      </div>
      <label>Address <input name="address" value="${esc(c.address)}"></label>
      <label>Notes <textarea name="notes" placeholder="Gate code, dog, how they found us...">${esc(c.notes)}</textarea></label>
      ${modalActions(isEdit)}
    </form>`, {
    onSubmit: async (d) => {
      const saved = isEdit ? await api('PUT', `/customers/${c.id}`, d) : await api('POST', '/customers', d);
      await customers(true);
      toast('Saved'); after && after(saved);
    },
    onDelete: async () => {
      await api('DELETE', `/customers/${c.id}`);
      await customers(true);
      toast('Deleted'); location.hash = '#/customers';
    },
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

async function uploadDocument(preset = {}, after) {
  await customers();
  openModal(`
    <form>
      <h2>Upload a document</h2>
      <p class="muted">Snap a photo of a signed contract or pick a PDF.</p>
      <label>File <input type="file" name="file" required accept="image/*,application/pdf,.doc,.docx"></label>
      <label>Name <input name="name" required placeholder="e.g. Smith deck contract - signed" value="${esc(preset.name)}"></label>
      <div class="form-grid">
        <label>Type <select name="kind">${options(DOC_KINDS, preset.kind || 'Signed contract')}</select></label>
        <label>Customer <select name="customer_id">${customerOptions(preset.customer_id)}</select></label>
      </div>
      ${modalActions(false).replace('>Save<', '>Upload<')}
    </form>`, {
    onSubmit: async (d, form) => {
      const file = form.elements.file.files[0];
      if (!file) throw new Error('Pick a file');
      if (file.size > 20 * 1024 * 1024) throw new Error('That file is over 20 MB');
      const data = await fileToBase64(file);
      await api('POST', '/documents', { name: d.name, kind: d.kind, customer_id: d.customer_id, original_name: file.name, mime: file.type, data });
      toast('Uploaded'); after && after();
    },
    onReady: (body) => {
      $('[name=file]', body).addEventListener('change', (e) => {
        const n = $('[name=name]', body);
        const f = e.target.files[0];
        if (f && !n.value) n.value = f.name.replace(/\.[^.]+$/, '');
      });
    },
  });
}

function docRow(d) {
  const size = d.size > 1048576 ? (d.size / 1048576).toFixed(1) + ' MB' : Math.ceil(d.size / 1024) + ' KB';
  return `<li class="doc-row">
    <div class="grow">
      <div class="title"><a href="/api/documents/${d.id}/file" target="_blank" rel="noopener">${esc(d.name)}</a></div>
      <div class="sub">${esc(d.kind)}${d.customer_id ? ' · ' + esc(customerName(d.customer_id)) : ''} · ${size} · ${esc(d.uploaded_by || '')} ${esc((d.created_at || '').slice(0, 10))}</div>
    </div>
    <a class="btn small" href="/api/documents/${d.id}/file?download=1">Download</a>
    <button class="btn small danger" data-del-doc="${d.id}">Delete</button>
  </li>`;
}
function wireDocDeletes(root, after) {
  $$('[data-del-doc]', root).forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this document?')) return;
    await api('DELETE', `/documents/${b.dataset.delDoc}`);
    toast('Deleted'); after();
  }));
}

function todoRow(t) {
  const overdue = !t.done && t.due_date && t.due_date < todayStr();
  return `<li class="${t.done ? 'done' : ''}">
    <input type="checkbox" data-todo-check="${t.id}" ${t.done ? 'checked' : ''} aria-label="Done">
    <div class="grow clickable" data-todo-edit="${t.id}" style="cursor:pointer">
      <div class="title">${esc(t.title)}</div>
      <div class="sub">
        ${t.due_date ? `<span class="pill ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue · ' : ''}${relDay(t.due_date)}</span>` : ''}
        ${t.assigned_to && t.assigned_to !== 'Both' ? esc(t.assigned_to) : 'Both'}
        ${t.customer_id ? ' · ' + esc(customerName(t.customer_id)) : ''}
      </div>
    </div>
  </li>`;
}
function wireTodos(root, list, after) {
  $$('[data-todo-check]', root).forEach((cb) => cb.addEventListener('change', async () => {
    await api('PUT', `/todos/${cb.dataset.todoCheck}`, { done: cb.checked });
    if (cb.checked) toast('Nice — done!');
    after();
  }));
  $$('[data-todo-edit]', root).forEach((el) => el.addEventListener('click', () => {
    editTodo(list.find((t) => t.id === Number(el.dataset.todoEdit)), after);
  }));
}

function eventRow(e) {
  const time = e.start_time ? fmtTime(e.start_time) + (e.end_time ? '–' + fmtTime(e.end_time) : '') : 'Any time';
  return `<li class="clickable" data-event="${e.id}">
    <div class="grow">
      <div class="title">${esc(e.title)}</div>
      <div class="sub">${time} · ${esc(e.assigned_to || 'Both')}${e.customer_id ? ' · ' + esc(customerName(e.customer_id)) : ''}${e.location ? ' · ' + esc(e.location) : ''}</div>
    </div>
  </li>`;
}
function wireEvents(root, list, after) {
  $$('[data-event]', root).forEach((el) => el.addEventListener('click', () => editEvent(list.find((e) => e.id === Number(el.dataset.event)), after)));
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
async function pageHome() {
  await customers();
  const s = await api('GET', '/summary');
  const half = s.month.net / 2;
  const greet = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const byDay = {};
  s.events.forEach((e) => (byDay[e.date] = byDay[e.date] || []).push(e));
  view.innerHTML = `
    <div class="spread">
      <h2>${greet}, ${esc(me.name)}</h2>
      <div class="row">
        <button class="btn" id="q-todo">+ To-do</button>
        <button class="btn" id="q-event">+ Appointment</button>
        <button class="btn primary" id="q-money">+ Money</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">In this month</div><div class="value green">${money(s.month.in)}</div></div>
      <div class="stat"><div class="label">Out this month</div><div class="value red">${money(s.month.out)}</div></div>
      <div class="stat"><div class="label">Profit this month</div><div class="value">${money(s.month.net)}</div></div>
      <div class="stat"><div class="label">Each partner (50%)</div><div class="value">${money(half)}</div></div>
    </div>
    <div class="grid">
      <div class="card">
        <div class="spread"><h3>To-do ${s.overdue ? `<span class="pill overdue">${s.overdue} overdue</span>` : ''}</h3><a href="#/todos">All</a></div>
        <ul class="list" id="home-todos">${s.todos.map(todoRow).join('') || '<li class="empty">Nothing to do. Enjoy it.</li>'}</ul>
      </div>
      <div class="card">
        <div class="spread"><h3>Next 7 days</h3><a href="#/schedule">Schedule</a></div>
        <div id="home-events">${Object.keys(byDay).map((d) => `<div class="day-head">${relDay(d)}</div><ul class="list">${byDay[d].map(eventRow).join('')}</ul>`).join('') || '<p class="empty">Nothing scheduled.</p>'}</div>
      </div>
      <div class="card">
        <div class="spread"><h3>Open estimates</h3><a href="#/estimates">All</a></div>
        <ul class="list">${s.openEstimates.map((e) => `<li class="clickable" onclick="location.hash='#/estimates/${e.id}'">
          <div class="grow"><div class="title">${esc(e.number)} · ${esc(customerName(e.customer_id) || 'No customer')}</div><div class="sub">${esc(e.title || '')}</div></div>
          <span class="pill ${e.status}">${e.status}</span><strong>${money(estimateTotals(e).total)}</strong></li>`).join('') || '<li class="empty">No open estimates.</li>'}</ul>
      </div>
      <div class="card">
        <h3>This year so far</h3>
        <table class="totals">
          <tr><td>Money in</td><td class="num green">${money(s.year.in)}</td></tr>
          <tr><td>Money out</td><td class="num red">${money(s.year.out)}</td></tr>
          <tr><td><strong>Profit</strong></td><td class="num"><strong>${money(s.year.net)}</strong></td></tr>
          <tr><td>Isaiah's half</td><td class="num">${money(s.year.net / 2)}</td></tr>
          <tr><td>Moss's half</td><td class="num">${money(s.year.net / 2)}</td></tr>
        </table>
        <p class="muted" style="margin-top:.5rem">${s.customerCount} customers on file</p>
      </div>
    </div>`;
  wireTodos($('#home-todos'), s.todos, pageHome);
  wireEvents($('#home-events'), s.events, pageHome);
  $('#q-todo').onclick = () => editTodo({}, pageHome);
  $('#q-event').onclick = () => editEvent({}, pageHome);
  $('#q-money').onclick = () => editTransaction({}, pageHome);
}

const todoFilter = { show: 'open', who: 'Everyone' };
async function pageTodos() {
  await customers();
  const all = await api('GET', '/todos');
  const list = all.filter((t) =>
    (todoFilter.show === 'all' || (todoFilter.show === 'open' ? !t.done : t.done)) &&
    (todoFilter.who === 'Everyone' || t.assigned_to === todoFilter.who || t.assigned_to === 'Both'));
  view.innerHTML = `
    <div class="spread"><h2>To-Do</h2><button class="btn primary" id="add">+ New to-do</button></div>
    <form class="card row" id="quick">
      <input name="title" placeholder="Quick add: e.g. Pick up shingles" required style="flex:2;min-width:180px;margin:0">
      <input type="date" name="due_date" style="flex:1;min-width:140px;margin:0">
      <select name="assigned_to" style="flex:1;min-width:100px;margin:0">${options(PEOPLE, 'Both')}</select>
      <button class="btn primary">Add</button>
    </form>
    <div class="row" style="margin-bottom:.75rem">
      <div class="tabs" style="margin:0">${['open', 'done', 'all'].map((v) => `<button class="btn small ${todoFilter.show === v ? 'active' : ''}" data-show="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
      <select id="who" style="width:auto;margin:0">${options(['Everyone', 'Isaiah', 'Moss'], todoFilter.who)}</select>
    </div>
    <div class="card"><ul class="list" id="todo-list">${list.map(todoRow).join('') || '<li class="empty">Nothing here.</li>'}</ul></div>`;
  wireTodos($('#todo-list'), list, pageTodos);
  $('#add').onclick = () => editTodo({}, pageTodos);
  $('#quick').onsubmit = async (e) => {
    e.preventDefault();
    await api('POST', '/todos', formData(e.target));
    pageTodos();
  };
  $$('[data-show]').forEach((b) => (b.onclick = () => { todoFilter.show = b.dataset.show; pageTodos(); }));
  $('#who').onchange = (e) => { todoFilter.who = e.target.value; pageTodos(); };
}

const sched = { mode: 'list', month: todayStr().slice(0, 7) };
async function pageSchedule() {
  await customers();
  let events;
  let body;
  if (sched.mode === 'list') {
    events = await api('GET', `/events?from=${todayStr()}`);
    const byDay = {};
    events.forEach((e) => (byDay[e.date] = byDay[e.date] || []).push(e));
    body = `<div class="card" id="ev-wrap">${Object.keys(byDay).map((d) => `<div class="day-head">${relDay(d)} <span class="muted" style="font-weight:400">${fmtLongDate(d)}</span></div><ul class="list">${byDay[d].map(eventRow).join('')}</ul>`).join('') || '<p class="empty">Nothing coming up. Add an appointment.</p>'}</div>`;
  } else {
    const [y, m] = sched.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 41);
    events = await api('GET', `/events?from=${dateStr(start)}&to=${dateStr(end)}`);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ds = dateStr(d);
      const evs = events.filter((e) => e.date === ds);
      cells.push(`<div class="day ${d.getMonth() !== m - 1 ? 'other' : ''} ${ds === todayStr() ? 'today' : ''}" data-day="${ds}">
        <div>${d.getDate()}</div>${evs.map((e) => `<div class="ev" data-event="${e.id}" title="${esc(fmtTime(e.start_time))}">${esc(e.title)}</div>`).join('')}</div>`);
    }
    body = `<div class="card">
      <div class="spread">
        <button class="btn small" id="prev">‹ Prev</button>
        <h3 style="margin:0">${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        <button class="btn small" id="next">Next ›</button>
      </div>
      <div class="cal" id="ev-wrap">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>
      <p class="muted" style="font-size:.85rem">Tap a day to add an appointment.</p>
    </div>`;
  }
  view.innerHTML = `
    <div class="spread"><h2>Schedule</h2><button class="btn primary" id="add">+ Appointment</button></div>
    <div class="tabs">
      <button class="btn small ${sched.mode === 'list' ? 'active' : ''}" data-mode="list">Upcoming</button>
      <button class="btn small ${sched.mode === 'month' ? 'active' : ''}" data-mode="month">Month</button>
    </div>
    ${body}`;
  $('#add').onclick = () => editEvent({}, pageSchedule);
  $$('[data-mode]').forEach((b) => (b.onclick = () => { sched.mode = b.dataset.mode; pageSchedule(); }));
  wireEvents($('#ev-wrap'), events, pageSchedule);
  if (sched.mode === 'month') {
    const shift = (n) => { const [y, m] = sched.month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); sched.month = dateStr(d).slice(0, 7); pageSchedule(); };
    $('#prev').onclick = () => shift(-1);
    $('#next').onclick = () => shift(1);
    $$('[data-day]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('[data-event]')) { e.stopPropagation(); return; }
      editEvent({ date: el.dataset.day }, pageSchedule);
    }));
    $$('.cal [data-event]').forEach((el) => el.addEventListener('click', (e) => e.stopPropagation(), true));
  }
}

async function pageCustomers() {
  const list = await customers(true);
  view.innerHTML = `
    <div class="spread"><h2>Customers</h2><button class="btn primary" id="add">+ New customer</button></div>
    <input id="search" placeholder="Search name, phone, address..." style="margin-bottom:1rem">
    <div class="card"><ul class="list" id="cust-list"></ul></div>`;
  const render = (q = '') => {
    q = q.toLowerCase();
    const rows = list.filter((c) => [c.name, c.phone, c.email, c.address].join(' ').toLowerCase().includes(q));
    $('#cust-list').innerHTML = rows.map((c) => `<li class="clickable" onclick="location.hash='#/customers/${c.id}'">
      <div class="grow"><div class="title">${esc(c.name)}</div><div class="sub">${esc([c.phone, c.address].filter(Boolean).join(' · '))}</div></div>
      <span class="muted">›</span></li>`).join('') || `<li class="empty">${list.length ? 'No matches.' : 'No customers yet. Add your first one.'}</li>`;
  };
  render();
  $('#search').oninput = (e) => render(e.target.value);
  $('#add').onclick = () => editCustomer({}, (c) => (location.hash = `#/customers/${c.id}`));
}

async function pageCustomer(id) {
  await customers();
  const c = await api('GET', `/customers/${id}`);
  const [ests, txs, docs, evs, todos] = await Promise.all([
    api('GET', `/estimates?customer_id=${id}`),
    api('GET', `/transactions?customer_id=${id}`),
    api('GET', `/documents?customer_id=${id}`),
    api('GET', `/events?customer_id=${id}`),
    api('GET', `/todos?customer_id=${id}`),
  ]);
  const paid = txs.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const spent = txs.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const reload = () => pageCustomer(id);
  const tel = (c.phone || '').replace(/[^\d+]/g, '');
  view.innerHTML = `
    <p><a href="#/customers">‹ All customers</a></p>
    <div class="card">
      <div class="spread"><h2 style="margin:0">${esc(c.name)}</h2><button class="btn" id="edit">Edit</button></div>
      ${c.phone ? `<div>📞 ${esc(c.phone)} &nbsp; <a href="tel:${esc(tel)}">Call</a> · <a href="sms:${esc(tel)}">Text</a></div>` : ''}
      ${c.email ? `<div>✉️ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ''}
      ${c.address ? `<div>📍 <a href="https://maps.google.com/?q=${encodeURIComponent(c.address)}" target="_blank" rel="noopener">${esc(c.address)}</a></div>` : ''}
      ${c.notes ? `<p class="muted" style="white-space:pre-wrap">${esc(c.notes)}</p>` : ''}
      <div class="row" style="margin-top:.75rem">
        <a class="btn primary" href="#/estimates/new?customer=${id}">+ Estimate</a>
        <button class="btn" id="add-ev">+ Appointment</button>
        <button class="btn" id="add-todo">+ To-do</button>
        <button class="btn" id="add-pay">+ Payment / expense</button>
        <a class="btn" href="#/contracts/new?customer=${id}">Create contract</a>
        <button class="btn" id="add-doc">Upload signed contract</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">They've paid</div><div class="value green">${money(paid)}</div></div>
      <div class="stat"><div class="label">Spent on their jobs</div><div class="value red">${money(spent)}</div></div>
      <div class="stat"><div class="label">Profit</div><div class="value">${money(paid - spent)}</div></div>
    </div>
    <div class="grid">
      <div class="card"><h3>Estimates</h3><ul class="list">${ests.map((e) => `<li class="clickable" onclick="location.hash='#/estimates/${e.id}'">
        <div class="grow"><div class="title">${esc(e.number)} ${esc(e.title || '')}</div><div class="sub">${fmtDate(e.date)}</div></div>
        <span class="pill ${e.status}">${e.status}</span><strong>${money(estimateTotals(e).total)}</strong></li>`).join('') || '<li class="empty">None yet.</li>'}</ul></div>
      <div class="card"><h3>Documents & contracts</h3><ul class="list" id="c-docs">${docs.map(docRow).join('') || '<li class="empty">None yet.</li>'}</ul></div>
      <div class="card"><h3>Appointments</h3><ul class="list" id="c-evs">${evs.map((e) => eventRow(e).replace('<div class="title">', `<div class="title">${fmtDate(e.date)} · `)).join('') || '<li class="empty">None.</li>'}</ul></div>
      <div class="card"><h3>To-dos</h3><ul class="list" id="c-todos">${todos.map(todoRow).join('') || '<li class="empty">None.</li>'}</ul></div>
      <div class="card"><h3>Money</h3><ul class="list" id="c-txs">${txs.map(txRow).join('') || '<li class="empty">None.</li>'}</ul></div>
    </div>`;
  $('#edit').onclick = () => editCustomer(c, reload);
  $('#add-ev').onclick = () => editEvent({ customer_id: c.id, location: c.address }, reload);
  $('#add-todo').onclick = () => editTodo({ customer_id: c.id }, reload);
  $('#add-pay').onclick = () => editTransaction({ customer_id: c.id }, reload);
  $('#add-doc').onclick = () => uploadDocument({ customer_id: c.id, name: `${c.name} - signed contract` }, reload);
  wireDocDeletes($('#c-docs'), reload);
  wireEvents($('#c-evs'), evs, reload);
  wireTodos($('#c-todos'), todos, reload);
  wireTxs($('#c-txs'), txs, reload);
}

async function pageEstimates() {
  await customers();
  const list = await api('GET', '/estimates');
  view.innerHTML = `
    <div class="spread"><h2>Estimates</h2><a class="btn primary" href="#/estimates/new">+ New estimate</a></div>
    <div class="card"><ul class="list">${list.map((e) => `<li class="clickable" onclick="location.hash='#/estimates/${e.id}'">
      <div class="grow"><div class="title">${esc(e.number)} · ${esc(customerName(e.customer_id) || 'No customer')}</div>
      <div class="sub">${esc(e.title || '')} · ${fmtDate(e.date)}</div></div>
      <span class="pill ${e.status}">${e.status}</span><strong>${money(estimateTotals(e).total)}</strong></li>`).join('') || '<li class="empty">No estimates yet.</li>'}</ul></div>`;
}

async function pageEstimateEdit(id, query) {
  await customers();
  const est = id === 'new'
    ? { customer_id: Number(query.get('customer')) || null, date: todayStr(), status: 'Draft', items: [{ desc: '', qty: 1, price: '' }], tax_rate: 0 }
    : await api('GET', `/estimates/${id}`);
  const items = typeof est.items === 'string' ? JSON.parse(est.items || '[]') : est.items;
  view.innerHTML = `
    <p><a href="#/estimates">‹ All estimates</a></p>
    <form class="card" id="est-form">
      <div class="spread"><h2 style="margin:0">${id === 'new' ? 'New estimate' : 'Estimate ' + esc(est.number)}</h2>
        ${id !== 'new' ? `<div class="row"><a class="btn" href="#/estimates/${id}/print">Print / PDF</a><a class="btn" href="#/contracts/new?estimate=${id}">Make contract</a><button type="button" class="btn" id="pay">Record payment</button></div>` : ''}</div>
      <div class="form-grid">
        <label>Customer <select name="customer_id">${customerOptions(est.customer_id, '— Pick customer —')}</select></label>
        <label>Job title <input name="title" value="${esc(est.title)}" placeholder="e.g. 12x16 deck replacement"></label>
        <label>Date <input type="date" name="date" value="${esc(est.date)}"></label>
        <label>Status <select name="status">${options(ESTIMATE_STATUSES, est.status)}</select></label>
      </div>
      <h3>Line items</h3>
      <div style="overflow-x:auto">
      <table class="items-table">
        <thead><tr><th>Description</th><th style="width:80px">Qty</th><th style="width:110px">Price</th><th class="num" style="width:100px">Total</th><th style="width:36px"></th></tr></thead>
        <tbody id="items"></tbody>
      </table>
      </div>
      <button type="button" class="btn small" id="add-item" style="margin:.5rem 0 1rem">+ Add line</button>
      <div class="form-grid">
        <label>Tax rate % (leave 0 if none) <input type="number" step="0.01" name="tax_rate" value="${esc(est.tax_rate)}"></label>
        <div></div>
      </div>
      <table class="totals" style="max-width:320px;margin-left:auto">
        <tr><td>Subtotal</td><td class="num" id="t-sub"></td></tr>
        <tr><td>Tax</td><td class="num" id="t-tax"></td></tr>
        <tr><td><strong>Total</strong></td><td class="num"><strong id="t-total"></strong></td></tr>
      </table>
      <label>Notes / terms (shows on the estimate) <textarea name="notes" placeholder="e.g. Estimate good for 30 days. 50% deposit to schedule.">${esc(est.notes)}</textarea></label>
      <div class="modal-actions">
        ${id !== 'new' ? '<button type="button" class="btn danger left" id="del">Delete</button>' : ''}
        <button type="submit" class="btn primary">Save estimate</button>
      </div>
    </form>`;

  const tbody = $('#items');
  const rowHtml = (it) => `<tr>
    <td><input data-f="desc" value="${esc(it.desc)}" placeholder="Labor, materials..."></td>
    <td><input data-f="qty" type="number" step="any" value="${esc(it.qty)}" inputmode="decimal" placeholder="Qty" aria-label="Quantity"></td>
    <td><input data-f="price" type="number" step="0.01" value="${esc(it.price)}" inputmode="decimal" placeholder="Price $" aria-label="Price"></td>
    <td class="num" data-line></td>
    <td><button type="button" class="btn small danger" data-rm>✕</button></td></tr>`;
  const readItems = () => $$('tr', tbody).map((tr) => ({
    desc: $('[data-f=desc]', tr).value, qty: $('[data-f=qty]', tr).value, price: $('[data-f=price]', tr).value,
  }));
  const recalc = () => {
    $$('tr', tbody).forEach((tr) => {
      $('[data-line]', tr).textContent = money((Number($('[data-f=qty]', tr).value) || 0) * (Number($('[data-f=price]', tr).value) || 0));
    });
    const t = estimateTotals({ items: readItems(), tax_rate: $('[name=tax_rate]').value });
    $('#t-sub').textContent = money(t.subtotal);
    $('#t-tax').textContent = money(t.tax);
    $('#t-total').textContent = money(t.total);
  };
  const wireRow = (tr) => {
    $$('input', tr).forEach((i) => (i.oninput = recalc));
    $('[data-rm]', tr).onclick = () => { tr.remove(); recalc(); };
  };
  tbody.innerHTML = items.map(rowHtml).join('');
  $$('tr', tbody).forEach(wireRow);
  $('#add-item').onclick = () => {
    tbody.insertAdjacentHTML('beforeend', rowHtml({ desc: '', qty: 1, price: '' }));
    wireRow(tbody.lastElementChild);
    $('[data-f=desc]', tbody.lastElementChild).focus();
  };
  $('[name=tax_rate]').oninput = recalc;
  recalc();

  $('#est-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(e.target);
    delete d[''];
    const payload = {
      customer_id: d.customer_id, title: d.title, date: d.date, status: d.status, tax_rate: d.tax_rate, notes: d.notes,
      items: readItems().filter((i) => i.desc || Number(i.price)),
    };
    try {
      const saved = id === 'new' ? await api('POST', '/estimates', payload) : await api('PUT', `/estimates/${id}`, payload);
      toast('Estimate saved');
      if (id === 'new') location.hash = `#/estimates/${saved.id}`; else pageEstimateEdit(id, query);
    } catch (err) { alert(err.message); }
  };
  if (id !== 'new') {
    $('#del').onclick = async () => {
      if (!confirm('Delete this estimate?')) return;
      await api('DELETE', `/estimates/${id}`);
      location.hash = '#/estimates';
    };
    $('#pay').onclick = () => editTransaction({ type: 'in', customer_id: est.customer_id, category: 'Job payment', description: `${est.number} ${est.title || ''}`.trim() }, () => {});
  }
}

async function pageEstimatePrint(id) {
  await customers();
  const est = await api('GET', `/estimates/${id}`);
  const c = customersCache.find((x) => x.id === est.customer_id) || {};
  const t = estimateTotals(est);
  view.innerHTML = `
    <div class="row no-print" style="margin-bottom:1rem">
      <a class="btn" href="#/estimates/${id}">‹ Back</a>
      <button class="btn primary" onclick="window.print()">Print / Save as PDF</button>
    </div>
    <div class="paper">
      <div class="letterhead">
        <div><div class="biz">Mayo Construction</div><div class="muted">Hot Springs, Arkansas<br>Isaiah Mayo &amp; Moss Mayo</div></div>
        <div style="text-align:right"><div style="font-size:1.3rem;font-weight:700">ESTIMATE</div><div>${esc(est.number)}</div><div>${fmtLongDate(est.date)}</div></div>
      </div>
      <p><strong>Prepared for:</strong><br>${esc(c.name || '')}${c.address ? '<br>' + esc(c.address) : ''}${c.phone ? '<br>' + esc(c.phone) : ''}${c.email ? '<br>' + esc(c.email) : ''}</p>
      ${est.title ? `<h3>${esc(est.title)}</h3>` : ''}
      <table>
        <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
        <tbody>${t.items.map((i) => `<tr><td>${esc(i.desc)}</td><td class="num">${esc(i.qty)}</td><td class="num">${money(i.price)}</td><td class="num">${money((Number(i.qty) || 0) * (Number(i.price) || 0))}</td></tr>`).join('')}</tbody>
      </table>
      <table class="totals" style="max-width:300px;margin:1rem 0 0 auto">
        <tr><td>Subtotal</td><td class="num">${money(t.subtotal)}</td></tr>
        ${t.tax ? `<tr><td>Tax (${esc(est.tax_rate)}%)</td><td class="num">${money(t.tax)}</td></tr>` : ''}
        <tr><td><strong>Total</strong></td><td class="num"><strong>${money(t.total)}</strong></td></tr>
      </table>
      ${est.notes ? `<p style="white-space:pre-wrap;margin-top:1.5rem">${esc(est.notes)}</p>` : ''}
      <p style="margin-top:2.5rem">Accepted by: ______________________________ &nbsp; Date: ____________</p>
    </div>`;
}

function txRow(t) {
  return `<li class="clickable" data-tx="${t.id}">
    <div class="grow">
      <div class="title">${esc(t.description || t.category || (t.type === 'in' ? 'Money in' : 'Money out'))}</div>
      <div class="sub">${fmtDate(t.date)}${t.category ? ' · ' + esc(t.category) : ''}${t.customer_id ? ' · ' + esc(customerName(t.customer_id)) : ''}${t.type === 'out' && t.paid_by && t.paid_by !== 'Business' ? ' · paid by ' + esc(t.paid_by) : ''}</div>
    </div>
    <strong class="${t.type === 'in' ? 'green' : 'red'}">${t.type === 'in' ? '+' : '−'}${money(t.amount)}</strong>
  </li>`;
}
function wireTxs(root, list, after) {
  $$('[data-tx]', root).forEach((el) => el.addEventListener('click', () => editTransaction(list.find((t) => t.id === Number(el.dataset.tx)), after)));
}

const moneyView = { period: 'month', month: todayStr().slice(0, 7), year: todayStr().slice(0, 4) };
async function pageMoney() {
  await customers();
  const from = moneyView.period === 'month' ? `${moneyView.month}-01` : `${moneyView.year}-01-01`;
  const to = moneyView.period === 'month' ? `${moneyView.month}-31` : `${moneyView.year}-12-31`;
  const list = await api('GET', `/transactions?from=${from}&to=${to}`);
  const mIn = list.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const mOut = list.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const net = mIn - mOut;
  // Out-of-pocket: expenses a partner paid personally (business owes them back).
  const owed = (who) => list.filter((t) => t.type === 'out' && t.paid_by === who).reduce((s, t) => s + t.amount, 0);
  const byCat = {};
  list.filter((t) => t.type === 'out').forEach((t) => (byCat[t.category || 'Other'] = (byCat[t.category || 'Other'] || 0) + t.amount));
  view.innerHTML = `
    <div class="spread"><h2>Money</h2><button class="btn primary" id="add">+ Money in / out</button></div>
    <div class="row" style="margin-bottom:1rem">
      <div class="tabs" style="margin:0">
        <button class="btn small ${moneyView.period === 'month' ? 'active' : ''}" data-period="month">Month</button>
        <button class="btn small ${moneyView.period === 'year' ? 'active' : ''}" data-period="year">Year</button>
      </div>
      ${moneyView.period === 'month'
        ? `<input type="month" id="pick" value="${moneyView.month}" style="width:auto;margin:0">`
        : `<input type="number" id="pick" value="${moneyView.year}" style="width:110px;margin:0">`}
      <button class="btn small" id="csv">Export CSV</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">Money in</div><div class="value green">${money(mIn)}</div></div>
      <div class="stat"><div class="label">Money out</div><div class="value red">${money(mOut)}</div></div>
      <div class="stat"><div class="label">Profit</div><div class="value">${money(net)}</div></div>
      <div class="stat"><div class="label">Isaiah 50%</div><div class="value">${money(net / 2)}</div></div>
      <div class="stat"><div class="label">Moss 50%</div><div class="value">${money(net / 2)}</div></div>
    </div>
    ${owed('Isaiah') || owed('Moss') ? `<div class="card"><h3>Paid out of pocket</h3><p class="muted" style="margin:0">Business expenses a partner paid with their own money (the business owes them back):
      Isaiah ${money(owed('Isaiah'))} · Moss ${money(owed('Moss'))}</p></div>` : ''}
    <div class="grid">
      <div class="card" style="grid-column: 1 / -1"><ul class="list" id="tx-list">${list.map(txRow).join('') || '<li class="empty">No entries for this period.</li>'}</ul></div>
      ${Object.keys(byCat).length ? `<div class="card"><h3>Where the money went</h3><table class="totals">${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${money(v)}</td></tr>`).join('')}</table></div>` : ''}
    </div>`;
  $('#add').onclick = () => editTransaction({}, pageMoney);
  wireTxs($('#tx-list'), list, pageMoney);
  $$('[data-period]').forEach((b) => (b.onclick = () => { moneyView.period = b.dataset.period; pageMoney(); }));
  $('#pick').onchange = (e) => { if (!e.target.value) return; moneyView[moneyView.period] = e.target.value; pageMoney(); };
  $('#csv').onclick = () => {
    const rows = [['Date', 'Type', 'Amount', 'Category', 'Description', 'Customer', 'Paid with']]
      .concat(list.map((t) => [t.date, t.type === 'in' ? 'In' : 'Out', t.amount.toFixed(2), t.category || '', t.description || '', customerName(t.customer_id), t.paid_by || '']));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `mayo-money-${moneyView.period === 'month' ? moneyView.month : moneyView.year}.csv`;
    a.click();
  };
}

async function pageContracts() {
  await customers();
  const [templates, docs] = await Promise.all([api('GET', '/templates'), api('GET', '/documents')]);
  view.innerHTML = `
    <div class="spread"><h2>Contracts</h2>
      <div class="row"><a class="btn primary" href="#/contracts/new">Create contract</a><button class="btn" id="upload">Upload signed contract</button></div></div>
    <div class="card">
      <div class="spread"><h3>Templates</h3><a class="btn small" href="#/templates/new">+ New template</a></div>
      <ul class="list">${templates.map((t) => `<li>
        <div class="grow"><div class="title">${esc(t.name)}</div></div>
        <a class="btn small" href="#/contracts/new?template=${t.id}">Use</a>
        <a class="btn small" href="#/templates/${t.id}">Edit</a></li>`).join('') || '<li class="empty">No templates.</li>'}</ul>
    </div>
    <div class="card">
      <h3>Stored documents</h3>
      <input id="search" placeholder="Search documents..." style="margin-bottom:.5rem">
      <ul class="list" id="docs">${docs.map(docRow).join('') || '<li class="empty">Nothing uploaded yet.</li>'}</ul>
    </div>`;
  $('#upload').onclick = () => uploadDocument({}, pageContracts);
  wireDocDeletes($('#docs'), pageContracts);
  $('#search').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    $$('#docs li').forEach((li) => li.classList.toggle('hidden', !li.textContent.toLowerCase().includes(q)));
  };
}

const PLACEHOLDERS = ['customer_name', 'customer_address', 'customer_phone', 'customer_email', 'date', 'job_title', 'estimate_number', 'estimate_items', 'estimate_total'];
async function pageTemplateEdit(id) {
  const t = id === 'new' ? { name: '', body: '' } : await api('GET', `/templates/${id}`);
  view.innerHTML = `
    <p><a href="#/contracts">‹ Contracts</a></p>
    <form class="card" id="tpl">
      <h2>${id === 'new' ? 'New template' : 'Edit template'}</h2>
      <label>Template name <input name="name" required value="${esc(t.name)}"></label>
      <p class="muted" style="font-size:.88rem">Fill-in blanks you can use (they get replaced automatically):<br>
        ${PLACEHOLDERS.map((p) => `<code>{{${p}}}</code>`).join(' ')}</p>
      <label>Contract text <textarea name="body" required style="min-height:420px;font-family:Georgia,serif">${esc(t.body)}</textarea></label>
      <div class="modal-actions">
        ${id !== 'new' ? '<button type="button" class="btn danger left" id="del">Delete</button>' : ''}
        <button class="btn primary">Save template</button>
      </div>
    </form>`;
  $('#tpl').onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(e.target);
    if (id === 'new') await api('POST', '/templates', d); else await api('PUT', `/templates/${id}`, d);
    toast('Template saved');
    location.hash = '#/contracts';
  };
  if (id !== 'new') $('#del').onclick = async () => {
    if (!confirm('Delete this template?')) return;
    await api('DELETE', `/templates/${id}`);
    location.hash = '#/contracts';
  };
}

function fillTemplate(body, c, est) {
  const t = est ? estimateTotals(est) : null;
  const values = {
    customer_name: c?.name, customer_address: c?.address, customer_phone: c?.phone, customer_email: c?.email,
    date: fmtLongDate(todayStr()),
    job_title: est?.title,
    estimate_number: est?.number,
    estimate_items: t ? t.items.map((i) => `  • ${i.desc} — ${i.qty} × ${money(i.price)} = ${money((Number(i.qty) || 0) * (Number(i.price) || 0))}`).join('\n') +
      (t.tax ? `\n  Tax: ${money(t.tax)}` : '') : '',
    estimate_total: t ? money(t.total) : '',
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (values[k] ? values[k] : '____________________'));
}

async function pageContractNew(query) {
  await customers();
  const [templates, estimates] = await Promise.all([api('GET', '/templates'), api('GET', '/estimates')]);
  const state = {
    template: Number(query.get('template')) || templates[0]?.id,
    estimate: Number(query.get('estimate')) || null,
    customer: Number(query.get('customer')) || null,
  };
  if (state.estimate && !state.customer) state.customer = estimates.find((e) => e.id === state.estimate)?.customer_id || null;

  view.innerHTML = `
    <div class="no-print">
      <p><a href="#/contracts">‹ Contracts</a></p>
      <div class="card">
        <h2>Create a contract</h2>
        <div class="form-grid">
          <label>Template <select id="c-tpl">${templates.map((t) => `<option value="${t.id}" ${t.id === state.template ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
          <label>Customer <select id="c-cust">${customerOptions(state.customer, '— Pick customer —')}</select></label>
          <label>Estimate (fills in price & work) <select id="c-est"></select></label>
        </div>
        <p class="muted" style="font-size:.88rem">Tip: you can edit the text below before printing. Blank lines (____) are for filling in by hand.</p>
        <div class="row">
          <button class="btn primary" id="print">Print / Save as PDF</button>
          <button class="btn" id="save">Save copy to customer's file</button>
          <button class="btn" id="upload">Upload signed copy</button>
        </div>
      </div>
    </div>
    <div class="paper">
      <div class="letterhead">
        <div><div class="biz">Mayo Construction</div><div class="muted">Hot Springs, Arkansas</div></div>
      </div>
      <div class="contract-text" id="text" contenteditable="true" spellcheck="true"></div>
    </div>`;

  const estSelect = $('#c-est');
  const renderEstOptions = () => {
    const mine = estimates.filter((e) => !state.customer || e.customer_id === state.customer);
    if (state.estimate && !mine.some((e) => e.id === state.estimate)) state.estimate = null;
    estSelect.innerHTML = '<option value="">— None —</option>' + mine.map((e) =>
      `<option value="${e.id}" ${e.id === state.estimate ? 'selected' : ''}>${esc(e.number)} ${esc(e.title || '')} (${money(estimateTotals(e).total)})</option>`).join('');
  };
  const render = () => {
    const tpl = templates.find((t) => t.id === state.template);
    const c = customersCache.find((x) => x.id === state.customer);
    const est = estimates.find((e) => e.id === state.estimate);
    $('#text').textContent = tpl ? fillTemplate(tpl.body, c, est) : 'No template yet — create one on the Contracts page.';
  };
  renderEstOptions();
  render();
  $('#c-tpl').onchange = (e) => { state.template = Number(e.target.value); render(); };
  $('#c-cust').onchange = (e) => { state.customer = Number(e.target.value) || null; renderEstOptions(); render(); };
  estSelect.onchange = (e) => { state.estimate = Number(e.target.value) || null; render(); };
  $('#print').onclick = () => window.print();
  $('#upload').onclick = () => {
    const c = customersCache.find((x) => x.id === state.customer);
    uploadDocument({ customer_id: state.customer, name: c ? `${c.name} - signed contract` : '' }, () => {});
  };
  $('#save').onclick = async () => {
    const c = customersCache.find((x) => x.id === state.customer);
    if (!c) return alert('Pick a customer first.');
    const html = `<!doctype html><meta charset="utf-8"><title>Contract</title>
      <body style="font-family:Georgia,serif;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.55">
      <h2 style="color:#1f3a5f;border-bottom:3px solid #e07a1f;padding-bottom:.4rem">Mayo Construction</h2>
      <div style="white-space:pre-wrap">${esc($('#text').innerText)}</div></body>`;
    const data = btoa(unescape(encodeURIComponent(html)));
    await api('POST', '/documents', {
      name: `${c.name} - contract (unsigned) ${todayStr()}`, kind: 'Unsigned contract', customer_id: c.id,
      original_name: 'contract.html', mime: 'text/html', data,
    });
    toast(`Saved to ${c.name}'s file`);
  };
}

async function pageSettings() {
  view.innerHTML = `
    <h2>Settings</h2>
    <div class="card">
      <h3>Logged in as ${esc(me.name)}</h3>
      <button class="btn" id="logout">Log out</button>
    </div>
    <form class="card" id="pw">
      <h3>Change your password</h3>
      <label>Current password <input type="password" name="current" required autocomplete="current-password"></label>
      <label>New password <input type="password" name="next" required minlength="6" autocomplete="new-password"></label>
      <button class="btn primary">Change password</button>
    </form>
    <div class="card">
      <h3>Backup</h3>
      <p class="muted">Download everything (customers, money, estimates, etc.) as one file. Do this every so often and keep it somewhere safe. Uploaded files are in the server's <code>data/uploads</code> folder.</p>
      <a class="btn" href="/api/backup">Download backup</a>
    </div>`;
  $('#logout').onclick = async () => { await api('POST', '/logout'); showLogin(); };
  $('#pw').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('POST', '/password', formData(e.target)); e.target.reset(); toast('Password changed'); } catch (err) { alert(err.message); }
  };
}

// ---------------------------------------------------------------------------
// Router & login
// ---------------------------------------------------------------------------
async function route() {
  if (!me) return;
  const [pathPart, qs] = location.hash.replace(/^#/, '').split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const query = new URLSearchParams(qs || '');
  const section = parts[0] || '';
  $$('#nav a').forEach((a) => {
    const target = a.getAttribute('href').replace('#/', '');
    a.classList.toggle('active', target === section || (section === 'templates' && target === 'contracts'));
  });
  window.scrollTo(0, 0);
  try {
    if (!section) await pageHome();
    else if (section === 'todos') await pageTodos();
    else if (section === 'schedule') await pageSchedule();
    else if (section === 'customers' && parts[1]) await pageCustomer(parts[1]);
    else if (section === 'customers') await pageCustomers();
    else if (section === 'estimates' && parts[2] === 'print') await pageEstimatePrint(parts[1]);
    else if (section === 'estimates' && parts[1]) await pageEstimateEdit(parts[1], query);
    else if (section === 'estimates') await pageEstimates();
    else if (section === 'money') await pageMoney();
    else if (section === 'contracts' && parts[1] === 'new') await pageContractNew(query);
    else if (section === 'contracts') await pageContracts();
    else if (section === 'templates' && parts[1]) await pageTemplateEdit(parts[1]);
    else if (section === 'settings') await pageSettings();
    else view.innerHTML = '<p>Page not found. <a href="#/">Go home</a></p>';
  } catch (err) {
    if (me) view.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p><a href="#/">Go home</a></div>`;
  }
}

function showLogin() {
  me = null;
  customersCache = null;
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
}
function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  route();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    me = await api('POST', '/login', formData(e.target));
    try { localStorage.setItem('mayo-user', me.username); } catch {}
    e.target.reset();
    showApp();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

window.addEventListener('hashchange', route);

(async function init() {
  try { const last = localStorage.getItem('mayo-user'); if (last) $('#login-form [name=username]').value = last; } catch {}
  try {
    me = await api('GET', '/me');
    showApp();
  } catch {
    showLogin();
  }
})();
