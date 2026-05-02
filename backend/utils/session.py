# utils/session.py
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.db_models import LoanSession


async def get_session_or_404(session_id: UUID, db: AsyncSession) -> LoanSession:
    result  = await db.execute(select(LoanSession).where(LoanSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, f"Session {session_id} not found")
    return session
