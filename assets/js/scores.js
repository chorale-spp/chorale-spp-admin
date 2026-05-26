// ============================================
// SCORES MODULE — GitHub + Firestore
// Files: stored in /scores/{step}/ in the repo
// Metadata: title + notes stored in Firestore
// Repo: chorale-spp/chorale-spp-admin
// ============================================

window.APP = window.APP || {};

const GITHUB_OWNER  = 'chorale-spp';
const GITHUB_REPO   = 'chorale-spp-admin';
const GITHUB_BRANCH = 'main';
const SCORES_BASE   = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/scores`;
const GITHUB_API    = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/scores`;

APP.MASS_STEPS = [
  'Entrance', 'Kyrie', 'Gloria', 'Gospel Acclamation',
  'Offertory', 'Sanctus', 'Agnus Dei', 'Communion',
  'Thanksgiving', 'Recessional'
];

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

// ── Fetch all PDFs from GitHub API for one step folder ──
APP.fetchStepFiles = async function(step) {
  const url = `${GITHUB_API}/${encodeURIComponent(step)}`;
  try {
    const res  = await fetch(url, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter(f => f.name.toLowerCase().endsWith('.pdf'))
      .map(f => ({
        filename:    f.name,
        downloadURL: `${SCORES_BASE}/${encodeURIComponent(step)}/${encodeURIComponent(f.name)}`,
        step,
        sha: f.sha
      }));
  } catch(e) {
    return [];
  }
};

// ── Fetch all scores across all steps ──
APP.fetchAllScoreFiles = async function() {
  const results = await Promise.all(
    APP.MASS_STEPS.map(step => APP.fetchStepFiles(step))
  );
  // Flatten
  return results.flat();
};

// ── Load Firestore metadata for all files ──
APP.fetchScoreMetadata = async function() {
  try {
    const snap = await db.collection('scores').get();
    const meta = {};
    snap.docs.forEach(d => {
      const data = d.data();
      // Key: step + filename
      meta[`${data.step}||${data.filename}`] = { id: d.id, ...data };
    });
    return meta;
  } catch(e) {
    return {};
  }
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
      <div class="subtitle">Stored in the repository · organised by the order of the Mass</div>
    </div>

    ${canEdit ? `
    <!-- Single upload via GitHub API -->
    <div class="card mb-28">
      <div class="card-header">
        <h3>Upload Score</h3>
        <span class="badge badge-gold"><i class="fas fa-lock" style="margin-right:4px"></i>Archivist / Director</span>
      </div>
      <div class="card-body">
        <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:16px;padding:10px 14px;background:rgba(184,151,58,0.06);border-radius:var(--radius);border-left:3px solid var(--gold)">
          <i class="fas fa-info-circle" style="margin-right:6px;color:var(--gold)"></i>
          For <strong>single files</strong>: use the form below. For <strong>bulk upload</strong> (many files at once): drag them directly into the GitHub repository folders — see the guide at the bottom of this page.
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
            <label>Display Title *</label>
            <input type="text" id="sc-title" placeholder="e.g. Missa de Angelis — Kyrie">
          </div>
        </div>
        <div class="form-group-sm">
          <label>Notes <span style="font-weight:400;color:var(--text-light)">(optional)</span></label>
          <input type="text" id="sc-notes" placeholder="e.g. Used every Sunday, learned March 2024">
        </div>
        <div class="form-group-sm">
          <label>PDF File *</label>
          <div id="sc-dropzone" style="border:2px dashed var(--border);border-radius:var(--radius);padding:28px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;background:var(--cream-light)"
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

        <!-- GitHub Token field -->
        <div class="form-group-sm">
          <label style="display:flex;align-items:center;justify-content:space-between">
            <span><i class="fas fa-key" style="margin-right:5px;color:var(--gold)"></i>GitHub Personal Access Token *</span>
            <a href="https://github.com/settings/tokens/new?scopes=repo&description=Chorale+Score+Upload" target="_blank" style="font-size:.65rem;color:var(--gold);display:inline-flex;align-items:center;gap:4px">
              <i class="fas fa-external-link-alt"></i> Generate token
            </a>
          </label>
          <input type="password" id="sc-token" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx">
          <div style="font-size:.68rem;color:var(--text-muted);margin-top:5px;line-height:1.5">
            <i class="fas fa-shield-alt" style="color:var(--gold);margin-right:3px"></i>
            Token is used only for this upload and never stored. Generate one with <strong>repo</strong> scope.
          </div>
        </div>

        <div id="sc-upload-progress" style="display:none;margin-top:12px">
          <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px" id="sc-progress-label">Uploading...</div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill" id="sc-progress-bar" style="width:0%;transition:width .3s"></div></div>
        </div>

        <button class="btn-primary" style="width:auto;padding:10px 22px;margin-top:14px" onclick="APP.uploadScore()">
          <i class="fas fa-cloud-upload-alt"></i> Upload to Repository
        </button>
      </div>
    </div>
    ` : ''}

    <!-- Search & filter -->
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="scores-search" placeholder="Search scores..." oninput="APP.renderAdminScoresList()">
      </div>
      <select id="scores-step-filter" onchange="APP.renderAdminScoresList()" style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none;background:white">
        <option value="">All Mass Steps</option>
        ${APP.MASS_STEPS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <button class="btn-ghost" onclick="APP.refreshScores()" title="Refresh from GitHub">
        <i class="fas fa-sync-alt"></i> Refresh
      </button>
    </div>

    <div id="scores-list">
      <div style="text-align:center;padding:40px">
        <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:12px">Reading scores from repository...</div>
      </div>
    </div>

    ${canEdit ? `
    <!-- Bulk upload guide -->
    <div class="card" style="margin-top:28px">
      <div class="card-header"><h3><i class="fas fa-books" style="margin-right:8px;color:var(--gold)"></i>Bulk Upload Guide</h3></div>
      <div class="card-body">
        <div style="font-size:.82rem;line-height:1.8;color:var(--text-main)">
          <div style="margin-bottom:12px;font-weight:600;font-size:.85rem">To upload many scores at once:</div>
          <ol style="list-style:decimal;padding-left:20px;display:flex;flex-direction:column;gap:10px">
            <li>Go to <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/main/scores" target="_blank" style="color:var(--gold);font-weight:600">your repository scores folder <i class="fas fa-external-link-alt" style="font-size:.7rem"></i></a></li>
            <li>Click the folder for the Mass step (e.g. <strong>Kyrie</strong>)</li>
            <li>Click <strong>Add file → Upload files</strong> in the top right</li>
            <li>Drag all your PDF files for that step into the upload area</li>
            <li>Scroll down and click <strong>Commit changes</strong></li>
            <li>Repeat for each Mass step folder</li>
            <li>Come back here and click <strong>Refresh</strong> — all files appear automatically</li>
            <li>Click <strong>Edit</strong> on any score to set its display title and notes</li>
          </ol>
          <div style="margin-top:16px;padding:10px 14px;background:rgba(184,151,58,0.06);border-radius:var(--radius);border-left:3px solid var(--gold);font-size:.78rem">
            <i class="fas fa-lightbulb" style="color:var(--gold);margin-right:4px"></i>
            <strong>Tip:</strong> Name your files clearly before uploading (e.g. <em>missa-de-angelis.pdf</em>). The filename becomes the default title — you can rename it in the portal afterwards.
          </div>
        </div>
      </div>
    </div>
    ` : ''}
  `;

  APP._selectedScoreFile = null;
  await APP.refreshScores();
};

// ── Refresh: fetch GitHub files + Firestore metadata ──
APP.refreshScores = async function() {
  const el = document.getElementById('scores-list');
  if (el) el.innerHTML = `<div style="text-align:center;padding:30px"><div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div><div style="font-size:.75rem;color:var(--text-muted);margin-top:10px">Reading repository...</div></div>`;

  try {
    const [files, meta] = await Promise.all([
      APP.fetchAllScoreFiles(),
      APP.fetchScoreMetadata()
    ]);

    // Merge file list with metadata
    APP._scores = files.map(f => {
      const key  = `${f.step}||${f.filename}`;
      const m    = meta[key] || {};
      return {
        ...f,
        metaId: m.id || null,
        title:  m.title || APP.filenameToTitle(f.filename),
        notes:  m.notes || ''
      };
    });

    APP.renderAdminScoresList();
  } catch(e) {
    if (el) el.innerHTML = `<p class="muted" style="padding:20px">Error reading repository. Make sure the repo is public and scores folders exist.</p>`;
  }
};

// ── Convert filename to readable title ──
APP.filenameToTitle = function(filename) {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

// ── Render admin scores list ──
APP.renderAdminScoresList = function() {
  const el     = document.getElementById('scores-list');
  if (!el) return;

  const search  = (document.getElementById('scores-search')?.value || '').toLowerCase();
  const filter  = document.getElementById('scores-step-filter')?.value || '';
  const canEdit = APP.canEdit('scores');

  const scores = (APP._scores || []).filter(s => {
    const matchSearch = !search ||
      s.title?.toLowerCase().includes(search) ||
      s.filename?.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search);
    const matchStep = !filter || s.step === filter;
    return matchSearch && matchStep;
  });

  if (!scores.length) {
    el.innerHTML = `<div style="text-align:center;padding:48px 20px">
      <i class="fas fa-music" style="font-size:2.5rem;color:var(--border);margin-bottom:14px;display:block"></i>
      <p class="muted">No scores found. Upload files to the repository folders.</p>
    </div>`;
    return;
  }

  // Group by step
  const grouped = {};
  APP.MASS_STEPS.forEach(s => { grouped[s] = []; });
  scores.forEach(s => { if (grouped[s.step]) grouped[s.step].push(s); });

  let html = '';
  let totalCount = 0;

  APP.MASS_STEPS.forEach(step => {
    const group = grouped[step];
    if (!group?.length) return;
    totalCount += group.length;
    const icon = APP.MASS_ICONS[step] || 'fa-music';

    html += `
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="width:34px;height:34px;border-radius:var(--radius);background:rgba(184,151,58,0.1);display:flex;align-items:center;justify-content:center;color:var(--gold);flex-shrink:0">
            <i class="fas ${icon}"></i>
          </div>
          <div>
            <div style="font-family:var(--font-serif);font-size:1.05rem;font-weight:500">${step}</div>
            <div style="font-size:.68rem;color:var(--text-muted)">${group.length} score${group.length>1?'s':''}</div>
          </div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Filename</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${group.map(s => `
                <tr id="score-row-${s.sha}">
                  <td>
                    <div style="font-weight:600;font-size:.85rem">${s.title}</div>
                    ${!s.metaId ? `<div style="font-size:.65rem;color:var(--text-light);margin-top:2px"><i class="fas fa-info-circle"></i> No custom title set</div>` : ''}
                  </td>
                  <td style="font-size:.75rem;color:var(--text-muted);font-family:monospace">${s.filename}</td>
                  <td style="font-size:.78rem;color:var(--text-muted);max-width:180px">${s.notes || '—'}</td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <a href="${s.downloadURL}" target="_blank" class="btn-ghost" title="View PDF" style="padding:5px 8px"><i class="fas fa-eye"></i></a>
                      <a href="${s.downloadURL}" download="${s.filename}" class="btn-ghost" title="Download" style="padding:5px 8px"><i class="fas fa-download"></i></a>
                      ${canEdit ? `<button class="btn-ghost" title="Edit title & notes" style="padding:5px 8px;color:var(--gold)" onclick="APP.openScoreEdit('${s.sha}')"><i class="fas fa-pencil-alt"></i></button>` : ''}
                    </div>
                  </td>
                </tr>
                <!-- Inline edit row (hidden) -->
                <tr id="score-edit-${s.sha}" style="display:none;background:rgba(184,151,58,0.04)">
                  <td colspan="4" style="padding:14px 16px">
                    <div class="form-row" style="margin-bottom:10px">
                      <div class="form-group-sm" style="margin-bottom:0">
                        <label>Display Title</label>
                        <input type="text" id="edit-title-${s.sha}" value="${s.title.replace(/"/g,'&quot;')}" placeholder="Display title">
                      </div>
                      <div class="form-group-sm" style="margin-bottom:0">
                        <label>Notes</label>
                        <input type="text" id="edit-notes-${s.sha}" value="${(s.notes||'').replace(/"/g,'&quot;')}" placeholder="Optional notes">
                      </div>
                    </div>
                    <div style="display:flex;gap:8px">
                      <button class="btn-primary" style="width:auto;padding:7px 16px;font-size:.72rem" onclick="APP.saveScoreMeta('${s.sha}','${s.step}','${s.filename}','${s.metaId||''}')">
                        <i class="fas fa-save"></i> Save
                      </button>
                      <button class="btn-ghost" onclick="APP.closeScoreEdit('${s.sha}')">Cancel</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  // Total count header
  el.innerHTML = `
    <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:16px;letter-spacing:.05em">
      <i class="fas fa-music" style="color:var(--gold);margin-right:6px"></i>
      ${totalCount} score${totalCount!==1?'s':''} in library
    </div>
    ${html}
  `;
};

// ── Inline edit open/close ──
APP.openScoreEdit = function(sha) {
  document.getElementById(`score-edit-${sha}`)?.style.setProperty('display','table-row');
};

APP.closeScoreEdit = function(sha) {
  document.getElementById(`score-edit-${sha}`)?.style.setProperty('display','none');
};

// ── Save score metadata to Firestore ──
APP.saveScoreMeta = async function(sha, step, filename, existingId) {
  const title = document.getElementById(`edit-title-${sha}`)?.value.trim();
  const notes = document.getElementById(`edit-notes-${sha}`)?.value.trim();

  if (!title) { APP.toast('Title cannot be empty', 'error'); return; }

  const data = {
    step, filename, title, notes,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (existingId) {
      await db.collection('scores').doc(existingId).update(data);
    } else {
      await db.collection('scores').add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // Update local cache
    const score = (APP._scores || []).find(s => s.sha === sha);
    if (score) { score.title = title; score.notes = notes; }

    APP.toast('Score updated', 'success');
    APP.closeScoreEdit(sha);
    APP.renderAdminScoresList();
  } catch(e) {
    APP.toast('Save failed: ' + e.message, 'error');
  }
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
    // Auto-fill title from filename if empty
    const titleEl = document.getElementById('sc-title');
    if (titleEl && !titleEl.value) {
      titleEl.value = APP.filenameToTitle(file.name);
    }
  }
};

// ── Single upload via GitHub API ──
APP.uploadScore = async function() {
  const step  = document.getElementById('sc-step')?.value;
  const title = document.getElementById('sc-title')?.value.trim();
  const notes = document.getElementById('sc-notes')?.value.trim();
  const token = document.getElementById('sc-token')?.value.trim();
  const file  = APP._selectedScoreFile;

  if (!step)  { APP.toast('Please select a Mass step', 'error'); return; }
  if (!title) { APP.toast('Please enter a display title', 'error'); return; }
  if (!file)  { APP.toast('Please select a PDF file', 'error'); return; }
  if (!token) { APP.toast('GitHub token is required for upload', 'error'); return; }

  const progressWrap = document.getElementById('sc-upload-progress');
  const progressBar  = document.getElementById('sc-progress-bar');
  const progressLbl  = document.getElementById('sc-progress-label');
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressBar)  progressBar.style.width = '30%';
  if (progressLbl)  progressLbl.textContent = 'Reading file...';

  try {
    // Read file as base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    if (progressBar) progressBar.style.width = '60%';
    if (progressLbl) progressLbl.textContent = 'Uploading to GitHub...';

    // Clean filename — no spaces, no special chars
    const cleanFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `scores/${step}/${cleanFilename}`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`;

    // Check if file already exists (need SHA for update)
    let existingSha = null;
    try {
      const checkRes = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        existingSha = existing.sha;
      }
    } catch(e) { /* file doesn't exist yet, that's fine */ }

    // Upload to GitHub
    const body = {
      message: `Add score: ${cleanFilename} (${step})`,
      content: base64,
      branch:  GITHUB_BRANCH
    };
    if (existingSha) body.sha = existingSha;

    const uploadRes = await fetch(apiUrl, {
      method:  'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err.message || 'GitHub upload failed');
    }

    if (progressBar) progressBar.style.width = '85%';
    if (progressLbl) progressLbl.textContent = 'Saving metadata...';

    // Save metadata to Firestore
    await db.collection('scores').add({
      step, filename: cleanFilename, title, notes,
      uploadedBy:   APP.currentUser?.uid || '',
      uploaderName: `${APP.currentUser?.firstName||''} ${APP.currentUser?.lastName||''}`.trim(),
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    });

    if (progressBar) progressBar.style.width = '100%';
    if (progressLbl) progressLbl.textContent = 'Upload complete!';

    APP.toast(`"${title}" uploaded successfully`, 'success');

    // Reset form
    setTimeout(async () => {
      if (progressWrap) progressWrap.style.display = 'none';
      if (progressBar)  progressBar.style.width = '0%';
      ['sc-title','sc-notes','sc-token'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      document.getElementById('sc-step').value = '';
      document.getElementById('sc-file-name').textContent = '';
      document.getElementById('sc-file').value = '';
      APP._selectedScoreFile = null;
      // Refresh list (wait a moment for GitHub to process)
      await APP.refreshScores();
    }, 1500);

  } catch(e) {
    if (progressWrap) progressWrap.style.display = 'none';
    APP.toast('Upload failed: ' + e.message, 'error');
    console.error('Upload error:', e);
  }
};

// ── MEMBER PORTAL: Load scores ──
APP.loadMemberScores = async function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `<div style="text-align:center;padding:30px">
    <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--gold);margin:auto"></div>
    <div style="font-size:.75rem;color:var(--text-muted);margin-top:10px">Loading scores...</div>
  </div>`;

  try {
    const [files, meta] = await Promise.all([
      APP.fetchAllScoreFiles(),
      APP.fetchScoreMetadata()
    ]);

    APP._memberScores = files.map(f => {
      const key = `${f.step}||${f.filename}`;
      const m   = meta[key] || {};
      return {
        ...f,
        title: m.title || APP.filenameToTitle(f.filename),
        notes: m.notes || ''
      };
    });

    if (!APP._memberScores.length) {
      el.innerHTML = `<div style="text-align:center;padding:48px 20px">
        <i class="fas fa-music" style="font-size:2.5rem;color:var(--border);margin-bottom:14px;display:block"></i>
        <p class="muted">No scores uploaded yet.</p>
      </div>`;
      return;
    }

    el.innerHTML = `
      <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" id="mb-scores-search" placeholder="Search scores..." oninput="APP.renderMemberScoresList()">
        </div>
        <select id="mb-scores-step" onchange="APP.renderMemberScoresList()"
          style="padding:9px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:.82rem;outline:none;background:white">
          <option value="">All Mass Steps</option>
          ${APP.MASS_STEPS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <div style="font-size:.72rem;color:var(--text-muted);margin-left:auto">
          <i class="fas fa-music" style="color:var(--gold);margin-right:4px"></i>
          ${APP._memberScores.length} scores
        </div>
      </div>
      <div id="mb-scores-list"></div>
    `;

    APP.renderMemberScoresList();

  } catch(e) {
    el.innerHTML = '<p class="muted">Error loading scores. Please try again.</p>';
    console.error(e);
  }
};

APP.renderMemberScoresList = function() {
  const el = document.getElementById('mb-scores-list');
  if (!el) return;

  const search = (document.getElementById('mb-scores-search')?.value || '').toLowerCase();
  const filter = document.getElementById('mb-scores-step')?.value || '';

  const scores = (APP._memberScores || []).filter(s => {
    const matchSearch = !search ||
      s.title?.toLowerCase().includes(search) ||
      s.notes?.toLowerCase().includes(search) ||
      s.filename?.toLowerCase().includes(search);
    return matchSearch && (!filter || s.step === filter);
  });

  if (!scores.length) {
    el.innerHTML = '<p class="muted" style="text-align:center;padding:30px">No scores match your search.</p>';
    return;
  }

  // Group by Mass step in liturgical order
  const grouped = {};
  APP.MASS_STEPS.forEach(s => { grouped[s] = []; });
  scores.forEach(s => { if (grouped[s.step]) grouped[s.step].push(s); });

  let html = '';
  APP.MASS_STEPS.forEach(step => {
    const group = grouped[step];
    if (!group?.length) return;
    const icon = APP.MASS_ICONS[step] || 'fa-music';

    html += `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">
          <div style="width:30px;height:30px;border-radius:var(--radius);background:rgba(184,151,58,0.1);display:flex;align-items:center;justify-content:center;color:var(--gold);flex-shrink:0;font-size:.8rem">
            <i class="fas ${icon}"></i>
          </div>
          <span style="font-family:var(--font-serif);font-size:1rem;font-weight:500">${step}</span>
          <span style="font-size:.68rem;color:var(--text-muted);background:var(--cream);padding:2px 8px;border-radius:10px">${group.length}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${group.map(s => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:white;border:1px solid var(--border);border-radius:var(--radius);transition:box-shadow .15s,transform .15s"
                 onmouseover="this.style.boxShadow='var(--shadow)';this.style.transform='translateY(-1px)'"
                 onmouseout="this.style.boxShadow='';this.style.transform=''">
              <div style="width:36px;height:44px;background:rgba(192,57,43,0.07);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(192,57,43,0.12)">
                <i class="fas fa-file-pdf" style="color:#c0392b;font-size:1rem"></i>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:.86rem;margin-bottom:2px">${s.title}</div>
                ${s.notes ? `<div style="font-size:.72rem;color:var(--text-muted)"><i class="fas fa-info-circle" style="margin-right:3px;color:var(--gold)"></i>${s.notes}</div>` : ''}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <a href="${s.downloadURL}" target="_blank" class="btn-secondary" style="padding:6px 12px;font-size:.7rem">
                  <i class="fas fa-eye"></i> View
                </a>
                <a href="${s.downloadURL}" download="${s.filename}" class="btn-ghost" style="padding:6px 10px" title="Download PDF">
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
