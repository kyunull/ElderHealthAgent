# 🏥 Yinian Family Doctor

A comprehensive elderly health management web application. Features include health report management, medication tracking, CGA (Comprehensive Geriatric Assessment), cognitive screening, AI specialist consultations, and health trend analysis.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3 + Element Plus + ECharts + Vue Router + Axios |
| Backend | Express.js + SQLite (node:sqlite) |
| Auth | JWT + bcrypt |
| Build | Vite |

## Features

### 🏠 Dashboard
Overview of health data summary with quick access to all modules.

### 📋 Health Reports
- Upload biochemical & imaging reports (JPG/PNG/PDF)
- AI extraction of indicators and reference ranges
- Abnormal value highlighting and trend tracking
- Browse history by date and type

### 💊 Medication Management
- Drug name, dosage, frequency, schedule
- Drug interaction detection (A/B/C/D/X severity levels)
- Medication reminders (SMS/phone/app)

### 🩺 AI Specialist Consultation
- Single-specialty: Cardiology, Endocrinology, Gastroenterology, Nephrology, Neurology, Respiratory, Geriatrics, etc.
- Multi-Disciplinary Team (MDT): parallel analysis + integrated summary

### 📈 Health Trends
- Biochemical indicator trend charts (ECharts)
- Time-series comparison and anomaly alerts

### 👴 CGA (Comprehensive Geriatric Assessment)
- ADL / IADL functional assessment
- Frailty Scale
- Nutrition screening (MNA-SF)
- Depression screening (GDS)
- Fall risk assessment
- Polypharmacy flag
- Social support evaluation

### 🧠 Cognitive Screening
- MMSE / MoCA / Mini-Cog and more
- Education-adjusted scoring
- Informant questionnaire (AD8)
- CDR (Clinical Dementia Rating)
- Historical comparison and score change tracking
- AI-assisted analysis and follow-up recommendations

### 👤 Profile & ⚙️ Settings
- Basic info, allergies, health indicators
- System configuration, API key management

## Project Structure

```
yinian-family-doctor/
├── backend/                    # Express.js API server
│   └── src/
│       ├── server.js           # Entry point + routes
│       ├── database.js         # SQLite schema + migrations
│       ├── seed.js             # Seed data
│       ├── middleware/         # auth, error-handler
│       ├── routes/             # auth, reports, medications,
│       │                       # consultations, trends, cga,
│       │                       # cognitive, profile, settings,
│       │                       # reminders, asr
│       ├── services/           # AI data extraction
│       └── repositories/       # Data access layer
├── frontend/                   # Vue 3 SPA
│   └── src/
│       ├── router/index.js     # Routes + navigation guards
│       ├── api/index.js        # Axios + API layer
│       ├── views/              # Page components
│       └── components/         # Shared components
├── data/                       # SQLite DB + uploads (runtime)
├── .claude/                    # Claude Code commands/skills/specialists
├── docs/                       # Documentation
└── scripts/                    # Utility scripts
```

## Quick Start

### Prerequisites
- Node.js >= 18.0.0

### Start Backend
```bash
cd backend
npm install
npm run dev        # http://localhost:3000
```

### Start Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Seed Data (optional)
```bash
cd backend
npm run seed
```

## API Overview

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/auth/register` | POST | Register | — |
| `/api/auth/login` | POST | Login, returns JWT | — |
| `/api/reports/upload` | POST | Upload health report | JWT |
| `/api/reports` | GET | List reports | JWT |
| `/api/reports/:id` | GET | Report detail | JWT |
| `/api/medications` | GET/POST | List/add medications | JWT |
| `/api/medications/:id` | PUT/DELETE | Edit/stop medication | JWT |
| `/api/consultations` | POST | Start AI consultation | JWT |
| `/api/trends` | GET | Indicator trend data | JWT |
| `/api/cga-assessments` | GET/POST | CGA list/create | JWT |
| `/api/cognitive-screenings` | GET/POST | Screening list/create | JWT |
| `/api/profile` | GET/PUT | View/update profile | JWT |
| `/api/settings` | GET | System settings | JWT |
| `/api/reminders` | GET/POST | Reminder list/create | JWT |

## Safety Disclaimer

> ⚠️ **Disclaimer**: All AI analysis results are for reference only and do not constitute medical diagnosis. Consult healthcare professionals for all medical decisions. In case of emergency, seek immediate medical attention.

- Passwords hashed with bcrypt (12 rounds)
- JWT-based API authentication
- Local SQLite data storage
- UUID-based file naming to prevent path guessing

## License

[MIT](LICENSE)

---

**Maintainer**: [kyunull](https://github.com/kyunull)
