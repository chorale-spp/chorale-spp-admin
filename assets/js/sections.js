// ============================================
// DASHBOARD SECTIONS
// ============================================

// ── OVERVIEW ──────────────────────────────
APP.loadOverview = async function() {
  const el = document.getElementById('view-overview');
  if (!el || el.dataset.loaded === 'true') return;

  try {
    const [membersSnap, eventsSnap, finSnap] = await Promise.all([
      db.collection('members').get(),
      db.collection('events').orderBy('date','desc').limit(5).get(),
      db.collection('transactions').orderBy('date','desc').limit(50).get()
    ]);

    const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const events  = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const txns    = finSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const totalIncome  = txns.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const totalExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const balance      = totalIncome - totalExpense;

    // Voice distribution
    const voices = { Soprano: 0, Alto: 0, Tenor: 0, Bass: 0 };
    members.forEach(m => { if (voices[m.voice] !== undefined) voices[m.voice]++; });

    el.innerHTML = `
      <div class="page-header">
        <div class="eyebrow">Dashboard</div>
        <h2>Welcome, <em>${APP.currentUser?.firstName || 'Director'}</em></h2>
        <div class="divider"></div>
        <div class="subtitle">${APP.today()}</div>
      </div>

      <div class="stats-grid mb-28">
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-users"></i></div>
          <div class="stat-value">${members.length}</div>
          <div class="stat-label">Total Members</div>
          <div class="stat-sub">${Object.entries(voices).map(([v,c]) => `${c} ${v}`).join(' · ')}</div>
        </div>
        <div class="stat-card dark">
          <div class="stat-icon"><i class="fas fa-calendar-alt"></i></div>
          <div class="stat-value">${events.length}</div>
          <div class="stat-label">Events</div>
          <div class="stat-sub">Tracked this period</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
          <div class="stat-value" style="font-size:1.4rem">${APP.formatUGX(totalIncome)}</div>
          <div class="stat-label">Total Income</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-balance-scale"></i></div>
          <div class="stat-value" style="font-size:1.4rem; color:${balance >= 0 ? '#27ae60' : '#c0392b'}">${APP.formatUGX(Math.abs(balance))}</div>
          <div class="stat-label">Balance</div>
          <div class="stat-sub">${balance >= 0 ? 'Surplus' : 'Deficit'}</div>
        </div>
      </div>

      <div class="grid-2 mb-20">
        <div class="card">
          <div class="card-header">
            <h3>Voice Distribution</h3>
          </div>
          <div class="card-body">
            <div class="chart-wrap"><canvas id="chart-voices"></canvas></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>Financial Overview</h3>
          </div>
          <div class="card-body">
            <div class="chart-wrap"><canvas id="chart-finance"></canvas></div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3>Member Scores</h3>
            <span class="badge badge-gold">Top Performers</span>
          </div>
          <div class="card-body" id="overview-scores">
            <div class="chart-wrap"><canvas id="chart-scores"></canvas></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Recent Events</h3></div>
          <div class="card-body" id="overview-events">
            ${events.length === 0 ? '<p class="muted" style="font-size:.82rem">No events yet.</p>' :
              events.map(e => `
                <div class="event-tag">
                  <div class="event-dot"></div>
                  <div>
                    <div style="font-weight:500">${e.title}</div>
                    <div style="font-size:.7rem;color:var(--text-muted)">${APP.formatDate(e.date)}</div>
                  </div>
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
    `;

    el.dataset.loaded = 'true';

    // Render charts
    setTimeout(() => {
      APP.renderVoiceChart(voices);
      APP.renderFinanceChart(txns);
      APP.renderScoresChart(members);
    }, 50);

  } catch(err) {
    console.error('Overview error:', err);
    el.innerHTML = `<p class="muted">Error loading overview. Check your Firebase connection.</p>`;
  }
};

APP.renderVoiceChart = function(voices) {
  const ctx = document.getElementById('chart-voices');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(voices),
      datasets: [{
        data: Object.values(voices),
        backgroundColor: ['#B8973A','#2D2D2A','#8C6E28','#D4B05A'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Montserrat', size: 11 }, padding: 14 } }
      }
    }
  });
};

APP.renderFinanceChart = function(txns) {
  const ctx = document.getElementById('chart-finance');
  if (!ctx) return;

  // Build last 6 months data
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() });
  }

  const income  = months.map(m => txns.filter(t => t.type === 'income'  && matchMonth(t, m)).reduce((s, t) => s + (t.amount || 0), 0));
  const expense = months.map(m => txns.filter(t => t.type === 'expense' && matchMonth(t, m)).reduce((s, t) => s + (t.amount || 0), 0));

  function matchMonth(t, m) {
    if (!t.date) return false;
    const d = t.date.toDate ? t.date.toDate() : new Date(t.date);
    return d.getMonth() === m.month && d.getFullYear() === m.year;
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Income',  data: income,  backgroundColor: 'rgba(184,151,58,0.7)',  borderRadius: 4 },
        { label: 'Expense', data: expense, backgroundColor: 'rgba(192,57,43,0.55)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { family: 'Montserrat', size: 11 }, padding: 12 } } },
      scales: {
        y: { ticks: { callback: v => 'UGX ' + (v/1000) + 'k', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
};

APP.renderScoresChart = function(members) {
  const ctx = document.getElementById('chart-scores');
  if (!ctx || members.length === 0) return;

  // Use stored scores for overview chart
  const sorted = [...members].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 8);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(m => m.firstName || m.name?.split(' ')[0] || '?'),
      datasets: [{
        label: 'Score',
        data: sorted.map(m => m.score || 0),
        backgroundColor: sorted.map(m => {
          const s = m.score || 0;
          if (s >= 85) return 'rgba(39,174,96,0.7)';
          if (s >= 70) return 'rgba(52,152,219,0.7)';
          if (s >= 50) return 'rgba(184,151,58,0.7)';
          return 'rgba(192,57,43,0.7)';
        }),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { max: 100, ticks: { font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { ticks: { font: { family: 'Montserrat', size: 10 } }, grid: { display: false } }
      }
    }
  });
};


// ── MEMBERS ───────────────────────────────
APP.loadMembers = async function() {
  const el = document.getElementById('view-members');
  if (!el) return;
  el.dataset.loaded = 'false'; // always reload

  el.innerHTML = `
    <div class="page-header">
      <div class="eyebrow">Directory</div>
      <h2>Choir <em>Members</em></h2>
      <div class="divider"></div>
    </div>
    <div class="actions-row">
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="member-search" placeholder="Search members...">
      </div>
      <select id="member-voice-filter" style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none;background:white">
        <option value="">All Voices</option>
        ${APP.VOICES.map(v => `<option value="${v}">${v}</option>`).join('')}
      </select>
      <button class="btn-primary" style="width:auto;padding:9px 18px" onclick="APP.openModal('modal-add-member')">
        <i class="fas fa-plus"></i> Add Member
      </button>
      <button class="btn-secondary" onclick="APP.exportMembersCSV()">
        <i class="fas fa-file-csv"></i> Export
      </button>
      <button class="btn-secondary" onclick="APP.printMembersReport()">
        <i class="fas fa-print"></i> Print
      </button>
    </div>
    <div class="table-wrapper" id="members-table-wrap">
      <div style="padding:40px;text-align:center"><div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div></div>
    </div>
  `;

  document.getElementById('member-search')?.addEventListener('input', () => APP.renderMembersTable());
  document.getElementById('member-voice-filter')?.addEventListener('change', () => APP.renderMembersTable());

  try {
    const snap = await db.collection('members').orderBy('lastName').get();
    APP._members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    APP.renderMembersTable();
  } catch (e) {
    document.getElementById('members-table-wrap').innerHTML = `<p style="padding:24px" class="muted">Error loading members.</p>`;
  }
};

APP.renderMembersTable = function() {
  const search = (document.getElementById('member-search')?.value || '').toLowerCase();
  const voice  = document.getElementById('member-voice-filter')?.value || '';
  const members = (APP._members || []).filter(m => {
    const name = `${m.firstName} ${m.lastName}`.toLowerCase();
    return (!search || name.includes(search)) && (!voice || m.voice === voice);
  });

  const wrap = document.getElementById('members-table-wrap');
  if (!wrap) return;

  if (members.length === 0) {
    wrap.innerHTML = `<p style="padding:24px" class="muted">No members found.</p>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Voice</th>
          <th>Role</th>
          <th>Joined</th>
          <th>Score</th>
          <th>Attendance</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${members.map(m => {
          const score = m.score || 0;
          const sCls  = APP.scoreClass(score);
          return `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--dark);display:flex;align-items:center;justify-content:center;color:var(--gold-light);font-family:var(--font-serif);font-size:.85rem;flex-shrink:0">${APP.initials(m.firstName + ' ' + m.lastName)}</div>
                <div>
                  <div style="font-weight:500">${m.firstName} ${m.lastName}</div>
                  <div style="font-size:.7rem;color:var(--text-muted)">${m.email || '—'}</div>
                </div>
              </div>
            </td>
            <td><span class="badge badge-gold">${m.voice || '—'}</span></td>
            <td style="font-size:.78rem">${APP.ROLES[m.role] || m.role || '—'}</td>
            <td style="font-size:.78rem">${APP.formatDate(m.joinDate)}</td>
            <td><span class="score-pill ${sCls}">${score}</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="progress-bar-wrap" style="width:70px">
                  <div class="progress-bar-fill" style="width:${m.attendanceRate || 0}%"></div>
                </div>
                <span style="font-size:.75rem">${m.attendanceRate || 0}%</span>
              </div>
            </td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn-ghost" onclick="APP.viewMember('${m.id}')" title="View"><i class="fas fa-eye"></i></button>
                <button class="btn-ghost" onclick="APP.editMember('${m.id}')" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn-ghost" style="color:#c0392b" onclick="APP.deleteMember('${m.id}')" title="Remove"><i class="fas fa-trash-alt"></i></button>
              </div>
            </td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
};

APP.viewMember = async function(id) {
  const m = (APP._members || []).find(m => m.id === id);
  if (!m) return;

  // Load all records for this member
  try {
    const [attSnap, perfSnap, contSnap] = await Promise.all([
      db.collection('attendance').where('memberId','==',id).get(),
      db.collection('performance').where('memberId','==',id).get(),
      db.collection('contributions').where('memberId','==',id).get()
    ]);

    const attRecs  = attSnap.docs.map(d => d.data());
    const perfRecs = perfSnap.docs.map(d => d.data());
    const contRecs = contSnap.docs.map(d => d.data());

    const score = APP.calcMemberScore(m, {
      attendanceRecords: attRecs,
      performanceRecords: perfRecs,
      contributionRecords: contRecs
    });

    const totalPaid  = contRecs.filter(c => c.paid).reduce((s, c) => s + (c.amount || 0), 0);
    const sCls = APP.scoreClass(score);

    const modal = document.getElementById('modal-view-member');
    modal.querySelector('.modal-body').innerHTML = `
      <div style="text-align:center;margin-bottom:20px">
        <div class="profile-avatar-placeholder" style="width:64px;height:64px;font-size:1.3rem">${APP.initials(m.firstName+' '+m.lastName)}</div>
        <div style="font-family:var(--font-serif);font-size:1.4rem;margin-top:8px">${m.firstName} ${m.lastName}</div>
        <div style="font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-top:4px">${APP.ROLES[m.role] || m.role || '—'}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${m.voice || ''} · Joined ${APP.formatDate(m.joinDate)}</div>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="stat-card" style="padding:14px;text-align:center">
          <div class="stat-value" style="font-size:1.6rem">${score}</div>
          <div class="stat-label">Score</div>
        </div>
        <div class="stat-card" style="padding:14px;text-align:center">
          <div class="stat-value" style="font-size:1.6rem">${attRecs.length}</div>
          <div class="stat-label">Rehearsals</div>
        </div>
        <div class="stat-card" style="padding:14px;text-align:center">
          <div class="stat-value" style="font-size:1.3rem">${APP.formatUGX(totalPaid)}</div>
          <div class="stat-label">Contributed</div>
        </div>
      </div>
      <div class="divider-h"></div>
      <div style="margin-top:14px">
        <div style="font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--text-muted);font-weight:600;margin-bottom:8px">Recent Performance</div>
        ${perfRecs.length === 0 ? '<p class="muted" style="font-size:.8rem">No performance records.</p>' :
          perfRecs.slice(-5).map(p => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.04);font-size:.8rem">
              <span>${APP.formatDate(p.date)}</span>
              <span class="badge ${APP.PERF_RATINGS[p.rating]?.cls || 'badge-gray'}">${APP.PERF_RATINGS[p.rating]?.label || p.rating}</span>
            </div>
          `).join('')
        }
      </div>
    `;

    modal.querySelector('.modal-header h3').textContent = `${m.firstName} ${m.lastName}`;
    APP.openModal('modal-view-member');
  } catch(e) {
    APP.toast('Error loading member details', 'error');
  }
};

APP.editMember = function(id) {
  const m = (APP._members || []).find(m => m.id === id);
  if (!m) return;

  const modal = document.getElementById('modal-add-member');
  modal.querySelector('.modal-header h3').textContent = 'Edit Member';
  modal.querySelector('#form-member-id').value = id;
  modal.querySelector('#fm-first').value       = m.firstName || '';
  modal.querySelector('#fm-last').value        = m.lastName  || '';
  modal.querySelector('#fm-email').value       = m.email     || '';
  modal.querySelector('#fm-phone').value       = m.phone     || '';
  modal.querySelector('#fm-voice').value       = m.voice     || '';
  modal.querySelector('#fm-role').value        = m.role      || '';
  modal.querySelector('#fm-join').value        = m.joinDate  ? (m.joinDate.toDate ? m.joinDate.toDate().toISOString().split('T')[0] : m.joinDate) : '';
  modal.querySelector('#fm-motto').value       = m.motto     || '';

  // Hide UID field when editing — UID cannot be changed
  const uidGroup   = document.getElementById('fm-uid-group');
  const uidDivider = document.getElementById('fm-uid-divider');
  if (uidGroup)   uidGroup.style.display   = 'none';
  if (uidDivider) uidDivider.style.display = 'none';

  APP.openModal('modal-add-member');
};

APP.saveMember = async function() {
  const existingId = document.getElementById('form-member-id').value;
  const uid        = document.getElementById('fm-uid')?.value.trim();
  const firstName  = document.getElementById('fm-first').value.trim();
  const lastName   = document.getElementById('fm-last').value.trim();
  const email      = document.getElementById('fm-email').value.trim();
  const phone      = document.getElementById('fm-phone').value.trim();
  const voice      = document.getElementById('fm-voice').value;
  const role       = document.getElementById('fm-role').value;
  const joinDate   = document.getElementById('fm-join').value;
  const motto      = document.getElementById('fm-motto').value.trim();

  if (!firstName || !lastName) { APP.toast('First and last name required', 'error'); return; }

  // When adding new, UID is required
  if (!existingId) {
    if (!uid) {
      document.getElementById('fm-uid').style.borderColor = '#c0392b';
      document.getElementById('fm-uid').style.boxShadow  = '0 0 0 3px rgba(192,57,43,0.15)';
      APP.toast('Firebase UID is required to link the login account', 'error');
      return;
    }
    // Check UID not already in use
    const existing = await db.collection('members').doc(uid).get();
    if (existing.exists) {
      APP.toast('A member with this UID already exists', 'error');
      return;
    }
  }

  const data = { firstName, lastName, email, phone, voice, role, motto,
    joinDate: joinDate ? firebase.firestore.Timestamp.fromDate(new Date(joinDate)) : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (existingId) {
      // Editing existing member
      const oldData = { ...(APP._members || []).find(m => m.id === existingId) };
      await db.collection('members').doc(existingId).update(data);
      APP.toast('Member updated', 'success');
      APP.pushUndo({ label: `Undo update: ${firstName} ${lastName}`, fn: async () => {
        await db.collection('members').doc(existingId).update(oldData);
        APP.loadMembers();
      }});
    } else {
      // New member — use UID as document ID so login links automatically
      await db.collection('members').doc(uid).set({
        ...data,
        score: 100,
        attendanceRate: 100,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      APP.toast(`${firstName} ${lastName} added and linked to their login`, 'success');
      APP.pushUndo({ label: `Undo add: ${firstName} ${lastName}`, fn: async () => {
        await db.collection('members').doc(uid).delete();
        APP.loadMembers();
      }});
    }

    APP.closeModal('modal-add-member');
    APP._members = null;
    APP.loadMembers();

    // Reset form
    document.getElementById('form-member-id').value = '';
    document.getElementById('fm-uid').value          = '';
    document.getElementById('fm-uid').style.borderColor = '';
    document.getElementById('fm-uid').style.boxShadow   = '';
    document.getElementById('modal-add-member').querySelector('.modal-header h3').textContent = 'Add Member';

  } catch(e) {
    APP.toast('Save failed: ' + e.message, 'error');
  }
};

APP.deleteMember = async function(id) {
  const m = (APP._members || []).find(m => m.id === id);
  if (!m) return;
  if (!confirm(`Remove ${m.firstName} ${m.lastName} from the choir?`)) return;

  try {
    const backup = { ...m };
    await db.collection('members').doc(id).delete();
    APP.toast(`${m.firstName} ${m.lastName} removed`, 'info');
    APP.pushUndo({ label: `Restore ${m.firstName} ${m.lastName}`, fn: async () => {
      await db.collection('members').doc(id).set(backup);
      APP.loadMembers();
    }});
    APP._members = null;
    APP.loadMembers();
  } catch(e) {
    APP.toast('Delete failed', 'error');
  }
};

APP.exportMembersCSV = function() {
  const rows = [['First Name','Last Name','Voice','Role','Email','Phone','Joined','Score','Attendance %']];
  (APP._members || []).forEach(m => {
    rows.push([m.firstName, m.lastName, m.voice, APP.ROLES[m.role] || m.role, m.email, m.phone, APP.formatDate(m.joinDate), m.score || 0, m.attendanceRate || 0]);
  });
  APP.exportCSV(rows, 'chorale_members.csv');
};

APP.printMembersReport = function() {
  const rows = (APP._members || []).map(m => `
    <tr>
      <td>${m.firstName} ${m.lastName}</td>
      <td>${m.voice || '—'}</td>
      <td>${APP.ROLES[m.role] || m.role || '—'}</td>
      <td>${APP.formatDate(m.joinDate)}</td>
      <td class="gold"><strong>${m.score || 0}</strong></td>
      <td>${m.attendanceRate || 0}%</td>
    </tr>
  `).join('');
  APP.printReport('Members Report', `
    <table>
      <thead><tr><th>Name</th><th>Voice</th><th>Role</th><th>Joined</th><th>Score</th><th>Attendance</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
};


// ── ATTENDANCE ────────────────────────────
APP.loadAttendance = async function() {
  const el = document.getElementById('view-attendance');
  if (!el) return;

  try {
    const membersSnap = await db.collection('members').orderBy('lastName').get();
    const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const today = new Date().toISOString().split('T')[0];

    el.innerHTML = `
      <div class="page-header">
        <div class="eyebrow">Track</div>
        <h2>Attendance <em>Register</em></h2>
        <div class="divider"></div>
      </div>
      <div class="actions-row">
        <div style="display:flex;align-items:center;gap:10px">
          <label style="font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)">Date</label>
          <input type="date" id="att-date" value="${today}" style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none">
        </div>
        <select id="att-type" style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none;background:white">
          <option value="rehearsal">Rehearsal</option>
          <option value="event">Event</option>
          <option value="meeting">Meeting</option>
        </select>
        <input type="text" id="att-note" placeholder="Notes (optional)" style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none;flex:1;max-width:220px">
        <button class="btn-primary" style="width:auto;padding:9px 18px" onclick="APP.saveAttendance()">
          <i class="fas fa-save"></i> Save Register
        </button>
        <button class="btn-secondary" onclick="APP.markAllPresent()">
          <i class="fas fa-check-double"></i> Mark All Present
        </button>
      </div>

      <div style="margin-bottom:14px;display:flex;gap:16px;flex-wrap:wrap">
        ${APP.VOICES.map(v => `
          <div style="font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gold);margin-right:5px"></span>
            ${v}: ${members.filter(m => m.voice === v).length}
          </div>
        `).join('')}
      </div>

      <div class="attendance-grid" id="attendance-list">
        ${APP.VOICES.map(voice => {
          const group = members.filter(m => m.voice === voice);
          if (!group.length) return '';
          return `
            <div style="font-size:.65rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-weight:600;padding:10px 0 4px">${voice}s</div>
            ${group.map(m => `
              <div class="attendance-row" data-member-id="${m.id}">
                <div class="attendance-name">
                  ${m.firstName} ${m.lastName}
                  <span class="voice-tag">${voice}</span>
                </div>
                <div class="attendance-toggle">
                  <button class="att-btn" data-status="present" onclick="APP.toggleAtt(this,'present')"><i class="fas fa-check"></i> Present</button>
                  <button class="att-btn" data-status="late"    onclick="APP.toggleAtt(this,'late')"><i class="fas fa-clock"></i> Late</button>
                  <button class="att-btn" data-status="absent"  onclick="APP.toggleAtt(this,'absent')"><i class="fas fa-times"></i> Absent</button>
                </div>
                <div style="width:120px">
                  <select class="perf-select" style="padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:.72rem;outline:none;background:white;width:100%">
                    <option value="">Performance</option>
                    ${Object.entries(APP.PERF_RATINGS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
                  </select>
                </div>
              </div>
            `).join('')}
          `;
        }).join('')}
      </div>

      <div class="mt-16">
        <div class="card">
          <div class="card-header"><h3>Past Registers</h3></div>
          <div class="card-body" id="past-registers">
            <div style="text-align:center;padding:20px"><div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div></div>
          </div>
        </div>
      </div>
    `;

    APP.loadPastRegisters();

  } catch(e) {
    el.innerHTML = `<p class="muted">Error loading attendance.</p>`;
  }
};

APP.toggleAtt = function(btn, status) {
  const row = btn.closest('.attendance-row');
  row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active-present','active-absent','active-late'));
  btn.classList.add(`active-${status}`);
};

APP.markAllPresent = function() {
  document.querySelectorAll('.attendance-row').forEach(row => {
    row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active-present','active-absent','active-late'));
    row.querySelector('[data-status="present"]')?.classList.add('active-present');
  });
};

APP.saveAttendance = async function() {
  const date = document.getElementById('att-date').value;
  const type = document.getElementById('att-type').value;
  const note = document.getElementById('att-note').value;

  if (!date) { APP.toast('Please select a date', 'error'); return; }

  const rows = document.querySelectorAll('.attendance-row');
  if (!rows.length) { APP.toast('No members to save', 'error'); return; }

  const batch = db.batch();
  const saved = [];
  const ts = firebase.firestore.Timestamp.fromDate(new Date(date));

  rows.forEach(row => {
    const memberId = row.dataset.memberId;
    const activeBtn = row.querySelector('.att-btn.active-present, .att-btn.active-late, .att-btn.active-absent');
    const status = activeBtn?.dataset.status || 'absent';
    const rating = row.querySelector('.perf-select')?.value || '';

    const ref = db.collection('attendance').doc();
    batch.set(ref, { memberId, date: ts, type, note, status, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    saved.push({ id: ref.id, memberId, status });

    if (rating) {
      const pRef = db.collection('performance').doc();
      batch.set(pRef, { memberId, date: ts, rating, type, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  });

  try {
    await batch.commit();

    // Recalculate attendance rates
    await APP.recalcAttendanceRates(saved.map(s => s.memberId));

    APP.toast(`Attendance saved for ${saved.length} members`, 'success');
    APP.loadPastRegisters();

    APP.pushUndo({ label: 'Undo attendance save', fn: async () => {
      // Delete the records just saved
      const delBatch = db.batch();
      saved.forEach(s => delBatch.delete(db.collection('attendance').doc(s.id)));
      await delBatch.commit();
      APP.toast('Attendance register undone', 'info');
    }});

  } catch(e) {
    APP.toast('Error saving: ' + e.message, 'error');
  }
};

APP.recalcAttendanceRates = async function(memberIds) {
  const unique = [...new Set(memberIds)];
  const batch = db.batch();
  for (const mid of unique) {
    const snap = await db.collection('attendance').where('memberId','==',mid).get();
    const recs = snap.docs.map(d => d.data());
    const total = recs.length;
    if (total === 0) continue;
    const presentCount = recs.filter(r => r.status === 'present').length;
    const lateCount    = recs.filter(r => r.status === 'late').length;
    const rate = Math.round(((presentCount + lateCount * 0.5) / total) * 100);
    batch.update(db.collection('members').doc(mid), { attendanceRate: rate });
  }
  await batch.commit();
};

APP.loadPastRegisters = async function() {
  const el = document.getElementById('past-registers');
  if (!el) return;
  try {
    const snap = await db.collection('attendance')
      .orderBy('date','desc')
      .limit(100).get();

    // Group by date+type
    const groups = {};
    snap.docs.forEach(d => {
      const data = d.data();
      const key = APP.formatDate(data.date) + '|' + data.type;
      if (!groups[key]) groups[key] = { date: data.date, type: data.type, count: 0, present: 0 };
      groups[key].count++;
      if (data.status === 'present' || data.status === 'late') groups[key].present++;
    });

    const entries = Object.values(groups).sort((a,b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)).slice(0, 10);

    if (!entries.length) { el.innerHTML = '<p class="muted" style="font-size:.8rem">No past registers.</p>'; return; }

    el.innerHTML = `
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Members</th><th>Present</th><th>Rate</th></tr></thead>
        <tbody>
          ${entries.map(e => `
            <tr>
              <td>${APP.formatDate(e.date)}</td>
              <td><span class="badge badge-gold">${e.type}</span></td>
              <td>${e.count}</td>
              <td>${e.present}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="progress-bar-wrap" style="width:60px">
                    <div class="progress-bar-fill" style="width:${Math.round(e.present/e.count*100)}%"></div>
                  </div>
                  <span style="font-size:.75rem">${Math.round(e.present/e.count*100)}%</span>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch(e) {
    el.innerHTML = '<p class="muted" style="font-size:.8rem">Error loading registers.</p>';
  }
};


// ── EVENTS ────────────────────────────────
APP.loadEvents = async function() {
  const el = document.getElementById('view-events');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div class="eyebrow">Schedule</div>
      <h2>Events <em>Calendar</em></h2>
      <div class="divider"></div>
    </div>
    <div class="grid-2 mb-20">
      <div>
        <div class="calendar-wrap" id="event-calendar"></div>
        <div style="margin-top:16px" id="event-day-detail"></div>
      </div>
      <div>
        <div class="actions-row" style="margin-bottom:16px">
          <button class="btn-primary" style="width:auto;padding:9px 18px" onclick="APP.openModal('modal-add-event')">
            <i class="fas fa-plus"></i> New Event
          </button>
          <button class="btn-secondary" onclick="APP.printEventsReport()">
            <i class="fas fa-print"></i> Print
          </button>
        </div>
        <div class="card">
          <div class="card-header"><h3>Upcoming Events</h3></div>
          <div class="card-body" id="events-list">
            <div style="text-align:center;padding:20px"><div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  APP.renderCalendar(new Date());
  APP.loadEventsList();
};

APP.renderCalendar = function(date) {
  const wrap = document.getElementById('event-calendar');
  if (!wrap) return;

  const year = date.getFullYear();
  const month = date.getMonth();
  const today = new Date();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  let html = `
    <div class="calendar-nav">
      <button class="btn-ghost" onclick="APP.renderCalendar(new Date(${year},${month-1},1))"><i class="fas fa-chevron-left"></i></button>
      <h3>${monthName}</h3>
      <button class="btn-ghost" onclick="APP.renderCalendar(new Date(${year},${month+1},1))"><i class="fas fa-chevron-right"></i></button>
    </div>
    <div class="calendar-grid">
      ${dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
  `;

  // Blanks before first day
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day other-month"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const hasEv = (APP._events || []).some(e => {
      const ed = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return ed.getDate() === d && ed.getMonth() === month && ed.getFullYear() === year;
    });
    html += `<div class="cal-day${isToday?' today':''}${hasEv?' has-event':''}" onclick="APP.showDayEvents(${year},${month},${d})">${d}</div>`;
  }

  html += '</div>';
  wrap.innerHTML = html;
};

APP.showDayEvents = function(year, month, day) {
  const el = document.getElementById('event-day-detail');
  if (!el) return;
  const events = (APP._events || []).filter(e => {
    const ed = e.date?.toDate ? e.date.toDate() : new Date(e.date);
    return ed.getDate() === day && ed.getMonth() === month && ed.getFullYear() === year;
  });
  if (!events.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="font-size:.65rem;letter-spacing:.18em;text-transform:uppercase;color:var(--text-muted);font-weight:600;margin-bottom:8px">${day} ${new Date(year,month,day).toLocaleDateString('en-GB',{month:'long'})}</div>
    ${events.map(e => `
      <div class="event-tag" style="cursor:pointer" onclick="APP.viewEvent('${e.id}')">
        <div class="event-dot"></div>
        <div>
          <div style="font-weight:500">${e.title}</div>
          <div style="font-size:.7rem;color:var(--text-muted)">${e.venue || ''}</div>
        </div>
      </div>
    `).join('')}
  `;
};

APP.loadEventsList = async function() {
  const el = document.getElementById('events-list');
  if (!el) return;
  try {
    const snap = await db.collection('events').orderBy('date','asc').get();
    APP._events = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const now = new Date();
    const upcoming = APP._events.filter(e => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return d >= now;
    });
    const past = APP._events.filter(e => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return d < now;
    });

    if (!APP._events.length) { el.innerHTML = '<p class="muted" style="font-size:.8rem">No events yet.</p>'; return; }

    el.innerHTML = `
      ${upcoming.length ? `
        <div style="font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:10px">Upcoming</div>
        ${upcoming.map(e => APP.renderEventRow(e)).join('')}
        <div class="divider-h"></div>
      ` : ''}
      ${past.length ? `
        <div style="font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;color:var(--text-muted);font-weight:600;margin:10px 0">Past</div>
        ${past.slice(-5).reverse().map(e => APP.renderEventRow(e)).join('')}
      ` : ''}
    `;
  } catch(e) {
    el.innerHTML = '<p class="muted" style="font-size:.8rem">Error loading events.</p>';
  }
};

APP.renderEventRow = function(e) {
  return `
    <div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer" onclick="APP.viewEvent('${e.id}')">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <div style="font-weight:500;font-size:.84rem">${e.title}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">${APP.formatDate(e.date)} · ${e.venue || 'TBD'}</div>
        </div>
        <span class="badge badge-gold">${e.type || 'Event'}</span>
      </div>
      ${e.budget ? `<div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Budget: ${APP.formatUGX(e.budget)}</div>` : ''}
    </div>
  `;
};

APP.viewEvent = async function(id) {
  const e = (APP._events || []).find(ev => ev.id === id);
  if (!e) return;

  const modal = document.getElementById('modal-view-event');
  modal.querySelector('.modal-header h3').textContent = e.title;

  // Load event transactions
  const txSnap = await db.collection('transactions').where('eventId','==',id).get();
  const txns   = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const totalIncome  = txns.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

  const cats = e.budget_breakdown || {};

  modal.querySelector('.modal-body').innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:6px">${APP.formatDate(e.date)} · ${e.type || 'Event'}</div>
      <div style="font-family:var(--font-serif);font-size:1.4rem;margin-bottom:6px">${e.title}</div>
      <div style="font-size:.8rem;color:var(--text-muted)">${e.venue || ''}</div>
      ${e.description ? `<div style="font-size:.82rem;margin-top:10px;line-height:1.5">${e.description}</div>` : ''}
    </div>

    <div class="divider-h"></div>

    <div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:var(--text-muted);font-weight:600;margin-bottom:10px;margin-top:14px">Financial Summary</div>
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      <div class="stat-card" style="padding:12px;text-align:center">
        <div class="stat-value" style="font-size:1.1rem;color:#27ae60">${APP.formatUGX(totalIncome)}</div>
        <div class="stat-label">Income</div>
      </div>
      <div class="stat-card" style="padding:12px;text-align:center">
        <div class="stat-value" style="font-size:1.1rem;color:#c0392b">${APP.formatUGX(totalExpense)}</div>
        <div class="stat-label">Expenses</div>
      </div>
      <div class="stat-card" style="padding:12px;text-align:center">
        <div class="stat-value" style="font-size:1.1rem;color:${totalIncome-totalExpense>=0?'#27ae60':'#c0392b'}">${APP.formatUGX(Math.abs(totalIncome-totalExpense))}</div>
        <div class="stat-label">${totalIncome-totalExpense>=0?'Surplus':'Deficit'}</div>
      </div>
    </div>

    ${Object.keys(cats).length ? `
      <div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:var(--text-muted);font-weight:600;margin-bottom:8px">Budget Breakdown</div>
      ${Object.entries(cats).map(([cat,amt]) => `
        <div style="display:flex;justify-content:space-between;font-size:.8rem;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.04)">
          <span>${cat}</span><span style="color:var(--gold)">${APP.formatUGX(amt)}</span>
        </div>
      `).join('')}
    ` : ''}

    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-secondary" onclick="APP.addEventTransaction('${id}')"><i class="fas fa-plus"></i> Add Transaction</button>
      <button class="btn-secondary" onclick="APP.editEvent('${id}')"><i class="fas fa-pencil-alt"></i> Edit</button>
      <button class="btn-danger" onclick="APP.deleteEvent('${id}')"><i class="fas fa-trash-alt"></i> Delete</button>
    </div>
  `;

  APP.openModal('modal-view-event');
};

APP.saveEvent = async function() {
  const title    = document.getElementById('fe-title').value.trim();
  const date     = document.getElementById('fe-date').value;
  const venue    = document.getElementById('fe-venue').value.trim();
  const type     = document.getElementById('fe-type').value;
  const desc     = document.getElementById('fe-desc').value.trim();
  const budget   = parseFloat(document.getElementById('fe-budget').value) || 0;

  // Budget breakdown
  const cats = ['transport','costumes','venue','catering','sound','misc'];
  const breakdown = {};
  cats.forEach(c => {
    const v = parseFloat(document.getElementById(`fe-cat-${c}`)?.value) || 0;
    if (v) breakdown[c.charAt(0).toUpperCase() + c.slice(1)] = v;
  });

  if (!title || !date) { APP.toast('Title and date required', 'error'); return; }

  const data = {
    title, venue, type, description: desc, budget,
    budget_breakdown: breakdown,
    date: firebase.firestore.Timestamp.fromDate(new Date(date)),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const id = document.getElementById('form-event-id')?.value;

  try {
    if (id) {
      await db.collection('events').doc(id).update(data);
      APP.toast('Event updated', 'success');
    } else {
      const ref = await db.collection('events').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      APP.toast('Event created', 'success');
      APP.pushUndo({ label: `Undo: add event "${title}"`, fn: async () => {
        await db.collection('events').doc(ref.id).delete();
        APP.loadEventsList();
      }});
    }
    APP.closeModal('modal-add-event');
    APP._events = null;
    APP.loadEventsList();
  } catch(e) {
    APP.toast('Error: ' + e.message, 'error');
  }
};

APP.deleteEvent = async function(id) {
  if (!confirm('Delete this event?')) return;
  try {
    const snap = await db.collection('events').doc(id).get();
    const backup = snap.data();
    await db.collection('events').doc(id).delete();
    APP.toast('Event deleted', 'info');
    APP.pushUndo({ label: `Restore event "${backup.title}"`, fn: async () => {
      await db.collection('events').doc(id).set(backup);
      APP._events = null;
      APP.loadEventsList();
    }});
    APP.closeModal('modal-view-event');
    APP._events = null;
    APP.loadEventsList();
  } catch(e) {
    APP.toast('Error', 'error');
  }
};

APP.printEventsReport = function() {
  const rows = (APP._events || []).map(e => `
    <tr>
      <td>${e.title}</td>
      <td>${APP.formatDate(e.date)}</td>
      <td>${e.venue || '—'}</td>
      <td>${e.type || '—'}</td>
      <td class="gold">${APP.formatUGX(e.budget)}</td>
    </tr>
  `).join('');
  APP.printReport('Events Report', `
    <table>
      <thead><tr><th>Event</th><th>Date</th><th>Venue</th><th>Type</th><th>Budget</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
};


// ── FINANCES ──────────────────────────────
APP.loadFinances = async function() {
  const el = document.getElementById('view-finances');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div class="eyebrow">Treasury</div>
      <h2>Financial <em>Records</em></h2>
      <div class="divider"></div>
    </div>
    <div style="text-align:center;padding:40px"><div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div></div>
  `;

  try {
    const [txnSnap, memberSnap, eventSnap] = await Promise.all([
      db.collection('transactions').orderBy('date','desc').get(),
      db.collection('members').orderBy('lastName').get(),
      db.collection('events').orderBy('date','desc').get()
    ]);

    const txns    = txnSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const members = memberSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const events  = eventSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    APP._txns    = txns;
    APP._members = members;
    APP._events  = events;

    const totalIn  = txns.filter(t => t.type === 'income').reduce((s,t) => s + (t.amount||0), 0);
    const totalOut = txns.filter(t => t.type === 'expense').reduce((s,t) => s + (t.amount||0), 0);
    const balance  = totalIn - totalOut;

    // Monthly contributions due
    const monthlyDue = members.length * APP.MONTHLY_CONTRIBUTION;
    const monthlyPaid = txns.filter(t => t.category === 'monthly_contribution').reduce((s,t) => s + (t.amount||0), 0);

    el.innerHTML = `
      <div class="page-header">
        <div class="eyebrow">Treasury</div>
        <h2>Financial <em>Records</em></h2>
        <div class="divider"></div>
      </div>

      <div class="stats-grid mb-20">
        <div class="stat-card dark">
          <div class="stat-icon"><i class="fas fa-wallet"></i></div>
          <div class="stat-value" style="font-size:1.3rem">${APP.formatUGX(balance)}</div>
          <div class="stat-label">Current Balance</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
          <div class="stat-value" style="font-size:1.3rem;color:#27ae60">${APP.formatUGX(totalIn)}</div>
          <div class="stat-label">Total Income</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-arrow-down"></i></div>
          <div class="stat-value" style="font-size:1.3rem;color:#c0392b">${APP.formatUGX(totalOut)}</div>
          <div class="stat-label">Total Expenses</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-users"></i></div>
          <div class="stat-value" style="font-size:1.1rem">${APP.formatUGX(monthlyPaid)} / ${APP.formatUGX(monthlyDue)}</div>
          <div class="stat-label">Monthly Contributions</div>
          <div style="margin-top:8px">
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width:${Math.min(100,Math.round(monthlyPaid/Math.max(monthlyDue,1)*100))}%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2 mb-20">
        <div class="card">
          <div class="card-header"><h3>Member Contributions</h3>
            <button class="btn-secondary" onclick="APP.openModal('modal-add-contribution')"><i class="fas fa-plus"></i> Add</button>
          </div>
          <div class="card-body">
            <div style="max-height:320px;overflow-y:auto">
              ${APP.renderContributionsList(members, txns)}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Chart</h3></div>
          <div class="card-body">
            <div class="chart-wrap"><canvas id="chart-finance-detail"></canvas></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>All Transactions</h3>
          <div style="display:flex;gap:8px">
            <button class="btn-primary" style="width:auto;padding:8px 14px" onclick="APP.openModal('modal-add-transaction')">
              <i class="fas fa-plus"></i> Add
            </button>
            <button class="btn-secondary" onclick="APP.exportFinanceCSV()"><i class="fas fa-file-csv"></i></button>
            <button class="btn-secondary" onclick="APP.printFinanceReport()"><i class="fas fa-print"></i></button>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          <div style="max-height:400px;overflow-y:auto">
            ${txns.length === 0 ? '<p class="muted" style="padding:20px;font-size:.82rem">No transactions yet.</p>' :
              txns.map(t => `
                <div class="finance-row">
                  <div class="finance-icon ${t.type}"><i class="fas fa-${t.type === 'income' ? 'arrow-up' : 'arrow-down'}"></i></div>
                  <div class="finance-info">
                    <div class="f-label">${t.description || t.category || '—'}</div>
                    <div class="f-sub">${APP.formatDate(t.date)} · ${t.category || ''} ${t.eventId ? '· Event' : ''}</div>
                  </div>
                  <div class="finance-amount ${t.type}">${APP.formatUGX(t.amount)}</div>
                  <button class="btn-ghost" style="color:#c0392b" onclick="APP.deleteTransaction('${t.id}')"><i class="fas fa-trash-alt"></i></button>
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
    `;

    setTimeout(() => APP.renderFinanceChart(txns), 50);

  } catch(e) {
    el.innerHTML = `<p class="muted">Error loading finances: ${e.message}</p>`;
  }
};

APP.renderContributionsList = function(members, txns) {
  if (!members.length) return '<p class="muted" style="font-size:.82rem">No members.</p>';
  return members.map(m => {
    const memberTxns = txns.filter(t => t.memberId === m.id);
    const paid = memberTxns.filter(t => t.paid !== false).reduce((s,t) => s + (t.amount||0), 0);
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.04)">
        <div style="flex:1;font-size:.82rem;font-weight:500">${m.firstName} ${m.lastName}
          <span style="font-size:.7rem;color:var(--text-muted);font-weight:400"> · ${m.voice||''}</span>
        </div>
        <div style="font-family:var(--font-serif);color:var(--gold)">${APP.formatUGX(paid)}</div>
      </div>
    `;
  }).join('');
};

APP.saveTransaction = async function() {
  const desc     = document.getElementById('ft-desc').value.trim();
  const amount   = parseFloat(document.getElementById('ft-amount').value) || 0;
  const type     = document.getElementById('ft-type').value;
  const category = document.getElementById('ft-category').value;
  const date     = document.getElementById('ft-date').value;
  const memberId = document.getElementById('ft-member').value;
  const eventId  = document.getElementById('ft-event').value;

  if (!desc || !amount || !date) { APP.toast('Description, amount and date required', 'error'); return; }

  const data = {
    description: desc, amount, type, category,
    memberId: memberId || null,
    eventId: eventId || null,
    paid: true,
    date: firebase.firestore.Timestamp.fromDate(new Date(date)),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    const ref = await db.collection('transactions').add(data);
    APP.toast('Transaction saved', 'success');
    APP.pushUndo({ label: `Undo: ${type} ${APP.formatUGX(amount)}`, fn: async () => {
      await db.collection('transactions').doc(ref.id).delete();
      APP.loadFinances();
    }});
    APP.closeModal('modal-add-transaction');
    APP.loadFinances();
  } catch(e) {
    APP.toast('Error: ' + e.message, 'error');
  }
};

APP.saveContribution = async function() {
  const memberId = document.getElementById('fc-member').value;
  const amount   = parseFloat(document.getElementById('fc-amount').value) || APP.MONTHLY_CONTRIBUTION;
  const type     = document.getElementById('fc-type').value;
  const date     = document.getElementById('fc-date').value;
  const note     = document.getElementById('fc-note').value.trim();

  if (!memberId || !date) { APP.toast('Member and date required', 'error'); return; }

  const member = (APP._members || []).find(m => m.id === memberId);

  const data = {
    description: `${type === 'monthly' ? 'Monthly' : 'Event'} contribution — ${member?.firstName || ''} ${member?.lastName || ''}`,
    amount, type: 'income',
    category: type === 'monthly' ? 'monthly_contribution' : 'event_contribution',
    memberId, note, paid: true,
    date: firebase.firestore.Timestamp.fromDate(new Date(date)),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Also save to contributions collection for scoring
  const contData = { memberId, amount, type, paid: true,
    date: firebase.firestore.Timestamp.fromDate(new Date(date))
  };

  try {
    const batch = db.batch();
    const txRef  = db.collection('transactions').doc();
    const conRef = db.collection('contributions').doc();
    batch.set(txRef, data);
    batch.set(conRef, contData);
    await batch.commit();

    APP.toast('Contribution recorded', 'success');
    APP.pushUndo({ label: `Undo contribution: ${APP.formatUGX(amount)}`, fn: async () => {
      await Promise.all([txRef.delete(), conRef.delete()]);
      APP.loadFinances();
    }});
    APP.closeModal('modal-add-contribution');
    APP.loadFinances();
  } catch(e) {
    APP.toast('Error: ' + e.message, 'error');
  }
};

APP.deleteTransaction = async function(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    const snap = await db.collection('transactions').doc(id).get();
    const backup = snap.data();
    await db.collection('transactions').doc(id).delete();
    APP.toast('Transaction deleted', 'info');
    APP.pushUndo({ label: 'Restore transaction', fn: async () => {
      await db.collection('transactions').doc(id).set(backup);
      APP.loadFinances();
    }});
    APP.loadFinances();
  } catch(e) {
    APP.toast('Error', 'error');
  }
};

APP.exportFinanceCSV = function() {
  const rows = [['Date','Type','Category','Description','Amount (UGX)']];
  (APP._txns || []).forEach(t => {
    rows.push([APP.formatDate(t.date), t.type, t.category || '', t.description || '', t.amount || 0]);
  });
  APP.exportCSV(rows, 'chorale_finances.csv');
};

APP.printFinanceReport = function() {
  const rows = (APP._txns || []).map(t => `
    <tr>
      <td>${APP.formatDate(t.date)}</td>
      <td>${t.type}</td>
      <td>${t.category || '—'}</td>
      <td>${t.description || '—'}</td>
      <td class="${t.type === 'income' ? '' : ''}" style="color:${t.type==='income'?'#27ae60':'#c0392b'}">${APP.formatUGX(t.amount)}</td>
    </tr>
  `).join('');
  APP.printReport('Finance Report', `
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
};

APP.addEventTransaction = function(eventId) {
  APP.closeModal('modal-view-event');
  APP.openModal('modal-add-transaction');
  setTimeout(() => {
    const sel = document.getElementById('ft-event');
    if (sel) sel.value = eventId;
  }, 100);
};


// ── ANNOUNCEMENTS SECTION ─────────────────
APP.loadAnnouncementsSection = function() {
  const el = document.getElementById('view-announcements');
  if (!el) return;

  const canPost = APP.canEdit('announcements');

  el.innerHTML = `
    <div class="page-header">
      <div class="eyebrow">Communication</div>
      <h2>Notice <em>Board</em></h2>
      <div class="divider"></div>
      <div class="subtitle">Choir-wide announcements visible to all members</div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Announcements</h3>
        ${canPost ? '<span class="badge badge-green"><i class="fas fa-pen" style="margin-right:4px"></i>You can post</span>' : '<span class="badge badge-gray"><i class="fas fa-eye" style="margin-right:4px"></i>View only</span>'}
      </div>
      <div class="card-body">
        <div id="announcements-container">
          <div style="text-align:center;padding:20px">
            <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  APP.loadAnnouncements('announcements-container', canPost);
};

// Patch navigate to handle announcements + apply role locks
const _origNavigate = APP.navigate.bind(APP);
APP.navigate = function(section) {
  _origNavigate(section);

  if (section === 'announcements') {
    APP.loadAnnouncementsSection();
    return;
  }

  if (section === 'scores') {
    APP.loadScores();
    return;
  }

  if (section === 'notifications') {
    APP.loadNotificationsSection();
    return;
  }

  // Apply edit lock after section loads (slight delay for DOM)
  setTimeout(() => APP.applyEditLock(section), 400);
};

// Also patch loaders to apply locks after render
['loadMembers','loadAttendance','loadEvents','loadFinances'].forEach(fn => {
  const orig = APP[fn].bind(APP);
  APP[fn] = async function() {
    await orig();
    const sectionMap = {
      loadMembers: 'members', loadAttendance: 'attendance',
      loadEvents: 'events', loadFinances: 'finances'
    };
    setTimeout(() => APP.applyEditLock(sectionMap[fn]), 400);
  };
});
