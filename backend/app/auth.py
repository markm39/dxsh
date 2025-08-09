# backend/app/auth.py
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash

# Simple JWT auth to replace Firebase
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'workflow-engine-dev-secret-change-in-production')

class AuthUser:
    def __init__(self, user_id, email, api_key=None):
        self.user_id = user_id
        self.email = email
        self.api_key = api_key

def generate_token(user_id, email):
    """Generate a JWT token for a user"""
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(days=7),  # Token expires in 7 days
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def verify_token(token):
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return AuthUser(payload['user_id'], payload['email'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def verify_api_key(api_key):
    """Verify an API key (for programmatic access)"""
    # For now, just check against environment variable
    # In production, this would check against a database
    valid_api_keys = os.environ.get('VALID_API_KEYS', '').split(',')
    if api_key in valid_api_keys and api_key:
        return AuthUser('api_user', 'api@workflow-engine.local', api_key)
    return None

def auth_required(f):
    """Decorator to require authentication via JWT token or API key"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for API key first
        api_key = request.headers.get('X-API-Key')
        if api_key:
            user = verify_api_key(api_key)
            if user:
                request.current_user = user
                return f(*args, **kwargs)
        
        # Check for JWT token
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        
        token = auth_header.split(' ')[1]
        user = verify_token(token)
        
        if not user:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        request.current_user = user
        return f(*args, **kwargs)
    
    return decorated_function

def get_current_user():
    """Get the current authenticated user"""
    return getattr(request, 'current_user', None)

def hash_password(password):
    """Hash a password for storage"""
    return generate_password_hash(password)

def check_password_hash_func(hashed_password, password):
    """Check if a password matches its hash"""
    return check_password_hash(hashed_password, password)