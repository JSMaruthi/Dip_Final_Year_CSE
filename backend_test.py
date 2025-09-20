#!/usr/bin/env python3
"""
E-Waste Management System Backend API Tests
Tests all authentication, CRUD operations, role-based access control, and transaction logging
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001/api"
HEADERS = {"Content-Type": "application/json"}

# Default test accounts
DEFAULT_ACCOUNTS = {
    "admin": {"mobile": "9999999999", "password": "admin123"},
    "collector": {"mobile": "8888888888", "password": "collector123"},
    "user": {"mobile": "7777777777", "password": "user123"}
}

# Test data storage
test_tokens = {}
test_request_id = None
test_results = []

def log_test(test_name, status, details=""):
    """Log test results"""
    result = {
        "test": test_name,
        "status": status,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"{status_symbol} {test_name}: {details}")

def make_request(method, endpoint, data=None, headers=None, token=None):
    """Make HTTP request with proper error handling"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    
    if headers:
        request_headers.update(headers)
    
    if token:
        request_headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=request_headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, headers=request_headers, timeout=10)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=request_headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def test_root_endpoint():
    """Test root endpoint"""
    # Test the root endpoint without /api prefix
    url = "http://localhost:8001/"
    try:
        response = requests.get(url, timeout=10)
        if response and response.status_code == 200:
            data = response.json()
            if "message" in data:
                log_test("Root Endpoint", "PASS", f"Response: {data['message']}")
                return True
    except Exception as e:
        log_test("Root Endpoint", "FAIL", f"Exception: {e}")
        return False
    log_test("Root Endpoint", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    return False

def test_authentication():
    """Test all authentication endpoints"""
    print("\n=== TESTING AUTHENTICATION ===")
    
    # Test regular login for all default accounts
    for role, credentials in DEFAULT_ACCOUNTS.items():
        response = make_request("POST", "/login", credentials)
        if response and response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                test_tokens[role] = data["token"]
                user_role = data["user"]["role"]
                log_test(f"{role.title()} Login", "PASS", f"Role: {user_role}, Token received")
            else:
                log_test(f"{role.title()} Login", "FAIL", "Missing token or user in response")
        else:
            log_test(f"{role.title()} Login", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test admin-specific login endpoint
    admin_creds = DEFAULT_ACCOUNTS["admin"]
    response = make_request("POST", "/admin/login", admin_creds)
    if response and response.status_code == 200:
        data = response.json()
        if "token" in data and data["user"]["role"] == "admin":
            log_test("Admin-Specific Login", "PASS", "Admin login endpoint working")
        else:
            log_test("Admin-Specific Login", "FAIL", "Invalid admin login response")
    else:
        log_test("Admin-Specific Login", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test invalid login
    response = make_request("POST", "/login", {"mobile": "0000000000", "password": "wrong"})
    if response and response.status_code == 401:
        log_test("Invalid Login Rejection", "PASS", "Correctly rejected invalid credentials")
    else:
        log_test("Invalid Login Rejection", "FAIL", f"Status: {response.status_code if response else 'No response'}")

def test_profile_access():
    """Test profile endpoint with authentication"""
    print("\n=== TESTING PROFILE ACCESS ===")
    
    for role in ["admin", "collector", "user"]:
        if role in test_tokens:
            response = make_request("GET", "/profile", token=test_tokens[role])
            if response and response.status_code == 200:
                data = response.json()
                if data["role"] == role:
                    log_test(f"{role.title()} Profile Access", "PASS", f"Profile retrieved for {role}")
                else:
                    log_test(f"{role.title()} Profile Access", "FAIL", f"Role mismatch: expected {role}, got {data.get('role')}")
            else:
                log_test(f"{role.title()} Profile Access", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test profile access without token
    response = make_request("GET", "/profile")
    if response and response.status_code == 403:
        log_test("Profile Access Without Token", "PASS", "Correctly rejected unauthenticated request")
    else:
        log_test("Profile Access Without Token", "FAIL", f"Status: {response.status_code if response else 'No response'}")

def test_user_registration():
    """Test user registration"""
    print("\n=== TESTING USER REGISTRATION ===")
    
    # Test new user registration
    new_user_data = {
        "name": "Test New User",
        "mobile": "5555555555",
        "password": "newuser123",
        "role": "user"
    }
    
    response = make_request("POST", "/register", new_user_data)
    if response and response.status_code == 200:
        data = response.json()
        if "token" in data and "user" in data:
            log_test("New User Registration", "PASS", f"User registered: {data['user']['name']}")
        else:
            log_test("New User Registration", "FAIL", "Missing token or user in response")
    else:
        log_test("New User Registration", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test duplicate registration
    response = make_request("POST", "/register", new_user_data)
    if response and response.status_code == 400:
        log_test("Duplicate Registration Prevention", "PASS", "Correctly rejected duplicate mobile number")
    else:
        log_test("Duplicate Registration Prevention", "FAIL", f"Status: {response.status_code if response else 'No response'}")

def test_ewaste_request_management():
    """Test e-waste request CRUD operations"""
    print("\n=== TESTING E-WASTE REQUEST MANAGEMENT ===")
    global test_request_id
    
    # Test user creating a request
    if "user" in test_tokens:
        request_data = {
            "description": "Old laptop and mobile phone for disposal",
            "quantity": "2 items",
            "pickup_address": "123 Test Street, Test City",
            "contact_info": "Contact: 7777777777"
        }
        
        response = make_request("POST", "/requests", request_data, token=test_tokens["user"])
        if response and response.status_code == 200:
            data = response.json()
            if "id" in data and data["status"] == "submitted":
                test_request_id = data["id"]
                log_test("User Create Request", "PASS", f"Request created with ID: {test_request_id}")
            else:
                log_test("User Create Request", "FAIL", "Invalid request creation response")
        else:
            log_test("User Create Request", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test admin/collector trying to create request (should fail)
    if "admin" in test_tokens:
        response = make_request("POST", "/requests", request_data, token=test_tokens["admin"])
        if response and response.status_code == 403:
            log_test("Admin Create Request Restriction", "PASS", "Admin correctly restricted from creating requests")
        else:
            log_test("Admin Create Request Restriction", "FAIL", f"Status: {response.status_code if response else 'No response'}")

def test_role_based_request_access():
    """Test role-based access to requests"""
    print("\n=== TESTING ROLE-BASED REQUEST ACCESS ===")
    
    # Test user viewing their requests
    if "user" in test_tokens:
        response = make_request("GET", "/requests", token=test_tokens["user"])
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("User View Own Requests", "PASS", f"User can view {len(data)} requests")
            else:
                log_test("User View Own Requests", "FAIL", "Invalid response format")
        else:
            log_test("User View Own Requests", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test admin viewing all requests
    if "admin" in test_tokens:
        response = make_request("GET", "/admin/requests", token=test_tokens["admin"])
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("Admin View All Requests", "PASS", f"Admin can view {len(data)} requests")
            else:
                log_test("Admin View All Requests", "FAIL", "Invalid response format")
        else:
            log_test("Admin View All Requests", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test user trying to access admin endpoint (should fail)
    if "user" in test_tokens:
        response = make_request("GET", "/admin/requests", token=test_tokens["user"])
        if response and response.status_code == 403:
            log_test("User Admin Access Restriction", "PASS", "User correctly restricted from admin endpoints")
        else:
            log_test("User Admin Access Restriction", "FAIL", f"Status: {response.status_code if response else 'No response'}")

def test_collector_management():
    """Test collector-related endpoints"""
    print("\n=== TESTING COLLECTOR MANAGEMENT ===")
    
    # Test admin getting collectors list
    if "admin" in test_tokens:
        response = make_request("GET", "/collectors", token=test_tokens["admin"])
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                collector_found = any(collector["role"] == "collector" for collector in data)
                if collector_found:
                    log_test("Admin Get Collectors", "PASS", f"Found {len(data)} collectors")
                else:
                    log_test("Admin Get Collectors", "FAIL", "No collectors found in response")
            else:
                log_test("Admin Get Collectors", "FAIL", "Empty or invalid collectors list")
        else:
            log_test("Admin Get Collectors", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test user trying to get collectors (should fail)
    if "user" in test_tokens:
        response = make_request("GET", "/collectors", token=test_tokens["user"])
        if response and response.status_code == 403:
            log_test("User Collectors Access Restriction", "PASS", "User correctly restricted from collectors endpoint")
        else:
            log_test("User Collectors Access Restriction", "FAIL", f"Status: {response.status_code if response else 'No response'}")

def test_request_assignment():
    """Test admin assigning requests to collectors"""
    print("\n=== TESTING REQUEST ASSIGNMENT ===")
    
    if test_request_id and "admin" in test_tokens and "collector" in test_tokens:
        # Get collector ID first
        response = make_request("GET", "/collectors", token=test_tokens["admin"])
        if response and response.status_code == 200:
            collectors = response.json()
            if collectors:
                collector_id = collectors[0]["id"]
                
                # Assign request to collector
                assignment_data = {
                    "status": "assigned",
                    "assigned_collector_id": collector_id
                }
                
                response = make_request("PUT", f"/admin/requests/{test_request_id}", assignment_data, token=test_tokens["admin"])
                if response and response.status_code == 200:
                    log_test("Admin Assign Request", "PASS", f"Request assigned to collector {collector_id}")
                else:
                    log_test("Admin Assign Request", "FAIL", f"Status: {response.status_code if response else 'No response'}")
            else:
                log_test("Admin Assign Request", "FAIL", "No collectors available for assignment")
        else:
            log_test("Admin Assign Request", "FAIL", "Could not retrieve collectors list")

def test_collector_status_update():
    """Test collector updating request status"""
    print("\n=== TESTING COLLECTOR STATUS UPDATE ===")
    
    if test_request_id and "collector" in test_tokens:
        # Test collector updating status
        response = make_request("PUT", f"/collector/requests/{test_request_id}?status=accepted", token=test_tokens["collector"])
        if response and response.status_code == 200:
            log_test("Collector Update Status", "PASS", "Collector successfully updated request status")
        else:
            log_test("Collector Update Status", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test user trying to update status (should fail)
    if test_request_id and "user" in test_tokens:
        response = make_request("PUT", f"/collector/requests/{test_request_id}?status=completed", token=test_tokens["user"])
        if response and response.status_code == 403:
            log_test("User Status Update Restriction", "PASS", "User correctly restricted from updating status")
        else:
            log_test("User Status Update Restriction", "FAIL", f"Status: {response.status_code if response else 'No response'}")

def test_transaction_logging():
    """Test transaction logging system"""
    print("\n=== TESTING TRANSACTION LOGGING ===")
    
    if test_request_id and "admin" in test_tokens:
        response = make_request("GET", f"/transactions/{test_request_id}", token=test_tokens["admin"])
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                # Check if transactions have required fields
                transaction = data[0]
                required_fields = ["id", "request_id", "action", "performed_by", "timestamp"]
                if all(field in transaction for field in required_fields):
                    log_test("Transaction Logging", "PASS", f"Found {len(data)} transactions with proper structure")
                else:
                    log_test("Transaction Logging", "FAIL", "Transaction missing required fields")
            else:
                log_test("Transaction Logging", "FAIL", "No transactions found for request")
        else:
            log_test("Transaction Logging", "FAIL", f"Status: {response.status_code if response else 'No response'}")

def test_analytics():
    """Test analytics endpoint"""
    print("\n=== TESTING ANALYTICS ===")
    
    if "admin" in test_tokens:
        response = make_request("GET", "/admin/analytics", token=test_tokens["admin"])
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ["total_requests", "pending_requests", "completed_requests", "in_progress_requests"]
            if all(field in data for field in required_fields):
                log_test("Admin Analytics", "PASS", f"Analytics data: {data}")
            else:
                log_test("Admin Analytics", "FAIL", "Analytics missing required fields")
        else:
            log_test("Admin Analytics", "FAIL", f"Status: {response.status_code if response else 'No response'}")
    
    # Test user trying to access analytics (should fail)
    if "user" in test_tokens:
        response = make_request("GET", "/admin/analytics", token=test_tokens["user"])
        if response and response.status_code == 403:
            log_test("User Analytics Access Restriction", "PASS", "User correctly restricted from analytics")
        else:
            log_test("User Analytics Access Restriction", "FAIL", f"Status: {response.status_code if response else 'No response'}")

def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting E-Waste Management System Backend API Tests")
    print(f"Testing against: {BASE_URL}")
    print("=" * 60)
    
    # Test basic connectivity
    if not test_root_endpoint():
        print("❌ Root endpoint failed - backend may not be running")
        return False
    
    # Run all test suites
    test_authentication()
    test_profile_access()
    test_user_registration()
    test_ewaste_request_management()
    test_role_based_request_access()
    test_collector_management()
    test_request_assignment()
    test_collector_status_update()
    test_transaction_logging()
    test_analytics()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in test_results if result["status"] == "PASS")
    failed = sum(1 for result in test_results if result["status"] == "FAIL")
    total = len(test_results)
    
    print(f"Total Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for result in test_results:
            if result["status"] == "FAIL":
                print(f"  - {result['test']}: {result['details']}")
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)