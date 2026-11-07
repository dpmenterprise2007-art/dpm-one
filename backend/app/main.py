from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import Base, engine
from . import models
from .routers.auth import router as auth_router
from .routers.leads import router as leads_router
from .routers.employees import router as employees_router

if settings.app_env == "production" and settings.jwt_secret_key == "DEV_ONLY_CHANGE_THIS_SECRET_BEFORE_DEPLOYMENT":
    raise RuntimeError("Set a strong JWT_SECRET_KEY before production startup.")

Base.metadata.create_all(bind=engine)
app = FastAPI(title=settings.app_name, version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "dpm-one-api", "environment": settings.app_env}

app.include_router(auth_router)
app.include_router(leads_router)
app.include_router(employees_router)
