from flask import request, jsonify
from app.api import api_bp
from app.models.workflow import AgentWorkflow, WorkflowNode
from app.models.agent import WorkflowAgent
from app.models.monitoring import MonitoringJob
from app.auth import auth_required, get_current_user
from app import db
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)


@api_bp.route('/agents/<int:agent_id>/workflow', methods=['GET'])
@auth_required
def get_agent_workflow(agent_id):
    """Get workflow for a specific agent"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify agent ownership
        agent = WorkflowAgent.query.filter_by(created_by=str(user.user_id)).first()
        
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        # Get or create workflow
        workflow = AgentWorkflow.query.filter_by(
            agent_id=agent_id,
            user_id=user.user_id
        ).first()
        
        if not workflow:
            # Create default workflow
            workflow = AgentWorkflow(
                agent_id=agent_id,
                user_id=user.user_id,
                name=f"{agent.name} Workflow",
                nodes=[],
                edges=[]
            )
            db.session.add(workflow)
            db.session.commit()
        
        workflow_dict = workflow.to_dict()
        
        # Debug what we're returning
        logger.info(f"🔍 RETRIEVING WORKFLOW NODES: {json.dumps(workflow_dict.get('nodes', []), indent=2)}")
        
        # Check for any nodes with monitoring data
        for node in workflow_dict.get('nodes', []):
            if node.get('data', {}).get('monitoring', {}).get('originalSelectors'):
                logger.info(f"🔍 RETRIEVED NODE {node['id']} ORIGINAL SELECTORS: {json.dumps(node['data']['monitoring']['originalSelectors'], indent=2)}")
        
        return jsonify({
            'success': True,
            'workflow': workflow_dict
        })
        
    except Exception as e:
        logger.error(f"Error getting agent workflow: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/agents/<int:agent_id>/workflow', methods=['PUT'])
@auth_required
def update_agent_workflow(agent_id):
    """Update workflow for a specific agent"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify agent ownership
        agent = WorkflowAgent.query.filter_by(created_by=str(user.user_id)).first()
        
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        data = request.get_json()
        
        # Get or create workflow
        workflow = AgentWorkflow.query.filter_by(
            agent_id=agent_id,
            user_id=user.user_id
        ).first()
        
        if not workflow:
            workflow = AgentWorkflow(
                agent_id=agent_id,
                user_id=user.user_id,
                name=f"{agent.name} Workflow"
            )
            db.session.add(workflow)
            db.session.flush()  # Ensure workflow.id is populated before node operations
        
        # Update workflow data
        if 'nodes' in data:
            # Debug what we're about to save
            logger.info(f"🔍 SAVING WORKFLOW NODES: {json.dumps(data['nodes'], indent=2)}")
            
            # Check for any nodes with monitoring data
            for node in data['nodes']:
                if node.get('data', {}).get('monitoring', {}).get('originalSelectors'):
                    logger.info(f"🔍 NODE {node['id']} ORIGINAL SELECTORS: {json.dumps(node['data']['monitoring']['originalSelectors'], indent=2)}")
            
            workflow.nodes = data['nodes']
            
            # Use upsert approach to handle concurrent saves
            from sqlalchemy.dialects.postgresql import insert
            
            for node_data in data['nodes']:
                # Prepare node data for upsert
                node_values = {
                    'id': node_data['id'],
                    'workflow_id': workflow.id,
                    'node_type': node_data.get('type', 'unknown'),
                    'position_x': node_data.get('position', {}).get('x', 0),
                    'position_y': node_data.get('position', {}).get('y', 0),
                    'data': node_data.get('data', {}),
                    'configured': node_data.get('data', {}).get('configured', False),
                    'updated_at': datetime.utcnow()
                }
                
                # Use PostgreSQL UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
                stmt = insert(WorkflowNode).values(**node_values)
                stmt = stmt.on_conflict_do_update(
                    index_elements=['id'],
                    set_=dict(
                        workflow_id=stmt.excluded.workflow_id,
                        node_type=stmt.excluded.node_type,
                        position_x=stmt.excluded.position_x,
                        position_y=stmt.excluded.position_y,
                        data=stmt.excluded.data,
                        configured=stmt.excluded.configured,
                        updated_at=stmt.excluded.updated_at
                    )
                )
                db.session.execute(stmt)
        
        if 'edges' in data:
            workflow.edges = data['edges']
        
        if 'name' in data:
            workflow.name = data['name']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'workflow': workflow.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating agent workflow: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/agents/<int:agent_id>/workflow/nodes/<string:node_id>', methods=['PUT'])
@auth_required
def update_workflow_node(agent_id, node_id):
    """Update a specific workflow node (e.g., when it gets configured)"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify agent ownership
        agent = WorkflowAgent.query.filter_by(created_by=str(user.user_id)).first()
        
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        # Get workflow
        workflow = AgentWorkflow.query.filter_by(
            agent_id=agent_id,
            user_id=user.user_id
        ).first()
        
        if not workflow:
            return jsonify({'success': False, 'error': 'Workflow not found'}), 404
        
        # Get node
        node = WorkflowNode.query.filter_by(
            id=node_id,
            workflow_id=workflow.id
        ).first()
        
        if not node:
            return jsonify({'success': False, 'error': 'Node not found'}), 404
        
        data = request.get_json()
        
        # Update node data
        if 'data' in data:
            node.data = data['data']
        
        if 'configured' in data:
            node.configured = data['configured']
        
        if 'monitoring_job_id' in data:
            node.monitoring_job_id = data['monitoring_job_id']
        
        # Also update the workflow's nodes array
        workflow_nodes = workflow.nodes or []
        for i, workflow_node in enumerate(workflow_nodes):
            if workflow_node.get('id') == node_id:
                if 'data' in data:
                    workflow_nodes[i]['data'] = data['data']
                break
        
        workflow.nodes = workflow_nodes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'node': node.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating workflow node: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/agents/<int:agent_id>/workflow/nodes/<string:node_id>', methods=['DELETE'])
@auth_required
def delete_workflow_node(agent_id, node_id):
    """Delete a workflow node"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify agent ownership
        agent = WorkflowAgent.query.filter_by(created_by=str(user.user_id)).first()
        
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found'}), 404
        
        # Get workflow
        workflow = AgentWorkflow.query.filter_by(
            agent_id=agent_id,
            user_id=user.user_id
        ).first()
        
        if not workflow:
            return jsonify({'success': False, 'error': 'Workflow not found'}), 404
        
        # Delete node record
        node = WorkflowNode.query.filter_by(
            id=node_id,
            workflow_id=workflow.id
        ).first()
        
        if node:
            db.session.delete(node)
        
        # Remove from workflow nodes array
        workflow_nodes = workflow.nodes or []
        workflow.nodes = [n for n in workflow_nodes if n.get('id') != node_id]
        
        # Remove from workflow edges array
        workflow_edges = workflow.edges or []
        workflow.edges = [
            e for e in workflow_edges 
            if e.get('source') != node_id and e.get('target') != node_id
        ]
        
        db.session.commit()
        
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting workflow node: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500