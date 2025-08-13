"""
Workflow Service Client

Client for communicating with the workflow-engine service
"""

import os
import httpx
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)


class WorkflowClient:
    """Client for workflow-engine service communication"""
    
    def __init__(self):
        self.base_url = os.getenv("WORKFLOW_ENGINE_URL", "http://workflow-engine:5000")
        self.timeout = httpx.Timeout(30.0)
    
    async def get_workflow_agent(self, agent_id: int, auth_token: str = None) -> Optional[Dict]:
        """Get workflow agent details"""
        try:
            headers = {}
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"
                
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/v1/workflows/{agent_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return None
                else:
                    logger.error(f"Error fetching workflow agent {agent_id}: {response.status_code}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error communicating with workflow service: {e}")
            return None
    
    async def get_user_workflow_agents(self, user_id: int, auth_token: str = None) -> List[Dict]:
        """Get all workflow agents for a user"""
        try:
            headers = {}
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"
                
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/v1/workflows",
                    params={"user_id": user_id},
                    headers=headers
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get('data', [])
                else:
                    logger.error(f"Error fetching workflow agents for user {user_id}: {response.status_code}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error communicating with workflow service: {e}")
            return []
    
    async def get_node_execution_data(self, agent_id: int, node_id: str, auth_token: str = None) -> Optional[Any]:
        """Get latest execution data for a specific workflow node"""
        try:
            headers = {}
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"
                
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/v1/nodes/{agent_id}/{node_id}/output",
                    headers=headers
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get('data')
                elif response.status_code == 404:
                    return None
                else:
                    logger.error(f"Error fetching node data for {agent_id}/{node_id}: {response.status_code}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error communicating with workflow service: {e}")
            return None