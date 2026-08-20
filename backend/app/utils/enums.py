from __future__ import annotations

import enum


class EntityStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class VersionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"
    RETIRED = "RETIRED"
    CANCELLED = "CANCELLED"


class NodeStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    REMOVED = "REMOVED"


class PropertyDataType(str, enum.Enum):
    STRING = "STRING"
    NUMBER = "NUMBER"
    DATE = "DATE"
    BOOLEAN = "BOOLEAN"
    ENUM = "ENUM"
    REFERENCE = "REFERENCE"
    ROLLUP = "ROLLUP"


class AggregationFn(str, enum.Enum):
    SUM = "SUM"
    COUNT = "COUNT"
    AVG = "AVG"
    MIN = "MIN"
    MAX = "MAX"


class ApprovalRequestStatus(str, enum.Enum):
    OPEN = "OPEN"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ApprovalStepStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class LineageOperationType(str, enum.Enum):
    REUSE = "REUSE"
    CLONE = "CLONE"
    COPY_SUBTREE = "COPY_SUBTREE"


class ChangeEntityType(str, enum.Enum):
    VERSION = "VERSION"
    VERSION_NODE = "VERSION_NODE"
    EDGE = "EDGE"
    PROPERTY = "PROPERTY"
    APPROVAL = "APPROVAL"
    HIERARCHY = "HIERARCHY"
    HIERARCHY_TYPE = "HIERARCHY_TYPE"
    NODE_TYPE = "NODE_TYPE"


class ChangeAction(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    COPY = "COPY"
    MOVE = "MOVE"
    DELETE = "DELETE"
    SUBMIT = "SUBMIT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    ACTIVATE = "ACTIVATE"
    RETIRE = "RETIRE"
    CANCEL = "CANCEL"
    MERGE = "MERGE"


EDITABLE_VERSION_STATUSES = {VersionStatus.DRAFT, VersionStatus.REJECTED}
LOCKED_VERSION_STATUSES = {
    VersionStatus.PENDING_APPROVAL,
    VersionStatus.APPROVED,
    VersionStatus.ACTIVE,
    VersionStatus.RETIRED,
}
