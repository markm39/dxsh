"""
Authentication for Dashboard Service

Uses JWT authentication matching the workflow engine
"""

import jwt
import os
from datetime import datetime, timedelta
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# JWT configuration - should match workflow engine and API Gateway
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'workflow-engine-dev-secret-change-in-production')
ALGORITHM = "HS256"

security = HTTPBearer()

class AuthUser(BaseModel):
    user_id: str
    email: str
    api_key: Optional[str] = None

def verify_token(token: str) -> Optional[AuthUser]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return AuthUser(user_id=str(payload['user_id']), email=payload['email'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> AuthUser:
    """Get the current authenticated user from JWT token"""
    token = credentials.credentials
    user = verify_token(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user

async def get_current_user_id(
    user: AuthUser = Depends(get_current_user)
) -> int:
    """Get current user ID from authenticated user"""
    return int(user.user_id)