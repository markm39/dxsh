"""
Database Configuration for Dashboard Service
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dashboard_service.db")

# Create database engine
engine = create_engine(DATABASE_URL, echo=False)

# Create sessionmaker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)