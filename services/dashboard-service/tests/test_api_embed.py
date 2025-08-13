"""
Test embedding API endpoints
"""

import pytest
import json
from unittest.mock import AsyncMock, patch


def test_get_embedded_dashboard(client, sample_dashboard):
    """Test getting dashboard for embedding (no auth required)"""
    response = client.get(f"/v1/embed/dashboards/{sample_dashboard.id}")
    
    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard['id'] == sample_dashboard.id
    assert dashboard['name'] == "Test Dashboard"
    assert 'display_settings' in dashboard
    assert 'created_at' in dashboard
    assert 'updated_at' in dashboard


def test_get_embedded_dashboard_not_found(client):
    """Test getting non-existent dashboard for embedding"""
    response = client.get("/v1/embed/dashboards/999")
    assert response.status_code == 404


def test_get_embedded_dashboard_widgets(client, sample_widget):
    """Test getting dashboard widgets for embedding"""
    response = client.get(f"/v1/embed/dashboards/{sample_widget.dashboard_id}/widgets")
    
    assert response.status_code == 200
    widgets = response.json()
    assert len(widgets) == 1
    assert widgets[0]['id'] == sample_widget.id
    assert widgets[0]['widget_type'] == "chart"
    assert widgets[0]['widget_config'] == sample_widget.config
    assert widgets[0]['position'] == sample_widget.position


def test_get_embedded_dashboard_widgets_not_found(client):
    """Test getting widgets for non-existent dashboard"""
    response = client.get("/v1/embed/dashboards/999/widgets")
    assert response.status_code == 404


@patch('src.services.workflow_client.WorkflowClient.get_node_execution_data')
def test_get_embedded_widget_data(mock_get_data, client, sample_widget):
    """Test getting widget data for embedding"""
    # Mock the workflow client response
    mock_data = {
        'chart_type': 'line',
        'data': [1, 2, 3, 4, 5],
        'labels': ['A', 'B', 'C', 'D', 'E']
    }
    mock_get_data.return_value = mock_data
    
    response = client.get(f"/v1/embed/widgets/{sample_widget.id}/data")
    
    assert response.status_code == 200
    widget_data = response.json()
    assert widget_data['widget_id'] == sample_widget.id
    assert widget_data['widget_type'] == "chart"
    assert widget_data['widget_config'] == sample_widget.config
    assert widget_data['data'] == mock_data
    
    # Verify the workflow client was called correctly
    mock_get_data.assert_called_once_with(
        sample_widget.agent_id,
        sample_widget.node_id
    )


@patch('src.services.workflow_client.WorkflowClient.get_node_execution_data')
def test_get_embedded_widget_data_no_data(mock_get_data, client, sample_widget):
    """Test getting widget data when workflow client returns None"""
    mock_get_data.return_value = None
    
    response = client.get(f"/v1/embed/widgets/{sample_widget.id}/data")
    
    assert response.status_code == 200
    widget_data = response.json()
    assert widget_data['data'] is None


def test_get_embedded_widget_data_not_found(client):
    """Test getting data for non-existent widget"""
    response = client.get("/v1/embed/widgets/999/data")
    assert response.status_code == 404


def test_get_dashboard_preview(client, sample_dashboard, sample_widget):
    """Test getting dashboard preview data"""
    response = client.get(
        f"/v1/embed/dashboards/{sample_dashboard.id}/preview",
        params={"width": 1200, "height": 800}
    )
    
    assert response.status_code == 200
    preview = response.json()
    
    # Check dashboard info
    assert preview['dashboard']['id'] == sample_dashboard.id
    assert preview['dashboard']['name'] == "Test Dashboard"
    
    # Check widgets
    assert len(preview['widgets']) == 1
    widget_preview = preview['widgets'][0]
    assert widget_preview['id'] == sample_widget.id
    assert widget_preview['widget_type'] == "chart"
    assert widget_preview['data_available'] is True  # Has agent_id and node_id
    
    # Check preview settings
    assert preview['preview_settings']['width'] == 1200
    assert preview['preview_settings']['height'] == 800
    assert preview['preview_settings']['responsive'] is True


def test_get_dashboard_preview_default_size(client, sample_dashboard):
    """Test getting dashboard preview with default dimensions"""
    response = client.get(f"/v1/embed/dashboards/{sample_dashboard.id}/preview")
    
    assert response.status_code == 200
    preview = response.json()
    assert preview['preview_settings']['width'] == 800
    assert preview['preview_settings']['height'] == 600


def test_get_dashboard_preview_not_found(client):
    """Test getting preview for non-existent dashboard"""
    response = client.get("/v1/embed/dashboards/999/preview")
    assert response.status_code == 404