import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
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
def client():
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
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
