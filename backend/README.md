# Krishi Hrudya — Backend

FastAPI + PostgreSQL (Supabase) + Redis (Upstash) backend for the Krishi Hrudya IoT platform.

---

## Local Setup

### 1. Clone and create virtual environment
```bash
git clone <repo>
cd krishihrudya-backend
python -m venv venv

# Mac/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Open .env and fill in your Supabase and Upstash credentials
```

### 4. Set up Supabase
- Go to https://supabase.com → New project
- Copy the connection string from Project Settings → Database
- It looks like: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`
- Change `postgresql://` to `postgresql+asyncpg://` in your .env

### 5. Set up Upstash Redis
- Go to https://upstash.com → Create database → Select Redis
- Copy the `REDIS_URL` (starts with `rediss://`)
- Paste into your .env

### 6. Seed the database (creates tables + sample data)
```bash
python -m app.seed
```

### 7. Run the server
```bash
uvicorn app.main:app --reload
```

API is now running at: http://localhost:8000
Interactive docs at:   http://localhost:8000/docs

---

## Project Structure

```
app/
├── main.py              ← FastAPI app, CORS, router registration
├── config.py            ← All env variables
├── database.py          ← Async SQLAlchemy engine + session
├── seed.py              ← Seed roles, permissions, sample orgs
│
├── models/              ← DB table definitions (SQLAlchemy)
│   ├── role.py          ← Role, Permission, role_permissions
│   ├── organisation.py  ← Organisation, HierarchyLevel, HierarchyNode, OrganisationInvite
│   ├── user.py          ← User
│   └── otp.py           ← OtpVerification
│
├── schemas/             ← Request/Response shapes (Pydantic)
│   └── auth.py
│
├── routers/             ← HTTP endpoints (thin — no logic here)
│   ├── auth.py
│   └── onboarding.py
│
├── services/            ← All business logic
│   ├── auth_service.py
│   ├── otp_service.py
│   └── email_service.py
│
└── utils/               ← Reusable helpers
    ├── hashing.py       ← Password + OTP hashing
    ├── jwt.py           ← Token creation/verification
    └── redis_client.py  ← Redis operations
```

---

## API Endpoints

### Onboarding (no auth required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/onboarding/organisations` | List all active orgs |
| GET | `/onboarding/organisations/{id}/hierarchy` | Get level template for an org |
| GET | `/onboarding/organisations/{id}/nodes` | Get nodes (with optional level/parent filter) |

### Auth (no auth required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/verify-email` | Verify email via link token |
| POST | `/auth/verify-otp` | Verify OTP (registration or password reset) |
| POST | `/auth/set-password` | Set password after first-time verification |
| POST | `/auth/login` | Login with email/phone + password |
| POST | `/auth/refresh` | Rotate access token using refresh token |
| POST | `/auth/logout` | Blacklist current token |
| POST | `/auth/forgot-password` | Trigger reset email or OTP |
| POST | `/auth/reset-password` | Set new password after reset verification |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |

---

## Auth Flow Summary

```
Register → Verify (email link or OTP) → Set Password → Active → Login

Forgot Password → Verify (email link or OTP) → Reset Password → Logged in
```

---

## Environment Variables

See `.env.example` for all required variables with descriptions.

Key ones to fill before running:
- `DATABASE_URL` — from Supabase
- `REDIS_URL` — from Upstash  
- `JWT_SECRET_KEY` — any long random string (use: `openssl rand -hex 32`)
