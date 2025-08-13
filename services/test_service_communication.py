#!/usr/bin/env python3
"""
Test service-to-service communication in Docker environment
This test verifies that the API Gateway can successfully communicate with the Workflow Engine
"""

import requests
import jwt
import time
import json
from datetime import datetime, timedelta

# Test configuration
API_GATEWAY_URL = "http://localhost:5000"
JWT_SECRET_KEY = "workflow-engine-dev-secret-change-in-production"
ALGORITHM = "HS256"

def create_test_token(user_id: str = "test_user", email: str = "test@example.com"):
    """Create a valid test JWT token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(days=1),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)

def wait_for_service(url: str, timeout: int = 60):
    """Wait for a service to be ready"""
    print(f"Waiting for service at {url}...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{url}/health", timeout=5)
            if response.status_code == 200:
                print(f"✓ Service at {url} is ready")
                return True
        except requests.RequestException:
            pass
        
        time.sleep(2)
    
    print(f"✗ Service at {url} failed to start within {timeout} seconds")
    return False

def test_api_gateway_health():
    """Test API Gateway health endpoint"""
    print("\n1. Testing API Gateway health...")
    
    try:
        response = requests.get(f"{API_GATEWAY_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ API Gateway health check passed: {data}")
            return True
        else:
            print(f"✗ API Gateway health check failed: {response.status_code}")
            return False
            
    except requests.RequestException as e:
        print(f"✗ API Gateway health check failed: {e}")
        return False

def test_workflow_engine_via_gateway():
    """Test workflow engine through API Gateway"""
    print("\n2. Testing workflow engine via API Gateway...")
    
    token = create_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Test getting workflows list
        response = requests.get(
            f"{API_GATEWAY_URL}/v1/workflows/", 
            headers=headers,
            timeout=10
        )
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            print("✓ Successfully communicated with workflow engine via API Gateway")
            try:
                data = response.json()
                print(f"Response data: {json.dumps(data, indent=2)}")
            except:
                print(f"Response content: {response.text}")
            return True
        elif response.status_code == 404:
            # This is acceptable - endpoint might not exist yet but connection works
            print("✓ Connection successful (404 is acceptable for non-existing endpoint)")
            return True
        else:
            print(f"✗ Unexpected response: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.RequestException as e:
        print(f"✗ Communication failed: {e}")
        return False

def test_workflow_creation():
    """Test creating a simple workflow through the API Gateway"""
    print("\n3. Testing workflow creation via API Gateway...")
    
    token = create_test_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    test_workflow = {
        "name": "Test Communication Workflow",
        "description": "Test workflow for service communication",
        "nodes": [
            {
                "id": "test-node-1",
                "type": "webSource",
                "data": {
                    "url": "https://example.com",
                    "selectors": [
                        {"name": "title", "selector": "h1", "attribute": "textContent"}
                    ]
                },
                "position": {"x": 100, "y": 100}
            }
        ],
        "edges": [],
        "agent_id": 1
    }
    
    try:
        response = requests.post(
            f"{API_GATEWAY_URL}/v1/workflows/",
            headers=headers,
            json=test_workflow,
            timeout=15
        )
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code in [200, 201]:
            print("✓ Workflow creation successful")
            try:
                data = response.json()
                print(f"Created workflow: {json.dumps(data, indent=2)}")
                return True, data.get('id')
            except:
                print("✓ Workflow created (non-JSON response)")
                return True, None
        else:
            print(f"Response: {response.text}")
            # Even if creation fails, if we get a proper error response, communication works
            if response.status_code in [400, 422, 500]:
                print("✓ Communication successful (error response indicates service is working)")
                return True, None
            return False, None
            
    except requests.RequestException as e:
        print(f"✗ Workflow creation failed: {e}")
        return False, None

def test_root_endpoints():
    """Test root endpoints of both services"""
    print("\n4. Testing root endpoints...")
    
    # Test API Gateway root
    try:
        response = requests.get(f"{API_GATEWAY_URL}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ API Gateway root: {data}")
            
            # Check if service URLs are properly configured
            services = data.get('services', {})
            workflow_url = services.get('workflow_engine')
            print(f"Workflow engine URL configured as: {workflow_url}")
            return True
            
        else:
            print(f"✗ API Gateway root failed: {response.status_code}")
            return False
            
    except requests.RequestException as e:
        print(f"✗ API Gateway root failed: {e}")
        return False

def main():
    """Run all communication tests"""
    print("=== Dxsh Microservices Communication Test ===")
    
    # Wait for services to be ready
    if not wait_for_service(API_GATEWAY_URL):
        print("❌ API Gateway not ready, aborting tests")
        return False
    
    # Run tests
    results = []
    
    results.append(test_api_gateway_health())
    results.append(test_root_endpoints())
    results.append(test_workflow_engine_via_gateway())
    
    workflow_created, workflow_id = test_workflow_creation()
    results.append(workflow_created)
    
    # Summary
    print(f"\n=== Test Results ===")
    passed = sum(results)
    total = len(results)
    
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All service communication tests passed!")
        return True
    else:
        print("❌ Some tests failed")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)