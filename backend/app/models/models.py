from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base
from app.utils.enums import EntityStatus, VersionStatus, NodeStatus, ApprovalRequestStatus, ApprovalStepStatus


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class HierarchyType(Base):
    __tablename__ = "hierarchy_types"

    hierarchy_type_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=EntityStatus.ACTIVE.value)
    rule_set_ref: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    allow_multiple_parents: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[str] = mapped_column(String(100))

    hierarchies = relationship("Hierarchy", back_populates="hierarchy_type")
    node_types = relationship("NodeType", back_populates="hierarchy_type")
    property_definitions = relationship("NodePropertyDefinition", back_populates="hierarchy_type")
    structural_rules = relationship("StructuralRule", back_populates="hierarchy_type")


class Hierarchy(Base):
    __tablename__ = "hierarchies"
    __table_args__ = (UniqueConstraint("hierarchy_type_id", "code", name="uq_hierarchy_type_code"),)

    hierarchy_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_types.hierarchy_type_id"))
    code: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=EntityStatus.ACTIVE.value)

    hierarchy_type = relationship("HierarchyType", back_populates="hierarchies")
    versions = relationship("HierarchyVersion", back_populates="hierarchy")
    nodes = relationship("HierarchyNode", back_populates="hierarchy")
    changes = relationship("HierarchyChange", back_populates="hierarchy")


class NodeType(Base):
    __tablename__ = "node_types"
    __table_args__ = (UniqueConstraint("hierarchy_type_id", "code", name="uq_node_type_code"),)

    node_type_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_types.hierarchy_type_id"))
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default=EntityStatus.ACTIVE.value)

    hierarchy_type = relationship("HierarchyType", back_populates="node_types")
    property_definitions = relationship("NodePropertyDefinition", back_populates="node_type")
    hierarchy_nodes = relationship("HierarchyNode", back_populates="node_type")
    parent_rules = relationship("StructuralRule", foreign_keys="StructuralRule.parent_node_type_id", back_populates="parent_node_type")
    child_rules = relationship("StructuralRule", foreign_keys="StructuralRule.child_node_type_id", back_populates="child_node_type")


class NodePropertyDefinition(Base):
    __tablename__ = "node_property_definitions"
    __table_args__ = (UniqueConstraint("hierarchy_type_id", "node_type_id", "property_code", name="uq_property_definition"),)

    property_definition_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_types.hierarchy_type_id"))
    node_type_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("node_types.node_type_id"), nullable=True)
    property_code: Mapped[str] = mapped_column(String(100))
    display_label: Mapped[str] = mapped_column(String(200))
    data_type: Mapped[str] = mapped_column(String(20))
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    allowed_values: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    default_value: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    validation_rule: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    hierarchy_type = relationship("HierarchyType", back_populates="property_definitions")
    node_type = relationship("NodeType", back_populates="property_definitions")


class StructuralRule(Base):
    __tablename__ = "structural_rules"
    __table_args__ = (UniqueConstraint("hierarchy_type_id", "parent_node_type_id", "child_node_type_id", name="uq_structural_rule"),)

    structural_rule_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_types.hierarchy_type_id"))
    parent_node_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("node_types.node_type_id"))
    child_node_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("node_types.node_type_id"))
    status: Mapped[str] = mapped_column(String(20), default=EntityStatus.ACTIVE.value)

    hierarchy_type = relationship("HierarchyType", back_populates="structural_rules")
    parent_node_type = relationship("NodeType", foreign_keys=[parent_node_type_id], back_populates="parent_rules")
    child_node_type = relationship("NodeType", foreign_keys=[child_node_type_id], back_populates="child_rules")


class HierarchyNode(Base):
    __tablename__ = "hierarchy_nodes"
    __table_args__ = (UniqueConstraint("hierarchy_id", "stable_code", name="uq_hierarchy_stable_code"),)

    hierarchy_node_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchies.hierarchy_id"))
    node_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("node_types.node_type_id"))
    stable_code: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[str] = mapped_column(String(100))

    hierarchy = relationship("Hierarchy", back_populates="nodes")
    node_type = relationship("NodeType", back_populates="hierarchy_nodes")
    version_nodes = relationship("HierarchyVersionNode", back_populates="hierarchy_node")


class HierarchyVersion(Base):
    __tablename__ = "hierarchy_versions"

    hierarchy_version_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchies.hierarchy_id"), index=True)
    version_no: Mapped[str] = mapped_column(String(20))
    version_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    valid_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valid_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default=VersionStatus.DRAFT.value, index=True)
    based_on_version_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("hierarchy_versions.hierarchy_version_id"), nullable=True)
    scope_root_hierarchy_node_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("hierarchy_nodes.hierarchy_node_id"), nullable=True)
    merged_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cancelled_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    hierarchy = relationship("Hierarchy", back_populates="versions")
    based_on_version = relationship("HierarchyVersion", remote_side=[hierarchy_version_id])
    version_nodes = relationship("HierarchyVersionNode", back_populates="hierarchy_version")
    edges = relationship("HierarchyEdge", back_populates="hierarchy_version")
    approval_requests = relationship("ApprovalRequest", back_populates="hierarchy_version")
    changes = relationship("HierarchyChange", back_populates="hierarchy_version")
    source_lineages = relationship("HierarchyCopyLineage", foreign_keys="HierarchyCopyLineage.source_hierarchy_version_id", back_populates="source_hierarchy_version")


class HierarchyVersionNode(Base):
    __tablename__ = "hierarchy_version_nodes"
    __table_args__ = (UniqueConstraint("hierarchy_version_id", "hierarchy_node_id", name="uq_version_node"),)

    version_node_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_versions.hierarchy_version_id"), index=True)
    hierarchy_node_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_nodes.hierarchy_node_id"))
    display_name: Mapped[str] = mapped_column(String(200))
    sibling_order: Mapped[int] = mapped_column(Integer, default=0)
    node_status: Mapped[str] = mapped_column(String(20), default=NodeStatus.ACTIVE.value)
    properties: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True, default=dict)

    hierarchy_version = relationship("HierarchyVersion", back_populates="version_nodes")
    hierarchy_node = relationship("HierarchyNode", back_populates="version_nodes")
    child_edges = relationship("HierarchyEdge", foreign_keys="HierarchyEdge.child_version_node_id", back_populates="child_version_node")
    parent_edges = relationship("HierarchyEdge", foreign_keys="HierarchyEdge.parent_version_node_id", back_populates="parent_version_node")
    target_lineages = relationship("HierarchyCopyLineage", foreign_keys="HierarchyCopyLineage.target_version_node_id", back_populates="target_version_node")
    source_lineages = relationship("HierarchyCopyLineage", foreign_keys="HierarchyCopyLineage.source_version_node_id", back_populates="source_version_node")


class HierarchyEdge(Base):
    __tablename__ = "hierarchy_edges"
    __table_args__ = (UniqueConstraint("hierarchy_version_id", "child_version_node_id", "parent_version_node_id", name="uq_edge_parent_child"),)

    edge_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_versions.hierarchy_version_id"), index=True)
    child_version_node_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_version_nodes.version_node_id"), index=True)
    parent_version_node_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("hierarchy_version_nodes.version_node_id"), nullable=True, index=True)
    relationship_order: Mapped[int] = mapped_column(Integer, default=0)

    hierarchy_version = relationship("HierarchyVersion", back_populates="edges")
    child_version_node = relationship("HierarchyVersionNode", foreign_keys=[child_version_node_id], back_populates="child_edges")
    parent_version_node = relationship("HierarchyVersionNode", foreign_keys=[parent_version_node_id], back_populates="parent_edges")


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    approval_request_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_versions.hierarchy_version_id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default=ApprovalRequestStatus.OPEN.value)
    submitted_by: Mapped[str] = mapped_column(String(100))
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    submission_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    hierarchy_version = relationship("HierarchyVersion", back_populates="approval_requests")
    steps = relationship("ApprovalStep", back_populates="approval_request", order_by="ApprovalStep.step_sequence")


class ApprovalStep(Base):
    __tablename__ = "approval_steps"

    approval_step_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    approval_request_id: Mapped[str] = mapped_column(String(36), ForeignKey("approval_requests.approval_request_id"))
    step_sequence: Mapped[int] = mapped_column(Integer)
    approver_role_or_user: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default=ApprovalStepStatus.PENDING.value)
    acted_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    acted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    approval_request = relationship("ApprovalRequest", back_populates="steps")


class HierarchyCopyLineage(Base):
    __tablename__ = "hierarchy_copy_lineage"

    lineage_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    target_version_node_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_version_nodes.version_node_id"), index=True)
    source_hierarchy_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_versions.hierarchy_version_id"))
    source_version_node_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchy_version_nodes.version_node_id"))
    operation_type: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[str] = mapped_column(String(100))

    target_version_node = relationship("HierarchyVersionNode", foreign_keys=[target_version_node_id], back_populates="target_lineages")
    source_hierarchy_version = relationship("HierarchyVersion", foreign_keys=[source_hierarchy_version_id], back_populates="source_lineages")
    source_version_node = relationship("HierarchyVersionNode", foreign_keys=[source_version_node_id], back_populates="source_lineages")


class HierarchyChange(Base):
    __tablename__ = "hierarchy_changes"

    change_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hierarchy_id: Mapped[str] = mapped_column(String(36), ForeignKey("hierarchies.hierarchy_id"), index=True)
    hierarchy_version_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("hierarchy_versions.hierarchy_version_id"), nullable=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(20))
    field_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by: Mapped[str] = mapped_column(String(100))
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    hierarchy = relationship("Hierarchy", back_populates="changes")
    hierarchy_version = relationship("HierarchyVersion", back_populates="changes")
