/* ─────────────────────────────────────────────────
   NEXFLOW FINANCIAL OS — app.js
   Ground-truth config: Annual billing · Telegram infra
   ───────────────────────────────────────────────── */

'use strict';

// ── CONSTANTS ──────────────────────────────────────
const MONTHLY_INFRA = 3000;     // Supabase Pro + Vercel + Claude Code
const EMERGENCY_CAP = 50000;    // Hard cap on emergency fund

const BUCKETS = [
  {
    key:   'tax',
    name:  'Tax Reserve',
    pct:   25,
    color: '#ff4444',
    desc:  'Transfer to separate savings account on day of payment. Advance tax deadlines: Mar · Jun · Sep · Dec.',
    rule:  'Legally not yours. Do not touch.',
  },
  {
    key:   'infra',
    name:  'Infra & Ops',
    pct:   12,
    color: '#f59e0b',
    desc:  'Supabase Pro + Vercel + Claude Code. Set on autopay. Zero decisions required monthly.',
    rule:  '₹3,000/mo flat. Scales to 50 clients without upgrade.',
  },
  {
    key:   'emergency',
    name:  'Emergency Fund',
    pct:   10,
    color: '#3b82f6',
    desc:  'Business survival buffer. Transfer to savings. Stop once ₹50,000 balance is hit.',
    rule:  'Hard cap: ₹50,000. After cap, redirect 10% to reinvestment.',
    cap:   EMERGENCY_CAP,
  },
  {
    key:   'reinvestment',
    name:  'Reinvestment',
    pct:   28,
    color: '#c8f135',
    desc:  'Pre-5 clients: CA referral fee (10–15% per close), printed one-pager (₹500–1K), demo video. Nothing else.',
    rule:  'Spend only on a pre-decided milestone. Setup fee also goes here.',
  },
  {
    key:   'service',
    name:  'Client Service Reserve',
    pct:   10,
    color: '#ec4899',
    desc:  'Buffer for surprise client requests, onboarding time, bug fixes, custom work.',
    rule:  'Log client service costs against this bucket each month.',
  },
  {
    key:   'personal',
    name:  'Personal / Director Salary',
    pct:   15,
    color: '#a855f7',
    desc:  'Extract as director remuneration — reduces taxable corporate income. Spend guilt-free.',
    rule:  'Ceiling: 15% (1–4 clients) → 18% (5–9) → 20% (10+).',
  },
];

const STORAGE_KEY = 'nexflow_payments_v1';

// ── STATE ──────────────────────────────────────────
let payments = [];

// ── INIT ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initNav();
  initMobile();
  setTodayDate();
  renderAll();
});

// ── STORAGE ────────────────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    payments = raw ? JSON.parse(raw) : [];
  } catch {
    payments = [];
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
  } catch {
    showToast('Storage error — check browser permissions.');
  }
}

// ── NAVIGATION ─────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function switchView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + id);
  if (target) target.classList.add('active');
  renderView(id);
}

function renderView(id) {
  switch (id) {
    case 'dashboard': renderDashboard(); break;
    case 'buckets':   renderBuckets();   break;
    case 'history':   renderHistory();   break;
    default: break;
  }
}

// ── MOBILE ─────────────────────────────────────────
function initMobile() {
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

// ── DATE ───────────────────────────────────────────
function setTodayDate() {
  const d = document.getElementById('log-date');
  if (d) d.value = new Date().toISOString().split('T')[0];
  const ds = document.getElementById('dash-date');
  if (ds) {
    ds.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    }).toUpperCase();
  }
}

// ── COMPUTED ────────────────────────────────────────
function getARR() {
  return payments.reduce((sum, p) => sum + (p.acv || 0), 0);
}

function getClientCount() {
  return payments.length;
}

function getTotalSetupFees() {
  return payments.reduce((sum, p) => sum + (p.setup || 0), 0);
}

function getMargin() {
  const arr = getARR();
  if (!arr) return null;
  return Math.round(((arr - MONTHLY_INFRA * 12) / arr) * 100);
}

function allocate(acv, setup) {
  const result = {};
  BUCKETS.forEach(b => {
    result[b.key] = Math.round(acv * b.pct / 100);
  });
  // Setup fee entirely to reinvestment
  result.reinvestment += (setup || 0);
  return result;
}

function getCumulativeBuckets() {
  const totals = {};
  BUCKETS.forEach(b => { totals[b.key] = 0; });
  payments.forEach(p => {
    const alloc = allocate(p.acv || 0, p.setup || 0);
    BUCKETS.forEach(b => {
      totals[b.key] += alloc[b.key];
    });
  });
  return totals;
}

function getVerdict(clients, arr) {
  if (!clients) return {
    text: 'Log your first payment to get a financial verdict.',
    stage: '',
    color: 'var(--text3)',
  };
  const infraAnnual = MONTHLY_INFRA * 12;
  if (arr < infraAnnual) return {
    text: 'ARR doesn\'t cover 12 months of infra. You\'re burning money. Do not proceed until client 2 is confirmed paying.',
    stage: 'STAGE: LOSS',
    color: 'var(--red)',
  };
  if (clients === 1) return {
    text: 'One paying client is a proof of concept, not a business yet. Every rupee of reinvestment goes toward client 2 and 3. Nothing else.',
    stage: 'STAGE: PROOF OF CONCEPT',
    color: 'var(--amber)',
  };
  if (clients < 5) return {
    text: `${clients} clients — real traction forming. Personal ceiling stays at 15%. Push reinvestment hard into CA referrals and outreach. Don't touch the product — it works.`,
    stage: 'STAGE: EARLY TRACTION',
    color: 'var(--amber)',
  };
  if (clients < 15) return {
    text: `${clients} clients. Emergency fund likely capped — redirect that 10% to reinvestment now. Consider raising ACV. You're undercharging at this proven scale.`,
    stage: 'STAGE: GROWING',
    color: 'var(--accent)',
  };
  return {
    text: `${clients} clients. Infra is a rounding error. Raise ACV to ₹48K+ minimum, launch Shift Tracker bundle, hire first part-time sales person from reinvestment bucket.`,
    stage: 'STAGE: SCALING',
    color: 'var(--green)',
  };
}

// ── FORMAT ─────────────────────────────────────────
function fmt(n) {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + 'L';
  if (n >= 1000)     return '₹' + Math.round(n / 1000) + 'K';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function fmtFull(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

// ── RENDER: DASHBOARD ──────────────────────────────
function renderDashboard() {
  const arr     = getARR();
  const clients = getClientCount();
  const monthly = Math.round(arr / 12);
  const margin  = getMargin();

  document.getElementById('dash-arr').textContent     = fmt(arr);
  document.getElementById('dash-monthly').textContent = fmt(monthly);
  document.getElementById('dash-clients').textContent = clients;
  document.getElementById('dash-margin').textContent  = margin !== null ? margin + '%' : '—';
  document.getElementById('sidebar-clients').textContent = clients;
  document.getElementById('sidebar-arr').textContent  = fmt(arr);

  // Bucket bars (latest payment)
  const barsEl   = document.getElementById('bucket-bars');
  const emptyEl  = document.getElementById('bucket-bars-empty');
  if (!payments.length) {
    barsEl.style.display   = 'none';
    emptyEl.style.display  = 'block';
  } else {
    barsEl.style.display   = 'block';
    emptyEl.style.display  = 'none';
    const latest = payments[payments.length - 1];
    const alloc  = allocate(latest.acv || 0, latest.setup || 0);
    const total  = (latest.acv || 0) + (latest.setup || 0);
    barsEl.innerHTML = BUCKETS.map(b => {
      const amt = alloc[b.key];
      const pct = total ? Math.round((amt / total) * 100) : 0;
      return `
        <div class="bucket-bar-row">
          <div class="bbar-label">${b.name}</div>
          <div class="bbar-track">
            <div class="bbar-fill" style="width:${pct}%;background:${b.color}"></div>
          </div>
          <div class="bbar-amt">${fmtFull(amt)}</div>
        </div>`;
    }).join('');
  }

  // Verdict
  const v = getVerdict(clients, arr);
  document.getElementById('verdict-text').textContent  = v.text;
  document.getElementById('verdict-stage').textContent = v.stage;
  document.getElementById('verdict-panel').style.borderLeftColor = v.color;

  // Update phase active state
  const phase = clients === 0 ? 0 : clients < 5 ? 0 : clients < 50 ? 1 : clients < 200 ? 2 : 3;
  document.querySelectorAll('.phase-item').forEach((el, i) => {
    const dot = el.querySelector('.phase-dot');
    if (i === phase) {
      dot.style.background   = 'var(--accent)';
      dot.style.borderColor  = 'var(--accent)';
      dot.style.boxShadow    = '0 0 0 4px rgba(200,241,53,0.15)';
    } else if (i < phase) {
      dot.style.background  = 'var(--text3)';
      dot.style.borderColor = 'var(--text3)';
      dot.style.boxShadow   = 'none';
    } else {
      dot.style.background  = 'var(--bg)';
      dot.style.borderColor = 'var(--border2)';
      dot.style.boxShadow   = 'none';
    }
  });
}

// ── RENDER: BUCKETS ────────────────────────────────
function renderBuckets() {
  const cumulative = getCumulativeBuckets();
  const arr        = getARR();

  const el = document.getElementById('buckets-detail');
  el.innerHTML = BUCKETS.map(b => {
    const amt    = cumulative[b.key] || 0;
    const capHit = b.cap && amt >= b.cap;
    return `
      <div class="bucket-detail-card" style="border-top-color:${b.color}">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${b.color};border-radius:${getComputedStyle(document.documentElement).getPropertyValue('--radius-lg')} ${getComputedStyle(document.documentElement).getPropertyValue('--radius-lg')} 0 0"></div>
        <div class="bd-label" style="color:${b.color}">${b.name}</div>
        <div class="bd-amount">${fmtFull(amt)}</div>
        <div class="bd-pct">${b.pct}% of each annual payment${b.key === 'reinvestment' ? ' + 100% of setup fees' : ''}</div>
        ${capHit ? `<div class="bd-cap" style="background:rgba(200,241,53,.1);color:var(--accent)">✓ Cap hit — redirect to reinvestment</div>` : ''}
        ${b.cap && !capHit ? `<div class="bd-cap" style="background:var(--bg2);color:var(--text3)">${fmtFull(b.cap - amt)} to cap</div>` : ''}
        <div class="bd-desc">${b.desc}<br/><br/><em style="color:var(--text3)">${b.rule}</em></div>
      </div>`;
  }).join('');
}

// ── RENDER: HISTORY ────────────────────────────────
function renderHistory() {
  const list  = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const sub   = document.getElementById('history-sub');

  if (!payments.length) {
    list.innerHTML  = '';
    empty.style.display = 'block';
    sub.textContent = 'No payments logged yet.';
    return;
  }

  empty.style.display = 'none';
  sub.textContent = `${payments.length} payment${payments.length !== 1 ? 's' : ''} · Total ARR ${fmt(getARR())}`;

  list.innerHTML = [...payments].reverse().map((p, revIdx) => {
    const idx   = payments.length - 1 - revIdx;
    const total = (p.acv || 0) + (p.setup || 0);
    const date  = p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    return `
      <div class="history-item">
        <span class="hi-type ${p.type || 'new'}">${p.type || 'new'}</span>
        <div style="flex:1">
          <div class="hi-client">${p.client || 'Unknown'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">ACV ${fmtFull(p.acv)} · Setup ${fmtFull(p.setup || 0)} · ${p.notes || 'No notes'}</div>
        </div>
        <div style="text-align:right">
          <div class="hi-acv">${fmtFull(total)}</div>
          <div class="hi-date">${date}</div>
        </div>
        <button class="hi-delete" onclick="deletePayment(${idx})">delete</button>
      </div>`;
  }).join('');
}

// ── RENDER: ALL ────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderBuckets();
  renderHistory();
}

// ── LOG PAYMENT ────────────────────────────────────
window.logPayment = function () {
  const client = document.getElementById('log-client').value.trim();
  const acv    = parseFloat(document.getElementById('log-acv').value)   || 0;
  const setup  = parseFloat(document.getElementById('log-setup').value) || 0;
  const date   = document.getElementById('log-date').value;
  const type   = document.getElementById('log-type').value;
  const notes  = document.getElementById('log-notes').value.trim();

  if (!client) { showToast('Enter a client name.'); return; }
  if (!acv)    { showToast('Enter the annual contract value.'); return; }

  const payment = { client, acv, setup, date, type, notes, ts: Date.now() };
  payments.push(payment);
  saveData();
  renderAll();

  // Clear form
  document.getElementById('log-client').value = '';
  document.getElementById('log-acv').value    = '';
  document.getElementById('log-setup').value  = '';
  document.getElementById('log-notes').value  = '';
  setTodayDate();
  document.getElementById('preview-content').style.display = 'none';
  document.getElementById('preview-empty').style.display   = 'block';

  showToast(`${client} logged — ${fmtFull(acv + setup)} allocated.`);
};

// ── DELETE PAYMENT ─────────────────────────────────
window.deletePayment = function (idx) {
  if (!confirm(`Delete payment from "${payments[idx].client}"? This cannot be undone.`)) return;
  payments.splice(idx, 1);
  saveData();
  renderAll();
  showToast('Payment deleted.');
};

// ── PREVIEW ALLOCATION ─────────────────────────────
window.previewAllocation = function () {
  const acv   = parseFloat(document.getElementById('log-acv').value)   || 0;
  const setup = parseFloat(document.getElementById('log-setup').value) || 0;

  const previewContent = document.getElementById('preview-content');
  const previewEmpty   = document.getElementById('preview-empty');

  if (!acv) {
    previewContent.style.display = 'none';
    previewEmpty.style.display   = 'block';
    return;
  }

  previewContent.style.display = 'block';
  previewEmpty.style.display   = 'none';

  document.getElementById('preview-total').textContent = `Total: ${fmtFull(acv + setup)}`;

  const alloc = allocate(acv, setup);
  const total = acv + setup;

  document.getElementById('preview-rows').innerHTML = BUCKETS.map(b => {
    const amt = alloc[b.key];
    return `
      <div class="preview-row">
        <div class="pr-left">
          <div class="pr-dot" style="background:${b.color}"></div>
          <div>
            <div class="pr-name">${b.name}</div>
            <div class="pr-pct">${b.pct}%${b.key === 'reinvestment' && setup ? ' + setup fee' : ''}</div>
          </div>
        </div>
        <div class="pr-amt" style="color:${b.color}">${fmtFull(amt)}</div>
      </div>`;
  }).join('');
};

// ── TOAST ──────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
