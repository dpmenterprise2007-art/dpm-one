from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..security import hash_password

router = APIRouter(prefix="/api/v1/employees", tags=["HR - Employees"])

Role = Literal["admin", "manager", "sales", "accounts", "operations", "staff"]

class EmployeeCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    temporary_password: str = Field(min_length=14, max_length=128)
    role: Role = "staff"

class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    role: Role | None = None
    is_active: bool | None = None

class EmployeeRead(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator permission required")
    return user

@router.post("", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    email = str(payload.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An employee with this email already exists")
    employee = User(email=email, full_name=payload.full_name.strip(), password_hash=hash_password(payload.temporary_password), role=payload.role, is_active=True)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee

@router.get("", response_model=list[EmployeeRead])
def list_employees(
    active: bool | None = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    stmt = select(User).order_by(User.full_name.asc()).limit(limit).offset(offset)
    if active is not None:
        stmt = stmt.where(User.is_active == active)
    return list(db.scalars(stmt).all())

@router.patch("/{employee_id}", response_model=EmployeeRead)
def update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    employee = db.get(User, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    changes = payload.model_dump(exclude_unset=True)
    if employee.id == admin.id and changes.get("is_active") is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own administrator account")
    for key, value in changes.items():
        setattr(employee, key, value)
    db.commit()
    db.refresh(employee)
    return employee
