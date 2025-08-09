from flask import request, jsonify
from app.api import api_bp
from app.models.execution import WorkflowExecution, NodeExecution
from app.models.agent import WorkflowAgent
from app.auth import auth_required, get_current_user
from app import db
from datetime import datetime
import logging
import asyncio
from app.executors.web_source_executor import WebSourceExecutor

logger = logging.getLogger(__name__)


@api_bp.route('/agents/<int:agent_id>/executions', methods=['GET'])
@auth_required
def get_agent_executions(agent_id):
    """Get execution history for a specific agent"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify agent ownership
        agent = WorkflowAgent.query.filter_by(created_by=str(user.user_id)).first()
        
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        # Get executions ordered by most recent first
        executions = WorkflowExecution.query.filter_by(
            agent_id=agent_id,
            user_id=user.user_id
        ).order_by(WorkflowExecution.started_at.desc()).limit(20).all()
        
        return jsonify({
            'success': True,
            'executions': [execution.to_dict() for execution in executions]
        })
        
    except Exception as e:
        logger.error(f"Error getting agent executions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/agents/<int:agent_id>/executions', methods=['POST'])
@auth_required
def create_execution(agent_id):
    """Create a new workflow execution"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify agent ownership
        agent = WorkflowAgent.query.filter_by(created_by=str(user.user_id)).first()
        
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        data = request.get_json()
        
        # Create execution record
        execution = WorkflowExecution(
            agent_id=agent_id,
            user_id=user.user_id,
            workflow_nodes=data.get('workflow_nodes', []),
            workflow_edges=data.get('workflow_edges', []),
            status='running'
        )
        
        db.session.add(execution)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'execution': execution.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Error creating execution: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/executions/<int:execution_id>/nodes', methods=['POST'])
@auth_required
def create_node_execution(execution_id):
    """Create a node execution record"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify execution ownership
        execution = WorkflowExecution.query.filter_by(
            id=execution_id,
            user_id=user.user_id
        ).first()
        
        if not execution:
            return jsonify({'success': False, 'error': 'Execution not found'}), 404
        
        data = request.get_json()
        
        # Create node execution record
        node_execution = NodeExecution(
            execution_id=execution_id,
            node_id=data['node_id'],
            node_type=data['node_type'],
            input_config=data.get('input_config'),
            status='running'
        )
        
        # Set node-specific data in JSONB field
        node_specific_data = {}
        if data['node_type'] == 'webSource':
            node_specific_data = {
                'url': data.get('url'),
                'selectors': data.get('selectors'),
                'loop_config': data.get('loopConfig')
            }
        elif data['node_type'] == 'aiProcessor':
            node_specific_data = {
                'ai_prompt': data.get('ai_prompt'),
                'ai_model': data.get('ai_model', 'gpt-4o-mini')
            }
        elif data['node_type'] == 'linearRegression':
            node_specific_data = {
                'model_type': data.get('model_type', 'linear_regression'),
                'model_name': data.get('model_name'),
                'user_instructions': data.get('user_instructions'),
                'training_config': data.get('training_config')
            }
        elif data['node_type'] == 'httpRequest':
            node_specific_data = {
                'method': data.get('method', 'GET'),
                'url': data.get('url'),
                'auth_type': data.get('auth_type')
            }
        
        # Remove None values to keep JSONB clean
        node_specific_data = {k: v for k, v in node_specific_data.items() if v is not None}
        node_execution.node_specific_data = node_specific_data if node_specific_data else None
        
        db.session.add(node_execution)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'node_execution': node_execution.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Error creating node execution: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/executions/nodes/<int:node_execution_id>', methods=['PUT'])
@auth_required
def update_node_execution(node_execution_id):
    """Update a node execution with results"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify ownership through execution
        node_execution = NodeExecution.query.join(WorkflowExecution).filter(
            NodeExecution.id == node_execution_id,
            WorkflowExecution.user_id == user.user_id
        ).first()
        
        if not node_execution:
            return jsonify({'success': False, 'error': 'Node execution not found'}), 404
        
        data = request.get_json()
        
        # Update execution results
        node_execution.completed_at = datetime.utcnow()
        node_execution.status = data.get('status', 'completed')
        node_execution.error_message = data.get('error_message')
        node_execution.output_data = data.get('output_data')
        
        # Update node-specific results in JSONB field
        current_data = node_execution.node_specific_data or {}
        
        if node_execution.node_type == 'webSource':
            current_data['extracted_data'] = data.get('extracted_data')
        elif node_execution.node_type == 'aiProcessor':
            current_data['ai_output'] = data.get('ai_output')
            current_data['ai_tokens_used'] = data.get('ai_tokens_used')
        elif node_execution.node_type == 'linearRegression':
            # Parse ML results from output_data if it contains model training results
            output_data = data.get('output_data', {})
            if isinstance(output_data, dict):
                current_data['model_metrics'] = output_data.get('metrics')
                current_data['model_features'] = output_data.get('features')
                current_data['model_coefficients'] = output_data.get('coefficients')
                current_data['preprocessing_notes'] = output_data.get('preprocessing_notes')
            current_data['ai_tokens_used'] = data.get('ai_tokens_used')
        elif node_execution.node_type == 'httpRequest':
            # Update HTTP-specific results
            current_data['status_code'] = data.get('status_code')
            current_data['response_time'] = data.get('response_time')
            current_data['response_size'] = data.get('response_size')
            current_data['response_headers'] = data.get('response_headers')
        
        # Remove None values and update
        current_data = {k: v for k, v in current_data.items() if v is not None}
        node_execution.node_specific_data = current_data if current_data else None
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'node_execution': node_execution.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Error updating node execution: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/executions/<int:execution_id>', methods=['PUT'])
@auth_required
def update_execution(execution_id):
    """Update execution status"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify ownership
        execution = WorkflowExecution.query.filter_by(
            id=execution_id,
            user_id=user.user_id
        ).first()
        
        if not execution:
            return jsonify({'success': False, 'error': 'Execution not found'}), 404
        
        data = request.get_json()
        
        execution.completed_at = datetime.utcnow()
        execution.status = data.get('status', 'completed')
        execution.error_message = data.get('error_message')
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'execution': execution.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Error updating execution: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/executions/<int:execution_id>', methods=['DELETE'])
@auth_required
def delete_execution(execution_id):
    """Delete an execution and all its node executions"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify ownership
        execution = WorkflowExecution.query.filter_by(
            id=execution_id,
            user_id=user.user_id
        ).first()
        
        if not execution:
            return jsonify({'success': False, 'error': 'Execution not found'}), 404
        
        db.session.delete(execution)
        db.session.commit()
        
        return jsonify({'success': True})
        
    except Exception as e:
        logger.error(f"Error deleting execution: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/executions/nodes/<int:node_execution_id>/execute', methods=['POST'])
@auth_required
def execute_node(node_execution_id):
    """Actually execute a node using the appropriate executor"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify ownership through execution
        node_execution = NodeExecution.query.join(WorkflowExecution).filter(
            NodeExecution.id == node_execution_id,
            WorkflowExecution.user_id == user.user_id
        ).first()
        
        if not node_execution:
            return jsonify({'success': False, 'error': 'Node execution not found'}), 404
        
        logger.info(f"Executing node {node_execution.node_id} (type: {node_execution.node_type})")
        
        # Set status to running
        node_execution.status = 'running'
        node_execution.started_at = datetime.utcnow()
        db.session.commit()
        
        try:
            # Execute based on node type
            if node_execution.node_type == 'webSource':
                result = asyncio.run(execute_web_source_node(node_execution))
            else:
                result = {
                    'success': False,
                    'error': f'Executor not implemented for node type: {node_execution.node_type}'
                }
            
            # Update node execution with results
            node_execution.completed_at = datetime.utcnow()
            node_execution.status = 'completed' if result['success'] else 'failed'
            node_execution.error_message = result.get('error')
            node_execution.output_data = result.get('data')
            
            # Update node-specific data
            current_data = node_execution.node_specific_data or {}
            if node_execution.node_type == 'webSource' and result['success']:
                current_data['extracted_data'] = result.get('data')
                current_data['page_info'] = result.get('metadata', {}).get('page_info', {})
                current_data['extraction_method'] = 'headless_browser'
            
            node_execution.node_specific_data = current_data
            db.session.commit()
            
            logger.info(f"Node execution completed: {result['success']}")
            
            return jsonify({
                'success': True,
                'execution_result': result,
                'node_execution': node_execution.to_dict()
            })
            
        except Exception as exec_error:
            # Update execution with error
            node_execution.completed_at = datetime.utcnow()
            node_execution.status = 'failed'
            node_execution.error_message = str(exec_error)
            db.session.commit()
            
            logger.error(f"Node execution failed: {exec_error}")
            return jsonify({
                'success': False,
                'error': f'Execution failed: {str(exec_error)}',
                'node_execution': node_execution.to_dict()
            }), 500
        
    except Exception as e:
        logger.error(f"Error executing node: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


async def execute_web_source_node(node_execution: NodeExecution) -> dict:
    """Execute a webSource node using headless browser"""
    try:
        # Build node configuration from stored data
        node_data = node_execution.node_specific_data or {}
        
        node_config = {
            'id': node_execution.node_id,
            'type': node_execution.node_type,
            'config': {
                'url': node_data.get('url'),
                'selectors': node_data.get('selectors', []),
                'options': {
                    'wait_for_load': True,
                    'timeout': 30000
                }
            }
        }
        
        logger.info(f"Executing WebSource node with config: {node_config['config']['url']}")
        logger.info(f"Selectors: {len(node_config['config']['selectors'])}")
        
        # Create and execute the node
        executor = WebSourceExecutor(node_config)
        result = await executor.execute()
        
        return result
        
    except Exception as e:
        logger.error(f"Error in execute_web_source_node: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@api_bp.route('/agents/<int:agent_id>/nodes/<node_id>/executions', methods=['GET'])
@auth_required
def get_node_execution_history(agent_id, node_id):
    """Get execution history for a specific node"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify agent ownership
        agent = WorkflowAgent.query.filter_by(created_by=str(user.user_id)).first()
        
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        # Get node executions ordered by most recent first
        node_executions = NodeExecution.query.join(WorkflowExecution).filter(
            NodeExecution.node_id == node_id,
            WorkflowExecution.agent_id == agent_id,
            WorkflowExecution.user_id == user.user_id
        ).order_by(NodeExecution.started_at.desc()).limit(50).all()
        
        logger.info(f"🔍 Found {len(node_executions)} executions for node {node_id}")
        
        # Debug: Log all node executions for this agent to see what we have
        all_node_executions = NodeExecution.query.join(WorkflowExecution).filter(
            WorkflowExecution.agent_id == agent_id,
            WorkflowExecution.user_id == user.user_id
        ).all()
        
        logger.info(f"🔍 All node executions for agent {agent_id}:")
        for exec in all_node_executions:
            logger.info(f"  - Node ID: {exec.node_id}, Type: {exec.node_type}, Status: {exec.status}")
        
        return jsonify({
            'success': True,
            'executions': [execution.to_dict() for execution in node_executions]
        })
        
    except Exception as e:
        logger.error(f"Error getting node execution history: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500