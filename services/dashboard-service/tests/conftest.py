"""
Test configuration and fixtures for dashboard service tests
"""

import pytest
import os
import tempfile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from src.main import app
from src.database import get_db, Base
from src.models.dashboard import Dashboard, DashboardWidget


@pytest.fixture(scope="function")
def test_db():
    """Create a temporary test database for each test"""
    # Create temporary database file
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(db_fd)
    
    # Create test database engine with thread safety
    test_engine = create_engine(
        f"sqlite:///{db_path}",
        echo=False,
        poolclass=None,
        connect_args={
            "check_same_thread": False,
        }
    )
    Base.metadata.create_all(bind=test_engine)
    
    # Create session factory
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    
    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
    
    # Override the dependency
    app.dependency_overrides[get_db] = override_get_db
    
    session = TestingSessionLocal()
    yield session
    
    # Cleanup
    session.close()
    os.unlink(db_path)
    if get_db in app.dependency_overrides:
        del app.dependency_overrides[get_db]


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def sample_dashboard(test_db):
    """Create a sample dashboard for testing"""
    dashboard = Dashboard(
        user_id=1,
        name="Test Dashboard",
        description="A test dashboard",
        display_settings={
            'showWidgetHeaders': True,
            'showWidgetFooters': True,
            'compactMode': False,
            'theme': 'default'
        }
    )
    test_db.add(dashboard)
    test_db.commit()
    test_db.refresh(dashboard)
    return dashboard


@pytest.fixture
def sample_widget(test_db, sample_dashboard):
    """Create a sample widget for testing"""
    widget = DashboardWidget(
        dashboard_id=sample_dashboard.id,
        type="chart",
        title="Test Chart Widget",
        description="A test chart widget",
        position={'x': 0, 'y': 0, 'w': 6, 'h': 4},
        agent_id=1,
        node_id="test-node-123",
        config={
            'chartType': 'line',
            'showLegend': True
        }
    )
    test_db.add(widget)
    test_db.commit()
    test_db.refresh(widget)
    return widget


@pytest.fixture
def auth_headers():
    """Mock authentication headers for testing"""
    return {"X-User-ID": "1"}