# UAF Smart E-Library Backend

Production FastAPI backend for the UAF Smart E-Library & University Information Assistant.

## Purpose

The backend is a thin application layer. It does not implement core business rules in Python.

Responsibilities:

- verify Supabase JWTs
- expose HTTP routes
- manage the `asyncpg` connection pool
- call PostgreSQL RPC functions
- return standardized JSON error envelopes
- perform admin user provisioning through the Supabase Admin API

Core business logic remains in PostgreSQL and Supabase.

## Stack

- FastAPI
- `asyncpg`
- `python-jose`
- `httpx`
- Supabase Auth
- PostgreSQL RPC / RLS

## Current Modules

- `core/config.py`
  Loads and validates backend environment variables.
- `core/database.py`
  Manages the shared `asyncpg` pool.
- `core/middleware.py`
  Validates bearer tokens and injects request auth context.
- `modules/books`
  Public catalog routes and RPC access.
- `modules/auth`
  Admin-only user provisioning routes and Supabase Admin API integration.

## Local Setup

```bash
cd apps/api
python -m venv venv
venv\Scripts\activate
pip install -r requirement.txt
```

## Environment Variables

Create `apps/api/.env` for local development or inject variables through the runtime environment.

The tracked example file is:

- `apps/api/.env.example`

Required variables:

- `ENVIRONMENT`
- `LOG_LEVEL`
- `DATABASE_URL`
- `SUPABASE_PROJECT_URL`
- `SUPABASE_JWT_AUDIENCE`
- `SUPABASE_SERVICE_ROLE_KEY`

## Run

```bash
cd apps/api
uvicorn main:app --reload
```

Default local URL:

- `http://127.0.0.1:8000`

## Available Endpoints

### Public

- `GET /health`
- `GET /api/books`

### Admin-only

- `POST /api/admin/users/students`
- `POST /api/admin/users/librarians`
- `POST /api/admin/users/admins`

## Logging

- Structured JSON logging is configured centrally.
- Local file logging writes to `apps/api/app.log`.
- `app.log` is ignored by Git and must not be committed.

## Important Constraints

- Do not move business logic into route handlers.
- Do not reimplement PostgreSQL RPC logic in Python.
- Do not expose the service role key to the frontend.
- Production should disable interactive docs automatically through environment-aware configuration.

## Validation

Typical local checks:

```bash
python -m compileall .
```

If you add automated tests later, document the exact command here instead of leaving it implicit.
