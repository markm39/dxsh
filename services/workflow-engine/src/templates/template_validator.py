"""
Template Validator Module

Validates template structure and ensures compatibility.
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class TemplateValidator:
    """
    Validates workflow templates for correctness and compatibility.

    Ensures templates meet required structure and don't contain errors.
    """

    def __init__(self):
        """Initialize template validator."""
        # Required fields for templates
        self.required_template_fields = [
            'name', 'description', 'category', 'nodes', 'edges'
        ]

        # Required fields for nodes
        self.required_node_fields = ['id', 'type']

        # Required fields for edges
        self.required_edge_fields = ['source', 'target']

        # Valid node types
        self.valid_node_types = [
            'webSource', 'aiProcessor', 'httpRequest', 'fileNode',
            'dataStructuring', 'chartGenerator', 'linearRegression',
            'postgres', 'randomForest'
        ]

        logger.info("Template validator initialized")

    async def validate_template(
        self,
        template: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate a complete template.

        Args:
            template: Template dict to validate

        Returns:
            Validation result with is_valid and errors
        """
        errors = []
        warnings = []

        # Check required fields
        for field in self.required_template_fields:
            if field not in template:
                errors.append(f"Missing required field: {field}")

        if errors:
            return {
                'is_valid': False,
                'errors': errors,
                'warnings': warnings
            }

        # Validate nodes
        node_validation = await self.validate_nodes(template.get('nodes', []))
        errors.extend(node_validation['errors'])
        warnings.extend(node_validation['warnings'])

        # Validate edges
        edge_validation = await self.validate_edges(
            template.get('edges', []),
            template.get('nodes', [])
        )
        errors.extend(edge_validation['errors'])
        warnings.extend(edge_validation['warnings'])

        # Validate graph structure
        graph_validation = await self.validate_graph_structure(
            template.get('nodes', []),
            template.get('edges', [])
        )
        errors.extend(graph_validation['errors'])
        warnings.extend(graph_validation['warnings'])

        # Validate metadata
        if 'metadata' in template and template['metadata']:
            metadata_validation = await self.validate_metadata(template['metadata'])
            warnings.extend(metadata_validation['warnings'])

        is_valid = len(errors) == 0

        logger.info(
            f"Template validation: {'passed' if is_valid else 'failed'} "
            f"({len(errors)} errors, {len(warnings)} warnings)"
        )

        return {
            'is_valid': is_valid,
            'errors': errors,
            'warnings': warnings
        }

    async def validate_nodes(self, nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validate workflow nodes.

        Args:
            nodes: List of node dicts

        Returns:
            Validation result
        """
        errors = []
        warnings = []

        if not nodes:
            warnings.append("Template has no nodes")
            return {'errors': errors, 'warnings': warnings}

        node_ids = set()

        for i, node in enumerate(nodes):
            # Check required fields
            for field in self.required_node_fields:
                if field not in node:
                    errors.append(f"Node {i}: Missing required field '{field}'")

            # Check node ID uniqueness
            node_id = node.get('id')
            if node_id:
                if node_id in node_ids:
                    errors.append(f"Node {i}: Duplicate node ID '{node_id}'")
                node_ids.add(node_id)

            # Check node type
            node_type = node.get('type')
            if node_type and node_type not in self.valid_node_types:
                warnings.append(
                    f"Node {node_id or i}: Unknown node type '{node_type}'"
                )

            # Check for data field
            if 'data' not in node:
                warnings.append(f"Node {node_id or i}: No data field")

        return {'errors': errors, 'warnings': warnings}

    async def validate_edges(
        self,
        edges: List[Dict[str, Any]],
        nodes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate workflow edges.

        Args:
            edges: List of edge dicts
            nodes: List of node dicts

        Returns:
            Validation result
        """
        errors = []
        warnings = []

        node_ids = {node['id'] for node in nodes if 'id' in node}

        for i, edge in enumerate(edges):
            # Check required fields
            for field in self.required_edge_fields:
                if field not in edge:
                    errors.append(f"Edge {i}: Missing required field '{field}'")

            # Check source and target exist
            source = edge.get('source')
            target = edge.get('target')

            if source and source not in node_ids:
                errors.append(f"Edge {i}: Source node '{source}' does not exist")

            if target and target not in node_ids:
                errors.append(f"Edge {i}: Target node '{target}' does not exist")

            # Check for self-loops
            if source and target and source == target:
                warnings.append(f"Edge {i}: Self-loop detected ({source} -> {target})")

        return {'errors': errors, 'warnings': warnings}

    async def validate_graph_structure(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate graph structure (cycles, connectivity).

        Args:
            nodes: List of node dicts
            edges: List of edge dicts

        Returns:
            Validation result
        """
        errors = []
        warnings = []

        if not nodes:
            return {'errors': errors, 'warnings': warnings}

        # Build adjacency list
        adj_list = {node['id']: [] for node in nodes if 'id' in node}

        for edge in edges:
            source = edge.get('source')
            target = edge.get('target')

            if source in adj_list and target:
                adj_list[source].append(target)

        # Check for cycles using DFS
        visited = set()
        rec_stack = set()

        def has_cycle(node_id: str) -> bool:
            visited.add(node_id)
            rec_stack.add(node_id)

            for neighbor in adj_list.get(node_id, []):
                if neighbor not in visited:
                    if has_cycle(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True

            rec_stack.remove(node_id)
            return False

        for node in nodes:
            node_id = node.get('id')
            if node_id and node_id not in visited:
                if has_cycle(node_id):
                    errors.append(f"Circular dependency detected involving node '{node_id}'")
                    break

        # Check connectivity (warn about isolated components)
        all_nodes = set(node['id'] for node in nodes if 'id' in node)
        connected_nodes = set()

        def dfs(node_id: str):
            if node_id in connected_nodes:
                return
            connected_nodes.add(node_id)

            # Forward edges
            for neighbor in adj_list.get(node_id, []):
                dfs(neighbor)

            # Backward edges
            for other_node in adj_list:
                if node_id in adj_list[other_node]:
                    dfs(other_node)

        if all_nodes:
            first_node = next(iter(all_nodes))
            dfs(first_node)

            isolated = all_nodes - connected_nodes
            if isolated and len(all_nodes) > 1:
                warnings.append(
                    f"Isolated nodes detected: {', '.join(isolated)}"
                )

        return {'errors': errors, 'warnings': warnings}

    async def validate_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate template metadata.

        Args:
            metadata: Metadata dict

        Returns:
            Validation result
        """
        warnings = []

        # Check for recommended metadata fields
        recommended_fields = ['author', 'version', 'tags', 'description']

        for field in recommended_fields:
            if field not in metadata:
                warnings.append(f"Recommended metadata field '{field}' is missing")

        return {'errors': [], 'warnings': warnings}

    async def validate_node_data(
        self,
        node_type: str,
        node_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate node-specific data based on node type.

        Args:
            node_type: Type of node
            node_data: Node data dict

        Returns:
            Validation result
        """
        errors = []
        warnings = []

        # Type-specific validation
        if node_type == 'webSource':
            if 'url' not in node_data:
                errors.append("webSource node missing 'url' field")

        elif node_type == 'httpRequest':
            if 'url' not in node_data:
                errors.append("httpRequest node missing 'url' field")
            if 'method' not in node_data:
                warnings.append("httpRequest node missing 'method' field")

        elif node_type == 'postgres':
            if 'query' not in node_data:
                errors.append("postgres node missing 'query' field")

        elif node_type == 'aiProcessor':
            if 'prompt' not in node_data and 'promptTemplate' not in node_data:
                errors.append("aiProcessor node missing 'prompt' or 'promptTemplate' field")

        return {'errors': errors, 'warnings': warnings}

    async def check_compatibility(
        self,
        template: Dict[str, Any],
        target_version: str = "1.0.0"
    ) -> Dict[str, Any]:
        """
        Check template compatibility with a platform version.

        Args:
            template: Template dict
            target_version: Target platform version

        Returns:
            Compatibility result
        """
        warnings = []
        compatible = True

        template_version = template.get('version', '1.0.0')

        # Simple version comparison (in real implementation, use semantic versioning)
        if template_version != target_version:
            warnings.append(
                f"Template version {template_version} may not be fully compatible "
                f"with platform version {target_version}"
            )

        # Check for deprecated node types
        deprecated_types = []  # Add deprecated types here

        for node in template.get('nodes', []):
            if node.get('type') in deprecated_types:
                warnings.append(
                    f"Node type '{node.get('type')}' is deprecated"
                )

        return {
            'compatible': compatible,
            'warnings': warnings
        }

    async def sanitize_template(
        self,
        template: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Sanitize template by removing invalid or dangerous content.

        Args:
            template: Template dict

        Returns:
            Sanitized template
        """
        sanitized = template.copy()

        # Remove potentially dangerous fields
        dangerous_fields = ['__proto__', 'constructor', 'prototype']

        def remove_dangerous_fields(obj):
            if isinstance(obj, dict):
                for field in dangerous_fields:
                    obj.pop(field, None)

                for value in obj.values():
                    remove_dangerous_fields(value)

            elif isinstance(obj, list):
                for item in obj:
                    remove_dangerous_fields(item)

        remove_dangerous_fields(sanitized)

        logger.info("Sanitized template")
        return sanitized
