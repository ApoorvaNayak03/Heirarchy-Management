from __future__ import annotations

import json
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
        _seed_global_sales_hierarchy(db, admin)
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


def _add_chained_rollup_definitions(db: Session, hierarchy_type: HierarchyType, tiers_low_to_high, base_property_codes: dict[str, str]):
    """For each base property (e.g. revenue -> total_revenue), add a chained SUM rollup
    definition at every tier above the base tier, each summing from the tier directly below."""
    for property_code, display_label in base_property_codes.items():
        rollup_code = f"total_{property_code}"
        source_code = property_code
        for tier in tiers_low_to_high:
            _add_rollup_definition(db, hierarchy_type, tier, rollup_code, display_label, source_code)
            source_code = rollup_code


# Source rows: (STRUCTURE_NODE_ID, NAME, PARENT_STRUCTURE_NODE_ID, LEVEL_ID, tier_code, NODE_ID)
# tier_code is the normalized NodeType (raw NODE_TYPE column collapsed by structural level,
# since e.g. some LEVEL 4 rows are labeled COUNTRY but sit as REGION-tier siblings).
# NODE_ID is the source spreadsheet's employee/transaction join key (see NODE_REL, TRANSACTION DETAILS).
_GLOBAL_SALES_ROWS = [
    (1234, "GLOBAL", None, 0, "SUPER_THEATER", 1),
    (1235, "EMEA", 1234, 1, "THEATER", 111111),
    (1236, "AMERICAS", 1234, 1, "THEATER", 222222),
    (1237, "APJC", 1234, 1, "THEATER", 333333),
    (1238, "WW DISTRIBUTION", 1234, 1, "THEATER", 444444),
    (1239, "CANADA", 1236, 2, "SUB_THEATER", 1222222),
    (1240, "US PS MARKET SEGMENT", 1236, 2, "SUB_THEATER", 1333333),
    (1242, "US COMMERCIAL", 1236, 2, "SUB_THEATER", 1444444),
    (1243, "LATIN AMERICA", 1236, 2, "SUB_THEATER", 1555555),
    (1244, "COMMERCIAL_WEST_AREA", 1242, 3, "AREA", 1411111),
    (1245, "COMMERCIAL_EAST_AREA", 1242, 3, "AREA", 1411112),
    (1246, "COMMERCIAL_CENTRAL_AREA", 1242, 3, "AREA", 1411113),
    (1247, "SMB_US_COMMERCIAL", 1242, 3, "AREA", 1411114),
    (1248, "COMM_EAST_VS_SE_SLM1", 1245, 4, "REGION", 1412111),
    (1249, "COMM_EAST_VS_SE_SLM2", 1245, 4, "REGION", 1412112),
    (1250, "SOUTH EAST COMMERCIAL OPERATION", 1245, 4, "REGION", 1412113),
    (1251, "TRISTATE COMMERCIAL OPERATION", 1245, 4, "REGION", 1412114),
    (1252, "CHARLOTTE SOUTH SELECT", 1250, 5, "SELECT_REGION", 1413111),
    (1253, "NORTH FLORIDA SELECT", 1250, 5, "SELECT_REGION", 1413112),
    (1254, "ATLANTA SELECT", 1250, 5, "SELECT_REGION", 1413113),
    (1255, "CPA_CSL_CEA_GEORGIA_4_L7_A", 1250, 5, "SELECT_REGION", 1413114),
    (1256, "CSL_CEA_NORTH_FLORIDA 7", 1253, 6, "ACCOUNT", 1414111),
    (1257, "CSL_CEA_NORTH_FLORIDA 6", 1253, 6, "ACCOUNT", 1414112),
    (1258, "CSL_CEA_NORTH_FLORIDA 5", 1253, 6, "ACCOUNT", 1414113),
    (1259, "DNU_STR_FOOTBALL_FANATICS", 1253, 6, "ACCOUNT", 1414114),
    (1260, "CSL_CEA_NORTH_FLORIDA 8", 1253, 6, "ACCOUNT", 1414115),
    (1261, "CSL_CEA_NORTH_FLORIDA 9", 1253, 6, "ACCOUNT", 1414116),
    (1262, "UK & IRELAND", 1235, 2, "SUB_THEATER", 2222222),
    (1263, "EMEA PS MARKET SEGMENT", 1235, 2, "SUB_THEATER", 2333333),
    (1264, "EMEA COMMERCIAL", 1235, 2, "SUB_THEATER", 2444444),
    (1265, "AFRICA", 1235, 2, "SUB_THEATER", 2555555),
    (1266, "COMMERCIAL_WEST_AREA_EMEA", 1264, 3, "AREA", 2411111),
    (1267, "COMMERCIAL_EAST_AREA_EMEA", 1264, 3, "AREA", 2411112),
    (1268, "COMMERCIAL_CENTRAL_AREA_EMEA", 1264, 3, "AREA", 2411113),
    (1269, "SMB_EMEA_COMMERCIAL", 1264, 3, "AREA", 2411114),
    (1270, "COMM_EAST_VS_SE_SLM1_EMEA", 1267, 4, "REGION", 2412111),
    (1271, "COMM_EAST_VS_SE_SLM2_EMEA", 1267, 4, "REGION", 2412112),
    (1272, "SOUTH EMEA COMMERCIAL OPERATION", 1267, 4, "REGION", 2412113),
    (1273, "BENELUX_NORDICS_OPERATION", 1267, 4, "REGION", 2412114),
    (1274, "MILAN SOUTH SELECT", 1272, 5, "SELECT_REGION", 2413111),
    (1275, "MADRID SELECT", 1272, 5, "SELECT_REGION", 2413112),
    (1276, "LISBON SELECT", 1272, 5, "SELECT_REGION", 2413113),
    (1277, "CPA_CSL_CEA_IBERIA_4_L7_A", 1272, 5, "SELECT_REGION", 2413114),
    (1278, "CSL_CEA_MADRID 7", 1275, 6, "ACCOUNT", 2414111),
    (1279, "CSL_CEA_MADRID 6", 1275, 6, "ACCOUNT", 2414112),
    (1280, "CSL_CEA_MADRID 5", 1275, 6, "ACCOUNT", 2414113),
    (1281, "DNU_STR_FOOTBALL_FANATICS_EMEA", 1275, 6, "ACCOUNT", 2414114),
    (1282, "CSL_CEA_MADRID 8", 1275, 6, "ACCOUNT", 2414115),
    (1283, "CSL_CEA_MADRID 9", 1275, 6, "ACCOUNT", 2414116),
    (1284, "ANZ", 1237, 2, "SUB_THEATER", 3222222),
    (1285, "APJC PS MARKET SEGMENT", 1237, 2, "SUB_THEATER", 3333333),
    (1286, "APJC COMMERCIAL", 1237, 2, "SUB_THEATER", 3444444),
    (1287, "INDIA", 1237, 2, "SUB_THEATER", 3555555),
    (1288, "COMMERCIAL_WEST_AREA_APJC", 1286, 3, "AREA", 3411111),
    (1289, "COMMERCIAL_EAST_AREA_APJC", 1286, 3, "AREA", 3411112),
    (1290, "COMMERCIAL_CENTRAL_AREA_APJC", 1286, 3, "AREA", 3411113),
    (1291, "SMB_APJC_COMMERCIAL", 1286, 3, "AREA", 3411114),
    (1292, "COMM_EAST_VS_SE_SLM1_APJC", 1289, 4, "REGION", 3412111),
    (1293, "COMM_EAST_VS_SE_SLM2_APJC", 1289, 4, "REGION", 3412112),
    (1294, "NORTH ASIA COMMERCIAL OPERATION", 1289, 4, "REGION", 3412113),
    (1295, "GREATER_CHINA_OPERATION", 1289, 4, "REGION", 3412114),
    (1296, "TOKYO SELECT", 1294, 5, "SELECT_REGION", 3413111),
    (1297, "SEOUL SELECT", 1294, 5, "SELECT_REGION", 3413112),
    (1298, "OSAKA SELECT", 1294, 5, "SELECT_REGION", 3413113),
    (1299, "CPA_CSL_CEA_APAC_4_L7_A", 1294, 5, "SELECT_REGION", 3413114),
    (1300, "CSL_CEA_SEOUL 7", 1297, 6, "ACCOUNT", 3414111),
    (1301, "CSL_CEA_SEOUL 6", 1297, 6, "ACCOUNT", 3414112),
    (1302, "CSL_CEA_SEOUL 5", 1297, 6, "ACCOUNT", 3414113),
    (1303, "DNU_STR_FOOTBALL_FANATICS_APJC", 1297, 6, "ACCOUNT", 3414114),
    (1304, "CSL_CEA_SEOUL 8", 1297, 6, "ACCOUNT", 3414115),
    (1305, "CSL_CEA_SEOUL 9", 1297, 6, "ACCOUNT", 3414116),
]

_GLOBAL_SALES_REPS_BY_NODE_ID = {
    444444: [{'rep_id': 7003, 'department': '20334455', 'job_title': '8102', 'commission_flag': 'Y', 'first_name': 'RACHEL', 'last_name': 'S', 'full_name': 'RACHEL S', 'email': 'RACHELS', 'effective_date': '2020-09-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1222222: [{'rep_id': 7004, 'department': '20445566', 'job_title': '1111', 'commission_flag': 'Y', 'first_name': 'JAMES', 'last_name': 'L', 'full_name': 'JAMES L', 'email': 'JAMESL', 'effective_date': '2021-01-15', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1333333: [{'rep_id': 7005, 'department': '20556677', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'PRIYA', 'last_name': 'N', 'full_name': 'PRIYA N', 'email': 'PRIYAN', 'effective_date': '2021-07-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1411111: [{'rep_id': 7007, 'department': '20778899', 'job_title': '7281', 'commission_flag': 'Y', 'first_name': 'EMILY', 'last_name': 'T', 'full_name': 'EMILY T', 'email': 'EMILYT', 'effective_date': '2018-11-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1411113: [{'rep_id': 7008, 'department': '20889900', 'job_title': '1111', 'commission_flag': 'Y', 'first_name': 'KEVIN', 'last_name': 'H', 'full_name': 'KEVIN H', 'email': 'KEVINH', 'effective_date': '2022-05-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1411114: [{'rep_id': 7009, 'department': '20990011', 'job_title': '4813', 'commission_flag': 'Y', 'first_name': 'NATALIE', 'last_name': 'F', 'full_name': 'NATALIE F', 'email': 'NATALIEF', 'effective_date': '2023-01-10', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1412111: [{'rep_id': 7010, 'department': '21001122', 'job_title': '1111', 'commission_flag': 'Y', 'first_name': 'BRIAN', 'last_name': 'C', 'full_name': 'BRIAN C', 'email': 'BRIANC', 'effective_date': '2021-10-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1412112: [{'rep_id': 7011, 'department': '21112233', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'JESSICA', 'last_name': 'W', 'full_name': 'JESSICA W', 'email': 'JESSICAW', 'effective_date': '2022-08-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1412114: [{'rep_id': 7012, 'department': '21223344', 'job_title': '8102', 'commission_flag': 'Y', 'first_name': 'OMAR', 'last_name': 'Y', 'full_name': 'OMAR Y', 'email': 'OMARY', 'effective_date': '2023-03-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1413111: [{'rep_id': 7013, 'department': '21334455', 'job_title': '8102', 'commission_flag': 'Y', 'first_name': 'LAUREN', 'last_name': 'G', 'full_name': 'LAUREN G', 'email': 'LAURENG', 'effective_date': '2019-09-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1413113: [{'rep_id': 7014, 'department': '21445566', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'ANDRE', 'last_name': 'J', 'full_name': 'ANDRE J', 'email': 'ANDREJ', 'effective_date': '2020-06-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1413114: [{'rep_id': 7015, 'department': '21556677', 'job_title': '4813', 'commission_flag': 'Y', 'first_name': 'HANNAH', 'last_name': 'Z', 'full_name': 'HANNAH Z', 'email': 'HANNAHZ', 'effective_date': '2021-11-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1414111: [{'rep_id': 1234, 'department': '12345', 'job_title': '1111', 'commission_flag': 'N', 'first_name': 'ALEX', 'last_name': 'M', 'full_name': 'ALEX M', 'email': 'ALEXM', 'effective_date': '2010-01-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1414112: [{'rep_id': 2222, 'department': '12121212', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'MIKE', 'last_name': 'A', 'full_name': 'MIKE A', 'email': 'MIKEA', 'effective_date': '2012-01-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1414113: [{'rep_id': 3210, 'department': '24230079', 'job_title': '3579', 'commission_flag': 'Y', 'first_name': 'MARK', 'last_name': 'B', 'full_name': 'MARK B', 'email': 'MARKB', 'effective_date': '2021-04-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1414114: [{'rep_id': 4198, 'department': '36338946', 'job_title': '4813', 'commission_flag': 'Y', 'first_name': 'MICHAEL', 'last_name': 'D', 'full_name': 'MICHAEL D', 'email': 'MICHD', 'effective_date': '2021-02-03', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1414115: [{'rep_id': 5186, 'department': '48447813', 'job_title': '6047', 'commission_flag': 'Y', 'first_name': 'TOM', 'last_name': 'M', 'full_name': 'TOM M', 'email': 'TOMM', 'effective_date': '2021-03-05', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1414116: [{'rep_id': 6174, 'department': '60556680', 'job_title': '7281', 'commission_flag': 'N', 'first_name': 'TIM', 'last_name': 'P', 'full_name': 'TIM P', 'email': 'TIMP', 'effective_date': '2022-01-02', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    1555555: [{'rep_id': 7006, 'department': '20667788', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'CARLOS', 'last_name': 'V', 'full_name': 'CARLOS V', 'email': 'CARLOSV', 'effective_date': '2022-02-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2222222: [{'rep_id': 7001, 'department': '20112233', 'job_title': '7281', 'commission_flag': 'Y', 'first_name': 'SOPHIA', 'last_name': 'K', 'full_name': 'SOPHIA K', 'email': 'SOPHIAK', 'effective_date': '2019-06-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2333333: [{'rep_id': 7016, 'department': '22001122', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'OLIVIA', 'last_name': 'B', 'full_name': 'OLIVIA B', 'email': 'OLIVIAB', 'effective_date': '2019-06-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2411111: [{'rep_id': 7018, 'department': '22223344', 'job_title': '1111', 'commission_flag': 'Y', 'first_name': 'LUCAS', 'last_name': 'F', 'full_name': 'LUCAS F', 'email': 'LUCASF', 'effective_date': '2020-09-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2411113: [{'rep_id': 7019, 'department': '22334455', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'ANIKA', 'last_name': 'S', 'full_name': 'ANIKA S', 'email': 'ANIKAS', 'effective_date': '2021-01-15', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2411114: [{'rep_id': 7020, 'department': '22445566', 'job_title': '4813', 'commission_flag': 'Y', 'first_name': 'FELIX', 'last_name': 'R', 'full_name': 'FELIX R', 'email': 'FELIXR', 'effective_date': '2021-07-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2412111: [{'rep_id': 7021, 'department': '22556677', 'job_title': '1111', 'commission_flag': 'Y', 'first_name': 'GRETA', 'last_name': 'N', 'full_name': 'GRETA N', 'email': 'GRETAN', 'effective_date': '2022-02-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2412112: [{'rep_id': 7022, 'department': '22667788', 'job_title': '8102', 'commission_flag': 'Y', 'first_name': 'PABLO', 'last_name': 'D', 'full_name': 'PABLO D', 'email': 'PABLOD', 'effective_date': '2018-11-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2412114: [{'rep_id': 7023, 'department': '22778899', 'job_title': '1111', 'commission_flag': 'Y', 'first_name': 'INGRID', 'last_name': 'O', 'full_name': 'INGRID O', 'email': 'INGRIDO', 'effective_date': '2022-05-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2413111: [{'rep_id': 7024, 'department': '22889900', 'job_title': '4813', 'commission_flag': 'Y', 'first_name': 'MARCO', 'last_name': 'R', 'full_name': 'MARCO R', 'email': 'MARCOR', 'effective_date': '2023-01-10', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2413113: [{'rep_id': 7025, 'department': '22990011', 'job_title': '1111', 'commission_flag': 'Y', 'first_name': 'JOANA', 'last_name': 'P', 'full_name': 'JOANA P', 'email': 'JOANAP', 'effective_date': '2021-10-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2413114: [{'rep_id': 7026, 'department': '23001122', 'job_title': '3579', 'commission_flag': 'Y', 'first_name': 'SOFIA', 'last_name': 'C', 'full_name': 'SOFIA C', 'email': 'SOFIAC', 'effective_date': '2022-08-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2414111: [{'rep_id': 7027, 'department': '23112233', 'job_title': '6047', 'commission_flag': 'Y', 'first_name': 'DIEGO', 'last_name': 'A', 'full_name': 'DIEGO A', 'email': 'DIEGOA', 'effective_date': '2023-03-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2414112: [{'rep_id': 7028, 'department': '23223344', 'job_title': '8102', 'commission_flag': 'Y', 'first_name': 'ELENA', 'last_name': 'V', 'full_name': 'ELENA V', 'email': 'ELENAV', 'effective_date': '2019-09-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2414113: [{'rep_id': 7029, 'department': '23334455', 'job_title': '3579', 'commission_flag': 'Y', 'first_name': 'MATEO', 'last_name': 'G', 'full_name': 'MATEO G', 'email': 'MATEOG', 'effective_date': '2020-06-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2414114: [{'rep_id': 7030, 'department': '23445566', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'CAMILA', 'last_name': 'H', 'full_name': 'CAMILA H', 'email': 'CAMILAH', 'effective_date': '2021-11-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2414115: [{'rep_id': 7031, 'department': '23556677', 'job_title': '6047', 'commission_flag': 'Y', 'first_name': 'ISABEL', 'last_name': 'Q', 'full_name': 'ISABEL Q', 'email': 'ISABELQ', 'effective_date': '2022-12-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2414116: [{'rep_id': 7032, 'department': '23667788', 'job_title': '3579', 'commission_flag': 'Y', 'first_name': 'RAUL', 'last_name': 'X', 'full_name': 'RAUL X', 'email': 'RAULX', 'effective_date': '2023-06-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    2555555: [{'rep_id': 7017, 'department': '22112233', 'job_title': '8102', 'commission_flag': 'Y', 'first_name': 'THABO', 'last_name': 'M', 'full_name': 'THABO M', 'email': 'THABOM', 'effective_date': '2020-03-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3222222: [{'rep_id': 7002, 'department': '20223344', 'job_title': '3579', 'commission_flag': 'Y', 'first_name': 'DANIEL', 'last_name': 'R', 'full_name': 'DANIEL R', 'email': 'DANIELR', 'effective_date': '2020-03-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3333333: [{'rep_id': 7033, 'department': '24001122', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'MEI', 'last_name': 'L', 'full_name': 'MEI L', 'email': 'MEIL', 'effective_date': '2019-06-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3411111: [{'rep_id': 7035, 'department': '24223344', 'job_title': '7281', 'commission_flag': 'Y', 'first_name': 'WEI', 'last_name': 'C', 'full_name': 'WEI C', 'email': 'WEIC', 'effective_date': '2020-09-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3411113: [{'rep_id': 7036, 'department': '24334455', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'YUKI', 'last_name': 'T', 'full_name': 'YUKI T', 'email': 'YUKIT', 'effective_date': '2021-01-15', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3411114: [{'rep_id': 7037, 'department': '24445566', 'job_title': '2345', 'commission_flag': 'Y', 'first_name': 'SIMRAN', 'last_name': 'P', 'full_name': 'SIMRAN P', 'email': 'SIMRANP', 'effective_date': '2021-07-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3412111: [{'rep_id': 7038, 'department': '24556677', 'job_title': '1111', 'commission_flag': 'Y', 'first_name': 'HIROSHI', 'last_name': 'N', 'full_name': 'HIROSHI N', 'email': 'HIROSHIN', 'effective_date': '2022-02-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3412112: [{'rep_id': 7039, 'department': '24667788', 'job_title': '4813', 'commission_flag': 'Y', 'first_name': 'JIN', 'last_name': 'S', 'full_name': 'JIN S', 'email': 'JINS', 'effective_date': '2018-11-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3412114: [{'rep_id': 7040, 'department': '24778899', 'job_title': '9214', 'commission_flag': 'Y', 'first_name': 'LI', 'last_name': 'W', 'full_name': 'LI W', 'email': 'LIW', 'effective_date': '2022-05-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3413111: [{'rep_id': 7041, 'department': '24889900', 'job_title': '8102', 'commission_flag': 'Y', 'first_name': 'KENJI', 'last_name': 'O', 'full_name': 'KENJI O', 'email': 'KENJIO', 'effective_date': '2023-01-10', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3413113: [{'rep_id': 7042, 'department': '24990011', 'job_title': '7281', 'commission_flag': 'Y', 'first_name': 'AIKO', 'last_name': 'F', 'full_name': 'AIKO F', 'email': 'AIKOF', 'effective_date': '2021-10-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3413114: [{'rep_id': 7043, 'department': '25001122', 'job_title': '9214', 'commission_flag': 'Y', 'first_name': 'RAVI', 'last_name': 'D', 'full_name': 'RAVI D', 'email': 'RAVID', 'effective_date': '2022-08-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3414111: [{'rep_id': 7044, 'department': '25112233', 'job_title': '9214', 'commission_flag': 'Y', 'first_name': 'SOO', 'last_name': 'K', 'full_name': 'SOO K', 'email': 'SOOK', 'effective_date': '2023-03-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3414112: [{'rep_id': 7045, 'department': '25223344', 'job_title': '7281', 'commission_flag': 'Y', 'first_name': 'MIN', 'last_name': 'J', 'full_name': 'MIN J', 'email': 'MINJ', 'effective_date': '2019-09-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3414113: [{'rep_id': 7046, 'department': '25334455', 'job_title': '6047', 'commission_flag': 'Y', 'first_name': 'YURI', 'last_name': 'H', 'full_name': 'YURI H', 'email': 'YURIH', 'effective_date': '2020-06-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3414114: [{'rep_id': 7047, 'department': '25445566', 'job_title': '4813', 'commission_flag': 'Y', 'first_name': 'TAKESHI', 'last_name': 'M', 'full_name': 'TAKESHI M', 'email': 'TAKESHIM', 'effective_date': '2021-11-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3414115: [{'rep_id': 7048, 'department': '25556677', 'job_title': '3579', 'commission_flag': 'Y', 'first_name': 'NARA', 'last_name': 'B', 'full_name': 'NARA B', 'email': 'NARAB', 'effective_date': '2022-12-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3414116: [{'rep_id': 7049, 'department': '25667788', 'job_title': '4813', 'commission_flag': 'Y', 'first_name': 'DAVID', 'last_name': 'R', 'full_name': 'DAVID R', 'email': 'DAVIDR', 'effective_date': '2023-06-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
    3555555: [{'rep_id': 7034, 'department': '24112233', 'job_title': '4813', 'commission_flag': 'Y', 'first_name': 'ARJUN', 'last_name': 'K', 'full_name': 'ARJUN K', 'email': 'ARJUNK', 'effective_date': '2020-03-01', 'expiration_date': None, 'obsolete': 'N', 'relationship_type': 'EMPLOYEE', 'assignment_effective_date': '2026-05-01'}],
}

_GLOBAL_SALES_TXNS_BY_NODE_ID = {
    444444: [{'trx_id': 13, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9013, 'unit_price': 2000.0, 'qty': 5, 'trx_value': 10000.0, 'rep_id': 7003, 'product_id': 'SKU-SW-DC-SPINE'}, {'trx_id': 14, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9014, 'unit_price': 500.0, 'qty': 12, 'trx_value': 6000.0, 'rep_id': 7003, 'product_id': 'SKU-MSG-SUITE'}],
    1222222: [{'trx_id': 15, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9015, 'unit_price': 100.0, 'qty': 15, 'trx_value': 1500.0, 'rep_id': 7004, 'product_id': 'SKU-SW-DC-SPINE'}, {'trx_id': 16, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9016, 'unit_price': 500.0, 'qty': 3, 'trx_value': 1500.0, 'rep_id': 7004, 'product_id': 'SKU-AP-IND-PRO'}],
    1333333: [{'trx_id': 17, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9017, 'unit_price': 80.0, 'qty': 2, 'trx_value': 160.0, 'rep_id': 7005, 'product_id': 'SKU-ZTNA-GW'}, {'trx_id': 18, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9018, 'unit_price': 500.0, 'qty': 8, 'trx_value': 4000.0, 'rep_id': 7005, 'product_id': 'SKU-SDWAN-ENT'}],
    1411111: [{'trx_id': 21, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9021, 'unit_price': 400.0, 'qty': 20, 'trx_value': 8000.0, 'rep_id': 7007, 'product_id': 'SKU-SW-ACC-48P'}, {'trx_id': 22, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9022, 'unit_price': 800.0, 'qty': 8, 'trx_value': 6400.0, 'rep_id': 7007, 'product_id': 'SKU-SDWAN-STD'}],
    1411113: [{'trx_id': 23, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9023, 'unit_price': 500.0, 'qty': 3, 'trx_value': 1500.0, 'rep_id': 7008, 'product_id': 'SKU-VC-ROOMKIT'}, {'trx_id': 24, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9024, 'unit_price': 1000.0, 'qty': 1, 'trx_value': 1000.0, 'rep_id': 7008, 'product_id': 'SKU-SW-DC-LEAF'}],
    1411114: [{'trx_id': 25, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9025, 'unit_price': 150.0, 'qty': 4, 'trx_value': 600.0, 'rep_id': 7009, 'product_id': 'SKU-SDWAN-STD'}, {'trx_id': 26, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9026, 'unit_price': 1000.0, 'qty': 2, 'trx_value': 2000.0, 'rep_id': 7009, 'product_id': 'SKU-NGFW-CAMPUS'}],
    1412111: [{'trx_id': 27, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9027, 'unit_price': 800.0, 'qty': 15, 'trx_value': 12000.0, 'rep_id': 7010, 'product_id': 'SKU-VC-ROOMKIT'}, {'trx_id': 28, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9028, 'unit_price': 800.0, 'qty': 15, 'trx_value': 12000.0, 'rep_id': 7010, 'product_id': 'SKU-AP-IND-STD'}],
    1412112: [{'trx_id': 29, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9029, 'unit_price': 500.0, 'qty': 10, 'trx_value': 5000.0, 'rep_id': 7011, 'product_id': 'SKU-ZTNA-GW'}, {'trx_id': 30, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9030, 'unit_price': 100.0, 'qty': 3, 'trx_value': 300.0, 'rep_id': 7011, 'product_id': 'SKU-AP-IND-STD'}],
    1412114: [{'trx_id': 31, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9031, 'unit_price': 5000.0, 'qty': 4, 'trx_value': 20000.0, 'rep_id': 7012, 'product_id': 'SKU-RTR-BR-STD'}, {'trx_id': 32, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9032, 'unit_price': 2000.0, 'qty': 3, 'trx_value': 6000.0, 'rep_id': 7012, 'product_id': 'SKU-MSG-SUITE'}],
    1413111: [{'trx_id': 33, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9033, 'unit_price': 80.0, 'qty': 3, 'trx_value': 240.0, 'rep_id': 7013, 'product_id': 'SKU-SDWAN-STD'}, {'trx_id': 34, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9034, 'unit_price': 2000.0, 'qty': 20, 'trx_value': 40000.0, 'rep_id': 7013, 'product_id': 'SKU-NGFW-BR'}],
    1413113: [{'trx_id': 35, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9035, 'unit_price': 1500.0, 'qty': 20, 'trx_value': 30000.0, 'rep_id': 7014, 'product_id': 'SKU-AP-IND-STD'}, {'trx_id': 36, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9036, 'unit_price': 5000.0, 'qty': 15, 'trx_value': 75000.0, 'rep_id': 7014, 'product_id': 'SKU-VC-ROOMKIT'}],
    1413114: [{'trx_id': 37, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9037, 'unit_price': 800.0, 'qty': 10, 'trx_value': 8000.0, 'rep_id': 7015, 'product_id': 'SKU-NGFW-CAMPUS'}, {'trx_id': 38, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9038, 'unit_price': 5000.0, 'qty': 10, 'trx_value': 50000.0, 'rep_id': 7015, 'product_id': 'SKU-MSG-SUITE'}],
    1414111: [{'trx_id': 1, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-01', 'deal_id': 2222, 'unit_price': 1000.0, 'qty': 10, 'trx_value': 10000.0, 'rep_id': 1234, 'product_id': 'SKU-SW-ACC-24P'}],
    1414112: [{'trx_id': 2, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-01', 'deal_id': 1111, 'unit_price': 450.0, 'qty': 1, 'trx_value': 450.0, 'rep_id': 2222, 'product_id': 'SKU-AP-IND-STD'}, {'trx_id': 7, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-01', 'deal_id': 5678, 'unit_price': 100.0, 'qty': 10, 'trx_value': 1000.0, 'rep_id': 2222, 'product_id': 'SKU-AP-IND-PRO'}, {'trx_id': 11, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-21', 'deal_id': 1505, 'unit_price': 55.0, 'qty': 20, 'trx_value': 1100.0, 'rep_id': 2222, 'product_id': 'SKU-MSG-SUITE'}],
    1414113: [{'trx_id': 3, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-10', 'deal_id': 1111, 'unit_price': 800.0, 'qty': 5, 'trx_value': 4000.0, 'rep_id': 3210, 'product_id': 'SKU-RTR-BR-STD'}, {'trx_id': 8, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-01', 'deal_id': 8022, 'unit_price': 45.0, 'qty': 1, 'trx_value': 45.0, 'rep_id': 3210, 'product_id': 'SKU-SW-ACC-48P'}, {'trx_id': 12, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-01', 'deal_id': 1739, 'unit_price': 800.0, 'qty': 4, 'trx_value': 3200.0, 'rep_id': 3210, 'product_id': 'SKU-ZTNA-GW'}],
    1414114: [{'trx_id': 4, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-20', 'deal_id': 2233, 'unit_price': 1000.0, 'qty': 25, 'trx_value': 25000.0, 'rep_id': 4198, 'product_id': 'SKU-SDWAN-STD'}, {'trx_id': 9, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-10', 'deal_id': 1036, 'unit_price': 80.0, 'qty': 5, 'trx_value': 400.0, 'rep_id': 4198, 'product_id': 'SKU-RTR-BR-ENT'}],
    1414115: [{'trx_id': 5, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-21', 'deal_id': 3333, 'unit_price': 500.0, 'qty': 20, 'trx_value': 10000.0, 'rep_id': 5186, 'product_id': 'SKU-NGFW-BR'}, {'trx_id': 10, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-20', 'deal_id': 1271, 'unit_price': 10000.0, 'qty': 25, 'trx_value': 250000.0, 'rep_id': 5186, 'product_id': 'SKU-SDWAN-ENT'}],
    1414116: [{'trx_id': 6, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-01', 'deal_id': 3334, 'unit_price': 800.0, 'qty': 4, 'trx_value': 3200.0, 'rep_id': 6174, 'product_id': 'SKU-VC-ROOMKIT'}],
    1555555: [{'trx_id': 19, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9019, 'unit_price': 2000.0, 'qty': 12, 'trx_value': 24000.0, 'rep_id': 7006, 'product_id': 'SKU-MSG-SUITE'}, {'trx_id': 20, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9020, 'unit_price': 400.0, 'qty': 12, 'trx_value': 4800.0, 'rep_id': 7006, 'product_id': 'SKU-SW-DC-SPINE'}],
    2222222: [{'trx_id': 39, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9039, 'unit_price': 100.0, 'qty': 4, 'trx_value': 400.0, 'rep_id': 7001, 'product_id': 'SKU-WLC-500'}, {'trx_id': 40, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9040, 'unit_price': 100.0, 'qty': 8, 'trx_value': 800.0, 'rep_id': 7001, 'product_id': 'SKU-AP-IND-PRO'}],
    2333333: [{'trx_id': 41, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9041, 'unit_price': 100.0, 'qty': 1, 'trx_value': 100.0, 'rep_id': 7016, 'product_id': 'SKU-SW-ACC-48P'}, {'trx_id': 42, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9042, 'unit_price': 1500.0, 'qty': 2, 'trx_value': 3000.0, 'rep_id': 7016, 'product_id': 'SKU-AP-IND-STD'}],
    2411111: [{'trx_id': 45, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9045, 'unit_price': 1000.0, 'qty': 2, 'trx_value': 2000.0, 'rep_id': 7018, 'product_id': 'SKU-NGFW-BR'}, {'trx_id': 46, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9046, 'unit_price': 1000.0, 'qty': 12, 'trx_value': 12000.0, 'rep_id': 7018, 'product_id': 'SKU-MSG-SUITE'}],
    2411113: [{'trx_id': 47, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9047, 'unit_price': 100.0, 'qty': 3, 'trx_value': 300.0, 'rep_id': 7019, 'product_id': 'SKU-SDWAN-STD'}, {'trx_id': 48, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9048, 'unit_price': 400.0, 'qty': 12, 'trx_value': 4800.0, 'rep_id': 7019, 'product_id': 'SKU-SDWAN-ENT'}],
    2411114: [{'trx_id': 49, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9049, 'unit_price': 250.0, 'qty': 15, 'trx_value': 3750.0, 'rep_id': 7020, 'product_id': 'SKU-SW-ACC-24P'}, {'trx_id': 50, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9050, 'unit_price': 1500.0, 'qty': 1, 'trx_value': 1500.0, 'rep_id': 7020, 'product_id': 'SKU-AP-IND-STD'}],
    2412111: [{'trx_id': 51, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9051, 'unit_price': 5000.0, 'qty': 2, 'trx_value': 10000.0, 'rep_id': 7021, 'product_id': 'SKU-SDWAN-STD'}, {'trx_id': 52, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9052, 'unit_price': 150.0, 'qty': 8, 'trx_value': 1200.0, 'rep_id': 7021, 'product_id': 'SKU-NGFW-BR'}],
    2412112: [{'trx_id': 53, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9053, 'unit_price': 5000.0, 'qty': 4, 'trx_value': 20000.0, 'rep_id': 7022, 'product_id': 'SKU-SDWAN-ENT'}, {'trx_id': 54, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9054, 'unit_price': 250.0, 'qty': 10, 'trx_value': 2500.0, 'rep_id': 7022, 'product_id': 'SKU-WLC-500'}],
    2412114: [{'trx_id': 55, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9055, 'unit_price': 1500.0, 'qty': 12, 'trx_value': 18000.0, 'rep_id': 7023, 'product_id': 'SKU-WLC-500'}, {'trx_id': 56, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9056, 'unit_price': 80.0, 'qty': 5, 'trx_value': 400.0, 'rep_id': 7023, 'product_id': 'SKU-SW-ACC-24P'}],
    2413111: [{'trx_id': 57, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9057, 'unit_price': 250.0, 'qty': 20, 'trx_value': 5000.0, 'rep_id': 7024, 'product_id': 'SKU-RTR-BR-ENT'}, {'trx_id': 58, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9058, 'unit_price': 500.0, 'qty': 8, 'trx_value': 4000.0, 'rep_id': 7024, 'product_id': 'SKU-VC-ROOMKIT'}],
    2413113: [{'trx_id': 59, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9059, 'unit_price': 100.0, 'qty': 4, 'trx_value': 400.0, 'rep_id': 7025, 'product_id': 'SKU-RTR-BR-STD'}, {'trx_id': 60, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9060, 'unit_price': 500.0, 'qty': 4, 'trx_value': 2000.0, 'rep_id': 7025, 'product_id': 'SKU-WLC-500'}],
    2413114: [{'trx_id': 61, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9061, 'unit_price': 1000.0, 'qty': 8, 'trx_value': 8000.0, 'rep_id': 7026, 'product_id': 'SKU-SW-ACC-24P'}, {'trx_id': 62, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9062, 'unit_price': 800.0, 'qty': 4, 'trx_value': 3200.0, 'rep_id': 7026, 'product_id': 'SKU-SW-DC-LEAF'}],
    2414111: [{'trx_id': 63, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9063, 'unit_price': 800.0, 'qty': 8, 'trx_value': 6400.0, 'rep_id': 7027, 'product_id': 'SKU-AP-IND-PRO'}, {'trx_id': 64, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9064, 'unit_price': 1000.0, 'qty': 10, 'trx_value': 10000.0, 'rep_id': 7027, 'product_id': 'SKU-NGFW-CAMPUS'}],
    2414112: [{'trx_id': 65, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9065, 'unit_price': 150.0, 'qty': 3, 'trx_value': 450.0, 'rep_id': 7028, 'product_id': 'SKU-AP-IND-PRO'}, {'trx_id': 66, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9066, 'unit_price': 2000.0, 'qty': 12, 'trx_value': 24000.0, 'rep_id': 7028, 'product_id': 'SKU-AP-IND-STD'}],
    2414113: [{'trx_id': 67, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9067, 'unit_price': 5000.0, 'qty': 8, 'trx_value': 40000.0, 'rep_id': 7029, 'product_id': 'SKU-MSG-SUITE'}, {'trx_id': 68, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9068, 'unit_price': 80.0, 'qty': 1, 'trx_value': 80.0, 'rep_id': 7029, 'product_id': 'SKU-AP-IND-STD'}],
    2414114: [{'trx_id': 69, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9069, 'unit_price': 800.0, 'qty': 4, 'trx_value': 3200.0, 'rep_id': 7030, 'product_id': 'SKU-AP-IND-STD'}, {'trx_id': 70, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9070, 'unit_price': 400.0, 'qty': 4, 'trx_value': 1600.0, 'rep_id': 7030, 'product_id': 'SKU-SW-ACC-24P'}],
    2414115: [{'trx_id': 71, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9071, 'unit_price': 2000.0, 'qty': 8, 'trx_value': 16000.0, 'rep_id': 7031, 'product_id': 'SKU-RTR-BR-STD'}, {'trx_id': 72, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9072, 'unit_price': 150.0, 'qty': 1, 'trx_value': 150.0, 'rep_id': 7031, 'product_id': 'SKU-ZTNA-GW'}],
    2414116: [{'trx_id': 73, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9073, 'unit_price': 5000.0, 'qty': 20, 'trx_value': 100000.0, 'rep_id': 7032, 'product_id': 'SKU-VC-ROOMKIT'}, {'trx_id': 74, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9074, 'unit_price': 1500.0, 'qty': 3, 'trx_value': 4500.0, 'rep_id': 7032, 'product_id': 'SKU-ZTNA-GW'}],
    2555555: [{'trx_id': 43, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9043, 'unit_price': 100.0, 'qty': 4, 'trx_value': 400.0, 'rep_id': 7017, 'product_id': 'SKU-SW-ACC-24P'}, {'trx_id': 44, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9044, 'unit_price': 150.0, 'qty': 5, 'trx_value': 750.0, 'rep_id': 7017, 'product_id': 'SKU-NGFW-CAMPUS'}],
    3222222: [{'trx_id': 75, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9075, 'unit_price': 1500.0, 'qty': 15, 'trx_value': 22500.0, 'rep_id': 7002, 'product_id': 'SKU-AP-IND-STD'}, {'trx_id': 76, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9076, 'unit_price': 150.0, 'qty': 20, 'trx_value': 3000.0, 'rep_id': 7002, 'product_id': 'SKU-VC-ROOMKIT'}],
    3333333: [{'trx_id': 77, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9077, 'unit_price': 150.0, 'qty': 3, 'trx_value': 450.0, 'rep_id': 7033, 'product_id': 'SKU-AP-IND-STD'}, {'trx_id': 78, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9078, 'unit_price': 1500.0, 'qty': 1, 'trx_value': 1500.0, 'rep_id': 7033, 'product_id': 'SKU-SW-DC-LEAF'}],
    3411111: [{'trx_id': 81, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9081, 'unit_price': 1500.0, 'qty': 12, 'trx_value': 18000.0, 'rep_id': 7035, 'product_id': 'SKU-SW-DC-LEAF'}, {'trx_id': 82, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9082, 'unit_price': 100.0, 'qty': 12, 'trx_value': 1200.0, 'rep_id': 7035, 'product_id': 'SKU-SW-ACC-24P'}],
    3411113: [{'trx_id': 83, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9083, 'unit_price': 400.0, 'qty': 12, 'trx_value': 4800.0, 'rep_id': 7036, 'product_id': 'SKU-WLC-500'}, {'trx_id': 84, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9084, 'unit_price': 1500.0, 'qty': 4, 'trx_value': 6000.0, 'rep_id': 7036, 'product_id': 'SKU-MSG-SUITE'}],
    3411114: [{'trx_id': 85, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9085, 'unit_price': 1500.0, 'qty': 4, 'trx_value': 6000.0, 'rep_id': 7037, 'product_id': 'SKU-RTR-BR-ENT'}, {'trx_id': 86, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9086, 'unit_price': 800.0, 'qty': 2, 'trx_value': 1600.0, 'rep_id': 7037, 'product_id': 'SKU-AP-IND-STD'}],
    3412111: [{'trx_id': 87, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9087, 'unit_price': 500.0, 'qty': 2, 'trx_value': 1000.0, 'rep_id': 7038, 'product_id': 'SKU-VC-ROOMKIT'}, {'trx_id': 88, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9088, 'unit_price': 100.0, 'qty': 4, 'trx_value': 400.0, 'rep_id': 7038, 'product_id': 'SKU-ZTNA-GW'}],
    3412112: [{'trx_id': 89, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9089, 'unit_price': 150.0, 'qty': 8, 'trx_value': 1200.0, 'rep_id': 7039, 'product_id': 'SKU-SW-DC-LEAF'}, {'trx_id': 90, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9090, 'unit_price': 150.0, 'qty': 12, 'trx_value': 1800.0, 'rep_id': 7039, 'product_id': 'SKU-RTR-BR-ENT'}],
    3412114: [{'trx_id': 91, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9091, 'unit_price': 800.0, 'qty': 12, 'trx_value': 9600.0, 'rep_id': 7040, 'product_id': 'SKU-SW-DC-LEAF'}, {'trx_id': 92, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9092, 'unit_price': 150.0, 'qty': 10, 'trx_value': 1500.0, 'rep_id': 7040, 'product_id': 'SKU-RTR-BR-STD'}],
    3413111: [{'trx_id': 93, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9093, 'unit_price': 500.0, 'qty': 10, 'trx_value': 5000.0, 'rep_id': 7041, 'product_id': 'SKU-NGFW-CAMPUS'}, {'trx_id': 94, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9094, 'unit_price': 500.0, 'qty': 2, 'trx_value': 1000.0, 'rep_id': 7041, 'product_id': 'SKU-NGFW-BR'}],
    3413113: [{'trx_id': 95, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9095, 'unit_price': 500.0, 'qty': 15, 'trx_value': 7500.0, 'rep_id': 7042, 'product_id': 'SKU-SW-ACC-24P'}, {'trx_id': 96, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9096, 'unit_price': 80.0, 'qty': 10, 'trx_value': 800.0, 'rep_id': 7042, 'product_id': 'SKU-VC-ROOMKIT'}],
    3413114: [{'trx_id': 97, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9097, 'unit_price': 1500.0, 'qty': 2, 'trx_value': 3000.0, 'rep_id': 7043, 'product_id': 'SKU-SDWAN-STD'}, {'trx_id': 98, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9098, 'unit_price': 100.0, 'qty': 2, 'trx_value': 200.0, 'rep_id': 7043, 'product_id': 'SKU-RTR-BR-STD'}],
    3414111: [{'trx_id': 99, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9099, 'unit_price': 80.0, 'qty': 3, 'trx_value': 240.0, 'rep_id': 7044, 'product_id': 'SKU-RTR-BR-ENT'}, {'trx_id': 100, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-02', 'deal_id': 9100, 'unit_price': 800.0, 'qty': 5, 'trx_value': 4000.0, 'rep_id': 7044, 'product_id': 'SKU-AP-IND-STD'}],
    3414112: [{'trx_id': 101, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-08-10', 'deal_id': 9101, 'unit_price': 1500.0, 'qty': 15, 'trx_value': 22500.0, 'rep_id': 7045, 'product_id': 'SKU-AP-IND-STD'}, {'trx_id': 102, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9102, 'unit_price': 500.0, 'qty': 2, 'trx_value': 1000.0, 'rep_id': 7045, 'product_id': 'SKU-MSG-SUITE'}],
    3414113: [{'trx_id': 103, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9103, 'unit_price': 150.0, 'qty': 10, 'trx_value': 1500.0, 'rep_id': 7046, 'product_id': 'SKU-SW-ACC-48P'}, {'trx_id': 104, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9104, 'unit_price': 80.0, 'qty': 2, 'trx_value': 160.0, 'rep_id': 7046, 'product_id': 'SKU-RTR-BR-ENT'}],
    3414114: [{'trx_id': 105, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9105, 'unit_price': 2000.0, 'qty': 4, 'trx_value': 8000.0, 'rep_id': 7047, 'product_id': 'SKU-SW-DC-SPINE'}, {'trx_id': 106, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9106, 'unit_price': 100.0, 'qty': 12, 'trx_value': 1200.0, 'rep_id': 7047, 'product_id': 'SKU-RTR-BR-ENT'}],
    3414115: [{'trx_id': 107, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9107, 'unit_price': 1500.0, 'qty': 10, 'trx_value': 15000.0, 'rep_id': 7048, 'product_id': 'SKU-SDWAN-ENT'}, {'trx_id': 108, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-15', 'deal_id': 9108, 'unit_price': 80.0, 'qty': 15, 'trx_value': 1200.0, 'rep_id': 7048, 'product_id': 'SKU-AP-IND-STD'}],
    3414116: [{'trx_id': 109, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9109, 'unit_price': 150.0, 'qty': 5, 'trx_value': 750.0, 'rep_id': 7049, 'product_id': 'SKU-SW-DC-LEAF'}, {'trx_id': 110, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-25', 'deal_id': 9110, 'unit_price': 250.0, 'qty': 5, 'trx_value': 1250.0, 'rep_id': 7049, 'product_id': 'SKU-AP-IND-PRO'}],
    3555555: [{'trx_id': 79, 'trx_source': 'ERP', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9079, 'unit_price': 100.0, 'qty': 15, 'trx_value': 1500.0, 'rep_id': 7034, 'product_id': 'SKU-MSG-SUITE'}, {'trx_id': 80, 'trx_source': 'POS', 'trx_currency': 'USD', 'trx_book_date': '2026-07-05', 'deal_id': 9080, 'unit_price': 250.0, 'qty': 5, 'trx_value': 1250.0, 'rep_id': 7034, 'product_id': 'SKU-RTR-BR-STD'}],
}


def _seed_global_sales_hierarchy(db: Session, admin: User):
    """GLOBAL -> Theater -> Sub Theater -> Area -> Region -> Select Region -> Account,
    imported from the source NODE DETAILS seed dataset. Any node with rep/transaction
    assignments (per NODE_REL and TRANSACTION DETAILS, joined on the source NODE_ID) gets
    `revenue` (sum of transaction value) and `headcount` (assigned rep count) set directly,
    with the raw assignments stored as JSON strings under `reps` / `transactions`.
    Demonstrates a chained SUM rollup of both `revenue` and `headcount` up to the Super
    Theater root, and stores the original spreadsheet LEVEL_ID and NODE_ID on every node
    as `source_level_id` / `source_node_id` for traceability."""
    hierarchy_type = HierarchyType(
        code="GLOBAL_SALES_ORG",
        name="Global Sales Organization",
        description="Global sales org structure imported from the source hierarchy seed data",
        allow_multiple_parents=False,
        created_by=admin.username,
    )
    db.add(hierarchy_type)
    db.flush()

    super_theater = _make_node_type(db, hierarchy_type, "SUPER_THEATER", "Super Theater", 0)
    theater = _make_node_type(db, hierarchy_type, "THEATER", "Theater", 1)
    sub_theater = _make_node_type(db, hierarchy_type, "SUB_THEATER", "Sub Theater", 2)
    area = _make_node_type(db, hierarchy_type, "AREA", "Area", 3)
    region = _make_node_type(db, hierarchy_type, "REGION", "Region", 4)
    select_region = _make_node_type(db, hierarchy_type, "SELECT_REGION", "Select Region", 5)
    account = _make_node_type(db, hierarchy_type, "ACCOUNT", "Account", 6)

    tiers_by_code = {
        "SUPER_THEATER": super_theater,
        "THEATER": theater,
        "SUB_THEATER": sub_theater,
        "AREA": area,
        "REGION": region,
        "SELECT_REGION": select_region,
        "ACCOUNT": account,
    }

    _add_structural_rule(db, hierarchy_type, super_theater, theater)
    _add_structural_rule(db, hierarchy_type, theater, sub_theater)
    _add_structural_rule(db, hierarchy_type, sub_theater, area)
    _add_structural_rule(db, hierarchy_type, area, region)
    _add_structural_rule(db, hierarchy_type, region, select_region)
    _add_structural_rule(db, hierarchy_type, select_region, account)

    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=None,
            property_code="source_level_id",
            display_label="Source Level ID",
            data_type=PropertyDataType.NUMBER.value,
            display_order=0,
        )
    )
    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=None,
            property_code="source_node_id",
            display_label="Source Node ID",
            data_type=PropertyDataType.NUMBER.value,
            display_order=1,
        )
    )
    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=None,
            property_code="revenue",
            display_label="Revenue",
            data_type=PropertyDataType.NUMBER.value,
            display_order=2,
        )
    )
    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=None,
            property_code="headcount",
            display_label="Headcount",
            data_type=PropertyDataType.NUMBER.value,
            display_order=3,
        )
    )
    _add_chained_rollup_definitions(
        db,
        hierarchy_type,
        [select_region, region, area, sub_theater, theater, super_theater],
        {"revenue": "Total Revenue", "headcount": "Total Headcount"},
    )
    db.flush()

    hierarchy, version = _make_hierarchy_and_active_version(
        db, hierarchy_type, "GLOBAL_SALES", "Global Sales Organization", "Imported global sales org hierarchy", admin
    )

    version_nodes_by_source_id: dict[int, HierarchyVersionNode] = {}
    for source_id, name, parent_source_id, level_id, tier_code, node_id in _GLOBAL_SALES_ROWS:
        node_type = tiers_by_code[tier_code]
        parent_vn = version_nodes_by_source_id.get(parent_source_id) if parent_source_id else None
        properties = {"source_level_id": level_id, "source_node_id": node_id}

        reps = _GLOBAL_SALES_REPS_BY_NODE_ID.get(node_id)
        if reps:
            properties["headcount"] = len(reps)
            properties["reps"] = json.dumps(reps)

        txns = _GLOBAL_SALES_TXNS_BY_NODE_ID.get(node_id)
        if txns:
            properties["revenue"] = sum(t["trx_value"] for t in txns)
            properties["transactions"] = json.dumps(txns)

        vn = _add_version_node(
            db,
            hierarchy,
            version,
            admin,
            node_type,
            name,
            parent_vn.version_node_id if parent_vn else None,
            properties,
        )
        version_nodes_by_source_id[source_id] = vn


# (GROUP_ID, GROUP_CODE, GROUP_NAME, DESCRIPTION)
_PRODUCT_GROUPS = [
    (100, "PG-ENT-NET", "Enterprise Networking", "Campus switching and wireless/mobility products"),
    (101, "PG-SP-NET", "Routing & SD-WAN", "Branch/edge routing and SD-WAN products"),
    (102, "PG-SEC", "Network Security", "Next-gen firewalls and secure access products"),
    (103, "PG-COLLAB", "Collaboration", "Video conferencing and team messaging products"),
]

# (CATEGORY_ID, CATEGORY_CODE, CATEGORY_NAME, GROUP_ID)
_PRODUCT_CATEGORIES = [
    (110, "PC-SWITCH", "Switching", 100),
    (111, "PC-WIRELESS", "Wireless & Mobility", 100),
    (112, "PC-ROUTING", "Routing", 101),
    (113, "PC-SDWAN", "SD-WAN & Cloud Networking", 101),
    (114, "PC-FIREWALL", "Firewall & Threat Defense", 102),
    (115, "PC-ACCESS", "Secure Access (ZTNA/VPN)", 102),
    (116, "PC-VIDEO", "Video Conferencing", 103),
    (117, "PC-MSG", "Team Messaging & Calling", 103),
]

# (FAMILY_ID, FAMILY_CODE, FAMILY_NAME, CATEGORY_ID)
_PRODUCT_FAMILIES = [
    (120, "PF-CAMPUS-SW", "Campus Switches", 110),
    (121, "PF-DC-SW", "Data Center Switches", 110),
    (122, "PF-WLAN-AP", "Wireless Access Points", 111),
    (123, "PF-WLC", "Wireless LAN Controllers", 111),
    (124, "PF-EDGE-RTR", "Branch/Edge Routers", 112),
    (125, "PF-SDWAN-APPL", "SD-WAN Edge Appliances", 113),
    (126, "PF-NGFW", "Next-Gen Firewalls", 114),
    (127, "PF-ZTNA", "Zero Trust Network Access", 115),
    (128, "PF-VC-ENDPOINT", "Video Conferencing Endpoints", 116),
    (129, "PF-MSG-PLATFORM", "Team Messaging Platforms", 117),
]

# (ID, PRODUCT_ID/SKU, PRODUCT_NAME, FAMILY_ID, STATUS, EFFECTIVE_DATE)
_PRODUCTS = [
    (140, "SKU-SW-ACC-24P", "Campus Switch 24-Port", 120, "ACTIVE", "2023-01-01"),
    (141, "SKU-SW-ACC-48P", "Campus Switch 48-Port PoE", 120, "ACTIVE", "2023-01-01"),
    (142, "SKU-SW-DC-SPINE", "Data Center Spine Switch", 121, "ACTIVE", "2023-01-01"),
    (143, "SKU-SW-DC-LEAF", "Data Center Leaf Switch", 121, "ACTIVE", "2023-01-01"),
    (144, "SKU-AP-IND-STD", "Indoor AP Standard (Wi-Fi 6)", 122, "ACTIVE", "2023-01-01"),
    (145, "SKU-AP-IND-PRO", "Indoor AP Pro (Wi-Fi 6E)", 122, "ACTIVE", "2023-01-01"),
    (146, "SKU-WLC-500", "Wireless LAN Controller (500 AP)", 123, "ACTIVE", "2023-01-01"),
    (147, "SKU-RTR-BR-STD", "Branch Router Standard", 124, "ACTIVE", "2023-01-01"),
    (148, "SKU-RTR-BR-ENT", "Branch Router Enterprise", 124, "ACTIVE", "2023-01-01"),
    (149, "SKU-SDWAN-STD", "SD-WAN Edge Appliance Standard", 125, "ACTIVE", "2023-01-01"),
    (150, "SKU-SDWAN-ENT", "SD-WAN Edge Appliance Enterprise", 125, "ACTIVE", "2023-01-01"),
    (151, "SKU-NGFW-BR", "NGFW Branch Appliance", 126, "ACTIVE", "2023-01-01"),
    (152, "SKU-NGFW-CAMPUS", "NGFW Campus Appliance", 126, "ACTIVE", "2023-01-01"),
    (153, "SKU-ZTNA-GW", "ZTNA Gateway Subscription", 127, "ACTIVE", "2023-01-01"),
    (154, "SKU-VC-ROOMKIT", "Video Room Kit", 128, "ACTIVE", "2023-01-01"),
    (155, "SKU-MSG-SUITE", "Team Messaging Suite License", 129, "ACTIVE", "2023-01-01"),
]

# product SKU -> total transaction value across _GLOBAL_SALES_TXNS_BY_NODE_ID, used as inventory_value
_PRODUCT_INVENTORY_VALUE = {}
for _txn_list in _GLOBAL_SALES_TXNS_BY_NODE_ID.values():
    for _txn in _txn_list:
        _PRODUCT_INVENTORY_VALUE[_txn["product_id"]] = _PRODUCT_INVENTORY_VALUE.get(_txn["product_id"], 0) + _txn["trx_value"]


def _seed_product_hierarchy(db: Session, admin: User):
    """Product Group -> Category -> Family -> Product (SKU), imported from the source
    PRODUCT_GROUP/PRODUCT_CATEGORY/PRODUCT_FAMILY/PRODUCT reference tables. `inventory_value`
    on each product is the sum of its transaction value from the Global Sales Organization
    hierarchy's TRANSACTION DETAILS, chained via SUM rollup as `total_inventory_value` up
    through Family, Category, and Group."""
    hierarchy_type = HierarchyType(
        code="PRODUCT_CATALOG",
        name="Product Catalog",
        description="Product catalog imported from the source PRODUCT reference seed data",
        allow_multiple_parents=False,
        created_by=admin.username,
    )
    db.add(hierarchy_type)
    db.flush()

    product = _make_node_type(db, hierarchy_type, "PRODUCT", "Product", 0)
    family = _make_node_type(db, hierarchy_type, "PRODUCT_FAMILY", "Product Family", 1)
    category = _make_node_type(db, hierarchy_type, "PRODUCT_CATEGORY", "Product Category", 2)
    group = _make_node_type(db, hierarchy_type, "PRODUCT_GROUP", "Product Group", 3)

    _add_structural_rule(db, hierarchy_type, group, category)
    _add_structural_rule(db, hierarchy_type, category, family)
    _add_structural_rule(db, hierarchy_type, family, product)

    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=group.node_type_id,
            property_code="description",
            display_label="Description",
            data_type=PropertyDataType.STRING.value,
            display_order=0,
        )
    )
    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=None,
            property_code="source_code",
            display_label="Source Code",
            data_type=PropertyDataType.STRING.value,
            display_order=1,
        )
    )
    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=product.node_type_id,
            property_code="status",
            display_label="Status",
            data_type=PropertyDataType.STRING.value,
            display_order=2,
        )
    )
    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=product.node_type_id,
            property_code="effective_date",
            display_label="Effective Date",
            data_type=PropertyDataType.DATE.value,
            display_order=3,
        )
    )
    db.add(
        NodePropertyDefinition(
            hierarchy_type_id=hierarchy_type.hierarchy_type_id,
            node_type_id=product.node_type_id,
            property_code="inventory_value",
            display_label="Inventory Value",
            data_type=PropertyDataType.NUMBER.value,
            display_order=4,
        )
    )
    _add_chained_rollup_definitions(
        db,
        hierarchy_type,
        [family, category, group],
        {"inventory_value": "Total Inventory Value"},
    )
    db.flush()

    hierarchy, version = _make_hierarchy_and_active_version(
        db, hierarchy_type, "CATALOG", "Global Product Catalog", "Imported product catalog hierarchy", admin
    )

    def add_node(node_type, display_name, parent_version_node_id, properties=None):
        return _add_version_node(db, hierarchy, version, admin, node_type, display_name, parent_version_node_id, properties)

    group_nodes: dict[int, HierarchyVersionNode] = {}
    for group_id, code, name, description in _PRODUCT_GROUPS:
        group_nodes[group_id] = add_node(group, name, None, {"source_code": code, "description": description})

    category_nodes: dict[int, HierarchyVersionNode] = {}
    for category_id, code, name, group_id in _PRODUCT_CATEGORIES:
        category_nodes[category_id] = add_node(category, name, group_nodes[group_id].version_node_id, {"source_code": code})

    family_nodes: dict[int, HierarchyVersionNode] = {}
    for family_id, code, name, category_id in _PRODUCT_FAMILIES:
        family_nodes[family_id] = add_node(family, name, category_nodes[category_id].version_node_id, {"source_code": code})

    for _, sku, name, family_id, status, effective_date in _PRODUCTS:
        add_node(
            product,
            name,
            family_nodes[family_id].version_node_id,
            {
                "source_code": sku,
                "status": status,
                "effective_date": effective_date,
                "inventory_value": _PRODUCT_INVENTORY_VALUE.get(sku, 0),
            },
        )
