import pytest
from app import create_app
from app import db
from app.models import User

@pytest.fixture
def integration_app():
    """Create app with real database for integration testing"""
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

def test_user_creation_with_firebase_auth(integration_app, mocker):
    """Test actual user creation flow with Firebase auth"""
    with integration_app.test_client() as client:
        # Mock Firebase token verification
        mocker.patch('firebase_admin.auth.verify_id_token').return_value = {
            'uid': 'test-firebase-uid-123',
            'email': 'test@example.com',
            'name': 'Test User',
            'email_verified': True
        }
        
        # Make a request to an auth-protected endpoint
        response = client.get('/api/v1/conversations', 
                            headers={'Authorization': 'Bearer fake-token'})
        
        # Should create user and return conversations
        assert response.status_code == 200
        
        # Verify user was actually created in database
        user = User.query.filter_by(firebase_id='test-firebase-uid-123').first()
        assert user is not None
        assert user.email == 'test@example.com'
        assert user.id is not None  # Should have auto-generated ID

def test_duplicate_user_creation_handling(integration_app, mocker):
    """Test what happens when trying to create user twice"""
    with integration_app.test_client() as client:
        # Create user first time
        mocker.patch('firebase_admin.auth.verify_id_token').return_value = {
            'uid': 'duplicate-test-uid',
            'email': 'duplicate@example.com',
            'name': 'Duplicate User',
            'email_verified': True
        }
        
        # First request - should create user
        response1 = client.get('/api/v1/conversations',
                             headers={'Authorization': 'Bearer fake-token'})
        assert response1.status_code == 200
        
        # Second request - should find existing user
        response2 = client.get('/api/v1/conversations',
                             headers={'Authorization': 'Bearer fake-token'})
        assert response2.status_code == 200
        
        # Should only have one user in database
        users = User.query.filter_by(firebase_id='duplicate-test-uid').all()
        assert len(users) == 1