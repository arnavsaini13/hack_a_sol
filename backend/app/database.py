"""
Database configuration for SQLite and PostgreSQL (Supabase).
Uses SQLAlchemy 2.0 with automatic dialect detection, connection pooling, and event hooks.
"""
import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, DeclarativeBase
from sqlalchemy.engine import Engine

# Load environment variables from .env if present
backend_dir = Path(__file__).parent.parent
root_dir = backend_dir.parent
for env_file in [backend_dir / ".env", root_dir / ".env"]:
    if env_file.exists():
        load_dotenv(env_file)
        break
else:
    load_dotenv()

# Database file location for local fallback
DB_PATH = backend_dir / "agri_transparency.db"
DEFAULT_SQLITE_URL = f"sqlite:///{DB_PATH.as_posix()}"

# Read connection string from environment (e.g. Supabase PostgreSQL)
raw_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL") or DEFAULT_SQLITE_URL

# Safety fallback: if placeholder password is still present, warn and fallback to SQLite
if "[YOUR-DATABASE-PASSWORD]" in raw_url or "[YOUR-PASSWORD]" in raw_url:
    print("[WARN] DATABASE_URL contains placeholder password. Using SQLite until password is set in .env.")
    raw_url = DEFAULT_SQLITE_URL

# Normalize Supabase/PostgreSQL scheme for SQLAlchemy + psycopg2
# Supabase provides URIs beginning with "postgres://", but SQLAlchemy requires "postgresql://"
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)

DATABASE_URL = raw_url
IS_SQLITE = DATABASE_URL.startswith("sqlite")
IS_POSTGRES = DATABASE_URL.startswith("postgresql")

# Configure engine arguments based on dialect
engine_kwargs = {"echo": False}
connect_args = {}

if IS_SQLITE:
    connect_args["check_same_thread"] = False
elif IS_POSTGRES:
    # Supabase connection pool configuration
    engine_kwargs.update({
        "pool_size": int(os.environ.get("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", "20")),
        "pool_pre_ping": True,  # Auto-reconnect dropped connections
    })

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs
)

# Enforce WAL mode and foreign keys on SQLite connections only
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if IS_SQLITE:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass


def init_db():
    """Create all tables and perform non-destructive schema migrations."""
    # Base.metadata.create_all works across both SQLite and PostgreSQL (Supabase)
    Base.metadata.create_all(bind=engine)
    
    # SQLite-specific column additions if migrating an older local SQLite file
    if IS_SQLITE:
        try:
            conn = sqlite3.connect(str(DB_PATH), timeout=10)
            cursor = conn.cursor()
            migrations = [
                "ALTER TABLE bank_applications ADD COLUMN farmer_id VARCHAR(50)",
                "ALTER TABLE bank_applications ADD COLUMN audit_hash VARCHAR(64)",
                "ALTER TABLE bank_applications ADD COLUMN officer_id VARCHAR(50)",
                "ALTER TABLE bank_applications ADD COLUMN officer_notes TEXT",
                "ALTER TABLE bank_applications ADD COLUMN decided_at DATETIME",
                "ALTER TABLE rejections ADD COLUMN audit_hash VARCHAR(64)",
            ]
            for sql in migrations:
                try:
                    cursor.execute(sql)
                    conn.commit()
                except Exception:
                    pass
            conn.close()
        except Exception:
            pass


def get_db():
    """FastAPI Dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


