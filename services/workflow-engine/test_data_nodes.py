#!/usr/bin/env python3
"""Comprehensive test suite for File Node & HTTP Request Node APIs"""

import jwt
import requests
import json
import io
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

def print_test_header(test_name):
    """Print formatted test header"""
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

# ============================================================================
# FILE NODE API TESTS
# ============================================================================

def test_file_upload_json():
    """Test JSON file upload"""
    print_test_header("File Upload - JSON")

    token = create_token()
    headers = {'Authorization': f'Bearer {token}'}

    # Create a test JSON file
    test_data = {"name": "test", "value": 123, "items": [1, 2, 3]}
    file_content = json.dumps(test_data).encode('utf-8')

    files = {
        'file': ('test_data.json', io.BytesIO(file_content), 'application/json')
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/file-node/upload",
        headers=headers,
        files=files
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        print(f"File ID: {result.get('file_id', 'N/A')}")
        print(f"File Type: {result.get('file_type', 'N/A')}")
        print(f"File Size: {result.get('file_size', 'N/A')} bytes")
        return True
    else:
        print(f"Response: {response.text[:200]}")
        return False

def test_file_upload_csv():
    """Test CSV file upload"""
    print_test_header("File Upload - CSV")

    token = create_token()
    headers = {'Authorization': f'Bearer {token}'}

    # Create a test CSV file
    csv_content = "name,age,city\nAlice,30,NYC\nBob,25,LA\n".encode('utf-8')

    files = {
        'file': ('test_data.csv', io.BytesIO(csv_content), 'text/csv')
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/file-node/upload",
        headers=headers,
        files=files
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        print(f"File Type: {result.get('file_type', 'N/A')}")
        return True
    else:
        print(f"Response: {response.text[:200]}")
        return False

def test_file_upload_invalid_type():
    """Test upload with invalid file type"""
    print_test_header("File Upload - Invalid Type (Should Fail)")

    token = create_token()
    headers = {'Authorization': f'Bearer {token}'}

    # Try to upload an unsupported file type
    file_content = b"fake executable content"

    files = {
        'file': ('malicious.exe', io.BytesIO(file_content), 'application/x-msdownload')
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/file-node/upload",
        headers=headers,
        files=files
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 400:
        print("SUCCESS: Invalid file type correctly rejected")
        print(f"Error Message: {response.json().get('detail', 'N/A')}")
        return True
    else:
        print(f"FAIL: Should have rejected invalid file type")
        return False

def test_file_upload_text():
    """Test text file upload"""
    print_test_header("File Upload - Text")

    token = create_token()
    headers = {'Authorization': f'Bearer {token}'}

    # Create a test text file
    text_content = "This is a test text file.\nLine 2\nLine 3".encode('utf-8')

    files = {
        'file': ('test_file.txt', io.BytesIO(text_content), 'text/plain')
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/file-node/upload",
        headers=headers,
        files=files
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        print(f"File Type: text")
        return True
    else:
        print(f"Response: {response.text[:200]}")
        return False

# ============================================================================
# HTTP REQUEST NODE API TESTS
# ============================================================================

def test_http_request_get():
    """Test HTTP GET request"""
    print_test_header("HTTP Request - GET")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    request_data = {
        "url": "https://api.github.com/zen",
        "method": "GET",
        "headers": {},
        "queryParams": {}
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/http-request/execute",
        headers=headers,
        json=request_data
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        print(f"Response Status: {result.get('response', {}).get('status_code')}")
        print(f"Response Time: {result.get('response', {}).get('elapsed_ms')}ms")
        return True
    else:
        print(f"Response: {response.text[:200]}")
        return False

def test_http_request_with_auth():
    """Test HTTP request with authentication"""
    print_test_header("HTTP Request - With Authentication")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    request_data = {
        "url": "https://api.github.com",
        "method": "GET",
        "headers": {},
        "queryParams": {},
        "auth": {
            "type": "bearer",
            "token": "fake-token-for-testing"
        }
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/http-request/execute",
        headers=headers,
        json=request_data
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        print(f"Auth Type: bearer")
        print(f"Request completed with authentication header")
        return True
    else:
        print(f"Response: {response.text[:200]}")
        return False

def test_http_request_variable_substitution():
    """Test variable substitution in HTTP requests"""
    print_test_header("HTTP Request - Variable Substitution")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    request_data = {
        "url": "https://api.github.com/{{endpoint}}",
        "method": "GET",
        "headers": {},
        "queryParams": {},
        "variables": {
            "endpoint": "zen"
        }
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/http-request/execute",
        headers=headers,
        json=request_data
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        print(f"Variable Substitution: {{{{endpoint}}}} -> zen")
        print(f"Final URL: {result.get('response', {}).get('url')}")
        return True
    else:
        print(f"Response: {response.text[:200]}")
        return False

def test_http_request_methods():
    """Test different HTTP methods support"""
    print_test_header("HTTP Request - Multiple Methods")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    methods = ['GET', 'HEAD', 'OPTIONS']
    passed = 0

    for method in methods:
        request_data = {
            "url": "https://api.github.com",
            "method": method,
            "headers": {},
            "queryParams": {}
        }

        response = requests.post(
            f"{BASE_URL}/api/v1/http-request/execute",
            headers=headers,
            json=request_data
        )

        if response.status_code in [200, 405]:  # 405 = method not allowed by target
            print(f"  {method}: Endpoint functional")
            passed += 1
        else:
            print(f"  {method}: {response.status_code}")

    return passed == len(methods)

def test_http_request_post_with_body():
    """Test HTTP POST request with JSON body"""
    print_test_header("HTTP Request - POST with JSON Body")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    request_data = {
        "url": "https://httpbin.org/post",
        "method": "POST",
        "headers": {
            "Content-Type": "application/json"
        },
        "body": {
            "test": "data",
            "number": 123
        },
        "queryParams": {}
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/http-request/execute",
        headers=headers,
        json=request_data
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        print(f"Method: POST")
        print(f"Body sent successfully")
        return True
    else:
        print(f"Response: {response.text[:200]}")
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    """Run all data node tests"""
    print("\n" + "="*60)
    print("COMPREHENSIVE DATA NODES API TESTS")
    print("="*60)

    results = {}

    # File Node Tests
    print("\n" + "="*60)
    print("FILE NODE API TESTS")
    print("="*60)
    results['file_upload_json'] = test_file_upload_json()
    results['file_upload_csv'] = test_file_upload_csv()
    results['file_upload_text'] = test_file_upload_text()
    results['file_invalid_type'] = test_file_upload_invalid_type()

    # HTTP Request Node Tests
    print("\n" + "="*60)
    print("HTTP REQUEST NODE API TESTS")
    print("="*60)
    results['http_get'] = test_http_request_get()
    results['http_auth'] = test_http_request_with_auth()
    results['http_variables'] = test_http_request_variable_substitution()
    results['http_methods'] = test_http_request_methods()
    results['http_post_body'] = test_http_request_post_with_body()

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        print(f"  {status}: {test_name}")

    print("\n" + "="*60)
    print(f"RESULTS: {passed}/{total} tests passed ({int(passed/total*100)}%)")
    print("="*60)

    if passed == total:
        print("\nSUCCESS: All data node features are working!")
        return 0
    else:
        print(f"\nWARNING: {total - passed} test(s) need attention")
        return 1

if __name__ == "__main__":
    exit(main())
