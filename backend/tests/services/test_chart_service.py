import unittest
from unittest.mock import patch, MagicMock
import json
import os
from app.services.chart_service import ChartService


class TestChartService(unittest.TestCase):
    """Unit tests for ChartService"""

    def setUp(self):
        """Set up test fixtures"""
        self.sample_data = [
            {"team": "Lakers", "wins": 45, "losses": 37},
            {"team": "Warriors", "wins": 44, "losses": 38},
            {"team": "Celtics", "wins": 57, "losses": 25}
        ]

    def test_get_chart_types(self):
        """Test getting available chart types"""
        chart_types = ChartService.get_chart_types()
        
        self.assertEqual(len(chart_types), 3)
        self.assertEqual(chart_types[0]['value'], 'bar')
        self.assertEqual(chart_types[1]['value'], 'line')
        self.assertEqual(chart_types[2]['value'], 'radar')
        
        # Verify all required fields are present
        for chart_type in chart_types:
            self.assertIn('value', chart_type)
            self.assertIn('label', chart_type)
            self.assertIn('description', chart_type)

    def test_validate_chart_config_valid(self):
        """Test validating valid chart configuration"""
        valid_config = {
            'chartType': 'bar',
            'title': 'Test Chart'
        }
        
        result = ChartService.validate_chart_config(valid_config)
        self.assertTrue(result['valid'])

    def test_validate_chart_config_missing_required_field(self):
        """Test validating chart config with missing required field"""
        invalid_config = {
            'title': 'Test Chart'
            # Missing chartType
        }
        
        result = ChartService.validate_chart_config(invalid_config)
        self.assertFalse(result['valid'])
        self.assertIn('Missing required field: chartType', result['error'])

    def test_validate_chart_config_invalid_chart_type(self):
        """Test validating chart config with invalid chart type"""
        invalid_config = {
            'chartType': 'invalid_type',
            'title': 'Test Chart'
        }
        
        result = ChartService.validate_chart_config(invalid_config)
        self.assertFalse(result['valid'])
        self.assertIn('Invalid chart type: invalid_type', result['error'])

    def test_generate_chart_data_invalid_chart_type(self):
        """Test chart generation with invalid chart type"""
        result = ChartService.generate_chart_data(
            self.sample_data, 
            'invalid_type'
        )
        
        self.assertIn('error', result)
        self.assertEqual(result['error'], 'Invalid chart type')

    def test_generate_chart_data_empty_data(self):
        """Test chart generation with empty input data"""
        result = ChartService.generate_chart_data([], 'bar')
        
        self.assertIn('error', result)
        self.assertEqual(result['error'], 'No input data provided')

    @patch('app.services.chart_service.openai.OpenAI')
    def test_generate_chart_data_successful_bar_chart(self, mock_openai_class):
        """Test successful bar chart generation"""
        # Mock the OpenAI response
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            "success": True,
            "chartType": "bar",
            "title": "NBA Team Wins",
            "data": [
                {"category": "Lakers", "value": 45},
                {"category": "Warriors", "value": 44},
                {"category": "Celtics", "value": 57}
            ],
            "xAxis": "Teams",
            "yAxis": "Wins",
            "error": "",
            "reason": ""
        })
        mock_response.usage.total_tokens = 150
        mock_client.chat.completions.create.return_value = mock_response
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            result = ChartService.generate_chart_data(self.sample_data, 'bar')
        
        # Verify structured output was used
        call_args = mock_client.chat.completions.create.call_args
        self.assertEqual(call_args[1]['model'], 'gpt-4o-2024-08-06')
        self.assertIn('response_format', call_args[1])
        
        self.assertTrue(result['success'])
        self.assertIn('chart_data', result)
        self.assertEqual(result['chart_data']['chartType'], 'bar')
        self.assertEqual(result['tokens_used'], 150)

    @patch('app.services.chart_service.openai.OpenAI')
    def test_generate_chart_data_structured_output(self, mock_openai_class):
        """Test chart generation with structured outputs (guaranteed JSON)"""
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        # Mock structured output response (clean JSON, no markdown)
        chart_data = {
            "success": True,
            "chartType": "line",
            "title": "Team Performance Over Time",
            "data": [
                {"x": "Q1", "y": 45},
                {"x": "Q2", "y": 50}
            ],
            "xAxis": "Quarter",
            "yAxis": "Performance",
            "error": "",
            "reason": ""
        }
        
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps(chart_data)
        mock_response.usage.total_tokens = 120
        mock_client.chat.completions.create.return_value = mock_response
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            result = ChartService.generate_chart_data(self.sample_data, 'line')
        
        # Verify structured output configuration
        call_args = mock_client.chat.completions.create.call_args
        self.assertEqual(call_args[1]['model'], 'gpt-4o-2024-08-06')
        response_format = call_args[1]['response_format']
        self.assertEqual(response_format['type'], 'json_schema')
        self.assertTrue(response_format['json_schema']['strict'])
        
        self.assertTrue(result['success'])
        self.assertIn('chart_data', result)
        self.assertEqual(result['chart_data']['chartType'], 'line')

    @patch('app.services.chart_service.openai.OpenAI')
    def test_generate_chart_data_openai_rate_limit_error(self, mock_openai_class):
        """Test handling of OpenAI rate limit error"""
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        import openai
        # Create a mock response object with request attribute
        mock_response = MagicMock()
        mock_response.request = MagicMock()
        mock_client.chat.completions.create.side_effect = openai.RateLimitError("Rate limit exceeded", response=mock_response, body=None)
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            result = ChartService.generate_chart_data(self.sample_data, 'bar')
        
        self.assertIn('error', result)
        self.assertEqual(result['error'], 'OpenAI API rate limit exceeded')

    @patch('app.services.chart_service.openai.OpenAI')
    def test_generate_chart_data_invalid_json_response(self, mock_openai_class):
        """Test handling of invalid JSON response from OpenAI"""
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "This is not valid JSON"
        mock_response.usage.total_tokens = 50
        mock_client.chat.completions.create.return_value = mock_response
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            result = ChartService.generate_chart_data(self.sample_data, 'bar')
        
        self.assertIn('error', result)
        self.assertEqual(result['error'], 'Invalid JSON response from structured output')

    def test_generate_chart_data_with_custom_title(self):
        """Test chart generation with custom title"""
        with patch('app.services.chart_service.openai.OpenAI') as mock_openai_class:
            mock_client = MagicMock()
            mock_openai_class.return_value = mock_client
            
            mock_response = MagicMock()
            mock_response.choices[0].message.content = json.dumps({
                "success": True,
                "chartType": "radar",
                "title": "Custom Team Analysis",
                "data": [{"subject": "Lakers", "values": [{"metric": "wins", "value": 45}, {"metric": "losses", "value": 37}]}],
                "metricNames": ["wins", "losses"],
                "error": "",
                "reason": ""
            })
            mock_response.usage.total_tokens = 180
            mock_client.chat.completions.create.return_value = mock_response
            
            with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
                result = ChartService.generate_chart_data(
                    self.sample_data, 
                    'radar',
                    title='Custom Team Analysis'
                )
            
            # Verify the custom title was included in the system prompt
            call_args = mock_client.chat.completions.create.call_args
            system_message = call_args[1]['messages'][0]['content']
            self.assertIn('Use this title for the chart: "Custom Team Analysis"', system_message)

    def test_system_prompts_exist_for_all_chart_types(self):
        """Test that system prompts and schemas exist for all supported chart types"""
        chart_types = ChartService.get_chart_types()
        
        for chart_type in chart_types:
            chart_value = chart_type['value']
            
            # Verify system prompts exist
            self.assertIn(chart_value, ChartService.SYSTEM_PROMPTS)
            
            # Verify schemas exist for structured outputs
            self.assertIn(chart_value, ChartService.CHART_SCHEMAS)
            
            # Verify prompt contains essential instructions
            prompt = ChartService.SYSTEM_PROMPTS[chart_value]
            self.assertIn('SUCCESS CASE', prompt)
            
            # Verify schema structure
            schema = ChartService.CHART_SCHEMAS[chart_value]
            self.assertEqual(schema['type'], 'json_schema')
            self.assertTrue(schema['json_schema']['strict'])
            self.assertEqual(schema['json_schema']['schema']['properties']['chartType']['enum'][0], chart_value)


if __name__ == '__main__':
    unittest.main()