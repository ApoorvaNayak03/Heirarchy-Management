from __future__ import annotations

import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.utils.seed import seed_database

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_hierarchy.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    if os.path.exists("test_hierarchy.db"):
        os.remove("test_hierarchy.db")
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    assert client.get("/api/health").status_code == 200


def test_signup_and_login(client):
    res = client.post("/api/auth/signup", json={
        "username": "testuser",
        "password": "password123",
        "display_name": "Test User",
        "role": "Business User",
    })
    assert res.status_code == 200
    login = client.post("/api/auth/login", json={"username": "testuser", "password": "password123"})
    assert login.status_code == 200
    assert "access_token" in login.json()


def test_list_hierarchy_types(client, auth_headers):
    res = client.get("/api/hierarchy-types", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_list_hierarchies(client, auth_headers):
    res = client.get("/api/hierarchies", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_get_version_tree(client, auth_headers):
    versions = client.get("/api/versions", headers=auth_headers).json()
    version_id = versions[0]["hierarchy_version_id"]
    res = client.get(f"/api/versions/{version_id}/tree", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_validate_version(client, auth_headers):
    draft = next(v for v in client.get("/api/versions", headers=auth_headers).json() if v["status"] == "DRAFT")
    res = client.post(f"/api/versions/{draft['hierarchy_version_id']}/validate", headers=auth_headers)
    assert res.status_code == 200
    assert "valid" in res.json()


def test_compare_versions(client, auth_headers):
    versions = client.get("/api/versions", headers=auth_headers).json()
    v1, v2 = versions[0]["hierarchy_version_id"], versions[1]["hierarchy_version_id"]
    res = client.get(f"/api/versions/{v1}/compare/{v2}", headers=auth_headers)
    assert res.status_code == 200
    assert "summary" in res.json()


def test_historical_lookup(client, auth_headers):
    hierarchy_id = client.get("/api/hierarchies", headers=auth_headers).json()[0]["hierarchy_id"]
    res = client.get(f"/api/hierarchies/{hierarchy_id}/versions/effective", params={"business_date": "2026-08-15"}, headers=auth_headers)
    assert res.status_code == 200


def test_copy_version_does_not_modify_source(client, auth_headers):
    versions = client.get("/api/versions", headers=auth_headers).json()
    active = next(v for v in versions if v["status"] == "ACTIVE")
    before_tree = client.get(f"/api/versions/{active['hierarchy_version_id']}/tree", headers=auth_headers).json()
    copy_res = client.post(f"/api/versions/{active['hierarchy_version_id']}/copy", json={"version_name": "Test Copy"}, headers=auth_headers)
    assert copy_res.status_code == 200
    after_tree = client.get(f"/api/versions/{active['hierarchy_version_id']}/tree", headers=auth_headers).json()
    assert len(before_tree) == len(after_tree)


def test_invalid_node_relationship_blocked(client, auth_headers):
    draft = next(v for v in client.get("/api/versions", headers=auth_headers).json() if v["status"] == "DRAFT")
    node_types = client.get("/api/node-types", headers=auth_headers).json()
    category = next(nt for nt in node_types if nt["code"] == "CATEGORY")
    res = client.post(f"/api/versions/{draft['hierarchy_version_id']}/nodes", headers=auth_headers, json={
        "node_type_id": category["node_type_id"],
        "display_name": "Invalid Child",
        "parent_version_node_id": None,
    })
    # Adding category under nothing is ok as root; try invalid parent-child via wrong parent
    tree = client.get(f"/api/versions/{draft['hierarchy_version_id']}/tree", headers=auth_headers).json()
    if tree:
        leaf = tree[0]
        while leaf.get("children"):
            leaf = leaf["children"][0]
        sku = next(nt for nt in node_types if nt["code"] == "SKU")
        bad = client.post(f"/api/versions/{draft['hierarchy_version_id']}/nodes", headers=auth_headers, json={
            "node_type_id": sku["node_type_id"],
            "display_name": "Bad SKU",
            "parent_version_node_id": leaf["version_node_id"],
        })
        assert bad.status_code in (400, 409)


def test_audit_trail(client, auth_headers):
    res = client.get("/api/audit", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
