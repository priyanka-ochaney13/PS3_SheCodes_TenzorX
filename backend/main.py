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

import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from db.database import engine, Base
from routers import session, documents, agents, loan
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
