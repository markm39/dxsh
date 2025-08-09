from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

db = SQLAlchemy()
migrate = Migrate()

def create_app(config_name='development'):
    app = Flask(__name__)
    
    # Configuration
    # Handle relative database paths properly
    database_url = os.getenv('DATABASE_URL', 'sqlite:///instance/workflow_engine.db')
    
    # If it's a relative SQLite path, make it absolute based on the backend directory
    if database_url.startswith('sqlite:///') and not database_url.startswith('sqlite:////'):
        # Extract the relative path after sqlite:///
        relative_path = database_url.replace('sqlite:///', '')
        # Get the backend directory (parent of app directory)
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        # Create absolute path
        absolute_path = os.path.join(backend_dir, relative_path)
        database_url = f'sqlite:///{absolute_path}'
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    
    # Configure CORS to allow both frontend (3000) and dashboard (3001)
    CORS(app, origins=[
        "http://localhost:3000",  # Frontend
        "http://localhost:3001",  # Dashboard
        "http://127.0.0.1:3000",  # Alternative localhost
        "http://127.0.0.1:3001"   # Alternative localhost
    ])
    
    # Import models to ensure they're registered
    from app.models import agent, execution, user, dashboard
    
    # Register blueprints
    from app.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api/v1')
    
    return app
