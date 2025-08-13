"""
PostgreSQL Executor

Database connection and query execution for PostgreSQL
Extracted from backend/app/api/postgres.py
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List
try:
    import asyncpg
except ImportError:
    asyncpg = None
from .base_executor import BaseNodeExecutor, NodeExecutionResult

logger = logging.getLogger(__name__)


class PostgresExecutor(BaseNodeExecutor):
    """Execute PostgreSQL database operations"""
    
    def __init__(self, node_config: Dict[str, Any]):
        super().__init__(node_config)
        self.node_type = 'postgres'
    
    def validate_config(self) -> bool:
        """Validate PostgreSQL node configuration"""
        try:
            if asyncpg is None:
                logger.warning("asyncpg not available - PostgreSQL functionality disabled")
                return False
            data = self.node_config.get('data', {})
            
            # Required connection fields
            required_fields = ['host', 'database', 'username', 'password']
            missing_fields = [field for field in required_fields if not data.get(field)]
            
            if missing_fields:
                logger.error(f"PostgreSQL node missing required fields: {missing_fields}")
                return False
            
            # Validate operation
            operation = data.get('operation', 'query')
            if operation not in ['query', 'insert', 'update', 'delete', 'test']:
                logger.error(f"Invalid PostgreSQL operation: {operation}")
                return False
            
            # For non-test operations, require SQL
            if operation != 'test' and not data.get('sql'):
                logger.error("PostgreSQL node requires 'sql' field for database operations")
                return False
            
            # Validate port
            port = data.get('port', 5432)
            if not isinstance(port, int) or port <= 0 or port > 65535:
                logger.error(f"Invalid port number: {port}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating PostgreSQL config: {e}")
            return False
    
    async def execute(self, input_data: Optional[Any] = None) -> NodeExecutionResult:
        """Execute PostgreSQL node"""
        try:
            if asyncpg is None:
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=False,
                    data=None,
                    error="asyncpg not available - install asyncpg to use PostgreSQL functionality",
                    metadata={'error_type': 'dependency_missing'}
                )
            # Get configuration
            data = self.node_config.get('data', {})
            operation = data.get('operation', 'query')
            
            # Connection parameters
            conn_params = {
                'host': data.get('host'),
                'port': data.get('port', 5432),
                'database': data.get('database'),
                'user': data.get('username'),
                'password': data.get('password')
            }
            
            if operation == 'test':
                return await self._test_connection(conn_params)
            else:
                return await self._execute_sql(conn_params, data, input_data)
        
        except Exception as e:
            logger.error(f"Error in PostgreSQL execution: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"PostgreSQL execution failed: {str(e)}",
                metadata={'error_type': 'general_error'}
            )
    
    async def _test_connection(self, conn_params: Dict[str, Any]) -> NodeExecutionResult:
        """Test PostgreSQL connection"""
        try:
            conn = await asyncpg.connect(**conn_params)
            
            # Test with a simple query
            version = await conn.fetchval('SELECT version()')
            await conn.close()
            
            return NodeExecutionResult(
                node_id=self.node_id,
                success=True,
                data={
                    'message': 'Connection successful',
                    'version': version,
                    'host': conn_params['host'],
                    'database': conn_params['database']
                },
                error=None,
                metadata={
                    'operation': 'test',
                    'connection_successful': True
                }
            )
            
        except Exception as e:
            logger.error(f"PostgreSQL connection test failed: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"Database connection failed: {str(e)}",
                metadata={'error_type': 'connection_error'}
            )
    
    async def _execute_sql(
        self, 
        conn_params: Dict[str, Any], 
        config: Dict[str, Any], 
        input_data: Optional[Any]
    ) -> NodeExecutionResult:
        """Execute SQL query"""
        try:
            conn = await asyncpg.connect(**conn_params)
            
            # Get SQL query
            sql = config.get('sql')
            operation = config.get('operation', 'query')
            
            # Apply variable substitution if input data provided
            if input_data and isinstance(input_data, dict):
                sql = self._substitute_variables(sql, input_data)
            
            # Execute based on operation type
            if operation == 'query':
                rows = await conn.fetch(sql)
                result_data = [dict(row) for row in rows]
                
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=True,
                    data=result_data,
                    error=None,
                    metadata={
                        'operation': 'query',
                        'row_count': len(result_data),
                        'columns': list(result_data[0].keys()) if result_data else []
                    }
                )
                
            elif operation in ['insert', 'update', 'delete']:
                affected_rows = await conn.execute(sql)
                
                # Parse affected rows count from status
                import re
                match = re.search(r'(\d+)$', affected_rows)
                rows_affected = int(match.group(1)) if match else 0
                
                await conn.close()
                
                return NodeExecutionResult(
                    node_id=self.node_id,
                    success=True,
                    data={
                        'message': f'{operation.capitalize()} completed successfully',
                        'rows_affected': rows_affected,
                        'status': affected_rows
                    },
                    error=None,
                    metadata={
                        'operation': operation,
                        'rows_affected': rows_affected
                    }
                )
            
            await conn.close()
            
        except Exception as e:
            logger.error(f"PostgreSQL SQL execution failed: {e}")
            return NodeExecutionResult(
                node_id=self.node_id,
                success=False,
                data=None,
                error=f"SQL execution failed: {str(e)}",
                metadata={'error_type': 'sql_error', 'operation': operation}
            )
    
    def _substitute_variables(self, sql: str, variables: Dict[str, Any]) -> str:
        """Substitute variables in SQL query"""
        import re
        
        def replace_var(match):
            var_name = match.group(1).strip()
            if var_name in variables:
                value = variables[var_name]
                # Simple SQL injection protection - escape single quotes
                if isinstance(value, str):
                    escaped_value = value.replace("'", "''")
                    return f"'{escaped_value}'"
                return str(value)
            return match.group(0)  # Return original if not found
        
        return re.sub(r'\{\{([^}]+)\}\}', replace_var, sql)