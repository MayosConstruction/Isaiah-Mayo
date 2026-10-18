// Mayo's Construction CRM — front end (plain JavaScript, no build step).
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
const OUT_CATEGORIES = ['Subcontractor', 'Partner pay', 'Materials', 'Fuel', 'Tools & equipment', 'Dump / disposal', 'Insurance', 'Vehicle', 'Permits', 'Office / phone', 'Other expense'];
const DOC_KINDS = ['Signed contract', 'Unsigned contract', 'Change order', 'Receipt', 'Photo', 'Other'];
const BIZ = { name: "Mayo's Construction", phone: '870-617-3507', city: 'Hot Springs, AR', lines: 'Construction · Remodeling · Roofing', owners: 'Moss Mayo & Isaiah Mayo' };
const LETTERHEAD = `<div class="who"><img src="/logo.png" alt="">
  <div><div class="biz">${BIZ.name}</div><div class="muted">${BIZ.lines}<br>${BIZ.city} · ${BIZ.phone}<br>${BIZ.owners}</div></div></div>`;
let me = null;
let customersCache = null;
// Moss and Isaiah are 50/50 partners. Regular subcontractors:
const PARTNERS = ['Moss', 'Isaiah'];
const SUBS = { Tommy: 'Electrician', Chris: 'Electrician', Julio: 'Drywaller', David: 'Laborer' };
let peopleSeen = [...PARTNERS, ...Object.keys(SUBS)];
function personLabel(name) { return SUBS[name] ? `${name} (${SUBS[name]})` : name; }

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
  await Promise.all([customers(), jobs()]);
  const isEdit = !!todo.id;
  openModal(`
    <form>
      <h2>${isEdit ? 'Edit to-do' : 'New to-do'}</h2>
      <label>What needs done? <input name="title" required value="${esc(todo.title)}"></label>
      <div class="form-grid">
        <label>Due date <input type="date" name="due_date" value="${esc(todo.due_date)}"></label>
        <label>Who <select name="assigned_to">${options(PEOPLE, todo.assigned_to || 'Both')}</select></label>
      </div>
      <div class="form-grid">
        <label>Job (optional) <select name="job_id">${jobOptions(todo.job_id)}</select></label>
        <label>Customer (optional) <select name="customer_id">${customerOptions(todo.customer_id)}</select></label>
      </div>
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
  await Promise.all([customers(), jobs()]);
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
        <label class="out-only">Paid to <input name="paid_to" list="people-list" value="${esc(tx.paid_to)}" placeholder="Moss, Isaiah, Chris, Lowe's…"></label>
        <label class="out-only">Paid yet? <select name="status">
          <option value="paid" ${tx.status !== 'owed' ? 'selected' : ''}>Paid</option>
          <option value="owed" ${tx.status === 'owed' ? 'selected' : ''}>Due when job is finished</option></select></label>
        <label class="out-only">Paid with <select name="paid_by">${options(['Business', 'Isaiah', 'Moss'], tx.paid_by || 'Business')}</select></label>
      </div>
      <datalist id="cat-list"></datalist>
      <datalist id="people-list">${peopleSeen.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
      <div class="form-grid">
        <label>Job (optional) <select name="job_id">${jobOptions(tx.job_id)}</select></label>
        <label>Customer (optional) <select name="customer_id">${customerOptions(tx.customer_id)}</select></label>
      </div>
      <label>Description <input name="description" value="${esc(tx.description)}" placeholder="e.g. Lumber from Lowe's, Smith deposit"></label>
      ${modalActions(isEdit)}
    </form>`, {
    onSubmit: async (d) => {
      if (d.type === 'in') { d.paid_by = null; d.paid_to = null; d.status = 'paid'; }
      if (d.paid_to && !peopleSeen.includes(d.paid_to)) peopleSeen.push(d.paid_to);
      if (isEdit) await api('PUT', `/transactions/${tx.id}`, d); else await api('POST', '/transactions', d);
      toast('Saved'); after && after();
    },
    onDelete: async () => { await api('DELETE', `/transactions/${tx.id}`); toast('Deleted'); after && after(); },
    onReady: (body) => {
      const setType = (t) => {
        $('[name=type]', body).value = t;
        $$('#type-tabs .btn', body).forEach((b) => b.classList.toggle('active', b.dataset.type === t));
        $('#cat-list', body).innerHTML = (t === 'in' ? IN_CATEGORIES : OUT_CATEGORIES).map((c) => `<option value="${esc(c)}">`).join('');
        $$('.out-only', body).forEach((el) => el.classList.toggle('hidden', t === 'in'));
      };
      // Picking a partner or a known sub fills in the category.
      $('[name=paid_to]', body).addEventListener('change', (e) => {
        const cat = $('[name=category]', body);
        const who = e.target.value.trim();
        if (PARTNERS.includes(who)) cat.value = 'Partner pay';
        else if (SUBS[who] && !cat.value) cat.value = 'Subcontractor';
      });
      $('[name=job_id]', body).addEventListener('change', (e) => {
        const j = jobsCache.find((x) => x.id === Number(e.target.value));
        if (j && j.customer_id) $('[name=customer_id]', body).value = j.customer_id;
      });
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
        ${t.job_id ? ' · ' + esc(jobAddress(t.job_id)) : t.customer_id ? ' · ' + esc(customerName(t.customer_id)) : ''}
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
// Jobs (laid out like "The Mayo's Workshop" notes)
// ---------------------------------------------------------------------------
const JOB_STATUSES = ['Estimate Pending', 'Scheduled', 'In Progress', 'Done', 'Lost'];
const JOB_ICON = { 'Estimate Pending': '📝', Scheduled: '📆', 'In Progress': '🔨', Done: '✅', Lost: '✖️' };
const MATERIAL_STATUSES = ['Not bought yet', 'Purchased', 'Bought, not paid yet'];
let jobsCache = null;

async function jobs(force) {
  if (!jobsCache || force) jobsCache = await api('GET', '/jobs');
  return jobsCache;
}
function jobAddress(id) {
  const j = (jobsCache || []).find((x) => x.id === id);
  return j ? j.address : '';
}
function jobOptions(selected, list = jobsCache || []) {
  return '<option value="">— None —</option>' +
    list.map((j) => `<option value="${j.id}" ${j.id === Number(selected) ? 'selected' : ''}>${esc(j.address)}${j.customer_id ? ' · ' + esc(customerName(j.customer_id)) : ''}</option>`).join('');
}
function checklist(json) {
  try { return (typeof json === 'string' ? JSON.parse(json || '[]') : json || []).filter((i) => i && i.text); } catch { return []; }
}
// Turn "one item per line" text into a checklist, keeping ticks on lines that didn't change.
function linesToChecklist(text, old) {
  return String(text || '').split('\n').map((l) => l.replace(/^\s*[-•◦⁃✓*]\s*/, '').trim()).filter(Boolean)
    .map((t) => ({ text: t, done: old.some((o) => o.text === t && o.done) }));
}
function shortDate(s) { return s ? fmtDate(s, { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—'; }
function jobNumbers(job, jm = {}) {
  const m = jm[job.id] || { collected: 0, materials: 0, other: 0, subs: {}, partners: { Moss: { paid: 0, due: 0 }, Isaiah: { paid: 0, due: 0 } } };
  const sum = (o) => o.paid + o.due;
  const subsTotal = Object.values(m.subs).reduce((t, o) => t + sum(o), 0);
  // Whatever labor isn't handed to subs or Moss (or already logged for Isaiah) is Isaiah's share.
  const isaiahRest = Math.max(0, (job.labor_cost || 0) - subsTotal - sum(m.partners.Moss) - sum(m.partners.Isaiah));
  return {
    ...m,
    subsTotal,
    isaiahRest,
    owes: (job.price || 0) - m.collected,
    leftover: (job.price || 0) - (job.labor_cost || 0) - (job.materials_cost || 0),
  };
}
function paidDue(o) {
  return [o.paid ? `${money(o.paid)} paid` : '', o.due ? `${money(o.due)} at finish` : ''].filter(Boolean).join(' · ') || '—';
}
function statusPill(status) {
  return `<span class="pill job-${status.replace(/\s/g, '')}">${JOB_ICON[status] || ''} ${esc(status)}</span>`;
}

function jobCard(job, jm) {
  const n = jobNumbers(job, jm);
  const scope = checklist(job.scope);
  return `<div class="card job-card clickable" onclick="location.hash='#/jobs/${job.id}'">
    <div class="spread" style="margin-bottom:.3rem">
      <h3 style="margin:0">${esc(job.address)}</h3>${statusPill(job.status)}
    </div>
    <div class="muted">${esc(customerName(job.customer_id) || 'No customer')}${job.start_date ? ` · ${shortDate(job.start_date)} – ${shortDate(job.finish_date)}` : ''}</div>
    ${job.price ? `<div class="job-money">
      <div><span>Price</span><strong>${money(job.price)}</strong></div>
      <div><span>Collected</span><strong class="green">${money(n.collected)}</strong></div>
      <div><span>They owe</span><strong class="${n.owes > 0 ? 'red' : ''}">${money(n.owes)}</strong></div>
    </div>` : ''}
    ${scope.length ? `<ul class="mini">${scope.slice(0, 3).map((i) => `<li class="${i.done ? 'done-item' : ''}">${esc(i.text)}</li>`).join('')}${scope.length > 3 ? `<li class="muted">+${scope.length - 3} more</li>` : ''}</ul>` : ''}
  </div>`;
}

async function editJob(job = {}, after) {
  await customers();
  const isEdit = !!job.id;
  const mats = checklist(job.materials);
  const scope = checklist(job.scope);
  openModal(`
    <form>
      <h2>${isEdit ? 'Edit job' : 'New job'}</h2>
      <label>Job address <input name="address" required value="${esc(job.address)}" placeholder="e.g. 353 Paradise Point"></label>
      <div class="form-grid">
        <label>Customer <select name="customer_id">${customerOptions(job.customer_id)}<option value="new">+ New customer…</option></select></label>
        <label>Status <select name="status">${options(JOB_STATUSES, job.status || 'Scheduled')}</select></label>
      </div>
      <label id="new-cust" class="hidden">New customer's name <input name="new_customer"></label>
      <div class="form-grid">
        <label>Start <input type="date" name="start_date" value="${esc(job.start_date)}"></label>
        <label>Finish <input type="date" name="finish_date" value="${esc(job.finish_date)}"></label>
        <label>Price ($) <input type="number" step="0.01" name="price" value="${esc(job.price || '')}" inputmode="decimal"></label>
        <label>Labor, us + subs ($) <input type="number" step="0.01" name="labor_cost" value="${esc(job.labor_cost || '')}" inputmode="decimal"></label>
        <label>Materials ($) <input type="number" step="0.01" name="materials_cost" value="${esc(job.materials_cost || '')}" inputmode="decimal"></label>
        <label>Materials status <select name="materials_status">${options(MATERIAL_STATUSES, job.materials_status || 'Not bought yet')}</select></label>
      </div>
      <label>Materials needed (one per line) <textarea name="materials_text">${esc(mats.map((i) => i.text).join('\n'))}</textarea></label>
      <label>Scope of work (one per line) <textarea name="scope_text">${esc(scope.map((i) => i.text).join('\n'))}</textarea></label>
      <label>Notes <textarea name="notes">${esc(job.notes)}</textarea></label>
      ${modalActions(isEdit)}
    </form>`, {
    onSubmit: async (d) => {
      if (d.customer_id === 'new') {
        if (!d.new_customer.trim()) throw new Error("Type the new customer's name");
        const c = await api('POST', '/customers', { name: d.new_customer.trim(), address: d.address });
        await customers(true);
        d.customer_id = c.id;
      }
      const payload = {
        address: d.address, customer_id: d.customer_id, status: d.status, start_date: d.start_date, finish_date: d.finish_date,
        price: d.price, labor_cost: d.labor_cost, materials_cost: d.materials_cost, materials_status: d.materials_status, notes: d.notes,
        materials: linesToChecklist(d.materials_text, mats), scope: linesToChecklist(d.scope_text, scope),
      };
      const saved = isEdit ? await api('PUT', `/jobs/${job.id}`, payload) : await api('POST', '/jobs', payload);
      await jobs(true);
      toast('Job saved'); after && after(saved);
    },
    onDelete: async () => {
      await api('DELETE', `/jobs/${job.id}`);
      await jobs(true);
      toast('Job deleted'); location.hash = '#/jobs';
    },
    onReady: (body) => {
      $('[name=customer_id]', body).addEventListener('change', (e) => $('#new-cust', body).classList.toggle('hidden', e.target.value !== 'new'));
    },
  });
}

const jobsView = { tab: 'current' };
async function pageJobs() {
  await customers();
  const [all, jm] = await Promise.all([jobs(true), api('GET', '/job-money')]);
  const tabs = {
    current: ['Current', (j) => j.status === 'In Progress' || j.status === 'Scheduled'],
    estimates: ['Estimates out', (j) => j.status === 'Estimate Pending'],
    done: ['Done', (j) => j.status === 'Done' || j.status === 'Lost'],
    all: ['All', () => true],
  };
  const list = all.filter(tabs[jobsView.tab][1]);
  view.innerHTML = `
    <div class="spread"><div><p class="eyebrow">The Mayo's Workshop</p><h2 style="margin:0">Jobs</h2></div><button class="btn primary" id="add">+ New job</button></div>
    <div class="tabs">${Object.entries(tabs).map(([k, [label, f]]) =>
      `<button class="btn small ${jobsView.tab === k ? 'active' : ''}" data-tab="${k}">${label} (${all.filter(f).length})</button>`).join('')}</div>
    <div class="grid">${list.map((j) => jobCard(j, jm)).join('') || '<p class="empty">No jobs here.</p>'}</div>`;
  $('#add').onclick = () => editJob({ status: jobsView.tab === 'estimates' ? 'Estimate Pending' : 'Scheduled' }, (j) => (location.hash = `#/jobs/${j.id}`));
  $$('[data-tab]').forEach((b) => (b.onclick = () => { jobsView.tab = b.dataset.tab; pageJobs(); }));
}

function checklistHtml(items, field) {
  return `<ul class="list check-list">${items.map((i, idx) => `<li class="${i.done ? 'done' : ''}">
      <input type="checkbox" data-check="${field}" data-idx="${idx}" ${i.done ? 'checked' : ''} aria-label="Done">
      <div class="grow"><div class="title" style="font-weight:400">${esc(i.text)}</div></div>
      <button class="btn small danger" data-rm-item="${field}" data-idx="${idx}" aria-label="Remove">✕</button></li>`).join('') || '<li class="empty">Nothing listed.</li>'}</ul>
    <form class="row" data-add-item="${field}" style="margin-top:.5rem">
      <input name="text" placeholder="Add item…" style="flex:1;margin:0;min-width:150px"><button class="btn small">Add</button>
    </form>`;
}

async function pageJob(id) {
  await customers();
  const [job, jm, txs, todos, ests] = await Promise.all([
    api('GET', `/jobs/${id}`), api('GET', '/job-money'),
    api('GET', `/transactions?job_id=${id}`), api('GET', `/todos?job_id=${id}`), api('GET', `/estimates?job_id=${id}`),
    jobs(),
  ]);
  const n = jobNumbers(job, jm);
  const mats = checklist(job.materials);
  const scope = checklist(job.scope);
  const c = customersCache.find((x) => x.id === job.customer_id);
  const reload = () => pageJob(id);
  const ins = txs.filter((t) => t.type === 'in');
  const outs = txs.filter((t) => t.type === 'out');
  view.innerHTML = `
    <p><a href="#/jobs">‹ All jobs</a></p>
    <div class="card">
      <div class="spread" style="margin-bottom:.3rem">
        <h2 style="margin:0">${esc(job.address)}</h2>
        <div class="row"><select id="status" style="width:auto;margin:0">${JOB_STATUSES.map((s) => `<option value="${s}" ${s === job.status ? 'selected' : ''}>${JOB_ICON[s]} ${s}</option>`).join('')}</select>
        <button class="btn" id="edit">Edit</button></div>
      </div>
      <div>${c ? `<a href="#/customers/${c.id}">${esc(c.name)}</a>${c.phone ? ` · <a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a>` : ''}` : '<span class="muted">No customer</span>'}</div>
      <div class="muted">Start: ${shortDate(job.start_date)} &nbsp; Finish: ${shortDate(job.finish_date)} &nbsp; · <a href="https://maps.google.com/?q=${encodeURIComponent(job.address)}" target="_blank" rel="noopener">Map</a></div>
      <div class="row" style="margin-top:.75rem">
        <button class="btn primary" id="add-in">+ Payment received</button>
        <button class="btn" id="add-out">+ Pay someone / expense</button>
        <button class="btn" id="add-todo">+ To-do</button>
        <a class="btn" href="#/estimates/new?job=${id}">Make estimate</a>
        <a class="btn" href="#/contracts/new?job=${id}">Make contract</a>
      </div>
    </div>
    <div class="grid">
      <div class="card">
        <h3>Money</h3>
        <table class="totals job-table">
          <tr><td><strong>Price</strong></td><td class="num"><strong>${money(job.price)}</strong></td></tr>
          <tr><td>Collected</td><td class="num green">${money(n.collected)}</td></tr>
          <tr><td>Still owed</td><td class="num ${n.owes > 0 ? 'red' : ''}">${money(n.owes)}</td></tr>
          <tr class="sep"><td><strong>Labor</strong></td><td class="num"><strong>${money(job.labor_cost)}</strong></td></tr>
          ${Object.entries(n.subs).map(([name, o]) => `<tr><td>${esc(personLabel(name))}</td><td class="num">${paidDue(o)}</td></tr>`).join('')}
          <tr><td>Moss</td><td class="num">${paidDue(n.partners.Moss)}</td></tr>
          <tr><td>Isaiah</td><td class="num">${[n.partners.Isaiah.paid || n.partners.Isaiah.due ? paidDue(n.partners.Isaiah) : '', n.isaiahRest ? `${money(n.isaiahRest)} rest of labor` : ''].filter(Boolean).join(' · ') || '—'}</td></tr>
          <tr class="sep"><td><strong>Materials</strong></td><td class="num"><strong>${money(job.materials_cost)}</strong></td></tr>
          <tr><td>Status</td><td class="num"><select id="mat-status" style="width:auto;margin:0;padding:.2rem .4rem;display:inline-block">${options(MATERIAL_STATUSES, job.materials_status || 'Not bought yet')}</select></td></tr>
          ${n.materials ? `<tr><td>Spent so far</td><td class="num">${money(n.materials)}</td></tr>` : ''}
          <tr class="sep"><td><strong>Left over</strong></td><td class="num"><strong>${money(n.leftover)}</strong></td></tr>
          ${n.leftover ? `<tr><td class="muted">Split 50/50</td><td class="num muted">${money(n.leftover / 2)} each</td></tr>` : ''}
        </table>
      </div>
      <div class="card">
        <h3>Labor & expenses</h3>
        <ul class="list" id="outs">${outs.map(txRow).join('') || '<li class="empty">Nothing yet. Use "+ Pay someone / expense" for Moss, Isaiah, subs, or materials.</li>'}</ul>
        <h3 style="margin-top:1rem">Payments from customer</h3>
        <ul class="list" id="ins">${ins.map(txRow).join('') || '<li class="empty">Nothing collected yet.</li>'}</ul>
      </div>
      <div class="card"><h3>Materials needed</h3><div id="mats">${checklistHtml(mats, 'materials')}</div></div>
      <div class="card"><h3>Scope of work</h3><div id="scope">${checklistHtml(scope, 'scope')}</div></div>
      <div class="card"><h3>To-dos</h3><ul class="list" id="j-todos">${todos.map(todoRow).join('') || '<li class="empty">None.</li>'}</ul></div>
      ${ests.length ? `<div class="card"><h3>Estimates</h3><ul class="list">${ests.map((e) => `<li class="clickable" onclick="location.hash='#/estimates/${e.id}'">
        <div class="grow"><div class="title">${esc(e.number)}</div></div><span class="pill ${e.status}">${e.status}</span><strong>${money(estimateTotals(e).total)}</strong></li>`).join('')}</ul></div>` : ''}
      ${job.notes ? `<div class="card"><h3>Notes</h3><p style="white-space:pre-wrap;margin:0">${esc(job.notes)}</p></div>` : ''}
    </div>`;
  $('#edit').onclick = () => editJob(job, reload);
  $('#status').onchange = async (e) => { await api('PUT', `/jobs/${id}`, { status: e.target.value }); await jobs(true); toast('Status updated'); reload(); };
  $('#mat-status').onchange = async (e) => {
    await api('PUT', `/jobs/${id}`, { materials_status: e.target.value });
    toast('Saved');
    // Offer to log the purchase so it shows in Money.
    if (e.target.value === 'Purchased' && !n.materials && job.materials_cost) {
      editTransaction({ type: 'out', job_id: job.id, customer_id: job.customer_id, category: 'Materials', amount: job.materials_cost, description: 'Materials purchased' }, reload);
    }
  };
  $('#add-in').onclick = () => editTransaction({ type: 'in', job_id: job.id, customer_id: job.customer_id, category: 'Job payment' }, reload);
  $('#add-out').onclick = () => editTransaction({ type: 'out', job_id: job.id, customer_id: job.customer_id }, reload);
  $('#add-todo').onclick = () => editTodo({ job_id: job.id, customer_id: job.customer_id }, reload);
  wireTxs($('#outs'), outs, reload);
  wireTxs($('#ins'), ins, reload);
  wireTodos($('#j-todos'), todos, reload);

  const lists = { materials: mats, scope };
  const saveList = async (field) => { await api('PUT', `/jobs/${id}`, { [field]: lists[field] }); reload(); };
  $$('[data-check]').forEach((cb) => (cb.onchange = () => { lists[cb.dataset.check][cb.dataset.idx].done = cb.checked; saveList(cb.dataset.check); }));
  $$('[data-rm-item]').forEach((b) => (b.onclick = () => { lists[b.dataset.rmItem].splice(Number(b.dataset.idx), 1); saveList(b.dataset.rmItem); }));
  $$('[data-add-item]').forEach((f) => (f.onsubmit = (e) => {
    e.preventDefault();
    const text = f.elements.text.value.trim();
    if (!text) return;
    lists[f.dataset.addItem].push({ text, done: false });
    saveList(f.dataset.addItem);
  }));
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
async function pageHome() {
  await Promise.all([customers(), jobs(true)]);
  const s = await api('GET', '/summary');
  const current = s.jobs.filter((j) => j.status !== 'Estimate Pending');
  const pending = s.jobs.filter((j) => j.status === 'Estimate Pending');
  const custOwe = current.reduce((sum, j) => sum + Math.max(0, jobNumbers(j, s.jobMoney).owes), 0);
  // What each partner and sub has coming when current jobs finish.
  const coming = { Moss: 0, Isaiah: 0 };
  const subsDue = {};
  current.forEach((j) => {
    const n = jobNumbers(j, s.jobMoney);
    coming.Moss += n.partners.Moss.due;
    coming.Isaiah += n.partners.Isaiah.due + n.isaiahRest;
    Object.entries(n.subs).forEach(([k, o]) => { if (o.due) subsDue[k] = (subsDue[k] || 0) + o.due; });
  });

  const greet = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const byDay = {};
  s.events.forEach((e) => (byDay[e.date] = byDay[e.date] || []).push(e));
  view.innerHTML = `
    <div class="spread">
      <div><p class="eyebrow">Call the Mayos</p><h2 style="margin:0">${greet}, ${esc(me.name)}</h2></div>
      <div class="row">
        <button class="btn" id="q-todo">+ To-do</button>
        <button class="btn" id="q-event">+ Appointment</button>
        <button class="btn primary" id="q-money">+ Money</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">In this month</div><div class="value green">${money(s.month.in)}</div></div>
      <div class="stat"><div class="label">Costs this month</div><div class="value red">${money(s.month.costs)}</div></div>
      <div class="stat"><div class="label">Profit this month</div><div class="value">${money(s.month.profit)}</div></div>
      <div class="stat"><div class="label">Customers still owe</div><div class="value">${money(custOwe)}</div></div>
    </div>
    <div class="card partners">
      <h3>Partners · 50/50</h3>
      <div class="partner-grid">
        ${PARTNERS.map((p) => `<div><div class="pname">${p}</div>
          <div>Paid this month <strong>${money(s.month.paid[p])}</strong></div>
          <div>Coming when jobs finish <strong>${money(coming[p])}</strong></div></div>`).join('')}
      </div>
      ${Object.keys(subsDue).length ? `<p class="muted" style="margin:.6rem 0 0">Subs due at finish: ${Object.entries(subsDue).map(([k, v]) => `${esc(personLabel(k))} ${money(v)}`).join(' · ')}</p>` : ''}
    </div>
    <div class="spread"><h3 style="margin:0">Current jobs</h3><a href="#/jobs">All jobs</a></div>
    <div class="grid" style="margin-bottom:1rem">${current.map((j) => jobCard(j, s.jobMoney)).join('') || '<p class="empty">No current jobs. <a href="#/jobs">Add one</a>.</p>'}</div>
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
        <div class="spread"><h3>Estimates out / pending 📝</h3><a href="#/estimates">Estimates</a></div>
        <ul class="list">${pending.map((j) => `<li class="clickable" onclick="location.hash='#/jobs/${j.id}'">
          <div class="grow"><div class="title">${esc(j.address)}</div><div class="sub">${esc(customerName(j.customer_id))}</div></div><span class="muted">›</span></li>`).join('')}</ul>
        ${pending.length && s.openEstimates.length ? '<hr style="border:none;border-top:1px solid var(--border)">' : ''}
        <ul class="list">${s.openEstimates.map((e) => `<li class="clickable" onclick="location.hash='#/estimates/${e.id}'">
          <div class="grow"><div class="title">${esc(e.number)} · ${esc(customerName(e.customer_id) || 'No customer')}</div><div class="sub">${esc(e.title || '')}</div></div>
          <span class="pill ${e.status}">${e.status}</span><strong>${money(estimateTotals(e).total)}</strong></li>`).join('') || (pending.length ? '' : '<li class="empty">No open estimates.</li>')}</ul>
      </div>
      <div class="card">
        <h3>This year so far</h3>
        <table class="totals">
          <tr><td>Money in</td><td class="num green">${money(s.year.in)}</td></tr>
          <tr><td>Costs</td><td class="num red">${money(s.year.costs)}</td></tr>
          <tr><td><strong>Profit</strong></td><td class="num"><strong>${money(s.year.profit)}</strong></td></tr>
          <tr><td>Paid to Moss</td><td class="num">${money(s.year.paid.Moss)}</td></tr>
          <tr><td>Paid to Isaiah</td><td class="num">${money(s.year.paid.Isaiah)}</td></tr>
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
  const allJobs = (await jobs(true)).filter((j) => j.start_date && (j.status === 'Scheduled' || j.status === 'In Progress'));
  const jobsOn = (ds) => allJobs.filter((j) => j.start_date <= ds && ds <= (j.finish_date || j.start_date));
  if (sched.mode === 'list') {
    events = await api('GET', `/events?from=${todayStr()}`);
    const byDay = {};
    events.forEach((e) => (byDay[e.date] = byDay[e.date] || []).push(e));
    const upcoming = allJobs.filter((j) => (j.finish_date || j.start_date) >= todayStr());
    body = `<div class="card"><h3>Jobs</h3><ul class="list">${upcoming.map((j) => `<li class="clickable" onclick="location.hash='#/jobs/${j.id}'">
        <div class="grow"><div class="title">${JOB_ICON[j.status]} ${esc(j.address)}</div><div class="sub">${fmtDate(j.start_date)} – ${fmtDate(j.finish_date || j.start_date)} · ${esc(customerName(j.customer_id))}</div></div>
        <span class="muted">›</span></li>`).join('') || '<li class="empty">No scheduled jobs.</li>'}</ul></div>
      <div class="card" id="ev-wrap"><h3>Appointments</h3>${Object.keys(byDay).map((d) => `<div class="day-head">${relDay(d)} <span class="muted" style="font-weight:400">${fmtLongDate(d)}</span></div><ul class="list">${byDay[d].map(eventRow).join('')}</ul>`).join('') || '<p class="empty">Nothing coming up. Add an appointment.</p>'}</div>`;
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
        <div>${d.getDate()}</div>${jobsOn(ds).map((j) => `<div class="ev job c${j.id % 5}" data-job="${j.id}" title="${esc(j.address)}"><span class="full">${esc(j.address)}</span><span class="short">${esc(j.address.split(' ')[0])}</span></div>`).join('')}${evs.map((e) => `<div class="ev" data-event="${e.id}" title="${esc(fmtTime(e.start_time))}">${esc(e.title)}</div>`).join('')}</div>`);
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
      const jobEl = e.target.closest('[data-job]');
      if (jobEl) { location.hash = `#/jobs/${jobEl.dataset.job}`; return; }
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
  const [allJobs, jm] = await Promise.all([jobs(true), api('GET', '/job-money')]);
  const custJobs = allJobs.filter((j) => j.customer_id === Number(id));
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
        <button class="btn primary" id="add-job">+ Job</button>
        <a class="btn" href="#/estimates/new?customer=${id}">+ Estimate</a>
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
    ${custJobs.length ? `<div class="grid" style="margin-bottom:1rem">${custJobs.map((j) => jobCard(j, jm)).join('')}</div>` : ''}
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
  $('#add-job').onclick = () => editJob({ customer_id: c.id, address: c.address, status: 'Estimate Pending' }, (j) => (location.hash = `#/jobs/${j.id}`));
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
  await jobs();
  const fromJob = id === 'new' && jobsCache.find((j) => j.id === Number(query.get('job')));
  const est = id === 'new'
    ? {
      customer_id: fromJob ? fromJob.customer_id : Number(query.get('customer')) || null, job_id: fromJob ? fromJob.id : null,
      title: fromJob ? fromJob.address : '', date: todayStr(), status: 'Draft', tax_rate: 0,
      items: fromJob && checklist(fromJob.scope).length ? checklist(fromJob.scope).map((i) => ({ desc: i.text, qty: 1, price: '' })) : [{ desc: '', qty: 1, price: '' }],
    }
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
        <label>Job (optional) <select name="job_id">${jobOptions(est.job_id)}</select></label>
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
      customer_id: d.customer_id, job_id: d.job_id, title: d.title, date: d.date, status: d.status, tax_rate: d.tax_rate, notes: d.notes,
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
    $('#pay').onclick = () => editTransaction({ type: 'in', customer_id: est.customer_id, job_id: est.job_id, category: 'Job payment', description: `${est.number} ${est.title || ''}`.trim() }, () => {});
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
        ${LETTERHEAD}
        <div style="text-align:right"><div class="doc-title">ESTIMATE</div><div>${esc(est.number)}</div><div>${fmtLongDate(est.date)}</div></div>
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
  const owed = t.status === 'owed';
  const title = (t.paid_to ? (owed ? '' : 'Paid ') + personLabel(t.paid_to) : t.description) || t.category || (t.type === 'in' ? 'Money in' : 'Money out');
  return `<li class="clickable" data-tx="${t.id}">
    <div class="grow">
      <div class="title">${esc(title)} ${owed ? '<span class="pill due">Due at finish</span>' : ''}</div>
      <div class="sub">${owed ? 'finish ' : ''}${fmtDate(t.date)}${t.paid_to && t.description ? ' · ' + esc(t.description) : ''}${t.category ? ' · ' + esc(t.category) : ''}${t.job_id ? ' · ' + esc(jobAddress(t.job_id)) : t.customer_id ? ' · ' + esc(customerName(t.customer_id)) : ''}${t.type === 'out' && t.paid_by && t.paid_by !== 'Business' ? ' · paid by ' + esc(t.paid_by) : ''}</div>
    </div>
    ${owed ? `<button class="btn small" data-mark-paid="${t.id}">Mark paid</button>` : ''}
    <strong class="${owed ? 'muted' : t.type === 'in' ? 'green' : 'red'}">${t.type === 'in' ? '+' : '−'}${money(t.amount)}</strong>
  </li>`;
}
function wireTxs(root, list, after) {
  $$('[data-tx]', root).forEach((el) => el.addEventListener('click', () => editTransaction(list.find((t) => t.id === Number(el.dataset.tx)), after)));
  $$('[data-mark-paid]', root).forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    await api('PUT', `/transactions/${b.dataset.markPaid}`, { status: 'paid', date: todayStr() });
    toast('Marked paid'); after();
  }));
}

const moneyView = { period: 'month', month: todayStr().slice(0, 7), year: todayStr().slice(0, 4) };
async function pageMoney() {
  await customers();
  const from = moneyView.period === 'month' ? `${moneyView.month}-01` : `${moneyView.year}-01-01`;
  const to = moneyView.period === 'month' ? `${moneyView.month}-31` : `${moneyView.year}-12-31`;
  await jobs();
  const [periodList, owedList] = await Promise.all([api('GET', `/transactions?from=${from}&to=${to}`), api('GET', '/transactions?status=owed')]);
  const list = periodList.filter((t) => t.status !== 'owed');
  const mIn = list.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const mOut = list.filter((t) => t.type === 'out' && t.category !== 'Partner pay').reduce((s, t) => s + t.amount, 0);
  const partnerPaid = (who) => list.filter((t) => t.category === 'Partner pay' && t.paid_to === who).reduce((s, t) => s + t.amount, 0);
  const owedBy = {};
  owedList.forEach((t) => (owedBy[t.paid_to || 'Someone'] = (owedBy[t.paid_to || 'Someone'] || 0) + t.amount));
  const net = mIn - mOut;
  // Out-of-pocket: expenses a partner paid personally (business owes them back).
  const owed = (who) => list.filter((t) => t.type === 'out' && t.paid_by === who).reduce((s, t) => s + t.amount, 0);
  const byCat = {};
  list.filter((t) => t.type === 'out' && t.category !== 'Partner pay').forEach((t) => (byCat[t.category || 'Other'] = (byCat[t.category || 'Other'] || 0) + t.amount));
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
      <div class="stat"><div class="label">Costs</div><div class="value red">${money(mOut)}</div><div class="muted" style="font-size:.8rem">Subs, materials, expenses</div></div>
      <div class="stat"><div class="label">Profit</div><div class="value">${money(net)}</div></div>
      <div class="stat"><div class="label">Paid to Moss</div><div class="value">${money(partnerPaid('Moss'))}</div></div>
      <div class="stat"><div class="label">Paid to Isaiah</div><div class="value">${money(partnerPaid('Isaiah'))}</div></div>
    </div>
    ${owed('Isaiah') || owed('Moss') ? `<div class="card"><h3>Paid out of pocket</h3><p class="muted" style="margin:0">Business expenses a partner paid with their own money (the business owes them back):
      Isaiah ${money(owed('Isaiah'))} · Moss ${money(owed('Moss'))}</p></div>` : ''}
    ${owedList.length ? `<div class="card"><h3>Due when jobs finish</h3>
      <p class="muted" style="margin:0 0 .4rem">${Object.entries(owedBy).map(([k, v]) => `${esc(personLabel(k))} <strong>${money(v)}</strong>`).join(' · ')}</p>
      <ul class="list" id="owed-list">${owedList.map(txRow).join('')}</ul></div>` : ''}
    <div class="grid">
      <div class="card" style="grid-column: 1 / -1"><ul class="list" id="tx-list">${list.map(txRow).join('') || '<li class="empty">No entries for this period.</li>'}</ul></div>
      ${Object.keys(byCat).length ? `<div class="card"><h3>Where the money went</h3><table class="totals">${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${money(v)}</td></tr>`).join('')}</table></div>` : ''}
    </div>`;
  $('#add').onclick = () => editTransaction({}, pageMoney);
  wireTxs($('#tx-list'), list, pageMoney);
  if (owedList.length) wireTxs($('#owed-list'), owedList, pageMoney);
  $$('[data-period]').forEach((b) => (b.onclick = () => { moneyView.period = b.dataset.period; pageMoney(); }));
  $('#pick').onchange = (e) => { if (!e.target.value) return; moneyView[moneyView.period] = e.target.value; pageMoney(); };
  $('#csv').onclick = () => {
    const rows = [['Date', 'Type', 'Amount', 'Category', 'Description', 'Paid to', 'Job', 'Customer', 'Paid with']]
      .concat(list.map((t) => [t.date, t.type === 'in' ? 'In' : 'Out', t.amount.toFixed(2), t.category || '', t.description || '', t.paid_to || '', jobAddress(t.job_id), customerName(t.customer_id), t.paid_by || '']));
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

const PLACEHOLDERS = ['customer_name', 'customer_address', 'customer_phone', 'customer_email', 'date', 'job_title', 'job_address', 'job_scope', 'job_price', 'start_date', 'finish_date', 'estimate_number', 'estimate_items', 'estimate_total'];
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

function fillTemplate(body, c, est, job) {
  const t = est ? estimateTotals(est) : null;
  const scope = job ? checklist(job.scope).map((i) => `  • ${i.text}`).join('\n') : '';
  const values = {
    customer_name: c?.name, customer_address: c?.address || job?.address, customer_phone: c?.phone, customer_email: c?.email,
    date: fmtLongDate(todayStr()),
    job_title: est?.title || job?.address,
    job_address: job?.address || c?.address,
    job_scope: scope,
    job_price: job?.price ? money(job.price) : '',
    start_date: job?.start_date ? fmtLongDate(job.start_date) : '',
    finish_date: job?.finish_date ? fmtLongDate(job.finish_date) : '',
    estimate_number: est?.number,
    // With no estimate picked, fall back to the job's scope and price.
    estimate_items: t ? t.items.map((i) => `  • ${i.desc} — ${i.qty} × ${money(i.price)} = ${money((Number(i.qty) || 0) * (Number(i.price) || 0))}`).join('\n') +
      (t.tax ? `\n  Tax: ${money(t.tax)}` : '') : scope,
    estimate_total: t ? money(t.total) : job?.price ? money(job.price) : '',
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (values[k] ? values[k] : '____________________'));
}

async function pageContractNew(query) {
  await customers();
  const [templates, estimates] = await Promise.all([api('GET', '/templates'), api('GET', '/estimates'), jobs()]);
  const state = {
    template: Number(query.get('template')) || templates[0]?.id,
    estimate: Number(query.get('estimate')) || null,
    customer: Number(query.get('customer')) || null,
    job: Number(query.get('job')) || null,
  };
  if (state.estimate && !state.job) state.job = estimates.find((e) => e.id === state.estimate)?.job_id || null;
  if (state.job && !state.customer) state.customer = jobsCache.find((j) => j.id === state.job)?.customer_id || null;
  if (state.estimate && !state.customer) state.customer = estimates.find((e) => e.id === state.estimate)?.customer_id || null;

  view.innerHTML = `
    <div class="no-print">
      <p><a href="#/contracts">‹ Contracts</a></p>
      <div class="card">
        <h2>Create a contract</h2>
        <div class="form-grid">
          <label>Template <select id="c-tpl">${templates.map((t) => `<option value="${t.id}" ${t.id === state.template ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
          <label>Customer <select id="c-cust">${customerOptions(state.customer, '— Pick customer —')}</select></label>
          <label>Job (fills in address, dates & scope) <select id="c-job"></select></label>
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
        ${LETTERHEAD}
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
  const renderJobOptions = () => {
    const mine = jobsCache.filter((j) => !state.customer || j.customer_id === state.customer);
    if (state.job && !mine.some((j) => j.id === state.job)) state.job = null;
    $('#c-job').innerHTML = jobOptions(state.job, mine);
  };
  const render = () => {
    const tpl = templates.find((t) => t.id === state.template);
    const c = customersCache.find((x) => x.id === state.customer);
    const est = estimates.find((e) => e.id === state.estimate);
    const job = jobsCache.find((j) => j.id === state.job);
    $('#text').textContent = tpl ? fillTemplate(tpl.body, c, est, job) : 'No template yet — create one on the Contracts page.';
  };
  renderJobOptions();
  renderEstOptions();
  render();
  $('#c-tpl').onchange = (e) => { state.template = Number(e.target.value); render(); };
  $('#c-cust').onchange = (e) => { state.customer = Number(e.target.value) || null; renderJobOptions(); renderEstOptions(); render(); };
  $('#c-job').onchange = (e) => { state.job = Number(e.target.value) || null; render(); };
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
      <div style="display:flex;gap:12px;align-items:center;border-bottom:4px solid #a42f28;padding-bottom:8px;font-family:Arial,sans-serif">
        <img src="/logo.png" alt="" width="70" height="70">
        <div><div style="font-size:24px;font-weight:800;text-transform:uppercase">${BIZ.name}</div>
        <div style="color:#6e665a;font-size:14px">${BIZ.lines} · ${BIZ.city} · ${BIZ.phone}</div></div></div>
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
    </div>
    <form class="card" id="import">
      <h3>Import</h3>
      <p class="muted">Load a backup file or a starter file. This only adds records, it never deletes anything.</p>
      <input type="file" name="file" accept=".json,application/json" required>
      <button class="btn primary" style="margin-top:.6rem">Import</button>
    </form>`;
  $('#import').onsubmit = async (e) => {
    e.preventDefault();
    const file = e.target.elements.file.files[0];
    try {
      const data = JSON.parse(await file.text());
      const r = await api('POST', '/import', data);
      customersCache = null; jobsCache = null;
      toast('Imported: ' + Object.entries(r.counts).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', '));
      e.target.reset();
    } catch (err) { alert(err.message.startsWith('Unexpected') ? 'That is not a valid backup file.' : err.message); }
  };
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
    else if (section === 'jobs' && parts[1]) await pageJob(parts[1]);
    else if (section === 'jobs') await pageJobs();
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
  jobsCache = null;
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
