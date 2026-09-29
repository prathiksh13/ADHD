# PS5 ADHD-LSTM — Professional Frontend Development Plan

## 1. Project Goal

Build a professional neuroscience/research platform for the PS5 ADHD-LSTM project.

The frontend should clearly communicate the complete research workflow:

**EEG Input → Processing → Experiment → Model → Analysis → Result**

The system should support the current offline public-dataset workflow and be designed so a future live EEG device can be integrated without rebuilding the frontend.

---

# 2. Recommended Frontend Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts
- React Hook Form
- Zod
- Lucide Icons

### Future real-time EEG

```text
Next.js
   ↕
WebSocket
   ↕
FastAPI
```

---

# 3. Product Structure

Use **one application with role-based portals** rather than separate websites.

```text
                 NEURO PLATFORM
                       │
           ┌───────────┼───────────┐
           │           │           │
      Participant    Doctor    Researcher
        Portal       Portal       Portal
```

For the participant side, use **Participant / Guardian Portal** rather than only "Patient Portal", since the project concerns children.

---

# 4. Design Direction

## Visual Style

The interface should feel:

- Professional
- Calm
- Scientific
- Modern
- Trustworthy
- Research-oriented

### Suggested visual system

```text
Background:      very light gray / white
Primary:         deep teal / green
Secondary:       soft blue
Accent:          muted purple
Text:            dark charcoal
Cards:           white
Borders:         subtle gray
```

### Avoid

- Neon colors
- Excessive gradients
- Excessive animations
- Huge rounded cards everywhere
- Fake medical-looking illustrations
- Generic dark dashboard styling
- Unnecessary decorative elements

---

# 5. Navigation

Use a left sidebar for logged-in portals.

```text
┌──────────────────────────────────────────────────────┐
│ Logo                                  Profile        │
├───────────────┬──────────────────────────────────────┤
│ Dashboard     │                                      │
│ Participants  │          PAGE CONTENT                │
│ EEG Sessions  │                                      │
│ Experiments   │                                      │
│ Analysis      │                                      │
│ Models        │                                      │
│ Reports       │                                      │
│               │                                      │
│ Settings      │                                      │
└───────────────┴──────────────────────────────────────┘
```

Public pages should use a normal top navigation.

---

# 6. Public Pages

## `/`

### Landing Page

Sections:

1. Hero
2. What is the project?
3. How EEG analysis works
4. Research workflow
5. Model architecture
6. Why temporal EEG matters
7. Research disclaimer
8. Login / Get Started

Suggested hero:

> **EEG-Based Analysis of Neurological State Changes Associated with ADHD**

Subtext:

> A research platform for analyzing EEG time-series patterns using deep learning.

Avoid diagnostic claims such as "Diagnose ADHD with 95% accuracy."

---

## `/about`

Explain:

- ADHD research problem
- EEG
- Temporal analysis
- LSTM
- CNN-LSTM
- Behavioral information
- Future live EEG

---

## `/research`

Show the research methodology:

```text
Dataset
  ↓
Preprocessing
  ↓
Feature Extraction
  ↓
Time-Series Construction
  ↓
LSTM / CNN-LSTM
  ↓
Evaluation
  ↓
Interpretation
```

This page should be useful during project demonstrations.

---

# 7. Authentication

## `/login`

Fields:

- Email
- Password
- Role
- Login

## `/register`

Participant/Guardian registration can be separated from researcher accounts.

---

# 8. Participant / Guardian Portal

## `/participant/dashboard`

Keep the dashboard simple and task-focused.

Suggested cards:

```text
Welcome

Current Session
───────────────
Not started

EEG Status
──────────
Not connected

Previous Sessions
───────────────
3

Latest Result
──────────────
Available
```

---

## `/participant/eeg`

Main EEG input screen.

```text
┌──────────────────────┐
│ Upload EEG Dataset   │
│ .edf / .bdf / etc.  │
└──────────────────────┘

            OR

┌──────────────────────┐
│ Connect EEG Device   │
│ Future Live Mode     │
└──────────────────────┘
```

Current version:

- Upload EEG dataset
- Validate file
- Show metadata

Future version:

- Connect EEG device
- Show device status

---

## `/participant/experiment`

Focused experiment screen rather than another dashboard.

Possible stages:

```text
REST
  ↓
TASK / CPT
  ↓
POST-TASK
```

Display:

- Current task
- Timer
- Stimulus
- Response button
- EEG recording status
- Current stage

---

## `/participant/live`

Future live-EEG interface.

Display:

- Device connection status
- Live EEG waveforms
- Channels
- Recording timer
- Sampling information
- Current experiment

Future flow:

```text
EEG Device
     ↓
BrainFlow / SDK
     ↓
FastAPI
     ↓
WebSocket
     ↓
Next.js
```

---

## `/participant/session/:id/processing`

Show actual processing states.

```text
EEG Uploaded                    ✓
       ↓
Preprocessing                  ✓
       ↓
Artifact Handling              ✓
       ↓
Frequency Extraction           ✓
       ↓
Time-Series Construction       ✓
       ↓
Model Inference               ✓
       ↓
Result                         ✓
```

The UI should be driven by backend state. Do not fake progress percentages.

---

## `/participant/session/:id/results`

Main model output page.

Example structure:

```text
Model Analysis
───────────────
Model Output
ADHD-associated pattern

Model probability: 72%

Research output, not diagnosis
```

EEG summary:

- O1 Beta
- O2 Beta
- Theta
- Alpha
- Important temporal regions

Use language such as **Model Output**, **Classification Probability**, and **Research Screening Result** rather than a clinical diagnosis.

---

## `/participant/history`

Show:

- Previous sessions
- Date
- Experiment
- Model output
- Session status

---

# 9. Doctor / Clinician Portal

## `/doctor/dashboard`

Suggested overview cards:

```text
Participants
Active Sessions
Completed Assessments
Flagged / Review Sessions
```

Include a recent sessions table.

---

## `/doctor/participants`

Participant table:

| ID | Age | Sessions | Last Session | Status |
|---|---:|---:|---|---|
| P001 | 9 | 3 | Sep 22 | Complete |
| P002 | 11 | 1 | Sep 21 | Review |

Use participant IDs where possible in the prototype.

---

## `/doctor/participants/[id]`

Use tabs instead of too many separate screens:

- Overview
- EEG
- Behavior
- Sessions
- Model Results
- Reports

Overview holds the record, signal quality, latest model output, processing trace, the session table
(`#sessions`) and the model-output panel (`#model-results`). EEG, Behavior and Reports are their own
routes; Sessions and Model Results anchor into Overview because the plan gives them no separate
screen. All five share `ParticipantShell` for the header, breadcrumb and tab bar.

---

## `/doctor/participants/[id]/eeg`

Main EEG analytics screen.

Show:

- Raw / processed waveform
- Channel selector
- Delta / Theta / Alpha / Beta power
- Optional Gamma
- Spectrogram
- Time-series plots
- O1 / O2 analysis
- Important features

---

## `/doctor/participants/[id]/behavior`

Display behavioral information where available:

- Reaction time
- Correct responses
- Incorrect responses
- Missed targets
- Task score
- Experiment condition
- Time-aligned events

This supports:

```text
EEG only
Behavior only
EEG + Behavior
```

---

## `/doctor/participants/[id]/report`

Display research/model metrics and interpretation:

```text
Model
Accuracy
Sensitivity
Specificity
F1
AUC

Prediction
Confidence / probability

Important Channels
Important Frequency Bands
Important Time Periods
```

Keep the output clearly labeled as a model/research result.

---

## `/doctor/compare`

Compare sessions for the same participant.

Compare:

- EEG patterns
- Band power
- Behavioral performance
- Model output

---

# 10. Researcher / Admin Portal

This portal makes the system feel like a real research platform.

## `/research/dashboard`

Show:

- Dataset information
- Participant counts
- Model count
- Experiment count
- Evaluation status

---

## `/research/models`

Main model comparison page.

```text
LSTM
CNN
CNN-LSTM
CNN-LSTM + Attention
```

Metrics:

- Accuracy
- F1
- Sensitivity
- Specificity
- AUC

Load these values from actual experiment results. Do not hardcode them.

---

## `/research/experiments`

Show the planned experiments:

```text
Experiment 01
4 bands vs 5 bands

Experiment 02
0.5s vs 1s vs 2s

Experiment 03
LSTM vs CNN-LSTM

Experiment 04
CNN-LSTM vs CNN-LSTM + Attention

Experiment 05
EEG only vs Behavior only vs EEG + Behavior
```

---

## `/research/explainability`

Show:

- Important channels
- Important frequency bands
- Attention weights
- Temporal importance
- Feature importance

Example:

```text
Important Channels
───────────────────
O1
O2
Fz
...

Important Bands
───────────────
Beta
Theta
...

Temporal Importance
──────────────────
00–10 sec  ░░░
10–20 sec  ███
20–30 sec  ████
30–40 sec  ██
```

---

## `/research/datasets`

Show:

- Dataset name
- Number of subjects
- EEG channels
- Sampling rate
- File types
- Labels
- Behavioral availability
- MRI availability
- File size

---

# 11. Future Live EEG Pages

These can be designed now and implemented later.

```text
/device
/device/connect
/live/session
/live/experiment
/live/results
```

Future flow:

```text
               EEG DEVICE
                    │
                    ▼
             Device Connection
                    │
                    ▼
              Live EEG Page
                    │
                    ▼
              Experiment Page
                    │
                    ▼
              Record Session
                    │
                    ▼
          FastAPI + WebSocket
                    │
                    ▼
            EEG Processing
                    │
                    ▼
          CNN-LSTM / LSTM
                    │
                    ▼
             Live Results
```

---

# 12. Component Architecture

Do not keep everything inside `page.tsx`.

Recommended structure:

```text
src/
│
├── app/
│   ├── page.tsx
│   ├── login/
│   ├── participant/
│   ├── doctor/
│   ├── research/
│   ├── sessions/
│   └── live/
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── PageHeader.tsx
│   │
│   ├── eeg/
│   │   ├── EEGChart.tsx
│   │   ├── ChannelSelector.tsx
│   │   ├── BandPowerChart.tsx
│   │   ├── Spectrogram.tsx
│   │   └── EEGStatus.tsx
│   │
│   ├── experiment/
│   │   ├── ExperimentTimer.tsx
│   │   ├── Stimulus.tsx
│   │   └── EventTimeline.tsx
│   │
│   ├── models/
│   │   ├── ModelCard.tsx
│   │   ├── MetricsTable.tsx
│   │   └── PredictionCard.tsx
│   │
│   └── ui/
│
├── lib/
│   ├── api.ts
│   ├── websocket.ts
│   └── utils.ts
│
├── types/
│   ├── eeg.ts
│   ├── session.ts
│   ├── model.ts
│   └── participant.ts
│
└── hooks/
    ├── useEEGStream.ts
    ├── useSession.ts
    └── useExperiment.ts
```

---

# 13. Frontend Data Flow

The frontend should not run the ML model directly.

```text
                NEXT.JS
                   │
          ┌────────┴────────┐
          │                 │
       REST API         WebSocket
          │                 │
          ▼                 ▼
       FastAPI          Live EEG
          │
          ▼
     Python Pipeline
          │
     ┌────┼─────┐
     ▼    ▼     ▼
    EEG  Model  Results
```

The frontend acts as the interface and visualization layer.

---

# 14. API Structure

Suggested API grouping:

```text
/api/auth
/api/participants
/api/sessions
/api/eeg
/api/experiments
/api/models
/api/results
/api/research
```

Examples:

```text
POST /api/sessions
POST /api/sessions/{id}/upload
POST /api/experiments/start
POST /api/experiments/event
GET  /api/sessions/{id}
GET  /api/sessions/{id}/eeg
GET  /api/sessions/{id}/results
GET  /api/models
```

Live stream:

```text
/ws/eeg/{sessionId}
```

---

# 15. Development Phases

Status legend: **Done** — built and verified in `frontend/`. **Mock** — built, but reads from
`src/lib/api.ts` fixtures rather than a live backend. **Not started** — architecture only.

## Phase 1 — Design System — **Done**

Build first:

- Colors
- Typography
- Buttons
- Cards
- Inputs
- Tables
- Badges
- Sidebar
- Header
- Charts

All present in `src/components/ui` and `src/components/layout`, driven by CSS custom properties in
`src/app/globals.css`.

---

## Phase 2 — Public Frontend — **Done**

Build:

- Landing
- About
- Research
- Login

Routes `/`, `/about`, `/research`, `/login`, `/register`. Login is prototype-only: it accepts the
documented demo credentials and sets no real session.

---

## Phase 3 — Participant Flow — **Done** (mock data)

Build the complete path:

```text
Dashboard
     ↓
EEG Upload
     ↓
Experiment
     ↓
Processing
     ↓
Results
     ↓
History
```

End-to-end path works on mock data: `/participant/dashboard`, `/participant/eeg`,
`/participant/experiment`, `/participant/session/[id]/processing`,
`/participant/session/[id]/results`, `/participant/history`, plus `/participant/settings`.

Processing and results both render only real state from the data layer — no invented progress or
placeholder results. A failed session shows its failure rather than retrying silently.

---

## Phase 4 — Doctor Portal — **Done** (mock data)

Build:

- Doctor Dashboard
- Participants
- Participant Details
- EEG Analysis
- Behavior
- Reports

The participant record is tabbed rather than a single long scroll, per §9:

| Tab | Route | Status |
| --- | --- | --- |
| Overview | `/doctor/participants/[id]` | Done |
| EEG | `/doctor/participants/[id]/eeg` | Done |
| Behavior | `/doctor/participants/[id]/behavior` | Done |
| Sessions | `#sessions` on Overview | Done |
| Model results | `#model-results` on Overview | Done |
| Reports | `/doctor/participants/[id]/report` | Done |

Sessions and Model results are anchor sections of Overview because §9 gives them no screen of their
own; the other four are addressable routes that share `ParticipantShell`. Also built:
`/doctor/dashboard`, `/doctor/participants` (filterable roster), `/doctor/compare`,
`/doctor/settings`.

---

## Phase 5 — Research Dashboard — **Done** (mock data)

Build:

- Models
- Experiments
- Explainability
- Dataset Information

Routes `/research/models`, `/research/experiments`, `/research/explainability`,
`/research/datasets`, `/research/dashboard`, `/research/settings`. Architectures with no completed
evaluation run render as an explicit gap, never a placeholder metric. `/research/models` is a single
comparison screen over all architectures — there is no per-model detail route.

---

## Phase 6 — Backend Integration — **Not started**

Replace mock data with real backend data:

```text
FastAPI
   ↓
Real EEG data
   ↓
Real model output
   ↓
Frontend
```

The same API contracts should work with actual datasets and later with live EEG. Every function in
`src/lib/api.ts` is the single swap point: its signature and return type stay fixed, only the
implementation changes.

---

## Phase 7 — Live EEG Architecture — **Not started** (feature-flagged stubs)

Finally integrate:

```text
BrainFlow / Device SDK
       ↓
Live EEG
       ↓
FastAPI
       ↓
WebSocket
       ↓
Next.js
```

`LiveWaveform` and `LiveMonitor` already exist and are reused by `/participant/live` and
`/live/session`, which render an explicit unsupported state until the device bridge exists. Gated on
`NEXT_PUBLIC_LIVE_EEG`; transport target `/ws/eeg/{sessionId}`.

---

# 16. Minimum Viable Prototype

Do not implement every page immediately.

Build these 8 core screens first — **all built**:

```text
1. Landing Page                        /
2. Login / Role Selection              /login
3. Participant Dashboard               /participant/dashboard
4. EEG Upload Page                     /participant/eeg
5. Experiment + EEG Visualization      /participant/experiment
6. Processing Page                     /participant/session/[id]/processing
7. Results Page                        /participant/session/[id]/results
8. Doctor / Research Dashboard         /doctor/dashboard, /research/dashboard
```

Then add — **all built**, with the noted limitation:

```text
9.  Model Comparison                   /research/models
10. Explainability                     /research/explainability
11. Behavioral Analysis                /doctor/participants/[id]/behavior
12. Live EEG                           components ready; routes render an
                                        unsupported state until Phase 7
```

Screens built beyond this list, per the sections above: `/about`, `/research`, `/register`,
`/participant/history`, `/participant/live`, `/participant/settings`, `/doctor/participants`,
`/doctor/compare`, `/doctor/settings`, `/research/experiments`, `/research/datasets`,
`/research/settings`, `/device`, `/live/session`.

---

# 17. Final Demo Journey

The complete prototype should tell a clear story:

```text
LANDING
   ↓
LOGIN
   ↓
PARTICIPANT DASHBOARD
   ↓
UPLOAD EEG
   ↓
SELECT EXPERIMENT
   ↓
EEG PROCESSING
   ↓
MODEL INFERENCE
   ↓
RESULT
   ↓
DOCTOR DASHBOARD
   ↓
EEG ANALYSIS
   ↓
MODEL / EXPLAINABILITY
   ↓
RESEARCH COMPARISON
```

Future hardware flow:

```text
REAL EEG DEVICE
       ↓
LIVE EEG
       ↓
EXPERIMENT
       ↓
REAL-TIME STREAM
       ↓
MODEL
       ↓
RESULT
```

---

# 18. Frontend Design Principle

Keep the system separated into three layers:

```text
USER LAYER
Participant / Doctor / Researcher
            ↓
VISUALIZATION LAYER
EEG / Behavior / Results / Charts
            ↓
COMPUTATION LAYER
FastAPI / Processing / CNN-LSTM / LSTM
```

The current dataset-based research system and future live-EEG system should feel like one product.

The EEG input source should be replaceable, while the visualization and model interfaces remain stable.

---

# 19. Core Product Principle

The frontend should make the research process visible rather than hiding it.

The user should be able to understand:

**What data entered the system → how it was processed → what experiment was performed → which model was used → what the model produced → which EEG patterns contributed to the output.**

This is the main distinction between a professional research prototype and a generic AI dashboard.
