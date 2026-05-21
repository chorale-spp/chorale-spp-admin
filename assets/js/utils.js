// ============================================
// CORE UTILITIES
// ============================================

window.APP = window.APP || {};

// ── Roles ──
APP.ROLES = {
  music_director: 'Music Director',
  maestro:        'Maestro',
  treasurer:      'Treasurer',
  secretary:      'Secretary / Admin',
  archivist:      'Archivist',
  discipline_dir: 'Discipline Director',
  discipline_vic: 'Discipline Vice-Director',
  voice_resp:     'Voice Responsable',
  member:         'Member'
};

APP.VOICES = ['Soprano', 'Alto', 'Tenor', 'Bass'];

APP.PERF_RATINGS = {
  excellent: { label: 'Excellent', score: 4, cls: 'badge-green' },
  good:      { label: 'Good',      score: 3, cls: 'badge-blue' },
  fair:      { label: 'Fair',      score: 2, cls: 'badge-gold' },
  poor:      { label: 'Poor',      score: 1, cls: 'badge-red' },
  bad:       { label: 'Bad',       score: 0, cls: 'badge-red' }
};

APP.MONTHLY_CONTRIBUTION = 5000; // UGX

// ── Score Calculation ──
// Max 100: attendance 40, performance 35, financial 25
APP.calcMemberScore = function(member, records) {
  const { attendanceRecords = [], performanceRecords = [], contributionRecords = [] } = records;

  // Attendance (40 pts)
  let attScore = 0;
  if (attendanceRecords.length > 0) {
    const present = attendanceRecords.filter(r => r.status === 'present').length;
    const late    = attendanceRecords.filter(r => r.status === 'late').length;
    const total   = attendanceRecords.length;
    const rate = (present + late * 0.5) / total;
    attScore = Math.round(rate * 40);
  } else {
    attScore = 40; // new member, no deduction
  }

  // Performance (35 pts)
  let perfScore = 0;
  if (performanceRecords.length > 0) {
    const avg = performanceRecords.reduce((s, r) => s + (APP.PERF_RATINGS[r.rating]?.score || 0), 0) / performanceRecords.length;
    perfScore = Math.round((avg / 4) * 35);
  } else {
    perfScore = 35;
  }

  // Financial (25 pts)
  let finScore = 0;
  if (contributionRecords.length > 0) {
    const expected = contributionRecords.filter(r => r.type === 'monthly').length * APP.MONTHLY_CONTRIBUTION;
    const paid     = contributionRecords.filter(r => r.paid).reduce((s, r) => s + (r.amount || 0), 0);
    if (expected > 0) {
      finScore = Math.min(25, Math.round((paid / expected) * 25));
    } else {
      finScore = 25;
    }
  } else {
    finScore = 25;
  }

  return Math.min(100, attScore + perfScore + finScore);
};

APP.scoreClass = function(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'average';
  return 'poor';
};

APP.scoreLabel = function(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  return 'Needs Attention';
};

// ── Formatting ──
APP.formatUGX = function(amount) {
  if (amount === undefined || amount === null) return '—';
  return 'UGX ' + Number(amount).toLocaleString('en-UG');
};

APP.formatDate = function(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

APP.formatDateShort = function(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

APP.today = function() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
};

APP.initials = function(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
};

// ── Toast Notifications ──
(function() {
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);

  APP.toast = function(msg, type = 'info', duration = 3500) {
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${msg}</span>`;
    container.appendChild(t);
    requestAnimationFrame(() => { requestAnimationFrame(() => { t.classList.add('show'); }); });
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, duration);
  };
})();

// ── Undo System ──
APP.undoStack = [];

APP.pushUndo = function(action) {
  // action: { label, fn }
  APP.undoStack.push(action);
  APP.showUndoBanner(action.label);
};

APP.showUndoBanner = function(label) {
  let banner = document.getElementById('undo-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'undo-banner';
    banner.className = 'undo-banner';
    banner.innerHTML = `<span id="undo-label"></span><button id="undo-btn">Undo</button>`;
    document.body.appendChild(banner);
    document.getElementById('undo-btn').addEventListener('click', () => {
      const act = APP.undoStack.pop();
      if (act) { act.fn(); APP.toast('Action undone', 'success'); }
      banner.classList.remove('visible');
    });
  }

  document.getElementById('undo-label').textContent = label;
  banner.classList.add('visible');

  clearTimeout(APP._undoTimer);
  APP._undoTimer = setTimeout(() => {
    banner.classList.remove('visible');
    APP.undoStack = [];
  }, 6000);
};

// ── Modal helpers ──
APP.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
};

APP.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
};

// Close modal on overlay click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Close modal on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ── Navigation ──
APP.navigate = function(section) {
  document.querySelectorAll('.section-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById(`view-${section}`);
  const nav  = document.querySelector(`[data-nav="${section}"]`);

  if (view) view.classList.add('active');
  if (nav)  nav.classList.add('active');

  // Update topbar title
  const titles = {
    overview:   'Overview',
    members:    'Choir Members',
    attendance: 'Attendance',
    events:     'Events',
    finances:   'Finances'
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[section] || section;

  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');

  // Lazy-load section
  const loaders = {
    overview:   APP.loadOverview,
    members:    APP.loadMembers,
    attendance: APP.loadAttendance,
    events:     APP.loadEvents,
    finances:   APP.loadFinances
  };

  if (typeof loaders[section] === 'function') loaders[section]();
};

// ── Report Generation ──
APP.exportCSV = function(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

APP.printReport = function(title, html) {
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head>
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Montserrat', sans-serif; font-size: 11px; color: #1A1A1A; margin: 24px; }
      h1   { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 400; margin-bottom: 4px; }
      h1 em { color: #B8973A; font-style: italic; }
      .sub { color: #888; font-size: 10px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #F5F0E8; padding: 8px 10px; text-align: left; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #6B6B60; border-bottom: 1px solid #e0d8c8; }
      td { padding: 8px 10px; border-bottom: 1px solid #f0ebe0; }
      .gold { color: #B8973A; }
      @media print { @page { margin: 14mm; } }
    </style>
    </head><body>
    <h1>Chorale <em>Saint Padre Pio</em></h1>
    <div class="sub">${title} — Generated ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</div>
    ${html}
    </body></html>
  `);
  win.document.close();
  win.print();
};
