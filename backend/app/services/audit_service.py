from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import HierarchyChange
from app.utils.enums import ChangeAction, ChangeEntityType


class AuditService:
    @staticmethod
    def log_change(
        db: Session,
        *,
        hierarchy_id: str,
        hierarchy_version_id: str | None,
        entity_type: ChangeEntityType,
        entity_id: str,
        action: ChangeAction,
        changed_by: str,
        field_name: str | None = None,
        old_value: str | None = None,
        new_value: str | None = None,
    ) -> HierarchyChange:
        change = HierarchyChange(
            change_id=str(uuid.uuid4()),
            hierarchy_id=hierarchy_id,
            hierarchy_version_id=hierarchy_version_id,
            entity_type=entity_type.value,
            entity_id=entity_id,
            action=action.value,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=datetime.utcnow(),
        )
        db.add(change)
        return change
