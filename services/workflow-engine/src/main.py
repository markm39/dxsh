from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .database import create_tables
from .api import workflows, executions, scraping, postgres, file_node, ai_processing, chart_generation, ml_training, agents, executions_api, http_request, data_structuring, monitoring, css_selector, cors_proxy, nodes
from .api.agents import executions_router
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Dxsh Workflow Engine",
    description="Workflow execution service for Dxsh platform",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Starting Workflow Engine service...")
    try:
        create_tables()
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise

# Include routers
app.include_router(workflows.router)
app.include_router(executions.router)
app.include_router(scraping.router)
app.include_router(postgres.router)
app.include_router(file_node.router)
app.include_router(ai_processing.router)
app.include_router(chart_generation.router)
app.include_router(ml_training.router)
app.include_router(agents.router)
app.include_router(executions_router)
app.include_router(executions_api.router)
app.include_router(http_request.router)
app.include_router(data_structuring.router)
app.include_router(monitoring.router)
app.include_router(css_selector.router)
app.include_router(cors_proxy.router)
app.include_router(nodes.router)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Dxsh Workflow Engine",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "workflow-engine",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)