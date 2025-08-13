"""
Test dashboard service components
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from src.services.workflow_client import WorkflowClient
from src.services.chart_service import ChartService


class TestWorkflowClient:
    """Test workflow client service"""
    
    def test_init(self):
        """Test workflow client initialization"""
        client = WorkflowClient()
        assert client.base_url == "http://workflow-engine:5000"
    
    def test_init_with_custom_url(self):
        """Test workflow client with custom URL"""
        custom_url = "http://localhost:5001"
        with patch.dict('os.environ', {'WORKFLOW_ENGINE_URL': custom_url}):
            client = WorkflowClient()
            assert client.base_url == custom_url
    
    @patch('httpx.AsyncClient')
    async def test_get_node_execution_data_success(self, mock_client_class):
        """Test successful node execution data retrieval"""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'data': [1, 2, 3, 4, 5],
            'chart_type': 'line'
        }
        
        # Setup mock client
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Test the method
        client = WorkflowClient()
        result = await client.get_node_execution_data(agent_id=1, node_id="test-node")
        
        # Verify result
        assert result == {'data': [1, 2, 3, 4, 5], 'chart_type': 'line'}
        
        # Verify the HTTP call
        mock_client.get.assert_called_once_with(
            "http://workflow-engine:5000/v1/executions/data/1/test-node",
            timeout=10.0
        )
    
    @patch('httpx.AsyncClient')
    async def test_get_node_execution_data_not_found(self, mock_client_class):
        """Test node execution data not found"""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.status_code = 404
        
        # Setup mock client
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Test the method
        client = WorkflowClient()
        result = await client.get_node_execution_data(agent_id=1, node_id="nonexistent")
        
        # Should return None for 404
        assert result is None
    
    @patch('httpx.AsyncClient')
    async def test_get_node_execution_data_server_error(self, mock_client_class):
        """Test handling of server errors"""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.status_code = 500
        
        # Setup mock client
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Test the method
        client = WorkflowClient()
        result = await client.get_node_execution_data(agent_id=1, node_id="test-node")
        
        # Should return None for server errors
        assert result is None
    
    @patch('httpx.AsyncClient')
    async def test_get_node_execution_data_network_error(self, mock_client_class):
        """Test handling of network errors"""
        # Setup mock client to raise exception
        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.RequestError("Network error")
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        # Test the method
        client = WorkflowClient()
        result = await client.get_node_execution_data(agent_id=1, node_id="test-node")
        
        # Should return None for network errors
        assert result is None


class TestChartService:
    """Test chart service functionality"""
    
    @patch('src.services.chart_service.openai.ChatCompletion.create')
    async def test_generate_chart_config_success(self, mock_openai):
        """Test successful chart config generation"""
        # Mock OpenAI response
        mock_openai.return_value = MagicMock()
        mock_openai.return_value.choices = [MagicMock()]
        mock_openai.return_value.choices[0].message.content = '''
        {
            "chart_type": "line",
            "title": "Test Chart",
            "x_axis": "time",
            "y_axis": "value"
        }
        '''
        
        # Test data
        test_data = [
            {"time": "2024-01", "value": 100},
            {"time": "2024-02", "value": 150},
            {"time": "2024-03", "value": 200}
        ]
        
        # Test the method
        service = ChartService()
        result = await service.generate_chart_config(test_data, "Show trend over time")
        
        # Verify result
        assert result['chart_type'] == 'line'
        assert result['title'] == 'Test Chart'
        assert result['x_axis'] == 'time'
        assert result['y_axis'] == 'value'
    
    @patch('src.services.chart_service.openai.ChatCompletion.create')
    async def test_generate_chart_config_invalid_json(self, mock_openai):
        """Test handling of invalid JSON from OpenAI"""
        # Mock OpenAI response with invalid JSON
        mock_openai.return_value = MagicMock()
        mock_openai.return_value.choices = [MagicMock()]
        mock_openai.return_value.choices[0].message.content = "Invalid JSON response"
        
        test_data = [{"x": 1, "y": 2}]
        
        service = ChartService()
        result = await service.generate_chart_config(test_data, "Test prompt")
        
        # Should return default config for invalid JSON
        assert result is not None
        assert 'error' in result or 'chart_type' in result
    
    def test_detect_chart_type_numeric_data(self):
        """Test automatic chart type detection for numeric data"""
        # Time series data
        time_data = [
            {"date": "2024-01", "value": 100},
            {"date": "2024-02", "value": 150}
        ]
        
        service = ChartService()
        chart_type = service.detect_chart_type(time_data)
        assert chart_type in ['line', 'bar']  # Either is acceptable for time series
        
        # Categorical data
        category_data = [
            {"category": "A", "count": 10},
            {"category": "B", "count": 20},
            {"category": "C", "count": 15}
        ]
        
        chart_type = service.detect_chart_type(category_data)
        assert chart_type in ['bar', 'pie']
    
    def test_detect_chart_type_empty_data(self):
        """Test chart type detection with empty data"""
        service = ChartService()
        chart_type = service.detect_chart_type([])
        assert chart_type == 'bar'  # Default fallback
    
    def test_format_data_for_chart(self):
        """Test data formatting for different chart types"""
        test_data = [
            {"month": "Jan", "sales": 100, "profit": 20},
            {"month": "Feb", "sales": 150, "profit": 30},
            {"month": "Mar", "sales": 200, "profit": 40}
        ]
        
        service = ChartService()
        
        # Test line chart formatting
        formatted = service.format_data_for_chart(test_data, 'line')
        assert 'labels' in formatted
        assert 'datasets' in formatted
        assert len(formatted['labels']) == 3
        
        # Test pie chart formatting
        formatted = service.format_data_for_chart(test_data, 'pie')
        assert 'labels' in formatted
        assert 'data' in formatted