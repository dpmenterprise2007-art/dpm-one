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

## Employee management API

All employee-management endpoints require an administrator bearer token:
- `POST /api/v1/employees` — create an employee with a temporary password (minimum 14 characters)
- `GET /api/v1/employees` — list employees; optional `active=true|false`, `limit`, `offset`
- `PATCH /api/v1/employees/{employee_id}` — update name, role, or active status

Supported roles: `admin`, `manager`, `sales`, `accounts`, `operations`, `staff`.
The API never returns password hashes. Change temporary passwords through a dedicated password-reset flow before broader staff rollout.

## DPM ONE business workflows now scaffolded

Authenticated APIs currently cover:
- Employee directory and administrator-managed role/status updates.
- Customer master records and contact register (including an explicit contact-consent field).
- CRM lead records and pipeline stage updates.
- Follow-up scheduling, assignment, and completion.
- Site visit requests with server-enforced mandatory ₹5,000 base fee + 18% GST (₹5,900 total); the client cannot override the amount. Accounts/admin payment confirmation is required before the visit becomes confirmed.
- Quotations with BOQ-style line items, HSN/SAC field, quantity, unit, rate, line GST, subtotal, GST total, and total; money is stored in integer paise to avoid floating-point rounding errors.
- Quotation state workflow: draft → pending approval → approved → sent → accepted/rejected, with manager/admin approval.

These are API foundations, not a finished production ERP. UI screens, full project execution, purchase/inventory/accounting ledgers, PDF invoice generation, e-invoicing/e-way bill integrations, and comprehensive audit event coverage remain to be implemented and tested.

## Legal, security, and corporate governance baseline

Design targets (not a certification or legal-compliance claim):
- India-first GST data capture: customer legal name, GSTIN, place/state code, HSN/SAC, line-level tax rate, tax totals, and immutable issued-document snapshots must be completed before statutory invoice use.
- India privacy: define purpose limitation, notice/consent where required, access/correction/erasure request handling, retention schedule, processor/vendor contracts, and breach response aligned to applicable DPDP Act 2023 rules and commencement notifications. Obtain Indian legal/tax review before production.
- Global privacy readiness where applicable: GDPR/UK GDPR data-subject workflows, lawful basis, international transfer review, and regional retention controls.
- Security: least-privilege RBAC, MFA, short-lived tokens, rate limiting, password reset, session revocation, TLS, encryption at rest, secrets rotation, vulnerability/dependency scanning, and incident response.
- Corporate controls: maker-checker approvals, segregation of duties, quote revision history, approval thresholds, immutable audit trail, document numbering, backups, restore drills, disaster recovery, and access reviews.
- Standards alignment target: ISO/IEC 27001 control mapping and SOC 2 trust-services evidence readiness. DPM ONE is not currently certified or audited against either standard.

Do not use this foundation to issue statutory tax invoices or process sensitive production data until migration strategy, audit coverage, access controls, backup/restore, penetration testing, and professional compliance review are complete.

## Deployment paths

### Office / LAN deployment
1. Install Docker Engine and the Docker Compose plugin on the office server.
2. Copy `.env.example` to `.env`; set unique database, JWT, and bootstrap-admin passwords.
3. Run `docker compose up -d --build`.
4. Open `http://OFFICE-SERVER-IP:3000` from the office LAN. API docs are bound to server localhost on port 8000.

### Oracle Cloud production deployment
- Target hostname: `crm.dpmenterprise.in`.
- DNS: create GoDaddy A record `crm` pointing to the Oracle VM public IPv4.
- Oracle network security: allow inbound TCP 80 and 443; keep PostgreSQL 5432 closed. SSH should be restricted to trusted administrator IPs.
- Provision an Ubuntu 22.04/24.04 VM with Docker Engine and Docker Compose v2.24.4 or newer.
- Create `/opt/dpm-one/.env` on the VM using `.env.production.example`; use fresh unique secrets and `APP_ENV=production`.
- Add GitHub repository Actions secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`. Never commit the private key or production `.env`.
- Run the guarded `DPM ONE Cloud Deploy` workflow manually and enter `DEPLOY` as confirmation. Caddy obtains and renews HTTPS certificates after DNS and firewall are correct.
- First-time only, create the administrator after deployment with `docker compose -f docker-compose.yml -f docker-compose.cloud.yml exec -T api python -m app.bootstrap_admin`. Keep the bootstrap password private and change the operating credentials through the approved admin process.

The cloud workflow is prepared but cannot deploy until the VM, DNS, server .env file, and four GitHub Actions secrets exist. This repository does not contain or infer any server IP or SSH private key.

### Current production-readiness boundary
The current build provides the first CRM/HR/quotation/site-visit screens and APIs. It is not yet a complete 41-module ERP. Project execution, procurement, inventory, accounting, GST statutory document issuance, full password reset/MFA, comprehensive field-level authorization, penetration testing, backup restore drills, and cloud-office synchronization still require implementation and verification. Obtain professional Indian tax/legal review before statutory use.
