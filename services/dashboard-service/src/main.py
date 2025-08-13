"""
Dashboard Service - FastAPI Application

Main application for dashboard and widget management
Preserves all existing functionality from Flask backend
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from .database import init_db
from .api import dashboards_router, charts_router, embed_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Dashboard Service",
    description="Dashboard and widget management service for Dxsh",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(dashboards_router, prefix="/v1", tags=["dashboards"])
app.include_router(charts_router, prefix="/v1", tags=["charts"])
app.include_router(embed_router, prefix="/v1", tags=["embed"])

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "dashboard-service"}

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    logger.info("Initializing dashboard service database...")
    init_db()
    logger.info("Dashboard service ready!")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)