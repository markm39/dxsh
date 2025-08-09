import pytest
import os
from app import create_app
from app import db
from app.models import User

@pytest.fixture
def real_app():
    """App with minimal mocking to expose real issues"""
    # Set minimal required env vars for testing
    os.environ['OPENAI_API_KEY'] = 'fake-key-for-testing'
    os.environ['PINECONE_API_KEY'] = 'fake-key-for-testing'
    os.environ['PINECONE_INDEX_NAME'] = 'fake-index-for-testing'
    
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

def test_real_user_creation_flow(real_app):
    """Test the ACTUAL user creation that's failing in production"""
    with real_app.test_client() as client:
        # Don't mock Firebase - let it fail naturally and see what happens
        response = client.get('/api/v1/conversations',
                            headers={'Authorization': 'Bearer fake-token'})
        
        print(f"Response status: {response.status_code}")
        print(f"Response data: {response.get_json()}")
        
        # This will fail and show us the real error
        assert response.status_code != 500  # Should not be server error

def test_real_chat_flow_minimal_mocking(real_app, mocker):
    """Test chat with only essential mocking"""
    with real_app.test_client() as client:
        # Mock Firebase auth
        mocker.patch('firebase_admin.auth.verify_id_token').return_value = {
            'uid': 'real-test-uid',
            'email': 'real-test@example.com', 
            'name': 'Real Test User',
            'email_verified': True
        }
        
        # Create conversation
        conv_response = client.post('/api/v1/conversations',
                                  headers={'Authorization': 'Bearer fake-token'},
                                  json={'name': 'Real Test', 'sport': 'football'})
        
        assert conv_response.status_code == 201
        conversation_id = conv_response.json['id']  # This should work now
        
        # Mock AI processing to avoid external API calls but test DB issues
        mocker.patch('app.services.chat_service.ChatService._process_with_ai').return_value = {
            'response': 'Test response',
            'sql': 'SELECT * FROM test',
            'sql_template': 'SELECT * FROM {{TABLE:test}}',
            'results': [{'test': 'data'}],
            'requires_sql': True,
            'execution_error': None,
            'visualization': {'type': 'bar'},
            'tokens_used': 100
        }
        
        # Now test the chat flow - this should reveal the real database issues
        chat_response = client.post('/api/v1/chat',
                                  headers={'Authorization': 'Bearer fake-token'},
                                  json={
                                      'conversation_id': conversation_id,
                                      'message': 'Show me QB recruits in Texas',
                                      'sport': 'football'
                                  })
        
        print(f"Chat response status: {chat_response.status_code}")
        print(f"Chat response: {chat_response.get_json()}")
        
        # This should reveal the real issues
        if chat_response.status_code != 200:
            response_data = chat_response.get_json()
            print(f"Chat failed with: {response_data}")

def test_database_user_persistence(real_app):
    """Test if users actually persist correctly"""
    with real_app.app_context():
        # Create user manually to test persistence
        user = User(
            email='persist-test@example.com',
            firebase_id='persist-test-uid',
            first_name='Persist',
            last_name='Test'
        )
        
        print(f"User before save - ID: {user.id}")
        
        db.session.add(user)
        db.session.commit()
        
        print(f"User after save - ID: {user.id}")
        
        # Test session refresh
        db.session.refresh(user)
        print(f"User after refresh - ID: {user.id}")
        
        # Test querying
        found_user = User.query.filter_by(firebase_id='persist-test-uid').first()
        print(f"Found user - ID: {found_user.id if found_user else 'None'}")
        
        assert found_user is not None
        assert found_user.id is not None