"""
Template Manager Module

CRUD operations for workflow templates in the marketplace.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum
import json

logger = logging.getLogger(__name__)


class TemplateCategory(Enum):
    """Template categories for marketplace."""
    DATA_COLLECTION = "data_collection"
    DATA_PROCESSING = "data_processing"
    AI_ML = "ai_ml"
    AUTOMATION = "automation"
    ANALYTICS = "analytics"
    WEB_SCRAPING = "web_scraping"
    API_INTEGRATION = "api_integration"
    REPORTING = "reporting"
    CUSTOM = "custom"


class TemplateManager:
    """
    Manages workflow templates for the marketplace.

    Handles creation, retrieval, update, and deletion of templates.
    """

    def __init__(self, db_session):
        """
        Initialize template manager.

        Args:
            db_session: Database session
        """
        self.db = db_session
        logger.info("Template manager initialized")

    async def create_template(
        self,
        name: str,
        description: str,
        category: TemplateCategory,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        author_id: int,
        tags: Optional[List[str]] = None,
        is_public: bool = True,
        thumbnail_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new template.

        Args:
            name: Template name
            description: Template description
            category: Template category
            nodes: Workflow nodes
            edges: Workflow edges
            author_id: User ID of template author
            tags: Optional tags for searching
            is_public: Whether template is publicly visible
            thumbnail_url: Optional thumbnail image URL
            metadata: Additional metadata

        Returns:
            Created template dict
        """
        try:
            template_id = self._generate_template_id()

            template = {
                'id': template_id,
                'name': name,
                'description': description,
                'category': category.value,
                'nodes': nodes,
                'edges': edges,
                'author_id': author_id,
                'tags': tags or [],
                'is_public': is_public,
                'thumbnail_url': thumbnail_url,
                'metadata': metadata or {},
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
                'downloads': 0,
                'rating': 0.0,
                'rating_count': 0,
                'version': '1.0.0'
            }

            # In a real implementation, save to database
            # For now, just return the template
            logger.info(f"Created template: {name} (ID: {template_id})")

            return template

        except Exception as e:
            logger.error(f"Failed to create template: {e}")
            raise

    async def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a template by ID.

        Args:
            template_id: Template ID

        Returns:
            Template dict or None
        """
        try:
            # In real implementation, fetch from database
            # For now, return None
            logger.info(f"Fetching template: {template_id}")
            return None

        except Exception as e:
            logger.error(f"Failed to get template {template_id}: {e}")
            raise

    async def update_template(
        self,
        template_id: str,
        updates: Dict[str, Any],
        user_id: int
    ) -> bool:
        """
        Update a template.

        Args:
            template_id: Template ID
            updates: Fields to update
            user_id: User ID making the update

        Returns:
            True if updated successfully
        """
        try:
            # Verify ownership
            template = await self.get_template(template_id)

            if not template:
                logger.warning(f"Template {template_id} not found")
                return False

            if template['author_id'] != user_id:
                logger.warning(f"User {user_id} not authorized to update template {template_id}")
                return False

            # Update fields
            allowed_fields = [
                'name', 'description', 'category', 'nodes', 'edges',
                'tags', 'is_public', 'thumbnail_url', 'metadata'
            ]

            for field, value in updates.items():
                if field in allowed_fields:
                    template[field] = value

            template['updated_at'] = datetime.utcnow().isoformat()

            # Increment version
            version_parts = template['version'].split('.')
            version_parts[-1] = str(int(version_parts[-1]) + 1)
            template['version'] = '.'.join(version_parts)

            logger.info(f"Updated template {template_id} to version {template['version']}")
            return True

        except Exception as e:
            logger.error(f"Failed to update template {template_id}: {e}")
            raise

    async def delete_template(self, template_id: str, user_id: int) -> bool:
        """
        Delete a template.

        Args:
            template_id: Template ID
            user_id: User ID requesting deletion

        Returns:
            True if deleted successfully
        """
        try:
            # Verify ownership
            template = await self.get_template(template_id)

            if not template:
                logger.warning(f"Template {template_id} not found")
                return False

            if template['author_id'] != user_id:
                logger.warning(f"User {user_id} not authorized to delete template {template_id}")
                return False

            # In real implementation, delete from database
            logger.info(f"Deleted template: {template_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete template {template_id}: {e}")
            raise

    async def list_templates(
        self,
        category: Optional[TemplateCategory] = None,
        tags: Optional[List[str]] = None,
        author_id: Optional[int] = None,
        is_public: bool = True,
        limit: int = 50,
        offset: int = 0,
        sort_by: str = 'created_at',
        sort_order: str = 'desc'
    ) -> List[Dict[str, Any]]:
        """
        List templates with filtering and pagination.

        Args:
            category: Filter by category
            tags: Filter by tags
            author_id: Filter by author
            is_public: Filter by visibility
            limit: Results per page
            offset: Pagination offset
            sort_by: Field to sort by
            sort_order: Sort order (asc/desc)

        Returns:
            List of templates
        """
        try:
            # In real implementation, query database with filters
            # For now, return empty list
            logger.info(
                f"Listing templates - category: {category}, "
                f"tags: {tags}, limit: {limit}, offset: {offset}"
            )

            return []

        except Exception as e:
            logger.error(f"Failed to list templates: {e}")
            raise

    async def search_templates(
        self,
        query: str,
        category: Optional[TemplateCategory] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search templates by name and description.

        Args:
            query: Search query
            category: Optional category filter
            limit: Maximum results

        Returns:
            List of matching templates
        """
        try:
            # In real implementation, perform full-text search
            logger.info(f"Searching templates: {query}")
            return []

        except Exception as e:
            logger.error(f"Failed to search templates: {e}")
            raise

    async def install_template(
        self,
        template_id: str,
        user_id: int,
        workflow_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Install a template as a new workflow for a user.

        Args:
            template_id: Template ID
            user_id: User ID installing the template
            workflow_name: Optional custom workflow name

        Returns:
            Created workflow dict
        """
        try:
            template = await self.get_template(template_id)

            if not template:
                raise ValueError(f"Template {template_id} not found")

            # Create workflow from template
            workflow = {
                'name': workflow_name or template['name'],
                'description': f"Created from template: {template['name']}",
                'nodes': template['nodes'],
                'edges': template['edges'],
                'user_id': user_id,
                'template_id': template_id,
                'created_at': datetime.utcnow().isoformat()
            }

            # Increment download count
            await self._increment_downloads(template_id)

            logger.info(
                f"User {user_id} installed template {template_id} as workflow"
            )

            return workflow

        except Exception as e:
            logger.error(f"Failed to install template {template_id}: {e}")
            raise

    async def rate_template(
        self,
        template_id: str,
        user_id: int,
        rating: float
    ) -> bool:
        """
        Rate a template.

        Args:
            template_id: Template ID
            user_id: User ID providing rating
            rating: Rating value (1-5)

        Returns:
            True if rating saved successfully
        """
        try:
            if not 1 <= rating <= 5:
                raise ValueError("Rating must be between 1 and 5")

            template = await self.get_template(template_id)

            if not template:
                logger.warning(f"Template {template_id} not found")
                return False

            # Update rating
            current_total = template['rating'] * template['rating_count']
            new_count = template['rating_count'] + 1
            new_rating = (current_total + rating) / new_count

            template['rating'] = round(new_rating, 2)
            template['rating_count'] = new_count

            logger.info(
                f"User {user_id} rated template {template_id}: {rating}/5 "
                f"(avg: {template['rating']})"
            )

            return True

        except Exception as e:
            logger.error(f"Failed to rate template {template_id}: {e}")
            raise

    async def get_popular_templates(
        self,
        limit: int = 10,
        category: Optional[TemplateCategory] = None
    ) -> List[Dict[str, Any]]:
        """
        Get popular templates sorted by downloads and rating.

        Args:
            limit: Maximum results
            category: Optional category filter

        Returns:
            List of popular templates
        """
        try:
            # In real implementation, query with sorting
            logger.info(f"Getting popular templates - limit: {limit}, category: {category}")
            return []

        except Exception as e:
            logger.error(f"Failed to get popular templates: {e}")
            raise

    async def get_user_templates(
        self,
        user_id: int,
        include_private: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get templates created by a user.

        Args:
            user_id: User ID
            include_private: Whether to include private templates

        Returns:
            List of user's templates
        """
        try:
            logger.info(f"Getting templates for user {user_id}")
            return []

        except Exception as e:
            logger.error(f"Failed to get user templates: {e}")
            raise

    async def _increment_downloads(self, template_id: str):
        """Increment download count for a template."""
        template = await self.get_template(template_id)
        if template:
            template['downloads'] += 1

    def _generate_template_id(self) -> str:
        """Generate a unique template ID."""
        import uuid
        return f"tpl_{uuid.uuid4().hex[:12]}"

    async def export_template(self, template_id: str) -> str:
        """
        Export template as JSON string.

        Args:
            template_id: Template ID

        Returns:
            JSON string of template
        """
        try:
            template = await self.get_template(template_id)

            if not template:
                raise ValueError(f"Template {template_id} not found")

            return json.dumps(template, indent=2)

        except Exception as e:
            logger.error(f"Failed to export template {template_id}: {e}")
            raise

    async def import_template(
        self,
        template_json: str,
        author_id: int
    ) -> Dict[str, Any]:
        """
        Import template from JSON.

        Args:
            template_json: JSON string of template
            author_id: User ID importing the template

        Returns:
            Imported template dict
        """
        try:
            template_data = json.loads(template_json)

            # Create new template with imported data
            return await self.create_template(
                name=template_data.get('name', 'Imported Template'),
                description=template_data.get('description', ''),
                category=TemplateCategory(template_data.get('category', 'custom')),
                nodes=template_data.get('nodes', []),
                edges=template_data.get('edges', []),
                author_id=author_id,
                tags=template_data.get('tags', []),
                is_public=template_data.get('is_public', False),
                metadata=template_data.get('metadata', {})
            )

        except Exception as e:
            logger.error(f"Failed to import template: {e}")
            raise
