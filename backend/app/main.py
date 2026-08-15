from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine
from app.routers import auth, config, governance, hierarchy_types, node_types, versions
from app.utils.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield


app = FastAPI(
    title="SCM Hierarchy Management API",
    description="Supply Chain Management Hierarchy Management Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


app.include_router(auth.router)
app.include_router(hierarchy_types.router)
app.include_router(hierarchy_types.hierarchies_router)
app.include_router(node_types.router)
app.include_router(config.properties_router)
app.include_router(config.rules_router)
app.include_router(versions.router)
app.include_router(governance.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
