# DPM Secure CRM — Cloudflare D1 Production Implementation Plan

**Status:** Architecture selected; implementation not yet deployed  
**Target branch:** `feature/cloudflare-d1-secure-crm`  
**Base branch:** `main`  
**Decision:** Option A — Cloudflare-native D1 (SQLite-based)  
**Production changes:** Not authorized by this plan

## 1. Decision and implications

DPM has selected a Cloudflare-only application and database architecture. The database will be Cloudflare D1, which is SQLite-based. This explicitly replaces the earlier PostgreSQL requirement for the selected deployment path.

D1 is not PostgreSQL. Existing PostgreSQL-specific connection code, the `psycopg` driver, PostgreSQL SQL syntax, and direct SQLAlchemy engine/session assumptions must not be carried into the D1 runtime unchanged. The application must use the D1 Worker binding API through a tested persistence adapter.

Cloudflare documents D1 as a managed SQLite database accessed through a Worker binding, including from Python Workers. D1 is single-threaded per database. Current published limits include a 10 GB maximum database size on Workers Paid (500 MB Free), 30 days Time Travel on Workers Paid (7 days Free), and a 2 MB maximum string/BLOB/row size. Capacity and plan suitability must be checked against actual CRM data volume and load tests before production.

## 2. Target architecture

- **Source control:** Existing GitHub repository `dpmenterprise2007-art/dpm-one`.
- **Frontend:** Existing React 18 + Vite application, built as static assets and served through Cloudflare Workers static assets (preferred single-origin setup) or Pages if the account/project is already configured that way.
- **API:** Existing FastAPI application hosted on a Cloudflare Python Worker, subject to a compatibility spike for the ASGI entry point and runtime bindings.
- **Database:** Cloudflare D1, accessed using the D1 binding API. The Worker binding name will be `DB`; the real database ID is created in the Cloudflare account and must never be guessed or committed as a secret.
- **Files:** Private Cloudflare R2 bucket for customer/project documents; authorise access in the API and use short-lived upload/download URLs where appropriate.
- **Background jobs:** Cloudflare Queues only for work that needs retries or asynchronous processing (for example reminders and imports); not a prerequisite for the first secure CRM release.
- **Secrets/configuration:** Cloudflare Worker secrets and environment-specific variables. No production secrets in GitHub.
- **Deployment:** GitHub branch/PR workflow with Cloudflare preview deployments. Production branch remains `main`; feature branches must not trigger production deployment.

## 3. Current repository facts to preserve and address

The audited `main` branch contains React/Vite, FastAPI, SQLAlchemy, Alembic, `psycopg[binary]`, and Docker Compose PostgreSQL configuration. The application settings currently include a SQLite fallback, while the existing database module constructs a SQLAlchemy engine globally. The Alembic configuration also contains a SQLite URL. The current deployment workflow uses VPS SSH and Docker Compose.

The CRM model includes users, leads, customers, contacts, follow-ups, site visits, quotations, quotation lines, and audit logs. The SiteVisit defaults enforce a ₹5,000 base fee, 18% GST, and ₹5,900 total. Preserve this business rule.

Before changing persistence, inspect every router, schema, model, migration, and test. The existing PostgreSQL development setup is not evidence that a live production database exists, and no live database should be read, migrated, modified, or deleted as part of this branch preparation.

## 4. Implementation workstreams

### Workstream A — Runtime and persistence compatibility spike

1. Add a minimal Cloudflare Python Worker entry point using the supported ASGI adapter for FastAPI.
2. Bind a non-production D1 database as `DB` in Wrangler configuration.
3. Prove that the D1 binding is accessible from the Python Worker and can be safely passed into FastAPI request handling. Do not assume a global SQLAlchemy engine can use the D1 binding.
4. Implement a request-scoped D1 persistence adapter using prepared statements and bound parameters. Keep SQL construction parameterized.
5. Define transaction boundaries using D1-supported batch/transaction behavior and test rollback/error cases.
6. Prove health, create/read/update, concurrent requests, and error handling on a disposable preview database.
7. Record unsupported ORM/query features and refactor only the required repository/service layer. Do not silently emulate PostgreSQL semantics.

**Exit gate:** A repeatable preview deployment can execute authenticated CRUD against disposable D1 with no PostgreSQL or SQLite file driver.

### Workstream B — Schema and migrations

1. Inventory all SQLAlchemy models, constraints, indexes, foreign-key assumptions, server defaults, timestamp handling, and migration history.
2. Produce explicit D1-compatible SQL migrations under a versioned migrations directory.
3. Add required indexes for lead ownership, assignment, stage, follow-up due dates, customer lookup, quotation lookup, and audit chronology.
4. Add a lead assignment field and assignment-history records; backfill rules must be explicit for any existing records.
5. Add session/revocation and MFA persistence structures only after threat-model and schema review.
6. Use integer paise for monetary calculations and preserve the existing site-visit fee enforcement on the server.
7. Test migrations from an empty D1 database and from a representative anonymised fixture. Never run migrations against production in this phase.

### Workstream C — Authorization and data isolation

Implement server-side authorization on every list, detail, create, update, delete, export, and related-record route.

- Super Admin/Director: authorised full access.
- Sales Manager: assigned team scope.
- Sales Executive: assigned leads only.
- Estimation, Accounts, and Operations: least-privilege access to their permitted workflows and related records.
- Reject cross-user object IDs even if a user guesses an ID or calls the API directly.
- Scope customer/contact/follow-up/site-visit/quotation access through the linked lead/customer ownership rules.
- Add negative tests for IDOR, mass assignment, role escalation, and export leakage.

### Workstream D — Authentication and security

- Retain Argon2 password hashing.
- Add MFA before broad staff rollout.
- Add short-lived access credentials, rotating/revocable sessions, logout-all, password reset, and immediate employee offboarding.
- Apply rate limits to login, OTP/MFA, and sensitive endpoints.
- Configure exact allowed origins, HTTPS, secure headers/CSP, and CSRF protection if cookie authentication is selected.
- Audit authentication events, record reads where appropriate, all writes, deletes, approvals, and exports. Audit failures must be observable and alertable; do not silently swallow all audit persistence failures.
- Store secrets only in Cloudflare secrets. Review the repository and Git history for accidentally committed credentials before production.

### Workstream E — Frontend and mobile experience

- Preserve the existing React/Vite visual system and current V10 product identity; do not replace it with a new template.
- Make CRM screens responsive for mobile and desktop.
- Implement role-aware navigation and server-authoritative permission handling.
- Add clear loading, empty, validation, denied-access, and offline states.
- Add PWA installability only after authentication/session behavior is tested on mobile browsers.

### Workstream F — Cloudflare delivery and operations

- Add Wrangler configuration with separate preview/staging and production D1 bindings.
- Use separate D1 databases for preview/staging and production. Never point preview builds at production D1.
- Configure GitHub-to-Cloudflare integration or Workers Builds with production branch pinned to `main`; feature branches get preview deployments only.
- Replace the VPS SSH workflow only after the Cloudflare preview pipeline is verified. Disable/remove the VPS deployment path in a separately reviewed change; do not execute it.
- Configure R2 private bucket access if document storage is in scope.
- Configure D1 Time Travel/backup policy, export procedure, restore drill, retention, monitoring, and incident response.
- Check D1 limits and query performance against realistic test data. D1 is single-threaded per database; keep transactions short and index hot queries.

## 5. Safe branch and release process

1. Work only on `feature/cloudflare-d1-secure-crm` for implementation.
2. Keep `main` unchanged.
3. Use complete-file replacements where a file is edited; inspect the current file first.
4. Add automated tests and CI checks before opening a draft PR.
5. Use a disposable D1 preview database for migrations and integration tests.
6. Do not create or alter a production D1 database, bind a production database ID, import customer data, configure production secrets, or deploy production without separate explicit approval.
7. Do not merge the PR or change the production branch as part of preparation.

## 6. Test and acceptance gates

- Python Worker + FastAPI startup and health endpoint.
- D1 binding CRUD, prepared statement parameterization, transaction/batch behavior.
- Migration from empty database and fixture restore.
- Authentication, MFA, refresh/session revocation, offboarding.
- Sales Executive cannot list, view, edit, or export another employee's leads.
- Manager team-scope tests and Director access tests.
- Customer/contact/follow-up/site-visit/quotation ownership enforcement.
- Site visit fee is always ₹5,000 + 18% GST = ₹5,900; client input cannot override it.
- Quotation calculations use integer paise and deterministic rounding.
- Audit coverage for sensitive reads/writes/exports and approval events.
- 10+ user accounts, mobile and desktop QA, and load test for expected concurrent usage.
- Backup/export and restore drill documented and passed.
- Dependency/security scan and review of Git history for secrets.

## 7. Risks and decision notes

- **SQLite semantic differences:** D1 is SQLite-based, not PostgreSQL. SQLAlchemy and PostgreSQL-specific code require a deliberate persistence redesign.
- **Single-threaded database:** D1 processes queries serially per database. Indexes, short transactions, batching, and realistic load testing are required.
- **Size/row limits:** Validate current and projected CRM documents/data volume; large files belong in R2, not D1 rows.
- **Audit immutability:** Application-level append-only conventions are not equivalent to tamper-proof independent audit storage; define operational controls and export/retention.
- **Original V10 source:** The repository is the currently audited codebase. Any separately uploaded V10 archive/design assets remain authoritative for product/UI preservation and must be reconciled before UI changes.

## 8. Explicit non-actions in this phase

No production deployment, no production D1 creation or binding, no production secrets, no customer-data migration/import, no live schema changes, no merge to `main`, no repository visibility change, and no execution of the existing VPS workflow.
