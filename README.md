# DPM ONE

Private, self-hosted CRM + ERP foundation for DPM ENTERPRISE PRIVATE LIMITED.

## Current implementation status

This repository starts the production-oriented foundation. The first slice includes:
- FastAPI backend with health endpoint
- PostgreSQL database via Docker Compose
- Lead create/list/read/update API
- Environment-based configuration
- Dockerized API service

The wider 41-module scope is a roadmap, not a claim that every module is already implemented. Modules will be delivered in tested increments.

## Quick start (development)

1. Copy `.env.example` to `.env`.
2. Run `docker compose up --build`.
3. API: http://localhost:8000
4. Swagger: http://localhost:8000/docs
5. Health: http://localhost:8000/health

## API

- `GET /health`
- `POST /api/v1/leads`
- `GET /api/v1/leads`
- `GET /api/v1/leads/{lead_id}`
- `PATCH /api/v1/leads/{lead_id}`

## Security notes

- Never commit real passwords, API keys, private keys, or production secrets.
- PostgreSQL is intended to remain on the private Docker network; do not expose port 5432 publicly.
- Configure TLS at the reverse proxy before exposing the service to the internet.
- Site visits follow DPM policy: ₹5,000 + 18% GST; the application must not offer free site visits.

## Planned delivery

1. CRM core: leads, contacts, pipeline, activities, site visits, quotations.
2. ERP core: projects, BOQ, procurement, inventory, job work, billing, accounts.
3. Workforce, attendance, compliance, dashboards, audit and permissions.
4. Cloud + office deployment and encrypted synchronization after conflict handling and recovery tests are implemented.

## Authentication setup (development)

1. Copy `.env.example` to `.env` and replace every `CHANGE_` / `REPLACE_` value with unique secrets. Do not commit `.env`.
2. Start services with `docker compose up --build -d`.
3. Create the first administrator once:
   `docker compose exec api python -m app.bootstrap_admin`
   The command reads `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and `BOOTSTRAP_ADMIN_PASSWORD` from the API container environment and refuses to run if a user already exists.
4. Open the web app at http://localhost:3000 and sign in.

Authentication:
- `POST /api/v1/auth/login` returns a short-lived bearer token.
- `GET /api/v1/auth/me` returns the authenticated user's profile.
- All `/api/v1/leads` routes require a valid bearer token.

Before production:
- Set `APP_ENV=production` and a cryptographically random `JWT_SECRET_KEY`.
- Use unique strong database and administrator passwords.
- Configure HTTPS and a secure reverse proxy.
- Add database migrations, refresh-token/session revocation, rate limiting, MFA, and formal role-based authorization before production use.
