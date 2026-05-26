// ============================================
// ROLE PERMISSIONS SYSTEM
// ============================================

window.APP = window.APP || {};

// ── Permission map ──
// Each section lists which roles can EDIT it.
// Music Director bypasses all checks.
// All admins can VIEW overview.

APP.PERMISSIONS = {
  overview:      ['music_director','secretary','treasurer','archivist','maestro','discipline_dir','discipline_vic','voice_resp'],
  members:       ['music_director','secretary'],
  attendance:    ['music_director','discipline_dir','discipline_vic','voice_resp'],
  events:        ['music_director','secretary'],
  finances:      ['music_director','treasurer'],
  scores:        ['music_director','archivist'],
  announcements: ['music_director','secretary']
};

// Sections where non-permitted admins can still VIEW but not edit
APP.VIEW_ONLY_SECTIONS = ['overview','members','attendance','events','finances'];

APP.canEdit = function(section) {
  const u = APP.currentUser;
  if (!u) return false;
  if (u.role === 'music_director') return true;
  return (APP.PERMISSIONS[section] || []).includes(u.role);
};

APP.canView = function(section) {
  const u = APP.currentUser;
  if (!u) return false;
  if (u.role === 'music_director') return true;
  // All admins can view all sections
  return true;
};

// Apply lock overlays to a section's action buttons
APP.applyEditLock = function(section) {
  if (APP.canEdit(section)) return;

  // Disable all action buttons in the section
  const view = document.getElementById(`view-${section}`);
  if (!view) return;

  // Hide add/save/delete buttons
  view.querySelectorAll('.btn-primary, .btn-danger, .att-btn, [onclick*="save"], [onclick*="delete"], [onclick*="add"]').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.35';
    btn.style.cursor = 'not-allowed';
    btn.title = 'You do not have permission to edit this section';
  });

  // Show a read-only banner
  const existing = view.querySelector('.readonly-banner');
  if (!existing) {
    const banner = document.createElement('div');
    banner.className = 'readonly-banner';
    banner.innerHTML = `<i class="fas fa-lock"></i> View only — editing this section requires the <strong>${APP.getSectionOwner(section)}</strong> role`;
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
    members:    'Secretary / Admin',
    attendance: 'Discipline Director or Voice Responsable',
    events:     'Secretary or Music Director',
    finances:   'Treasurer',
    scores:     'Archivist or Music Director'
  };
  return owners[section] || 'authorized admin';
};
