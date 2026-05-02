# utils/audit.py
from datetime import datetime
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from models.db_models import AuditLog


async def audit(
    db:         AsyncSession,
    session_id: UUID,
    agent:      str,
    event:      str,
    detail:     str = "",
    severity:   str = "info",
):
    log = AuditLog(
        session_id=session_id,
        agent=agent,
        event=event,
        detail=detail,
        severity=severity,
        timestamp=datetime.utcnow(),
    )
    db.add(log)
    await db.flush()
