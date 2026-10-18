// Mayo Construction CRM — a small, zero-dependency server.
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
if (!db.prepare('SELECT 1 FROM templates LIMIT 1').get()) {
  const body = fs.readFileSync(path.join(__dirname, 'templates', 'construction-agreement.txt'), 'utf8');
  db.prepare('INSERT INTO templates (name, body) VALUES (?, ?)').run('Construction Agreement (starter)', body);
}

// ---------------------------------------------------------------------------
// Generic CRUD resources (column whitelist per table)
// ---------------------------------------------------------------------------
const RESOURCES = {
  customers: { cols: ['name', 'phone', 'email', 'address', 'notes'], required: ['name'], order: 'name COLLATE NOCASE' },
  todos: { cols: ['title', 'notes', 'due_date', 'assigned_to', 'customer_id', 'done'], required: ['title'], order: 'done, due_date IS NULL, due_date, id DESC' },
  events: { cols: ['title', 'date', 'start_time', 'end_time', 'location', 'notes', 'assigned_to', 'customer_id'], required: ['title', 'date'], order: 'date, start_time IS NULL, start_time' },
  estimates: { cols: ['number', 'customer_id', 'title', 'date', 'status', 'items', 'tax_rate', 'notes'], required: [], order: 'id DESC' },
  transactions: { cols: ['type', 'date', 'amount', 'category', 'description', 'paid_by', 'customer_id'], required: ['type', 'date', 'amount'], order: 'date DESC, id DESC' },
  templates: { cols: ['name', 'body'], required: ['name', 'body'], order: 'name COLLATE NOCASE' },
};

function cleanValue(col, v) {
  if (v === undefined) return undefined;
  if (v === '' || v === null) return null;
  if (col === 'items') return typeof v === 'string' ? v : JSON.stringify(v);
  if (col === 'done') return v ? 1 : 0;
  if (col === 'amount' || col === 'tax_rate') return Number(v) || 0;
  if (col === 'customer_id') return Number(v) || null;
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
  return out;
}

function listResource(resource, query) {
  const def = RESOURCES[resource];
  const where = [];
  const params = [];
  if (query.customer_id && def.cols.includes('customer_id')) {
    where.push('customer_id = ?');
    params.push(Number(query.customer_id));
  }
  if (resource === 'transactions') {
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
    if (!fields.number) fields.number = nextEstimateNumber();
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

function nextEstimateNumber() {
  const row = db.prepare("SELECT MAX(CAST(SUBSTR(number, 3) AS INTEGER)) AS n FROM estimates WHERE number LIKE 'E-%'").get();
  return 'E-' + ((row && row.n) ? row.n + 1 : 1001);
}

function today() {
  // Local date (server's timezone; set TZ=America/Chicago for Hot Springs)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------------
function moneyBetween(from, to) {
  const r = db
    .prepare(`SELECT
      COALESCE(SUM(CASE WHEN type='in' THEN amount END), 0) AS money_in,
      COALESCE(SUM(CASE WHEN type='out' THEN amount END), 0) AS money_out
      FROM transactions WHERE date >= ? AND date <= ?`)
    .get(from, to);
  return { in: r.money_in, out: r.money_out, net: r.money_in - r.money_out };
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
    todos: db.prepare('SELECT * FROM todos WHERE done = 0 ORDER BY due_date IS NULL, due_date, id DESC LIMIT 10').all(),
    overdue: db.prepare('SELECT COUNT(*) AS n FROM todos WHERE done = 0 AND due_date < ?').get(t).n,
    events: db.prepare('SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date, start_time IS NULL, start_time').all(t, weekAheadStr),
    openEstimates: db.prepare("SELECT * FROM estimates WHERE status IN ('Draft','Sent') ORDER BY id DESC").all(),
    customerCount: db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,
  };
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
  let rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(PUBLIC_DIR, '.' + decodeURIComponent(rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'Not found');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
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

  const user = currentUser(req);
  if (!user) throw httpError(401, 'Please log in');

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
    if (url.pathname.startsWith('/api/')) {
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
  server.listen(PORT, () => console.log(`Mayo Construction CRM running at http://localhost:${PORT}`));
}

module.exports = { server, db };
