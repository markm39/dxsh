# backend/app/api/agents.py
from flask import request, jsonify
from app.api import api_bp
from app.models.agent import WorkflowAgent, AgentStatus, AgentType
from app.models.execution import WorkflowExecution
from app.auth import auth_required, get_current_user
from app import db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@api_bp.route('/agents', methods=['GET'])
@auth_required
def get_agents():
    """Get all workflow agents for current user"""
    try:
        current_user = get_current_user()
        agents = WorkflowAgent.query.filter_by(created_by=str(current_user.user_id)).all()
        return jsonify({
            'success': True,
            'agents': [agent.to_dict() for agent in agents]
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching agents: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/agents', methods=['POST'])
@auth_required
def create_agent():
    """Create a new workflow agent"""
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Agent name is required'}), 400
        
        # Create new agent with current user
        data['created_by'] = str(current_user.user_id)
        agent = WorkflowAgent.from_dict(data)
        db.session.add(agent)
        db.session.commit()
        
        logger.info(f"Created new workflow agent: {agent.name}")
        return jsonify({
            'success': True,
            'agent': agent.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/agents/<int:agent_id>', methods=['GET'])
@auth_required
def get_agent(agent_id):
    """Get a specific workflow agent"""
    try:
        agent = WorkflowAgent.query.get(agent_id)
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        return jsonify({
            'success': True,
            'agent': agent.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching agent {agent_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/agents/<int:agent_id>', methods=['PUT'])
@auth_required
def update_agent(agent_id):
    """Update a workflow agent"""
    try:
        agent = WorkflowAgent.query.get(agent_id)
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            agent.name = data['name']
        if 'description' in data:
            agent.description = data['description']
        if 'agent_type' in data:
            agent.agent_type = AgentType(data['agent_type'])
        if 'status' in data:
            agent.status = AgentStatus(data['status'])
        if 'workflow_data' in data:
            agent.workflow_data = data['workflow_data']
        if 'auto_execute' in data:
            agent.auto_execute = data['auto_execute']
        if 'execution_interval' in data:
            agent.execution_interval = data['execution_interval']
        if 'max_executions' in data:
            agent.max_executions = data['max_executions']
        if 'trigger_config' in data:
            agent.trigger_config = data['trigger_config']
        if 'actions' in data:
            agent.actions = data['actions']
        if 'notification_channels' in data:
            agent.notification_channels = data['notification_channels']
        if 'notification_config' in data:
            agent.notification_config = data['notification_config']
        
        agent.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Updated workflow agent: {agent.name}")
        return jsonify({
            'success': True,
            'agent': agent.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating agent {agent_id}: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/agents/<int:agent_id>', methods=['DELETE'])
@auth_required
def delete_agent(agent_id):
    """Delete a workflow agent"""
    try:
        agent = WorkflowAgent.query.get(agent_id)
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        agent_name = agent.name
        db.session.delete(agent)
        db.session.commit()
        
        logger.info(f"Deleted workflow agent: {agent_name}")
        return jsonify({
            'success': True,
            'message': f'Agent "{agent_name}" deleted successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting agent {agent_id}: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/agents/<int:agent_id>/execute', methods=['POST'])
@auth_required
def execute_agent(agent_id):
    """Execute a workflow agent"""
    try:
        agent = WorkflowAgent.query.get(agent_id)
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        if agent.status != AgentStatus.ACTIVE:
            return jsonify({'success': False, 'error': 'Agent is not active'}), 400
        
        # Create execution record
        execution = WorkflowExecution(
            agent_id=agent.id,
            status='RUNNING',
            started_at=datetime.utcnow()
        )
        db.session.add(execution)
        db.session.commit()
        
        # TODO: Implement actual workflow execution logic here
        # For now, just mark as completed
        execution.status = 'COMPLETED'
        execution.completed_at = datetime.utcnow()
        execution.result = {'message': 'Workflow executed successfully'}
        db.session.commit()
        
        logger.info(f"Executed workflow agent: {agent.name}")
        return jsonify({
            'success': True,
            'execution_id': execution.id,
            'message': 'Workflow execution started'
        }), 200
        
    except Exception as e:
        logger.error(f"Error executing agent {agent_id}: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

