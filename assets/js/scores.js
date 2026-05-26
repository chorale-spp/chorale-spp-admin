// ============================================
// SCORES MODULE
// Used by both admin portal (upload/manage)
// and member portal (view/download)
// ============================================

window.APP = window.APP || {};

APP.MASS_STEPS = [
  'Entrance',
  'Kyrie',
  'Gloria',
  'Gospel Acclamation',
  'Offertory',
  'Sanctus',
  'Agnus Dei',
  'Communion',
  'Thanksgiving',
  'Recessional'
];

// Icons for each step
APP.MASS_ICONS = {
  'Entrance':           'fa-door-open',
  'Kyrie':              'fa-praying-hands',
  'Gloria':             'fa-sun',
  'Gospel Acclamation': 'fa-book-open',
  'Offertory':          'fa-gift',
  'Sanctus':            'fa-star',
  'Agnus Dei':          'fa-dove',
  'Communion':          'fa-bread-slice',
  'Thanksgiving':       'fa-heart',
  'Recessional':        'fa-walking'
};

// ── ADMIN: Load Scores Section ──
APP.loadScores = async function() {
  const el = document.getElementById('view-scores');
  if (!el) return;

  const canEdit = APP.canEdit('scores');

  el.innerHTML = `
    <div class="page-header">
      <div class="eyebrow">Library</div>
      <h2>Music <em>Scores</em></h2>
      <div class="divider"></div>
      <div class="subtitle">Organised by the order of the Mass</div>
    </div>

    ${canEdit ? `
    <div class="card mb-28" id="scores-upload-card">
      <div class="card-header">
        <h3>Upload New Score</h3>
        <span class="badge badge-gold"><i class="fas fa-lock" style="margin-right:4px"></i>Archivist / Director</span>
      </div>
      <div class="card-body">
        <div class="form-row">
          <div class="form-group-sm">
            <label>Title *</label>
            <input type="text" id="sc-title" placeholder="e.g. Missa de Angelis — Kyrie">
          </div>
          <div class="form-group-sm">
            <label>Composer</label>
            <input type="text" id="sc-composer" placeholder="e.g. Gregorian Chant">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group-sm">
            <label>Mass Step *</label>
            <select id="sc-step">
              <option value="">Select step</option>
              ${APP.MASS_STEPS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group-sm">
            <label>Occasion / Event</label>
            <input type="text" id="sc-occasion" placeholder="e.g. Christmas, Easter, Every Sunday">
          </div>
        </div>
        <div class="form-group-sm">
          <label>Notes</label>
          <input type="text" id="sc-notes" placeholder="Any extra information for the choir...">
        </div>
        <div class="form-group-sm">
          <label>PDF File *</label>
          <div id="sc-dropzone" style="
            border: 2px dashed var(--border);
            border-radius: var(--radius);
            padding: 28px;
            text-align: center;
            cursor: pointer;
            transition: border-color .2s, background .2s;
            background: var(--cream-light);
          "
          onclick="document.getElementById('sc-file').click()"
          ondragover="APP.scoreDragOver(event)"
          ondragleave="APP.scoreDragLeave(event)"
          ondrop="APP.scoreDrop(event)">
            <i class="fas fa-file-pdf" style="font-size:2rem;color:var(--gold);margin-bottom:10px;display:block"></i>
            <div style="font-size:.82rem;color:var(--text-muted)">Drop PDF here or <span style="color:var(--gold);font-weight:600">click to browse</span></div>
            <div id="sc-file-name" style="font-size:.78rem;color:var(--gold);margin-top:8px;font-weight:500"></div>
          </div>
          <input type="file" id="sc-file" accept=".pdf" style="display:none" onchange="APP.scoreFileSelected(event)">
        </div>
        <div id="sc-upload-progress" style="display:none;margin-top:12px">
          <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px" id="sc-progress-label">Uploading...</div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" id="sc-progress-bar" style="width:0%;transition:width .3s"></div>
          </div>
        </div>
        <button class="btn-primary" style="width:auto;padding:10px 22px;margin-top:14px" onclick="APP.uploadScore()">
          <i class="fas fa-cloud-upload-alt"></i> Upload Score
        </button>
      </div>
    </div>
    ` : ''}

    <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="scores-search" placeholder="Search scores..." oninput="APP.renderScoresList()">
      </div>
      <select id="scores-step-filter" onchange="APP.renderScoresList()" style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none;background:white">
        <option value="">All Steps</option>
        ${APP.MASS_STEPS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>

    <div id="scores-list">
      <div style="text-align:center;padding:40px">
        <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
      </div>
    </div>
  `;

  APP._selectedScoreFile = null;
  await APP.fetchAndRenderScores();
};

// ── Drag and drop ──
APP.scoreDragOver = function(e) {
  e.preventDefault();
  const dz = document.getElementById('sc-dropzone');
  if (dz) { dz.style.borderColor = 'var(--gold)'; dz.style.background = 'rgba(184,151,58,0.06)'; }
};

APP.scoreDragLeave = function(e) {
  const dz = document.getElementById('sc-dropzone');
  if (dz) { dz.style.borderColor = ''; dz.style.background = 'var(--cream-light)'; }
};

APP.scoreDrop = function(e) {
  e.preventDefault();
  APP.scoreDragLeave(e);
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    APP._selectedScoreFile = file;
    document.getElementById('sc-file-name').textContent = file.name;
  } else {
    APP.toast('Please drop a PDF file', 'error');
  }
};

APP.scoreFileSelected = function(e) {
  const file = e.target.files[0];
  if (file) {
    APP._selectedScoreFile = file;
    document.getElementById('sc-file-name').textContent = file.name;
  }
};

// ── Upload score ──
APP.uploadScore = async function() {
  const title    = document.getElementById('sc-title')?.value.trim();
  const composer = document.getElementById('sc-composer')?.value.trim();
  const step     = document.getElementById('sc-step')?.value;
  const occasion = document.getElementById('sc-occasion')?.value.trim();
  const notes    = document.getElementById('sc-notes')?.value.trim();
  const file     = APP._selectedScoreFile;

  if (!title)  { APP.toast('Title is required', 'error'); return; }
  if (!step)   { APP.toast('Please select a Mass step', 'error'); return; }
  if (!file)   { APP.toast('Please select a PDF file', 'error'); return; }

  // Show progress
  const progressWrap = document.getElementById('sc-upload-progress');
  const progressBar  = document.getElementById('sc-progress-bar');
  const progressLbl  = document.getElementById('sc-progress-label');
  if (progressWrap) progressWrap.style.display = 'block';

  try {
    // Upload to Firebase Storage
    const storage  = firebase.storage();
    const fileName = `scores/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const ref      = storage.ref(fileName);
    const task     = ref.put(file);

    // Track progress
    await new Promise((resolve, reject) => {
      task.on('state_changed',
        snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressLbl) progressLbl.textContent = `Uploading... ${pct}%`;
        },
        reject,
        resolve
      );
    });

    const downloadURL = await ref.getDownloadURL();

    // Save metadata to Firestore
    const docRef = await db.collection('scores').add({
      title, composer, step, occasion, notes,
      fileName: file.name,
      fileSize: file.size,
      storagePath: fileName,
      downloadURL,
      uploadedBy: APP.currentUser?.uid || '',
      uploaderName: `${APP.currentUser?.firstName || ''} ${APP.currentUser?.lastName || ''}`.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (progressLbl) progressLbl.textContent = 'Upload complete!';
    APP.toast(`"${title}" uploaded successfully`, 'success');

    APP.pushUndo({ label: `Undo upload: "${title}"`, fn: async () => {
      await Promise.all([
        db.collection('scores').doc(docRef.id).delete(),
        storage.ref(fileName).delete()
      ]);
      APP.fetchAndRenderScores();
      APP.toast('Score upload undone', 'info');
    }});

    // Reset form
    setTimeout(() => {
      if (progressWrap) progressWrap.style.display = 'none';
      if (progressBar)  progressBar.style.width = '0%';
      document.getElementById('sc-title').value    = '';
      document.getElementById('sc-composer').value = '';
      document.getElementById('sc-step').value     = '';
      document.getElementById('sc-occasion').value = '';
      document.getElementById('sc-notes').value    = '';
      document.getElementById('sc-file-name').textContent = '';
      document.getElementById('sc-file').value     = '';
      APP._selectedScoreFile = null;
    }, 1500);

    await APP.fetchAndRenderScores();

  } catch(e) {
    if (progressWrap) progressWrap.style.display = 'none';
    APP.toast('Upload failed: ' + e.message, 'error');
    console.error('Upload error:', e);
  }
};

// ── Fetch all scores and cache ──
APP.fetchAndRenderScores = async function() {
  try {
    const snap = await db.collection('scores').orderBy('createdAt', 'desc').get();
    APP._scores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    APP.renderScoresList();
  } catch(e) {
    const el = document.getElementById('scores-list');
    if (el) el.innerHTML = '<p class="muted" style="padding:20px">Error loading scores. Check Firebase Storage is enabled.</p>';
  }
};

// ── Render scores grouped by Mass step ──
APP.renderScoresList = function() {
  const el     = document.getElementById('scores-list');
  if (!el) return;

  const search = (document.getElementById('scores-search')?.value || '').toLowerCase();
  const filter = document.getElementById('scores-step-filter')?.value || '';
  const canEdit = APP.canEdit ? APP.canEdit('scores') : false;

  let scores = (APP._scores || []).filter(s => {
    const matchSearch = !search ||
      s.title?.toLowerCase().includes(search) ||
      s.composer?.toLowerCase().includes(search) ||
      s.occasion?.toLowerCase().includes(search);
    const matchStep = !filter || s.step === filter;
    return matchSearch && matchStep;
  });

  if (!scores.length) {
    el.innerHTML = `<div style="text-align:center;padding:48px 20px">
      <i class="fas fa-music" style="font-size:2.5rem;color:var(--border);margin-bottom:14px;display:block"></i>
      <p class="muted" style="font-size:.9rem">No scores found.</p>
    </div>`;
    return;
  }

  // Group by Mass step in order
  const grouped = {};
  APP.MASS_STEPS.forEach(s => { grouped[s] = []; });
  scores.forEach(s => {
    if (grouped[s.step]) grouped[s.step].push(s);
    else grouped['Other'] = grouped['Other'] || [], grouped['Other'].push(s);
  });

  let html = '';
  APP.MASS_STEPS.forEach(step => {
    if (!grouped[step]?.length) return;
    const icon = APP.MASS_ICONS[step] || 'fa-music';

    html += `
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="width:34px;height:34px;border-radius:var(--radius);background:rgba(184,151,58,0.1);display:flex;align-items:center;justify-content:center;color:var(--gold);flex-shrink:0">
            <i class="fas ${icon}"></i>
          </div>
          <div>
            <div style="font-family:var(--font-serif);font-size:1.05rem;font-weight:500">${step}</div>
            <div style="font-size:.68rem;color:var(--text-muted);letter-spacing:.08em">${grouped[step].length} score${grouped[step].length>1?'s':''}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
          ${grouped[step].map(s => APP.renderScoreCard(s, canEdit)).join('')}
        </div>
      </div>
    `;
  });

  el.innerHTML = html;
};

APP.renderScoreCard = function(s, canEdit) {
  const sizeKB = s.fileSize ? Math.round(s.fileSize / 1024) : null;

  return `
    <div style="background:white;border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;display:flex;flex-direction:column;gap:10px;transition:box-shadow .2s,transform .2s" 
         onmouseover="this.style.boxShadow='var(--shadow)';this.style.transform='translateY(-2px)'"
         onmouseout="this.style.boxShadow='';this.style.transform=''">
      <div style="display:flex;align-items:start;gap:10px">
        <div style="width:40px;height:48px;background:rgba(192,57,43,0.08);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(192,57,43,0.15)">
          <i class="fas fa-file-pdf" style="color:#c0392b;font-size:1.1rem"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.88rem;line-height:1.3;margin-bottom:3px">${s.title}</div>
          ${s.composer ? `<div style="font-size:.73rem;color:var(--text-muted);font-style:italic">${s.composer}</div>` : ''}
          ${s.occasion ? `<div style="font-size:.7rem;color:var(--gold);margin-top:3px"><i class="fas fa-tag" style="margin-right:3px"></i>${s.occasion}</div>` : ''}
        </div>
      </div>
      ${s.notes ? `<div style="font-size:.75rem;color:var(--text-muted);line-height:1.4;padding:8px 10px;background:var(--cream-light);border-radius:4px"><i class="fas fa-info-circle" style="margin-right:4px;color:var(--gold)"></i>${s.notes}</div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
        <div style="font-size:.68rem;color:var(--text-light)">
          ${sizeKB ? `${sizeKB} KB · ` : ''}${APP.formatDate(s.createdAt)}
        </div>
        <div style="display:flex;gap:6px">
          <a href="${s.downloadURL}" target="_blank" class="btn-secondary" style="padding:6px 12px;font-size:.68rem" title="View PDF">
            <i class="fas fa-eye"></i> View
          </a>
          <a href="${s.downloadURL}" download="${s.fileName || s.title+'.pdf'}" class="btn-ghost" style="padding:6px 10px" title="Download">
            <i class="fas fa-download"></i>
          </a>
          ${canEdit ? `<button class="btn-ghost" style="padding:6px 10px;color:#c0392b" onclick="APP.deleteScore('${s.id}','${s.storagePath}')" title="Delete"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>
      </div>
    </div>
  `;
};

// ── Delete score ──
APP.deleteScore = async function(id, storagePath) {
  if (!confirm('Delete this score? This cannot be undone easily.')) return;
  try {
    const snap   = await db.collection('scores').doc(id).get();
    const backup = snap.data();

    await db.collection('scores').doc(id).delete();

    // Delete from Storage
    try {
      await firebase.storage().ref(storagePath).delete();
    } catch(e) {
      console.warn('Storage delete failed (file may already be gone):', e);
    }

    APP.toast('Score deleted', 'info');
    APP.pushUndo({ label: `Restore "${backup.title}"`, fn: async () => {
      await db.collection('scores').doc(id).set(backup);
      APP.toast('Score restored in library (file must be re-uploaded)', 'info');
      APP.fetchAndRenderScores();
    }});

    APP._scores = (APP._scores || []).filter(s => s.id !== id);
    APP.renderScoresList();
  } catch(e) {
    APP.toast('Delete failed: ' + e.message, 'error');
  }
};

// ── MEMBER PORTAL: Load scores ──
APP.loadMemberScores = async function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `<div style="text-align:center;padding:30px"><div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div></div>`;

  try {
    const snap = await db.collection('scores').orderBy('createdAt','desc').get();
    APP._scores = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!APP._scores.length) {
      el.innerHTML = `<div style="text-align:center;padding:48px 20px">
        <i class="fas fa-music" style="font-size:2.5rem;color:var(--border);margin-bottom:14px;display:block"></i>
        <p class="muted">No scores uploaded yet.</p>
      </div>`;
      return;
    }

    // Search + filter bar
    el.innerHTML = `
      <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" id="mb-scores-search" placeholder="Search scores..." oninput="APP.renderMemberScoresList()">
        </div>
        <select id="mb-scores-step" onchange="APP.renderMemberScoresList()" style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none;background:white">
          <option value="">All Mass Steps</option>
          ${APP.MASS_STEPS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div id="mb-scores-list"></div>
    `;

    APP.renderMemberScoresList();

  } catch(e) {
    el.innerHTML = '<p class="muted">Error loading scores.</p>';
  }
};

APP.renderMemberScoresList = function() {
  const el     = document.getElementById('mb-scores-list');
  if (!el) return;

  const search = (document.getElementById('mb-scores-search')?.value || '').toLowerCase();
  const filter = document.getElementById('mb-scores-step')?.value || '';

  const scores = (APP._scores || []).filter(s => {
    const matchSearch = !search ||
      s.title?.toLowerCase().includes(search) ||
      s.composer?.toLowerCase().includes(search) ||
      s.occasion?.toLowerCase().includes(search);
    const matchStep = !filter || s.step === filter;
    return matchSearch && matchStep;
  });

  if (!scores.length) {
    el.innerHTML = '<p class="muted" style="text-align:center;padding:30px">No scores match your search.</p>';
    return;
  }

  // Group by Mass step
  const grouped = {};
  APP.MASS_STEPS.forEach(s => { grouped[s] = []; });
  scores.forEach(s => { if (grouped[s.step]) grouped[s.step].push(s); });

  let html = '';
  APP.MASS_STEPS.forEach(step => {
    if (!grouped[step]?.length) return;
    const icon = APP.MASS_ICONS[step] || 'fa-music';
    html += `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">
          <i class="fas ${icon}" style="color:var(--gold);width:16px;text-align:center"></i>
          <span style="font-family:var(--font-serif);font-size:1rem;font-weight:500">${step}</span>
          <span style="font-size:.68rem;color:var(--text-muted)">${grouped[step].length} score${grouped[step].length>1?'s':''}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${grouped[step].map(s => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:white;border:1px solid var(--border);border-radius:var(--radius);transition:box-shadow .15s"
                 onmouseover="this.style.boxShadow='var(--shadow)'"
                 onmouseout="this.style.boxShadow=''">
              <div style="width:36px;height:42px;background:rgba(192,57,43,0.08);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(192,57,43,0.12)">
                <i class="fas fa-file-pdf" style="color:#c0392b"></i>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:.86rem">${s.title}</div>
                <div style="font-size:.72rem;color:var(--text-muted)">
                  ${s.composer ? `<em>${s.composer}</em>` : ''}
                  ${s.occasion ? ` · <span style="color:var(--gold)">${s.occasion}</span>` : ''}
                </div>
                ${s.notes ? `<div style="font-size:.7rem;color:var(--text-muted);margin-top:3px">${s.notes}</div>` : ''}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <a href="${s.downloadURL}" target="_blank" class="btn-secondary" style="padding:6px 12px;font-size:.7rem">
                  <i class="fas fa-eye"></i> View
                </a>
                <a href="${s.downloadURL}" download="${s.fileName||s.title+'.pdf'}" class="btn-ghost" style="padding:6px 10px" title="Download">
                  <i class="fas fa-download"></i>
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  el.innerHTML = html;
};
