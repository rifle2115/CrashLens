import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# DATABASE_URL is read from the environment. The fallback is the original
# local-dev value, so anyone running without an .env keeps prior behavior.
# Override via env var in containers / CI / prod.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:1234@localhost:5432/CrashLens",
)

# Some managed Postgres providers (Render, Heroku) hand out URLs with the
# legacy "postgres://" scheme, which SQLAlchemy 2.0 no longer recognizes.
# Normalize to "postgresql://". No-op for AWS RDS (already postgresql://).
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
