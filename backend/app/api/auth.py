# backend/app/api/auth.py
from flask import request, jsonify
from app.api import api_bp
from app.models.user import User
from app.auth import generate_token, auth_required, get_current_user
from app import db
import logging

logger = logging.getLogger(__name__)

@api_bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint for dashboard and monitoring"""
    return jsonify({
        'status': 'healthy',
        'service': 'workflow-engine-api',
        'version': '1.0.0'
    }), 200

@api_bp.route('/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': 'User with this email already exists'}), 409
        
        # Create new user
        user = User.create_user(email, password)
        db.session.add(user)
        db.session.commit()
        
        # Generate token
        token = generate_token(user.id, user.email)
        
        logger.info(f"New user registered: {email}")
        return jsonify({
            'message': 'User registered successfully',
            'token': token,
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        db.session.rollback()
        return jsonify({'error': 'Registration failed'}), 500

@api_bp.route('/auth/login', methods=['POST'])
def login():
    """Login a user"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Find user
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Generate token
        token = generate_token(user.id, user.email)
        
        logger.info(f"User logged in: {email}")
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error logging in user: {e}")
        return jsonify({'error': 'Login failed'}), 500

@api_bp.route('/auth/me', methods=['GET'])
@auth_required
def get_current_user_info():
    """Get current user information"""
    try:
        current_user = get_current_user()
        if current_user.api_key:
            # API key user
            return jsonify({
                'user_id': current_user.user_id,
                'email': current_user.email,
                'auth_type': 'api_key'
            }), 200
        else:
            # JWT user - get from database
            user = User.query.get(current_user.user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            return jsonify({
                'user': user.to_dict(),
                'auth_type': 'jwt'
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        return jsonify({'error': 'Failed to get user info'}), 500

@api_bp.route('/auth/logout', methods=['POST'])
@auth_required
def logout():
    """Logout user (client-side token removal)"""
    return jsonify({'message': 'Logout successful. Please remove the token from client.'}), 200