"""
Embed API Endpoints - FastAPI version

Handles embedded dashboard and widget views with token-based authentication
Provides public access to dashboards/widgets via embed tokens
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import Optional
import ipaddress
import fnmatch
import json
import os

from ..database import get_db
from ..models.dashboard import Dashboard, DashboardWidget, EmbedToken
from ..services.workflow_client import WorkflowClient

router = APIRouter()
workflow_client = WorkflowClient()


def verify_embed_token_access(
    token_str: str,
    request: Request,
    db: Session,
    dashboard_id: Optional[int] = None,
    widget_id: Optional[int] = None
) -> EmbedToken:
    """Verify embed token has valid access to the requested resource"""
    
    # Get token from database
    token = db.query(EmbedToken).filter(EmbedToken.token == token_str).first()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid embed token"
        )
    
    # Check if token is valid (not expired, usage not exceeded)
    if not token.is_valid():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Embed token is expired or usage limit exceeded"
        )
    
    # Check resource access
    if dashboard_id and token.dashboard_id != dashboard_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token does not have access to this dashboard"
        )
    
    if widget_id and token.widget_id != widget_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token does not have access to this widget"
        )
    
    # Check domain restrictions
    if token.allowed_domains:
        client_host = request.headers.get("host", "")
        referer = request.headers.get("referer", "")
        origin = request.headers.get("origin", "")
        
        # Extract domain from various headers
        domains_to_check = []
        if client_host:
            domains_to_check.append(client_host.split(':')[0])  # Remove port
        if referer:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(referer)
                if parsed.hostname:
                    domains_to_check.append(parsed.hostname)
            except:
                pass
        if origin:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(origin)
                if parsed.hostname:
                    domains_to_check.append(parsed.hostname)
            except:
                pass
        
        # Check if any domain matches allowed patterns
        domain_allowed = False
        for domain in domains_to_check:
            for allowed_pattern in token.allowed_domains:
                if fnmatch.fnmatch(domain.lower(), allowed_pattern.lower()):
                    domain_allowed = True
                    break
            if domain_allowed:
                break
        
        if not domain_allowed and domains_to_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Domain not allowed for this embed token"
            )
    
    # Check IP restrictions
    if token.allowed_ips:
        client_ip = request.client.host if request.client else None
        if not client_ip:
            client_ip = request.headers.get("x-forwarded-for", "").split(',')[0].strip()
        if not client_ip:
            client_ip = request.headers.get("x-real-ip", "")
        
        if client_ip:
            ip_allowed = False
            try:
                client_ip_obj = ipaddress.ip_address(client_ip)
                for allowed_ip in token.allowed_ips:
                    try:
                        if '/' in allowed_ip:  # CIDR notation
                            if client_ip_obj in ipaddress.ip_network(allowed_ip, strict=False):
                                ip_allowed = True
                                break
                        else:  # Single IP
                            if client_ip_obj == ipaddress.ip_address(allowed_ip):
                                ip_allowed = True
                                break
                    except ValueError:
                        continue
            except ValueError:
                pass  # Invalid IP format
            
            if not ip_allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="IP address not allowed for this embed token"
                )
    
    # Increment usage count
    token.increment_usage(db)
    
    return token


@router.get("/embed/dashboard/{dashboard_id}")
async def get_embedded_dashboard(
    dashboard_id: int,
    token: str,
    request: Request,
    theme: Optional[str] = "light",
    refresh: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get embedded dashboard view"""
    
    # Verify token access
    embed_token = verify_embed_token_access(token, request, db, dashboard_id=dashboard_id)
    
    # Get dashboard data
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Redirect to the frontend embed route 
    frontend_url = os.environ.get('DASHBOARD_FRONTEND_URL', 'http://localhost:3001')
    
    from fastapi.responses import RedirectResponse
    return RedirectResponse(
        url=f"{frontend_url}/embed/dashboard/{dashboard_id}?token={token}&theme={theme}" + (f"&refresh={refresh}" if refresh else ""),
        status_code=302
    )


@router.get("/embed/widget/{widget_id}")
async def get_embedded_widget(
    widget_id: int,
    token: str,
    request: Request,
    theme: Optional[str] = "light",
    refresh: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get embedded widget view"""
    
    # Verify token access
    embed_token = verify_embed_token_access(token, request, db, widget_id=widget_id)
    
    # Get widget data
    widget = db.query(DashboardWidget).filter(DashboardWidget.id == widget_id).first()
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Redirect to the frontend embed route
    frontend_url = os.environ.get('DASHBOARD_FRONTEND_URL', 'http://localhost:3001')
    
    from fastapi.responses import RedirectResponse
    return RedirectResponse(
        url=f"{frontend_url}/embed/widget/{widget_id}?token={token}&theme={theme}" + (f"&refresh={refresh}" if refresh else ""),
        status_code=302
    )


@router.get("/embed/dashboard/{dashboard_id}/data")
async def get_embedded_dashboard_data(
    dashboard_id: int,
    token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Get data for embedded dashboard"""
    
    # Verify token access
    embed_token = verify_embed_token_access(token, request, db, dashboard_id=dashboard_id)
    
    # Get dashboard with widgets
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Get fresh data for all connected widgets
    dashboard_data = dashboard.to_dict()
    for widget in dashboard_data['widgets']:
        if widget.get('dataSource', {}).get('agentId') and widget.get('dataSource', {}).get('nodeId'):
            try:
                node_data = await workflow_client.get_node_execution_data(
                    widget['dataSource']['agentId'],
                    widget['dataSource']['nodeId'],
                    auth_token=None  # Public access via embed token
                )
                if node_data:
                    widget['cachedData'] = node_data
            except Exception:
                # Fall back to cached data on error
                pass
    
    return {
        'success': True,
        'data': dashboard_data
    }


@router.get("/embed/widget/{widget_id}/data")
async def get_embedded_widget_data(
    widget_id: int,
    token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Get data for embedded widget"""
    
    # Verify token access  
    embed_token = verify_embed_token_access(token, request, db, widget_id=widget_id)
    
    # Get widget
    widget = db.query(DashboardWidget).filter(DashboardWidget.id == widget_id).first()
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Get fresh data if connected to workflow node
    widget_data = widget.to_dict()
    if widget.agent_id and widget.node_id:
        try:
            node_data = await workflow_client.get_node_execution_data(
                widget.agent_id,
                widget.node_id,
                auth_token=None  # Public access via embed token
            )
            if node_data:
                widget_data['cachedData'] = node_data
                widget.update_cached_data(node_data, db)
        except Exception:
            # Fall back to cached data on error
            pass
    
    return {
        'success': True,
        'data': widget_data
    }


def generate_standalone_dashboard_embed(dashboard, theme: str = "light", refresh_interval: Optional[int] = None, token: str = "") -> str:
    """Generate standalone HTML for embedded dashboard with actual chart rendering"""
    
    dashboard_data = dashboard.to_dict()
    
    # Base API URL for fetching data
    api_url = os.environ.get('API_GATEWAY_URL', 'http://localhost:8001')
    
    refresh_script = ""
    if refresh_interval:
        refresh_script = f"""
        // Auto-refresh every {refresh_interval} seconds
        setInterval(() => {{
            fetchDashboardData();
        }}, {refresh_interval * 1000});
        """
    
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{dashboard_data['name']} - Embedded Dashboard</title>
        
        <!-- Chart.js for rendering charts -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/date-fns/1.30.1/date_fns.min.js"></script>
        
        <style>
            body {{
                margin: 0;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: {('#ffffff' if theme == 'light' else '#1a1a1a')};
                color: {('#333333' if theme == 'light' else '#ffffff')};
                min-height: 100vh;
            }}
            
            .dashboard-header {{
                text-align: center;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid {('#e0e0e0' if theme == 'light' else '#333333')};
            }}
            
            .dashboard-title {{
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 8px;
            }}
            
            .dashboard-description {{
                font-size: 16px;
                color: {('#666666' if theme == 'light' else '#cccccc')};
            }}
            
            .widgets-grid {{
                display: grid;
                gap: 20px;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            }}
            
            .widget {{
                border: 1px solid {('#e0e0e0' if theme == 'light' else '#333333')};
                border-radius: 12px;
                padding: 20px;
                background: {('#ffffff' if theme == 'light' else '#2a2a2a')};
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                transition: box-shadow 0.3s ease;
            }}
            
            .widget:hover {{
                box-shadow: 0 8px 15px rgba(0,0,0,0.15);
            }}
            
            .widget-header {{
                display: flex;
                justify-content: between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid {('#f0f0f0' if theme == 'light' else '#404040')};
            }}
            
            .widget-title {{
                font-size: 18px;
                font-weight: 600;
                margin: 0;
            }}
            
            .widget-type {{
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 12px;
                background: {('#f8f9fa' if theme == 'light' else '#404040')};
                color: {('#666666' if theme == 'light' else '#cccccc')};
                text-transform: uppercase;
                font-weight: 500;
            }}
            
            .widget-content {{
                min-height: 250px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }}
            
            .chart-container {{
                width: 100%;
                height: 250px;
                position: relative;
            }}
            
            .metric-display {{
                text-align: center;
                padding: 20px;
            }}
            
            .metric-value {{
                font-size: 48px;
                font-weight: bold;
                margin-bottom: 8px;
                color: {('#007bff' if theme == 'light' else '#0d6efd')};
            }}
            
            .metric-label {{
                font-size: 16px;
                color: {('#666666' if theme == 'light' else '#cccccc')};
            }}
            
            .table-container {{
                width: 100%;
                overflow-x: auto;
            }}
            
            table {{
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
            }}
            
            th, td {{
                padding: 8px 12px;
                text-align: left;
                border-bottom: 1px solid {('#e0e0e0' if theme == 'light' else '#333333')};
            }}
            
            th {{
                background: {('#f8f9fa' if theme == 'light' else '#404040')};
                font-weight: 600;
            }}
            
            .loading, .error, .no-data {{
                text-align: center;
                padding: 40px 20px;
                color: {('#999999' if theme == 'light' else '#666666')};
            }}
            
            .error {{
                color: #dc3545;
            }}
            
            .loading-spinner {{
                border: 3px solid {('#f3f3f3' if theme == 'light' else '#333333')};
                border-top: 3px solid {('#007bff' if theme == 'light' else '#0d6efd')};
                border-radius: 50%;
                width: 32px;
                height: 32px;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px;
            }}
            
            @keyframes spin {{
                0% {{ transform: rotate(0deg); }}
                100% {{ transform: rotate(360deg); }}
            }}
            
            .refresh-indicator {{
                position: fixed;
                top: 20px;
                right: 20px;
                background: {('#007bff' if theme == 'light' else '#0d6efd')};
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                opacity: 0;
                transition: opacity 0.3s ease;
                z-index: 1000;
            }}
            
            .refresh-indicator.show {{
                opacity: 1;
            }}
        </style>
    </head>
    <body>
        <div id="refresh-indicator" class="refresh-indicator">Refreshing...</div>
        
        <div class="dashboard-header">
            <h1 class="dashboard-title">{dashboard_data['name']}</h1>
            {f'<p class="dashboard-description">{dashboard_data["description"]}</p>' if dashboard_data.get('description') else ''}
        </div>
        
        <div class="widgets-grid" id="widgets-grid">
            <!-- Widgets will be populated here -->
        </div>
        
        <script>
            const API_URL = '{api_url}';
            const DASHBOARD_ID = {dashboard_data['id']};
            const TOKEN = '{token}';
            const THEME = '{theme}';
            
            let dashboardData = {json.dumps(dashboard_data)};
            let chartInstances = {{}};
            
            // Utility function to show refresh indicator
            function showRefreshIndicator() {{
                const indicator = document.getElementById('refresh-indicator');
                indicator.classList.add('show');
                setTimeout(() => {{
                    indicator.classList.remove('show');
                }}, 2000);
            }}
            
            // Fetch fresh dashboard data
            async function fetchDashboardData() {{
                try {{
                    showRefreshIndicator();
                    const response = await fetch(`${{API_URL}}/api/v1/embed/dashboard/${{DASHBOARD_ID}}/data?token=${{TOKEN}}`);
                    const result = await response.json();
                    
                    if (result.success) {{
                        dashboardData = result.data;
                        renderWidgets();
                    }}
                }} catch (error) {{
                    console.error('Failed to fetch dashboard data:', error);
                }}
            }}
            
            // Render a chart widget
            function renderChart(container, widget) {{
                const canvas = document.createElement('canvas');
                container.appendChild(canvas);
                
                // Destroy existing chart if it exists
                if (chartInstances[widget.id]) {{
                    chartInstances[widget.id].destroy();
                }}
                
                const ctx = canvas.getContext('2d');
                const data = widget.cachedData || {{}};
                
                // Create chart based on widget configuration
                const config = widget.chartConfig || {{}};
                const chartData = {{
                    labels: data.labels || [],
                    datasets: data.datasets || [{{
                        label: widget.title,
                        data: data.values || [],
                        backgroundColor: config.backgroundColor || 'rgba(0, 123, 255, 0.1)',
                        borderColor: config.borderColor || 'rgba(0, 123, 255, 1)',
                        borderWidth: 2,
                        fill: config.fill !== false
                    }}]
                }};
                
                chartInstances[widget.id] = new Chart(ctx, {{
                    type: config.type || 'line',
                    data: chartData,
                    options: {{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {{
                            legend: {{
                                display: true,
                                position: 'top'
                            }}
                        }},
                        scales: {{
                            y: {{
                                beginAtZero: true,
                                grid: {{
                                    color: THEME === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
                                }}
                            }},
                            x: {{
                                grid: {{
                                    color: THEME === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
                                }}
                            }}
                        }}
                    }}
                }});
            }}
            
            // Render a metric widget
            function renderMetric(container, widget) {{
                const data = widget.cachedData || {{}};
                const value = data.value || data.metric || 'N/A';
                const label = data.label || widget.title || 'Metric';
                
                container.innerHTML = `
                    <div class="metric-display">
                        <div class="metric-value">${{typeof value === 'number' ? value.toLocaleString() : value}}</div>
                        <div class="metric-label">${{label}}</div>
                    </div>
                `;
            }}
            
            // Render a table widget
            function renderTable(container, widget) {{
                const data = widget.cachedData || {{}};
                
                if (!data.rows || !Array.isArray(data.rows) || data.rows.length === 0) {{
                    container.innerHTML = '<div class="no-data">No table data available</div>';
                    return;
                }}
                
                const headers = data.headers || (data.rows[0] ? Object.keys(data.rows[0]) : []);
                
                let tableHTML = `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>${{headers.map(h => `<th>${{h}}</th>`).join('')}}</tr>
                            </thead>
                            <tbody>
                `;
                
                data.rows.slice(0, 10).forEach(row => {{
                    tableHTML += '<tr>';
                    headers.forEach(header => {{
                        const value = typeof row === 'object' ? (row[header] || '') : row;
                        tableHTML += `<td>${{value}}</td>`;
                    }});
                    tableHTML += '</tr>';
                }});
                
                tableHTML += `
                            </tbody>
                        </table>
                    </div>
                `;
                
                if (data.rows.length > 10) {{
                    tableHTML += `<div style="text-align: center; margin-top: 12px; font-size: 12px; color: #666;">Showing 10 of ${{data.rows.length}} rows</div>`;
                }}
                
                container.innerHTML = tableHTML;
            }}
            
            // Render all widgets
            function renderWidgets() {{
                const grid = document.getElementById('widgets-grid');
                grid.innerHTML = '';
                
                if (!dashboardData.widgets || dashboardData.widgets.length === 0) {{
                    grid.innerHTML = '<div class="no-data">This dashboard has no widgets yet</div>';
                    return;
                }}
                
                dashboardData.widgets.forEach(widget => {{
                    const widgetDiv = document.createElement('div');
                    widgetDiv.className = 'widget';
                    widgetDiv.id = `widget-${{widget.id}}`;
                    
                    const header = document.createElement('div');
                    header.className = 'widget-header';
                    header.innerHTML = `
                        <h3 class="widget-title">${{widget.title || 'Untitled Widget'}}</h3>
                        <span class="widget-type">${{widget.type || 'widget'}}</span>
                    `;
                    
                    const content = document.createElement('div');
                    content.className = 'widget-content';
                    
                    // Render based on widget type
                    if (!widget.cachedData) {{
                        content.innerHTML = `
                            <div class="no-data">
                                <div>No data available</div>
                                <div style="font-size: 12px; margin-top: 8px;">Connect this widget to a workflow to see data</div>
                            </div>
                        `;
                    }} else if (widget.type === 'chart') {{
                        const chartContainer = document.createElement('div');
                        chartContainer.className = 'chart-container';
                        content.appendChild(chartContainer);
                        renderChart(chartContainer, widget);
                    }} else if (widget.type === 'metric') {{
                        renderMetric(content, widget);
                    }} else if (widget.type === 'table') {{
                        renderTable(content, widget);
                    }} else {{
                        // Default: show raw data
                        content.innerHTML = `
                            <div style="width: 100%; text-align: left;">
                                <pre style="background: rgba(0,0,0,0.05); padding: 16px; border-radius: 8px; font-size: 12px; overflow-x: auto; max-height: 200px;">${{JSON.stringify(widget.cachedData, null, 2)}}</pre>
                            </div>
                        `;
                    }}
                    
                    widgetDiv.appendChild(header);
                    widgetDiv.appendChild(content);
                    grid.appendChild(widgetDiv);
                }});
            }}
            
            // Initialize
            document.addEventListener('DOMContentLoaded', () => {{
                renderWidgets();
            }});
            
            {refresh_script}
        </script>
    </body>
    </html>
    """


def generate_widget_embed_html(widget: dict, theme: str = "light", refresh_interval: Optional[int] = None, token: str = "") -> str:
    """Generate HTML for embedded widget"""
    
    refresh_script = ""
    if refresh_interval:
        refresh_script = f"""
        // Auto-refresh every {refresh_interval} seconds
        setInterval(() => {{
            fetch(`/api/v1/embed/widget/{widget['id']}/data?token={token}`)
                .then(response => response.json())
                .then(data => {{
                    if (data.success) {{
                        updateWidgetData(data.data);
                    }}
                }})
                .catch(console.error);
        }}, {refresh_interval * 1000});
        """
    
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{widget['title']} - Embedded Widget</title>
        <style>
            body {{
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: {('#ffffff' if theme == 'light' else '#1a1a1a')};
                color: {('#333333' if theme == 'light' else '#ffffff')};
                height: 100vh;
                overflow: hidden;
            }}
            .widget-container {{
                height: 100vh;
                display: flex;
                flex-direction: column;
            }}
            .widget-header {{
                padding: 12px 16px;
                border-bottom: 1px solid {('#e0e0e0' if theme == 'light' else '#333333')};
                background: {('#f8f9fa' if theme == 'light' else '#2a2a2a')};
            }}
            .widget-title {{
                font-size: 16px;
                font-weight: 600;
                margin: 0;
            }}
            .widget-content {{
                flex: 1;
                padding: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: {('#666666' if theme == 'light' else '#cccccc')};
            }}
            .loading {{
                color: {('#999999' if theme == 'light' else '#666666')};
            }}
        </style>
    </head>
    <body>
        <div class="widget-container">
            {"<div class='widget-header'><div class='widget-title'>" + widget['title'] + "</div></div>" if widget.get('showHeader', True) else ""}
            <div class="widget-content" id="widget-content">
                <div class="loading">Loading widget data...</div>
            </div>
        </div>
        
        <script>
            const widgetData = {json.dumps(widget)};
            const theme = '{theme}';
            const token = '{token}';
            
            function updateWidgetData(data) {{
                // Update widget with fresh data
                console.log('Updating widget data:', data);
                const content = document.getElementById('widget-content');
                
                if (data.cachedData) {{
                    // Render widget data based on type
                    if (data.type === 'chart') {{
                        content.innerHTML = `
                            <div style="text-align: center; padding: 20px;">
                                <h3>📊 Chart Widget</h3>
                                <p>Chart data available (${JSON.stringify(data.cachedData).length} chars)</p>
                                <pre style="text-align: left; font-size: 12px; max-height: 200px; overflow-y: auto;">${JSON.stringify(data.cachedData, null, 2)}</pre>
                            </div>
                        `;
                    }} else if (data.type === 'table') {{
                        content.innerHTML = `
                            <div style="text-align: center; padding: 20px;">
                                <h3>📋 Table Widget</h3>
                                <p>Table data available</p>
                                <pre style="text-align: left; font-size: 12px; max-height: 200px; overflow-y: auto;">${JSON.stringify(data.cachedData, null, 2)}</pre>
                            </div>
                        `;
                    }} else if (data.type === 'metric') {{
                        content.innerHTML = `
                            <div style="text-align: center; padding: 20px;">
                                <h3>📈 Metric Widget</h3>
                                <p>Metric data available</p>
                                <pre style="text-align: left; font-size: 12px; max-height: 200px; overflow-y: auto;">${JSON.stringify(data.cachedData, null, 2)}</pre>
                            </div>
                        `;
                    }} else {{
                        content.innerHTML = `
                            <div style="text-align: center; padding: 20px;">
                                <h3>🔧 Widget Data</h3>
                                <pre style="text-align: left; font-size: 12px; max-height: 200px; overflow-y: auto;">${JSON.stringify(data.cachedData, null, 2)}</pre>
                            </div>
                        `;
                    }}
                }} else {{
                    content.innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <h3>📭 No Data Available</h3>
                            <p>This widget doesn't have cached data yet.</p>
                            <p>Try running the connected workflow to generate data.</p>
                        </div>
                    `;
                }}
            }}
            
            // Initialize with cached data
            console.log('Widget data:', widgetData);
            updateWidgetData(widgetData);
            
            {refresh_script}
        </script>
    </body>
    </html>
    """