// ============================================
// ABSENCE SYSTEM
// ============================================

window.APP = window.APP || {};

APP.ABSENCE_PENALTY_ACCEPTED = 5;
APP.ABSENCE_PENALTY_REFUSED  = 15;
APP.REHEARSAL_TIME           = '17:15 arrival · 17:30 start';

// ── Generate upcoming activities ──
APP.generateUpcomingActivities = async function() {
  const activities = [];
  const now = new Date();

  for (let i = 0; i <= 56; i++) {
    const d   = new Date(now);
    d.setDate(now.getDate() + i);
    const dow = d.getDay();
    const dateStr = d.toISOString().split('T')[0];
    const dateLabel = d.toLocaleDateString('en-GB', { day:'numeric', month:'long' });

    if (dow === 2) activities.push({
      id: `rehearsal-tue-${dateStr}`, date: dateStr, type: 'rehearsal',
      label: `Rehearsal — Tuesday ${dateLabel} (${APP.REHEARSAL_TIME})`
    });
    if (dow === 4) activities.push({
      id: `rehearsal-thu-${dateStr}`, date: dateStr, type: 'rehearsal',
      label: `Rehearsal — Thursday ${dateLabel} (${APP.REHEARSAL_TIME})`
    });
    if (dow === 0) {
      const nextSun = new Date(d); nextSun.setDate(d.getDate() + 7);
      if (nextSun.getMonth() !== d.getMonth()) activities.push({
        id: `mass-${dateStr}`, date: dateStr, type: 'mass',
        label: `Sunday Mass — ${dateLabel} (Last Sunday)`
      });
    }
  }

  try {
    const snap = await db.collection('events').get();
    const nowSec = Date.now() / 1000;
    snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(e => (e.date?.seconds || 0) >= nowSec - 86400)
      .sort((a,b) => (a.date?.seconds||0) - (b.date?.seconds||0))
      .forEach(e => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        activities.push({
          id: `event-${e.id}`, date: d.toISOString().split('T')[0], type: 'event',
          label: `${e.type||'Event'} — ${e.title} (${d.toLocaleDateString('en-GB',{day:'numeric',month:'long'})})`
        });
      });
  } catch(e) { /* silent */ }

  activities.sort((a,b) => a.date.localeCompare(b.date));
  return activities;
};

// ============================================
// MEMBER SIDE
// ============================================

APP.loadMemberAbsences = async function() {
  const el = document.getElementById('mb-view-absence');
  if (!el) return;

  const activities = await APP.generateUpcomingActivities();

  el.innerHTML = `
    <div class="page-header">
      <div class="eyebrow">Notify</div>
      <h2>Absence <em>Notices</em></h2>
      <div class="divider"></div>
    </div>

    <div class="card mb-20">
      <div class="card-header"><h3>Send Absence Notice</h3></div>
      <div class="card-body">
        <div class="form-group-sm">
          <label>Activity Missed *</label>
          <select id="abs-activity" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.83rem;outline:none;background:var(--cream-light)">
            <option value="">Select activity missed...</option>
            <option value="other">Other (specify in message)</option>
            ${activities.map(a => `<option value="${a.id}" data-date="${a.date}" data-type="${a.type}" data-label="${a.label.replace(/"/g,'&quot;')}">${a.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group-sm">
          <label>Reason *</label>
          <textarea id="abs-reason" rows="3"
            style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.83rem;resize:vertical;background:var(--cream-light);outline:none"
            placeholder="Explain your reason for absence..."></textarea>
        </div>
        <button class="btn-primary" style="width:auto;padding:10px 22px" onclick="APP.sendAbsenceNotice()">
          <i class="fas fa-paper-plane"></i> Send Notice
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>My Absence History</h3>
        <span class="badge badge-gray" id="mb-absence-count">—</span>
      </div>
      <div id="mb-absence-list">
        <div style="text-align:center;padding:30px">
          <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
        </div>
      </div>
    </div>
  `;

  APP.loadMemberAbsenceList();
};

APP.loadMemberAbsenceList = async function() {
  const el  = document.getElementById('mb-absence-list');
  if (!el) return;
  const uid = APP.currentUser?.uid;

  try {
    const snap = await db.collection('absences').where('memberId','==',uid).get();
    const items = snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));

    const countEl = document.getElementById('mb-absence-count');
    if (countEl) countEl.textContent = items.length;

    if (!items.length) {
      el.innerHTML = '<p class="muted" style="padding:20px;font-size:.82rem">No absence notices sent yet.</p>';
      return;
    }

    const statusCls = { pending:'badge-gold', accepted:'badge-green', refused:'badge-red' };
    const statusIcon = { pending:'fa-clock', accepted:'fa-check-circle', refused:'fa-times-circle' };

    el.innerHTML = items.map(a => `
      <div style="padding:16px 18px;border-bottom:1px solid rgba(0,0,0,.05)">
        <div style="display:flex;align-items:start;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:.88rem;margin-bottom:4px">${a.activityLabel||a.activityType||'Absence'}</div>
            <div style="font-size:.82rem;color:var(--text-muted);line-height:1.5;margin-bottom:8px">${a.reason||''}</div>
            <div style="font-size:.7rem;color:var(--text-light)">
              <i class="fas fa-clock" style="margin-right:3px"></i>${APP.formatDate(a.createdAt)}
            </div>
            ${a.adminReply ? `
              <div style="margin-top:10px;padding:10px 12px;background:var(--cream);border-radius:var(--radius);border-left:3px solid var(--gold)">
                <div style="font-size:.68rem;color:var(--gold);font-weight:600;margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em">
                  <i class="fas fa-reply" style="margin-right:3px"></i>Admin Reply
                </div>
                <div style="font-size:.82rem;line-height:1.5">${a.adminReply}</div>
                <div style="font-size:.68rem;color:var(--text-light);margin-top:4px">${a.responderName||'Admin'} · ${APP.formatDate(a.respondedAt)}</div>
              </div>
            ` : ''}
          </div>
          <div style="flex-shrink:0">
            <span class="badge ${statusCls[a.status]||'badge-gold'}">
              <i class="fas ${statusIcon[a.status]||'fa-clock'}" style="margin-right:4px"></i>${a.status||'pending'}
            </span>
          </div>
        </div>
      </div>
    `).join('');

  } catch(e) {
    el.innerHTML = `<p class="muted" style="padding:20px;font-size:.82rem">Error loading absences: ${e.message}</p>`;
  }
};

APP.sendAbsenceNotice = async function() {
  const sel      = document.getElementById('abs-activity');
  const reason   = document.getElementById('abs-reason')?.value.trim();
  const actOpt   = sel?.options[sel.selectedIndex];
  const actId    = sel?.value;
  const actLabel = actOpt?.dataset?.label || actOpt?.text || '';
  const actDate  = actOpt?.dataset?.date  || '';
  const actType  = actOpt?.dataset?.type  || 'other';

  if (!actId)  { APP.toast('Please select the activity missed', 'error'); return; }
  if (!reason) { APP.toast('Please write a reason', 'error'); return; }

  const u    = APP.currentUser;
  const name = `${u.firstName||''} ${u.lastName||''}`.trim();

  try {
    await db.collection('absences').add({
      memberId:      u.uid,
      memberName:    name,
      memberVoice:   u.voice || '',
      activityId:    actId,
      activityLabel: actLabel,
      activityType:  actType,
      activityDate:  actDate,
      reason,
      status:        'pending',
      scoreAdjusted: false,
      adminReply:    null,
      createdAt:     firebase.firestore.FieldValue.serverTimestamp()
    });

    APP.toast('Absence notice sent', 'success');
    document.getElementById('abs-reason').value = '';
    sel.selectedIndex = 0;
    APP.loadMemberAbsenceList();

  } catch(e) {
    APP.toast('Error: ' + e.message, 'error');
  }
};

// ============================================
// ADMIN SIDE
// ============================================

APP.loadAbsenceNotices = async function() {
  const el = document.getElementById('view-absences');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div class="eyebrow">Inbox</div>
      <h2>Absence <em>Notices</em></h2>
      <div class="divider"></div>
    </div>

    <div class="actions-row" style="margin-bottom:20px">
      <select id="abs-status-filter" onchange="APP.renderAbsenceInbox()"
        style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none;background:white">
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="accepted">Accepted</option>
        <option value="refused">Refused</option>
      </select>
      <select id="abs-voice-filter" onchange="APP.renderAbsenceInbox()"
        style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none;background:white">
        <option value="">All Voices</option>
        ${APP.VOICES.map(v=>`<option value="${v}">${v}</option>`).join('')}
      </select>
      <button class="btn-ghost" onclick="APP.renderAbsenceInbox()">
        <i class="fas fa-sync-alt"></i> Refresh
      </button>
      <button class="btn-secondary" onclick="APP.exportAbsencesCSV()">
        <i class="fas fa-file-csv"></i> Export
      </button>
      <button class="btn-secondary" onclick="APP.printAbsencesReport()">
        <i class="fas fa-print"></i> Print
      </button>
    </div>

    <div id="admin-absence-cards">
      <div style="text-align:center;padding:40px">
        <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:12px">Loading absence notices...</div>
      </div>
    </div>
  `;

  APP.renderAbsenceInbox();
};

APP.renderAbsenceInbox = async function() {
  const statusFilter = document.getElementById('abs-status-filter')?.value || '';
  const voiceFilter  = document.getElementById('abs-voice-filter')?.value  || '';
  const el = document.getElementById('admin-absence-cards');
  if (!el) return;

  el.innerHTML = `<div style="text-align:center;padding:30px">
    <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
  </div>`;

  try {
    const snap = await db.collection('absences').get();

    APP._allAbsences = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    let list = APP._allAbsences;
    if (statusFilter) list = list.filter(a => a.status === statusFilter);
    if (voiceFilter)  list = list.filter(a => a.memberVoice === voiceFilter);

    if (!list.length) {
      el.innerHTML = `
        <div style="text-align:center;padding:60px 20px">
          <i class="fas fa-comment-medical" style="font-size:2.5rem;color:var(--border);margin-bottom:14px;display:block"></i>
          <p class="muted" style="font-size:.9rem">No absence notices found.</p>
        </div>`;
      return;
    }

    const statusCls  = { pending:'badge-gold',  accepted:'badge-green', refused:'badge-red' };
    const statusIcon = { pending:'fa-clock',     accepted:'fa-check-circle', refused:'fa-times-circle' };

    el.innerHTML = list.map(a => `
      <div style="background:white;border:1px solid var(--border);border-radius:var(--radius-lg);
                  margin-bottom:12px;overflow:hidden" id="abs-card-${a.id}">

        <!-- Member info row -->
        <div style="display:flex;align-items:center;gap:14px;padding:16px 18px;
                    border-bottom:1px solid rgba(0,0,0,.05)">
          <div style="width:42px;height:42px;border-radius:50%;background:var(--dark);flex-shrink:0;
                      display:flex;align-items:center;justify-content:center;
                      color:var(--gold-light);font-family:var(--font-serif);font-size:1rem">
            ${APP.initials(a.memberName||'?')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:.9rem">${a.memberName||'—'}
              <span style="font-weight:400;color:var(--text-muted);font-size:.78rem;margin-left:6px">${a.memberVoice||''}</span>
            </div>
            <div style="font-size:.75rem;color:var(--gold);margin-top:2px">${a.activityLabel||a.activityType||'—'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span style="font-size:.68rem;color:var(--text-light)">${APP.formatDate(a.createdAt)}</span>
            <span class="badge ${statusCls[a.status]||'badge-gold'}">
              <i class="fas ${statusIcon[a.status]||'fa-clock'}" style="margin-right:3px"></i>${a.status||'pending'}
            </span>
          </div>
        </div>

        <!-- Reason -->
        <div style="padding:14px 18px;${a.status!=='pending'?'border-bottom:1px solid rgba(0,0,0,.05)':''}">
          <div style="font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;
                      color:var(--text-muted);font-weight:600;margin-bottom:6px">Reason</div>
          <div style="font-size:.86rem;line-height:1.6;color:var(--text-main)">${a.reason||'—'}</div>
        </div>

        ${a.adminReply ? `
        <!-- Admin reply -->
        <div style="padding:12px 18px;background:var(--cream-light);border-bottom:1px solid rgba(0,0,0,.05)">
          <div style="font-size:.68rem;color:var(--gold);font-weight:600;margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em">
            <i class="fas fa-reply" style="margin-right:3px"></i>Your reply · ${a.responderName||'Admin'}
          </div>
          <div style="font-size:.84rem;line-height:1.5">${a.adminReply}</div>
        </div>
        ` : ''}

        ${a.status === 'pending' ? `
        <!-- Reply + Decision -->
        <div style="padding:14px 18px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="text" id="reply-${a.id}"
            placeholder="Optional reply message..."
            style="flex:1;min-width:160px;padding:9px 14px;border:1px solid var(--border);
                   border-radius:var(--radius);font-size:.82rem;outline:none;background:var(--cream-light)">
          <button title="Accept excuse" onclick="APP.decideAbsence('${a.id}','accepted')"
            style="width:38px;height:38px;border-radius:50%;background:#27ae60;color:white;
                   border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
                   font-size:1rem;flex-shrink:0;transition:background .2s"
            onmouseover="this.style.background='#1e8449'"
            onmouseout="this.style.background='#27ae60'">
            <i class="fas fa-check"></i>
          </button>
          <button title="Refuse excuse" onclick="APP.decideAbsence('${a.id}','refused')"
            style="width:38px;height:38px;border-radius:50%;background:#c0392b;color:white;
                   border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
                   font-size:1rem;flex-shrink:0;transition:background .2s"
            onmouseover="this.style.background='#a93226'"
            onmouseout="this.style.background='#c0392b'">
            <i class="fas fa-times"></i>
          </button>
        </div>
        ` : `
        <!-- Score info -->
        <div style="padding:10px 18px;font-size:.74rem;color:var(--text-muted)">
          <i class="fas fa-info-circle" style="margin-right:4px;color:var(--gold)"></i>
          Score adjusted: ${a.scoreAdjusted
            ? `-${a.status==='accepted'?APP.ABSENCE_PENALTY_ACCEPTED:APP.ABSENCE_PENALTY_REFUSED} pts`
            : 'Pending'}
          ${a.respondedAt ? ` · ${APP.formatDate(a.respondedAt)}` : ''}
        </div>
        `}
      </div>
    `).join('');

  } catch(e) {
    console.error('renderAbsenceInbox error:', e);
    el.innerHTML = `
      <div style="padding:24px">
        <p style="color:#c0392b;font-weight:600;margin-bottom:8px">
          <i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>Could not load absences
        </p>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:6px">${e.message}</p>
        <p style="font-size:.78rem;color:var(--text-muted)">
          Make sure the Firestore rules are published in Firebase Console → Firestore → Rules.
        </p>
        <button class="btn-secondary" style="margin-top:12px" onclick="APP.renderAbsenceInbox()">
          <i class="fas fa-sync-alt"></i> Try again
        </button>
      </div>`;
  }
};

APP.decideAbsence = async function(absId, decision) {
  const reply    = document.getElementById(`reply-${absId}`)?.value.trim() || '';
  const u        = APP.currentUser;
  const name     = `${u.firstName||''} ${u.lastName||''}`.trim();
  const penalty  = decision === 'accepted' ? APP.ABSENCE_PENALTY_ACCEPTED : APP.ABSENCE_PENALTY_REFUSED;
  const autoReply = reply || (decision === 'accepted'
    ? `Your excuse has been accepted. A deduction of ${penalty} points has been applied to your score.`
    : `Your excuse has been refused. A penalty of ${penalty} points has been applied to your score.`);

  try {
    // Get absence data
    const snap = await db.collection('absences').doc(absId).get();
    const a    = snap.data();
    if (!a) return;

    // Update absence
    await db.collection('absences').doc(absId).update({
      status:        decision,
      adminReply:    autoReply,
      responderName: name,
      responderId:   u.uid,
      respondedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      scoreAdjusted: false
    });

    // Add attendance record
    const actDate = a.activityDate
      ? firebase.firestore.Timestamp.fromDate(new Date(a.activityDate))
      : firebase.firestore.Timestamp.now();

    await db.collection('attendance').add({
      memberId:  a.memberId,
      date:      actDate,
      type:      a.activityType || 'rehearsal',
      status:    'absent',
      excused:   decision === 'accepted',
      absenceId: absId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Apply score penalty
    const memberSnap = await db.collection('members').doc(a.memberId).get();
    if (memberSnap.exists) {
      const current  = memberSnap.data().score || 0;
      const newScore = Math.max(0, current - penalty);
      await db.collection('members').doc(a.memberId).update({ score: newScore });
    }

    // Mark score adjusted
    await db.collection('absences').doc(absId).update({ scoreAdjusted: true });

    APP.toast(`Excuse ${decision}. Score updated.`, 'success');
    APP.renderAbsenceInbox();

  } catch(e) {
    APP.toast('Error: ' + e.message, 'error');
    console.error(e);
  }
};

// ── Poll pending badge ──
APP.pollPendingAbsences = async function() {
  try {
    const snap  = await db.collection('absences').where('status','==','pending').get();
    const badge = document.getElementById('abs-pending-badge');
    if (!badge) return;
    if (snap.size > 0) {
      badge.textContent = snap.size > 9 ? '9+' : snap.size;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch(e) { /* silent */ }
};

// ── Exports ──
APP.exportAbsencesCSV = function() {
  const rows = [['Member','Voice','Activity','Date','Submitted','Status','Reply','Decided By','Score Penalty']];
  (APP._allAbsences||[]).forEach(a => rows.push([
    a.memberName||'', a.memberVoice||'', a.activityLabel||'',
    a.activityDate||'', APP.formatDate(a.createdAt), a.status||'pending',
    a.adminReply||'', a.responderName||'',
    a.scoreAdjusted ? `-${a.status==='accepted'?APP.ABSENCE_PENALTY_ACCEPTED:APP.ABSENCE_PENALTY_REFUSED}` : ''
  ]));
  APP.exportCSV(rows, 'absence_records.csv');
};

APP.printAbsencesReport = function() {
  const rows = (APP._allAbsences||[]).map(a => `
    <tr>
      <td>${a.memberName||'—'}</td><td>${a.memberVoice||'—'}</td>
      <td>${a.activityLabel||'—'}</td><td>${a.activityDate||'—'}</td>
      <td>${APP.formatDate(a.createdAt)}</td>
      <td style="color:${a.status==='accepted'?'#27ae60':a.status==='refused'?'#c0392b':'#B8973A'}">${a.status||'pending'}</td>
      <td>${a.responderName||'—'}</td>
      <td>${a.respondedAt?APP.formatDate(a.respondedAt):'—'}</td>
      <td>${a.scoreAdjusted?`-${a.status==='accepted'?APP.ABSENCE_PENALTY_ACCEPTED:APP.ABSENCE_PENALTY_REFUSED} pts`:'—'}</td>
    </tr>`).join('');
  APP.printReport('Absence Records', `
    <table>
      <thead><tr><th>Member</th><th>Voice</th><th>Activity</th><th>Date</th>
        <th>Submitted</th><th>Status</th><th>Decided By</th><th>Decision Time</th><th>Score</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
};
