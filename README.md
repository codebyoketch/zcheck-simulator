# ZCheck Simulator

A checkpoint revision platform for Zone01 students to practice Go (and more) coding exercises in a real exam-like environment.

---

## Project Structure

```
zcheck-simulator/
├── backend/     # Django + DRF + Channels + Celery
├── frontend/    # React + Monaco Editor
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React, Monaco Editor, React Router |
| Backend | Django 5, Django REST Framework, SimpleJWT |
| Real-time | Django Channels, Daphne (ASGI), Redis |
| Task Queue | Celery + Redis |
| Code Execution | Custom Docker sandboxes per language (one container per submission) |
| Database | PostgreSQL |
| Proxy | Nginx |

---

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Node.js 18+
- Python 3.12+

---

### 1. Clone and configure

```bash
git clone <repo>
cd zcheck-simulator
```

**Backend environment:**
```bash
cd backend
cp .env.example .env
# Edit .env — set SECRET_KEY, DOMAIN, DB password
```

**Frontend environment:**
```bash
cd frontend
cp .env.example .env
# Edit .env — set REACT_APP_API_URL and REACT_APP_WS_URL
```

---

### 2. Build the language runner Docker images

Each language runs in its own isolated Docker sandbox.

**Go runner** (z01 package fetched automatically at build time):
```bash
docker build -t zcheck-go-runner:latest backend/docker/go-runner/
```
> z01 is pulled from `github.com/01-edu/z01` during the image build and cached inside the image. No files to copy manually. Network is disabled at runtime — students cannot make HTTP calls from their code.

**Python runner:**
```bash
docker build -t zcheck-python-runner:latest backend/docker/python-runner/
```

**JavaScript runner:**
```bash
docker build -t zcheck-js-runner:latest backend/docker/js-runner/
```

---

### 3. Start the full backend stack

```bash
cd backend
docker-compose up -d
```

This starts:
- `django` — Daphne ASGI server (HTTP + WebSocket), runs migrations + collectstatic on boot
- `celery` — async code execution worker
- `redis` — message broker + channel layer
- `db` — PostgreSQL
- `nginx` — reverse proxy

> Migrations run automatically on first start. No manual `migrate` needed.

---

### 4. Seed initial data and create admin

```bash
# Seed Go Elementary Programming exercises
docker-compose exec django python manage.py seed_go_exercises

# Create your admin account
docker-compose exec django python manage.py createsuperuser
```

---

### 5. Start the frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:3000`

---

## Migrations (manual, if needed)

Only required if you add new models or change existing ones:

```bash
docker-compose exec django python manage.py makemigrations users
docker-compose exec django python manage.py makemigrations exercises
docker-compose exec django python manage.py makemigrations submissions
docker-compose exec django python manage.py makemigrations runner
docker-compose exec django python manage.py migrate
```

> `runner` has no models — `No changes detected` is expected.

---

## Access Points

| URL | Description |
|---|---|
| `http://localhost:3000` | Student app |
| `http://localhost:3000/admin` | Admin panel (staff only) |
| `http://localhost:8000/api/` | REST API |
| `http://localhost:8000/django-admin/` | Django admin (fallback) |
| `ws://localhost:8000/ws/submissions/<id>/` | WebSocket — submission results |

---

## Session Flow

```
/disclaimer
  → Student sets optional timer (hours + minutes)
  → Reads exam rules, checks agreement
  → Browser enters fullscreen
        ↓
/practice
  → Fetches available levels from exercise bank
  → Starts session in DB
  → Level 1 (5%): random exercise assigned — locked in
      → Submit → pass → Level 2
      → Submit → fail → retry same exercise
      → Give up → Terminate button → session ends
  → ...up through all available levels
  → All levels complete OR terminated OR timer runs out
        ↓
Session Summary screen
  → Shows each level: exercise name, attempts, PASS/FAIL
  → Overall score and completion %
  → Options: Dashboard or Try Again
```

---

## Submission Flow (per exercise)

```
POST /api/submit/ {exercise_slug, code, session_id}
        ↓
1. Import validator — instant check (forbidden/illegal imports)
        ↓
2. 202 Accepted — submission ID returned immediately
        ↓
3. WebSocket opens: ws/submissions/<id>/?token=<jwt>
        ↓
4. Celery picks up task → ONE Docker container spins up
        ↓
5. Code compiles ONCE → binary runs against all test cases
        ↓
6. Results pushed via WebSocket:
   - Public test cases: full detail (stdin, expected, actual, error)
   - Hidden test cases: PASS/FAIL only — no input/output revealed
        ↓
7. accepted → auto-advance to next level (after 1.5s)
   failed   → show error in terminal, student fixes and resubmits
```

---

## Submission Statuses

| Status | Meaning |
|---|---|
| `pending` | Queued, not yet picked up |
| `running` | Executing in Docker |
| `accepted` | All test cases passed ✅ |
| `wrong_answer` | Some test cases failed |
| `compile_error` | Code did not compile |
| `runtime_error` | Code crashed during execution |
| `time_limit` | Exceeded language timeout |
| `illegal_import` | Used a forbidden package (e.g. `fmt` when only `z01` allowed) |

---

## Hidden Test Cases — Anti-Hardcoding

- **Public test cases** — shown in full on failure: input, expected output, actual output
- **Hidden test cases** — only show `✅ Test N (hidden): PASSED` or `❌ Test N (hidden): FAILED`
- Students never see hidden test case inputs or expected outputs, even after submission
- Makes hardcoding the expected output impossible

---

## Level Progression

Exercises are organised by difficulty percentage. The session advances level by level:

| Level | % | Example exercises |
|---|---|---|
| 1 | 5% | only1, onlya, onlyb, onlyf, onlyz |
| 2 | 10% | checknumber, countalpha, countcharacter, printf, printifnot, rectperimeter, retainfirsthalf |
| 3 | 20% | cameltosnakecase, countrepeats, digitlen, firstword, fishandchips, gcd, hashcode, lastword, longestword, repeatalpha, searchreplace |
| 4 | 35% | cleanstr, expandstr, findprevprime, fromto, iscapitalized, itoa, passwordentropy, printmemory, printrevcomb, thirdtimeisacharm, weareunique, zipstring |
| 5 | 50% | addprimesum, canjump, chunk, concatalternate, concatslice, fprime, hiddenp, inter, reversestrcap, saveandmiss, union, wdmatch |
| 6 | 65% | fifthandskip, notdecimal, revconcatalternate, slice |
| 7 | 75% | findpairs, revwstr, rostring, wordflip |
| 8 | 85% | itoabase, options, piglatin, romannumbers |
| 9 | 95% | brackets, rpncalc |
| 10 | 100% | brainfuck, grouping |

Only levels that have exercises in the bank are shown. If a level has no exercises yet, it is skipped automatically.

---

## Admin Panel (`/admin`)

Accessible to staff users only. Appears in navbar as a purple "Admin" link.

| Section | What you can do |
|---|---|
| Overview | Stats at a glance |
| Exercises | Full CRUD — description, starter code, import rules, difficulty, main file config |
| Test Cases | Per exercise — add/edit/delete, mark public or hidden, set order |
| Checkpoints | Create checkpoint events, assign language |
| Languages | Add language, set Docker image, timeout, memory limit, forbidden imports |
| Users | View and search students, manage roles, enable/disable accounts, reset passwords, view full submission and session history, inspect submitted code |

### User Management

- Search users by username or email
- Toggle active status and staff/admin role via PATCH
- Reset any user's password directly from the admin UI
- Expand any user row to browse their full submission history with filters (checkpoint, exercise, date range, status, sort order)
- Click the `</>` button on any submission to view the exact code submitted

---

## Exercise Sandbox (`/sandbox`)

A free-practice area outside of sessions. Accessible from the dashboard.

- Browse and filter exercises by language, checkpoint, and difficulty
- Two-tab Monaco editor: editable `main.go` + student solution file
- Run test cases without starting a session — results streamed via WebSocket
- Full submission history per exercise shown inline

---

## Deployment (VPS)

Recommended: **Oracle Cloud Free Tier** (4 vCPU, 24GB RAM — free forever)

```bash
# On the VPS (Ubuntu 22.04)
git clone <repo>
cd zcheck-simulator/backend

# Build runner images
docker build -t zcheck-go-runner:latest docker/go-runner/
docker build -t zcheck-python-runner:latest docker/python-runner/
docker build -t zcheck-js-runner:latest docker/js-runner/

# Configure environment
cp .env.example .env && nano .env

# Start everything
docker-compose up -d

# Seed data and create admin
docker-compose exec django python manage.py seed_go_exercises
docker-compose exec django python manage.py createsuperuser

# Build frontend
cd ../frontend
npm install && npm run build
# Serve build/ via Nginx (already configured in docker-compose nginx service)
```

---

## Roadmap

- [x] Django backend — models, API, auth, JWT
- [x] WebSocket real-time submission results (Channels + Daphne)
- [x] Import validator — per exercise forbidden/allowed imports
- [x] One-container Docker execution engine (compile once, run all test cases)
- [x] React frontend — Auth, Dashboard, Practice Session, History, Checkpoint Map
- [x] Disclaimer page with exam rules, timer setter, fullscreen
- [x] Level-by-level session progression (pass to advance, retry or terminate on fail)
- [x] Session timer — student-set, auto-terminates on expiry
- [x] Session summary — per-level results, attempts, pass/fail
- [x] Admin UI — Exercises, Test Cases, Checkpoints, Languages, Users
- [x] Admin user management — search, role editing, password reset, submission history, code viewer
- [x] Exercise sandbox — free practice outside sessions, Monaco editor, WebSocket results
- [x] docker-compose — auto-migrate and collectstatic on startup
- [x] Docker runner images — Go (z01 auto-fetched), Python, JS
- [ ] Full exercise + test case bank (5 seeded, 40+ remaining)
- [ ] Python and JavaScript checkpoint support