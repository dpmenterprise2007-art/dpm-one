from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class LeadCreate(BaseModel):
    company_name: str = Field(min_length=2, max_length=200)
    contact_name: str = Field(min_length=2, max_length=160)
    phone: str = Field(min_length=7, max_length=32)
    email: str | None = Field(default=None, max_length=254)
    project_type: str = Field(default="interior", max_length=100)
    estimated_value: int | None = Field(default=None, ge=0)
    stage: str = Field(default="new", max_length=40)
    notes: str | None = None

class LeadUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=2, max_length=200)
    contact_name: str | None = Field(default=None, min_length=2, max_length=160)
    phone: str | None = Field(default=None, min_length=7, max_length=32)
    email: str | None = Field(default=None, max_length=254)
    project_type: str | None = Field(default=None, max_length=100)
    estimated_value: int | None = Field(default=None, ge=0)
    stage: str | None = Field(default=None, max_length=40)
    notes: str | None = None

class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_name: str
    contact_name: str
    phone: str
    email: str | None
    project_type: str
    estimated_value: int | None
    stage: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
