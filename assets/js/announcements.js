// ============================================
// ANNOUNCEMENTS MODULE
// Shared between admin and member portals
// ============================================

window.APP = window.APP || {};

// ── Load announcements (used by both portals) ──
APP.loadAnnouncements = async function(containerId, canPost) {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    // Fetch without orderBy to avoid requiring a Firestore index
    // Sort client-side instead
    const snap = await db.collection('announcements').limit(50).get();

    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });

    let html = '';

    if (canPost) {
      html += `
        <div style="margin-bottom:20px">
          <div class="form-group-sm">
            <label>New Announcement</label>
            <input type="text" id="ann-title" placeholder="Title" style="margin-bottom:8px">
          </div>
          <div class="form-group-sm">
            <textarea id="ann-body" rows="3" placeholder="Write your announcement here..."
              style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.83rem;resize:vertical;background:var(--cream-light);outline:none"></textarea>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <select id="ann-type" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:.8rem;outline:none;background:white">
              <option value="general">General</option>
              <option value="rehearsal">Rehearsal</option>
              <option value="event">Event</option>
              <option value="urgent">Urgent</option>
            </select>
            <button class="btn-primary" style="width:auto;padding:9px 18px" onclick="APP.postAnnouncement()">
              <i class="fas fa-paper-plane"></i> Post
            </button>
          </div>
        </div>
        <div class="divider-h"></div>
      `;
    }

    if (items.length === 0) {
      html += `<p class="muted" style="font-size:.82rem;margin-top:14px">No announcements yet.</p>`;
    } else {
      html += items.map(a => {
        const typeColors = {
          urgent:   { bg: 'rgba(192,57,43,0.08)',  border: '#c0392b', badge: 'badge-red' },
          rehearsal:{ bg: 'rgba(52,152,219,0.08)', border: '#3498db', badge: 'badge-blue' },
          event:    { bg: 'rgba(184,151,58,0.08)', border: '#B8973A', badge: 'badge-gold' },
          general:  { bg: 'rgba(0,0,0,0.03)',       border: 'var(--border)', badge: 'badge-gray' }
        };
        const style = typeColors[a.type] || typeColors.general;

        return `
          <div style="border-left:3px solid ${style.border};background:${style.bg};border-radius:0 var(--radius) var(--radius) 0;padding:14px 16px;margin-bottom:12px;position:relative">
            <div style="display:flex;align-items:start;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div>
                <div style="font-weight:600;font-size:.9rem;margin-bottom:4px">${a.title}</div>
                <div style="font-size:.82rem;line-height:1.5;color:var(--text-main)">${a.body}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
                <span class="badge ${style.badge}">${a.type}</span>
                ${canPost ? `<button class="btn-ghost" style="color:#c0392b;padding:4px 8px;font-size:.7rem" onclick="APP.deleteAnnouncement('${a.id}')"><i class="fas fa-trash-alt"></i></button>` : ''}
              </div>
            </div>
            <div style="font-size:.68rem;color:var(--text-light);margin-top:8px">
              <i class="fas fa-user" style="margin-right:4px"></i>${a.authorName || 'Admin'}
              &nbsp;·&nbsp;
              <i class="fas fa-clock" style="margin-right:4px"></i>${APP.formatDate(a.createdAt)}
            </div>
          </div>
        `;
      }).join('');
    }

    el.innerHTML = html;

  } catch(e) {
    if (el) el.innerHTML = `<p class="muted" style="font-size:.82rem">Error loading announcements.</p>`;
    console.error('Announcements error:', e);
  }
};

APP.postAnnouncement = async function() {
  const title = document.getElementById('ann-title')?.value.trim();
  const body  = document.getElementById('ann-body')?.value.trim();
  const type  = document.getElementById('ann-type')?.value || 'general';

  if (!title || !body) { APP.toast('Title and message required', 'error'); return; }

  const u = APP.currentUser;
  const authorName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : 'Admin';

  try {
    const ref = await db.collection('announcements').add({
      title, body, type, authorName,
      authorId: u?.uid || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    APP.toast('Announcement posted', 'success');
    APP.pushUndo({ label: `Undo: post "${title}"`, fn: async () => {
      await db.collection('announcements').doc(ref.id).delete();
      APP.loadAnnouncements('announcements-container', APP.canEdit('announcements'));
    }});

    document.getElementById('ann-title').value = '';
    document.getElementById('ann-body').value  = '';
    APP.loadAnnouncements('announcements-container', APP.canEdit('announcements'));

  } catch(e) {
    APP.toast('Error: ' + e.message, 'error');
  }
};

APP.deleteAnnouncement = async function(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    const snap   = await db.collection('announcements').doc(id).get();
    const backup = snap.data();
    await db.collection('announcements').doc(id).delete();
    APP.toast('Announcement deleted', 'info');
    APP.pushUndo({ label: 'Restore announcement', fn: async () => {
      await db.collection('announcements').doc(id).set(backup);
      APP.loadAnnouncements('announcements-container', APP.canEdit('announcements'));
    }});
    APP.loadAnnouncements('announcements-container', APP.canEdit('announcements'));
  } catch(e) {
    APP.toast('Error', 'error');
  }
};
