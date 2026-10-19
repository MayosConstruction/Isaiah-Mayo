// Mayo's Construction CRM — a small, zero-dependency server.
// Uses Node's built-in SQLite (node:sqlite) so there is nothing to install.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 30 * 1024 * 1024; // 30 MB (uploads arrive base64-encoded)
const SESSION_DAYS = 30;
const VERSION = require('./package.json').version;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const db = new DatabaseSync(path.join(DATA_DIR, 'crm.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT, email TEXT, address TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Scheduled',
  start_date TEXT, finish_date TEXT,
  price REAL DEFAULT 0,
  labor_cost REAL DEFAULT 0,
  materials_cost REAL DEFAULT 0,
  materials_status TEXT DEFAULT 'Not bought yet',
  materials TEXT DEFAULT '[]',
  scope TEXT DEFAULT '[]',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  due_date TEXT,
  assigned_to TEXT DEFAULT 'Both',
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT, end_time TEXT,
  location TEXT, notes TEXT,
  assigned_to TEXT DEFAULT 'Both',
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS estimates (
  id INTEGER PRIMARY KEY,
  number TEXT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  title TEXT,
  date TEXT,
  status TEXT DEFAULT 'Draft',
  items TEXT DEFAULT '[]',
  tax_rate REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT,
  description TEXT,
  paid_by TEXT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  kind TEXT,
  channel TEXT,
  body TEXT NOT NULL,
  sent_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'Signed contract',
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  uploaded_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// ---- Columns added after the first version (safe to run every start) ----
function addColumn(table, col, def) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addColumn('transactions', 'job_id', 'INTEGER REFERENCES jobs(id) ON DELETE SET NULL');
addColumn('transactions', 'paid_to', 'TEXT');
addColumn('transactions', 'status', "TEXT DEFAULT 'paid'"); // 'paid' or 'owed' (owed = not counted as money out yet)
addColumn('todos', 'job_id', 'INTEGER REFERENCES jobs(id) ON DELETE SET NULL');
addColumn('estimates', 'job_id', 'INTEGER REFERENCES jobs(id) ON DELETE SET NULL');
addColumn('events', 'job_id', 'INTEGER REFERENCES jobs(id) ON DELETE SET NULL');
addColumn('messages', 'to_number', 'TEXT');
addColumn('jobs', 'crew', "TEXT DEFAULT 'Moss & Isaiah'"); // who's coming
addColumn('jobs', 'arrival_time', 'TEXT');
// Online signing: the customer opens /sign/<token>, reviews, and signs.
for (const [col, def] of [['sign_token', 'TEXT'], ['contract_text', 'TEXT'], ['sent_at', 'TEXT'], ['signed_at', 'TEXT'],
  ['signed_name', 'TEXT'], ['signature', 'TEXT'], ['signed_ip', 'TEXT'], ['signed_document_id', 'INTEGER'], ['sent_by', 'TEXT'],
  // kind: 'estimate' or 'change_order'
  ['kind', "TEXT DEFAULT 'estimate'"], ['deposit_percent', 'REAL'], ['days_added', 'INTEGER DEFAULT 0']]) addColumn('estimates', col, def);

// Moss and Isaiah are 50/50 partners: what they take from a job is "Partner pay",
// everyone else on labor is a "Subcontractor". Older wording is converted here.
const PARTNERS = ['Moss', 'Isaiah'];
function normalizeWording() {
  db.exec(`
    UPDATE transactions SET paid_to = 'Moss' WHERE lower(trim(paid_to)) IN ('dad', 'moss', 'moss mayo');
    UPDATE transactions SET paid_to = 'Isaiah' WHERE lower(trim(paid_to)) IN ('isaiah', 'isaiah mayo', 'me');
    UPDATE transactions SET category = 'Partner pay' WHERE category = 'Labor / Sub' AND paid_to IN ('Moss', 'Isaiah');
    UPDATE transactions SET category = 'Subcontractor' WHERE category = 'Labor / Sub';
    UPDATE jobs SET materials_status = CASE materials_status
      WHEN 'Paid' THEN 'Purchased' WHEN 'Unspent' THEN 'Not bought yet' WHEN 'Unpaid' THEN 'Bought, not paid yet'
      ELSE materials_status END;
  `);
}
normalizeWording();

// ---- Password helpers ----
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(password, salt, hash) {
  const test = crypto.scryptSync(String(password), salt, 64);
  const real = Buffer.from(hash, 'hex');
  return test.length === real.length && crypto.timingSafeEqual(test, real);
}

// ---- Seed the two partners and a starter contract template ----
const DEFAULT_PASSWORD = 'mayo2026';
for (const [username, name, envVar] of [
  ['isaiah', 'Isaiah', 'ISAIAH_PASSWORD'],
  ['moss', 'Moss', 'MOSS_PASSWORD'],
]) {
  if (!db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    const pw = process.env[envVar] || DEFAULT_PASSWORD;
    const { salt, hash } = hashPassword(pw);
    db.prepare('INSERT INTO users (username, name, salt, hash) VALUES (?,?,?,?)').run(username, name, salt, hash);
    if (!process.env[envVar]) {
      console.warn(`[setup] Created login "${username}" with the default password "${DEFAULT_PASSWORD}". Change it under Settings after you log in.`);
    }
  }
}
// ---- Business settings (license #, deposit %, warranty, etc.) ----
db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
const SETTING_DEFAULTS = {
  business_name: "Mayo's Construction",
  business_phone: '870-617-3507',
  business_email: '',
  business_city: 'Hot Springs, AR',
  business_lines: 'Construction · Remodeling · Roofing',
  license_number: '',
  insurance: '',
  deposit_percent: '50',
  warranty_years: '1',
  late_fee: '1.5% per month',
  exclusions: [
    '  • Painting or staining',
    '  • Electrical, plumbing, or HVAC work',
    '  • Repair of hidden damage (rot, termites, water damage, mold) — see Section 8',
    '  • Testing for or removal of asbestos, lead paint, or mold',
    '  • Moving furniture, appliances, or personal belongings',
    '  • Landscaping repair, tree trimming, or tree removal',
    '  • Engineering, surveys, or architectural drawings',
  ].join('\n'),
};
function getSettings() {
  const out = { ...SETTING_DEFAULTS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) if (r.key in out) out[r.key] = r.value;
  return out;
}
function saveSettings(body) {
  for (const key of Object.keys(SETTING_DEFAULTS)) {
    if (body[key] !== undefined) db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(body[key] ?? ''));
  }
  return getSettings();
}

// ---- Contract templates that ship with the app (added if missing, never overwritten) ----
for (const [name, file] of [['Residential Construction Agreement', 'residential-agreement.txt'], ['Change Order', 'change-order.txt']]) {
  if (!db.prepare('SELECT 1 FROM templates WHERE name = ?').get(name)) {
    db.prepare('INSERT INTO templates (name, body) VALUES (?, ?)').run(name, fs.readFileSync(path.join(__dirname, 'templates', file), 'utf8'));
  }
}
// Remove the lien-notice placeholder section that an earlier version of the agreement had.
for (const t of db.prepare("SELECT id, body FROM templates WHERE body LIKE '%[PASTE THE RESIDENTIAL LIEN NOTICE%'").all()) {
  const body = t.body
    .replace(/\n*20\. IMPORTANT NOTICE TO OWNER \(ARKANSAS LIEN LAW\)\n\[PASTE[\s\S]*?\]\n*/, '\n\n\n')
    .replace('including the Right to Cancel and the Notice to Owner, and agree', 'including the Right to Cancel, and agree');
  db.prepare('UPDATE templates SET body = ? WHERE id = ?').run(body, t.id);
}
// Signature lines are drawn by the app (boxes on print, real signatures online), not underlines.
for (const t of db.prepare("SELECT id, body FROM templates WHERE body LIKE '%Signature: ______________________________%'").all()) {
  const body = t.body
    .replace(/\nSignature: _{30}   Date: _{12}\n/g, '\n')
    .replace(/(By: \{\{contractor_signer\}\})   Signature: _{30}   Date: _{12}/g, '$1')
    .replace(/\n{3,}/g, '\n\n');
  db.prepare('UPDATE templates SET body = ? WHERE id = ?').run(body, t.id);
}
// The first version's one-page starter is replaced by the agreement above (only if nobody edited it).
db.prepare("DELETE FROM templates WHERE name = 'Construction Agreement (starter)' AND body LIKE '%Payments not received within 15 days of the due date may be subject to a late charge.%'").run();

// ---------------------------------------------------------------------------
// Generic CRUD resources (column whitelist per table)
// ---------------------------------------------------------------------------
const JOB_ORDER = `CASE status WHEN 'In Progress' THEN 0 WHEN 'Scheduled' THEN 1 WHEN 'Estimate Pending' THEN 2 WHEN 'Done' THEN 3 ELSE 4 END,
  start_date IS NULL, start_date, id`;
const RESOURCES = {
  jobs: {
    cols: ['address', 'customer_id', 'status', 'start_date', 'finish_date', 'price', 'labor_cost', 'materials_cost', 'materials_status', 'materials', 'scope', 'notes', 'crew', 'arrival_time'],
    required: ['address'], order: JOB_ORDER,
  },
  customers: { cols: ['name', 'phone', 'email', 'address', 'notes'], required: ['name'], order: 'name COLLATE NOCASE' },
  todos: { cols: ['title', 'notes', 'due_date', 'assigned_to', 'customer_id', 'job_id', 'done'], required: ['title'], order: 'done, due_date IS NULL, due_date, id DESC' },
  events: { cols: ['title', 'date', 'start_time', 'end_time', 'location', 'notes', 'assigned_to', 'customer_id', 'job_id'], required: ['title', 'date'], order: 'date, start_time IS NULL, start_time' },
  estimates: { cols: ['number', 'kind', 'customer_id', 'job_id', 'title', 'date', 'status', 'items', 'tax_rate', 'notes', 'deposit_percent', 'days_added'], required: [], order: 'id DESC' },
  transactions: { cols: ['type', 'date', 'amount', 'category', 'description', 'paid_by', 'paid_to', 'status', 'customer_id', 'job_id'], required: ['type', 'date', 'amount'], order: 'date DESC, id DESC' },
  templates: { cols: ['name', 'body'], required: ['name', 'body'], order: 'name COLLATE NOCASE' },
  messages: { cols: ['job_id', 'customer_id', 'kind', 'channel', 'body', 'sent_by'], required: ['body'], order: 'id DESC' },
};

function cleanValue(col, v) {
  if (v === undefined) return undefined;
  if (v === '' || v === null) return null;
  if (col === 'items' || col === 'materials' || col === 'scope') return typeof v === 'string' ? v : JSON.stringify(v);
  if (col === 'done') return v ? 1 : 0;
  if (['amount', 'tax_rate', 'price', 'labor_cost', 'materials_cost', 'deposit_percent', 'days_added'].includes(col)) return Number(v) || 0;
  if (col === 'customer_id' || col === 'job_id') return Number(v) || null;
  return String(v);
}

function pickFields(resource, body, forInsert) {
  const def = RESOURCES[resource];
  const out = {};
  for (const col of def.cols) {
    const v = cleanValue(col, body[col]);
    if (v !== undefined) out[col] = v;
  }
  if (forInsert) {
    for (const r of def.required) {
      if (out[r] === undefined || out[r] === null) throw httpError(400, `"${r}" is required`);
    }
  }
  if (resource === 'transactions' && out.type !== undefined && !['in', 'out'].includes(out.type)) {
    throw httpError(400, 'type must be "in" or "out"');
  }
  if (resource === 'transactions' && out.status !== undefined && out.status !== null && !['paid', 'owed'].includes(out.status)) {
    throw httpError(400, 'status must be "paid" or "owed"');
  }
  return out;
}

function listResource(resource, query) {
  const def = RESOURCES[resource];
  const where = [];
  const params = [];
  for (const key of ['customer_id', 'job_id']) {
    if (query[key] && def.cols.includes(key)) {
      where.push(`${key} = ?`);
      params.push(Number(query[key]));
    }
  }
  if (resource === 'transactions') {
    if (query.status === 'owed') where.push("status = 'owed'");
    if (query.from) { where.push('date >= ?'); params.push(query.from); }
    if (query.to) { where.push('date <= ?'); params.push(query.to); }
  }
  if (resource === 'events') {
    if (query.from) { where.push('date >= ?'); params.push(query.from); }
    if (query.to) { where.push('date <= ?'); params.push(query.to); }
  }
  const sql = `SELECT * FROM ${resource}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${def.order}`;
  return db.prepare(sql).all(...params);
}

function insertResource(resource, body) {
  const fields = pickFields(resource, body, true);
  if (resource === 'estimates') {
    if (!fields.number) fields.number = nextEstimateNumber(fields.kind);
    if (!fields.date) fields.date = today();
  }
  const cols = Object.keys(fields);
  const info = db
    .prepare(`INSERT INTO ${resource} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...cols.map((c) => fields[c]));
  return db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(info.lastInsertRowid);
}

function updateResource(resource, id, body) {
  const fields = pickFields(resource, body, false);
  const cols = Object.keys(fields);
  if (cols.length) {
    db.prepare(`UPDATE ${resource} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => fields[c]), id);
  }
  const row = db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(id);
  if (!row) throw httpError(404, 'Not found');
  return row;
}

// Estimates are E-1001, E-1002…; change orders are CO-1001, CO-1002…
function nextEstimateNumber(kind) {
  const prefix = kind === 'change_order' ? 'CO-' : 'E-';
  const row = db.prepare(`SELECT MAX(CAST(SUBSTR(number, ${prefix.length + 1}) AS INTEGER)) AS n FROM estimates WHERE number LIKE '${prefix}%'`).get();
  return prefix + ((row && row.n) ? row.n + 1 : 1001);
}

function today() {
  // Local date (server's timezone; set TZ=America/Chicago for Hot Springs)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------------
// Profit = money in minus business costs (subs, materials, other expenses).
// Partner pay to Moss and Isaiah is how profit gets split, so it is not a cost.
// "Due at completion" entries (status 'owed') are not counted until paid.
function moneyBetween(from, to) {
  const r = db
    .prepare(`SELECT
      COALESCE(SUM(CASE WHEN type='in' THEN amount END), 0) AS money_in,
      COALESCE(SUM(CASE WHEN type='out' AND COALESCE(category,'') != 'Partner pay' THEN amount END), 0) AS costs,
      COALESCE(SUM(CASE WHEN type='out' AND category = 'Partner pay' AND paid_to = 'Moss' THEN amount END), 0) AS moss,
      COALESCE(SUM(CASE WHEN type='out' AND category = 'Partner pay' AND paid_to = 'Isaiah' THEN amount END), 0) AS isaiah,
      -- Cash that actually left the business (not costs a partner covered out of pocket).
      COALESCE(SUM(CASE WHEN type='out' AND COALESCE(paid_by, 'Business') = 'Business' THEN amount END), 0) AS cash_out
      FROM transactions WHERE date >= ? AND date <= ? AND COALESCE(status, 'paid') = 'paid'`)
    .get(from, to);
  return {
    in: r.money_in, costs: r.costs, profit: r.money_in - r.costs, paid: { Moss: r.moss, Isaiah: r.isaiah },
    cash: r.money_in - r.cash_out,
  };
}

// Per job: what the customer has paid, what was spent, and who got (or is due) labor money.
function jobMoney() {
  const out = {};
  const blank = () => ({ collected: 0, materials: 0, other: 0, subs: {}, partners: { Moss: { paid: 0, due: 0 }, Isaiah: { paid: 0, due: 0 } } });
  for (const r of db.prepare(`SELECT job_id, type, category, paid_to, COALESCE(status,'paid') AS status, SUM(amount) AS total
    FROM transactions WHERE job_id IS NOT NULL GROUP BY job_id, type, category, paid_to, COALESCE(status,'paid')`).all()) {
    const j = (out[r.job_id] ||= blank());
    const key = r.status === 'owed' ? 'due' : 'paid';
    if (r.type === 'in') { if (key === 'paid') j.collected += r.total; continue; }
    if (r.category === 'Partner pay' && PARTNERS.includes(r.paid_to)) j.partners[r.paid_to][key] += r.total;
    else if (r.category === 'Subcontractor') {
      const name = r.paid_to || 'Subcontractor';
      (j.subs[name] ||= { paid: 0, due: 0 })[key] += r.total;
    } else if (key === 'paid') {
      if (r.category === 'Materials') j.materials += r.total; else j.other += r.total;
    }
  }
  return out;
}

function summary() {
  const t = today();
  const [y, m] = t.split('-');
  const weekAhead = new Date(Date.now() + 7 * 864e5);
  const weekAheadStr = `${weekAhead.getFullYear()}-${String(weekAhead.getMonth() + 1).padStart(2, '0')}-${String(weekAhead.getDate()).padStart(2, '0')}`;
  return {
    today: t,
    month: moneyBetween(`${y}-${m}-01`, `${y}-${m}-31`),
    year: moneyBetween(`${y}-01-01`, `${y}-12-31`),
    allTime: moneyBetween('0000-01-01', '9999-12-31'),
    todos: db.prepare('SELECT * FROM todos WHERE done = 0 ORDER BY due_date IS NULL, due_date, id DESC LIMIT 10').all(),
    overdue: db.prepare('SELECT COUNT(*) AS n FROM todos WHERE done = 0 AND due_date < ?').get(t).n,
    events: db.prepare('SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date, start_time IS NULL, start_time').all(t, weekAheadStr),
    openEstimates: db.prepare("SELECT * FROM estimates WHERE status IN ('Draft','Sent') ORDER BY id DESC").all(),
    customerCount: db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,
    starterLoaded: !!db.prepare("SELECT 1 FROM settings WHERE key = 'starter_loaded'").get(),
    jobs: db.prepare(`SELECT * FROM jobs WHERE status IN ('In Progress','Scheduled','Estimate Pending') ORDER BY ${JOB_ORDER}`).all(),
    jobMoney: jobMoney(),
  };
}

// ---------------------------------------------------------------------------
// Import (a backup file, or a starter file). Adds records; never deletes.
// Ids in the file are remapped so it can be loaded into a database that
// already has data.
// ---------------------------------------------------------------------------
const IMPORT_ORDER = ['customers', 'jobs', 'todos', 'events', 'estimates', 'transactions', 'templates'];
// Importing the same file twice shouldn't double anything. Matching records are
// reused, and a customer that already exists gets any blank phone/email/address filled in.
function findExisting(table, row) {
  if (table === 'customers') {
    const c = db.prepare('SELECT * FROM customers WHERE lower(trim(name)) = lower(trim(?))').get(String(row.name || ''));
    if (c) {
      for (const col of ['phone', 'email', 'address']) {
        if (!c[col] && row[col]) db.prepare(`UPDATE customers SET ${col} = ? WHERE id = ?`).run(String(row[col]), c.id);
      }
    }
    return c;
  }
  if (table === 'jobs') return db.prepare('SELECT id FROM jobs WHERE lower(trim(address)) = lower(trim(?))').get(String(row.address || ''));
  if (table === 'todos') return db.prepare('SELECT id FROM todos WHERE title = ?').get(String(row.title || ''));
  if (table === 'events') return db.prepare('SELECT id FROM events WHERE title = ? AND date = ?').get(String(row.title || ''), String(row.date || ''));
  if (table === 'transactions') {
    return db.prepare('SELECT id FROM transactions WHERE type = ? AND date = ? AND amount = ? AND job_id IS ?')
      .get(String(row.type), String(row.date), Number(row.amount) || 0, row.job_id ?? null);
  }
  return null;
}
function importData(data) {
  if (!data || typeof data !== 'object') throw httpError(400, 'Not a valid import file');
  const idMap = { customers: {}, jobs: {} };
  const counts = {};
  db.exec('BEGIN');
  try {
    for (const table of IMPORT_ORDER) {
      const rows = Array.isArray(data[table]) ? data[table] : [];
      counts[table] = 0;
      for (const row of rows) {
        if (table === 'templates' && db.prepare('SELECT 1 FROM templates WHERE name = ?').get(row.name)) continue;
        const copy = { ...row };
        if (copy.customer_id != null) copy.customer_id = idMap.customers[copy.customer_id] ?? null;
        if (copy.job_id != null) copy.job_id = idMap.jobs[copy.job_id] ?? null;
        if (table === 'estimates') delete copy.number; // get a fresh number
        const existing = findExisting(table, copy);
        if (existing) {
          if (row.id != null && idMap[table]) idMap[table][row.id] = existing.id;
          continue;
        }
        const saved = insertResource(table, copy);
        if (row.id != null && idMap[table]) idMap[table][row.id] = saved.id;
        counts[table]++;
      }
    }
    normalizeWording();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err.status ? err : httpError(400, 'Import failed: ' + err.message);
  }
  return { ok: true, counts };
}

// Starter data (your existing jobs and customers) ships encrypted, because the
// code repository is public. The code to unlock it was given to the owners.
function unlockStarter(code) {
  const file = path.join(__dirname, 'seed', 'workshop.enc.json');
  if (!fs.existsSync(file)) return null;
  // Accept the code typed any way: lowercase, with or without dashes/spaces.
  const raw = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalized = raw.match(/.{1,4}/g)?.join('-') || '';
  try {
    const box = JSON.parse(fs.readFileSync(file, 'utf8'));
    const key = crypto.scryptSync(normalized, Buffer.from(box.salt, 'base64'), 32);
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
    d.setAuthTag(Buffer.from(box.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Business texting through Twilio. Texts come from the company's own number
// instead of opening someone's personal Messages app. Set these on Render:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
//   TEXT_FORWARD_TO (optional): a cell number that customer replies are forwarded to
// ---------------------------------------------------------------------------
//   TWILIO_MESSAGING_SERVICE_SID (optional): a Twilio Messaging Service with an RCS sender,
//     so iPhones (iOS 18+) see "Mayo's Construction" with the logo; others get a normal text.
function textingConfig() {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from, TWILIO_MESSAGING_SERVICE_SID: service } = process.env;
  return sid && token && (from || service) ? { sid, token, from: toE164(from), service } : null;
}
function senderLabel(cfg) {
  return cfg.service ? `${bizInfo().name}${cfg.from ? ' / ' + prettyPhone(cfg.from) : ''}` : prettyPhone(cfg.from);
}
function toE164(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.startsWith('1')) return '+' + d;
  return d ? '+' + d : '';
}
function prettyPhone(p) {
  const d = toE164(p).replace(/^\+1/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

async function sendText(body, user) {
  const cfg = textingConfig();
  if (!cfg) throw httpError(400, 'Business texting is not set up yet (see Settings).');
  const to = toE164(body.to);
  let text = String(body.body || '').trim();
  if (to.length < 11) throw httpError(400, 'That phone number does not look right.');
  if (!text) throw httpError(400, 'The message is empty.');
  // The first business text to a number tells them how to opt out (required by carriers).
  const texted = db.prepare("SELECT 1 FROM messages WHERE channel = 'sms' AND to_number = ?").get(to);
  if (!texted) text += '\nReply STOP to opt out.';
  const base = process.env.TWILIO_API_BASE || 'https://api.twilio.com';
  const r = await fetch(`${base}/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(cfg.service ? { To: to, MessagingServiceSid: cfg.service, Body: text } : { To: to, From: cfg.from, Body: text }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw httpError(502, 'Text not sent: ' + (out.message || `Twilio error ${r.status}`));
  insertResource('messages', {
    job_id: body.job_id, customer_id: body.customer_id, kind: body.kind, channel: 'sms', body: text, sent_by: user.name,
  });
  db.prepare("UPDATE messages SET to_number = ? WHERE id = (SELECT MAX(id) FROM messages)").run(to);
  return { ok: true, from: senderLabel(cfg) };
}

// Twilio calls this when a customer texts back. We log it on their job and
// forward it to TEXT_FORWARD_TO so the reply lands on a real phone.
function twilioSignatureOk(req, params) {
  const cfg = textingConfig();
  if (!cfg) return false;
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  const url = `${proto}://${req.headers.host}${req.url}`;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', cfg.token).update(data).digest('base64');
  const got = String(req.headers['x-twilio-signature'] || '');
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
async function handleIncomingText(req, res) {
  const chunks = [];
  for await (const c of req) { chunks.push(c); if (chunks.length > 100) break; }
  const params = Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
  if (!twilioSignatureOk(req, params)) return send(res, 403, 'Forbidden');
  const from = toE164(params.From);
  const digits = from.replace(/^\+1/, '');
  const c = db.prepare("SELECT id, name FROM customers WHERE replace(replace(replace(replace(replace(phone,'-',''),' ',''),'(',''),')',''),'.','') LIKE ?").get('%' + digits);
  const job = c && db.prepare(`SELECT id FROM jobs WHERE customer_id = ? ORDER BY ${JOB_ORDER} LIMIT 1`).get(c.id);
  insertResource('messages', { job_id: job?.id, customer_id: c?.id, kind: 'Reply', channel: 'sms-in', body: String(params.Body || ''), sent_by: c?.name || prettyPhone(from) });
  const fwd = toE164(process.env.TEXT_FORWARD_TO);
  const reply = fwd ? `<Message to="${escHtml(fwd)}">Reply from ${escHtml(c?.name || prettyPhone(from))}: ${escHtml(params.Body || '')}</Message>` : '';
  send(res, 200, `<?xml version="1.0" encoding="UTF-8"?><Response>${reply}</Response>`, { 'Content-Type': 'text/xml' });
}

// ---------------------------------------------------------------------------
// Online signing
// ---------------------------------------------------------------------------
function bizInfo() {
  const st = getSettings();
  return { name: st.business_name, phone: st.business_phone, email: st.business_email, city: st.business_city, lines: st.business_lines, license: st.license_number };
}
function escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtMoney(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function estimateMath(est) {
  let items = [];
  try { items = JSON.parse(est.items || '[]'); } catch {}
  const subtotal = items.reduce((t, i) => t + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const tax = subtotal * (Number(est.tax_rate) || 0) / 100;
  return { items, subtotal, tax, total: subtotal + tax };
}

function startSigning(id, body, user) {
  const est = db.prepare('SELECT * FROM estimates WHERE id = ?').get(id);
  if (!est) throw httpError(404, 'Not found');
  if (est.signed_at) throw httpError(400, 'This estimate is already signed');
  const token = est.sign_token || crypto.randomBytes(24).toString('hex');
  db.prepare("UPDATE estimates SET sign_token = ?, contract_text = ?, sent_at = datetime('now'), sent_by = ?, status = CASE WHEN status = 'Draft' THEN 'Sent' ELSE status END WHERE id = ?")
    .run(token, body.contract_text ? String(body.contract_text) : null, user.name, id);
  return db.prepare('SELECT * FROM estimates WHERE id = ?').get(id);
}

function publicEstimate(token) {
  const est = token && db.prepare('SELECT * FROM estimates WHERE sign_token = ?').get(String(token));
  if (!est) throw httpError(404, `This link is not valid. Please contact ${bizInfo().name} at ${bizInfo().phone}.`);
  const c = est.customer_id ? db.prepare('SELECT name, address, phone, email FROM customers WHERE id = ?').get(est.customer_id) : null;
  return { est, c };
}

function signedHtml(est, c) {
  const m = estimateMath(est);
  const BIZ = bizInfo();
  const label = est.kind === 'change_order' ? 'Change Order' : 'Estimate';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signed - ${escHtml(est.number)}</title></head>
<body style="font-family:Arial,sans-serif;max-width:780px;margin:24px auto;padding:0 16px;color:#151515;line-height:1.5">
<div style="display:flex;gap:12px;align-items:center;border-bottom:4px solid #a42f28;padding-bottom:8px">
  <img src="/logo.png" alt="" width="70" height="70">
  <div><div style="font-size:24px;font-weight:800;text-transform:uppercase">${BIZ.name}</div>
  <div style="color:#6e665a;font-size:14px">${BIZ.lines} · ${BIZ.city} · ${BIZ.phone}${BIZ.license ? ' · AR License #' + escHtml(BIZ.license) : ''}</div></div></div>
<h2 style="margin:18px 0 4px">${label} ${escHtml(est.number)}${est.title ? ' — ' + escHtml(est.title) : ''}</h2>
<p style="margin:0 0 12px">Prepared for: <strong>${escHtml(c?.name)}</strong>${c?.address ? ' · ' + escHtml(c.address) : ''}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><th align="left">Description</th><th align="right">Qty</th><th align="right">Price</th><th align="right">Amount</th></tr>
${m.items.map((i) => `<tr style="border-top:1px solid #ddd"><td>${escHtml(i.desc)}</td><td align="right">${escHtml(i.qty)}</td><td align="right">${fmtMoney(i.price)}</td><td align="right">${fmtMoney((Number(i.qty) || 0) * (Number(i.price) || 0))}</td></tr>`).join('')}
${m.tax ? `<tr><td colspan="3" align="right">Tax</td><td align="right">${fmtMoney(m.tax)}</td></tr>` : ''}
<tr style="border-top:2px solid #151515"><td colspan="3" align="right"><strong>Total</strong></td><td align="right"><strong>${fmtMoney(m.total)}</strong></td></tr>
</table>
${est.notes ? `<p style="white-space:pre-wrap">${escHtml(est.notes)}</p>` : ''}
${est.contract_text ? `<div style="white-space:pre-wrap;font-family:Georgia,serif;font-size:15px;margin-top:20px;border-top:1px solid #ddd;padding-top:12px">${escHtml(est.contract_text)}</div>` : ''}
<div style="margin-top:24px;border:2px solid #1e7a45;border-radius:8px;padding:12px">
  <div><strong>Signed electronically by:</strong> ${escHtml(est.signed_name)}</div>
  <img src="${escHtml(est.signature)}" alt="Signature" style="max-width:320px;height:auto;border-bottom:1px solid #151515;margin:8px 0">
  <div style="font-size:13px;color:#6e665a">Signed ${escHtml(est.signed_at)} UTC · IP ${escHtml(est.signed_ip)} · The signer agreed to sign electronically.</div>
</div>
<div style="margin-top:12px;border:2px solid #151515;border-radius:8px;padding:12px">
  <div><strong>Contractor:</strong> ${escHtml(BIZ.name)}, by ${escHtml(est.sent_by || 'Moss Mayo / Isaiah Mayo')}</div>
  <div style="font-size:13px;color:#6e665a">Sent for signature ${escHtml(est.sent_at || '')} UTC; Contractor's sending of this document is its electronic signature.</div>
</div></body></html>`;
}

function completeSigning(token, body, req) {
  const { est, c } = publicEstimate(token);
  if (est.signed_at) throw httpError(400, 'This has already been signed. Thank you!');
  const name = String(body.name || '').trim();
  const sig = String(body.signature || '');
  if (!name) throw httpError(400, 'Please type your full name');
  if (!body.agree) throw httpError(400, 'Please check the box to agree');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig) || sig.length > 600000) throw httpError(400, 'Please sign in the box');
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE estimates SET signed_at = datetime('now'), signed_name = ?, signature = ?, signed_ip = ?, status = 'Accepted' WHERE id = ?")
      .run(name, sig, ip, est.id);
    const signed = db.prepare('SELECT * FROM estimates WHERE id = ?').get(est.id);
    const filename = crypto.randomBytes(12).toString('hex') + '.html';
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), signedHtml(signed, c));
    const doc = db.prepare('INSERT INTO documents (name, kind, customer_id, filename, mime, size, uploaded_by) VALUES (?,?,?,?,?,?,?)')
      .run(`${c?.name || 'Customer'} - ${est.number} signed`, 'Signed contract', est.customer_id, filename, 'text/html', fs.statSync(path.join(UPLOAD_DIR, filename)).size, 'Signed online');
    db.prepare('UPDATE estimates SET signed_document_id = ? WHERE id = ?').run(doc.lastInsertRowid, est.id);
    const isCO = est.kind === 'change_order';
    // A signed change order adds its amount (the price you set) to the job, and any extra days to the finish date.
    if (isCO && est.job_id) {
      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(est.job_id);
      if (job) {
        let finish = job.finish_date;
        if (finish && est.days_added) {
          const d = new Date(finish + 'T12:00:00');
          d.setDate(d.getDate() + Number(est.days_added));
          finish = d.toISOString().slice(0, 10);
        }
        db.prepare('UPDATE jobs SET price = ?, finish_date = ? WHERE id = ?').run((job.price || 0) + estimateMath(est).total, finish, job.id);
      }
    }
    // Shows up on both partners' to-do lists.
    db.prepare('INSERT INTO todos (title, due_date, customer_id, job_id, assigned_to) VALUES (?,?,?,?,?)')
      .run(isCO
        ? `✍️ ${c?.name || 'Customer'} approved change order ${est.number} (${fmtMoney(estimateMath(est).total)})`
        : `✍️ ${c?.name || 'Customer'} signed ${est.number}${est.title ? ' (' + est.title + ')' : ''}. Schedule it!`, today(), est.customer_id, est.job_id, 'Both');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Documents (signed contracts, photos, PDFs)
// ---------------------------------------------------------------------------
function saveDocument(body, user) {
  if (!body.name || !body.data) throw httpError(400, 'name and data are required');
  const buf = Buffer.from(String(body.data), 'base64');
  if (!buf.length) throw httpError(400, 'File is empty');
  const ext = path.extname(String(body.original_name || body.name)).replace(/[^.\w]/g, '').slice(0, 10);
  const filename = crypto.randomBytes(12).toString('hex') + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  const info = db
    .prepare('INSERT INTO documents (name, kind, customer_id, filename, mime, size, uploaded_by) VALUES (?,?,?,?,?,?,?)')
    .run(String(body.name), String(body.kind || 'Signed contract'), Number(body.customer_id) || null, filename,
      String(body.mime || 'application/octet-stream'), buf.length, user.name);
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function send(res, status, data, headers = {}) {
  const body = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': typeof data === 'object' && !Buffer.isBuffer(data) ? 'application/json' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(httpError(413, 'File too large (max about 20 MB)'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(httpError(400, 'Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const row = db
    .prepare('SELECT u.id, u.username, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
    .get(token);
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, username: row.username, name: row.name, token };
}

function sessionCookie(token, maxAgeSec) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure}`;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' || /^\/load\/[\w-]+$/.test(pathname) ? '/index.html' : /^\/sign\/[a-f0-9]+$/.test(pathname) ? '/sign.html' : pathname;
  const file = path.resolve(PUBLIC_DIR, '.' + decodeURIComponent(rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'Not found');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    // Stamp the version on script/style links so phones never keep an old copy after an update.
    if (file.endsWith('.html')) data = data.toString('utf8').replace(/(\/(?:app|sign)\.js|\/style\.css)"/g, `$1?v=${VERSION}"`);
    send(res, 200, data, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  });
}

// Very small login rate limit: 10 failed tries per IP per 15 minutes.
const failedLogins = new Map();
function tooManyFailures(ip) {
  const rec = failedLogins.get(ip);
  if (!rec || rec.reset < Date.now()) return false;
  return rec.count >= 10;
}
function noteFailure(ip) {
  const rec = failedLogins.get(ip);
  if (!rec || rec.reset < Date.now()) failedLogins.set(ip, { count: 1, reset: Date.now() + 15 * 60e3 });
  else rec.count++;
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"
  const method = req.method;

  // ---- Auth endpoints (no session needed) ----
  if (parts[0] === 'login' && method === 'POST') {
    const ip = req.socket.remoteAddress;
    if (tooManyFailures(ip)) throw httpError(429, 'Too many tries. Wait 15 minutes.');
    const { username, password } = await readBody(req);
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').toLowerCase().trim());
    if (!u || !checkPassword(password || '', u.salt, u.hash)) {
      noteFailure(ip);
      throw httpError(401, 'Wrong name or password');
    }
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, u.id, Date.now() + SESSION_DAYS * 864e5);
    return send(res, 200, { id: u.id, username: u.username, name: u.name }, { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) });
  }

  // ---- Customer signing (no login: the long random link is the key) ----
  if (parts[0] === 'public' && parts[1] === 'sign' && parts[2]) {
    const { est, c } = publicEstimate(parts[2]);
    if (method === 'GET' && !parts[3]) {
      const m = estimateMath(est);
      return send(res, 200, {
        business: bizInfo(), customer: c ? { name: c.name, address: c.address } : null,
        kind: est.kind, days_added: est.days_added, number: est.number, title: est.title, date: est.date, notes: est.notes, contract_text: est.contract_text,
        items: m.items, subtotal: m.subtotal, tax: m.tax, tax_rate: est.tax_rate, total: m.total,
        signed: !!est.signed_at, signed_name: est.signed_name, signed_at: est.signed_at,
      });
    }
    if (method === 'GET' && parts[3] === 'document' && est.signed_at) {
      return send(res, 200, signedHtml(est, c), {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      });
    }
    if (method === 'POST' && !parts[3]) return send(res, 200, completeSigning(parts[2], await readBody(req), req));
    throw httpError(404, 'Not found');
  }

  if (parts[0] === 'version' && method === 'GET') {
    return send(res, 200, { version: VERSION, commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) });
  }

  const user = currentUser(req);
  if (!user) throw httpError(401, 'Please log in');
  if (parts[0] === 'send-text' && method === 'POST') {
    return send(res, 200, await sendText(await readBody(req), user));
  }
  if (parts[0] === 'settings') {
    const cfg = textingConfig();
    const texting = { texting_enabled: !!cfg, texting_number: cfg ? senderLabel(cfg) : '', texting_forward: !!process.env.TEXT_FORWARD_TO };
    if (method === 'GET') return send(res, 200, { ...getSettings(), ...texting });
    if (method === 'PUT') return send(res, 200, { ...saveSettings(await readBody(req)), ...texting });
  }

  if (parts[0] === 'logout' && method === 'POST') {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(user.token);
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }
  if (parts[0] === 'me' && method === 'GET') {
    return send(res, 200, { id: user.id, username: user.username, name: user.name });
  }
  if (parts[0] === 'password' && method === 'POST') {
    const { current, next } = await readBody(req);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (!checkPassword(current || '', u.salt, u.hash)) throw httpError(400, 'Current password is wrong');
    if (!next || String(next).length < 6) throw httpError(400, 'New password must be at least 6 characters');
    const { salt, hash } = hashPassword(next);
    db.prepare('UPDATE users SET salt = ?, hash = ? WHERE id = ?').run(salt, hash, user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(user.id, user.token);
    return send(res, 200, { ok: true });
  }
  if (parts[0] === 'summary' && method === 'GET') {
    return send(res, 200, summary());
  }
  if (parts[0] === 'backup' && method === 'GET') {
    const out = { exported_at: new Date().toISOString() };
    for (const t of [...Object.keys(RESOURCES), 'documents']) out[t] = db.prepare(`SELECT * FROM ${t}`).all();
    return send(res, 200, JSON.stringify(out, null, 2), {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="mayo-crm-backup-${today()}.json"`,
    });
  }

  if (parts[0] === 'job-money' && method === 'GET') {
    return send(res, 200, jobMoney());
  }
  if (parts[0] === 'load-starter' && method === 'POST') {
    const ip = req.socket.remoteAddress;
    if (tooManyFailures(ip)) throw httpError(429, 'Too many tries. Wait 15 minutes.');
    const data = unlockStarter((await readBody(req)).code);
    if (!data) { noteFailure(ip); throw httpError(400, "That code didn't work. Check it and try again."); }
    const result = importData(data);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('starter_loaded', ?)").run(new Date().toISOString());
    return send(res, 200, result);
  }
  if (parts[0] === 'import' && method === 'POST') {
    return send(res, 200, importData(await readBody(req)));
  }

  if (parts[0] === 'estimates' && parts[2] === 'send' && method === 'POST') {
    return send(res, 200, startSigning(Number(parts[1]), await readBody(req), user));
  }

  // ---- Documents ----
  if (parts[0] === 'documents') {
    const id = Number(parts[1]);
    if (!parts[1] && method === 'GET') {
      const rows = url.searchParams.get('customer_id')
        ? db.prepare('SELECT * FROM documents WHERE customer_id = ? ORDER BY id DESC').all(Number(url.searchParams.get('customer_id')))
        : db.prepare('SELECT * FROM documents ORDER BY id DESC').all();
      return send(res, 200, rows);
    }
    if (!parts[1] && method === 'POST') return send(res, 201, saveDocument(await readBody(req), user));
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!doc) throw httpError(404, 'Not found');
    if (parts[2] === 'file' && method === 'GET') {
      const data = fs.readFileSync(path.join(UPLOAD_DIR, doc.filename));
      const disposition = url.searchParams.get('download') ? 'attachment' : 'inline';
      const safeName = (doc.name + path.extname(doc.filename)).replace(/[^\w.\- ]/g, '_');
      return send(res, 200, data, {
        'Content-Type': doc.mime || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${safeName}"`,
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      });
    }
    if (!parts[2] && method === 'PUT') {
      const b = await readBody(req);
      db.prepare('UPDATE documents SET name = COALESCE(?, name), kind = COALESCE(?, kind), customer_id = ? WHERE id = ?')
        .run(b.name || null, b.kind || null, Number(b.customer_id) || null, id);
      return send(res, 200, db.prepare('SELECT * FROM documents WHERE id = ?').get(id));
    }
    if (!parts[2] && method === 'DELETE') {
      db.prepare('DELETE FROM documents WHERE id = ?').run(id);
      fs.rm(path.join(UPLOAD_DIR, doc.filename), { force: true }, () => {});
      return send(res, 200, { ok: true });
    }
  }

  // ---- Generic CRUD ----
  const resource = parts[0];
  if (RESOURCES[resource]) {
    const id = parts[1] ? Number(parts[1]) : null;
    if (parts[1] && !Number.isInteger(id)) throw httpError(404, 'Not found');
    if (!id && method === 'GET') return send(res, 200, listResource(resource, Object.fromEntries(url.searchParams)));
    if (!id && method === 'POST') return send(res, 201, insertResource(resource, await readBody(req)));
    if (id && method === 'GET') {
      const row = db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(id);
      if (!row) throw httpError(404, 'Not found');
      return send(res, 200, row);
    }
    if (id && method === 'PUT') return send(res, 200, updateResource(resource, id, await readBody(req)));
    if (id && method === 'DELETE') {
      db.prepare(`DELETE FROM ${resource} WHERE id = ?`).run(id);
      return send(res, 200, { ok: true });
    }
  }

  throw httpError(404, 'Not found');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/twilio/incoming' && req.method === 'POST') {
      await handleIncomingText(req, res);
    } else if (url.pathname.startsWith('/api/')) {
      // Basic CSRF guard: state-changing API calls must come from our own page.
      if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'mayo-crm') throw httpError(403, 'Forbidden');
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url.pathname);
    }
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'Something went wrong' : err.message });
  }
});

// Clean up expired sessions once a day.
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 864e5).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log(`Mayo's Construction CRM running at http://localhost:${PORT}`));
}

module.exports = { server, db };
