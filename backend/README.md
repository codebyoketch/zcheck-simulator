# ZCheck Simulator 🖥️

A checkpoint revision platform for Zone01 students to practice Go (and more) coding exercises in a real exam-like environment.

---

## Project Structure

```
zcheck/
├── zcheck/              # Django project config (settings, urls, celery)
├── users/               # Auth, user profiles, XP/levels
├── exercises/           # Languages, Checkpoints, Exercises, TestCases
├── submissions/         # Sessions, Submissions, TestResults, Progress
├── runner/              # Import validator + Docker execution engine
├── docker/
│   ├── go-runner/       # Go sandbox (includes z01 package)
│   ├── python-runner/   # Python sandbox
│   └── js-runner/       # Node.js sandbox
├── docker-compose.yml   # Full stack orchestration
├── Dockerfile           # Django app image
├── nginx.conf           # Reverse proxy
└── requirements.txt
```

---

## Key API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Student signup |
| POST | `/api/auth/login/` | Get JWT tokens |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET  | `/api/auth/me/` | Current user profile |

### Exercises
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exercises/` | List all exercises (filter by difficulty, language, checkpoint) |
| GET | `/api/exercises/<slug>/` | Exercise detail + public test cases |
| GET | `/api/exercises/random/` | Random exercise (supports ?checkpoint=, ?difficulty_pct=, ?exclude=) |
| GET | `/api/checkpoints/` | List checkpoints |
| GET | `/api/languages/` | List languages |

### Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submit/` | Submit code (returns immediately with task_id) |
| GET  | `/api/submissions/<id>/` | Poll for result |
| GET  | `/api/progress/` | My exercise progress history |
| GET  | `/api/history/` | My recent submissions |
| POST | `/api/sessions/start/` | Start a practice session |
| PATCH | `/api/sessions/<id>/end/` | End a session |

### Admin API (requires is_staff=True)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/exercises/` | List/create exercises |
| GET/PUT/DELETE | `/api/admin/exercises/<slug>/` | Edit/delete exercise |
| GET/POST | `/api/admin/exercises/<slug>/test-cases/` | Manage test cases |
| GET/PUT/DELETE | `/api/admin/test-cases/<id>/` | Edit/delete test case |
| GET/POST | `/api/admin/languages/` | Manage languages |
| GET/POST | `/api/admin/checkpoints/` | Manage checkpoints |

### Django Admin Panel
`/django-admin/` — full GUI for managing everything

---

## Submission Flow

```
POST /api/submit/ {exercise_slug, code, session_id?}
        ↓
1. Import validator (instant — checks forbidden/allowed imports)
        ↓
2. Celery task queued → returns 202 with submission ID
        ↓
3. Poll GET /api/submissions/<id>/ until status != 'pending'/'running'
        ↓
4. Docker container runs code against each test case
        ↓
5. Results:
   - Public test cases: full detail (stdin, expected, actual, error)
   - Hidden test cases: pass/fail ONLY (no input/output revealed)
        ↓
6. Status: accepted → auto-advance | failed → show terminal output
```

---

## Submission Statuses
- `pending` — queued
- `running` — executing in Docker
- `accepted` — all test cases passed ✅
- `wrong_answer` — some test cases failed
- `compile_error` — code didn't compile
- `runtime_error` — code crashed
- `time_limit` — exceeded timeout
- `illegal_import` — used a forbidden package (e.g. `fmt` when only `z01` allowed)

---

## Getting Started (Development)

### 1. Clone and set up environment
```bash
git clone <repo>
cd zcheck
cp .env.example .env
# Edit .env with your values
```

### 2. Build runner Docker images
```bash
# Go runner (with z01 package)
# First: copy z01 source into docker/go-runner/z01/
docker build -t zcheck-go-runner:latest docker/go-runner/

# Python runner
docker build -t zcheck-python-runner:latest docker/python-runner/

# JS runner
docker build -t zcheck-js-runner:latest docker/js-runner/
```

### 3. Start the full stack
```bash
docker-compose up -d
```

### 4. Run migrations and seed data
```bash
docker-compose exec django python manage.py migrate
docker-compose exec django python manage.py createsuperuser
docker-compose exec django python manage.py seed_go_exercises
```

### 5. Access
- API: `http://localhost:8000/api/`
- Django Admin: `http://localhost:8000/django-admin/`

---

## Adding a New Language (via Admin)

1. Go to `/django-admin/exercises/language/add/`
2. Fill in: name, slug, file extension, Docker image name, timeout, memory limit
3. Build and push the Docker image for that language
4. Add exercises and test cases for that language

## Adding Exercises (via Admin)

1. Go to `/django-admin/exercises/exercise/add/`
2. Fill in description (Markdown), difficulty %, language, checkpoint
3. Set forbidden/allowed imports
4. Add test cases inline — mark hidden ones as `is_hidden = True`

---

## Hidden Test Cases — Anti-Hardcoding

- **Public test cases**: shown in full on failure (input, expected output, your output)
- **Hidden test cases**: only show `✅ Test N (hidden): PASSED` or `❌ Test N (hidden): FAILED`
- Students never see hidden test case inputs or expected outputs — even after submission

---

## Tech Stack
- **Backend**: Django 5 + Django REST Framework + SimpleJWT
- **Task Queue**: Celery + Redis
- **Code Execution**: Custom Docker sandboxes per language
- **Database**: PostgreSQL
- **Proxy**: Nginx
- **Frontend**: React (separate repo — next phase)
