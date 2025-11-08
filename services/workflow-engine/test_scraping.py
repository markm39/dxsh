#!/usr/bin/env python3
"""Comprehensive test suite for Web Scraping & Proxy APIs"""

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

def print_test_header(test_name):
    """Print formatted test header"""
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def test_proxy_endpoint():
    """Test basic CORS proxy endpoint"""
    print_test_header("Basic Proxy Endpoint")

    token = create_token()
    headers = {'Authorization': f'Bearer {token}'}

    # Test with a safe URL
    test_url = "https://example.com"
    response = requests.get(
        f"{BASE_URL}/api/v1/proxy",
        headers=headers,
        params={"url": test_url}
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("SUCCESS: Proxy endpoint responding")
        return True
    elif response.status_code == 403:
        print("EXPECTED: Bot protection detected (normal for some sites)")
        return True
    else:
        print(f"Response: {response.text[:200]}")
        return False

def test_cors_proxy_request():
    """Test CORS proxy request endpoint"""
    print_test_header("CORS Proxy Request API")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    # Test GET request through proxy
    proxy_request = {
        "url": "https://api.github.com/zen",
        "method": "GET"
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/proxy/request",
        headers=headers,
        json=proxy_request
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        print(f"Proxied URL: {result.get('url')}")
        print(f"Method: {result.get('method')}")
        print(f"Response Time: {result.get('elapsed_ms')}ms")
        return True
    else:
        print(f"Error: {response.json()}")
        return False

def test_allowed_domains():
    """Test getting allowed domains"""
    print_test_header("Get Allowed Domains")

    token = create_token()
    headers = {'Authorization': f'Bearer {token}'}

    response = requests.get(
        f"{BASE_URL}/api/v1/proxy/allowed-domains",
        headers=headers
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Allow all HTTPS: {result.get('allow_all_https')}")
        print(f"Security Note: {result.get('security_note')}")
        return True
    else:
        print(f"Error: {response.json()}")
        return False

def test_url_validation():
    """Test URL validation for proxy"""
    print_test_header("URL Validation Test")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    # Test valid URL
    test_cases = [
        {"url": "https://example.com", "should_allow": True},
        {"url": "http://localhost:3000", "should_allow": False},
        {"url": "https://192.168.1.1", "should_allow": False},
        {"url": "https://api.github.com", "should_allow": True}
    ]

    all_passed = True
    for test_case in test_cases:
        response = requests.post(
            f"{BASE_URL}/api/v1/proxy/test-url",
            headers=headers,
            json={"url": test_case["url"]}
        )

        if response.status_code == 200:
            result = response.json()
            is_allowed = result.get('allowed')
            expected = test_case["should_allow"]

            if is_allowed == expected:
                print(f"  PASS: {test_case['url']} - {result.get('reason')}")
            else:
                print(f"  FAIL: {test_case['url']} - Expected {expected}, got {is_allowed}")
                all_passed = False
        else:
            print(f"  ERROR: {test_case['url']} - {response.text}")
            all_passed = False

    return all_passed

def test_monitoring_job_creation():
    """Test creating a monitoring job"""
    print_test_header("Monitoring Job Creation")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    job_data = {
        "agent_id": "test-agent-123",
        "name": "Test Monitoring Job",
        "url": "https://example.com",
        "selectors": [
            {
                "selector": "h1",
                "label": "title",
                "attribute": "textContent"
            }
        ],
        "data_type": "raw"
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/monitoring-jobs",
        headers=headers,
        json=job_data
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        job = result.get('job', {})
        print(f"Job ID: {job.get('id')}")
        print(f"Job Name: {job.get('name')}")
        print(f"Job Status: {job.get('status')}")
        return True
    else:
        print(f"Error: {response.json()}")
        return False

def test_security_features():
    """Test security features of proxy"""
    print_test_header("Security Features Test")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    # Test blocked URLs
    blocked_urls = [
        "http://localhost:8000/health",
        "http://127.0.0.1:8000",
        "http://192.168.1.1",
        "http://10.0.0.1"
    ]

    all_blocked = True
    for url in blocked_urls:
        response = requests.post(
            f"{BASE_URL}/api/v1/proxy/request",
            headers=headers,
            json={"url": url, "method": "GET"}
        )

        if response.status_code == 403:
            print(f"  PASS: Blocked {url}")
        else:
            print(f"  FAIL: Should have blocked {url}")
            all_blocked = False

    return all_blocked

def test_proxy_methods():
    """Test different HTTP methods through proxy"""
    print_test_header("HTTP Methods Test")

    token = create_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    # Test GET method (should work with public API)
    methods = ['GET', 'HEAD', 'OPTIONS']

    passed = 0
    for method in methods:
        response = requests.post(
            f"{BASE_URL}/api/v1/proxy/request",
            headers=headers,
            json={
                "url": "https://api.github.com",
                "method": method
            }
        )

        if response.status_code in [200, 405]:  # 405 = method not allowed by target
            print(f"  {method}: {response.status_code} (endpoint functional)")
            passed += 1
        else:
            print(f"  {method}: {response.status_code} (may need different test URL)")

    return passed > 0

def main():
    """Run all scraping and proxy tests"""
    print("\n" + "="*60)
    print("COMPREHENSIVE SCRAPING & PROXY API TESTS")
    print("="*60)

    results = {}

    # Run all tests
    print("\n" + "="*60)
    print("BASIC PROXY TESTS")
    print("="*60)
    results['proxy_endpoint'] = test_proxy_endpoint()
    results['cors_proxy'] = test_cors_proxy_request()
    results['allowed_domains'] = test_allowed_domains()

    print("\n" + "="*60)
    print("SECURITY & VALIDATION TESTS")
    print("="*60)
    results['url_validation'] = test_url_validation()
    results['security_features'] = test_security_features()

    print("\n" + "="*60)
    print("ADVANCED FEATURES")
    print("="*60)
    results['monitoring_jobs'] = test_monitoring_job_creation()
    results['http_methods'] = test_proxy_methods()

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

    # Note about features requiring external services
    print("\n" + "="*60)
    print("FEATURES REQUIRING EXTERNAL SERVICES (NOT TESTED)")
    print("="*60)
    print("  - AI Selector Generation (requires OpenAI API key)")
    print("  - Playwright Scraping (requires Playwright installation)")
    print("  - Visual Element Selection (requires browser)")
    print("  - Web Source Extraction (requires Playwright service)")
    print("="*60)

    if passed == total:
        print("\nSUCCESS: All testable scraping features are working!")
        return 0
    else:
        print(f"\nWARNING: {total - passed} test(s) need attention")
        return 1

if __name__ == "__main__":
    exit(main())
