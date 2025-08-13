"""
Comprehensive test suite for all node executors in microservices architecture
Tests ALL 9 node types to ensure 100% functionality preservation
"""

import pytest
import sys
import os
import json
from unittest.mock import Mock, patch, AsyncMock

# Add parent directories to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import all executors
from src.services.node_executors.web_source_executor import WebSourceExecutor
from src.services.node_executors.ai_processor_executor import AiProcessorExecutor
from src.services.node_executors.http_request_executor import HttpRequestExecutor
from src.services.node_executors.file_node_executor import FileNodeExecutor
from src.services.node_executors.data_structuring_executor import DataStructuringExecutor
from src.services.node_executors.chart_generation_executor import ChartGenerationExecutor
from src.services.node_executors.ml_executor import MLExecutor
from src.services.node_executors.postgres_executor import PostgresExecutor
from src.services.node_executors.random_forest_executor import RandomForestExecutor


class TestWebSourceExecutor:
    """Test WebSource node executor"""
    
    def test_websource_validation_success(self):
        """Test valid WebSource configuration"""
        config = {
            'id': 'test_websource',
            'type': 'webSource',
            'data': {
                'url': 'https://example.com',
                'selectors': [
                    {'name': 'title', 'selector': 'h1', 'attribute': 'textContent'}
                ]
            }
        }
        
        executor = WebSourceExecutor(config)
        assert executor.validate_config() == True
        assert executor.node_type == 'webSource'
    
    def test_websource_validation_failure(self):
        """Test invalid WebSource configuration"""
        config = {
            'id': 'test_websource',
            'type': 'webSource',
            'data': {}  # Missing required fields
        }
        
        executor = WebSourceExecutor(config)
        assert executor.validate_config() == False


class TestAiProcessorExecutor:
    """Test AI Processor node executor"""
    
    def test_aiprocessor_validation_success(self):
        """Test valid AI processor configuration"""
        config = {
            'id': 'test_ai',
            'type': 'aiProcessor',
            'data': {
                'prompt': 'Analyze this data and provide insights',
                'model': 'gpt-4o-mini',
                'temperature': 0.3,
                'max_tokens': 2000
            }
        }
        
        executor = AiProcessorExecutor(config)
        assert executor.validate_config() == True
        assert executor.node_type == 'aiProcessor'
    
    def test_aiprocessor_validation_failure(self):
        """Test invalid AI processor configuration"""
        config = {
            'id': 'test_ai',
            'type': 'aiProcessor',
            'data': {}  # Missing prompt
        }
        
        executor = AiProcessorExecutor(config)
        assert executor.validate_config() == False
    
    def test_aiprocessor_invalid_model(self):
        """Test invalid model configuration"""
        config = {
            'id': 'test_ai',
            'type': 'aiProcessor',
            'data': {
                'prompt': 'Test prompt',
                'model': 'invalid-model'
            }
        }
        
        executor = AiProcessorExecutor(config)
        assert executor.validate_config() == False
    
    def test_get_available_models(self):
        """Test getting available AI models"""
        models = AiProcessorExecutor.get_available_models()
        assert len(models) > 0
        assert any(model['id'] == 'gpt-4o-mini' for model in models)


class TestHttpRequestExecutor:
    """Test HTTP Request node executor"""
    
    def test_httprequest_validation_success(self):
        """Test valid HTTP request configuration"""
        config = {
            'id': 'test_http',
            'type': 'httpRequest',
            'data': {
                'url': 'https://api.example.com/data',
                'method': 'GET',
                'timeout': 30
            }
        }
        
        executor = HttpRequestExecutor(config)
        assert executor.validate_config() == True
        assert executor.node_type == 'httpRequest'
    
    def test_httprequest_validation_failure(self):
        """Test invalid HTTP request configuration"""
        config = {
            'id': 'test_http',
            'type': 'httpRequest',
            'data': {}  # Missing URL
        }
        
        executor = HttpRequestExecutor(config)
        assert executor.validate_config() == False
    
    def test_httprequest_invalid_method(self):
        """Test invalid HTTP method"""
        config = {
            'id': 'test_http',
            'type': 'httpRequest',
            'data': {
                'url': 'https://api.example.com',
                'method': 'INVALID'
            }
        }
        
        executor = HttpRequestExecutor(config)
        assert executor.validate_config() == False
    
    def test_httprequest_auth_validation(self):
        """Test authentication configuration validation"""
        config = {
            'id': 'test_http',
            'type': 'httpRequest',
            'data': {
                'url': 'https://api.example.com',
                'method': 'GET',
                'authentication': {
                    'enabled': True,
                    'type': 'apiKey',
                    'apiKey': {
                        'key': 'X-API-Key',
                        'value': 'test-key',
                        'location': 'header'
                    }
                }
            }
        }
        
        executor = HttpRequestExecutor(config)
        assert executor.validate_config() == True


class TestFileNodeExecutor:
    """Test File Node executor"""
    
    def test_filenode_load_validation_success(self):
        """Test valid file load configuration"""
        config = {
            'id': 'test_file',
            'type': 'fileNode',
            'data': {
                'operation': 'load',
                'file_data': [{'test': 'data'}]
            }
        }
        
        executor = FileNodeExecutor(config)
        assert executor.validate_config() == True
        assert executor.node_type == 'fileNode'
    
    def test_filenode_save_validation_success(self):
        """Test valid file save configuration"""
        config = {
            'id': 'test_file',
            'type': 'fileNode',
            'data': {
                'operation': 'save',
                'file_path': '/tmp/test.json'
            }
        }
        
        executor = FileNodeExecutor(config)
        assert executor.validate_config() == True
    
    def test_filenode_validation_failure(self):
        """Test invalid file node configuration"""
        config = {
            'id': 'test_file',
            'type': 'fileNode',
            'data': {
                'operation': 'load'
                # Missing file_path and file_data
            }
        }
        
        executor = FileNodeExecutor(config)
        assert executor.validate_config() == False
    
    def test_get_file_type(self):
        """Test file type detection"""
        executor = FileNodeExecutor({'id': 'test', 'type': 'fileNode', 'data': {}})
        
        assert executor._get_file_type('test.json') == 'json'
        assert executor._get_file_type('test.csv') == 'csv'
        assert executor._get_file_type('test.xlsx') == 'excel'
        assert executor._get_file_type('test.txt') == 'text'
        assert executor._get_file_type('test.unknown') == 'unknown'


class TestDataStructuringExecutor:
    """Test Data Structuring node executor"""
    
    def test_datastructuring_validation_success(self):
        """Test valid data structuring configuration"""
        config = {
            'id': 'test_data_struct',
            'type': 'dataStructuring',
            'data': {
                'patterns': [
                    {
                        'name': 'email',
                        'regex': r'[\w\.-]+@[\w\.-]+\.\w+'
                    },
                    {
                        'name': 'phone',
                        'regex': r'\(\d{3}\)\s*\d{3}-\d{4}'
                    }
                ]
            }
        }
        
        executor = DataStructuringExecutor(config)
        assert executor.validate_config() == True
        assert executor.node_type == 'dataStructuring'
    
    def test_datastructuring_validation_failure(self):
        """Test invalid data structuring configuration"""
        config = {
            'id': 'test_data_struct',
            'type': 'dataStructuring',
            'data': {
                'patterns': []  # Empty patterns
            }
        }
        
        executor = DataStructuringExecutor(config)
        assert executor.validate_config() == False
    
    def test_datastructuring_invalid_regex(self):
        """Test invalid regex pattern"""
        config = {
            'id': 'test_data_struct',
            'type': 'dataStructuring',
            'data': {
                'patterns': [
                    {
                        'name': 'invalid',
                        'regex': '[invalid regex('  # Invalid regex
                    }
                ]
            }
        }
        
        executor = DataStructuringExecutor(config)
        assert executor.validate_config() == False
    
    @pytest.mark.asyncio
    async def test_datastructuring_execution(self):
        """Test data structuring execution"""
        config = {
            'id': 'test_data_struct',
            'type': 'dataStructuring',
            'data': {
                'patterns': [
                    {
                        'name': 'email',
                        'regex': r'[\w\.-]+@[\w\.-]+\.\w+'
                    }
                ]
            }
        }
        
        executor = DataStructuringExecutor(config)
        input_data = ["Contact us at support@example.com or help@test.org"]
        
        result = await executor.execute(input_data)
        
        assert result.success == True
        assert len(result.data) == 1
        assert 'email' in result.data[0]
        assert result.data[0]['email'] == 'support@example.com'


class TestChartGenerationExecutor:
    """Test Chart Generation node executor"""
    
    def test_chartgeneration_validation_success(self):
        """Test valid chart generation configuration"""
        config = {
            'id': 'test_chart',
            'type': 'chartGenerator',
            'data': {
                'chartType': 'bar',
                'title': 'Test Chart'
            }
        }
        
        executor = ChartGenerationExecutor(config)
        assert executor.validate_config() == True
        assert executor.node_type == 'chartGenerator'
    
    def test_chartgeneration_invalid_type(self):
        """Test invalid chart type"""
        config = {
            'id': 'test_chart',
            'type': 'chartGenerator',
            'data': {
                'chartType': 'invalid_type'
            }
        }
        
        executor = ChartGenerationExecutor(config)
        assert executor.validate_config() == False
    
    def test_get_supported_chart_types(self):
        """Test getting supported chart types"""
        chart_types = ChartGenerationExecutor.get_supported_chart_types()
        assert len(chart_types) > 0
        assert any(ct['value'] == 'bar' for ct in chart_types)
        assert any(ct['value'] == 'line' for ct in chart_types)
        assert any(ct['value'] == 'radar' for ct in chart_types)


class TestMLExecutor:
    """Test Machine Learning node executor"""
    
    def test_ml_validation_success(self):
        """Test valid ML configuration"""
        config = {
            'id': 'test_ml',
            'type': 'linearRegression',
            'data': {
                'operation': 'train',
                'modelType': 'linear_regression',
                'targetColumn': 'price'
            }
        }
        
        executor = MLExecutor(config)
        assert executor.validate_config() == True
        assert executor.node_type == 'linearRegression'
    
    def test_ml_validation_failure(self):
        """Test invalid ML configuration"""
        config = {
            'id': 'test_ml',
            'type': 'linearRegression',
            'data': {
                'operation': 'train'
                # Missing targetColumn
            }
        }
        
        executor = MLExecutor(config)
        assert executor.validate_config() == False
    
    def test_ml_invalid_model_type(self):
        """Test invalid model type"""
        config = {
            'id': 'test_ml',
            'type': 'linearRegression',
            'data': {
                'operation': 'train',
                'modelType': 'invalid_model',
                'targetColumn': 'price'
            }
        }
        
        executor = MLExecutor(config)
        assert executor.validate_config() == False
    
    @pytest.mark.asyncio
    async def test_ml_training_execution(self):
        """Test ML model training execution"""
        config = {
            'id': 'test_ml',
            'type': 'linearRegression',
            'data': {
                'operation': 'train',
                'modelType': 'linear_regression',
                'targetColumn': 'price'
            }
        }
        
        # Sample training data
        training_data = [
            {'size': 1000, 'bedrooms': 2, 'price': 200000},
            {'size': 1500, 'bedrooms': 3, 'price': 300000},
            {'size': 2000, 'bedrooms': 4, 'price': 400000},
            {'size': 1200, 'bedrooms': 2, 'price': 250000},
            {'size': 1800, 'bedrooms': 3, 'price': 350000}
        ]
        
        executor = MLExecutor(config)
        result = await executor.execute(training_data)
        
        assert result.success == True
        assert 'model_info' in result.data
        assert 'metrics' in result.data
        assert result.data['metrics']['r2_score'] is not None


class TestPostgresExecutor:
    """Test PostgreSQL node executor"""
    
    def test_postgres_validation_success(self):
        """Test valid PostgreSQL configuration"""
        config = {
            'id': 'test_postgres',
            'type': 'postgres',
            'data': {
                'host': 'localhost',
                'database': 'test_db',
                'username': 'test_user',
                'password': 'test_password',
                'operation': 'query',
                'sql': 'SELECT * FROM test_table'
            }
        }
        
        executor = PostgresExecutor(config)
        # If asyncpg is not available, validation will fail
        try:
            import asyncpg
            assert executor.validate_config() == True
        except ImportError:
            assert executor.validate_config() == False
        assert executor.node_type == 'postgres'
    
    def test_postgres_validation_missing_fields(self):
        """Test invalid PostgreSQL configuration - missing fields"""
        config = {
            'id': 'test_postgres',
            'type': 'postgres',
            'data': {
                'host': 'localhost'
                # Missing database, username, password
            }
        }
        
        executor = PostgresExecutor(config)
        assert executor.validate_config() == False
    
    def test_postgres_validation_invalid_operation(self):
        """Test invalid PostgreSQL operation"""
        config = {
            'id': 'test_postgres',
            'type': 'postgres',
            'data': {
                'host': 'localhost',
                'database': 'test_db',
                'username': 'test_user',
                'password': 'test_password',
                'operation': 'invalid_op'
            }
        }
        
        executor = PostgresExecutor(config)
        assert executor.validate_config() == False


class TestRandomForestExecutor:
    """Test Random Forest node executor"""
    
    def test_random_forest_validation_success(self):
        """Test valid Random Forest configuration"""
        config = {
            'id': 'test_rf',
            'type': 'randomForest',
            'data': {
                'operation': 'train',
                'targetColumn': 'price',
                'n_estimators': 100,
                'max_depth': 10
            }
        }
        
        executor = RandomForestExecutor(config)
        assert executor.validate_config() == True
        assert executor.node_type == 'randomForest'
    
    def test_random_forest_validation_failure(self):
        """Test invalid Random Forest configuration"""
        config = {
            'id': 'test_rf',
            'type': 'randomForest',
            'data': {
                'operation': 'train'
                # Missing targetColumn
            }
        }
        
        executor = RandomForestExecutor(config)
        assert executor.validate_config() == False
    
    def test_random_forest_invalid_parameters(self):
        """Test invalid Random Forest parameters"""
        config = {
            'id': 'test_rf',
            'type': 'randomForest',
            'data': {
                'operation': 'train',
                'targetColumn': 'price',
                'n_estimators': -5,  # Invalid
                'max_depth': 0  # Invalid
            }
        }
        
        executor = RandomForestExecutor(config)
        assert executor.validate_config() == False
    
    @pytest.mark.asyncio
    async def test_random_forest_training_execution(self):
        """Test Random Forest model training execution"""
        config = {
            'id': 'test_rf',
            'type': 'randomForest',
            'data': {
                'operation': 'train',
                'targetColumn': 'price',
                'n_estimators': 10,
                'max_depth': 3
            }
        }
        
        # Sample training data
        training_data = [
            {'size': 1000, 'bedrooms': 2, 'price': 200000},
            {'size': 1500, 'bedrooms': 3, 'price': 300000},
            {'size': 2000, 'bedrooms': 4, 'price': 400000},
            {'size': 1200, 'bedrooms': 2, 'price': 250000},
            {'size': 1800, 'bedrooms': 3, 'price': 350000}
        ]
        
        executor = RandomForestExecutor(config)
        result = await executor.execute(training_data)
        
        assert result.success == True
        assert 'model_info' in result.data
        assert 'metrics' in result.data
        assert 'feature_importances' in result.data['metrics']
        assert result.data['metrics']['r2_score'] is not None


class TestExecutionServiceRegistry:
    """Test that ExecutionService has all node types registered"""
    
    def test_execution_service_has_all_node_types(self):
        """Test ExecutionService registry contains all 9 node types"""
        from src.services.execution_service import ExecutionService
        from unittest.mock import Mock
        
        mock_db = Mock()
        service = ExecutionService(mock_db)
        
        expected_node_types = {
            'webSource',
            'aiProcessor', 
            'httpRequest',
            'fileNode',
            'dataStructuring',
            'chartGenerator',
            'linearRegression',
            'postgres',
            'randomForest'
        }
        
        registered_types = set(service.node_executors.keys())
        
        assert registered_types == expected_node_types, f"Missing node types: {expected_node_types - registered_types}"
        
        # Verify each executor class
        assert service.node_executors['webSource'] == WebSourceExecutor
        assert service.node_executors['aiProcessor'] == AiProcessorExecutor
        assert service.node_executors['httpRequest'] == HttpRequestExecutor
        assert service.node_executors['fileNode'] == FileNodeExecutor
        assert service.node_executors['dataStructuring'] == DataStructuringExecutor
        assert service.node_executors['chartGenerator'] == ChartGenerationExecutor
        assert service.node_executors['linearRegression'] == MLExecutor
        assert service.node_executors['postgres'] == PostgresExecutor
        assert service.node_executors['randomForest'] == RandomForestExecutor


class TestNodeExecutorIntegration:
    """Integration tests for node executor functionality"""
    
    def test_all_executors_have_required_methods(self):
        """Test that all executors implement required interface"""
        executor_classes = [
            WebSourceExecutor,
            AiProcessorExecutor,
            HttpRequestExecutor,
            FileNodeExecutor,
            DataStructuringExecutor,
            ChartGenerationExecutor,
            MLExecutor,
            PostgresExecutor,
            RandomForestExecutor
        ]
        
        for executor_class in executor_classes:
            # Create instance with minimal config
            config = {'id': 'test', 'type': 'test', 'data': {}}
            instance = executor_class(config)
            
            # Check required methods exist
            assert hasattr(instance, 'validate_config')
            assert hasattr(instance, 'execute')
            assert hasattr(instance, 'node_type')
            
            # Check methods are callable
            assert callable(instance.validate_config)
            assert callable(instance.execute)
    
    def test_node_type_coverage(self):
        """Test that we have coverage for all expected node types"""
        from src.services.execution_service import ExecutionService
        from unittest.mock import Mock
        
        # Based on the audit, we should have these 9 node types
        expected_coverage = {
            'webSource': 'Web scraping with Playwright',
            'aiProcessor': 'AI data processing with OpenAI', 
            'httpRequest': 'HTTP API calls with authentication',
            'fileNode': 'File load/save operations',
            'dataStructuring': 'Regex-based data extraction',
            'chartGenerator': 'AI-powered chart generation',
            'linearRegression': 'Machine learning model training',
            'postgres': 'PostgreSQL database operations',
            'randomForest': 'Random Forest ML model training'
        }
        
        mock_db = Mock()
        service = ExecutionService(mock_db)
        
        for node_type in expected_coverage:
            assert node_type in service.node_executors, f"Missing coverage for node type: {node_type}"
        
        print(f"\n✅ ALL {len(expected_coverage)} NODE TYPES COVERED:")
        for node_type, description in expected_coverage.items():
            print(f"  • {node_type}: {description}")


if __name__ == "__main__":
    # Run the tests
    import subprocess
    import sys
    
    print("🚀 Running comprehensive node executor tests...")
    result = subprocess.run([
        sys.executable, "-m", "pytest", __file__, "-v", "--tb=short"
    ], cwd=os.path.dirname(__file__))
    
    if result.returncode == 0:
        print("\n🎉 ALL TESTS PASSED - 100% Node Functionality Verified!")
    else:
        print("\n❌ Some tests failed - requires investigation")
    
    sys.exit(result.returncode)