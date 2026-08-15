# SCM Hierarchy Management — Backend

FastAPI backend for the SCM Hierarchy Management platform.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

## Environment

| Variable | Default |
|----------|---------|
| DATABASE_URL | sqlite:///./hierarchy.db |
| CORS_ORIGINS | http://localhost:5173 |
| JWT_SECRET | change-me-in-production |

## Seeded users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Business Owner |
| scm_manager | password123 | Supply Chain Manager |
| data_governance | password123 | Data Governance Manager |
| business_owner | password123 | Business Owner |

## Tests

```bash
pytest tests/ -v
```

## Sample data

On first startup the database is seeded with:

- PRODUCT hierarchy type with Category → Sub Category → Brand → Product → SKU
- Global Product Hierarchy with Beverages/Snacks tree
- v1 (ACTIVE) and v2 (DRAFT) with intentional differences for compare demo
