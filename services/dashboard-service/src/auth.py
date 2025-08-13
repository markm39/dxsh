"""
Authentication for Dashboard Service

Simplified authentication that works with API Gateway
The API Gateway handles JWT validation and passes user_id in headers
"""

from fastapi import HTTPException, status, Header
from typing import Optional
import logging

logger = logging.getLogger(__name__)


async def get_current_user_id(x_user_id: Optional[str] = Header(None)) -> int:
    """
    Get current user ID from API Gateway headers
    
    The API Gateway validates JWT tokens and passes the user ID in the X-User-ID header
    """
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required - missing user ID header"
        )
    
    try:
        return int(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format"
        )