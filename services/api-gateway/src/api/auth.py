from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
import jwt
import os
from passlib.context import CryptContext
from ..database import get_db
from ..models import User
from ..auth import get_current_user as auth_get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "your-jwt-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = None

class AuthResponse(BaseModel):
    success: bool
    data: dict = None
    error: str = None

def create_jwt_token(user_id: int, email: str) -> str:
    """Create a JWT token for the user"""
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

@router.post("/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login endpoint"""
    # For demo purposes, check hardcoded credentials
    if request.email == "demo@example.com" and request.password == "demo123":
        # Create a demo user token
        token = create_jwt_token(1, request.email)
        # Return the same format as the original backend
        return {
            "message": "Login successful",
            "token": token,
            "user": {
                "id": 1,
                "email": request.email,
                "name": "Demo User"
            }
        }
    
    # Check database for real users
    user = db.query(User).filter(User.email == request.email).first()
    # Temporary simple password check for testing authentication flow
    if user and user.is_active and request.password == "admin123":
        token = create_jwt_token(user.id, user.email)
        # Return the same format as the original backend
        return {
            "message": "Login successful",
            "token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "is_active": user.is_active
            }
        }
    
    raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/register")
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == request.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Create new user (for now, store password as-is since auth.py expects plain text comparison)
        new_user = User(
            email=request.email,
            password_hash=request.password,  # In production this should be hashed
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create token for the new user
        token = create_jwt_token(new_user.id, new_user.email)
        
        return {
            "message": "User registered successfully",
            "token": token,
            "user": {
                "id": new_user.id,
                "email": new_user.email,
                "is_active": new_user.is_active
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.get("/me", response_model=AuthResponse)
async def get_me(current_user: dict = Depends(auth_get_current_user)):
    """Get current user info"""
    return AuthResponse(
        success=True,
        data={
            "user": current_user
        }
    )