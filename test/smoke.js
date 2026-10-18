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
  assert.strictEqual(s.month.costs, 250.5);
  assert.strictEqual(s.month.profit, 749.5);

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

  // Jobs, partner pay vs. subs, "due at finish", and import
  const job = await call('POST', '/jobs', { address: '1 Test St', customer_id: c.id, price: 1000, labor_cost: 600, scope: [{ text: 'Do work', done: false }] }, 201);
  await call('POST', '/transactions', { type: 'in', date: `${y}-${m}-07`, amount: 400, job_id: job.id }, 201);
  await call('POST', '/transactions', { type: 'out', date: `${y}-${m}-07`, amount: 200, category: 'Labor / Sub', paid_to: 'Dad', job_id: job.id }, 201);
  const owed = await call('POST', '/transactions', { type: 'out', date: `${y}-${m}-08`, amount: 100, category: 'Subcontractor', paid_to: 'Julio', status: 'owed', job_id: job.id }, 201);
  await call('POST', '/import', {}); // runs the wording clean-up: Dad -> Moss, Labor / Sub -> Partner pay
  const jm = (await call('GET', '/job-money'))[job.id];
  assert.strictEqual(jm.collected, 400);
  assert.deepStrictEqual(jm.partners.Moss, { paid: 200, due: 0 });
  assert.deepStrictEqual(jm.subs.Julio, { paid: 0, due: 100 });
  const s2 = await call('GET', '/summary');
  assert.strictEqual(s2.month.costs, 250.5, 'partner pay and due-at-finish are not costs');
  assert.strictEqual(s2.month.paid.Moss, 200);
  assert.strictEqual(s2.month.profit, 1400 - 250.5);
  assert.strictEqual((await call('GET', '/transactions?status=owed')).length, 1);
  await call('PUT', `/transactions/${owed.id}`, { status: 'paid' });
  assert.strictEqual((await call('GET', '/summary')).month.costs, 350.5);
  const imp = await call('POST', '/import', {
    customers: [{ id: 50, name: 'Imported Person' }],
    jobs: [{ id: 9, address: '9 Import Rd', customer_id: 50, status: 'Estimate Pending' }],
    transactions: [{ type: 'in', date: `${y}-${m}-09`, amount: 10, job_id: 9, customer_id: 50 }],
  });
  assert.deepStrictEqual([imp.counts.customers, imp.counts.jobs, imp.counts.transactions], [1, 1, 1]);
  const impJob = (await call('GET', '/jobs')).find((j) => j.address === '9 Import Rd');
  const impTx = (await call('GET', `/transactions?job_id=${impJob.id}`))[0];
  assert.strictEqual(impTx.customer_id, impJob.customer_id, 'ids are remapped');

  // Re-importing the same file adds nothing new, but fills in a missing phone number
  const again = await call('POST', '/import', {
    customers: [{ id: 50, name: 'imported person', phone: '501-555-0199' }],
    jobs: [{ id: 9, address: '9 Import Rd', customer_id: 50 }],
    transactions: [{ type: 'in', date: `${y}-${m}-09`, amount: 10, job_id: 9, customer_id: 50 }],
  });
  assert.deepStrictEqual([again.counts.customers, again.counts.jobs, again.counts.transactions], [0, 0, 0]);
  assert.strictEqual((await call('GET', '/customers')).find((x) => x.name === 'Imported Person').phone, '501-555-0199');

  // Send an estimate to sign, and sign it without logging in
  const sent = await call('POST', `/estimates/${e1.id}/send`, { contract_text: 'Agreement for {{customer_name}}' });
  assert.ok(/^[a-f0-9]{48}$/.test(sent.sign_token));
  const pub = `/public/sign/${sent.sign_token}`;
  const savedCookie = cookie;
  cookie = '';
  const view = await call('GET', pub);
  assert.strictEqual(view.total, 1000);
  assert.strictEqual(view.signed, false);
  await call('GET', '/public/sign/deadbeef', undefined, 404);
  await call('POST', pub, { name: 'Jane Smith', agree: true, signature: 'not-an-image' }, 400);
  const png = 'data:image/png;base64,' + Buffer.from('fakepng').toString('base64');
  await call('POST', pub, { name: 'Jane Smith', agree: true, signature: png });
  await call('POST', pub, { name: 'Jane Smith', agree: true, signature: png }, 400); // only once
  const signedDoc = await call('GET', pub + '/document');
  assert.ok(signedDoc.includes('Signed electronically by:') && signedDoc.includes('Jane Smith'));
  cookie = savedCookie;
  const est = await call('GET', `/estimates/${e1.id}`);
  assert.strictEqual(est.status, 'Accepted');
  assert.ok(est.signed_document_id);
  assert.ok((await call('GET', '/todos')).some((t) => t.title.includes('signed E-1001')));
  await call('POST', '/messages', { job_id: job.id, customer_id: c.id, kind: 'On our way', channel: 'text', body: 'On the way' }, 201);
  assert.strictEqual((await call('GET', `/messages?job_id=${job.id}`)).length, 1);

  // Business settings
  assert.strictEqual((await call('GET', '/settings')).deposit_percent, '50');
  const st = await call('PUT', '/settings', { license_number: '0123456', bogus: 'x' });
  assert.strictEqual(st.license_number, '0123456');
  assert.strictEqual(st.bogus, undefined);
  assert.ok((await call('GET', '/version')).version);
  const tplNames = (await call('GET', '/templates')).map((t) => t.name);
  assert.ok(tplNames.includes('Residential Construction Agreement') && tplNames.includes('Change Order'));

  // Change order: priced by hand; once signed, its amount is added to the job and days to the finish date
  await call('PUT', `/jobs/${job.id}`, { finish_date: '2026-11-03' });
  const co = await call('POST', '/estimates', { kind: 'change_order', job_id: job.id, customer_id: c.id, items: [{ desc: 'Extra outlet', qty: 2, price: 125 }], days_added: 2 }, 201);
  assert.strictEqual(co.number, 'CO-1001');
  const coSent = await call('POST', `/estimates/${co.id}/send`, { contract_text: 'CO' });
  const keep = cookie;
  cookie = '';
  assert.strictEqual((await call('GET', `/public/sign/${coSent.sign_token}`)).kind, 'change_order');
  await call('POST', `/public/sign/${coSent.sign_token}`, { name: 'Jane Smith', agree: true, signature: png });
  cookie = keep;
  const jobAfter = await call('GET', `/jobs/${job.id}`);
  assert.strictEqual(jobAfter.price, 1250);
  assert.strictEqual(jobAfter.finish_date, '2026-11-05');
  assert.ok((await call('GET', '/todos')).some((t) => t.title.includes('approved change order CO-1001')));

  // Business texting through Twilio (a fake Twilio stands in here)
  assert.strictEqual((await call('GET', '/settings')).texting_enabled, false);
  await call('POST', '/send-text', { to: '501-555-0100', body: 'Hi' }, 400);
  const http = require('node:http');
  const sentToTwilio = [];
  const fakeTwilio = http.createServer((req, res) => {
    let b = '';
    req.on('data', (d) => (b += d));
    req.on('end', () => { sentToTwilio.push({ url: req.url, auth: req.headers.authorization, body: new URLSearchParams(b) }); res.end('{"sid":"SM1"}'); });
  });
  await new Promise((r) => fakeTwilio.listen(0, r));
  Object.assign(process.env, {
    TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'secret', TWILIO_FROM_NUMBER: '501-555-0000',
    TWILIO_API_BASE: `http://localhost:${fakeTwilio.address().port}`, TEXT_FORWARD_TO: '501-555-0001',
  });
  assert.strictEqual((await call('GET', '/settings')).texting_number, '(501) 555-0000');
  const sentOk = await call('POST', '/send-text', { to: '(501) 555-0100', body: 'On our way', job_id: job.id, customer_id: c.id, kind: 'On our way' });
  assert.strictEqual(sentOk.from, '(501) 555-0000');
  assert.strictEqual(sentToTwilio[0].url, '/2010-04-01/Accounts/AC123/Messages.json');
  assert.strictEqual(sentToTwilio[0].body.get('To'), '+15015550100');
  assert.strictEqual(sentToTwilio[0].body.get('From'), '+15015550000');
  assert.ok(sentToTwilio[0].body.get('Body').includes('Reply STOP to opt out'), 'first text includes opt-out');
  await call('POST', '/send-text', { to: '5015550100', body: 'Second' });
  assert.strictEqual(sentToTwilio[1].body.get('Body'), 'Second', 'opt-out line only on the first text');
  // Customer texts back: Twilio signs the request; unsigned requests are refused
  const inUrl = `http://localhost:${server.address().port}/twilio/incoming`;
  const params = { Body: 'See you then!', From: '+15015550100' };
  const sig = require('node:crypto').createHmac('sha1', 'secret')
    .update(inUrl + Object.keys(params).sort().map((k) => k + params[k]).join('')).digest('base64');
  const bad = await fetch(inUrl, { method: 'POST', body: new URLSearchParams(params) });
  assert.strictEqual(bad.status, 403);
  const good = await fetch(inUrl, { method: 'POST', headers: { 'X-Twilio-Signature': sig }, body: new URLSearchParams(params) });
  const twiml = await good.text();
  assert.ok(twiml.includes('<Message to="+15015550001">Reply from Jane Smith: See you then!</Message>'), twiml);
  assert.ok((await call('GET', `/messages?job_id=${job.id}`)).some((mm) => mm.channel === 'sms-in' && mm.body === 'See you then!'));
  // With an RCS-enabled Messaging Service, texts go out under the business name
  process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG123';
  const rcs = await call('POST', '/send-text', { to: '5015550100', body: 'Branded' });
  assert.strictEqual(rcs.from, "Mayo's Construction / (501) 555-0000");
  assert.strictEqual(sentToTwilio[2].body.get('MessagingServiceSid'), 'MG123');
  assert.strictEqual(sentToTwilio[2].body.get('From'), null);
  delete process.env.TWILIO_MESSAGING_SERVICE_SID;
  fakeTwilio.close();

  const backup = await call('GET', '/backup');
  assert.ok(backup.customers.length === 2 && backup.jobs.length === 2);

  console.log('All smoke tests passed');
  server.close();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
