import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi.testclient import TestClient
import jwt
from datetime import datetime, timedelta

from src.main import app
from src.auth import SECRET_KEY, ALGORITHM

client = TestClient(app)

def create_test_token(user_id: str = "test_user", email: str = "test@example.com"):
    """Create a valid test JWT token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(days=1),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def test_health_endpoint():
    """Test health endpoint doesn't require auth"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "api-gateway"

def test_root_endpoint():
    """Test root endpoint doesn't require auth"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Dxsh API Gateway"
    assert data["version"] == "1.0.0"

def test_workflows_endpoint_no_auth():
    """Test workflows endpoint requires authentication"""
    response = client.get("/v1/workflows/")
    # FastAPI returns 403 when no Authorization header is provided
    assert response.status_code == 403

def test_workflows_endpoint_invalid_token():
    """Test workflows endpoint with invalid token"""
    response = client.get(
        "/v1/workflows/", 
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == 401

def test_workflows_endpoint_expired_token():
    """Test workflows endpoint with expired token"""
    # Create expired token
    payload = {
        'user_id': 'test_user',
        'email': 'test@example.com',
        'exp': datetime.utcnow() - timedelta(days=1),  # Expired
        'iat': datetime.utcnow()
    }
    expired_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    response = client.get(
        "/v1/workflows/", 
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401

def test_auth_token_validation():
    """Test that valid tokens are accepted"""
    token = create_test_token()
    
    # This should return 502 (service unavailable) since workflow-engine isn't running
    # but it proves auth is working
    response = client.get(
        "/v1/workflows/", 
        headers={"Authorization": f"Bearer {token}"}
    )
    # Should not be 401 (auth error) but 502 (service error)
    assert response.status_code != 401