"""Vercel serverless entrypoint for the FastAPI backend.

Vercel discovers functions only in a root-level `api/` directory, but the
application package lives in `backend/app/`. Add `backend/` to sys.path so
`import app.main` resolves.
"""

import os
import sys

BACKEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"
)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app  # noqa: E402
