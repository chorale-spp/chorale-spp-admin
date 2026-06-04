// ============================================
// ABSENCE MESSAGING SYSTEM
// Member side: chat bubble UI
// Admin side: inbox + reply + approve/refuse
// ============================================

window.APP = window.APP || {};

// ── Constants ──
APP.ABSENCE_PENALTY_REFUSED  = 15; // points deducted
APP.ABSENCE_PENALTY_ACCEPTED = 5;  // points deducted
APP.REHEARSAL_TIME           = '17:15 arrival · 17:30 start';

// ── Generate upcoming activities for the picker ──
APP.generateUpcomingActivities = async function() {
  const activities = [];
  const now  = new Date();
  const days  = 56; // 8 weeks ahead

  for (let i = 0; i <= days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dow = d.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat

    // Tuesday rehearsal (dow=2)
    if (dow === 2) {
      activities.push({
        id:    `rehearsal-tue-${d.toISOString().split('T')[0]}`,
        label: `Rehearsal — Tuesday ${d.toLocaleDateString('en-GB',{day:'numeric',month:'long'})} (${APP.REHEARSAL_TIME})`,
        date:  d.toISOString().split('T')[0],
        type:  'rehearsal'
      });
    }

    // Thursday rehearsal (dow=4)
    if (dow === 4) {
      activities.push({
        id:    `rehearsal-thu-${d.toISOString().split('T')[0]}`,
        label: `Rehearsal — Thursday ${d.toLocaleDateString('en-GB',{day:'numeric',month:'long'})} (${APP.REHEARSAL_TIME})`,
        date:  d.toISOString().split('T')[0],
        type:  'rehearsal'
      });
    }

    // Last Sunday of month mass (dow=0)
    if (dow === 0) {
      const nextSun = new Date(d);
      nextSun.setDate(d.getDate() + 7);
      if (nextSun.getMonth() !== d.getMonth()) {
        activities.push({
          id:    `mass-${d.toISOString().split('T')[0]}`,
          label: `Sunday Mass — ${d.toLocaleDateString('en-GB',{day:'numeric',month:'long'})} (Last Sunday)`,
          date:  d.toISOString().split('T')[0],
          type:  'mass'
        });
      }
    }
  }

  // Also fetch events from Firestore
  try {
    const snap = await db.collection('events').get();
    const evNow = Date.now() / 1000;
    snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => (e.date?.seconds || 0) >= evNow - 86400)
      .sort((a,b) => (a.date?.seconds||0) - (b.date?.seconds||0))
      .forEach(e => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        activities.push({
          id:    `event-${e.id}`,
          label: `${e.type||'Event'} — ${e.title} (${d.toLocaleDateString('en-GB',{day:'numeric',month:'long'})})`,
          date:  d.toISOString().split('T')[0],
          type:  'event',
          eventId: e.id
        });
      });
  } catch(e) { /* silent */ }

  // Sort by date
  activities.sort((a,b) => a.date.localeCompare(b.date));

  return activities;
};

// ── FORMAT timestamp ──
APP.formatTime = function(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) +
    ' · ' + d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
};

// ============================================
// MEMBER SIDE — Absence messaging UI
// ============================================

APP.loadMemberAbsences = async function() {
  const el = document.getElementById('mb-view-absence');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div class="eyebrow">Notify</div>
      <h2>Absence <em>Notices</em></h2>
      <div class="divider"></div>
      <div class="subtitle">Send an absence notice and track its status.</div>
    </div>

    <!-- Compose box -->
    <div class="card mb-20" id="mb-absence-compose">
      <div class="card-header"><h3>Send Absence Notice</h3></div>
      <div class="card-body">
        <div class="form-group-sm">
          <label>Activity Missed *</label>
          <select id="abs-activity" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.83rem;outline:none;background:var(--cream-light)">
            <option value="">Loading activities...</option>
          </select>
        </div>
        <div class="form-group-sm">
          <label>Your Message / Reason *</label>
          <textarea id="abs-reason" rows="3"
            style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.83rem;resize:vertical;background:var(--cream-light);outline:none;transition:border-color .2s"
            placeholder="Explain your reason for absence..."></textarea>
        </div>
        <button class="btn-primary" style="width:auto;padding:10px 22px" onclick="APP.sendAbsenceNotice()">
          <i class="fas fa-paper-plane"></i> Send Notice
        </button>
      </div>
    </div>

    <!-- Thread list -->
    <div class="card">
      <div class="card-header">
        <h3>My Absence History</h3>
        <span class="badge badge-gray" id="mb-absence-count">—</span>
      </div>
      <div id="mb-absence-threads" style="min-height:80px">
        <div style="text-align:center;padding:30px">
          <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
        </div>
      </div>
    </div>

    <!-- Message thread modal -->
    <div class="modal-overlay" id="mb-absence-modal">
      <div class="modal" style="max-width:480px;display:flex;flex-direction:column;height:80vh">
        <div class="modal-header">
          <h3 id="mb-absence-modal-title">Absence Notice</h3>
          <button class="modal-close" onclick="APP.closeModal('mb-absence-modal')"><i class="fas fa-times"></i></button>
        </div>
        <div id="mb-absence-chat" style="flex:1;overflow-y:auto;padding:16px;background:var(--cream-light);display:flex;flex-direction:column;gap:10px"></div>
        <div style="padding:14px;border-top:1px solid var(--border);background:white">
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="mb-reply-input" placeholder="Add a message..."
              style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:20px;font-size:.83rem;outline:none"
              onkeydown="if(event.key==='Enter') APP.sendAbsenceReply()">
            <button class="btn-primary" style="width:auto;padding:10px 14px;border-radius:50%" onclick="APP.sendAbsenceReply()">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Populate activity picker
  const activities = await APP.generateUpcomingActivities();
  const sel = document.getElementById('abs-activity');
  sel.innerHTML = `<option value="">Select activity missed...</option>` +
    `<option value="other">Other (specify in message)</option>` +
    activities.map(a => `<option value="${a.id}" data-date="${a.date}" data-type="${a.type}" data-label="${a.label}">${a.label}</option>`).join('');

  // Load threads
  await APP.loadMemberAbsenceThreads();
};

APP.loadMemberAbsenceThreads = async function() {
  const el = document.getElementById('mb-absence-threads');
  if (!el) return;

  try {
    const uid  = APP.currentUser?.uid;
    const snap = await db.collection('absences')
      .where('memberId', '==', uid).get();

    const threads = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    const countEl = document.getElementById('mb-absence-count');
    if (countEl) countEl.textContent = threads.length;

    if (!threads.length) {
      el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:.82rem">
        No absence notices sent yet.
      </div>`;
      return;
    }

    el.innerHTML = threads.map(t => {
      const statusInfo = {
        pending:  { cls: 'badge-gold',  icon: 'fa-clock',      label: 'Pending' },
        accepted: { cls: 'badge-green', icon: 'fa-check-circle', label: 'Accepted' },
        refused:  { cls: 'badge-red',   icon: 'fa-times-circle', label: 'Refused' }
      };
      const s = statusInfo[t.status] || statusInfo.pending;

      return `
        <div onclick="APP.openMemberAbsenceThread('${t.id}')"
          style="display:flex;align-items:center;gap:12px;padding:14px 18px;
                 border-bottom:1px solid rgba(0,0,0,.04);cursor:pointer;transition:background .15s"
          onmouseover="this.style.background='rgba(184,151,58,0.04)'"
          onmouseout="this.style.background=''">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--dark);
                      display:flex;align-items:center;justify-content:center;
                      color:var(--gold-light);font-family:var(--font-serif);flex-shrink:0">
            <i class="fas fa-user-shield" style="font-size:.85rem"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:.84rem;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.activityLabel || t.activityType || 'Absence'}</div>
            <div style="font-size:.74rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.reason?.substring(0,60) || ''}${(t.reason?.length||0)>60?'…':''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
            <span class="badge ${s.cls}" style="font-size:.62rem"><i class="fas ${s.icon}" style="margin-right:3px"></i>${s.label}</span>
            <span style="font-size:.65rem;color:var(--text-light)">${APP.formatDate(t.createdAt)}</span>
          </div>
        </div>
      `;
    }).join('');

  } catch(e) {
    console.error('Load threads error:', e);
    document.getElementById('mb-absence-threads').innerHTML =
      '<p class="muted" style="padding:20px">Error loading absences.</p>';
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
    const ref = await db.collection('absences').add({
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
      messages: [{
        from:      'member',
        senderId:  u.uid,
        senderName: name,
        text:      reason,
        time:      new Date().toISOString()
      }],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    APP.toast('Absence notice sent', 'success');
    document.getElementById('abs-reason').value = '';
    sel.selectedIndex = 0;
    await APP.loadMemberAbsenceThreads();
    APP.openMemberAbsenceThread(ref.id);

  } catch(e) {
    APP.toast('Error: ' + e.message, 'error');
  }
};

APP.openMemberAbsenceThread = async function(absenceId) {
  APP._currentAbsenceId = absenceId;
  const snap = await db.collection('absences').doc(absenceId).get();
  if (!snap.exists) return;
  const t = { id: snap.id, ...snap.data() };

  document.getElementById('mb-absence-modal-title').textContent = t.activityLabel || 'Absence Notice';
  APP.renderAbsenceChat('mb-absence-chat', t, 'member');
  APP.openModal('mb-absence-modal');
};

APP.renderAbsenceChat = function(containerId, thread, viewAs) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const myId = APP.currentUser?.uid;
  const messages = thread.messages || [];

  const statusBanner = {
    pending:  { bg:'rgba(184,151,58,0.08)', border:'var(--gold)',  icon:'fa-clock',       text:'Pending admin review' },
    accepted: { bg:'rgba(39,174,96,0.08)',  border:'#27ae60',      icon:'fa-check-circle', text:'Excuse accepted' },
    refused:  { bg:'rgba(192,57,43,0.08)', border:'#c0392b',       icon:'fa-times-circle', text:'Excuse refused' }
  };
  const sb = statusBanner[thread.status] || statusBanner.pending;

  let html = `
    <!-- Activity info banner -->
    <div style="text-align:center;padding:10px 14px;background:white;border-radius:var(--radius);
                border:1px solid var(--border);margin-bottom:6px">
      <div style="font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">Activity Missed</div>
      <div style="font-weight:600;font-size:.84rem">${thread.activityLabel || thread.activityType}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${thread.activityDate || ''}</div>
    </div>

    <!-- Status badge -->
    <div style="text-align:center;margin-bottom:8px">
      <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;
                  background:${sb.bg};border:1px solid ${sb.border};border-radius:20px;
                  font-size:.72rem;font-weight:600;color:${sb.border}">
        <i class="fas ${sb.icon}"></i> ${sb.text}
        ${thread.scoreAdjusted ? `<span style="margin-left:4px;opacity:.7">· Score updated</span>` : ''}
      </div>
    </div>
  `;

  // Messages
  messages.forEach(m => {
    const isMe = viewAs === 'member' ? m.from === 'member' : m.from === 'admin';
    const bubbleColor = isMe
      ? 'background:var(--dark);color:white'
      : 'background:white;color:var(--text-main);border:1px solid var(--border)';
    const align = isMe ? 'flex-end' : 'flex-start';
    const timeColor = isMe ? 'rgba(255,255,255,.5)' : 'var(--text-light)';

    html += `
      <div style="display:flex;flex-direction:column;align-items:${align};gap:3px;max-width:85%${isMe?';align-self:flex-end':';align-self:flex-start'}">
        <div style="font-size:.65rem;color:var(--text-muted);padding:0 4px">${m.senderName || (m.from==='member'?'You':'Admin')}</div>
        <div style="padding:10px 14px;border-radius:${isMe?'16px 16px 4px 16px':'16px 16px 16px 4px'};
                    ${bubbleColor};font-size:.84rem;line-height:1.5;word-break:break-word">
          ${m.text}
        </div>
        <div style="font-size:.62rem;color:${timeColor};padding:0 4px">
          ${m.time ? new Date(m.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) + ' · ' + new Date(m.time).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : ''}
        </div>
      </div>
    `;
  });

  // Decision message if resolved
  if (thread.status !== 'pending' && thread.respondedAt) {
    const decisionText = thread.status === 'accepted'
      ? `Excuse accepted by ${thread.responderName || 'Admin'}. Score adjustment: -${APP.ABSENCE_PENALTY_ACCEPTED} pts.`
      : `Excuse refused by ${thread.responderName || 'Admin'}. Score adjustment: -${APP.ABSENCE_PENALTY_REFUSED} pts.`;
    html += `
      <div style="text-align:center;font-size:.72rem;color:var(--text-muted);
                  padding:8px 14px;background:rgba(0,0,0,.03);border-radius:var(--radius);margin-top:4px">
        <i class="fas fa-gavel" style="margin-right:4px"></i>${decisionText}
        <div style="font-size:.65rem;margin-top:2px">${APP.formatDate(thread.respondedAt)}</div>
      </div>
    `;
  }

  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
};

APP.sendAbsenceReply = async function() {
  const input   = document.getElementById('mb-reply-input');
  const text    = input?.value.trim();
  const absId   = APP._currentAbsenceId;
  if (!text || !absId) return;

  const u    = APP.currentUser;
  const name = `${u.firstName||''} ${u.lastName||''}`.trim();
  const isAdmin = APP._absenceViewAs === 'admin';

  const message = {
    from:       isAdmin ? 'admin' : 'member',
    senderId:   u.uid,
    senderName: name,
    text,
    time: new Date().toISOString()
  };

  try {
    await db.collection('absences').doc(absId).update({
      messages: firebase.firestore.FieldValue.arrayUnion(message),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (input) input.value = '';

    // Refresh chat
    const snap = await db.collection('absences').doc(absId).get();
    const t    = { id: snap.id, ...snap.data() };
    const chatId = isAdmin ? 'admin-absence-chat' : 'mb-absence-chat';
    APP.renderAbsenceChat(chatId, t, isAdmin ? 'admin' : 'member');

  } catch(e) {
    APP.toast('Error sending message: ' + e.message, 'error');
  }
};


// ============================================
// ADMIN SIDE — Absence Notices inbox
// ============================================

APP.loadAbsenceNotices = async function() {
  const el = document.getElementById('view-absences');
  if (!el) return;

  const u        = APP.currentUser;
  const canDecide = ['music_director','discipline_dir','discipline_vic'].includes(u?.role);

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
      <button class="btn-secondary" onclick="APP.exportAbsencesCSV()">
        <i class="fas fa-file-csv"></i> Export CSV
      </button>
      <button class="btn-secondary" onclick="APP.printAbsencesReport()">
        <i class="fas fa-print"></i> Print PDF
      </button>
    </div>

    <div class="grid-2">
      <!-- Thread list -->
      <div class="card" style="overflow:hidden">
        <div class="card-header">
          <h3>All Notices</h3>
          <span class="badge badge-gold" id="admin-abs-count">—</span>
        </div>
        <div id="admin-absence-list" style="max-height:600px;overflow-y:auto">
          <div style="text-align:center;padding:30px">
            <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
          </div>
        </div>
      </div>

      <!-- Thread detail -->
      <div class="card" id="admin-absence-detail" style="overflow:hidden;display:flex;flex-direction:column">
        <div class="card-header" id="admin-absence-detail-header">
          <h3 style="color:var(--text-muted)">Select a notice</h3>
        </div>
        <div id="admin-absence-chat"
          style="flex:1;min-height:300px;max-height:400px;overflow-y:auto;padding:16px;
                 background:var(--cream-light);display:flex;flex-direction:column;gap:10px">
          <div style="text-align:center;padding:30px;color:var(--text-muted);font-size:.82rem">
            Select a notice from the list to view the conversation.
          </div>
        </div>

        <!-- Reply + decision -->
        <div id="admin-reply-area" style="padding:14px;border-top:1px solid var(--border);display:none">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
            <input type="text" id="mb-reply-input" placeholder="Reply..."
              style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:20px;font-size:.83rem;outline:none"
              onkeydown="if(event.key==='Enter') APP.sendAbsenceReply()">
            <button class="btn-primary" style="width:auto;padding:10px 14px;border-radius:50%" onclick="APP.sendAbsenceReply()">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
          ${canDecide ? `
          <div style="display:flex;gap:8px" id="admin-decision-btns">
            <button class="btn-primary" style="width:auto;padding:8px 16px;flex:1;background:#27ae60;font-size:.75rem"
              onclick="APP.decideAbsence('accepted')">
              <i class="fas fa-check"></i> Accept Excuse
            </button>
            <button class="btn-danger" style="flex:1;font-size:.75rem;padding:8px 16px"
              onclick="APP.decideAbsence('refused')">
              <i class="fas fa-times"></i> Refuse Excuse
            </button>
          </div>
          ` : `
          <div style="font-size:.75rem;color:var(--text-muted);text-align:center;padding:4px">
            <i class="fas fa-info-circle" style="margin-right:4px"></i>Only the Discipline Director, Vice or Music Director can approve or refuse excuses.
          </div>
          `}
        </div>
      </div>
    </div>

    <!-- Absence records table -->
    <div class="card mt-16" style="margin-top:20px">
      <div class="card-header"><h3>Full Records</h3></div>
      <div class="card-body" style="padding:0" id="admin-absence-records">
        <div style="text-align:center;padding:20px">
          <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
        </div>
      </div>
    </div>
  `;

  APP._absenceViewAs = 'admin';
  await APP.renderAbsenceInbox();
};

APP.renderAbsenceInbox = async function() {
  const statusFilter = document.getElementById('abs-status-filter')?.value || '';
  const voiceFilter  = document.getElementById('abs-voice-filter')?.value  || '';

  try {
    const snap = await db.collection('absences').get();
    APP._allAbsences = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    let filtered = APP._allAbsences;
    if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter);
    if (voiceFilter)  filtered = filtered.filter(a => a.memberVoice === voiceFilter);

    const countEl = document.getElementById('admin-abs-count');
    if (countEl) countEl.textContent = filtered.length;

    const listEl = document.getElementById('admin-absence-list');
    if (!listEl) return;

    if (!filtered.length) {
      listEl.innerHTML = '<p class="muted" style="padding:20px;font-size:.82rem">No absence notices found.</p>';
      APP.renderAbsenceRecordsTable([]);
      return;
    }

    const statusInfo = {
      pending:  { cls:'badge-gold',  icon:'fa-clock',       label:'Pending' },
      accepted: { cls:'badge-green', icon:'fa-check-circle', label:'Accepted' },
      refused:  { cls:'badge-red',   icon:'fa-times-circle', label:'Refused' }
    };

    listEl.innerHTML = filtered.map(t => {
      const s = statusInfo[t.status] || statusInfo.pending;
      const unread = !t.adminRead;
      return `
        <div onclick="APP.openAdminAbsenceThread('${t.id}')"
          style="display:flex;align-items:center;gap:12px;padding:14px 16px;
                 border-bottom:1px solid rgba(0,0,0,.04);cursor:pointer;transition:background .15s;
                 ${unread?'background:rgba(184,151,58,0.04)':''}"
          onmouseover="this.style.background='rgba(184,151,58,0.06)'"
          onmouseout="this.style.background='${unread?'rgba(184,151,58,0.04)':''}'">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--dark);flex-shrink:0;
                      display:flex;align-items:center;justify-content:center;
                      color:var(--gold-light);font-family:var(--font-serif)">
            ${APP.initials(t.memberName||'?')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <span style="font-weight:600;font-size:.84rem">${t.memberName||'—'}</span>
              ${unread?'<span style="width:7px;height:7px;border-radius:50%;background:var(--gold);display:inline-block"></span>':''}
            </div>
            <div style="font-size:.74rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${t.activityLabel||t.activityType||'Absence'}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            <span class="badge ${s.cls}" style="font-size:.6rem"><i class="fas ${s.icon}" style="margin-right:2px"></i>${s.label}</span>
            <span style="font-size:.62rem;color:var(--text-light)">${APP.formatDate(t.createdAt)}</span>
          </div>
        </div>
      `;
    }).join('');

    APP.renderAbsenceRecordsTable(APP._allAbsences);

  } catch(e) {
    console.error(e);
    document.getElementById('admin-absence-list').innerHTML =
      '<p class="muted" style="padding:16px">Error loading absences.</p>';
  }
};

APP.openAdminAbsenceThread = async function(absenceId) {
  APP._currentAbsenceId = absenceId;
  APP._absenceViewAs    = 'admin';

  const snap = await db.collection('absences').doc(absenceId).get();
  if (!snap.exists) return;
  const t = { id: snap.id, ...snap.data() };

  // Mark as read by admin
  if (!t.adminRead) {
    db.collection('absences').doc(absenceId).update({ adminRead: true }).catch(()=>{});
  }

  // Update header
  const hdr = document.getElementById('admin-absence-detail-header');
  if (hdr) hdr.innerHTML = `
    <div>
      <h3>${t.memberName||'—'}</h3>
      <div style="font-size:.72rem;color:var(--text-muted)">${t.memberVoice||''} · ${t.activityLabel||''}</div>
    </div>
    <span class="badge ${t.status==='accepted'?'badge-green':t.status==='refused'?'badge-red':'badge-gold'}">
      ${t.status||'pending'}
    </span>
  `;

  // Render chat
  APP.renderAbsenceChat('admin-absence-chat', t, 'admin');

  // Show reply area
  const replyArea = document.getElementById('admin-reply-area');
  if (replyArea) replyArea.style.display = 'block';

  // Hide decision buttons if already decided
  const decBtns = document.getElementById('admin-decision-btns');
  if (decBtns) decBtns.style.display = t.status !== 'pending' ? 'none' : 'flex';
};

APP.decideAbsence = async function(decision) {
  const absId = APP._currentAbsenceId;
  if (!absId) return;

  const confirmed = confirm(`${decision === 'accepted' ? 'Accept' : 'Refuse'} this excuse? This will immediately update the member's score.`);
  if (!confirmed) return;

  const u    = APP.currentUser;
  const name = `${u.firstName||''} ${u.lastName||''}`.trim();

  try {
    const snap = await db.collection('absences').doc(absId).get();
    const t    = snap.data();
    if (!t) return;

    const penalty = decision === 'accepted' ? APP.ABSENCE_PENALTY_ACCEPTED : APP.ABSENCE_PENALTY_REFUSED;

    // Auto-reply message
    const autoMsg = {
      from:       'admin',
      senderId:   u.uid,
      senderName: name,
      text:       decision === 'accepted'
        ? `Your excuse has been accepted. A minimal deduction of ${penalty} points will be applied to your score. Thank you for notifying us.`
        : `Your excuse has been refused. An absence penalty of ${penalty} points will be applied to your score. Please ensure you attend all scheduled activities.`,
      time: new Date().toISOString()
    };

    // Update absence record
    await db.collection('absences').doc(absId).update({
      status:        decision,
      responderName: name,
      responderId:   u.uid,
      respondedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      scoreAdjusted: false,
      messages:      firebase.firestore.FieldValue.arrayUnion(autoMsg)
    });

    // Apply attendance record
    const actDate = t.activityDate ? firebase.firestore.Timestamp.fromDate(new Date(t.activityDate)) : firebase.firestore.Timestamp.now();
    await db.collection('attendance').add({
      memberId:   t.memberId,
      date:       actDate,
      type:       t.activityType || 'rehearsal',
      status:     'absent',
      excused:    decision === 'accepted',
      absenceId:  absId,
      createdAt:  firebase.firestore.FieldValue.serverTimestamp()
    });

    // Apply score penalty immediately
    const memberSnap = await db.collection('members').doc(t.memberId).get();
    if (memberSnap.exists) {
      const currentScore = memberSnap.data().score || 0;
      const newScore     = Math.max(0, currentScore - penalty);
      await db.collection('members').doc(t.memberId).update({
        score:     newScore,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // Mark score as adjusted
    await db.collection('absences').doc(absId).update({ scoreAdjusted: true });

    APP.toast(`Excuse ${decision}. Score updated.`, 'success');

    // Refresh
    await APP.openAdminAbsenceThread(absId);
    await APP.renderAbsenceInbox();

  } catch(e) {
    APP.toast('Error: ' + e.message, 'error');
    console.error(e);
  }
};

// ── Records table ──
APP.renderAbsenceRecordsTable = function(absences) {
  const el = document.getElementById('admin-absence-records');
  if (!el) return;

  if (!absences.length) {
    el.innerHTML = '<p class="muted" style="padding:20px;font-size:.82rem">No records yet.</p>';
    return;
  }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Member</th>
          <th>Voice</th>
          <th>Activity</th>
          <th>Date</th>
          <th>Submitted</th>
          <th>Status</th>
          <th>Decided By</th>
          <th>Decision Time</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        ${absences.map(a => `
          <tr>
            <td style="font-weight:500">${a.memberName||'—'}</td>
            <td><span class="badge badge-gold">${a.memberVoice||'—'}</span></td>
            <td style="font-size:.78rem;max-width:180px">${a.activityLabel||a.activityType||'—'}</td>
            <td style="font-size:.78rem">${a.activityDate||'—'}</td>
            <td style="font-size:.78rem">${APP.formatDate(a.createdAt)}</td>
            <td><span class="badge ${a.status==='accepted'?'badge-green':a.status==='refused'?'badge-red':'badge-gold'}">${a.status||'pending'}</span></td>
            <td style="font-size:.78rem">${a.responderName||'—'}</td>
            <td style="font-size:.78rem">${a.respondedAt ? APP.formatDate(a.respondedAt) : '—'}</td>
            <td style="font-size:.78rem">${a.scoreAdjusted ? `<span style="color:#c0392b">-${a.status==='accepted'?APP.ABSENCE_PENALTY_ACCEPTED:APP.ABSENCE_PENALTY_REFUSED} pts</span>` : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

// ── Export ──
APP.exportAbsencesCSV = function() {
  const rows = [['Member','Voice','Activity','Activity Date','Submitted','Status','Decided By','Decision Time','Score Penalty']];
  (APP._allAbsences || []).forEach(a => {
    rows.push([
      a.memberName||'', a.memberVoice||'', a.activityLabel||a.activityType||'',
      a.activityDate||'', APP.formatDate(a.createdAt), a.status||'pending',
      a.responderName||'', a.respondedAt ? APP.formatDate(a.respondedAt) : '',
      a.scoreAdjusted ? (a.status==='accepted'?`-${APP.ABSENCE_PENALTY_ACCEPTED}`:a.status==='refused'?`-${APP.ABSENCE_PENALTY_REFUSED}`:'') : ''
    ]);
  });
  APP.exportCSV(rows, 'absence_records.csv');
};

APP.printAbsencesReport = function() {
  const rows = (APP._allAbsences || []).map(a => `
    <tr>
      <td>${a.memberName||'—'}</td>
      <td>${a.memberVoice||'—'}</td>
      <td>${a.activityLabel||a.activityType||'—'}</td>
      <td>${a.activityDate||'—'}</td>
      <td>${APP.formatDate(a.createdAt)}</td>
      <td style="color:${a.status==='accepted'?'#27ae60':a.status==='refused'?'#c0392b':'#B8973A'}">${a.status||'pending'}</td>
      <td>${a.responderName||'—'}</td>
      <td>${a.respondedAt?APP.formatDate(a.respondedAt):'—'}</td>
      <td>${a.scoreAdjusted?(a.status==='accepted'?`-${APP.ABSENCE_PENALTY_ACCEPTED} pts`:`-${APP.ABSENCE_PENALTY_REFUSED} pts`):'—'}</td>
    </tr>
  `).join('');
  APP.printReport('Absence Records', `
    <table>
      <thead>
        <tr>
          <th>Member</th><th>Voice</th><th>Activity</th><th>Date</th>
          <th>Submitted</th><th>Status</th><th>Decided By</th><th>Decision Time</th><th>Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `);
};
