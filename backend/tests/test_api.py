import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
import app.main as main_module
from app.models import User
from app.security import hash_password, create_access_token

TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

@pytest.fixture()
def client(monkeypatch):
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(main_module, "SessionLocal", TestingSessionLocal)
    with TestingSessionLocal() as db:
        db.add(User(
            email="admin@example.com",
            full_name="DPM Test Admin",
            password_hash=hash_password("Test-Only-Password-2026!"),
            role="admin",
            is_active=True,
        ))
        db.commit()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)

def admin_token():
    return create_access_token(1, "admin")

def test_health_is_public(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_login_returns_bearer_token(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "Test-Only-Password-2026!",
    })
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"]

def test_leads_require_authentication(client):
    response = client.get("/api/v1/leads")
    assert response.status_code == 401

def test_admin_can_create_and_list_leads(client):
    headers = {"Authorization": f"Bearer {admin_token()}"}
    created = client.post("/api/v1/leads", headers=headers, json={
        "company_name": "Example Corporate Ltd",
        "contact_name": "Test Contact",
        "phone": "9876543210",
        "project_type": "Corporate Interior",
        "estimated_value": 1500000,
    })
    assert created.status_code == 201
    assert created.json()["company_name"] == "Example Corporate Ltd"

    listed = client.get("/api/v1/leads", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

def test_admin_can_create_employee(client):
    headers = {"Authorization": f"Bearer {admin_token()}"}
    response = client.post("/api/v1/employees", headers=headers, json={
        "email": "staff@example.com",
        "full_name": "Test Staff",
        "temporary_password": "Temporary-Password-2026!",
        "role": "sales",
    })
    assert response.status_code == 201
    assert response.json()["role"] == "sales"
    assert "password_hash" not in response.json()

def test_non_admin_cannot_manage_employees(client):
    from app.models import User
    with TestingSessionLocal() as db:
        db.add(User(
            email="staff2@example.com",
            full_name="Regular Staff",
            password_hash=hash_password("Test-Only-Password-2026!"),
            role="staff",
            is_active=True,
        ))
        db.commit()
        staff_id = db.query(User).filter_by(email="staff2@example.com").one().id

    token = create_access_token(staff_id, "staff")
    response = client.get("/api/v1/employees", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_customer_and_contact_workflow(client):
    headers = {"Authorization": f"Bearer {admin_token()}"}
    customer = client.post("/api/v1/customers", headers=headers, json={
        "legal_name": "DPM Test Customer Pvt Ltd",
        "customer_type": "company",
        "gstin": "27ABCDE1234F1Z5",
        "phone": "9876543210",
    })
    assert customer.status_code == 201
    customer_id = customer.json()["id"]
    contact = client.post("/api/v1/contacts", headers=headers, json={
        "customer_id": customer_id,
        "full_name": "Procurement Manager",
        "phone": "9876543211",
        "consent_to_contact": True,
    })
    assert contact.status_code == 201
    assert contact.json()["customer_id"] == customer_id

def test_site_visit_fee_is_server_enforced(client):
    headers = {"Authorization": f"Bearer {admin_token()}"}
    lead = client.post("/api/v1/leads", headers=headers, json={
        "company_name": "Site Visit Client Ltd",
        "contact_name": "Site Contact",
        "phone": "9876543210",
        "project_type": "Corporate Interior",
    })
    assert lead.status_code == 201
    visit = client.post("/api/v1/site-visits", headers=headers, json={
        "lead_id": lead.json()["id"],
        "scheduled_at": "2026-12-01T10:00:00Z",
        "site_address": "Business Park, Mumbai",
        "contact_person": "Site Contact",
        "contact_phone": "9876543210",
        "fee_basic": 0,
        "fee_total": 0,
    })
    assert visit.status_code == 201
    assert visit.json()["fee_basic"] == 5000
    assert visit.json()["gst_rate_basis_points"] == 1800
    assert visit.json()["fee_total"] == 5900
    assert visit.json()["payment_status"] == "pending"

def test_quotation_calculates_gst_in_integer_paise(client):
    headers = {"Authorization": f"Bearer {admin_token()}"}
    customer = client.post("/api/v1/customers", headers=headers, json={"legal_name":"Quotation Test Pvt Ltd"})
    assert customer.status_code == 201
    quotation = client.post("/api/v1/quotations", headers=headers, json={
        "customer_id": customer.json()["id"],
        "title": "Office interior BOQ",
        "lines": [{
            "description": "Modular workstation",
            "hsn_sac": "940330",
            "quantity": "10",
            "unit": "Nos",
            "rate_inr": "12500.00",
            "gst_rate": "18",
        }],
    })
    assert quotation.status_code == 201
    assert quotation.json()["subtotal_paise"] == 12500000
    assert quotation.json()["gst_paise"] == 2250000
    assert quotation.json()["total_paise"] == 14750000

def test_successful_mutations_create_audit_event(client):
    from app.models import AuditLog
    headers = {"Authorization": f"Bearer {admin_token()}"}
    response = client.post("/api/v1/customers", headers=headers, json={"legal_name":"Audit Trail Test Ltd"})
    assert response.status_code == 201
    with TestingSessionLocal() as db:
        event = db.query(AuditLog).filter_by(entity_type="customers", entity_id=str(response.json()["id"])).first()
        assert event is not None
        assert event.actor_user_id == 1

def test_accounts_can_record_site_visit_payment_verification(client):
    headers = {"Authorization": f"Bearer {admin_token()}"}
    lead = client.post("/api/v1/leads", headers=headers, json={
        "company_name": "Payment Verification Ltd",
        "contact_name": "Accounts Contact",
        "phone": "9876543210",
    })
    visit = client.post("/api/v1/site-visits", headers=headers, json={
        "lead_id": lead.json()["id"],
        "scheduled_at": "2026-12-02T10:00:00Z",
        "site_address": "Mumbai Business Park",
        "contact_person": "Accounts Contact",
        "contact_phone": "9876543210",
    })
    paid = client.patch(f"/api/v1/site-visits/{visit.json()['id']}/payment", headers=headers, json={"payment_reference":"UTR-TEST-123456"})
    assert paid.status_code == 200
    assert paid.json()["payment_status"] == "paid"
    assert paid.json()["visit_status"] == "confirmed"
    with TestingSessionLocal() as db:
        stored = db.get(__import__("app.models", fromlist=["SiteVisit"]).SiteVisit, visit.json()["id"])
        assert stored.payment_reference == "UTR-TEST-123456"
        assert stored.payment_verified_by == 1
        assert stored.payment_verified_at is not None
