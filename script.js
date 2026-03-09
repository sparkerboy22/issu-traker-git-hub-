/* =============================================
   GitHub Issues Tracker — script.js
============================================= */

// ── Image paths for status icons ────────────────────────────────────────────
const IMG_OPEN   = './assets/Open-Status.png';
const IMG_CLOSED = './assets/Closed-Status.png';

// ── State ────────────────────────────────────────────────────────────────────
let allIssues = [];
let activeTab = 'all';
let searchQ   = '';

// ── Utility Helpers ──────────────────────────────────────────────────────────

/** Escape HTML to prevent XSS */
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format ISO date → "Jan 1, 2024" */
function fmtDate(s) {
  if (!s) return 'N/A';
  const d = new Date(s);
  return isNaN(d)
    ? s
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Normalise status to 'open' or 'closed' */
function getStatus(issue) {
  return (issue.status || issue.state || 'open').toLowerCase();
}

/** Extract first label string */
function getLabel(issue) {
  if (Array.isArray(issue.labels) && issue.labels.length > 0) {
    return typeof issue.labels[0] === 'string'
      ? issue.labels[0]
      : (issue.labels[0].name || '');
  }
  return issue.label || '';
}

/** Normalise priority to lowercase */
function getPriority(issue) {
  return (issue.priority || '').toLowerCase();
}

/** CSS class for priority badge */
function pClass(p) {
  if (p === 'high')   return 'p-high';
  if (p === 'medium') return 'p-medium';
  return 'p-low';
}

/** CSS class for label badge */
function lClass(l) {
  const lc = (l || '').toLowerCase();
  if (lc.includes('bug'))         return 'lbl-bug';
  if (lc.includes('feature'))     return 'lbl-feature';
  if (lc.includes('enhancement')) return 'lbl-enhancement';
  if (lc.includes('doc'))         return 'lbl-documentation';
  return 'lbl-default';
}

/** Returns the correct status image tag for a card */
function statusImg(status) {
  const src = status === 'open' ? IMG_OPEN : IMG_CLOSED;
  const alt = status === 'open' ? 'Open'   : 'Closed';
  return `<img src="${src}" alt="${alt}" class="card-status-img"/>`;
}

// ── Login ────────────────────────────────────────────────────────────────────
function doLogin() {
  const u   = document.getElementById('inp-user').value.trim();
  const p   = document.getElementById('inp-pass').value.trim();
  const err = document.getElementById('err-box');

  if (u === 'admin' && p === 'admin123') {
    err.style.display = 'none';
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('main-page').style.display  = 'block';
    if (!allIssues.length) fetchAll();
    else render();
  } else {
    err.style.display = 'block';
  }
}

// ── Logout ───────────────────────────────────────────────────────────────────
function doLogout() {
  document.getElementById('main-page').style.display  = 'none';
  document.getElementById('login-page').style.display = 'flex';
  // Clear form
  document.getElementById('inp-user').value           = '';
  document.getElementById('inp-pass').value           = '';
  document.getElementById('err-box').style.display    = 'none';
  document.getElementById('search-box').value         = '';
  // Reset state
  searchQ   = '';
  activeTab = 'all';
  // Reset tabs UI
  ['all', 'open', 'closed'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === 'all');
  });
  closeModal();
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-page').style.display !== 'none') {
    doLogin();
  }
  if (e.key === 'Escape') {
    closeModal();
  }
});

// ── Fetch issues from API ────────────────────────────────────────────────────
async function fetchAll() {
  showSpinner();
  try {
    const res  = await fetch('https://phi-lab-server.vercel.app/api/v1/lab/issues');
    const json = await res.json();
    allIssues  = Array.isArray(json) ? json : (json.issues || json.data || []);
    render();
  } catch (e) {
    document.getElementById('grid').innerHTML =
      `<div class="empty-state"><p style="color:#cf222e">Failed to load issues. Check your connection.</p></div>`;
  }
}

/** Show loading spinner */
function showSpinner() {
  document.getElementById('grid').innerHTML =
    `<div class="spinner-wrap"><div class="spinner"></div></div>`;
}

// ── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  ['all', 'open', 'closed'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  render();
}

// ── Search ───────────────────────────────────────────────────────────────────
function onSearch(value) {
  searchQ = value.toLowerCase();
  render();
}

// ── Render grid ──────────────────────────────────────────────────────────────
function render() {
  let list = [...allIssues];

  // Filter by tab
  if (activeTab === 'open')   list = list.filter(i => getStatus(i) === 'open');
  if (activeTab === 'closed') list = list.filter(i => getStatus(i) === 'closed');

  // Filter by search
  if (searchQ) {
    list = list.filter(i =>
      (i.title       || '').toLowerCase().includes(searchQ) ||
      (i.description || i.body || '').toLowerCase().includes(searchQ) ||
      (i.author      || i.user?.login || '').toLowerCase().includes(searchQ)
    );
  }

  // Update count
  document.getElementById('count-text').innerHTML =
    `<strong>${list.length}</strong> issues — Track and manage your project issues`;

  const grid = document.getElementById('grid');

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <img src="Aperture.png" alt="No issues" style="width:36px;height:36px;opacity:0.4;"/>
        <p>No issues found</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(cardHTML).join('');
}

// ── Build a single card ──────────────────────────────────────────────────────
function cardHTML(issue) {
  const s      = getStatus(issue);
  const p      = getPriority(issue);
  const l      = getLabel(issue);
  const author = issue.author || issue.user?.login || 'Unknown';
  const date   = fmtDate(issue.createdAt || issue.created_at);
  const id     = String(issue.id || issue._id || '');

  return `
    <div class="issue-card" onclick="openModal('${esc(id)}')">
      <div class="card-top ${s}"></div>
      <div class="card-body">
        <div class="card-row1">
          ${statusImg(s)}
          ${p ? `<span class="priority-tag ${pClass(p)}">${p}</span>` : ''}
        </div>
        <div class="card-title">${esc(issue.title || 'Untitled')}</div>
        <div class="card-desc">${esc(issue.description || issue.body || '')}</div>
        ${l ? `<span class="label-tag ${lClass(l)}">${esc(l)}</span>` : ''}
        <div class="card-footer">
          <span class="card-author">by ${esc(author)}</span>
          <span class="card-date">${date}</span>
        </div>
      </div>
    </div>`;
}

// ── Modal: open ──────────────────────────────────────────────────────────────
function openModal(id) {
  const issue = allIssues.find(i => String(i.id || i._id) === String(id));
  if (!issue) return;

  const s      = getStatus(issue);
  const p      = getPriority(issue);
  const l      = getLabel(issue);
  const author = issue.author || issue.user?.login || 'Unknown';
  const imgSrc = s === 'open' ? IMG_OPEN : IMG_CLOSED;

  // Top colour bar
  document.getElementById('modal-top').className = `modal-top-bar ${s}`;

  // Status icon image
  document.getElementById('m-icon').innerHTML =
    `<img src="${imgSrc}" alt="${s}" class="modal-status-img"/>`;

  // Title
  document.getElementById('m-title').textContent = issue.title || 'Untitled';

  // Description
  document.getElementById('m-desc').textContent =
    issue.description || issue.body || 'No description provided.';

  // Status pill with image
  document.getElementById('m-status').innerHTML =
    `<span class="status-pill ${s}">
      <img src="${imgSrc}" alt="${s}"/>
      ${s.charAt(0).toUpperCase() + s.slice(1)}
    </span>`;

  // Priority
  const pe       = document.getElementById('m-priority');
  pe.textContent = p || 'N/A';
  pe.className   = `priority-tag ${pClass(p)}`;

  // Author
  document.getElementById('m-author').textContent = author;

  // Label
  const le       = document.getElementById('m-label');
  le.textContent = l || 'None';
  le.className   = `label-tag ${lClass(l)}`;

  // Date & ID
  document.getElementById('m-date').textContent = fmtDate(issue.createdAt || issue.created_at);
  document.getElementById('m-id').textContent   = `#${issue.id || issue._id || 'N/A'}`;

  // Show modal
  document.getElementById('modal-overlay').classList.add('open');
}

// ── Modal: close ─────────────────────────────────────────────────────────────
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

/** Close when clicking the dark backdrop */
function overlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}