from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging
import asyncpg
import asyncio
import pandas as pd
from ..auth import get_current_user, AuthUser
from ..database import get_db

router = APIRouter(prefix="/api/v1/postgres", tags=["postgres"])
logger = logging.getLogger(__name__)

# Database connection configuration
async def create_postgres_connection(
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    ssl_mode: str = 'prefer'
) -> asyncpg.Connection:
    """Create PostgreSQL connection with proper error handling"""
    try:
        # Build connection string
        ssl_context = None if ssl_mode == 'disable' else ssl_mode
        
        connection = await asyncpg.connect(
            host=host,
            port=port,
            database=database,
            user=username,
            password=password,
            ssl=ssl_context,
            timeout=10.0
        )
        
        return connection
    
    except Exception as e:
        logger.error(f"Failed to connect to PostgreSQL: {str(e)}")
        raise Exception(f"Database connection failed: {str(e)}")

@router.post("/test-connection")
async def test_postgres_connection(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """Test PostgreSQL database connection - matches original Flask API"""
    try:
        # Validate required fields (matching original API)
        required_fields = ['host', 'database', 'username', 'password']
        missing_fields = [field for field in required_fields if not request_data.get(field)]
        
        if missing_fields:
            return {
                "success": False,
                "error": f'Missing required fields: {", ".join(missing_fields)}'
            }
        
        # Extract connection parameters directly from request (matching original API)
        host = request_data.get('host')
        port = int(request_data.get('port', 5432))
        database = request_data.get('database')
        username = request_data.get('username')
        password = request_data.get('password')
        
        # Test connection
        connection = await create_postgres_connection(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password
        )
        
        # Test basic query
        version = await connection.fetchval("SELECT version()")
        server_info = await connection.fetchrow("""
            SELECT 
                current_database() as database_name,
                current_user as current_user,
                inet_server_addr() as server_address,
                inet_server_port() as server_port
        """)
        
        await connection.close()
        
        return {
            "success": True,
            "message": "Connection successful",
            "server_info": {
                "version": version,
                "database_name": server_info['database_name'],
                "current_user": server_info['current_user'],
                "server_address": server_info['server_address'],
                "server_port": server_info['server_port']
            }
        }
        
    except Exception as e:
        logger.error(f"PostgreSQL connection test failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/tables")
async def get_postgres_tables(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """Get all tables from PostgreSQL database - matches original Flask API"""
    try:
        # Validate required fields (matching original API)
        required_fields = ['host', 'database', 'username', 'password']
        missing_fields = [field for field in required_fields if not request_data.get(field)]
        
        if missing_fields:
            return {
                "success": False,
                "error": f'Missing required fields: {", ".join(missing_fields)}'
            }
        
        host = request_data.get('host')
        port = int(request_data.get('port', 5432))
        database = request_data.get('database')
        username = request_data.get('username')
        password = request_data.get('password')
        schema = request_data.get('schema', 'public')
        
        connection = await create_postgres_connection(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password
        )
        
        # Get tables with additional metadata
        tables_query = """
            SELECT 
                t.table_name,
                t.table_type,
                COALESCE(pg_class.reltuples::bigint, 0) as estimated_row_count,
                COALESCE(pg_size_pretty(pg_total_relation_size((t.table_schema||'.'||t.table_name)::regclass)), '0 bytes') as table_size,
                (
                    SELECT COUNT(*)::bigint
                    FROM information_schema.columns c
                    WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
                ) as column_count
            FROM information_schema.tables t
            LEFT JOIN pg_class ON pg_class.relname = t.table_name AND pg_class.relnamespace = (
                SELECT oid FROM pg_namespace WHERE nspname = t.table_schema
            )
            WHERE t.table_schema = $1
            AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name
        """
        
        tables = await connection.fetch(tables_query, schema)
        
        # Get actual row counts for each table (this is more accurate but slower)
        tables_list = []
        for table in tables:
            table_dict = dict(table)
            try:
                # Get actual row count
                count_query = f'SELECT COUNT(*) as actual_row_count FROM "{schema}"."{table["table_name"]}"'
                count_result = await connection.fetchrow(count_query)
                table_dict['estimated_row_count'] = count_result['actual_row_count']
            except Exception as e:
                # Keep the estimated count if actual count fails
                logger.warning(f"Could not get actual row count for {table['table_name']}: {e}")
            
            tables_list.append(table_dict)
        
        await connection.close()
        
        return {
            "success": True,
            "tables": tables_list,
            "total_count": len(tables_list)
        }
        
    except Exception as e:
        logger.error(f"Failed to get PostgreSQL tables: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/table-details")
async def get_postgres_table_details(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """Get detailed information about a specific PostgreSQL table - matches original Flask API"""
    try:
        # Validate required fields (matching original API)
        required_fields = ['host', 'database', 'username', 'password', 'table_name']
        missing_fields = [field for field in required_fields if not request_data.get(field)]
        
        if missing_fields:
            return {
                "success": False,
                "error": f'Missing required fields: {", ".join(missing_fields)}'
            }
        
        host = request_data.get('host')
        port = int(request_data.get('port', 5432))
        database = request_data.get('database')
        username = request_data.get('username')
        password = request_data.get('password')
        table_name = request_data.get('table_name')
        schema = request_data.get('schema', 'public')
        
        connection = await create_postgres_connection(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password
        )
        
        # Get column information
        columns_query = """
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        """
        
        columns = await connection.fetch(columns_query, schema, table_name)
        
        # Get primary key information
        primary_keys_query = """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name 
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = $1 AND tc.table_schema = $2 AND tc.constraint_type = 'PRIMARY KEY'
        """
        
        primary_key_rows = await connection.fetch(primary_keys_query, table_name, schema)
        primary_keys = [row['column_name'] for row in primary_key_rows]
        
        # Get table statistics
        stats_query = f"""
            SELECT 
                schemaname,
                tablename,
                attname,
                n_distinct,
                correlation
            FROM pg_stats 
            WHERE schemaname = $1 AND tablename = $2
        """
        
        stats = await connection.fetch(stats_query, schema, table_name)
        
        # Get sample data
        sample_query = f'SELECT * FROM "{schema}"."{table_name}" LIMIT 10'
        sample_data = await connection.fetch(sample_query)
        
        await connection.close()
        
        return {
            "success": True,
            "columns": [dict(col) for col in columns],
            "primary_keys": primary_keys,
            "statistics": [dict(stat) for stat in stats],
            "sample_data": [dict(row) for row in sample_data]
        }
        
    except Exception as e:
        logger.error(f"Failed to get table details: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/query")
async def execute_postgres_query(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """Execute a SELECT query on PostgreSQL database - matches original Flask API"""
    try:
        # Validate required fields (matching original API)
        required_fields = ['host', 'database', 'username', 'password', 'query']
        missing_fields = [field for field in required_fields if not request_data.get(field)]
        
        if missing_fields:
            return {
                "success": False,
                "error": f'Missing required fields: {", ".join(missing_fields)}'
            }
        
        host = request_data.get('host')
        port = int(request_data.get('port', 5432))
        database = request_data.get('database')
        username = request_data.get('username')
        password = request_data.get('password')
        query = request_data.get('query')
        limit = request_data.get('limit', 1000)
        
        # Basic security: prevent dangerous operations
        query_lower = query.lower().strip()
        dangerous_keywords = ['drop', 'delete', 'truncate', 'alter', 'create', 'insert', 'update']
        
        for keyword in dangerous_keywords:
            if query_lower.startswith(keyword):
                return {
                    "success": False,
                    "error": f"Query type '{keyword}' is not allowed for security reasons"
                }
        
        connection = await create_postgres_connection(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password
        )
        
        # Execute query with limit
        limited_query = f"SELECT * FROM ({query}) AS subquery LIMIT {limit}"
        
        try:
            rows = await connection.fetch(limited_query)
        except:
            # Fallback to original query if limiting fails
            rows = await connection.fetch(query)
            if len(rows) > limit:
                rows = rows[:limit]
        
        await connection.close()
        
        # Convert to list of dictionaries
        results = [dict(row) for row in rows]
        
        return {
            "success": True,
            "data": results,
            "row_count": len(results),
            "limited": len(results) >= limit
        }
        
    except Exception as e:
        logger.error(f"Query execution failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/insert")
async def insert_postgres_data(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """Insert data into PostgreSQL table - matches original Flask API"""
    try:
        # Validate required fields (matching original API)
        required_fields = ['host', 'database', 'username', 'password', 'table_name', 'data']
        missing_fields = [field for field in required_fields if not request_data.get(field)]
        
        if missing_fields:
            return {
                "success": False,
                "error": f'Missing required fields: {", ".join(missing_fields)}'
            }
        
        host = request_data.get('host')
        port = int(request_data.get('port', 5432))
        database = request_data.get('database')
        username = request_data.get('username')
        password = request_data.get('password')
        table_name = request_data.get('table_name')
        data = request_data.get('data', [])
        schema = request_data.get('schema', 'public')
        
        connection = await create_postgres_connection(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password
        )
        
        # Get table columns
        columns_query = """
            SELECT column_name 
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        """
        
        columns = await connection.fetch(columns_query, schema, table_name)
        column_names = [col['column_name'] for col in columns]
        
        # Prepare insert statement
        placeholders = ', '.join([f'${i+1}' for i in range(len(column_names))])
        columns_str = ', '.join([f'"{col}"' for col in column_names])
        
        insert_query = f'''
            INSERT INTO "{schema}"."{table_name}" ({columns_str}) 
            VALUES ({placeholders})
        '''
        
        # Insert data rows
        inserted_count = 0
        async with connection.transaction():
            for row in data:
                # Ensure row has all columns
                row_values = []
                for col in column_names:
                    row_values.append(row.get(col))
                
                await connection.execute(insert_query, *row_values)
                inserted_count += 1
        
        await connection.close()
        
        return {
            "success": True,
            "rows_affected": inserted_count,
            "message": f"Successfully inserted {inserted_count} rows"
        }
        
    except Exception as e:
        logger.error(f"Data insertion failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/create-table-and-insert")
async def create_table_and_insert_data(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """Create table dynamically and insert data - matches original Flask API"""
    try:
        # Validate required fields (matching original API)
        required_fields = ['host', 'database', 'username', 'password', 'table_name', 'data']
        missing_fields = [field for field in required_fields if not request_data.get(field)]
        
        if missing_fields:
            return {
                "success": False,
                "error": f'Missing required fields: {", ".join(missing_fields)}'
            }
        
        host = request_data.get('host')
        port = int(request_data.get('port', 5432))
        database = request_data.get('database')
        username = request_data.get('username')
        password = request_data.get('password')
        table_name = request_data.get('table_name')
        data = request_data.get('data', [])
        schema = request_data.get('schema', 'public')
        column_types = request_data.get('column_types')
        
        # Validate data is not empty
        if not data or not isinstance(data, list) or len(data) == 0:
            return {
                "success": False,
                "error": "Data must be a non-empty array of objects"
            }
        
        connection = await create_postgres_connection(
            host=host,
            port=port,
            database=database,
            username=username,
            password=password
        )
        
        # Auto-detect column types if not provided
        if not column_types and data:
            sample_row = data[0]
            column_definitions = []
            
            for key, value in sample_row.items():
                if isinstance(value, int):
                    col_type = 'INTEGER'
                elif isinstance(value, float):
                    col_type = 'DECIMAL'
                elif isinstance(value, bool):
                    col_type = 'BOOLEAN'
                else:
                    col_type = 'TEXT'
                
                column_definitions.append({
                    'name': key,
                    'type': col_type
                })
        else:
            column_definitions = column_types or []
        
        # Create table
        columns_sql = ', '.join([
            f'"{col["name"]}" {col["type"]}'
            for col in column_definitions
        ])
        
        create_table_query = f'''
            CREATE TABLE IF NOT EXISTS "{schema}"."{table_name}" (
                {columns_sql}
            )
        '''
        
        await connection.execute(create_table_query)
        
        # Insert data
        column_names = [col['name'] for col in column_definitions]
        placeholders = ', '.join([f'${i+1}' for i in range(len(column_names))])
        columns_str = ', '.join([f'"{col}"' for col in column_names])
        
        insert_query = f'''
            INSERT INTO "{schema}"."{table_name}" ({columns_str}) 
            VALUES ({placeholders})
        '''
        
        inserted_count = 0
        async with connection.transaction():
            for row in data:
                row_values = [row.get(col) for col in column_names]
                await connection.execute(insert_query, *row_values)
                inserted_count += 1
        
        await connection.close()
        
        return {
            "success": True,
            "table_created": True,
            "rows_affected": inserted_count,
            "message": f"Created table '{table_name}' and inserted {inserted_count} rows"
        }
        
    except Exception as e:
        logger.error(f"Table creation and insertion failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/analyze-schema")
async def analyze_postgres_schema(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """Analyze data and suggest PostgreSQL column types - matches original Flask API"""
    try:
        # Validate required fields
        if not request_data.get('data') or not isinstance(request_data.get('data'), list):
            return {
                "success": False,
                "error": "Data must be a non-empty array of objects"
            }
        
        input_data = request_data.get('data')
        if len(input_data) == 0:
            return {
                "success": False,
                "error": "Data array cannot be empty"
            }
        
        # Analyze each column in the data
        first_row = input_data[0]
        if not isinstance(first_row, dict):
            return {
                "success": False,
                "error": "Data items must be objects"
            }
        
        column_analysis = []
        
        for column_name in first_row.keys():
            # Get the inferred type
            inferred_type = _infer_column_type(input_data, column_name)
            
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
        
        return {
            "success": True,
            "columns": column_analysis,
            "row_count": len(input_data)
        }
        
    except Exception as e:
        logger.error(f"Error analyzing PostgreSQL schema: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def _infer_column_type(data: List[Dict[str, Any]], column_name: str) -> str:
    """Infer PostgreSQL column type from data"""
    non_null_values = [row.get(column_name) for row in data if row.get(column_name) is not None]
    
    if not non_null_values:
        return 'TEXT'
    
    # Check if values contain complex types (dict/list)
    if any(isinstance(v, (dict, list)) for v in non_null_values):
        return 'JSONB'
    
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
        return 'INTEGER' if all_integer else 'NUMERIC'
    
    # Check boolean compatibility
    boolean_values = {'true', 'false', 'yes', 'no', '1', '0', 'on', 'off', 't', 'f', 'y', 'n'}
    all_boolean = all(
        isinstance(v, bool) or str(v).lower().strip() in boolean_values 
        for v in non_null_values
    )
    if all_boolean:
        return 'BOOLEAN'
    
    return 'TEXT'

def _analyze_possible_types(data: List[Dict[str, Any]], column_name: str) -> List[Dict[str, Any]]:
    """Analyze all possible PostgreSQL types for a column"""
    possible_types = []
    non_null_values = [row.get(column_name) for row in data if row.get(column_name) is not None]
    
    if not non_null_values:
        return [{'type': 'TEXT', 'confidence': 100, 'description': 'Default for null values'}]
    
    # Check if values contain complex types
    has_complex = any(isinstance(v, (dict, list)) for v in non_null_values)
    if has_complex:
        possible_types.append({
            'type': 'JSONB',
            'confidence': 100,
            'description': 'Contains nested objects or arrays'
        })
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
    
    # TEXT is always possible
    possible_types.append({
        'type': 'TEXT',
        'confidence': 100,
        'description': 'Universal text storage'
    })
    
    return possible_types

def _get_sample_values(data: List[Dict[str, Any]], column_name: str, limit: int = 5) -> List[Any]:
    """Get sample values from a column for preview"""
    values = []
    seen = set()
    
    for row in data:
        value = row.get(column_name)
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