import unittest
import json
from unittest.mock import patch, MagicMock
import os
from app import create_app
from app import db


class TestChartIntegration(unittest.TestCase):
    """Integration tests for chart generation API endpoints"""

    def setUp(self):
        """Set up test fixtures"""
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
        # Sample test data
        self.sample_data = [
            {"team": "Lakers", "wins": 45, "losses": 37},
            {"team": "Warriors", "wins": 44, "losses": 38},
            {"team": "Celtics", "wins": 57, "losses": 25}
        ]
        
        # Mock authorization headers
        self.auth_headers = {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
        }

    def tearDown(self):
        """Clean up after tests"""
        with self.app.app_context():
            db.drop_all()

    @patch('app.auth.routes.verify_firebase_token')
    @patch('app.services.chart_service.openai.OpenAI')
    def test_generate_chart_data_endpoint_success(self, mock_openai_class, mock_verify_token):
        """Test successful chart data generation endpoint"""
        # Mock Firebase token verification
        mock_verify_token.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
        
        # Mock OpenAI response
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        chart_response = {
            "chartType": "bar",
            "title": "Team Wins Analysis",
            "data": [
                {"category": "Lakers", "value": 45},
                {"category": "Warriors", "value": 44},
                {"category": "Celtics", "value": 57}
            ],
            "xAxis": "Teams",
            "yAxis": "Wins"
        }
        
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps(chart_response)
        mock_response.usage.total_tokens = 150
        mock_client.chat.completions.create.return_value = mock_response
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            response = self.client.post(
                '/api/v1/ai/chart/generate',
                headers=self.auth_headers,
                data=json.dumps({
                    'input_data': self.sample_data,
                    'chart_type': 'bar',
                    'title': 'Team Wins Analysis'
                })
            )
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('chart_data', data)
        self.assertEqual(data['chart_data']['chartType'], 'bar')
        self.assertEqual(data['tokens_used'], 150)

    @patch('app.auth.routes.verify_firebase_token')
    def test_generate_chart_data_endpoint_missing_data(self, mock_verify_token):
        """Test chart generation endpoint with missing input data"""
        mock_verify_token.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
        
        response = self.client.post(
            '/api/v1/ai/chart/generate',
            headers=self.auth_headers,
            data=json.dumps({
                'chart_type': 'bar'
                # Missing input_data
            })
        )
        
        self.assertEqual(response.status_code, 400)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('error', data)

    @patch('app.auth.routes.verify_firebase_token')
    def test_generate_chart_data_endpoint_invalid_chart_type(self, mock_verify_token):
        """Test chart generation endpoint with invalid chart type"""
        mock_verify_token.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
        
        response = self.client.post(
            '/api/v1/ai/chart/generate',
            headers=self.auth_headers,
            data=json.dumps({
                'input_data': self.sample_data,
                'chart_type': 'invalid_type'
            })
        )
        
        self.assertEqual(response.status_code, 400)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('error', data)
        self.assertIn('Invalid chart type', data['error'])

    def test_generate_chart_data_endpoint_unauthorized(self):
        """Test chart generation endpoint without authorization"""
        response = self.client.post(
            '/api/v1/ai/chart/generate',
            headers={'Content-Type': 'application/json'},
            data=json.dumps({
                'input_data': self.sample_data,
                'chart_type': 'bar'
            })
        )
        
        self.assertEqual(response.status_code, 401)

    @patch('app.auth.routes.verify_firebase_token')
    @patch('app.services.chart_service.openai.OpenAI')
    def test_generate_chart_data_endpoint_with_markdown_response(self, mock_openai_class, mock_verify_token):
        """Test chart generation endpoint handling markdown-wrapped response"""
        mock_verify_token.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
        
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        chart_data = {
            "chartType": "line",
            "title": "Performance Trend",
            "data": [{"x": "Q1", "y": 45}, {"x": "Q2", "y": 50}],
            "xAxis": "Quarter",
            "yAxis": "Performance"
        }
        
        # Response wrapped in markdown
        mock_response = MagicMock()
        mock_response.choices[0].message.content = f"```json\n{json.dumps(chart_data)}\n```"
        mock_response.usage.total_tokens = 120
        mock_client.chat.completions.create.return_value = mock_response
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            response = self.client.post(
                '/api/v1/ai/chart/generate',
                headers=self.auth_headers,
                data=json.dumps({
                    'input_data': self.sample_data,
                    'chart_type': 'line'
                })
            )
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['chart_data']['chartType'], 'line')

    @patch('app.auth.routes.verify_firebase_token')
    @patch('app.services.chart_service.openai.OpenAI')
    def test_generate_chart_data_endpoint_openai_error(self, mock_openai_class, mock_verify_token):
        """Test chart generation endpoint with OpenAI API error"""
        mock_verify_token.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
        
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        import openai
        mock_client.chat.completions.create.side_effect = openai.APIError("API Error", response=None, body=None)
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            response = self.client.post(
                '/api/v1/ai/chart/generate',
                headers=self.auth_headers,
                data=json.dumps({
                    'input_data': self.sample_data,
                    'chart_type': 'bar'
                })
            )
        
        self.assertEqual(response.status_code, 500)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('error', data)

    @patch('app.auth.routes.verify_firebase_token')
    def test_get_chart_types_endpoint(self, mock_verify_token):
        """Test getting available chart types endpoint"""
        mock_verify_token.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
        
        response = self.client.get(
            '/api/v1/ai/chart/types',
            headers=self.auth_headers
        )
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('chart_types', data)
        self.assertEqual(len(data['chart_types']), 3)
        
        # Verify all chart types have required fields
        for chart_type in data['chart_types']:
            self.assertIn('value', chart_type)
            self.assertIn('label', chart_type)
            self.assertIn('description', chart_type)

    @patch('app.auth.routes.verify_firebase_token')
    def test_validate_chart_config_endpoint_valid(self, mock_verify_token):
        """Test chart configuration validation endpoint with valid config"""
        mock_verify_token.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
        
        response = self.client.post(
            '/api/v1/ai/chart/validate',
            headers=self.auth_headers,
            data=json.dumps({
                'config': {
                    'chartType': 'bar',
                    'title': 'Test Chart'
                }
            })
        )
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['valid'])

    @patch('app.auth.routes.verify_firebase_token')
    def test_validate_chart_config_endpoint_invalid(self, mock_verify_token):
        """Test chart configuration validation endpoint with invalid config"""
        mock_verify_token.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
        
        response = self.client.post(
            '/api/v1/ai/chart/validate',
            headers=self.auth_headers,
            data=json.dumps({
                'config': {
                    'title': 'Test Chart'
                    # Missing chartType
                }
            })
        )
        
        self.assertEqual(response.status_code, 400)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertFalse(data['valid'])
        self.assertIn('error', data)

    @patch('app.auth.routes.verify_firebase_token')
    @patch('app.services.chart_service.openai.OpenAI')
    def test_full_workflow_integration(self, mock_openai_class, mock_verify_token):
        """Test full workflow from data input to chart generation"""
        mock_verify_token.return_value = {'uid': 'test-user', 'email': 'test@example.com'}
        
        # Step 1: Validate configuration
        config_response = self.client.post(
            '/api/v1/ai/chart/validate',
            headers=self.auth_headers,
            data=json.dumps({
                'config': {
                    'chartType': 'radar',
                    'title': 'Team Performance Analysis'
                }
            })
        )
        
        self.assertEqual(config_response.status_code, 200)
        self.assertTrue(json.loads(config_response.data)['valid'])
        
        # Step 2: Generate chart data
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client
        
        radar_chart_data = {
            "chartType": "radar",
            "title": "Team Performance Analysis",
            "data": [
                {
                    "subject": "Lakers",
                    "metrics": {"wins": 45, "losses": 37, "points": 112}
                }
            ],
            "metrics": ["wins", "losses", "points"]
        }
        
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps(radar_chart_data)
        mock_response.usage.total_tokens = 200
        mock_client.chat.completions.create.return_value = mock_response
        
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}):
            chart_response = self.client.post(
                '/api/v1/ai/chart/generate',
                headers=self.auth_headers,
                data=json.dumps({
                    'input_data': self.sample_data,
                    'chart_type': 'radar',
                    'title': 'Team Performance Analysis'
                })
            )
        
        self.assertEqual(chart_response.status_code, 200)
        
        chart_data = json.loads(chart_response.data)
        self.assertTrue(chart_data['success'])
        self.assertEqual(chart_data['chart_data']['chartType'], 'radar')
        self.assertEqual(chart_data['chart_data']['title'], 'Team Performance Analysis')


if __name__ == '__main__':
    unittest.main()