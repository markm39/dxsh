#!/usr/bin/env python3
"""Test script to debug authentication issue"""

import jwt
import requests
from datetime import datetime, timedelta

SECRET_KEY = 'workflow-engine-dev-secret-change-in-production'
ALGORITHM = 'HS256'
BASE_URL = 'http://localhost:8000'

def create_token():
    """Create a test JWT token"""
    payload = {
        'user_id': 1,
        'email': 'test@dxsh.local',
        'exp': datetime.now() + timedelta(days=7)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def test_health():
    """Test health endpoint (no auth required)"""
    response = requests.get(f"{BASE_URL}/health")
    print(f"Health check: {response.status_code}")
    print(f"Response: {response.json()}\n")
    return response.status_code == 200

def test_schedules_list(token):
    """Test schedules list endpoint (requires auth)"""
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f"{BASE_URL}/api/v1/schedules/", headers=headers)
    print(f"Schedules list: {response.status_code}")
    print(f"Response: {response.json()}\n")
    return response.status_code == 200

def main():
    print("=== Testing Workflow Engine Authentication ===\n")

    # Test health endpoint
    print("1. Testing health endpoint...")
    if not test_health():
        print("ERROR: Health endpoint failed. Server may not be running.")
        return

    # Create token
    print("2. Creating JWT token...")
    token = create_token()
    print(f"Token: {token[:50]}...\n")

    # Verify token locally
    print("3. Verifying token locally...")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"Token verified: {payload}\n")
    except Exception as e:
        print(f"ERROR: Token verification failed: {e}\n")
        return

    # Test schedules endpoint
    print("4. Testing schedules endpoint with token...")
    if test_schedules_list(token):
        print("SUCCESS: Authentication working!")
    else:
        print("ERROR: Authentication failed on API endpoint")

if __name__ == "__main__":
    main()
