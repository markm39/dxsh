"""
Test dashboard and widget models
"""

import pytest
from datetime import datetime
from src.models.dashboard import Dashboard, DashboardWidget


def test_dashboard_creation(test_db):
    """Test dashboard model creation"""
    dashboard = Dashboard(
        user_id=1,
        name="Test Dashboard",
        description="Test description",
        display_settings={'theme': 'dark'}
    )
    
    test_db.add(dashboard)
    test_db.commit()
    test_db.refresh(dashboard)
    
    assert dashboard.id is not None
    assert dashboard.user_id == 1
    assert dashboard.name == "Test Dashboard"
    assert dashboard.description == "Test description"
    assert dashboard.display_settings == {'theme': 'dark'}
    assert dashboard.created_at is not None
    assert dashboard.updated_at is not None


def test_dashboard_to_dict(sample_dashboard):
    """Test dashboard to_dict method"""
    dashboard_dict = sample_dashboard.to_dict()
    
    assert 'id' in dashboard_dict
    assert 'user_id' in dashboard_dict
    assert 'name' in dashboard_dict
    assert 'description' in dashboard_dict
    assert 'display_settings' in dashboard_dict
    assert 'created_at' in dashboard_dict
    assert 'updated_at' in dashboard_dict
    assert 'widgets' in dashboard_dict
    
    assert dashboard_dict['user_id'] == 1
    assert dashboard_dict['name'] == "Test Dashboard"


def test_widget_creation(test_db, sample_dashboard):
    """Test widget model creation"""
    widget = DashboardWidget(
        dashboard_id=sample_dashboard.id,
        type="metric",
        title="Test Metric",
        description="Test metric widget",
        position={'x': 0, 'y': 0, 'w': 3, 'h': 2},
        agent_id=1,
        node_id="metric-node",
        config={'format': 'currency'}
    )
    
    test_db.add(widget)
    test_db.commit()
    test_db.refresh(widget)
    
    assert widget.id is not None
    assert widget.dashboard_id == sample_dashboard.id
    assert widget.type == "metric"
    assert widget.title == "Test Metric"
    assert widget.agent_id == 1
    assert widget.node_id == "metric-node"
    assert widget.config == {'format': 'currency'}
    assert widget.created_at is not None


def test_widget_to_dict(sample_widget):
    """Test widget to_dict method"""
    widget_dict = sample_widget.to_dict()
    
    assert 'id' in widget_dict
    assert 'dashboard_id' in widget_dict
    assert 'type' in widget_dict
    assert 'title' in widget_dict
    assert 'description' in widget_dict
    assert 'position' in widget_dict
    assert 'dataSource' in widget_dict
    assert 'config' in widget_dict
    assert 'created_at' in widget_dict
    
    assert widget_dict['type'] == "chart"
    assert widget_dict['title'] == "Test Chart Widget"
    assert widget_dict['dataSource']['agentId'] == 1
    assert widget_dict['dataSource']['nodeId'] == "test-node-123"


def test_widget_update_cached_data(test_db, sample_widget):
    """Test widget cached data update"""
    test_data = {'values': [1, 2, 3, 4, 5]}
    
    sample_widget.update_cached_data(test_data, test_db)
    
    assert sample_widget.cached_data == test_data
    assert sample_widget.last_updated is not None
    assert isinstance(sample_widget.last_updated, datetime)


def test_dashboard_widget_relationship(test_db, sample_dashboard, sample_widget):
    """Test relationship between dashboard and widgets"""
    # Refresh dashboard to load widgets
    test_db.refresh(sample_dashboard)
    
    assert len(sample_dashboard.widgets) == 1
    assert sample_dashboard.widgets[0].id == sample_widget.id
    assert sample_widget.dashboard == sample_dashboard