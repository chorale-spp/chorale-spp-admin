# Chorale Saint Padre Pio — Admin Portal

Internal management system for Chorale Saint Padre Pio.  
Built with Jekyll + Firebase, deployed on GitHub Pages.

---

## What this system does

- **Members** — full directory, SATB voice groups, roles, join dates, individual scores
- **Attendance** — rehearsal & event registers with performance ratings per session
- **Events** — calendar, budget breakdown by category, financial tracking per event
- **Finances** — all income/expenses, monthly contributions (UGX 5,000/member), reports
- **Scoring** — automatic member score out of 100 (Attendance 40 + Performance 35 + Finance 25)
- **Reports** — printable PDF and Excel CSV export for all sections
- **Undo** — every destructive action can be undone within 6 seconds

---

## Setup Instructions

### Step 1 — Create a Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `chorale-spp`
3. Disable Google Analytics (not needed) → **Create project**

### Step 2 — Enable Authentication

1. In Firebase Console → **Authentication** → **Get started**
2. Click **Email/Password** → Enable → **Save**
3. Go to **Users** tab → **Add user**
4. Add each leadership member's email and a temporary password
   - Music Director, Maestros, Treasurer, Secretary, Archivist, Discipline Director, Voice Responsables

### Step 3 — Enable Firestore

1. In Firebase Console → **Firestore Database** → **Create database**
2. Choose **Start in production mode** → select your region (e.g. `europe-west1`) → **Enable**
3. Go to **Rules** tab → paste the contents of `firestore.rules` → **Publish**

### Step 4 — Get your Firebase config

1. In Firebase Console → **Project Settings** (gear icon) → **Your apps**
2. Click **Add app** → Web (`</>`) → Register app (name: `chorale-spp-portal`)
3. Copy the `firebaseConfig` object shown

### Step 5 — Paste your config

Open `assets/js/firebase-init.js` and replace the placeholder values:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",          // ← your value
  authDomain:        "chorale-spp.firebaseapp.com",
  projectId:         "chorale-spp",
  storageBucket:     "chorale-spp.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

### Step 6 — Add images (optional but recommended)

Place these files in `assets/img/`:

| File | Purpose |
|------|---------|
| `logo.png` | Choir logo — shown in sidebar and login. Use the existing choir logo. |
| `hero-login.jpg` | Background image on the login page. Any choir photo works. |

> **The hero image can also be changed directly from the login page** using the small "Change hero image" link at the bottom right. The change is saved in the browser.

### Step 7 — Deploy to GitHub Pages

1. Create a new **private** repository on GitHub (e.g. `chorale-spp-admin`)
2. Push this entire folder to that repository:

```bash
git init
git add .
git commit -m "Initial portal setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/chorale-spp-admin.git
git push -u origin main
```

3. In GitHub → **Settings** → **Pages** → Source: **GitHub Actions**
4. The workflow in `.github/workflows/deploy.yml` will build and deploy automatically
5. Your portal will be live at: `https://YOUR_USERNAME.github.io/chorale-spp-admin/`

---

## How to use the system

### Adding members
1. Go to **Choir Members** → **Add Member**
2. Fill in name, voice, role, join date
3. Their score starts at 100 and adjusts as records are added

### Taking attendance
1. Go to **Attendance**
2. Select the date and session type (Rehearsal / Event / Meeting)
3. Mark each member: Present / Late / Absent
4. Optionally give a performance rating (this feeds the score)
5. Click **Save Register**

### Recording contributions
1. Go to **Finances** → **Record Contribution**
2. Select the member, choose Monthly or Event contribution
3. Enter the amount (monthly defaults to UGX 5,000)
4. Click **Record**

### Creating an event
1. Go to **Events** → **New Event**
2. Fill in title, date, venue, type, budget breakdown
3. Add transactions to the event from the event detail view

### Generating reports
- Every section has **Export** (CSV) and **Print** (PDF-ready) buttons
- Print opens a formatted print view — use your browser's print dialog to save as PDF

### Undoing a mistake
- After any add/edit/delete, an **Undo** banner appears at the bottom of the screen
- Click **Undo** within 6 seconds to reverse the action

---

## Member Scoring (out of 100)

| Component | Weight | How it's calculated |
|-----------|--------|---------------------|
| Attendance | 40 pts | Present=1pt, Late=0.5pt per session |
| Performance | 35 pts | Avg of ratings (Bad=0, Poor=1, Fair=2, Good=3, Excellent=4) |
| Financial | 25 pts | Monthly contributions paid on time |

Scores are recalculated live from the database records.

---

## Project structure

```
chorale-spp-admin/
├── index.html              ← Login page
├── dashboard.html          ← Main dashboard (all sections)
├── assets/
│   ├── css/
│   │   └── main.css        ← Full design system
│   ├── js/
│   │   ├── firebase-init.js ← Firebase config & auth (EDIT THIS)
│   │   ├── utils.js        ← Scoring, formatting, toasts, undo
│   │   └── sections.js     ← All 5 section views
│   └── img/
│       ├── logo.png        ← Choir logo (add this)
│       └── hero-login.jpg  ← Login hero image (add this)
├── firestore.rules         ← Copy to Firebase Console
├── _config.yml             ← Jekyll config
├── Gemfile
└── .github/
    └── workflows/
        └── deploy.yml      ← Auto-deploy to GitHub Pages
```

---

## Voice Responsables — granting performance access

All logged-in portal users can record performance ratings.  
Voice responsables rate their own section during or after rehearsal via the Attendance register.

---

## Support

For any issues with the portal, contact the Secretary / Admin.
