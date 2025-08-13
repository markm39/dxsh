"""
Test dashboard API endpoints
"""

import pytest
import json


def test_get_dashboards_empty(client, auth_headers, test_db):
    """Test getting dashboards when none exist"""
    response = client.get("/v1/dashboards", headers=auth_headers)
    
    assert response.status_code == 200
    response_data = response.json()
    assert response_data['success'] is True
    assert response_data['data'] == []


def test_get_dashboards_with_data(client, auth_headers, sample_dashboard):
    """Test getting dashboards with existing data"""
    response = client.get("/v1/dashboards", headers=auth_headers)
    
    assert response.status_code == 200
    response_data = response.json()
    assert response_data['success'] is True
    dashboards = response_data['data']
    assert len(dashboards) == 1
    assert dashboards[0]['id'] == sample_dashboard.id
    assert dashboards[0]['name'] == "Test Dashboard"


def test_create_dashboard(client, auth_headers, test_db):
    """Test creating a new dashboard"""
    dashboard_data = {
        "name": "New Dashboard",
        "description": "A new test dashboard",
        "display_settings": {
            "theme": "dark",
            "compactMode": True
        }
    }
    
    response = client.post(
        "/v1/dashboards",
        headers=auth_headers,
        json=dashboard_data
    )
    
    assert response.status_code == 201
    created_dashboard = response.json()
    assert created_dashboard['name'] == "New Dashboard"
    assert created_dashboard['description'] == "A new test dashboard"
    assert created_dashboard['display_settings']['theme'] == "dark"
    assert created_dashboard['user_id'] == 1


def test_get_dashboard_by_id(client, auth_headers, sample_dashboard):
    """Test getting a specific dashboard by ID"""
    response = client.get(f"/v1/dashboards/{sample_dashboard.id}", headers=auth_headers)
    
    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard['id'] == sample_dashboard.id
    assert dashboard['name'] == "Test Dashboard"


def test_get_dashboard_not_found(client, auth_headers):
    """Test getting a non-existent dashboard"""
    response = client.get("/v1/dashboards/999", headers=auth_headers)
    assert response.status_code == 404


def test_update_dashboard(client, auth_headers, sample_dashboard):
    """Test updating a dashboard"""
    update_data = {
        "name": "Updated Dashboard",
        "description": "Updated description",
        "display_settings": {
            "theme": "light",
            "compactMode": False
        }
    }
    
    response = client.put(
        f"/v1/dashboards/{sample_dashboard.id}",
        headers=auth_headers,
        json=update_data
    )
    
    assert response.status_code == 200
    updated_dashboard = response.json()
    assert updated_dashboard['name'] == "Updated Dashboard"
    assert updated_dashboard['description'] == "Updated description"
    assert updated_dashboard['display_settings']['theme'] == "light"


def test_delete_dashboard(client, auth_headers, sample_dashboard):
    """Test deleting a dashboard"""
    dashboard_id = sample_dashboard.id
    
    response = client.delete(f"/v1/dashboards/{dashboard_id}", headers=auth_headers)
    assert response.status_code == 204
    
    # Verify dashboard is deleted
    response = client.get(f"/v1/dashboards/{dashboard_id}", headers=auth_headers)
    assert response.status_code == 404


def test_get_dashboard_widgets(client, auth_headers, sample_widget):
    """Test getting widgets for a dashboard"""
    response = client.get(
        f"/v1/dashboards/{sample_widget.dashboard_id}/widgets",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    widgets = response.json()
    assert len(widgets) == 1
    assert widgets[0]['id'] == sample_widget.id
    assert widgets[0]['type'] == "chart"
    assert widgets[0]['title'] == "Test Chart Widget"


def test_create_dashboard_widget(client, auth_headers, sample_dashboard):
    """Test creating a widget for a dashboard"""
    widget_data = {
        "type": "metric",
        "title": "New Metric Widget",
        "description": "A new metric widget",
        "position": {"x": 6, "y": 0, "w": 3, "h": 2},
        "agent_id": 2,
        "node_id": "metric-node-456",
        "config": {"format": "percentage"}
    }
    
    response = client.post(
        f"/v1/dashboards/{sample_dashboard.id}/widgets",
        headers=auth_headers,
        json=widget_data
    )
    
    assert response.status_code == 200  # Changed from 201 to 200
    response_data = response.json()
    created_widget = response_data['data']  # Access data field
    assert created_widget['type'] == "metric"
    assert created_widget['title'] == "New Metric Widget"
    assert created_widget['dataSource']['agentId'] == 2
    assert created_widget['dataSource']['nodeId'] == "metric-node-456"


def test_update_dashboard_widget(client, auth_headers, sample_widget):
    """Test updating a dashboard widget"""
    update_data = {
        "title": "Updated Widget Title",
        "config": {"chartType": "bar", "showLegend": False}
    }
    
    response = client.put(
        f"/v1/widgets/{sample_widget.id}",
        headers=auth_headers,
        json=update_data
    )
    
    assert response.status_code == 200
    updated_widget = response.json()
    assert updated_widget['title'] == "Updated Widget Title"
    assert updated_widget['config']['chartType'] == "bar"
    assert updated_widget['config']['showLegend'] is False


def test_delete_dashboard_widget(client, auth_headers, sample_widget):
    """Test deleting a dashboard widget"""
    widget_id = sample_widget.id
    
    response = client.delete(f"/v1/widgets/{widget_id}", headers=auth_headers)
    assert response.status_code == 204
    
    # Verify widget is deleted
    response = client.get(f"/v1/widgets/{widget_id}", headers=auth_headers)
    assert response.status_code == 404


def test_unauthorized_access(client, test_db):
    """Test accessing endpoints without authentication"""
    response = client.get("/v1/dashboards")
    assert response.status_code == 401