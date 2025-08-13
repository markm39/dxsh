from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

def setup_cors(app: FastAPI):
    """Configure CORS for the API Gateway to support embedding"""
    
    # Get allowed origins from environment variable
    allowed_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS', '*')
    
    if allowed_origins_env == '*':
        allowed_origins = ["*"]
    else:
        allowed_origins = [origin.strip() for origin in allowed_origins_env.split(',')]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=[
            "Authorization",
            "Content-Type", 
            "X-API-Key",
            "X-Requested-With",
            "Accept",
            "Origin",
            "User-Agent",
            "DNT",
            "Cache-Control",
            "X-Mx-ReqToken",
            "Keep-Alive",
            "If-Modified-Since",
        ],
        expose_headers=[
            "Content-Type",
            "X-Total-Count",
            "X-Page-Count",
            "X-Current-Page"
        ]
    )