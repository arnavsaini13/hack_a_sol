"""
Alias for app.seed.seed_data to support alternative invocation paths.
"""
from app.seed.seed_data import seed_database
from app.database import SessionLocal

if __name__ == "__main__":
    session = SessionLocal()
    try:
        seed_database(session)
    finally:
        session.close()
