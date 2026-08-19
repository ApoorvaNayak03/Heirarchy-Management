from __future__ import annotations

from datetime import date, datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int


class MessageResponse(BaseModel):
    message: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6)
    display_name: str
    role: str = "Business User"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    display_name: str
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class HierarchyTypeCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    status: str = "ACTIVE"
    rule_set_ref: str | None = None
    allow_multiple_parents: bool = False


class HierarchyTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    rule_set_ref: str | None = None
    allow_multiple_parents: bool | None = None


class HierarchyTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hierarchy_type_id: str
    code: str
    name: str
    description: str | None
    status: str
    rule_set_ref: str | None
    allow_multiple_parents: bool
    created_at: datetime
    created_by: str


class HierarchyCreate(BaseModel):
    hierarchy_type_id: str
    code: str
    name: str
    description: str | None = None
    status: str = "ACTIVE"


class HierarchyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None


class HierarchyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hierarchy_id: str
    hierarchy_type_id: str
    code: str
    name: str
    description: str | None
    status: str


class NodeTypeCreate(BaseModel):
    hierarchy_type_id: str
    code: str
    name: str
    description: str | None = None
    display_order: int = 0
    status: str = "ACTIVE"


class NodeTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    display_order: int | None = None
    status: str | None = None


class NodeTypeReorderItem(BaseModel):
    node_type_id: str
    display_order: int


class NodeTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    node_type_id: str
    hierarchy_type_id: str
    code: str
    name: str
    description: str | None
    display_order: int
    status: str


class PropertyDefinitionCreate(BaseModel):
    hierarchy_type_id: str
    node_type_id: str | None = None
    property_code: str
    display_label: str
    data_type: str
    required: bool = False
    allowed_values: list[Any] | None = None
    default_value: Any | None = None
    validation_rule: str | None = None
    display_order: int = 0


class PropertyDefinitionUpdate(BaseModel):
    display_label: str | None = None
    data_type: str | None = None
    required: bool | None = None
    allowed_values: list[Any] | None = None
    default_value: Any | None = None
    validation_rule: str | None = None
    display_order: int | None = None


class PropertyDefinitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    property_definition_id: str
    hierarchy_type_id: str
    node_type_id: str | None
    property_code: str
    display_label: str
    data_type: str
    required: bool
    allowed_values: list[Any] | None
    default_value: Any | None
    validation_rule: str | None
    display_order: int


class StructuralRuleCreate(BaseModel):
    hierarchy_type_id: str
    parent_node_type_id: str
    child_node_type_id: str
    status: str = "ACTIVE"


class StructuralRuleUpdate(BaseModel):
    status: str | None = None


class StructuralRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    structural_rule_id: str
    hierarchy_type_id: str
    parent_node_type_id: str
    child_node_type_id: str
    status: str
    parent_node_type_name: str | None = None
    child_node_type_name: str | None = None


class VersionCreate(BaseModel):
    version_no: str | None = None
    version_name: str | None = None
    description: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None


class VersionUpdate(BaseModel):
    version_name: str | None = None
    description: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None


class VersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hierarchy_version_id: str
    hierarchy_id: str
    version_no: str
    version_name: str | None
    description: str | None
    valid_from: date | None
    valid_to: date | None
    status: str
    based_on_version_id: str | None
    scope_root_hierarchy_node_id: str | None = None
    scope_root_node_name: str | None = None
    merged_at: datetime | None = None
    created_by: str
    created_at: datetime
    cancelled_at: datetime | None
    cancelled_by: str | None


class TreeNodeResponse(BaseModel):
    version_node_id: str
    hierarchy_node_id: str
    display_name: str
    node_type_id: str
    node_type_code: str
    node_type_name: str
    sibling_order: int
    node_status: str
    properties: dict[str, Any] | None
    parent_version_node_id: str | None = None
    children: list["TreeNodeResponse"] = []


TreeNodeResponse.model_rebuild()


class NodeCreate(BaseModel):
    node_type_id: str
    display_name: str
    stable_code: str | None = None
    parent_version_node_id: str | None = None
    sibling_order: int = 0
    properties: dict[str, Any] | None = None


class NodeUpdate(BaseModel):
    display_name: str | None = None
    sibling_order: int | None = None
    properties: dict[str, Any] | None = None


class NodeMoveRequest(BaseModel):
    new_parent_version_node_id: str | None
    sibling_order: int | None = None


class NodeCloneRequest(BaseModel):
    display_name: str
    stable_code: str | None = None
    properties: dict[str, Any] | None = None


class CopySubtreeRequest(BaseModel):
    source_version_id: str
    source_version_node_id: str
    target_parent_version_node_id: str | None = None


class ValidationErrorItem(BaseModel):
    type: str
    node_id: str | None = None
    message: str


class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationErrorItem] = []
    warnings: list[ValidationErrorItem] = []


class ApprovalStepInput(BaseModel):
    step_sequence: int
    approver_role_or_user: str


class SubmitApprovalRequest(BaseModel):
    comment: str
    approval_steps: list[ApprovalStepInput]


class ApprovalStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    approval_step_id: str
    step_sequence: int
    approver_role_or_user: str
    status: str
    acted_by: str | None
    acted_at: datetime | None
    comment: str | None


class ApprovalRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    approval_request_id: str
    hierarchy_version_id: str
    status: str
    submitted_by: str
    submitted_at: datetime
    submission_comment: str | None
    steps: list[ApprovalStepResponse] = []
    version_no: str | None = None
    hierarchy_name: str | None = None
    hierarchy_id: str | None = None


class ApprovalActionRequest(BaseModel):
    comment: str | None = None


class ConflictItem(BaseModel):
    hierarchy_node_id: str
    node_name: str
    field: str
    base_value: str | None
    active_value: str | None
    proposed_value: str | None


class ConflictsResponse(BaseModel):
    has_conflicts: bool
    active_version_id: str | None = None
    base_version_id: str | None = None
    conflicts: list[ConflictItem] = []


class ConflictResolution(BaseModel):
    hierarchy_node_id: str
    field: str
    choice: str  # "active" (keep active's value) | "draft" (apply proposed/draft's value)


class ResolveConflictsRequest(BaseModel):
    resolutions: list[ConflictResolution]


class MergeDraftRequest(BaseModel):
    resolutions: list[ConflictResolution] = []


class ActivateVersionRequest(BaseModel):
    valid_from: date | None = None


class CompareChangeItem(BaseModel):
    change_type: str
    node: str
    old_value: str | None
    new_value: str | None
    hierarchy_node_id: str | None = None


class CompareSummary(BaseModel):
    added: int = 0
    removed: int = 0
    moved: int = 0
    renamed: int = 0
    property_changed: int = 0
    relationship_changed: int = 0


class CompareResult(BaseModel):
    summary: CompareSummary
    changes: list[CompareChangeItem]


class AuditChangeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    change_id: str
    hierarchy_id: str
    hierarchy_version_id: str | None
    entity_type: str
    entity_id: str
    action: str
    field_name: str | None
    old_value: str | None
    new_value: str | None
    changed_by: str
    changed_at: datetime


class LineageNode(BaseModel):
    id: str
    label: str
    type: str


class LineageEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str | None = None


class LineageGraphResponse(BaseModel):
    nodes: list[LineageNode]
    edges: list[LineageEdge]


class DashboardStats(BaseModel):
    total_hierarchy_types: int
    total_hierarchies: int
    active_versions: int
    draft_versions: int
    pending_approvals: int
    recent_changes: list[AuditChangeResponse]
    versions_approaching_effective_date: list[VersionResponse]
