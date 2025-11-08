"""
Template Marketplace API Routes

API endpoints for template management and marketplace.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/templates", tags=["templates"])


class CreateTemplateRequest(BaseModel):
    """Request model for creating a template."""
    name: str
    description: str
    category: str
    nodes: List[dict]
    edges: List[dict]
    tags: Optional[List[str]] = []
    is_public: bool = True
    thumbnail_url: Optional[str] = None


class UpdateTemplateRequest(BaseModel):
    """Request model for updating a template."""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    nodes: Optional[List[dict]] = None
    edges: Optional[List[dict]] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    thumbnail_url: Optional[str] = None


class RateTemplateRequest(BaseModel):
    """Request model for rating a template."""
    rating: float


@router.post("/", response_model=dict)
async def create_template(request: CreateTemplateRequest):
    """
    Create a new workflow template.

    Args:
        request: Template creation data

    Returns:
        Created template
    """
    try:
        # In real implementation, use TemplateManager
        logger.info(f"Creating template: {request.name}")

        return {
            "id": "tpl_123",
            "name": request.name,
            "description": request.description,
            "category": request.category,
            "nodes": request.nodes,
            "edges": request.edges,
            "tags": request.tags,
            "is_public": request.is_public
        }

    except Exception as e:
        logger.error(f"Failed to create template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[dict])
async def list_templates(
    category: Optional[str] = None,
    tags: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """
    List templates with filtering and pagination.

    Args:
        category: Filter by category
        tags: Comma-separated tags
        limit: Results per page
        offset: Pagination offset

    Returns:
        List of templates
    """
    try:
        logger.info(f"Listing templates - category: {category}, limit: {limit}")

        # In real implementation, query database
        return []

    except Exception as e:
        logger.error(f"Failed to list templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{template_id}", response_model=dict)
async def get_template(template_id: str):
    """
    Get a template by ID.

    Args:
        template_id: Template ID

    Returns:
        Template data
    """
    try:
        logger.info(f"Getting template: {template_id}")

        # In real implementation, fetch from database
        raise HTTPException(status_code=404, detail="Template not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{template_id}", response_model=dict)
async def update_template(template_id: str, request: UpdateTemplateRequest):
    """
    Update a template.

    Args:
        template_id: Template ID
        request: Update data

    Returns:
        Updated template
    """
    try:
        logger.info(f"Updating template: {template_id}")

        # In real implementation, update in database
        return {"id": template_id, "updated": True}

    except Exception as e:
        logger.error(f"Failed to update template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    """
    Delete a template.

    Args:
        template_id: Template ID

    Returns:
        Success message
    """
    try:
        logger.info(f"Deleting template: {template_id}")

        # In real implementation, delete from database
        return {"message": "Template deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{template_id}/install", response_model=dict)
async def install_template(template_id: str, workflow_name: Optional[str] = None):
    """
    Install a template as a new workflow.

    Args:
        template_id: Template ID
        workflow_name: Optional custom workflow name

    Returns:
        Created workflow
    """
    try:
        logger.info(f"Installing template: {template_id}")

        # In real implementation, create workflow from template
        return {
            "workflow_id": "wf_123",
            "template_id": template_id,
            "name": workflow_name or "New Workflow"
        }

    except Exception as e:
        logger.error(f"Failed to install template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{template_id}/rate", response_model=dict)
async def rate_template(template_id: str, request: RateTemplateRequest):
    """
    Rate a template.

    Args:
        template_id: Template ID
        request: Rating data

    Returns:
        Updated rating info
    """
    try:
        if not 1 <= request.rating <= 5:
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

        logger.info(f"Rating template {template_id}: {request.rating}")

        # In real implementation, save rating to database
        return {
            "template_id": template_id,
            "rating": request.rating,
            "average_rating": 4.5
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to rate template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/{query}", response_model=List[dict])
async def search_templates(query: str, limit: int = 20):
    """
    Search templates by name and description.

    Args:
        query: Search query
        limit: Maximum results

    Returns:
        List of matching templates
    """
    try:
        logger.info(f"Searching templates: {query}")

        # In real implementation, perform full-text search
        return []

    except Exception as e:
        logger.error(f"Failed to search templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/popular", response_model=List[dict])
async def get_popular_templates(limit: int = 10):
    """
    Get popular templates.

    Args:
        limit: Maximum results

    Returns:
        List of popular templates
    """
    try:
        logger.info(f"Getting popular templates - limit: {limit}")

        # In real implementation, query sorted by downloads/rating
        return []

    except Exception as e:
        logger.error(f"Failed to get popular templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))
