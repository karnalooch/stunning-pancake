# Developer Quick Start Guide: "SPORT" Platform

Welcome to the **SPORT** platform project. This guide will help you get your development environment up and running as quickly as possible.

## 1. Prerequisites
Ensure you have the following installed on your machine:
- **Docker & Docker Compose**
- **Python 3.11+** (for local backend development)
- **Node.js 18+ & npm** (for Admin Dashboard)
- **Flutter SDK** (for Mobile App)

## 2. Infrastructure Setup (Phase 1)
The core infrastructure runs on Docker. Launch it using:
```bash
docker-compose up -d
```
This will start:
- **PostGIS** (Port 5432)
- **Redis** (Port 6379)
- **Traccar** (Port 8082)
- **BRouter** (Port 17878)
- **Backend API** (Port 8000)

## 3. Backend Development (Django)
Navigate to the `backend` directory:
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```
- **API Docs**: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
- **Admin Panel**: [http://localhost:8000/admin/](http://localhost:8000/admin/)

## 4. Admin Dashboard (React/Vite)
Navigate to the `admin` directory:
```bash
cd admin
npm install
npm run dev
```
- **Local Dev**: [http://localhost:5173/](http://localhost:5173/)

## 5. Mobile App (Flutter)
Navigate to the `mobile` directory:
```bash
cd mobile
flutter pub get
flutter run
```
*Note: Ensure you have an Android/iOS emulator or a physical device connected.*

## 6. Coding Standards & Constitution
Before you write any code, you **MUST** read the following documents:
- **[Constitution.md](../constitution.md)**: Core project rules and ethics.
- **[Python/TypeScript Strategy](../python_typescript_strategy.md)**: Technical standards.
- **[AI Toolkit Constitution](../ai_toolkit_constitution.md)**: Safety and quality gates.

### Mandatory Rules:
1.  **Conventional Commits**: Every commit must follow the `type: description` format.
2.  **API Documentation**: Every new endpoint must be documented in Swagger.
3.  **Docstrings/JSDoc**: No code will be merged without proper documentation.
4.  **Privacy First**: Never store or log raw GPS data from privacy zones.

## 7. Useful Commands
- `docker-compose logs -f backend`: View live backend logs.
- `python manage.py test`: Run backend tests.
- `npm run lint`: Run frontend linting.

---
**Happy coding! Let's build the future of active communities.**
