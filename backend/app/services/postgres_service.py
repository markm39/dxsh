"""
PostgreSQL Service for database connections and operations
Handles connection testing, table exploration, and data operations
"""
import psycopg2
import psycopg2.extras
import logging
from typing import Dict, List, Any, Optional, Tuple
from contextlib import contextmanager
import json

logger = logging.getLogger(__name__)

class PostgresService:
    """Service for PostgreSQL database operations"""
    
    @classmethod
    def test_connection(cls, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Test PostgreSQL database connection
        
        Args:
            config: Database connection configuration
            
        Returns:
            Dictionary with connection test results
        """
        try:
            host = config.get('host', 'localhost')
            port = config.get('port', 5432)
            database = config.get('database')
            username = config.get('username')
            password = config.get('password')
            
            # Validate required fields
            if not all([database, username, password]):
                return {
                    'success': False,
                    'error': 'Missing required connection parameters (database, username, password)'
                }
            
            # Attempt connection
            with cls._get_connection(config) as conn:
                with conn.cursor() as cursor:
                    # Test basic query
                    cursor.execute("SELECT version();")
                    version = cursor.fetchone()[0]
                    
                    # Test user permissions
                    cursor.execute("""
                        SELECT 
                            has_database_privilege(%s, 'CONNECT') as can_connect,
                            has_database_privilege(%s, 'CREATE') as can_create
                    """, (database, database))
                    permissions = cursor.fetchone()
                    
                    logger.info(f"Successfully connected to PostgreSQL: {host}:{port}/{database}")
                    
                    return {
                        'success': True,
                        'message': f'Connected successfully to {host}:{port}/{database}',
                        'version': version,
                        'permissions': {
                            'can_connect': permissions[0],
                            'can_create': permissions[1]
                        }
                    }
                    
        except psycopg2.OperationalError as e:
            logger.error(f"PostgreSQL connection failed: {e}")
            return {
                'success': False,
                'error': f'Connection failed: {str(e)}'
            }
        except psycopg2.Error as e:
            logger.error(f"PostgreSQL error: {e}")
            return {
                'success': False,
                'error': f'Database error: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Unexpected error testing PostgreSQL connection: {e}")
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}'
            }
    
    @classmethod
    def get_tables(cls, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get all tables in the database with metadata
        
        Args:
            config: Database connection configuration
            
        Returns:
            Dictionary with tables information
        """
        try:
            with cls._get_connection(config) as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    # Get all tables with row counts and metadata
                    cursor.execute("""
                        SELECT 
                            t.table_name,
                            t.table_schema,
                            t.table_type,
                            obj_description(c.oid) as table_comment,
                            (
                                SELECT COUNT(*) 
                                FROM information_schema.columns 
                                WHERE table_name = t.table_name 
                                AND table_schema = t.table_schema
                            ) as column_count
                        FROM information_schema.tables t
                        LEFT JOIN pg_class c ON c.relname = t.table_name
                        WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                        AND t.table_type = 'BASE TABLE'
                        ORDER BY t.table_schema, t.table_name;
                    """)
                    
                    tables = cursor.fetchall()
                    
                    # Get row counts for each table (this might be slow for large databases)
                    enriched_tables = []
                    for table in tables:
                        try:
                            # Get approximate row count from pg_stat
                            cursor.execute("""
                                SELECT 
                                    COALESCE(n_tup_ins - n_tup_del, 0) as estimated_rows,
                                    last_analyze,
                                    last_autoanalyze
                                FROM pg_stat_user_tables 
                                WHERE relname = %s AND schemaname = %s;
                            """, (table['table_name'], table['table_schema']))
                            
                            stats = cursor.fetchone()
                            
                            table_info = dict(table)
                            table_info.update({
                                'estimated_rows': stats['estimated_rows'] if stats else 0,
                                'last_analyzed': stats['last_analyze'].isoformat() if stats and stats['last_analyze'] else None,
                                'full_name': f"{table['table_schema']}.{table['table_name']}"
                            })
                            
                            enriched_tables.append(table_info)
                            
                        except Exception as e:
                            logger.warning(f"Could not get stats for table {table['table_name']}: {e}")
                            table_info = dict(table)
                            table_info.update({
                                'estimated_rows': 0,
                                'last_analyzed': None,
                                'full_name': f"{table['table_schema']}.{table['table_name']}"
                            })
                            enriched_tables.append(table_info)
                    
                    logger.info(f"Retrieved {len(enriched_tables)} tables from database")
                    
                    return {
                        'success': True,
                        'tables': enriched_tables,
                        'total_count': len(enriched_tables)
                    }
                    
        except Exception as e:
            logger.error(f"Error retrieving tables: {e}")
            return {
                'success': False,
                'error': f'Failed to retrieve tables: {str(e)}'
            }
    
    @classmethod
    def get_table_details(cls, config: Dict[str, Any], table_name: str, schema: str = 'public') -> Dict[str, Any]:
        """
        Get detailed information about a specific table
        
        Args:
            config: Database connection configuration
            table_name: Name of the table
            schema: Schema name (default: public)
            
        Returns:
            Dictionary with table details
        """
        try:
            with cls._get_connection(config) as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    # Get column information
                    cursor.execute("""
                        SELECT 
                            column_name,
                            data_type,
                            is_nullable,
                            column_default,
                            character_maximum_length,
                            numeric_precision,
                            numeric_scale,
                            ordinal_position
                        FROM information_schema.columns
                        WHERE table_name = %s AND table_schema = %s
                        ORDER BY ordinal_position;
                    """, (table_name, schema))
                    
                    columns = cursor.fetchall()
                    
                    # Get primary key information
                    cursor.execute("""
                        SELECT c.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.constraint_column_usage ccu 
                            ON tc.constraint_name = ccu.constraint_name
                        JOIN information_schema.columns c 
                            ON c.table_name = tc.table_name AND c.column_name = ccu.column_name
                        WHERE tc.table_name = %s AND tc.table_schema = %s AND tc.constraint_type = 'PRIMARY KEY';
                    """, (table_name, schema))
                    
                    primary_keys = [row['column_name'] for row in cursor.fetchall()]
                    
                    # Get foreign key information
                    cursor.execute("""
                        SELECT 
                            kcu.column_name,
                            ccu.table_name AS foreign_table_name,
                            ccu.column_name AS foreign_column_name
                        FROM information_schema.table_constraints AS tc
                        JOIN information_schema.key_column_usage AS kcu
                            ON tc.constraint_name = kcu.constraint_name
                        JOIN information_schema.constraint_column_usage AS ccu
                            ON ccu.constraint_name = tc.constraint_name
                        WHERE tc.table_name = %s AND tc.table_schema = %s AND tc.constraint_type = 'FOREIGN KEY';
                    """, (table_name, schema))
                    
                    foreign_keys = cursor.fetchall()
                    
                    # Get indexes
                    cursor.execute("""
                        SELECT 
                            i.relname as index_name,
                            a.attname as column_name,
                            ix.indisunique as is_unique,
                            ix.indisprimary as is_primary
                        FROM pg_class t
                        JOIN pg_index ix ON t.oid = ix.indrelid
                        JOIN pg_class i ON i.oid = ix.indexrelid
                        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                        JOIN pg_namespace n ON n.oid = t.relnamespace
                        WHERE t.relname = %s AND n.nspname = %s
                        ORDER BY i.relname, a.attnum;
                    """, (table_name, schema))
                    
                    indexes = cursor.fetchall()
                    
                    # Get exact row count
                    cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table_name};")
                    row_count = cursor.fetchone()['count']
                    
                    # Get sample data (first 5 rows)
                    cursor.execute(f"SELECT * FROM {schema}.{table_name} LIMIT 5;")
                    sample_data = cursor.fetchall()
                    
                    logger.info(f"Retrieved details for table {schema}.{table_name}")
                    
                    return {
                        'success': True,
                        'table_name': table_name,
                        'schema': schema,
                        'columns': [dict(col) for col in columns],
                        'primary_keys': primary_keys,
                        'foreign_keys': [dict(fk) for fk in foreign_keys],
                        'indexes': [dict(idx) for idx in indexes],
                        'row_count': row_count,
                        'sample_data': [dict(row) for row in sample_data]
                    }
                    
        except Exception as e:
            logger.error(f"Error retrieving table details for {schema}.{table_name}: {e}")
            return {
                'success': False,
                'error': f'Failed to retrieve table details: {str(e)}'
            }
    
    @classmethod
    def execute_query(cls, config: Dict[str, Any], query: str, limit: int = 1000) -> Dict[str, Any]:
        """
        Execute a SELECT query safely
        
        Args:
            config: Database connection configuration
            query: SQL query to execute
            limit: Maximum number of rows to return
            
        Returns:
            Dictionary with query results
        """
        try:
            # Basic security check - only allow SELECT statements
            query_lower = query.strip().lower()
            if not query_lower.startswith('select'):
                return {
                    'success': False,
                    'error': 'Only SELECT queries are allowed'
                }
            
            # Check for dangerous keywords
            dangerous_keywords = ['drop', 'delete', 'update', 'insert', 'create', 'alter', 'truncate']
            if any(keyword in query_lower for keyword in dangerous_keywords):
                return {
                    'success': False,
                    'error': 'Query contains potentially dangerous keywords'
                }
            
            with cls._get_connection(config) as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    # Add LIMIT if not present
                    if 'limit' not in query_lower:
                        query = f"{query.rstrip(';')} LIMIT {limit}"
                    
                    cursor.execute(query)
                    results = cursor.fetchall()
                    
                    # Get column names
                    column_names = [desc[0] for desc in cursor.description] if cursor.description else []
                    
                    logger.info(f"Query executed successfully, returned {len(results)} rows")
                    
                    return {
                        'success': True,
                        'data': [dict(row) for row in results],
                        'columns': column_names,
                        'row_count': len(results)
                    }
                    
        except psycopg2.Error as e:
            logger.error(f"PostgreSQL query error: {e}")
            return {
                'success': False,
                'error': f'Query error: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            return {
                'success': False,
                'error': f'Query execution failed: {str(e)}'
            }
    
    @classmethod
    @contextmanager
    def _get_connection(cls, config: Dict[str, Any]):
        """
        Context manager for database connections
        
        Args:
            config: Database connection configuration
            
        Yields:
            psycopg2 connection object
        """
        conn = None
        try:
            conn = psycopg2.connect(
                host=config.get('host', 'localhost'),
                port=config.get('port', 5432),
                database=config.get('database'),
                user=config.get('username'),
                password=config.get('password'),
                connect_timeout=10  # 10 second timeout
            )
            conn.set_session(autocommit=True)  # For read operations
            yield conn
        finally:
            if conn:
                conn.close()
    
    @classmethod
    def insert_data(cls, config: Dict[str, Any], table_name: str, data: List[Dict[str, Any]], 
                   schema: str = 'public', insert_mode: str = 'insert', 
                   conflict_columns: List[str] = None, column_mappings: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Insert data into a PostgreSQL table
        
        Args:
            config: Database connection configuration
            table_name: Target table name
            data: List of dictionaries with data to insert
            schema: Schema name
            insert_mode: 'insert' or 'upsert'
            conflict_columns: Columns to check for conflicts in upsert mode
            
        Returns:
            Dictionary with insertion results
        """
        try:
            if not data:
                return {
                    'success': False,
                    'error': 'No data provided for insertion'
                }
            
            with cls._get_connection(config) as conn:
                conn.set_session(autocommit=False)  # Use transactions for writes
                
                with conn.cursor() as cursor:
                    # Apply column mappings if provided
                    if column_mappings and len(column_mappings) > 0:
                        # Transform data based on column mappings
                        mapped_data = []
                        for row in data:
                            mapped_row = {}
                            for mapping in column_mappings:
                                source_field = mapping.get('sourceField')
                                target_column = mapping.get('targetColumn')
                                if source_field and target_column and source_field in row:
                                    mapped_row[target_column] = row[source_field]
                            mapped_data.append(mapped_row)
                        data = mapped_data
                        columns = [mapping['targetColumn'] for mapping in column_mappings if mapping.get('targetColumn')]
                    else:
                        # No mappings, use original column names
                        columns = list(data[0].keys())
                    
                    if insert_mode == 'insert':
                        # Simple INSERT
                        insert_query = f"""
                            INSERT INTO {schema}.{table_name} ({', '.join(columns)})
                            VALUES ({', '.join(['%s'] * len(columns))})
                        """
                        
                        for row in data:
                            values = []
                            for col in columns:
                                value = row.get(col)
                                # Convert value based on target column type if needed
                                if value is not None and isinstance(value, (dict, list)):
                                    # For complex types, convert to JSON string
                                    value = json.dumps(value)
                                elif value is not None and not isinstance(value, (str, int, float, bool)):
                                    # For other non-primitive types, stringify
                                    value = str(value)
                                values.append(value)
                            cursor.execute(insert_query, values)
                    
                    elif insert_mode == 'upsert':
                        # INSERT ... ON CONFLICT DO UPDATE
                        if not conflict_columns:
                            return {
                                'success': False,
                                'error': 'Conflict columns required for upsert mode'
                            }
                        
                        update_set = ', '.join([f"{col} = EXCLUDED.{col}" for col in columns if col not in conflict_columns])
                        
                        upsert_query = f"""
                            INSERT INTO {schema}.{table_name} ({', '.join(columns)})
                            VALUES ({', '.join(['%s'] * len(columns))})
                            ON CONFLICT ({', '.join(conflict_columns)})
                            DO UPDATE SET {update_set}
                        """
                        
                        for row in data:
                            values = []
                            for col in columns:
                                value = row.get(col)
                                # Convert value based on target column type if needed
                                if value is not None and isinstance(value, (dict, list)):
                                    # For complex types, convert to JSON string
                                    value = json.dumps(value)
                                elif value is not None and not isinstance(value, (str, int, float, bool)):
                                    # For other non-primitive types, stringify
                                    value = str(value)
                                values.append(value)
                            cursor.execute(upsert_query, values)
                    
                    conn.commit()
                    
                    logger.info(f"Successfully inserted {len(data)} rows into {schema}.{table_name}")
                    
                    return {
                        'success': True,
                        'rows_affected': len(data),
                        'message': f'Successfully inserted {len(data)} rows'
                    }
                    
        except psycopg2.Error as e:
            logger.error(f"PostgreSQL insert error: {e}")
            if conn:
                conn.rollback()
            return {
                'success': False,
                'error': f'Insert error: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Error inserting data: {e}")
            if conn:
                conn.rollback()
            return {
                'success': False,
                'error': f'Insert failed: {str(e)}'
            }
    
    @classmethod
    def create_table_and_insert(cls, config: Dict[str, Any], table_name: str, data: List[Dict[str, Any]], 
                               schema: str = 'public', column_types: Dict[str, str] = None) -> Dict[str, Any]:
        """Create table dynamically based on data structure and insert data"""
        if not data or not isinstance(data, list) or len(data) == 0:
            return {
                'success': False,
                'error': 'No data provided for dynamic table creation'
            }
        
        conn = None
        try:
            logger.info(f"Creating dynamic table {schema}.{table_name} and inserting {len(data)} rows")
            
            with cls._get_connection(config) as conn:
                conn.set_session(autocommit=False)  # Use transactions
                
                with conn.cursor() as cursor:
                    # Analyze all rows to determine column types intelligently
                    first_row = data[0]
                    columns = []
                    
                    for column_name in first_row.keys():
                        # Sanitize column name (remove special characters, ensure valid SQL identifier)
                        clean_column_name = ''.join(c if c.isalnum() or c == '_' else '_' for c in column_name.lower())
                        if clean_column_name[0].isdigit():
                            clean_column_name = f"col_{clean_column_name}"
                        
                        # Determine PostgreSQL data type
                        if column_types and column_name in column_types:
                            # Use user-selected type if provided
                            pg_type = column_types[column_name]
                        else:
                            # Otherwise infer type by analyzing values across all rows
                            pg_type = cls._infer_column_type(data, column_name)
                        
                        columns.append(f"{clean_column_name} {pg_type}")
                    
                    # Create table (IF NOT EXISTS to avoid errors if table already exists)
                    create_table_query = f"""
                        CREATE TABLE IF NOT EXISTS {schema}.{table_name} (
                            id SERIAL PRIMARY KEY,
                            {', '.join(columns)},
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """
                    
                    cursor.execute(create_table_query)
                    logger.info(f"Created table {schema}.{table_name} with columns: {', '.join(columns)}")
                    
                    # Insert data
                    data_columns = list(first_row.keys())
                    clean_data_columns = []
                    
                    for col in data_columns:
                        clean_col = ''.join(c if c.isalnum() or c == '_' else '_' for c in col.lower())
                        if clean_col[0].isdigit():
                            clean_col = f"col_{clean_col}"
                        clean_data_columns.append(clean_col)
                    
                    insert_query = f"""
                        INSERT INTO {schema}.{table_name} ({', '.join(clean_data_columns)})
                        VALUES ({', '.join(['%s'] * len(clean_data_columns))})
                    """
                    
                    rows_inserted = 0
                    for row in data:
                        try:
                            values = []
                            for i, col in enumerate(data_columns):
                                value = row.get(col)
                                # Convert values based on inferred types
                                if isinstance(value, (dict, list)):
                                    # Check if this column is actually JSONB type
                                    col_type = columns[i].split()[1].upper()
                                    if 'JSONB' in col_type or 'JSON' in col_type:
                                        # For JSONB columns, psycopg2 needs the Json wrapper
                                        from psycopg2.extras import Json
                                        value = Json(value)
                                    else:
                                        # For non-JSONB columns, convert to JSON string
                                        value = json.dumps(value)
                                elif value is not None and not isinstance(value, (str, int, float, bool)):
                                    # For other non-primitive types, stringify
                                    value = str(value)
                                values.append(value)
                            
                            cursor.execute(insert_query, values)
                            rows_inserted += 1
                        except Exception as row_error:
                            logger.warning(f"Skipped row due to error: {row_error}")
                            continue
                    
                    conn.commit()
                    
                    logger.info(f"Successfully created table {schema}.{table_name} and inserted {rows_inserted} rows")
                    
                    return {
                        'success': True,
                        'table_created': True,
                        'table_name': table_name,
                        'schema': schema,
                        'rows_affected': rows_inserted,
                        'columns_created': len(columns) + 2,  # +2 for id and created_at
                        'message': f'Successfully created table {table_name} and inserted {rows_inserted} rows'
                    }
                    
        except psycopg2.Error as e:
            logger.error(f"PostgreSQL dynamic table creation error: {e}")
            if conn:
                conn.rollback()
            return {
                'success': False,
                'error': f'Dynamic table creation error: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Error creating dynamic table: {e}")
            if conn:
                conn.rollback()
            return {
                'success': False,
                'error': f'Dynamic table creation failed: {str(e)}'
            }
    
    @classmethod
    def _infer_column_type(cls, data: List[Dict[str, Any]], column_name: str) -> str:
        """
        Intelligently infer PostgreSQL column type by analyzing values across all rows
        
        Args:
            data: List of dictionaries containing the data
            column_name: Name of the column to analyze
            
        Returns:
            PostgreSQL data type as string
        """
        values = []
        non_null_values = []
        
        # Collect all values for this column
        for row in data:
            value = row.get(column_name)
            values.append(value)
            if value is not None:
                non_null_values.append(value)
        
        # If all values are None, default to TEXT
        if not non_null_values:
            return 'TEXT'
        
        # Check for complex types first (dict/list -> JSONB)
        if any(isinstance(v, (dict, list)) for v in non_null_values):
            return 'JSONB'
        
        # Check for boolean values
        boolean_values = {'true', 'false', 'yes', 'no', '1', '0', 'on', 'off'}
        if all(isinstance(v, bool) for v in non_null_values):
            return 'BOOLEAN'
        elif all(str(v).lower().strip() in boolean_values for v in non_null_values):
            return 'BOOLEAN'
        
        # Check for numeric values (including strings that represent numbers)
        numeric_count = 0
        integer_count = 0
        
        for value in non_null_values:
            if isinstance(value, (int, float)):
                numeric_count += 1
                if isinstance(value, int) or (isinstance(value, float) and value.is_integer()):
                    integer_count += 1
            elif isinstance(value, str):
                # Try to parse as number
                try:
                    parsed = float(value.strip())
                    numeric_count += 1
                    if parsed.is_integer():
                        integer_count += 1
                except (ValueError, AttributeError):
                    pass
        
        # If all non-null values are numeric
        if numeric_count == len(non_null_values):
            # If all are integers, use INTEGER
            if integer_count == len(non_null_values):
                return 'INTEGER'
            else:
                return 'NUMERIC'
        
        # Check for date/timestamp patterns
        date_patterns = [
            r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
            r'\d{2}/\d{2}/\d{4}',  # MM/DD/YYYY
            r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}',  # YYYY-MM-DD HH:MM:SS
        ]
        
        import re
        date_count = 0
        for value in non_null_values:
            if isinstance(value, str):
                for pattern in date_patterns:
                    if re.match(pattern, value.strip()):
                        date_count += 1
                        break
        
        # If most values look like dates
        if date_count > len(non_null_values) * 0.8:
            return 'TIMESTAMP'
        
        # Check for very long text (potential TEXT vs VARCHAR)
        max_length = 0
        for value in non_null_values:
            if isinstance(value, str):
                max_length = max(max_length, len(value))
        
        # Use TEXT for very long strings, VARCHAR for shorter ones
        if max_length > 255:
            return 'TEXT'
        elif max_length > 0:
            return f'VARCHAR({min(max_length * 2, 255)})'  # Give some buffer space
        
        # Default fallback
        return 'TEXT'