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
| Code Execution | Custom Docker sandboxes per language |
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

**Go runner** (includes z01 package):
```bash
# First copy the z01 source into the Go runner image directory
cp -r /path/to/z01 backend/docker/go-runner/z01/

# Build the image
docker build -t zcheck-go-runner:latest backend/docker/go-runner/
```

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
- `django` — Daphne ASGI server (HTTP + WebSocket)
- `celery` — async code execution worker
- `redis` — message broker + channel layer
- `db` — PostgreSQL
- `nginx` — reverse proxy

---

### 4. Run migrations

```bash
docker-compose exec django python manage.py makemigrations users
docker-compose exec django python manage.py makemigrations exercises
docker-compose exec django python manage.py makemigrations submissions
docker-compose exec django python manage.py makemigrations runner
docker-compose exec django python manage.py migrate
```

> `runner` has no models — `No changes detected` is expected for it.

---

### 5. Seed initial data and create admin

```bash
# Seed Go Elementary Programming exercises from zone01
docker-compose exec django python manage.py seed_go_exercises

# Create your admin account
docker-compose exec django python manage.py createsuperuser
```

---

### 6. Start the frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:3000`

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

## Submission Flow

```
POST /api/submit/ {exercise_slug, code, session_id?}
        ↓
1. Import validator — instant check for forbidden/illegal imports
        ↓
2. 202 Accepted — submission ID returned immediately
        ↓
3. WebSocket opens: ws/submissions/<id>/?token=<jwt>
        ↓
4. Celery picks up task → spins up Docker container
        ↓
5. Code runs against each test case (stdin → stdout)
        ↓
6. Results pushed via WebSocket:
   - Public test cases: full detail (stdin, expected, actual, error)
   - Hidden test cases: PASS/FAIL only — input/output never revealed
        ↓
7. accepted → auto-advance to next exercise
   failed   → show terminal output, student retries
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
- Makes hardcoding the expected output impossible across multiple attempts

---

## Adding a New Language (via Admin UI)

1. Build a Docker image for the language (see `backend/docker/` for examples)
2. Go to `/admin/languages` → **New language**
3. Fill in: name, slug, file extension, Docker image name, timeout, memory limit
4. Add exercises for that language via `/admin/exercises`

---

## Adding Exercises (via Admin UI)

1. Go to `/admin/exercises` → **New exercise**
2. Fill in: name, slug, description (Markdown), difficulty %, language, checkpoint
3. Set forbidden/allowed imports (e.g. forbidden: `fmt`, allowed: `z01`)
4. Add test cases via **Manage test cases** — mark hidden ones appropriately

---

## Exercise Difficulty Levels (zone01 Elementary Programming)

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

---

## Deployment (VPS)

Recommended: **Oracle Cloud Free Tier** (4 vCPU, 24GB RAM — genuinely free)

```bash
# On the VPS
git clone <repo>
cd zcheck-simulator/backend

# Build runner images
docker build -t zcheck-go-runner:latest docker/go-runner/
docker build -t zcheck-python-runner:latest docker/python-runner/
docker build -t zcheck-js-runner:latest docker/js-runner/

# Configure .env
cp .env.example .env && nano .env

# Start
docker-compose up -d

# Run migrations + seed
docker-compose exec django python manage.py makemigrations users exercises submissions
docker-compose exec django python manage.py migrate
docker-compose exec django python manage.py seed_go_exercises
docker-compose exec django python manage.py createsuperuser

# Build and serve frontend via Nginx
cd ../frontend
npm install && npm run build
# Copy build/ to Nginx html directory or serve via docker-compose nginx service
```

---

## Roadmap

- [x] Django backend — models, API, auth
- [x] WebSocket real-time submission results
- [x] React frontend — auth, dashboard, practice session, history
- [x] Admin UI — exercises, test cases, checkpoints, languages, users
- [ ] Docker runner images (Go + z01, Python, JS)
- [ ] Full exercise + test case bank (all 40+ exercises)
- [ ] Checkpoint map — visual progression page
- [ ] Python and JavaScript checkpoint support
