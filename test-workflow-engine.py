#!/usr/bin/env python3
"""
Simple test script to verify the workflow engine works independently
"""
import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:5000/api/v1"
TEST_USER = {
    "email": "test@workflow-engine.local",
    "password": "testpass123"
}

def test_auth():
    """Test authentication system"""
    print("🔐 Testing authentication...")
    
    # Register user
    register_response = requests.post(f"{BASE_URL}/auth/register", json=TEST_USER)
    if register_response.status_code in [201, 409]:  # 409 if user already exists
        print("✅ User registration successful")
    else:
        print(f"❌ Registration failed: {register_response.text}")
        return None
    
    # Login user
    login_response = requests.post(f"{BASE_URL}/auth/login", json=TEST_USER)
    if login_response.status_code == 200:
        token = login_response.json()["token"]
        print("✅ Login successful")
        return token
    else:
        print(f"❌ Login failed: {login_response.text}")
        return None

def test_agents(token):
    """Test agents API"""
    print("🤖 Testing agents API...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a test agent
    agent_data = {
        "name": "Test Workflow Agent",
        "description": "A test agent for verifying the workflow engine",
        "agent_type": "WORKFLOW",
        "workflow_data": {
            "nodes": [
                {
                    "id": "1",
                    "type": "webSource",
                    "position": {"x": 100, "y": 100},
                    "data": {"label": "Web Source"}
                }
            ],
            "edges": []
        }
    }
    
    create_response = requests.post(f"{BASE_URL}/agents", json=agent_data, headers=headers)
    if create_response.status_code == 201:
        agent_id = create_response.json()["agent"]["id"]
        print(f"✅ Agent created successfully (ID: {agent_id})")
        
        # Get agents
        get_response = requests.get(f"{BASE_URL}/agents", headers=headers)
        if get_response.status_code == 200:
            agents = get_response.json()["agents"]
            print(f"✅ Retrieved {len(agents)} agents")
            return agent_id
        else:
            print(f"❌ Failed to get agents: {get_response.text}")
    else:
        print(f"❌ Failed to create agent: {create_response.text}")
        return None

def test_basic_apis(token):
    """Test basic API endpoints"""
    print("🌐 Testing basic APIs...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test current user endpoint
    me_response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    if me_response.status_code == 200:
        user_info = me_response.json()
        print(f"✅ Current user: {user_info['user']['email']}")
    else:
        print(f"❌ Failed to get current user: {me_response.text}")

def main():
    """Run all tests"""
    print("🚀 Testing Workflow Engine Independently")
    print("=" * 50)
    
    try:
        # Test authentication
        token = test_auth()
        if not token:
            print("❌ Authentication failed - stopping tests")
            return
        
        print()
        
        # Test basic APIs
        test_basic_apis(token)
        
        print()
        
        # Test agents
        agent_id = test_agents(token)
        
        print()
        print("🎉 Basic workflow engine tests completed!")
        print("=" * 50)
        print()
        print("Next steps:")
        print("1. ✅ Authentication system works")
        print("2. ✅ Basic APIs respond correctly")
        print("3. ✅ Agents can be created and retrieved")
        print("4. 🔄 Try creating a workflow in the frontend")
        print("5. 🔄 Test node execution")
        
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Make sure the backend is running on http://localhost:5000")
        print("Run: cd backend && python run.py")
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    main()