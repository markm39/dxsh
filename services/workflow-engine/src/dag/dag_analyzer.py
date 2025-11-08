"""
DAG Analyzer Module

Analyzes workflow graphs to identify parallel execution opportunities.
"""

import logging
from typing import List, Dict, Any, Set, Tuple, Optional
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class DAGAnalyzer:
    """
    Analyzes directed acyclic graphs to optimize execution.

    Identifies independent nodes, critical paths, and execution levels.
    """

    def __init__(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]):
        """
        Initialize DAG analyzer.

        Args:
            nodes: List of workflow nodes
            edges: List of workflow edges
        """
        self.nodes = nodes
        self.edges = edges
        self.node_map = {node['id']: node for node in nodes}
        self.adjacency_list = self._build_adjacency_list()
        self.reverse_adjacency_list = self._build_reverse_adjacency_list()

    def _build_adjacency_list(self) -> Dict[str, List[str]]:
        """
        Build adjacency list from edges (node -> dependencies).

        Returns:
            Dict mapping node_id to list of nodes it depends on
        """
        adj_list = defaultdict(list)

        for edge in self.edges:
            source = edge.get('source')
            target = edge.get('target')

            if source and target:
                adj_list[target].append(source)

        return dict(adj_list)

    def _build_reverse_adjacency_list(self) -> Dict[str, List[str]]:
        """
        Build reverse adjacency list (node -> dependents).

        Returns:
            Dict mapping node_id to list of nodes that depend on it
        """
        reverse_adj = defaultdict(list)

        for edge in self.edges:
            source = edge.get('source')
            target = edge.get('target')

            if source and target:
                reverse_adj[source].append(target)

        return dict(reverse_adj)

    def detect_cycles(self) -> Optional[List[str]]:
        """
        Detect cycles in the DAG using DFS.

        Returns:
            List of node IDs forming a cycle, or None if no cycle
        """
        visited = set()
        rec_stack = set()
        parent = {}

        def dfs(node_id: str) -> Optional[List[str]]:
            visited.add(node_id)
            rec_stack.add(node_id)

            # Visit all dependencies
            for dep in self.adjacency_list.get(node_id, []):
                if dep not in visited:
                    parent[dep] = node_id
                    cycle = dfs(dep)
                    if cycle:
                        return cycle
                elif dep in rec_stack:
                    # Found a cycle - reconstruct it
                    cycle = [dep]
                    current = node_id
                    while current != dep:
                        cycle.append(current)
                        current = parent.get(current)
                    cycle.append(dep)
                    return cycle

            rec_stack.remove(node_id)
            return None

        # Check all nodes
        for node in self.nodes:
            node_id = node['id']
            if node_id not in visited:
                cycle = dfs(node_id)
                if cycle:
                    logger.warning(f"Cycle detected: {' -> '.join(reversed(cycle))}")
                    return cycle

        return None

    def get_execution_levels(self) -> List[List[str]]:
        """
        Group nodes into execution levels for parallel processing.

        Nodes at the same level can be executed in parallel.

        Returns:
            List of levels, where each level is a list of node IDs
        """
        # Calculate in-degree for each node
        in_degree = {}
        for node in self.nodes:
            node_id = node['id']
            in_degree[node_id] = len(self.adjacency_list.get(node_id, []))

        # Nodes with no dependencies are at level 0
        levels = []
        current_level = [
            node_id for node_id, degree in in_degree.items() if degree == 0
        ]

        processed = set()

        while current_level:
            levels.append(current_level)
            processed.update(current_level)

            next_level = []

            # Find nodes whose dependencies are all processed
            for node_id in self.node_map.keys():
                if node_id in processed:
                    continue

                dependencies = self.adjacency_list.get(node_id, [])
                if all(dep in processed for dep in dependencies):
                    next_level.append(node_id)

            current_level = next_level

        logger.info(f"Identified {len(levels)} execution levels")
        return levels

    def find_critical_path(self) -> Tuple[List[str], float]:
        """
        Find the critical path (longest path) through the DAG.

        Returns:
            Tuple of (critical_path_nodes, estimated_duration)
        """
        # Estimate execution time for each node (use metadata or default)
        node_times = {}
        for node in self.nodes:
            node_id = node['id']
            # Use estimated time from node metadata or default to 1.0
            node_times[node_id] = node.get('metadata', {}).get('estimated_time', 1.0)

        # Calculate longest path to each node using topological sort
        longest_path = {}
        predecessors = {}

        # Initialize
        for node_id in self.node_map.keys():
            longest_path[node_id] = node_times[node_id]
            predecessors[node_id] = None

        # Process nodes in topological order
        levels = self.get_execution_levels()
        for level in levels:
            for node_id in level:
                # Check all dependents
                for dependent in self.reverse_adjacency_list.get(node_id, []):
                    new_path_length = longest_path[node_id] + node_times[dependent]

                    if new_path_length > longest_path[dependent]:
                        longest_path[dependent] = new_path_length
                        predecessors[dependent] = node_id

        # Find node with longest path
        end_node = max(longest_path.items(), key=lambda x: x[1])
        critical_duration = end_node[1]

        # Reconstruct critical path
        critical_path = []
        current = end_node[0]

        while current is not None:
            critical_path.append(current)
            current = predecessors[current]

        critical_path.reverse()

        logger.info(
            f"Critical path: {' -> '.join(critical_path)} "
            f"(duration: {critical_duration:.2f})"
        )

        return critical_path, critical_duration

    def get_independent_subgraphs(self) -> List[List[str]]:
        """
        Identify independent subgraphs that can run in parallel.

        Returns:
            List of subgraphs, where each subgraph is a list of node IDs
        """
        visited = set()
        subgraphs = []

        def dfs_collect(node_id: str, component: Set[str]):
            """Collect all connected nodes."""
            if node_id in visited:
                return

            visited.add(node_id)
            component.add(node_id)

            # Visit dependencies
            for dep in self.adjacency_list.get(node_id, []):
                dfs_collect(dep, component)

            # Visit dependents
            for dependent in self.reverse_adjacency_list.get(node_id, []):
                dfs_collect(dependent, component)

        # Find all connected components
        for node in self.nodes:
            node_id = node['id']
            if node_id not in visited:
                component = set()
                dfs_collect(node_id, component)
                subgraphs.append(list(component))

        logger.info(f"Found {len(subgraphs)} independent subgraphs")
        return subgraphs

    def analyze_parallelism(self) -> Dict[str, Any]:
        """
        Comprehensive parallelism analysis.

        Returns:
            Dict with parallelism metrics and opportunities
        """
        levels = self.get_execution_levels()
        critical_path, critical_duration = self.find_critical_path()
        subgraphs = self.get_independent_subgraphs()

        # Calculate parallelism metrics
        max_parallelism = max(len(level) for level in levels) if levels else 0
        avg_parallelism = sum(len(level) for level in levels) / len(levels) if levels else 0

        # Estimate speedup with parallel execution
        total_nodes = len(self.nodes)
        sequential_time = total_nodes  # Assuming unit time per node
        parallel_time = critical_duration

        theoretical_speedup = sequential_time / parallel_time if parallel_time > 0 else 1.0

        analysis = {
            'total_nodes': total_nodes,
            'execution_levels': len(levels),
            'max_parallelism': max_parallelism,
            'avg_parallelism': avg_parallelism,
            'critical_path_length': len(critical_path),
            'critical_path_duration': critical_duration,
            'critical_path_nodes': critical_path,
            'independent_subgraphs': len(subgraphs),
            'theoretical_speedup': theoretical_speedup,
            'parallelism_efficiency': (avg_parallelism / max_parallelism * 100) if max_parallelism > 0 else 0
        }

        logger.info(
            f"Parallelism analysis: {max_parallelism} max parallel nodes, "
            f"{theoretical_speedup:.2f}x theoretical speedup"
        )

        return analysis

    def get_node_dependencies(self, node_id: str) -> Set[str]:
        """
        Get all dependencies (direct and transitive) for a node.

        Args:
            node_id: Node ID

        Returns:
            Set of all node IDs that must execute before this node
        """
        dependencies = set()

        def collect_deps(current_id: str):
            for dep in self.adjacency_list.get(current_id, []):
                if dep not in dependencies:
                    dependencies.add(dep)
                    collect_deps(dep)

        collect_deps(node_id)
        return dependencies

    def get_node_dependents(self, node_id: str) -> Set[str]:
        """
        Get all dependents (direct and transitive) for a node.

        Args:
            node_id: Node ID

        Returns:
            Set of all node IDs that depend on this node
        """
        dependents = set()

        def collect_dependents(current_id: str):
            for dependent in self.reverse_adjacency_list.get(current_id, []):
                if dependent not in dependents:
                    dependents.add(dependent)
                    collect_dependents(dependent)

        collect_dependents(node_id)
        return dependents

    def validate_dag(self) -> Dict[str, Any]:
        """
        Validate the DAG structure.

        Returns:
            Dict with validation results
        """
        issues = []

        # Check for cycles
        cycle = self.detect_cycles()
        if cycle:
            issues.append({
                'type': 'cycle',
                'severity': 'error',
                'message': f"Circular dependency detected: {' -> '.join(cycle)}"
            })

        # Check for orphaned nodes
        for node in self.nodes:
            node_id = node['id']
            has_incoming = node_id in self.adjacency_list and self.adjacency_list[node_id]
            has_outgoing = node_id in self.reverse_adjacency_list and self.reverse_adjacency_list[node_id]

            if not has_incoming and not has_outgoing and len(self.nodes) > 1:
                issues.append({
                    'type': 'orphaned_node',
                    'severity': 'warning',
                    'node_id': node_id,
                    'message': f"Node {node_id} has no connections"
                })

        is_valid = not any(issue['severity'] == 'error' for issue in issues)

        return {
            'is_valid': is_valid,
            'issues': issues,
            'node_count': len(self.nodes),
            'edge_count': len(self.edges)
        }
