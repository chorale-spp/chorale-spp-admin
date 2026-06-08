// ============================================
// ROLE PERMISSIONS SYSTEM
// ============================================

window.APP = window.APP || {};

// ── Permission map ──
// Each section lists which roles can EDIT it.
// Music Director bypasses all checks.
// All admins can VIEW all sections.

APP.PERMISSIONS = {
  overview:      ['music_director','secretary','treasurer','archivist','maestro','discipline_dir','discipline_vic','voice_resp'],
  members:       ['music_director','secretary'],
  attendance:    ['music_director','discipline_dir','discipline_vic','voice_resp'],
  events:        ['music_director','secretary'],
  finances:      ['music_director','treasurer'],
  scores:        ['music_director','archivist'],
  announcements: ['music_director','secretary']
};

APP.canEdit = function(section) {
  const u = APP.currentUser;
  if (!u) return false;
  if (u.role === 'music_director') return true;
  return (APP.PERMISSIONS[section] || []).includes(u.role);
};

APP.canView = function(section) {
  const u = APP.currentUser;
  if (!u) return false;
  return true; // all admins can view all sections
};

// ── Apply lock overlays to a section ──
APP.applyEditLock = function(section) {
  if (APP.canEdit(section)) return;

  const view = document.getElementById(`view-${section}`);
  if (!view) return;

  // Disable action buttons
  view.querySelectorAll('.btn-primary, .btn-danger, .att-btn, [onclick*="save"], [onclick*="delete"], [onclick*="add"]').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.35';
    btn.style.cursor  = 'not-allowed';
    btn.title = 'You do not have permission to edit this section';
  });

  // Show read-only banner — but only if not already there
  if (!view.querySelector('.readonly-banner')) {
    const banner = document.createElement('div');
    banner.className = 'readonly-banner';
    banner.innerHTML = `<i class="fas fa-lock"></i> View only — editing requires the <strong>${APP.getSectionOwner(section)}</strong> role`;
    banner.style.cssText = `
      background: rgba(184,151,58,0.08);
      border: 1px solid rgba(184,151,58,0.25);
      border-radius: var(--radius);
      padding: 10px 16px;
      font-size: .78rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    `;
    view.insertBefore(banner, view.firstChild);
  }
};

APP.getSectionOwner = function(section) {
  const owners = {
    members:       'Secretary / Admin',
    attendance:    'Discipline Director or Voice Responsable',
    events:        'Secretary or Music Director',
    finances:      'Treasurer',
    scores:        'Archivist or Music Director',
    announcements: 'Secretary or Music Director'
  };
  return owners[section] || 'authorized admin';
};
