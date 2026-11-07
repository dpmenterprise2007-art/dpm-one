"""One-time initial administrator bootstrap using environment variables."""
import os
from sqlalchemy import select
from .database import Base, engine, SessionLocal
from .models import User
from .security import hash_password

def main():
    email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
    name = os.environ.get("BOOTSTRAP_ADMIN_NAME", "").strip()
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "")
    if not email or not name or len(password) < 14:
        raise SystemExit("Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME and a password of at least 14 characters.")
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)) is not None:
            raise SystemExit("An account already exists. Bootstrap is disabled.")
        db.add(User(email=email, full_name=name, password_hash=hash_password(password), role="admin", is_active=True))
        db.commit()
    print(f"Initial admin created for {email}. Store credentials in your password manager.")

if __name__ == "__main__":
    main()
