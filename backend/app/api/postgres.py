"""
PostgreSQL API endpoints for database operations
"""
from flask import request, jsonify
from app.api import api_bp
from app.services.postgres_service import PostgresService
from app.auth import auth_required, get_current_user
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)


@api_bp.route('/postgres/test-connection', methods=['POST'])
@auth_required
def test_postgres_connection():
    """Test PostgreSQL database connection"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['host', 'database', 'username', 'password']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Test connection
        result = PostgresService.test_connection({
            'host': data.get('host'),
            'port': data.get('port', 5432),
            'database': data.get('database'),
            'username': data.get('username'),
            'password': data.get('password')
        })
        
        if result['success']:
            logger.info(f"User {user.user_id} successfully tested PostgreSQL connection to {data.get('host')}")
            return jsonify(result)
        else:
            logger.warning(f"User {user.user_id} failed PostgreSQL connection test: {result.get('error')}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Error testing PostgreSQL connection: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/postgres/tables', methods=['POST'])
@auth_required
def get_postgres_tables():
    """Get all tables from PostgreSQL database"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['host', 'database', 'username', 'password']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Get tables
        result = PostgresService.get_tables({
            'host': data.get('host'),
            'port': data.get('port', 5432),
            'database': data.get('database'),
            'username': data.get('username'),
            'password': data.get('password')
        })
        
        if result['success']:
            logger.info(f"User {user.user_id} retrieved {result.get('total_count', 0)} tables from PostgreSQL")
            return jsonify(result)
        else:
            logger.warning(f"User {user.user_id} failed to retrieve PostgreSQL tables: {result.get('error')}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Error retrieving PostgreSQL tables: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/postgres/table-details', methods=['POST'])
@auth_required
def get_postgres_table_details():
    """Get detailed information about a specific PostgreSQL table"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['host', 'database', 'username', 'password', 'table_name']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Get table details
        result = PostgresService.get_table_details(
            config={
                'host': data.get('host'),
                'port': data.get('port', 5432),
                'database': data.get('database'),
                'username': data.get('username'),
                'password': data.get('password')
            },
            table_name=data.get('table_name'),
            schema=data.get('schema', 'public')
        )
        
        if result['success']:
            table_name = f"{data.get('schema', 'public')}.{data.get('table_name')}"
            logger.info(f"User {user.user_id} retrieved details for PostgreSQL table {table_name}")
            return jsonify(result)
        else:
            logger.warning(f"User {user.user_id} failed to retrieve PostgreSQL table details: {result.get('error')}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Error retrieving PostgreSQL table details: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/postgres/query', methods=['POST'])
@auth_required
def execute_postgres_query():
    """Execute a SELECT query on PostgreSQL database"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['host', 'database', 'username', 'password', 'query']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Execute query
        result = PostgresService.execute_query(
            config={
                'host': data.get('host'),
                'port': data.get('port', 5432),
                'database': data.get('database'),
                'username': data.get('username'),
                'password': data.get('password')
            },
            query=data.get('query'),
            limit=data.get('limit', 1000)
        )
        
        if result['success']:
            logger.info(f"User {user.user_id} executed PostgreSQL query, returned {result.get('row_count', 0)} rows")
            return jsonify(result)
        else:
            logger.warning(f"User {user.user_id} failed to execute PostgreSQL query: {result.get('error')}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Error executing PostgreSQL query: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/postgres/insert', methods=['POST'])
@auth_required
def insert_postgres_data():
    """Insert data into PostgreSQL table"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['host', 'database', 'username', 'password', 'table_name', 'data']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Insert data
        result = PostgresService.insert_data(
            config={
                'host': data.get('host'),
                'port': data.get('port', 5432),
                'database': data.get('database'),
                'username': data.get('username'),
                'password': data.get('password')
            },
            table_name=data.get('table_name'),
            data=data.get('data'),
            schema=data.get('schema', 'public'),
            insert_mode=data.get('insert_mode', 'insert'),
            conflict_columns=data.get('conflict_columns', []),
            column_mappings=data.get('column_mappings', [])
        )
        
        if result['success']:
            table_name = f"{data.get('schema', 'public')}.{data.get('table_name')}"
            logger.info(f"User {user.user_id} inserted {result.get('rows_affected', 0)} rows into PostgreSQL table {table_name}")
            return jsonify(result)
        else:
            logger.warning(f"User {user.user_id} failed to insert data into PostgreSQL: {result.get('error')}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Error inserting data into PostgreSQL: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/postgres/create-table-and-insert', methods=['POST'])
@auth_required
def create_postgres_table_and_insert():
    """Create table dynamically and insert data"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['host', 'database', 'username', 'password', 'table_name', 'data']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Validate data is not empty
        input_data = data.get('data')
        if not input_data or not isinstance(input_data, list) or len(input_data) == 0:
            return jsonify({
                'success': False,
                'error': 'Data must be a non-empty array of objects'
            }), 400
        
        # Create table and insert data
        result = PostgresService.create_table_and_insert(
            config={
                'host': data.get('host'),
                'port': data.get('port', 5432),
                'database': data.get('database'),
                'username': data.get('username'),
                'password': data.get('password')
            },
            table_name=data.get('table_name'),
            data=input_data,
            schema=data.get('schema', 'public'),
            column_types=data.get('column_types')  # Optional user-selected column types
        )
        
        if result['success']:
            table_name = f"{data.get('schema', 'public')}.{data.get('table_name')}"
            logger.info(f"User {user.user_id} created dynamic table {table_name} and inserted {result.get('rows_affected', 0)} rows")
            return jsonify(result)
        else:
            logger.warning(f"User {user.user_id} failed to create dynamic PostgreSQL table: {result.get('error')}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Error creating dynamic PostgreSQL table: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/postgres/analyze-schema', methods=['POST'])
@auth_required
def analyze_postgres_schema():
    """Analyze data and suggest PostgreSQL column types for dynamic table creation"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        if not data.get('data') or not isinstance(data.get('data'), list):
            return jsonify({
                'success': False,
                'error': 'Data must be a non-empty array of objects'
            }), 400
        
        input_data = data.get('data')
        if len(input_data) == 0:
            return jsonify({
                'success': False,
                'error': 'Data array cannot be empty'
            }), 400
        
        # Analyze each column in the data
        first_row = input_data[0]
        if not isinstance(first_row, dict):
            return jsonify({
                'success': False,
                'error': 'Data items must be objects'
            }), 400
        
        column_analysis = []
        
        for column_name in first_row.keys():
            # Get the inferred type using the same logic as dynamic table creation
            inferred_type = PostgresService._infer_column_type(input_data, column_name)
            
            # Analyze possible types for this column
            possible_types = _analyze_possible_types(input_data, column_name)
            
            # Clean column name for PostgreSQL
            clean_column_name = ''.join(c if c.isalnum() or c == '_' else '_' for c in column_name.lower())
            if clean_column_name[0].isdigit():
                clean_column_name = f"col_{clean_column_name}"
            
            column_analysis.append({
                'original_name': column_name,
                'clean_name': clean_column_name,
                'inferred_type': inferred_type,
                'possible_types': possible_types,
                'sample_values': _get_sample_values(input_data, column_name, 5)
            })
        
        logger.info(f"User {user.user_id} analyzed schema for {len(column_analysis)} columns")
        
        return jsonify({
            'success': True,
            'columns': column_analysis,
            'row_count': len(input_data)
        })
        
    except Exception as e:
        logger.error(f"Error analyzing PostgreSQL schema: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def _analyze_possible_types(data: List[Dict[str, Any]], column_name: str) -> List[Dict[str, Any]]:
    """Analyze all possible PostgreSQL types for a column based on its values"""
    possible_types = []
    non_null_values = [row.get(column_name) for row in data if row.get(column_name) is not None]
    
    if not non_null_values:
        # If all values are null, all types are possible
        return [
            {'type': 'TEXT', 'confidence': 100, 'description': 'Default for null values'},
            {'type': 'INTEGER', 'confidence': 100, 'description': 'Could store integers'},
            {'type': 'NUMERIC', 'confidence': 100, 'description': 'Could store decimal numbers'},
            {'type': 'BOOLEAN', 'confidence': 100, 'description': 'Could store true/false'},
            {'type': 'JSONB', 'confidence': 100, 'description': 'Could store complex objects'},
            {'type': 'TIMESTAMP', 'confidence': 100, 'description': 'Could store dates/times'}
        ]
    
    # Check if values contain complex types (dict/list)
    has_complex = any(isinstance(v, (dict, list)) for v in non_null_values)
    if has_complex:
        possible_types.append({
            'type': 'JSONB',
            'confidence': 100,
            'description': 'Contains nested objects or arrays'
        })
        # JSONB can also be stored as TEXT
        possible_types.append({
            'type': 'TEXT',
            'confidence': 80,
            'description': 'Can store as JSON string'
        })
        return possible_types
    
    # Check numeric compatibility
    all_numeric = True
    all_integer = True
    for value in non_null_values:
        if isinstance(value, (int, float)):
            if not isinstance(value, int) and not (isinstance(value, float) and value.is_integer()):
                all_integer = False
        elif isinstance(value, str):
            try:
                parsed = float(value.strip())
                if not parsed.is_integer():
                    all_integer = False
            except (ValueError, AttributeError):
                all_numeric = False
                all_integer = False
                break
        else:
            all_numeric = False
            all_integer = False
            break
    
    if all_numeric:
        if all_integer:
            possible_types.append({
                'type': 'INTEGER',
                'confidence': 100,
                'description': 'All values are integers'
            })
        possible_types.append({
            'type': 'NUMERIC',
            'confidence': 100,
            'description': 'All values are numbers'
        })
    
    # Check boolean compatibility
    boolean_values = {'true', 'false', 'yes', 'no', '1', '0', 'on', 'off', 't', 'f', 'y', 'n'}
    all_boolean = all(
        isinstance(v, bool) or str(v).lower().strip() in boolean_values 
        for v in non_null_values
    )
    if all_boolean:
        possible_types.append({
            'type': 'BOOLEAN',
            'confidence': 100,
            'description': 'All values represent true/false'
        })
    
    # Check date/timestamp compatibility
    import re
    date_patterns = [
        (r'^\d{4}-\d{2}-\d{2}$', 'DATE'),
        (r'^\d{2}/\d{2}/\d{4}$', 'DATE'),
        (r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}', 'TIMESTAMP'),
        (r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', 'TIMESTAMP'),
    ]
    
    for pattern, date_type in date_patterns:
        if all(isinstance(v, str) and re.match(pattern, v.strip()) for v in non_null_values):
            possible_types.append({
                'type': date_type,
                'confidence': 100,
                'description': f'All values match {date_type} format'
            })
            break
    
    # TEXT is always possible for string data
    possible_types.append({
        'type': 'TEXT',
        'confidence': 100,
        'description': 'Universal text storage'
    })
    
    # VARCHAR if strings have consistent length
    if all(isinstance(v, str) for v in non_null_values):
        max_length = max(len(str(v)) for v in non_null_values)
        if max_length <= 255:
            possible_types.append({
                'type': f'VARCHAR({min(max_length * 2, 255)})',
                'confidence': 90,
                'description': f'Max length: {max_length} chars'
            })
    
    return possible_types


def _get_sample_values(data: List[Dict[str, Any]], column_name: str, limit: int = 5) -> List[Any]:
    """Get sample values from a column for preview"""
    values = []
    seen = set()
    
    for row in data:
        value = row.get(column_name)
        # Convert complex types to string representation for display
        if isinstance(value, (dict, list)):
            value_str = str(value)[:50] + '...' if len(str(value)) > 50 else str(value)
            if value_str not in seen:
                values.append(value)
                seen.add(value_str)
        elif value is not None:
            value_str = str(value)
            if value_str not in seen:
                values.append(value)
                seen.add(value_str)
        
        if len(values) >= limit:
            break
    
    return values