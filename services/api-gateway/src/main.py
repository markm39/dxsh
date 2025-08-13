from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import Response
import os
from dotenv import load_dotenv
from .cors import setup_cors
from .proxy import ServiceProxy
from .auth import get_current_user, AuthUser
from .api import auth
from .database import Base, engine

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Dxsh API Gateway",
    description="API Gateway for Dxsh microservices architecture",
    version="1.0.0"
)

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    # Import all models to ensure they're registered
    from .models import User
    # Create all tables
    Base.metadata.create_all(bind=engine)

# Setup CORS
setup_cors(app)

# Include auth router
app.include_router(auth.router)

# Initialize service proxy
proxy = ServiceProxy()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "api-gateway"}

@app.get("/api/v1/health")
async def health_check_v1():
    """Health check endpoint for API v1"""
    return {"status": "healthy", "service": "api-gateway"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Dxsh API Gateway",
        "version": "1.0.0",
        "services": {
            "workflow_engine": proxy.workflow_engine_url,
            "dashboard_service": proxy.dashboard_service_url,
            "builder_service": proxy.builder_service_url
        }
    }

# Workflow Engine Routes
@app.api_route(
    "/v1/workflows/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_workflows(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy workflow-related requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/v1/workflows/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

@app.api_route(
    "/v1/executions/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_executions(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy execution-related requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/v1/executions/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

@app.api_route(
    "/v1/nodes/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_nodes(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy node-related requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/v1/nodes/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Dashboard Service Routes
@app.api_route(
    "/v1/dashboards/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_dashboards(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy dashboard-related requests to dashboard-service"""
    response_data = await proxy.route_dashboard_request(request, f"/v1/dashboards/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Dashboard Service Routes (with /api prefix)
@app.api_route(
    "/api/v1/dashboards/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_api_dashboards(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy dashboard-related API requests to dashboard-service"""
    response_data = await proxy.route_dashboard_request(request, f"/v1/dashboards/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Support dashboards without path for list endpoint
@app.api_route(
    "/api/v1/dashboards",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_api_dashboards_root(
    request: Request,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy dashboard list requests to dashboard-service"""
    response_data = await proxy.route_dashboard_request(request, f"/v1/dashboards")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

@app.api_route(
    "/v1/widgets/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_widgets(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy widget-related requests to dashboard-service"""
    response_data = await proxy.route_dashboard_request(request, f"/v1/widgets/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Embed Token Management Routes (require auth)
@app.api_route(
    "/api/v1/embed-tokens/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_embed_tokens_with_path(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy embed token management requests to dashboard-service"""
    response_data = await proxy.route_dashboard_request(request, f"/v1/embed-tokens/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

@app.api_route(
    "/api/v1/embed-tokens",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_embed_tokens_root(
    request: Request,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy embed token list requests to dashboard-service"""
    response_data = await proxy.route_dashboard_request(request, f"/v1/embed-tokens")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Support widgets embed-tokens endpoint
@app.api_route(
    "/api/v1/widgets/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_api_widgets(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy widget-related API requests to dashboard-service"""
    response_data = await proxy.route_dashboard_request(request, f"/v1/widgets/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Embedding Routes (publicly accessible for iframe embedding)
@app.api_route(
    "/v1/embed/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_embed(
    request: Request,
    path: str
):
    """Proxy embed-related requests to dashboard-service (no auth required)"""
    response_data = await proxy.route_dashboard_request(request, f"/v1/embed/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

@app.api_route(
    "/api/v1/embed/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_api_embed(
    request: Request,
    path: str
):
    """Proxy embed-related API requests to dashboard-service (no auth required)"""
    response_data = await proxy.route_dashboard_request(request, f"/v1/embed/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Scraping Routes (for visual element selector)
@app.api_route(
    "/api/v1/scrape/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_scraping(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy scraping-related requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/scrape/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

@app.api_route(
    "/api/v1/proxy/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_cors(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy CORS proxy requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/proxy/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# PostgreSQL Routes (for database node operations)
@app.api_route(
    "/api/v1/postgres/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_postgres(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy PostgreSQL-related requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/postgres/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# File Node Routes (for file upload and processing)
@app.api_route(
    "/api/v1/file-node/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_file_node(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy file node requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/file-node/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# AI Processing Routes
@app.api_route(
    "/api/v1/ai/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_ai_processing(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy AI processing requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/ai/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# HTTP Request Routes (for HTTP request testing and execution)
@app.api_route(
    "/api/v1/http-request/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_http_request(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy HTTP request testing requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/http-request/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# ML Training Routes
@app.api_route(
    "/api/v1/ml/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_ml_training(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy ML training requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/ml/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Agents Routes (for workflow execution)
@app.api_route(
    "/api/v1/agents/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_agents(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy agents requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/agents/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Execution Routes (for node executions)
@app.api_route(
    "/api/v1/executions/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_executions_api(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy execution requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/executions/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Data Structuring Routes (for regex and data cleaning)
@app.api_route(
    "/api/v1/data-structuring/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_data_structuring(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy data structuring requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/data-structuring/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Monitoring Routes (for webpage change detection)
@app.api_route(
    "/api/v1/monitoring/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_monitoring(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy monitoring requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/monitoring/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# CSS Selector Routes (for visual element selection)
@app.api_route(
    "/api/v1/css-selector/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_css_selector(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy CSS selector requests to workflow-engine service"""
    response_data = await proxy.route_workflow_request(request, f"/api/v1/css-selector/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

# Builder Service Routes
@app.api_route(
    "/v1/builder/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)
async def proxy_builder(
    request: Request,
    path: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """Proxy builder-related requests to builder-service"""
    response_data = await proxy.route_builder_request(request, f"/v1/builder/{path}")
    
    return Response(
        content=response_data['content'],
        status_code=response_data['status_code'],
        headers={k: v for k, v in response_data['headers'].items() 
                if k.lower() not in ['content-encoding', 'transfer-encoding']}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)