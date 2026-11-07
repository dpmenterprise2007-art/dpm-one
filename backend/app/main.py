from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import SessionLocal
from . import models
from .security import decode_access_token
from .routers.auth import router as auth_router
from .routers.leads import router as leads_router
from .routers.employees import router as employees_router
from .routers.crm import router as crm_router

if settings.app_env == "production" and settings.jwt_secret_key == "DEV_ONLY_CHANGE_THIS_SECRET_BEFORE_DEPLOYMENT":
    raise RuntimeError("Set a strong JWT_SECRET_KEY before production startup.")

app = FastAPI(title=settings.app_name, version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def write_audit_event(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    response = await call_next(request)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and response.status_code < 400 and request.url.path.startswith("/api/"):
        actor_id = None
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            try:
                actor_id = int(decode_access_token(authorization[7:]).get("sub", ""))
            except Exception:
                actor_id = None
        parts = [part for part in request.url.path.split("/") if part]
        entity_type = parts[2] if len(parts) > 2 else "api"
        entity_id = parts[3] if len(parts) > 3 else None
        try:
            with SessionLocal() as db:
                db.add(models.AuditLog(
                    actor_user_id=actor_id,
                    action=request.method.lower(),
                    entity_type=entity_type,
                    entity_id=entity_id,
                    ip_address=request.client.host if request.client else None,
                    request_id=request_id,
                ))
                db.commit()
        except Exception:
            # Business request success must not be converted into a 500 by audit sink failure.
            pass
    response.headers["X-Request-ID"] = request_id
    return response

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "dpm-one-api", "environment": settings.app_env}

app.include_router(auth_router)
app.include_router(leads_router)
app.include_router(employees_router)
app.include_router(crm_router)
