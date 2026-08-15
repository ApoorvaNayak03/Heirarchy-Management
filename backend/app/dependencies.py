from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.utils.auth import decode_access_token
from app.utils.enums import EDITABLE_VERSION_STATUSES, VersionStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/signin")


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    user = db.query(User).filter(User.username == payload["sub"], User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def serialize_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def assert_version_editable(status_value: str) -> None:
    if status_value not in {s.value for s in EDITABLE_VERSION_STATUSES}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Version with status {status_value} is read-only and cannot be modified",
        )


def can_user_act_on_step(user: User, approver_role_or_user: str) -> bool:
    return user.username == approver_role_or_user or user.role == approver_role_or_user
