# backend/app/api/__init__.py
from flask import Blueprint

# Create API blueprint
api_bp = Blueprint('api', __name__)

# Import all API routes (this registers them with the blueprint)
from app.api import auth
from app.api import agents
from app.api import workflows
from app.api import executions
from app.api import monitoring
from app.api import ml_training
from app.api import ai_processing
from app.api import data_structuring
from app.api import http_request
from app.api import cors_proxy
from app.api import headless_scraper
from app.api import postgres
from app.api import dashboards
from app.api import file_node