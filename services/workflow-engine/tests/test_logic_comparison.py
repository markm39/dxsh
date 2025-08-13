"""
Test to verify workflow engine logic matches original implementation
"""
import pytest
import sys
import os

# Add parent directories to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

def test_workflow_execution_logic():
    """Test that workflow execution logic is preserved"""
    from src.services.execution_service import ExecutionService
    from unittest.mock import Mock
    
    # Create mock DB session
    mock_db = Mock()
    service = ExecutionService(mock_db)
    
    # Test dependency graph building
    nodes = [
        {'id': 'node1', 'type': 'webSource'},
        {'id': 'node2', 'type': 'aiProcessor'},
        {'id': 'node3', 'type': 'dataProcessor'}
    ]
    edges = [
        {'source': 'node1', 'target': 'node2'},
        {'source': 'node2', 'target': 'node3'}
    ]
    
    deps = service._build_dependency_graph(nodes, edges)
    
    # Verify correct dependency structure
    assert deps == {
        'node1': [],
        'node2': ['node1'], 
        'node3': ['node2']
    }
    
    # Test topological sort
    sorted_nodes = service._topological_sort(nodes, deps)
    assert sorted_nodes is not None
    assert len(sorted_nodes) == 3
    assert sorted_nodes[0]['id'] == 'node1'
    assert sorted_nodes[1]['id'] == 'node2'
    assert sorted_nodes[2]['id'] == 'node3'

def test_circular_dependency_detection():
    """Test that circular dependencies are detected"""
    from src.services.execution_service import ExecutionService
    from unittest.mock import Mock
    
    mock_db = Mock()
    service = ExecutionService(mock_db)
    
    # Create circular dependency
    nodes = [
        {'id': 'node1', 'type': 'webSource'},
        {'id': 'node2', 'type': 'aiProcessor'}
    ]
    edges = [
        {'source': 'node1', 'target': 'node2'},
        {'source': 'node2', 'target': 'node1'}  # Circular!
    ]
    
    deps = service._build_dependency_graph(nodes, edges)
    sorted_nodes = service._topological_sort(nodes, deps)
    
    # Should return None for circular dependency
    assert sorted_nodes is None

def test_node_executor_interface():
    """Test that node executors maintain the same interface"""
    from src.services.node_executors.web_source_executor import WebSourceExecutor
    
    # Test configuration validation
    valid_config = {
        'id': 'test_node',
        'type': 'webSource',
        'data': {
            'url': 'https://example.com',
            'selectors': [
                {'name': 'title', 'selector': 'h1', 'attribute': 'textContent'}
            ]
        }
    }
    
    executor = WebSourceExecutor(valid_config)
    assert executor.validate_config() == True
    
    # Test invalid config
    invalid_config = {
        'id': 'test_node',
        'type': 'webSource',
        'data': {}  # Missing required fields
    }
    
    executor = WebSourceExecutor(invalid_config)
    assert executor.validate_config() == False

def test_selector_processing():
    """Test that selector processing works as expected"""
    from src.services.node_executors.web_source_executor import WebSourceExecutor
    
    config = {
        'id': 'test',
        'type': 'webSource',
        'data': {}
    }
    
    executor = WebSourceExecutor(config)
    
    # Test selector processing
    selectors = [
        {'selector': 'h1', 'attribute': 'textContent'},
        {'name': 'custom', 'selector': '.class', 'type': 'all'},
        {'selector': 'table', 'type': 'table'}
    ]
    
    processed = executor._process_selectors(selectors)
    
    assert len(processed) == 3
    assert processed[0]['name'] == 'h1'  # Default name from selector
    assert processed[1]['name'] == 'custom'  # Custom name preserved
    assert processed[2]['attribute'] == 'table_data'  # Table type handling

def test_workflow_models():
    """Test workflow models structure"""
    from src.models.workflow import AgentWorkflow, WorkflowCreate, WorkflowResponse
    
    # Test model creation
    workflow_data = WorkflowCreate(
        name="Test Workflow",
        nodes=[],
        edges=[],
        agent_id=1
    )
    
    assert workflow_data.name == "Test Workflow"
    assert workflow_data.nodes == []
    assert workflow_data.edges == []

def test_execution_models():
    """Test execution models structure"""
    from src.models.execution import ExecutionCreate, NodeExecutionResponse
    from src.services.execution_service import NodeExecutionResult
    
    # Test execution creation
    exec_data = ExecutionCreate(
        workflow_id=1,
        inputs={'test': 'data'}
    )
    
    assert exec_data.workflow_id == 1
    assert exec_data.inputs == {'test': 'data'}
    
    # Test node execution result
    result = NodeExecutionResult(
        node_id='test_node',
        success=True,
        data={'result': 'data'},
        error=None,
        metadata={'key': 'value'},
        execution_time_ms=100.0
    )
    
    assert result.node_id == 'test_node'
    assert result.success == True
    assert result.data == {'result': 'data'}