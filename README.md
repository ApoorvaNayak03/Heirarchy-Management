# SCM Hierarchy Management Platform

A full-stack platform for designing, governing, and operating supply chain management (SCM) hierarchies. Configure hierarchy types and structural rules, build tree versions visually, validate changes, route them through approval workflows, activate new versions, and trace lineage and audit history.

## Tech stack

| Layer | Stack |
|-------|-------|
| Backend | FastAPI, SQLAlchemy, Alembic, SQLite, JWT auth |
| Frontend | React 19, Vite, React Router, Tailwind CSS, React Flow |
| Testing | pytest (backend) |

## Features

- **Configuration** — Hierarchy types, hierarchies, node types, property definitions, and structural rules
- **Version management** — Create, copy, draft, submit, activate, and retire hierarchy versions
- **Visual builder** — Tree and graph views with drag-and-drop editing, clone, and move operations
- **Validation** — Structural, property, and date-overlap checks before submission
- **Approval workflow** — User-defined approval steps with sequential approve/reject
- **Governance** — Version compare, audit trail, lineage graph, and dashboard stats
- **Guided workflow** — Step-by-step wizard from hierarchy type setup through activation

## Project structure

```
SPM/
├── backend/          # FastAPI API, models, services, Alembic migrations
│   ├── app/
│   ├── alembic/
│   └── tests/
├── frontend/         # React SPA (Vite)
│   └── src/
└── README.md
```

## Quick start

You need **Python 3.11+** and **Node.js 18+** installed locally.

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

API runs at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

On first startup the database is seeded with sample data, including a PRODUCT hierarchy (Category → Sub Category → Brand → Product → SKU) with an active v1 and a draft v2 for compare demos.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173** and proxies `/api` requests to the backend.

### Demo login

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Business Owner |
| `scm_manager` | `password123` | Supply Chain Manager |
| `data_governance` | `password123` | Data Governance Manager |
| `business_owner` | `password123` | Business Owner |

## Environment variables

Copy `backend/.env.example` to `backend/.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./hierarchy.db` | SQLAlchemy database URL |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origin(s) |
| `JWT_SECRET` | *(change in production)* | Secret for signing access tokens |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token lifetime in minutes |

## Running tests

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

## Production build

```bash
cd frontend
npm run build
```

Built assets are written to `frontend/dist/`.

## Further reading

- [backend/README.md](backend/README.md) — API setup, seeded users, and backend-specific notes
- [frontend/README.md](frontend/README.md) — Frontend setup and UI feature overview
