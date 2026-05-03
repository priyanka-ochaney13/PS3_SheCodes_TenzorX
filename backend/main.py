# main.py
"""
Poonawalla Fincorp — Agentic Loan Onboarding Backend
====================================================

Service ports:
  8000 — This main FastAPI app (all API endpoints)
  8001 — deepface_agent.py  (uvicorn agents/deepface_agent.py:app --port 8001)
The main app calls ports 8001 via HTTP internally.
All agent outputs are stored as JSON in the loan_sessions DB table.
No JSON files are written to disk — the DB is the message bus between agents.
"""

import os
import sys
import logging

# 1. Silence AI libraries BEFORE imports
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

# Disable specific noisy loggers
logging.getLogger('tensorflow').setLevel(logging.ERROR)
logging.getLogger('h5py').setLevel(logging.ERROR)
logging.getLogger('httpcore').setLevel(logging.INFO)

# 2. Add directories to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(backend_dir)
sys.path.extend([root_dir, backend_dir])

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# These now work regardless of where you start the process
from db.database import engine, Base
from routers import session, documents, agents, loan, auth
import traceback
import logging
logging.basicConfig(level=logging.DEBUG)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Poonawalla Fincorp — Agentic Loan Onboarding",
    description="Multi-agent AI pipeline for video-call-based loan origination",
    version="1.0.0",
    lifespan=lifespan,
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"❌ Validation Error: {exc.errors()}", flush=True)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

# Add logging middleware for visibility
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"📥 {request.method} {request.url.path}", flush=True)
    response = await call_next(request)
    print(f"📤 Status: {response.status_code}", flush=True)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session.router,   prefix="/session",   tags=["Session"])
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(agents.router,    prefix="/agents",    tags=["Agents"])
app.include_router(loan.router,      prefix="/loan",      tags=["Loan"])
app.include_router(auth.router,      prefix="/auth",      tags=["Authentication"])

# Print all registered routes for debugging
@app.on_event("startup")
async def print_routes():
    print("🛣️  Registered Routes:", flush=True)
    for route in app.routes:
        if hasattr(route, "path"):
            print(f"  {route.path}", flush=True)

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "poonawalla-onboarding-api"}


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "Poonawalla Fincorp Loan Onboarding API",
        "docs":    "/docs",
        "health":  "/health",
    }

if __name__ == "__main__":
    import uvicorn
    # Use the filename without .py for uvicorn
    script_name = os.path.splitext(os.path.basename(__file__))[0]
    print(f"🚀 Initializing Unified API...")
    uvicorn.run(
        f"{script_name}:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )
