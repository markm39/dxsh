import pytest
from app import create_app
from app import db
from app.models import User
from app.utils.auth_utils import get_or_create_user_from_firebase

@pytest.fixture
def integration_app():
    """Create app with real database for integration testing"""
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

def test_user_model_auto_increment_id(integration_app):
    """Test that User model properly auto-generates IDs"""
    with integration_app.app_context():
        user = User(
            email='id-test@example.com',
            firebase_id='id-test-uid',
            first_name='ID',
            last_name='Test'
        )
        
        # Before saving, ID should be None
        assert user.id is None
        
        db.session.add(user)
        db.session.commit()
        
        # After saving, ID should be auto-generated
        assert user.id is not None
        assert isinstance(user.id, int)
        
        # Refresh and verify it persists
        db.session.refresh(user)
        assert user.id is not None
def test_user_creation_database_issue(integration_app):
    """Test the exact user creation issue from your logs"""
    with integration_app.app_context():
        # Test the exact scenario from your error logs
        firebase_uid = 'sN6CJVcMzHTAdSNKQz1x20aqK0t1'
        email = 'markmiller0470@gmail.com'
        name = 'Mark Miller'
        
        # First creation - should work
        user1 = get_or_create_user_from_firebase(firebase_uid, email, name)
        assert user1.id is not None
        assert user1.firebase_id == firebase_uid
        
        # Second creation - should find existing user, not create duplicate
        user2 = get_or_create_user_from_firebase(firebase_uid, email, name)
        assert user2.id == user1.id  # Should be same user
        assert user2.firebase_id == firebase_uid
        
        # Verify only one user exists
        all_users = User.query.filter_by(firebase_id=firebase_uid).all()
        assert len(all_users) == 1

def test_user_session_refresh_issue(integration_app):
    """Test user session detachment issue"""
    with integration_app.app_context():
        # Create user
        user = User(
            email='session-test@example.com',
            firebase_id='session-test-uid',
            first_name='Session',
            last_name='Test'
        )
        db.session.add(user)
        db.session.commit()
        
        # Verify user has ID
        assert user.id is not None
        user_id = user.id
        
        # Simulate session operations that might detach the user
        db.session.expunge(user)  # This detaches the user
        
        # Try to access the user again
        fresh_user = User.query.get(user_id)
        assert fresh_user is not None
        assert fresh_user.id == user_id