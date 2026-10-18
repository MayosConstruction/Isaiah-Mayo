// Customer-facing page: review an estimate + contract and sign it on the phone.
'use strict';

const view = document.getElementById('view');
const token = location.pathname.split('/').pop();
const api = `/api/public/sign/${token}`;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function header(b) {
  return `<div class="paper" style="margin-top:1rem">
    <div class="letterhead"><div class="who"><img src="/logo.png" alt="">
      <div><div class="biz">${esc(b.name)}</div><div class="muted">${esc(b.lines)}<br>${esc(b.city)} · <a href="tel:${esc(b.phone.replace(/\D/g, ''))}">${esc(b.phone)}</a></div></div></div></div>`;
}

function thanks(d) {
  view.innerHTML = header(d.business) + `
    <h2 class="green">✓ Signed — thank you${d.signed_name ? ', ' + esc(d.signed_name.split(' ')[0]) : ''}!</h2>
    <p>We got your signed agreement for <strong>${esc(d.title || 'Estimate ' + d.number)}</strong>. Moss or Isaiah will reach out about scheduling.</p>
    <p><a class="btn primary" href="${api}/document" target="_blank" rel="noopener">View / save your signed copy</a></p>
    <p class="muted">Questions? Call or text ${esc(d.business.phone)}.</p></div>`;
}

async function load() {
  const res = await fetch(api);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { view.innerHTML = `<div class="card" style="margin-top:2rem"><p class="error">${esc(d.error || 'Something went wrong')}</p></div>`; return; }
  if (d.signed) return thanks(d);

  view.innerHTML = header(d.business) + `
      <p class="eyebrow">Please review and sign</p>
      <h2>${esc(d.title || 'Estimate')} <span class="muted" style="font-size:1rem">${esc(d.number)}</span></h2>
      ${d.customer ? `<p>Prepared for <strong>${esc(d.customer.name)}</strong>${d.customer.address ? '<br>' + esc(d.customer.address) : ''}</p>` : ''}
      <table>
        <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
        <tbody>${d.items.map((i) => `<tr><td>${esc(i.desc)}</td><td class="num">${esc(i.qty)}</td><td class="num">${money((Number(i.qty) || 0) * (Number(i.price) || 0))}</td></tr>`).join('')}</tbody>
      </table>
      <table class="totals" style="max-width:280px;margin:1rem 0 0 auto">
        ${d.tax ? `<tr><td>Subtotal</td><td class="num">${money(d.subtotal)}</td></tr><tr><td>Tax</td><td class="num">${money(d.tax)}</td></tr>` : ''}
        <tr><td><strong>Total</strong></td><td class="num"><strong>${money(d.total)}</strong></td></tr>
      </table>
      ${d.notes ? `<p style="white-space:pre-wrap">${esc(d.notes)}</p>` : ''}
      ${d.contract_text ? `<h3 style="margin-top:1.5rem">Agreement</h3><div class="contract-text" style="max-height:55vh;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:.8rem">${esc(d.contract_text)}</div>` : ''}
    </div>
    <form class="card" id="sign-form" style="max-width:800px;margin:0 auto 2rem">
      <h3>Sign here</h3>
      <label>Your full name <input name="name" required autocomplete="name" value="${esc(d.customer ? d.customer.name : '')}"></label>
      <div class="muted" style="font-size:.88rem">Draw your signature with your finger:</div>
      <canvas id="pad" style="width:100%;height:170px;border:2px dashed var(--border);border-radius:8px;background:#fff;touch-action:none;margin:.3rem 0"></canvas>
      <button type="button" class="btn small" id="clear">Clear</button>
      <label class="row" style="margin-top:1rem;color:var(--text);flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" name="agree" required>
        <span>I agree to the estimate and agreement above and to sign electronically.</span></label>
      <p class="error" id="err"></p>
      <button class="btn primary" style="width:100%;font-size:1.25rem">Sign &amp; send</button>
    </form>`;

  // Signature pad
  const pad = document.getElementById('pad');
  const ctx = pad.getContext('2d');
  let drawing = false;
  let hasInk = false;
  const size = () => {
    const r = pad.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    pad.width = r.width * ratio;
    pad.height = r.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#151515';
    hasInk = false;
  };
  size();
  const pos = (e) => { const r = pad.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  pad.addEventListener('pointerdown', (e) => { drawing = true; pad.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
  pad.addEventListener('pointermove', (e) => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); hasInk = true; });
  pad.addEventListener('pointerup', () => (drawing = false));
  document.getElementById('clear').onclick = () => { ctx.clearRect(0, 0, pad.width, pad.height); hasInk = false; };

  document.getElementById('sign-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById('err');
    err.textContent = '';
    if (!hasInk) { err.textContent = 'Please draw your signature in the box.'; return; }
    const btn = e.target.querySelector('button.primary');
    btn.disabled = true;
    const r = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mayo-crm' },
      body: JSON.stringify({ name: e.target.elements.name.value, agree: e.target.elements.agree.checked, signature: pad.toDataURL('image/png') }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) { err.textContent = out.error || 'Something went wrong'; btn.disabled = false; return; }
    load();
  };
}

load();
