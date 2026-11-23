# DPM ONE Backend Audit (2026-11-23)

## Repository snapshot
- Repo: dpmenterprise2007-art/dpm-one
- Base branch: main
- Audit/implementation branch: audit/backend-gap-analysis
- Stack: React/Vite frontend, FastAPI backend, SQLAlchemy, Alembic
- Existing CI workflow: backend pytest + Alembic migration + frontend TypeScript/Vite build + Compose validation
- Existing deployment workflow: VPS over SSH using Docker Compose; this is **not** Cloudflare Pages/Workers deployment.

## Verified modules/routes
- Authentication: POST /api/v1/auth/login; GET /api/v1/auth/me
- Leads: POST/GET /api/v1/leads; GET /api/v1/leads/{id}; PATCH /api/v1/leads/{id}
- Employees: POST/GET /api/v1/employees; PATCH /api/v1/employees/{id} (admin-only)
- CRM & Commercial: customers POST/GET; contacts POST/GET; follow-ups POST/GET/PATCH complete; site visits POST/GET/PATCH payment verification; quotations POST/GET/GET lines/PATCH status
- System: GET /health

## Critical gaps
1. Leads have no DELETE endpoint; customer/contact/follow-up/site-visit/quotation APIs lack complete CRUD (not all entities have read-by-id, update, or delete).
2. Backend router registration currently includes auth, leads, employees, and crm only.
3. No dedicated endpoints/modules found in the inspected tree for projects/site execution, procurement, vendors, inventory, warehouse, finance/accounts, expenses, payments, HR attendance/payroll, tender/GeM, document management, analytics/reporting, AI agents, or automation scheduler.
4. Frontend has Overview, Leads, Employees, Customers, Contacts, Follow-ups, Site Visits, and Quotations; its sidebar labels Projects/Procurement/Finance as “COMING NEXT”. Frontend form/table workflow is largely create/list, with a few specialized updates; delete and broad edit workflows are absent.
5. Security review remains incomplete: verify JWT expiry/algorithm, password policy, role checks for every mutation, employee admin authorization, CORS production allowlist, audit log resilience, and token storage/CSRF tradeoffs.
6. Database review remains incomplete: verify migration parity, indexes, foreign keys, uniqueness, production PostgreSQL settings, backup/restore and retention.
7. Test gaps: only current test file reviewed; coverage is focused on health/auth, lead create/list, employee authorization, customer/contact, fixed site-visit fee, quotation GST, audit log and payment verification. No tests for all modules (which are absent), lead update/get, pagination/filter edge cases, invalid transitions, permission matrix, persistent DB round-trip against production-like DB, concurrency or backup/restore.
8. Frontend integration needs a full pass: API base URL, token/session handling, request failures, loading/empty states, form validation, response schemas, CRUD completeness, accessibility and mobile behavior.

## Implementation sequence
- Phase 1: Close safe CRUD gaps in existing modules, add tests (starting with Lead DELETE), and validate via CI.
- Phase 2: Strengthen auth/authorization, schemas, database constraints/migrations, test coverage.
- Phase 3: Add Customers/Contacts/Follow-ups/Site visits/Quotations full CRUD and frontend integration.
- Phase 4: Build Projects/Site execution, Procurement/Vendors, Inventory/Warehouse, Finance, HR, Tender/GeM, Documents, MIS, AI/automation modules with migrations, APIs, UI and tests.
- Phase 5: Configure Cloudflare production architecture and CI deploy pipeline; secrets remain in GitHub/Cloudflare, never committed.
- Phase 6: Live acceptance: login, module CRUD, persistence after restart, role permissions, health/API smoke tests. Release status only becomes LIVE & VERIFIED when evidence passes.

## Release status
PENDING. This audit is based on repository source inspection; no local build, full test suite, or production deployment has been executed in this session.
