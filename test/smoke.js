// Quick end-to-end check of the API. Run with: npm test
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mayo-crm-test-'));
const { server } = require('../server');

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/api`;
  let cookie = '';
  const call = async (method, url, body, expect = 200) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mayo-crm', Cookie: cookie },
      body: body && JSON.stringify(body),
    });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    assert.strictEqual(res.status, expect, `${method} ${url} -> ${res.status}`);
    return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
  };

  await call('GET', '/me', undefined, 401);
  await call('POST', '/login', { username: 'isaiah', password: 'wrong' }, 401);
  const me = await call('POST', '/login', { username: 'isaiah', password: 'mayo2026' });
  assert.strictEqual(me.name, 'Isaiah');

  const c = await call('POST', '/customers', { name: 'Jane Smith', phone: '501-555-0100', address: '123 Central Ave, Hot Springs, AR' }, 201);
  await call('POST', '/customers', { phone: 'no name' }, 400);

  const t = await call('POST', '/todos', { title: 'Buy lumber', due_date: '2026-10-20', customer_id: c.id }, 201);
  await call('PUT', `/todos/${t.id}`, { done: true });
  assert.strictEqual((await call('GET', `/todos/${t.id}`)).done, 1);

  await call('POST', '/events', { title: 'Measure deck', date: '2026-10-21', start_time: '09:00', customer_id: c.id }, 201);

  const e1 = await call('POST', '/estimates', { customer_id: c.id, title: 'Deck', items: [{ desc: 'Labor', qty: 2, price: 500 }] }, 201);
  const e2 = await call('POST', '/estimates', { customer_id: c.id, title: 'Rails' }, 201);
  assert.strictEqual(e1.number, 'E-1001');
  assert.strictEqual(e2.number, 'E-1002');

  const y = new Date().getFullYear();
  const m = String(new Date().getMonth() + 1).padStart(2, '0');
  await call('POST', '/transactions', { type: 'in', date: `${y}-${m}-05`, amount: 1000, customer_id: c.id }, 201);
  await call('POST', '/transactions', { type: 'out', date: `${y}-${m}-06`, amount: 250.5, category: 'Materials', paid_by: 'Moss' }, 201);
  await call('POST', '/transactions', { type: 'bogus', date: `${y}-${m}-06`, amount: 1 }, 400);
  const s = await call('GET', '/summary');
  assert.strictEqual(s.month.in, 1000);
  assert.strictEqual(s.month.out, 250.5);
  assert.strictEqual(s.month.net, 749.5);

  const tpls = await call('GET', '/templates');
  assert.ok(tpls.length >= 1 && tpls[0].body.includes('{{customer_name}}'));

  const doc = await call('POST', '/documents', { name: 'Signed', customer_id: c.id, original_name: 'x.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-1.4 test').toString('base64') }, 201);
  const file = await call('GET', `/documents/${doc.id}/file`);
  assert.ok(file.includes('%PDF'));
  await call('DELETE', `/documents/${doc.id}`);

  // CSRF guard
  const res = await fetch(base + '/customers', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{"name":"x"}' });
  assert.strictEqual(res.status, 403);

  await call('POST', '/password', { current: 'mayo2026', next: 'newpass123' });
  await call('POST', '/logout');
  await call('GET', '/me', undefined, 401);
  await call('POST', '/login', { username: 'isaiah', password: 'newpass123' });

  // Jobs, owed payouts and import
  const job = await call('POST', '/jobs', { address: '1 Test St', customer_id: c.id, price: 1000, labor_cost: 600, scope: [{ text: 'Do work', done: false }] }, 201);
  await call('POST', '/transactions', { type: 'in', date: `${y}-${m}-07`, amount: 400, job_id: job.id }, 201);
  await call('POST', '/transactions', { type: 'out', date: `${y}-${m}-07`, amount: 200, category: 'Labor / Sub', paid_to: 'Dad', job_id: job.id }, 201);
  const owed = await call('POST', '/transactions', { type: 'out', date: `${y}-${m}-08`, amount: 300, category: 'Labor / Sub', paid_to: 'Dad', status: 'owed', job_id: job.id }, 201);
  const jm = await call('GET', '/job-money');
  assert.deepStrictEqual(jm[job.id], { collected: 400, labor_paid: 200, owed_out: 300, spent: 200 });
  const s2 = await call('GET', '/summary');
  assert.strictEqual(s2.month.out, 250.5 + 200, 'owed payouts are not money out yet');
  assert.strictEqual(s2.owedOut[0].total, 300);
  assert.strictEqual((await call('GET', '/transactions?status=owed')).length, 1);
  await call('PUT', `/transactions/${owed.id}`, { status: 'paid' });
  assert.strictEqual((await call('GET', '/summary')).month.out, 250.5 + 500);
  const imp = await call('POST', '/import', {
    customers: [{ id: 50, name: 'Imported Person' }],
    jobs: [{ id: 9, address: '9 Import Rd', customer_id: 50, status: 'Estimate Pending' }],
    transactions: [{ type: 'in', date: `${y}-${m}-09`, amount: 10, job_id: 9, customer_id: 50 }],
  });
  assert.deepStrictEqual([imp.counts.customers, imp.counts.jobs, imp.counts.transactions], [1, 1, 1]);
  const impJob = (await call('GET', '/jobs')).find((j) => j.address === '9 Import Rd');
  const impTx = (await call('GET', `/transactions?job_id=${impJob.id}`))[0];
  assert.strictEqual(impTx.customer_id, impJob.customer_id, 'ids are remapped');

  const backup = await call('GET', '/backup');
  assert.ok(backup.customers.length === 2 && backup.jobs.length === 2);

  console.log('All smoke tests passed');
  server.close();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
