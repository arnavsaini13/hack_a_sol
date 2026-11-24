"""
Main FastAPI Application Entrypoint.
Agricultural Policy, Loan & Subsidy Transparency Platform.
"""
import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.database import engine, Base, SessionLocal, init_db
from app.routers import (
    auth_router,
    farmer_router,
    bank_router,
    policy_router,
    rules_router,
    chat_router,
)
from app.seed.seed_data import seed_database
from app.models.entities import Farmer

# Slowapi rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize database schema and migrations
init_db()

# Auto-seed if database is freshly initialized and empty (e.g. newly connected Supabase Postgres)
def _ensure_initial_seed():
    db = SessionLocal()
    try:
        if db.query(Farmer).count() == 0:
            print("[INFO] Database is empty. Seeding initial records...")
            seed_database(db)
            print("[INFO] Seeding completed.")
    except Exception as e:
        print(f"[WARN] Initial seed check bypassed: {e}")
    finally:
        db.close()

_ensure_initial_seed()

app = FastAPI(
    title="Agricultural Policy, Loan & Subsidy Transparency Platform",
    description="Statutory rule-based transparency platform for paddy farmers, bank officers, and policymakers in Chhattisgarh.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration for Web, Vercel, and Android Capacitor APK
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
]

cors_env = os.getenv("CORS_ORIGINS", "").strip()

if cors_env == "*":
    # Wildcard mode
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    allowed_list = list(default_origins)
    if cors_env:
        for origin in cors_env.split(","):
            cleaned = origin.strip().rstrip("/")
            if cleaned and cleaned not in allowed_list:
                allowed_list.append(cleaned)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include Routers
app.include_router(auth_router.router, prefix="/api/auth")
app.include_router(auth_router.router, prefix="/api/v1/auth")
app.include_router(farmer_router.router, prefix="/api/farmer")
app.include_router(farmer_router.router, prefix="/api/v1/farmer")
app.include_router(bank_router.router, prefix="/api/bank")
app.include_router(bank_router.router, prefix="/api/v1/bank")
app.include_router(policy_router.router)
app.include_router(rules_router.router)
app.include_router(chat_router.router)


@app.get("/health")
def health_check():
    """Health check endpoint for Render/Railway cloud orchestrators."""
    return {"status": "ok"}


@app.get("/")
def root():
    return {
        "service": "Agricultural Policy, Loan & Subsidy Transparency Platform",
        "status": "OPERATIONAL",
        "trust_bar": {
            "mode": "JanAgriPortal Deterministic State Engine",
            "rules_last_verified": "2026-03-01",
            "zero_ai_math": True,
        },
        "docs": "/docs",
    }

