from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    Hierarchy,
    HierarchyEdge,
    HierarchyNode,
    HierarchyType,
    HierarchyVersion,
    HierarchyVersionNode,
    NodePropertyDefinition,
    NodeType,
    StructuralRule,
    User,
)
from app.utils.auth import get_password_hash
from app.utils.enums import AggregationFn, NodeStatus, PropertyDataType, VersionStatus


def seed_database(db: Session | None = None):
    """Initialize only when the database has no users. Also seeds demo rollup hierarchies for admin."""
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        if db.query(User).first():
            return
        admin = _seed_users(db)
        _seed_org_chart_hierarchy(db, admin)
        _seed_product_hierarchy(db, admin)
        db.commit()
    finally:
        if own_session:
            db.close()


def _seed_users(db: Session) -> User:
    users = [
        ("admin", "admin123", "Administrator", "Business Owner"),
        ("scm_manager", "password123", "SCM Manager", "Supply Chain Manager"),
        ("data_governance", "password123", "Data Governance", "Data Governance Manager"),
        ("business_owner", "password123", "Business Owner", "Business Owner"),
    ]
    admin = None
    for username, password, display_name, role in users:
        user = User(
            username=username,
            password_hash=get_password_hash(password),
            display_name=display_name,
            role=role,
        )
        db.add(user)
        if username == "admin":
            admin = user
    db.flush()
    return admin


def _make_node_type(db: Session, hierarchy_type: HierarchyType, code: str, name: str, order: int) -> NodeType:
    nt = NodeType(hierarchy_type_id=hierarchy_type.hierarchy_type_id, code=code, name=name, display_order=order)
    db.add(nt)
    db.flush()
    return nt


def _add_structural_rule(db: Session, hierarchy_type: HierarchyType, parent: NodeType, child: NodeType):
    db.add(
        StructuralRule(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            parent_node_type_id=parent.node_type_id,
            child_node_type_id=child.node_type_id,
        )
    )


def _add_rollup_definition(db: Session, hierarchy_type: HierarchyType, node_type: NodeType, property_code: str, display_label: str, source_property_code: str):
    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=node_type.node_type_id,
            property_code=property_code,
            display_label=display_label,
            data_type=PropertyDataType.ROLLUP.value,
            rollup_source_property_code=source_property_code,
            rollup_aggregation=AggregationFn.SUM.value,
            display_order=0,
        )
    )


def _add_version_node(
    db: Session,
    hierarchy: Hierarchy,
    version: HierarchyVersion,
    admin: User,
    node_type: NodeType,
    display_name: str,
    parent_version_node_id: str | None,
    properties: dict | None = None,
) -> HierarchyVersionNode:
    logical = HierarchyNode(
        hierarchy_id=hierarchy.hierarchy_id,
        node_type_id=node_type.node_type_id,
        stable_code=f"{node_type.code}-{uuid.uuid4().hex[:8]}",
        created_by=admin.username,
    )
    db.add(logical)
    db.flush()
    vn = HierarchyVersionNode(
        hierarchy_version_id=version.hierarchy_version_id,
        hierarchy_node_id=logical.hierarchy_node_id,
        display_name=display_name,
        node_status=NodeStatus.ACTIVE.value,
        properties=properties or {},
    )
    db.add(vn)
    db.flush()
    db.add(
        HierarchyEdge(
            hierarchy_version_id=version.hierarchy_version_id,
            child_version_node_id=vn.version_node_id,
            parent_version_node_id=parent_version_node_id,
        )
    )
    return vn


def _make_hierarchy_and_active_version(db: Session, hierarchy_type: HierarchyType, code: str, name: str, description: str, admin: User) -> tuple[Hierarchy, HierarchyVersion]:
    hierarchy = Hierarchy(
        hierarchy_type_id=hierarchy_type.hierarchy_type_id,
        code=code,
        name=name,
        description=description,
    )
    db.add(hierarchy)
    db.flush()

    version = HierarchyVersion(
        hierarchy_id=hierarchy.hierarchy_id,
        version_no="V1",
        version_name="Initial Version",
        status=VersionStatus.ACTIVE.value,
        created_by=admin.username,
    )
    db.add(version)
    db.flush()
    return hierarchy, version


def _seed_org_chart_hierarchy(db: Session, admin: User):
    """Employee -> Team -> Department -> Organization, with a chained SUM rollup of `salary`
    surfaced as `total_salary` at every level above Employee, so the Rollup feature is
    visible out of the box."""
    hierarchy_type = HierarchyType(
        code="ORG_CHART",
        name="Organization Chart",
        description="Demo org chart showing salary roll-ups from employees to the organization",
        allow_multiple_parents=False,
        created_by=admin.username,
    )
    db.add(hierarchy_type)
    db.flush()

    employee = _make_node_type(db, hierarchy_type, "EMPLOYEE", "Employee", 0)
    team = _make_node_type(db, hierarchy_type, "TEAM", "Team", 1)
    department = _make_node_type(db, hierarchy_type, "DEPARTMENT", "Department", 2)
    organization = _make_node_type(db, hierarchy_type, "ORGANIZATION", "Organization", 3)

    _add_structural_rule(db, hierarchy_type, organization, department)
    _add_structural_rule(db, hierarchy_type, department, team)
    _add_structural_rule(db, hierarchy_type, team, employee)

    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=employee.node_type_id,
            property_code="salary",
            display_label="Salary",
            data_type=PropertyDataType.NUMBER.value,
            display_order=0,
        )
    )
    _add_rollup_definition(db, hierarchy_type, team, "total_salary", "Total Salary", "salary")
    _add_rollup_definition(db, hierarchy_type, department, "total_salary", "Total Salary", "total_salary")
    _add_rollup_definition(db, hierarchy_type, organization, "total_salary", "Total Salary", "total_salary")
    db.flush()

    hierarchy, version = _make_hierarchy_and_active_version(
        db, hierarchy_type, "ACME", "Acme Corp", "Demo hierarchy for the salary rollup feature", admin
    )

    def add_node(node_type, display_name, parent_version_node_id, properties=None):
        return _add_version_node(db, hierarchy, version, admin, node_type, display_name, parent_version_node_id, properties)

    org_node = add_node(organization, "Acme Corp", None)
    eng = add_node(department, "Engineering", org_node.version_node_id)
    sales = add_node(department, "Sales", org_node.version_node_id)

    backend_team = add_node(team, "Backend", eng.version_node_id)
    frontend_team = add_node(team, "Frontend", eng.version_node_id)
    sales_team = add_node(team, "Enterprise Sales", sales.version_node_id)

    add_node(employee, "Alice Chen", backend_team.version_node_id, {"salary": 135000})
    add_node(employee, "Bob Diaz", backend_team.version_node_id, {"salary": 128000})
    add_node(employee, "Carol Nguyen", frontend_team.version_node_id, {"salary": 118000})
    add_node(employee, "David Kim", frontend_team.version_node_id, {"salary": 122000})
    add_node(employee, "Eve Martinez", sales_team.version_node_id, {"salary": 95000})
    add_node(employee, "Frank Osei", sales_team.version_node_id, {"salary": 98000})


def _seed_product_hierarchy(db: Session, admin: User):
    """Product -> Category -> Product Line, with a chained SUM rollup of `inventory_value`
    surfaced as `total_inventory_value` at every level above Product."""
    hierarchy_type = HierarchyType(
        code="PRODUCT_CATALOG",
        name="Product Catalog",
        description="Demo product catalog showing inventory value roll-ups from products to product lines",
        allow_multiple_parents=False,
        created_by=admin.username,
    )
    db.add(hierarchy_type)
    db.flush()

    product = _make_node_type(db, hierarchy_type, "PRODUCT", "Product", 0)
    category = _make_node_type(db, hierarchy_type, "CATEGORY", "Category", 1)
    product_line = _make_node_type(db, hierarchy_type, "PRODUCT_LINE", "Product Line", 2)

    _add_structural_rule(db, hierarchy_type, product_line, category)
    _add_structural_rule(db, hierarchy_type, category, product)

    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=product.node_type_id,
            property_code="inventory_value",
            display_label="Inventory Value",
            data_type=PropertyDataType.NUMBER.value,
            display_order=0,
        )
    )
    _add_rollup_definition(db, hierarchy_type, category, "total_inventory_value", "Total Inventory Value", "inventory_value")
    _add_rollup_definition(db, hierarchy_type, product_line, "total_inventory_value", "Total Inventory Value", "total_inventory_value")
    db.flush()

    hierarchy, version = _make_hierarchy_and_active_version(
        db, hierarchy_type, "CATALOG", "Global Product Catalog", "Demo hierarchy for the inventory value rollup feature", admin
    )

    def add_node(node_type, display_name, parent_version_node_id, properties=None):
        return _add_version_node(db, hierarchy, version, admin, node_type, display_name, parent_version_node_id, properties)

    electronics = add_node(product_line, "Electronics", None)
    apparel = add_node(product_line, "Apparel", None)

    laptops = add_node(category, "Laptops", electronics.version_node_id)
    audio = add_node(category, "Audio", electronics.version_node_id)
    outerwear = add_node(category, "Outerwear", apparel.version_node_id)

    add_node(product, "ProBook 14", laptops.version_node_id, {"inventory_value": 84000})
    add_node(product, "UltraLight 13", laptops.version_node_id, {"inventory_value": 61200})
    add_node(product, "Wireless Earbuds X2", audio.version_node_id, {"inventory_value": 23500})
    add_node(product, "Studio Headphones", audio.version_node_id, {"inventory_value": 18900})
    add_node(product, "Rain Shell Jacket", outerwear.version_node_id, {"inventory_value": 15400})
    add_node(product, "Winter Parka", outerwear.version_node_id, {"inventory_value": 27600})
