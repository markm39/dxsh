"""
Dashboard API Endpoints

Manages dashboards and widgets, including connections to workflow nodes
"""

from flask import request, jsonify
from app.api import api_bp
from app import db
from app.auth import auth_required, get_current_user
from app.models.dashboard import Dashboard, DashboardWidget
from app.models.user import User
from app.models.agent import WorkflowAgent
from app.models.execution import NodeExecution, WorkflowExecution
from datetime import datetime
import json
from sqlalchemy.orm.attributes import flag_modified

@api_bp.route('/dashboards', methods=['GET'])
@auth_required
def get_dashboards():
    """Get all dashboards for the current user"""
    user_id = get_current_user().user_id
    
    dashboards = Dashboard.query.filter_by(user_id=user_id).all()
    
    return jsonify({
        'success': True,
        'data': [dashboard.to_dict() for dashboard in dashboards]
    })

@api_bp.route('/dashboards', methods=['POST'])
@auth_required
def create_dashboard():
    """Create a new dashboard"""
    user_id = get_current_user().user_id
    data = request.get_json()
    
    # Validate required fields
    if not data.get('name'):
        return jsonify({'success': False, 'error': 'Dashboard name is required'}), 400
    
    # Create dashboard
    dashboard = Dashboard(
        user_id=user_id,
        name=data['name'],
        description=data.get('description', '')
    )
    
    db.session.add(dashboard)
    db.session.flush()  # This assigns the ID without committing
    
    # Get the data while the object is still attached to the session
    dashboard_data = dashboard.to_dict()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': dashboard_data
    }), 201

@api_bp.route('/dashboards/<int:dashboard_id>', methods=['GET'])
@auth_required
def get_dashboard(dashboard_id):
    """Get a specific dashboard"""
    user_id = get_current_user().user_id
    
    dashboard = Dashboard.query.filter_by(id=dashboard_id, user_id=user_id).first()
    if not dashboard:
        return jsonify({'success': False, 'error': 'Dashboard not found'}), 404
    
    dashboard_dict = dashboard.to_dict()
    print(f"=== GET DASHBOARD API ===")
    print(f"Dashboard: {dashboard.name}")
    print(f"Widget settings being returned:")
    for widget in dashboard_dict.get('widgets', []):
        print(f"  Widget {widget['id']} ({widget['title']}): showHeader={widget.get('showHeader')}, showFooter={widget.get('showFooter')}")
    
    return jsonify({
        'success': True,
        'data': dashboard_dict
    })

@api_bp.route('/dashboards/<int:dashboard_id>', methods=['PUT'])
@auth_required
def update_dashboard(dashboard_id):
    """Update a dashboard"""
    user_id = get_current_user().user_id
    data = request.get_json()
    
    print(f"=== UPDATE DASHBOARD API CALLED ===")
    print(f"Dashboard ID: {dashboard_id}")
    print(f"Received data keys: {list(data.keys()) if data else 'None'}")
    if 'widgets' in (data or {}):
        print(f"Widget updates requested: {len(data['widgets'])} widgets")
        for widget_data in data['widgets']:
            print(f"  Widget {widget_data.get('id')}: showHeader={widget_data.get('showHeader')}, showFooter={widget_data.get('showFooter')}")
    print(f"User ID: {user_id}")
    
    dashboard = Dashboard.query.filter_by(id=dashboard_id, user_id=user_id).first()
    if not dashboard:
        return jsonify({'success': False, 'error': 'Dashboard not found'}), 404
    
    # Update fields
    if 'name' in data:
        dashboard.name = data['name']
    if 'description' in data:
        dashboard.description = data['description']
    if 'display_settings' in data:
        dashboard.display_settings = data['display_settings']
    
    # Update widgets if provided
    if 'widgets' in data:
        for widget_data in data['widgets']:
            widget = DashboardWidget.query.filter_by(
                id=widget_data['id'], 
                dashboard_id=dashboard_id
            ).first()
            if widget:
                # Update widget properties
                if 'title' in widget_data:
                    widget.title = widget_data['title']
                if 'position' in widget_data:
                    widget.position = widget_data['position']
                if 'config' in widget_data:
                    widget.config = widget_data['config']
                    flag_modified(widget, 'config')
                if 'data_source' in widget_data:
                    widget.data_source = widget_data['data_source']
                
                # Handle display settings (store in config)
                if 'showHeader' in widget_data or 'showFooter' in widget_data:
                    if widget.config is None:
                        widget.config = {}
                    if 'showHeader' in widget_data:
                        widget.config['showHeader'] = widget_data['showHeader']
                    if 'showFooter' in widget_data:
                        widget.config['showFooter'] = widget_data['showFooter']
                    flag_modified(widget, 'config')
                    print(f"Dashboard update: Updated widget {widget.id} config: {widget.config}")
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': dashboard.to_dict()
    })

@api_bp.route('/dashboards/<int:dashboard_id>', methods=['DELETE'])
@auth_required
def delete_dashboard(dashboard_id):
    """Delete a dashboard"""
    user_id = get_current_user().user_id
    
    dashboard = Dashboard.query.filter_by(id=dashboard_id, user_id=user_id).first()
    if not dashboard:
        return jsonify({'success': False, 'error': 'Dashboard not found'}), 404
    
    db.session.delete(dashboard)
    db.session.commit()
    
    return jsonify({'success': True})

# Widget endpoints
@api_bp.route('/dashboards/<int:dashboard_id>/widgets', methods=['POST'])
@auth_required
def create_widget(dashboard_id):
    """Create a new widget"""
    user_id = get_current_user().user_id
    data = request.get_json()
    
    # Verify dashboard ownership
    dashboard = Dashboard.query.filter_by(id=dashboard_id, user_id=user_id).first()
    if not dashboard:
        return jsonify({'success': False, 'error': 'Dashboard not found'}), 404
    
    # Validate required fields
    if not data.get('type') or not data.get('title'):
        return jsonify({'success': False, 'error': 'Widget type and title are required'}), 400
    
    # Create widget
    widget = DashboardWidget(
        dashboard_id=dashboard_id,
        type=data['type'],
        title=data['title'],
        description=data.get('description', ''),
        position=data.get('position', {'x': 0, 'y': 0, 'w': 6, 'h': 4}),
        config=data.get('config', {})
    )
    
    # Handle data source connection
    if data.get('dataSource'):
        source = data['dataSource']
        if source.get('agentId') and source.get('nodeId'):
            # Verify agent ownership
            agent = WorkflowAgent.query.filter_by(id=source['agentId'], user_id=user_id).first()
            if agent:
                widget.agent_id = source['agentId']
                widget.node_id = source['nodeId']
                widget.refresh_on_workflow_complete = source.get('refreshOnWorkflowComplete', True)
                widget.refresh_interval = source.get('refreshInterval')
    
    db.session.add(widget)
    db.session.flush()  # This assigns the ID without committing
    
    # Get the data while the object is still attached to the session
    widget_data = widget.to_dict()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': widget_data
    }), 201

@api_bp.route('/dashboards/<int:dashboard_id>/widgets/<int:widget_id>', methods=['PUT'])
@auth_required
def update_widget(dashboard_id, widget_id):
    """Update a widget"""
    user_id = get_current_user().user_id
    data = request.get_json()
    
    # Debug logging
    print(f"=== UPDATE WIDGET API CALLED ===")
    print(f"Dashboard ID: {dashboard_id}, Widget ID: {widget_id}")
    print(f"Received data: {data}")
    print(f"User ID: {user_id}")
    
    # Verify dashboard ownership
    dashboard = Dashboard.query.filter_by(id=dashboard_id, user_id=user_id).first()
    if not dashboard:
        return jsonify({'success': False, 'error': 'Dashboard not found'}), 404
    
    widget = DashboardWidget.query.filter_by(id=widget_id, dashboard_id=dashboard_id).first()
    if not widget:
        return jsonify({'success': False, 'error': 'Widget not found'}), 404
    
    # Update fields
    if 'title' in data:
        widget.title = data['title']
    if 'description' in data:
        widget.description = data['description']
    if 'position' in data:
        widget.position = data['position']
    if 'config' in data:
        widget.config = data['config']
        flag_modified(widget, 'config')
    
    # Update display settings (store in config)
    if 'showHeader' in data or 'showFooter' in data:
        if widget.config is None:
            widget.config = {}
        if 'showHeader' in data:
            widget.config['showHeader'] = data['showHeader']
        if 'showFooter' in data:
            widget.config['showFooter'] = data['showFooter']
        # Tell SQLAlchemy that the JSON field has been modified
        flag_modified(widget, 'config')
        print(f"Updated widget config: {widget.config}")
    
    # Update data source
    if 'dataSource' in data:
        source = data['dataSource']
        if source:
            if source.get('agentId') and source.get('nodeId'):
                # Verify agent ownership
                agent = WorkflowAgent.query.filter_by(id=source['agentId'], created_by=str(user_id)).first()
                if agent:
                    widget.agent_id = source['agentId']
                    widget.node_id = source['nodeId']
                    widget.refresh_on_workflow_complete = source.get('refreshOnWorkflowComplete', True)
                    widget.refresh_interval = source.get('refreshInterval')
        else:
            # Remove connection
            widget.agent_id = None
            widget.node_id = None
    
    db.session.commit()
    print(f"Database commit completed. Final widget config: {widget.config}")
    
    widget_dict = widget.to_dict()
    print(f"Widget to_dict result - showHeader: {widget_dict.get('showHeader')}, showFooter: {widget_dict.get('showFooter')}")
    
    return jsonify({
        'success': True,
        'data': widget_dict
    })

@api_bp.route('/dashboards/<int:dashboard_id>/widgets/<int:widget_id>', methods=['DELETE'])
@auth_required
def delete_widget(dashboard_id, widget_id):
    """Delete a widget"""
    user_id = get_current_user().user_id
    
    # Verify dashboard ownership
    dashboard = Dashboard.query.filter_by(id=dashboard_id, user_id=user_id).first()
    if not dashboard:
        return jsonify({'success': False, 'error': 'Dashboard not found'}), 404
    
    widget = DashboardWidget.query.filter_by(id=widget_id, dashboard_id=dashboard_id).first()
    if not widget:
        return jsonify({'success': False, 'error': 'Widget not found'}), 404
    
    db.session.delete(widget)
    db.session.commit()
    
    return jsonify({'success': True})

@api_bp.route('/dashboards/<int:dashboard_id>/widgets/<int:widget_id>/data', methods=['GET'])
@auth_required
def get_widget_data(dashboard_id, widget_id):
    """Get data for a specific widget"""
    user_id = get_current_user().user_id
    
    # Verify dashboard ownership
    dashboard = Dashboard.query.filter_by(id=dashboard_id, user_id=user_id).first()
    if not dashboard:
        return jsonify({'success': False, 'error': 'Dashboard not found'}), 404
    
    widget = DashboardWidget.query.filter_by(id=widget_id, dashboard_id=dashboard_id).first()
    if not widget:
        return jsonify({'success': False, 'error': 'Widget not found'}), 404
    
    # If widget is connected to a node, fetch the latest execution data
    if widget.agent_id and widget.node_id:
        # Get the latest node execution
        latest_execution = NodeExecution.query.join(
            NodeExecution.execution
        ).filter(
            NodeExecution.node_id == widget.node_id,
            NodeExecution.execution.has(agent_id=widget.agent_id),
            NodeExecution.status == 'completed'
        ).order_by(NodeExecution.completed_at.desc()).first()
        
        if latest_execution and latest_execution.output_data:
            # Return the output data
            return jsonify({
                'success': True,
                'data': latest_execution.output_data,
                'metadata': {
                    'executionId': latest_execution.id,
                    'completedAt': latest_execution.completed_at.isoformat() if latest_execution.completed_at else None
                }
            })
    
    # Return cached data if available
    if widget.cached_data:
        return jsonify({
            'success': True,
            'data': widget.cached_data,
            'metadata': {
                'cached': True,
                'lastUpdated': widget.last_updated.isoformat() if widget.last_updated else None
            }
        })
    
    # No data available
    return jsonify({
        'success': True,
        'data': None,
        'metadata': {
            'message': 'No data available. Run the connected workflow to populate data.'
        }
    })

@api_bp.route('/widgets/available-nodes', methods=['GET'])
@auth_required
def get_available_nodes():
    """Get all available nodes from user's workflows for widget connection"""
    user_id = get_current_user().user_id
    
    # Get all user's agents
    agents = WorkflowAgent.query.filter_by(user_id=user_id).all()
    
    available_nodes = []
    for agent in agents:
        if agent.workflow_definition and 'nodes' in agent.workflow_definition:
            for node in agent.workflow_definition['nodes']:
                available_nodes.append({
                    'agentId': agent.id,
                    'agentName': agent.name,
                    'nodeId': node.get('id'),
                    'nodeType': node.get('type'),
                    'nodeLabel': node.get('data', {}).get('label', 'Unnamed Node')
                })
    
    return jsonify({
        'success': True,
        'data': available_nodes
    })

# Webhook endpoint for workflow executions to update widgets
@api_bp.route('/widgets/update-from-execution', methods=['POST'])
@auth_required
def update_widgets_from_execution():
    """Update widgets when a workflow completes"""
    data = request.get_json()
    
    if not data.get('agentId') or not data.get('nodeId') or not data.get('result'):
        return jsonify({'success': False, 'error': 'Missing required fields'}), 400
    
    # Find all widgets connected to this node
    widgets = DashboardWidget.query.filter_by(
        agent_id=data['agentId'],
        node_id=data['nodeId']
    ).all()
    
    # Update each widget's cached data
    for widget in widgets:
        if widget.refresh_on_workflow_complete:
            widget.update_cached_data(data['result'])
    
    return jsonify({
        'success': True,
        'updated': len(widgets)
    })

@api_bp.route('/nodes/<node_id>/output', methods=['GET'])
@auth_required
def get_node_output(node_id):
    """Get the latest output from a specific node"""
    user_id = get_current_user().user_id
    
    # Get the latest node execution for this node
    latest_execution = NodeExecution.query.join(
        NodeExecution.execution
    ).join(
        WorkflowAgent, WorkflowExecution.agent_id == WorkflowAgent.id
    ).filter(
        NodeExecution.node_id == node_id,
        NodeExecution.status == 'completed',
        WorkflowAgent.created_by == str(user_id)
    ).order_by(NodeExecution.completed_at.desc()).first()
    
    if not latest_execution:
        return jsonify({
            'success': False,
            'error': 'No execution data found for this node'
        }), 404
    
    return jsonify({
        'success': True,
        'data': latest_execution.output_data,
        'metadata': {
            'executionId': latest_execution.id,
            'executionTime': latest_execution.completed_at.isoformat() if latest_execution.completed_at else None,
            'nodeType': latest_execution.node_type
        }
    })