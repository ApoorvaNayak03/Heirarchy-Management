from __future__ import annotations

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User
from app.utils.auth import get_password_hash


def seed_database(db: Session | None = None):
    """Initialize only when the database has no users. No demo hierarchy data."""
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        if db.query(User).first():
            return
        _seed_users(db)
        db.commit()
    finally:
        if own_session:
            db.close()


def _seed_users(db: Session):
    users = [
        ("admin", "admin123", "Administrator", "Business Owner"),
        ("scm_manager", "password123", "SCM Manager", "Supply Chain Manager"),
        ("data_governance", "password123", "Data Governance", "Data Governance Manager"),
        ("business_owner", "password123", "Business Owner", "Business Owner"),
    ]
    for username, password, display_name, role in users:
        db.add(
            User(
                username=username,
                password_hash=get_password_hash(password),
                display_name=display_name,
                role=role,
            )
        )
    db.flush()
