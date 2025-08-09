"""
Test Dashboard API Endpoints - Integration Tests

Tests for dashboard and widget creation, routing, and authentication
"""

import pytest
import json
from app import create_app, db
from app.models.user import User
from app.models.dashboard import Dashboard, DashboardWidget


@pytest.fixture
def app():
    """Create test application"""
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Create authenticated user and return auth headers"""
    # Create test user
    user_data = {
        'email': 'test@example.com',
        'password': 'testpass123'
    }
    
    # Register user
    response = client.post('/api/v1/auth/register', 
                          json=user_data,
                          headers={'Content-Type': 'application/json'})
    
    # Login to get token
    response = client.post('/api/v1/auth/login',
                          json=user_data, 
                          headers={'Content-Type': 'application/json'})
    
    assert response.status_code == 200
    token = response.get_json()['token']
    
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }


class TestRouteRegistration:
    """Test that all routes are properly registered"""
    
    def test_dashboard_routes_exist(self, app):
        """Test that dashboard routes are registered"""
        with app.app_context():
            routes = [str(rule) for rule in app.url_map.iter_rules()]
            
            # Check main dashboard routes
            assert '/api/v1/dashboards' in routes
            assert '/api/v1/dashboards/<int:dashboard_id>' in routes
            assert '/api/v1/dashboards/<int:dashboard_id>/widgets' in routes
            assert '/api/v1/dashboards/<int:dashboard_id>/widgets/<int:widget_id>' in routes
            
    def test_route_methods(self, app):
        """Test that routes have correct HTTP methods"""
        with app.app_context():
            for rule in app.url_map.iter_rules():
                if rule.rule == '/api/v1/dashboards':
                    assert 'GET' in rule.methods
                    assert 'POST' in rule.methods
                elif rule.rule == '/api/v1/dashboards/<int:dashboard_id>/widgets':
                    assert 'POST' in rule.methods


class TestDashboardAPI:
    """Test dashboard CRUD operations"""
    
    def test_get_dashboards_without_auth(self, client):
        """Test getting dashboards without authentication"""
        response = client.get('/api/v1/dashboards')
        assert response.status_code == 401
        
    def test_create_dashboard_without_auth(self, client):
        """Test creating dashboard without authentication"""
        response = client.post('/api/v1/dashboards',
                              json={'name': 'Test Dashboard'},
                              headers={'Content-Type': 'application/json'})
        assert response.status_code == 401
        
    def test_create_dashboard_with_auth(self, client, auth_headers):
        """Test creating dashboard with authentication"""
        dashboard_data = {
            'name': 'Test Dashboard',
            'description': 'Test description'
        }
        
        response = client.post('/api/v1/dashboards',
                              json=dashboard_data,
                              headers=auth_headers)
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['name'] == 'Test Dashboard'
        assert 'id' in data['data']
        
    def test_get_dashboards_with_auth(self, client, auth_headers):
        """Test getting dashboards with authentication"""
        # First create a dashboard
        client.post('/api/v1/dashboards',
                    json={'name': 'Test Dashboard'},
                    headers=auth_headers)
        
        # Then get all dashboards
        response = client.get('/api/v1/dashboards', headers=auth_headers)
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert len(data['data']) >= 1


class TestWidgetAPI:
    """Test widget CRUD operations"""
    
    def test_widget_route_without_auth(self, client):
        """Test widget creation without authentication"""
        response = client.post('/api/v1/dashboards/1/widgets',
                              json={'type': 'chart', 'title': 'Test Widget'},
                              headers={'Content-Type': 'application/json'})
        # Should return 401 (unauthorized), not 404 (not found)
        assert response.status_code == 401
        
    def test_create_widget_with_auth(self, client, auth_headers):
        """Test creating widget with authentication"""
        # First create a dashboard
        dashboard_response = client.post('/api/v1/dashboards',
                                        json={'name': 'Test Dashboard'},
                                        headers=auth_headers)
        dashboard_id = dashboard_response.get_json()['data']['id']
        
        # Then create a widget
        widget_data = {
            'type': 'chart',
            'title': 'Test Chart Widget'
        }
        
        response = client.post(f'/api/v1/dashboards/{dashboard_id}/widgets',
                              json=widget_data,
                              headers=auth_headers)
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['title'] == 'Test Chart Widget'
        assert data['data']['type'] == 'chart'
        assert 'id' in data['data']
        
    def test_create_widget_invalid_dashboard(self, client, auth_headers):
        """Test creating widget for non-existent dashboard"""
        widget_data = {
            'type': 'chart', 
            'title': 'Test Widget'
        }
        
        response = client.post('/api/v1/dashboards/999/widgets',
                              json=widget_data,
                              headers=auth_headers)
        
        # Should return 404 because dashboard doesn't exist
        assert response.status_code == 404


class TestDebugRouting:
    """Debug specific routing issues"""
    
    def test_exact_failing_route(self, client, auth_headers):
        """Test the exact route that's failing in production"""
        # Create dashboard first
        dashboard_response = client.post('/api/v1/dashboards',
                                        json={'name': 'Debug Dashboard'},
                                        headers=auth_headers)
        
        assert dashboard_response.status_code == 201
        dashboard_id = dashboard_response.get_json()['data']['id']
        
        # Test the exact widget creation that's failing
        widget_data = {
            'type': 'chart',
            'title': 'Debug Widget'
        }
        
        response = client.post(f'/api/v1/dashboards/{dashboard_id}/widgets',
                              json=widget_data,
                              headers=auth_headers)
        
        print(f"Dashboard ID: {dashboard_id}")
        print(f"Response Status: {response.status_code}")
        print(f"Response Data: {response.get_json()}")
        
        # This should work - if it returns 404, there's a routing issue
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.get_json()}"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])