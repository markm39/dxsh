import httpx
import os
from fastapi import Request, HTTPException
from typing import Dict, Any
import json

class ServiceProxy:
    def __init__(self):
        # Use WORKFLOW_ENGINE_BACKEND_URL for actual service location, fallback to WORKFLOW_ENGINE_URL for compatibility
        self.workflow_engine_url = os.environ.get('WORKFLOW_ENGINE_BACKEND_URL', 
                                                  os.environ.get('WORKFLOW_ENGINE_URL', 'http://workflow-engine:5000'))
        self.dashboard_service_url = os.environ.get('DASHBOARD_SERVICE_URL', 'http://dashboard-service:5000')
        self.workflow_frontend_url = os.environ.get('WORKFLOW_FRONTEND_URL', 'http://workflow-frontend:3000')
        
    async def forward_request(
        self,
        service_url: str,
        path: str,
        method: str,
        headers: Dict[str, str],
        body: bytes = None,
        params: Dict[str, Any] = None
    ):
        """Forward a request to the appropriate microservice"""
        if service_url == 'disabled':
            raise HTTPException(status_code=503, detail="Service disabled in this deployment mode")
            
        url = f"{service_url}{path}"
        
        # Filter out hop-by-hop headers
        filtered_headers = {
            k: v for k, v in headers.items() 
            if k.lower() not in ['host', 'content-length', 'connection', 'upgrade']
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=filtered_headers,
                    content=body,
                    params=params,
                    timeout=30.0
                )
                
                return {
                    'status_code': response.status_code,
                    'headers': dict(response.headers),
                    'content': response.content
                }
                
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"Service unavailable: {str(e)}")
            except httpx.TimeoutException:
                raise HTTPException(status_code=504, detail="Service timeout")
    
    async def route_workflow_request(self, request: Request, path: str):
        """Route workflow-related requests to workflow-engine service"""
        body = await request.body() if request.method in ['POST', 'PUT', 'PATCH'] else None
        
        return await self.forward_request(
            service_url=self.workflow_engine_url,
            path=path,
            method=request.method,
            headers=dict(request.headers),
            body=body,
            params=dict(request.query_params)
        )
    
    async def route_dashboard_request(self, request: Request, path: str):
        """Route dashboard-related requests to dashboard-service"""
        body = await request.body() if request.method in ['POST', 'PUT', 'PATCH'] else None
        
        return await self.forward_request(
            service_url=self.dashboard_service_url,
            path=path,
            method=request.method,
            headers=dict(request.headers),
            body=body,
            params=dict(request.query_params)
        )
    
    async def route_builder_request(self, request: Request, path: str):
        """Route builder-related requests to builder-service"""
        body = await request.body() if request.method in ['POST', 'PUT', 'PATCH'] else None
        
        return await self.forward_request(
            service_url=self.workflow_frontend_url,
            path=path,
            method=request.method,
            headers=dict(request.headers),
            body=body,
            params=dict(request.query_params)
        )