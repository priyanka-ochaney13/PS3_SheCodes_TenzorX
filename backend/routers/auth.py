import os
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, EmailStr
from typing import Optional
try:
    from gotrue.errors import AuthApiError
except ImportError:
    # Fallback if gotrue is not directly installed or structure differs
    try:
        from supabase.lib.auth_errors import AuthApiError
    except ImportError:
        class AuthApiError(Exception):
            pass

from db.database import get_db
from db.supabase_client import get_supabase
from models.db_models import User

router = APIRouter(tags=["auth"])

# ─────────────────────────────────────────────────────────────────
# Request/Response Models
# ─────────────────────────────────────────────────────────────────

class SignUpRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[dict] = None

# ─────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignUpRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user using Supabase Auth"""
    print(f"📝 Signup attempt: {req.email}", flush=True)
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client not initialized"
        )

    try:
        # 1. Sign up with Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {
                "data": {
                    "name": req.name,
                    "phone": req.phone
                }
            }
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Signup failed"
            )

        # 2. Sync with local users table (Soft sync)
        user_data = {
            "id": str(auth_response.user.id),
            "name": req.name,
            "email": str(req.email),
            "phone": req.phone,
            "kyc_status": "pending"
        }

        try:
            # Ensure user_id is a UUID object for SQLAlchemy
            user_id = uuid.UUID(str(auth_response.user.id))
            # 1. Try to find by ID
            result = await db.execute(select(User).where(User.id == user_id))
            local_user = result.scalars().first()

            # 2. If not found by ID, check if email exists (legacy or out-of-sync user)
            if not local_user:
                result_email = await db.execute(select(User).where(User.email == req.email))
                local_user = result_email.scalars().first()
                
                if local_user:
                    # Update existing user's ID to match Supabase (our source of truth)
                    print(f"🔄 Syncing existing user {req.email} to new Supabase ID")
                    local_user.id = user_id
                else:
                    # Truly new user
                    local_user = User(
                        id=user_id,
                        name=req.name,
                        email=req.email,
                        phone=req.phone,
                        kyc_status="pending"
                    )
                    db.add(local_user)
            
            local_user.last_login = datetime.utcnow()
            await db.commit()
            await db.refresh(local_user)
            
            user_data["id"] = str(local_user.id)
        except Exception as db_err:
            print(f"⚠️ Database sync failed (skipping): {db_err}")

        return {
            "success": True,
            "message": "Verification email sent. Please check your inbox.",
            "token": auth_response.session.access_token if auth_response.session else None,
            "user": user_data
        }

    except AuthApiError as e:
        print(f"Signup Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Signup unexpected error: {e}")
        # If it's a validation error from Supabase (like invalid email format), return 400 instead of 500
        if "validate email" in str(e).lower() or "invalid format" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid email format: {str(e)}"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during signup"
        )

@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user using Supabase Auth"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client not initialized"
        )

    try:
        # 1. Login with Supabase
        auth_response = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password
        })

        if not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # 2. Get user details from local DB (Soft sync)
        user_data = {
            "id": str(auth_response.user.id),
            "name": auth_response.user.user_metadata.get("name", "User"),
            "email": str(req.email),
            "phone": auth_response.user.user_metadata.get("phone", ""),
            "kyc_status": "unknown"
        }

        try:
            # Ensure user_id is a UUID object for SQLAlchemy
            user_id = uuid.UUID(str(auth_response.user.id))
            # 1. Try to find by ID
            result = await db.execute(select(User).where(User.id == user_id))
            local_user = result.scalars().first()

            # 2. If not found by ID, check if email exists
            if not local_user:
                result_email = await db.execute(select(User).where(User.email == req.email))
                local_user = result_email.scalars().first()
                
                if local_user:
                    print(f"🔄 Syncing existing user {req.email} to new Supabase ID")
                    local_user.id = user_id
                else:
                    local_user = User(
                        id=user_id,
                        name=auth_response.user.user_metadata.get("name", "Unknown"),
                        email=req.email,
                        phone=auth_response.user.user_metadata.get("phone", ""),
                        kyc_status="pending"
                    )
                    db.add(local_user)
            
            local_user.last_login = datetime.utcnow()
            await db.commit()
            
            user_data = {
                "id": str(local_user.id),
                "name": local_user.name,
                "email": local_user.email,
                "phone": local_user.phone,
                "kyc_status": local_user.kyc_status
            }
        except Exception as db_err:
            print(f"⚠️ Database sync failed (skipping): {db_err}")

        return {
            "success": True,
            "message": "Login successful",
            "token": auth_response.session.access_token,
            "user": user_data
        }

    except AuthApiError as e:
        print(f"Login Auth error: {e}")
        # Handle specific "Email not confirmed" error
        if "Email not confirmed" in str(e):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Please verify your email address before logging in."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    except Exception as e:
        print(f"Login unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during login"
        )

@router.post("/verify-token")
async def verify_token(token: str):
    """Verify JWT token using Supabase"""
    supabase = get_supabase()
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {
            "success": True,
            "user": user_response.user
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
