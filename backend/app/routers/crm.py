from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import Contact, Customer, FollowUp, Lead, Quotation, QuotationLine, SiteVisit, User

router = APIRouter(prefix="/api/v1", tags=["CRM & Commercial"], dependencies=[Depends(get_current_user)])

class CustomerIn(BaseModel):
    legal_name: str = Field(min_length=2, max_length=200)
    customer_type: str = "company"
    gstin: str | None = Field(default=None, min_length=15, max_length=15)
    pan: str | None = Field(default=None, min_length=10, max_length=10)
    billing_address: str | None = None
    shipping_address: str | None = None
    state_code: str | None = Field(default=None, min_length=2, max_length=2)
    email: EmailStr | None = None
    phone: str | None = None

class CustomerOut(BaseModel):
    id: int
    legal_name: str
    customer_type: str
    gstin: str | None
    pan: str | None
    billing_address: str | None
    shipping_address: str | None
    state_code: str | None
    email: str | None
    phone: str | None
    status: str
    model_config = {"from_attributes": True}

@router.post("/customers", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerIn, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("gstin"):
        data["gstin"] = data["gstin"].upper()
        if db.scalar(select(Customer).where(Customer.gstin == data["gstin"])):
            raise HTTPException(409, "GSTIN already exists")
    if data.get("pan"):
        data["pan"] = data["pan"].upper()
    customer = Customer(**data)
    db.add(customer); db.commit(); db.refresh(customer)
    return customer

@router.get("/customers", response_model=list[CustomerOut])
def list_customers(q: str | None = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    stmt = select(Customer).order_by(Customer.legal_name).limit(limit).offset(offset)
    if q:
        stmt = stmt.where(Customer.legal_name.ilike(f"%{q}%"))
    return list(db.scalars(stmt).all())

class ContactIn(BaseModel):
    customer_id: int | None = None
    full_name: str = Field(min_length=2, max_length=160)
    designation: str | None = None
    email: EmailStr | None = None
    phone: str = Field(min_length=7, max_length=32)
    is_primary: bool = False
    consent_to_contact: bool = False

class ContactOut(BaseModel):
    id: int
    customer_id: int | None
    full_name: str
    designation: str | None
    email: str | None
    phone: str
    is_primary: bool
    consent_to_contact: bool
    model_config = {"from_attributes": True}

@router.post("/contacts", response_model=ContactOut, status_code=201)
def create_contact(payload: ContactIn, db: Session = Depends(get_db)):
    if payload.customer_id and not db.get(Customer, payload.customer_id):
        raise HTTPException(404, "Customer not found")
    contact = Contact(**payload.model_dump())
    db.add(contact); db.commit(); db.refresh(contact)
    return contact

@router.get("/contacts", response_model=list[ContactOut])
def list_contacts(customer_id: int | None = None, limit: int = Query(100, ge=1, le=200), db: Session = Depends(get_db)):
    stmt = select(Contact).order_by(Contact.full_name).limit(limit)
    if customer_id:
        stmt = stmt.where(Contact.customer_id == customer_id)
    return list(db.scalars(stmt).all())

class FollowUpIn(BaseModel):
    lead_id: int
    assigned_to: int | None = None
    due_at: datetime
    channel: str = Field(default="call", pattern="^(call|email|whatsapp|meeting|other)$")
    notes: str | None = None

class FollowUpOut(BaseModel):
    id: int
    lead_id: int
    assigned_to: int | None
    due_at: datetime
    channel: str
    notes: str | None
    status: str
    completed_at: datetime | None
    model_config = {"from_attributes": True}

@router.post("/follow-ups", response_model=FollowUpOut, status_code=201)
def create_follow_up(payload: FollowUpIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not db.get(Lead, payload.lead_id):
        raise HTTPException(404, "Lead not found")
    if payload.assigned_to and not db.get(User, payload.assigned_to):
        raise HTTPException(404, "Assigned employee not found")
    item = FollowUp(**payload.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item

@router.get("/follow-ups", response_model=list[FollowUpOut])
def list_follow_ups(status_filter: str | None = Query(default=None, alias="status"), due_before: datetime | None = None, db: Session = Depends(get_db)):
    stmt = select(FollowUp).order_by(FollowUp.due_at).limit(200)
    if status_filter:
        stmt = stmt.where(FollowUp.status == status_filter)
    if due_before:
        stmt = stmt.where(FollowUp.due_at <= due_before)
    return list(db.scalars(stmt).all())

@router.patch("/follow-ups/{follow_up_id}/complete", response_model=FollowUpOut)
def complete_follow_up(follow_up_id: int, db: Session = Depends(get_db)):
    item = db.get(FollowUp, follow_up_id)
    if not item:
        raise HTTPException(404, "Follow-up not found")
    item.status = "completed"
    item.completed_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(item)
    return item

class SiteVisitIn(BaseModel):
    lead_id: int
    scheduled_at: datetime
    site_address: str = Field(min_length=8)
    contact_person: str = Field(min_length=2, max_length=160)
    contact_phone: str = Field(min_length=7, max_length=32)
    scope_notes: str | None = None

class SiteVisitOut(BaseModel):
    id: int
    lead_id: int
    scheduled_at: datetime
    site_address: str
    contact_person: str
    contact_phone: str
    scope_notes: str | None
    fee_basic: int
    gst_rate_basis_points: int
    fee_total: int
    payment_status: str
    visit_status: str
    model_config = {"from_attributes": True}

@router.post("/site-visits", response_model=SiteVisitOut, status_code=201)
def request_site_visit(payload: SiteVisitIn, db: Session = Depends(get_db)):
    if not db.get(Lead, payload.lead_id):
        raise HTTPException(404, "Lead not found")
    # Mandatory DPM policy: ₹5,000 base fee + 18% GST. Client cannot override it.
    visit = SiteVisit(**payload.model_dump(), fee_basic=5000, gst_rate_basis_points=1800, fee_total=5900, payment_status="pending", visit_status="requested")
    db.add(visit); db.commit(); db.refresh(visit)
    return visit

@router.get("/site-visits", response_model=list[SiteVisitOut])
def list_site_visits(visit_status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(SiteVisit).order_by(SiteVisit.scheduled_at.desc()).limit(200)
    if visit_status:
        stmt = stmt.where(SiteVisit.visit_status == visit_status)
    return list(db.scalars(stmt).all())

class QuotationLineIn(BaseModel):
    description: str = Field(min_length=2)
    hsn_sac: str | None = None
    quantity: Decimal = Field(gt=0)
    unit: str = "Nos"
    rate_inr: Decimal = Field(ge=0)
    gst_rate: Decimal = Field(default=Decimal("18"), ge=0, le=100)

class QuotationIn(BaseModel):
    customer_id: int
    lead_id: int | None = None
    title: str = Field(min_length=2, max_length=200)
    valid_until: datetime | None = None
    terms: str | None = None
    lines: list[QuotationLineIn] = Field(min_length=1, max_length=300)

class QuotationLineOut(BaseModel):
    id: int
    description: str
    hsn_sac: str | None
    quantity_milli: int
    unit: str
    rate_paise: int
    gst_rate_basis_points: int
    line_total_paise: int
    model_config = {"from_attributes": True}

class QuotationOut(BaseModel):
    id: int
    quotation_number: str
    customer_id: int
    lead_id: int | None
    title: str
    status: str
    subtotal_paise: int
    gst_paise: int
    total_paise: int
    version: int
    valid_until: datetime | None
    terms: str | None
    model_config = {"from_attributes": True}

def to_minor(value: Decimal) -> int:
    return int((value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

@router.post("/quotations", response_model=QuotationOut, status_code=201)
def create_quotation(payload: QuotationIn, db: Session = Depends(get_db)):
    if not db.get(Customer, payload.customer_id):
        raise HTTPException(404, "Customer not found")
    if payload.lead_id and not db.get(Lead, payload.lead_id):
        raise HTTPException(404, "Lead not found")
    subtotal = 0
    gst_total = 0
    prepared = []
    for line in payload.lines:
        qty_milli = int((line.quantity * 1000).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        rate_paise = to_minor(line.rate_inr)
        base = int((Decimal(qty_milli) * Decimal(rate_paise) / Decimal(1000)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        gst_bp = int((line.gst_rate * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        gst = int((Decimal(base) * Decimal(gst_bp) / Decimal(10000)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        subtotal += base; gst_total += gst
        prepared.append((line, qty_milli, rate_paise, gst_bp, base + gst))
    quotation = Quotation(
        quotation_number=f"DPM-Q-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:6].upper()}",
        customer_id=payload.customer_id, lead_id=payload.lead_id, title=payload.title,
        subtotal_paise=subtotal, gst_paise=gst_total, total_paise=subtotal + gst_total,
        valid_until=payload.valid_until, terms=payload.terms, status="draft", version=1
    )
    db.add(quotation); db.flush()
    for line, qty_milli, rate_paise, gst_bp, line_total in prepared:
        db.add(QuotationLine(quotation_id=quotation.id, description=line.description, hsn_sac=line.hsn_sac, quantity_milli=qty_milli, unit=line.unit, rate_paise=rate_paise, gst_rate_basis_points=gst_bp, line_total_paise=line_total))
    db.commit(); db.refresh(quotation)
    return quotation

@router.get("/quotations", response_model=list[QuotationOut])
def list_quotations(customer_id: int | None = None, status_filter: str | None = Query(default=None, alias="status"), db: Session = Depends(get_db)):
    stmt = select(Quotation).order_by(Quotation.created_at.desc()).limit(200)
    if customer_id:
        stmt = stmt.where(Quotation.customer_id == customer_id)
    if status_filter:
        stmt = stmt.where(Quotation.status == status_filter)
    return list(db.scalars(stmt).all())

@router.get("/quotations/{quotation_id}/lines", response_model=list[QuotationLineOut])
def get_quotation_lines(quotation_id: int, db: Session = Depends(get_db)):
    if not db.get(Quotation, quotation_id):
        raise HTTPException(404, "Quotation not found")
    return list(db.scalars(select(QuotationLine).where(QuotationLine.quotation_id == quotation_id).order_by(QuotationLine.id)).all())
