# utils/storage.py
import os
import shutil
from pathlib import Path
from uuid import UUID
from fastapi import UploadFile
from db.database import UPLOAD_DIR


def _dir(session_id: UUID, doc_type: str) -> Path:
    p = Path(UPLOAD_DIR) / str(session_id) / doc_type
    p.mkdir(parents=True, exist_ok=True)
    return p


async def save_upload(session_id: UUID, doc_type: str, upload: UploadFile) -> str:
    dest = _dir(session_id, doc_type) / Path(upload.filename).name
    content = await upload.read()
    with open(dest, "wb") as f:
        f.write(content)
    return str(dest)


def delete_session_files(session_id: UUID):
    d = Path(UPLOAD_DIR) / str(session_id)
    if d.exists():
        shutil.rmtree(d)
