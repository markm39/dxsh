#!/usr/bin/env python3
"""Comprehensive test script for Schedules API"""

import jwt
import requests
import json
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
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def test_create_workflow():
    """Create a test workflow first"""
    token = create_token()
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

    workflow_data = {
        "name": "Test Workflow",
        "nodes": [],
        "edges": []
    }

    response = requests.post(f"{BASE_URL}/v1/workflows/", headers=headers, json=workflow_data)
    print(f"Create Workflow: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        workflow_id = result.get('agent', {}).get('id')
        print(f"Created workflow ID: {workflow_id}")
        return workflow_id
    else:
        print(f"Error: {response.json()}")
        return None

def test_create_schedule(workflow_id):
    """Test creating a schedule"""
    token = create_token()
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

    schedule_data = {
        "workflow_id": workflow_id,
        "name": "Daily Test Schedule",
        "description": "Test schedule running daily at 9 AM",
        "cron_expression": "0 9 * * *",
        "timezone": "UTC",
        "is_active": True,
        "max_retries": 3,
        "retry_delay_seconds": 60,
        "input_params": {"test": "data"}
    }

    response = requests.post(f"{BASE_URL}/api/v1/schedules/", headers=headers, json=schedule_data)
    print(f"\nCreate Schedule: {response.status_code}")
    if response.status_code == 200:
        schedule = response.json()
        print(f"Created schedule ID: {schedule.get('id')}")
        print(f"Next run at: {schedule.get('next_run_at')}")
        return schedule.get('id')
    else:
        print(f"Error: {response.json()}")
        return None

def test_list_schedules():
    """Test listing schedules"""
    token = create_token()
    headers = {'Authorization': f'Bearer {token}'}

    response = requests.get(f"{BASE_URL}/api/v1/schedules/", headers=headers)
    print(f"\nList Schedules: {response.status_code}")
    if response.status_code == 200:
        schedules = response.json()
        print(f"Found {len(schedules)} schedule(s)")
        for schedule in schedules:
            print(f"  - {schedule.get('name')} (ID: {schedule.get('id')})")
        return schedules
    else:
        print(f"Error: {response.json()}")
        return []

def test_get_schedule(schedule_id):
    """Test getting a specific schedule"""
    token = create_token()
    headers = {'Authorization': f'Bearer {token}'}

    response = requests.get(f"{BASE_URL}/api/v1/schedules/{schedule_id}", headers=headers)
    print(f"\nGet Schedule {schedule_id}: {response.status_code}")
    if response.status_code == 200:
        schedule = response.json()
        print(f"Schedule: {schedule.get('name')}")
        print(f"Status: {'Active' if schedule.get('is_active') else 'Inactive'}")
        print(f"Cron: {schedule.get('cron_expression')}")
        return schedule
    else:
        print(f"Error: {response.json()}")
        return None

def test_update_schedule(schedule_id):
    """Test updating a schedule"""
    token = create_token()
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

    update_data = {
        "name": "Updated Test Schedule",
        "is_active": False
    }

    response = requests.put(f"{BASE_URL}/api/v1/schedules/{schedule_id}", headers=headers, json=update_data)
    print(f"\nUpdate Schedule {schedule_id}: {response.status_code}")
    if response.status_code == 200:
        schedule = response.json()
        print(f"Updated name: {schedule.get('name')}")
        print(f"Updated status: {'Active' if schedule.get('is_active') else 'Inactive'}")
        return schedule
    else:
        print(f"Error: {response.json()}")
        return None

def test_delete_schedule(schedule_id):
    """Test deleting a schedule"""
    token = create_token()
    headers = {'Authorization': f'Bearer {token}'}

    response = requests.delete(f"{BASE_URL}/api/v1/schedules/{schedule_id}", headers=headers)
    print(f"\nDelete Schedule {schedule_id}: {response.status_code}")
    if response.status_code == 200:
        print("Schedule deleted successfully")
        return True
    else:
        print(f"Error: {response.json()}")
        return False

def main():
    print("=== Testing Schedules API ===\n")

    # Test 1: Create a workflow
    print("Test 1: Creating test workflow...")
    workflow_id = test_create_workflow()
    if not workflow_id:
        print("ERROR: Failed to create workflow. Cannot proceed.")
        return

    # Test 2: Create a schedule
    print("\nTest 2: Creating schedule...")
    schedule_id = test_create_schedule(workflow_id)
    if not schedule_id:
        print("ERROR: Failed to create schedule")
        return

    # Test 3: List schedules
    print("\nTest 3: Listing all schedules...")
    test_list_schedules()

    # Test 4: Get specific schedule
    print("\nTest 4: Getting schedule details...")
    test_get_schedule(schedule_id)

    # Test 5: Update schedule
    print("\nTest 5: Updating schedule...")
    test_update_schedule(schedule_id)

    # Test 6: Verify update
    print("\nTest 6: Verifying update...")
    test_get_schedule(schedule_id)

    # Test 7: Delete schedule
    print("\nTest 7: Deleting schedule...")
    test_delete_schedule(schedule_id)

    # Test 8: Verify deletion
    print("\nTest 8: Verifying deletion...")
    schedules = test_list_schedules()

    print("\n" + "="*50)
    if len(schedules) == 0:
        print("SUCCESS: All schedule CRUD operations working!")
    else:
        print(f"WARNING: Expected 0 schedules, found {len(schedules)}")

if __name__ == "__main__":
    main()
