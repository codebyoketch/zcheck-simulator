# ZCheck Simulator

Zone01 checkpoint revision platform.

## Structure

```
zcheck-simulator/
├── backend/    # Django + DRF + Channels + Celery
└── frontend/   # React + Monaco Editor
```

## Quick start

```bash
# Backend
cd backend
cp .env.example .env
docker-compose up -d
docker compose exec django python manage.py makemigrations
docker-compose exec django python manage.py migrate
docker-compose exec django python manage.py createsuperuser
docker-compose exec django python manage.py seed_go_exercises

# Frontend
cd frontend
cp .env.example .env
npm install
npm start
```
