<h1 align="center">
  <img src="apps/web/src/assets/Logo_Small.png" alt="UAF Smart E-Library logo" width="52" />
  UAF Smart E-Library
</h1>

<p align="center"><strong>University Information Assistant</strong></p>

<p align="center">
  Production-grade monorepo for a university digital library, public web client,
  FastAPI backend, and Supabase/PostgreSQL database layer.
</p>

## Repository Scope

This repository contains three operational areas:

- `apps/web`
  Public Next.js frontend with guest authentication, semantic theming, and reusable UI components.
- `apps/api`
  FastAPI backend that verifies Supabase JWTs, uses `asyncpg`, and delegates core business logic to PostgreSQL RPC functions.
- `supabase`
  Supabase configuration and SQL migrations for schema, RLS, RPCs, queue automation, analytics, and vector-backed document support.

## Documentation

- Frontend guide: [apps/web/README.md](apps/web/README.md)
- Backend guide: [apps/api/README.md](apps/api/README.md)
- License: [LICENSE.md](LICENSE.md)

## Monorepo Prerequisites

- Node.js 20+
- Python 3.11+
- npm 10+
- Supabase project with:
  - Auth enabled
  - `pgvector` enabled
  - `pg_cron` enabled
  - linked CLI project for migrations

## Local Development

### Frontend

```bash
npm --prefix apps/web install
npm --prefix apps/web run dev
```

Frontend runs at `http://localhost:3000`.

### Backend

```bash
cd apps/api
python -m venv venv
venv\Scripts\activate
pip install -r requirement.txt
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`.

### Concurrent root workflow

The root workspace also exposes helper scripts:

```bash
npm install
npm run dev:web
npm run dev:api
```

## Git Hygiene

The repository is configured to keep generated and local-only state out of Git, including:

- `node_modules`
- Next.js build output (`.next`, `out`, `build`, `dist`)
- Python virtual environments and cache directories
- local environment files (`.env`, `.env.local`, `.env.*.local`)
- logs and local SQLite files

Tracked example configuration files should remain in Git. Real secret-bearing `.env` files should not.

## Current Application Surface

### Frontend

- `/login`
- `/forgot-password`
- `/reset-password`

### Backend

- `GET /health`
- `GET /api/books`
- `POST /api/admin/users/students`
- `POST /api/admin/users/librarians`
- `POST /api/admin/users/admins`

## Deployment Direction

This is not a demo repository. The intended architecture is:

- Supabase Auth for identity
- PostgreSQL RLS for authorization
- PostgreSQL RPC for critical business operations
- FastAPI as a thin resource server
- Next.js as the public web client

## License

This repository is proprietary. See [LICENSE.md](LICENSE.md).
