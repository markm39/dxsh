/**
 * Data Analysis Utilities
 * 
 * Modular utilities for analyzing data structures, detecting tables,
 * and inferring field types across the application
 */

export interface FieldInfo {
  key: string;
  type: 'numeric' | 'categorical' | 'temporal' | 'other' | 'array' | 'object';
  sample: any;
  description: string;
  tableSource?: string;
  uniqueCount?: number;
  nullCount?: number;
  path?: string; // Full path for nested fields (e.g., "user.profile.name")
  depth?: number; // Nesting depth (0 = root level)
  parentField?: string; // Parent field key for nested fields
  nestedFields?: FieldInfo[]; // Child fields for object/array types
  stats?: {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
  };
}

export interface TableInfo {
  name: string;
  data: any[];
  fields: FieldInfo[];
  rowCount: number;
  confidence: number; // 0-1 confidence that this is a valid table
}

export interface DataStructureAnalysis {
  isTable: boolean;
  tables: TableInfo[];
  primaryTable?: TableInfo;
  rawData: any;
  dataType: 'array' | 'object' | 'nested_object' | 'primitive';
}

/**
 * Analyze any data structure and detect tables, fields, and types
 */
export function analyzeDataStructure(data: any): DataStructureAnalysis {
  console.log(' analyzeDataStructure called with data:', typeof data, data);
  console.log(' Is Array?', Array.isArray(data));
  
  // Handle case where data is a JSON string that needs parsing
  if (typeof data === 'string') {
    try {
      console.log(' Attempting to parse string as JSON...');
      data = JSON.parse(data);
      console.log(' Successfully parsed JSON:', typeof data, Array.isArray(data));
    } catch (error) {
      console.log(' Failed to parse as JSON, treating as primitive string');
    }
  }
  
  if (Array.isArray(data)) {
    console.log(' Array length:', data.length);
    console.log(' First item:', data[0]);
    console.log(' First item type:', typeof data[0]);
  }
  
  if (!data) {
    console.log(' analyzeDataStructure: No data provided');
    return {
      isTable: false,
      tables: [],
      rawData: data,
      dataType: 'primitive'
    };
  }

  // Handle direct arrays (most common table format)
  if (Array.isArray(data)) {
    console.log(' analyzeDataStructure: Processing array with length:', data.length);
    
    if (data.length === 0) {
      return {
        isTable: false,
        tables: [],
        rawData: data,
        dataType: 'array'
      };
    }

    // Special case: Single-item array that might contain nested table data or be a table itself
    if (data.length === 1 && data[0] && typeof data[0] === 'object' && !Array.isArray(data[0])) {
      console.log(' analyzeDataStructure: Single-item array detected, checking for nested tables');
      const singleItem = data[0];
      const nestedTables: TableInfo[] = [];
      
      // Look for nested table arrays within the single object
      for (const [key, value] of Object.entries(singleItem)) {
        if (Array.isArray(value) && value.length > 0 && !key.startsWith('_')) {
          console.log(` Checking nested array "${key}" with ${value.length} items`);
          if (isTableArray(value)) {
            const tableInfo = analyzeTable(key, value);
            nestedTables.push(tableInfo);
            console.log(` Found nested table "${key}" with confidence ${tableInfo.confidence}`);
          }
        }
      }
      
      // If we found nested tables, return those instead of treating the wrapper as a table
      if (nestedTables.length > 0) {
        const primaryTable = nestedTables.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
        console.log(` Using nested table "${primaryTable.name}" as primary`);
        return {
          isTable: true,
          tables: nestedTables,
          primaryTable,
          rawData: data,
          dataType: 'nested_object'
        };
      }
      
      // If no nested tables found, check if the single object itself represents structured data
      const objectKeys = Object.keys(singleItem);
      if (objectKeys.length > 0) {
        console.log(` Single-object array with ${objectKeys.length} fields, treating as key-value chart data`);
        const tableInfo = analyzeSingleObjectAsChart('data', data);
        return {
          isTable: true,
          tables: [tableInfo],
          primaryTable: tableInfo,
          rawData: data,
          dataType: 'array'
        };
      }
    }

    // Check if this is a table (array of objects)
    if (isTableArray(data)) {
      const tableInfo = analyzeTable('data', data);
      return {
        isTable: true,
        tables: [tableInfo],
        primaryTable: tableInfo,
        rawData: data,
        dataType: 'array'
      };
    }

    return {
      isTable: false,
      tables: [],
      rawData: data,
      dataType: 'array'
    };
  }

  // Handle objects (may contain nested tables)
  if (typeof data === 'object') {
    console.log(' analyzeDataStructure: Processing object with keys:', Object.keys(data));
    const tables: TableInfo[] = [];
    let primaryTable: TableInfo | undefined;
    let highestConfidence = 0;

    for (const [key, value] of Object.entries(data)) {
      console.log(` Checking key "${key}":`, Array.isArray(value) ? `Array with ${value.length} items` : typeof value);
      
      if (Array.isArray(value) && value.length > 0 && !key.startsWith('_')) {
        console.log(` Analyzing potential table "${key}" with ${value.length} rows`);
        if (isTableArray(value)) {
          const tableInfo = analyzeTable(key, value);
          tables.push(tableInfo);
          console.log(` Added table "${key}" with confidence ${tableInfo.confidence}`);
          
          // Primary table is the one with highest confidence
          if (tableInfo.confidence > highestConfidence) {
            highestConfidence = tableInfo.confidence;
            primaryTable = tableInfo;
            console.log(` New primary table: "${key}" (confidence: ${tableInfo.confidence})`);
          }
        }
      }
    }

    return {
      isTable: tables.length > 0,
      tables,
      primaryTable,
      rawData: data,
      dataType: tables.length > 0 ? 'nested_object' : 'object'
    };
  }

  return {
    isTable: false,
    tables: [],
    rawData: data,
    dataType: 'primitive'
  };
}

/**
 * Check if an array represents a table (array of objects with consistent structure)
 */
function isTableArray(arr: any[]): boolean {
  if (arr.length === 0) {
    console.log(' isTableArray: Empty array');
    return false;
  }
  
  // Check if all items are objects
  const allObjects = arr.every(item => item && typeof item === 'object' && !Array.isArray(item));
  if (!allObjects) {
    console.log(' isTableArray: Not all items are objects', arr.slice(0, 3));
    return false;
  }

  // Check for consistent field structure
  const firstItem = arr[0];
  const firstKeys = Object.keys(firstItem);
  
  if (firstKeys.length === 0) {
    console.log(' isTableArray: First item has no keys');
    return false;
  }

  // Calculate field consistency across rows
  let consistentFields = 0;
  const totalFields = firstKeys.length;

  for (const key of firstKeys) {
    const presentInRows = arr.filter(item => item.hasOwnProperty(key)).length;
    const consistency = presentInRows / arr.length;
    
    // Field is considered consistent if present in at least 70% of rows
    if (consistency >= 0.7) {
      consistentFields++;
    }
  }

  // Table confidence based on field consistency
  const fieldConsistency = consistentFields / totalFields;
  const isTable = fieldConsistency >= 0.6; // At least 60% of fields are consistent
  
  console.log(` isTableArray: ${isTable ? '' : ''} Table detection - ${consistentFields}/${totalFields} consistent fields (${(fieldConsistency * 100).toFixed(1)}%)`, {
    arrayLength: arr.length,
    firstKeys,
    fieldConsistency
  });
  
  return isTable;
}

/**
 * Analyze a table array and extract field information
 */
function analyzeTable(tableName: string, data: any[]): TableInfo {
  console.log(` analyzeTable: Analyzing table "${tableName}" with ${data.length} rows`);
  
  if (data.length === 0) {
    return {
      name: tableName,
      data,
      fields: [],
      rowCount: 0,
      confidence: 0
    };
  }

  const fields: FieldInfo[] = [];
  const firstItem = data[0];
  const allKeys = new Set<string>();

  // Collect all possible keys from all rows
  data.forEach(item => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach(key => allKeys.add(key));
    }
  });

  console.log(` analyzeTable: Found ${allKeys.size} unique keys:`, Array.from(allKeys));

  // Analyze each field
  for (const key of Array.from(allKeys)) {
    const values = data
      .map(item => item && typeof item === 'object' ? item[key] : undefined)
      .filter(val => val !== undefined && val !== null);

    if (values.length === 0) {
      console.log(` analyzeTable: Skipping key "${key}" - no valid values`);
      continue;
    }

    const sampleValue = values[0];
    const fieldType = inferFieldType(sampleValue, values.slice(0, Math.min(10, values.length)));
    const uniqueValues = [...new Set(values)];
    const nullCount = data.length - values.length;
    
    console.log(` analyzeTable: Field "${key}" - type: ${fieldType}, values: ${values.length}, unique: ${uniqueValues.length}, nulls: ${nullCount}`);

    const fieldInfo: FieldInfo = {
      key,
      type: fieldType,
      sample: sampleValue,
      description: getFieldDescription(key, fieldType, values, uniqueValues.length),
      tableSource: tableName,
      uniqueCount: uniqueValues.length,
      nullCount,
      path: key,
      depth: 0
    };

    // Add statistics for numeric fields
    if (fieldType === 'numeric') {
      const numericValues = values.map(v => parseFloat(String(v))).filter(v => !isNaN(v));
      if (numericValues.length > 0) {
        fieldInfo.stats = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          median: getMedian(numericValues.sort((a, b) => a - b))
        };
      }
    }

    // For object and array fields, analyze nested structure
    if (fieldType === 'object' && sampleValue && typeof sampleValue === 'object') {
      console.log(` Analyzing nested object field "${key}"`);
      fieldInfo.nestedFields = analyzeNestedObject(sampleValue, key, 1, 3, key);
      console.log(` Found ${fieldInfo.nestedFields.length} nested fields in "${key}"`);
    } else if (fieldType === 'array' && Array.isArray(sampleValue) && sampleValue.length > 0) {
      console.log(` Analyzing array field "${key}" with ${sampleValue.length} items`);
      // For arrays, analyze the structure across multiple samples
      const arrayStructure = analyzeArrayFieldStructure(values.filter(v => Array.isArray(v)), key);
      if (arrayStructure.length > 0) {
        fieldInfo.nestedFields = arrayStructure;
        console.log(` Found ${fieldInfo.nestedFields.length} nested fields in array "${key}"`);
      }
    }

    fields.push(fieldInfo);
  }

  // Calculate table confidence based on field quality and consistency
  const confidence = calculateTableConfidence(data, fields);

  console.log(` analyzeTable: Completed analysis of "${tableName}" - ${fields.length} fields, confidence: ${confidence}`);

  return {
    name: tableName,
    data,
    fields,
    rowCount: data.length,
    confidence
  };
}

/**
 * Analyze a single-object array for charting (transpose keys/values)
 */
function analyzeSingleObjectAsChart(tableName: string, data: any[]): TableInfo {
  console.log(` analyzeSingleObjectAsChart: Creating individual fields for each key-value pair`);
  
  if (data.length !== 1 || !data[0] || typeof data[0] !== 'object') {
    // Fallback to regular table analysis
    return analyzeTable(tableName, data);
  }

  const singleObject = data[0];
  const entries = Object.entries(singleObject);
  
  // Create individual fields for each key in the object
  const fields: FieldInfo[] = entries.map(([key, value]) => {
    const fieldType = inferFieldType(value, [value]);
    
    return {
      key,
      type: fieldType,
      sample: value,
      description: `${key}: ${fieldType} value`,
      tableSource: tableName,
      uniqueCount: 1, // Single value per field in this context
      nullCount: 0,
      path: key,
      depth: 0,
      ...(fieldType === 'numeric' && typeof value === 'number' ? {
        stats: {
          min: value,
          max: value,
          mean: value,
          median: value
        }
      } : {})
    };
  });

  // Keep the original single-object data structure for chart rendering
  // The chart widgets will handle the field selection and data extraction
  const transformedData = [singleObject];

  console.log(` analyzeSingleObjectAsChart: Created ${fields.length} individual fields:`, fields.map(f => `${f.key} (${f.type})`));

  return {
    name: tableName,
    data: transformedData,
    fields,
    rowCount: 1, // Still one row, but with multiple selectable fields
    confidence: 0.9 // High confidence for single-object arrays
  };
}

/**
 * Infer the type of a field based on sample values
 */
export function inferFieldType(value: any, samples: any[]): FieldInfo['type'] {
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object') return 'object';

  // Check if it's a number
  if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
    // Additional check: ensure most samples are numeric
    const numericSamples = samples.filter(s => 
      typeof s === 'number' || (typeof s === 'string' && !isNaN(Number(s)))
    );
    
    if (numericSamples.length / samples.length >= 0.8) {
      return 'numeric';
    }
  }
  
  // Check if it's a date/time
  if (typeof value === 'string') {
    const dateValue = new Date(value);
    if (!isNaN(dateValue.getTime())) {
      // Additional checks for date-like strings
      if (value.includes('-') || value.includes('/') || value.includes('T') || 
          value.match(/^\d{4}/) || value.includes(':')) {
        
        // Verify other samples are also date-like
        const dateLikeSamples = samples.filter(s => {
          if (typeof s !== 'string') return false;
          const d = new Date(s);
          return !isNaN(d.getTime());
        });
        
        if (dateLikeSamples.length / samples.length >= 0.7) {
          return 'temporal';
        }
      }
    }
  }
  
  // Check if it's categorical (limited unique values relative to sample size)
  const uniqueValues = [...new Set(samples)];
  const uniqueRatio = uniqueValues.length / samples.length;
  
  // Categorical if:
  // - Less than 10 unique values, OR
  // - Unique ratio is less than 0.5 (many repeated values)
  if (uniqueValues.length <= 10 || uniqueRatio < 0.5) {
    return 'categorical';
  }
  
  return 'other';
}

/**
 * Generate a human-readable description for a field
 */
function getFieldDescription(
  key: string, 
  type: FieldInfo['type'], 
  values: any[], 
  uniqueCount: number
): string {
  switch (type) {
    case 'numeric':
      const numericValues = values.map(v => parseFloat(String(v))).filter(v => !isNaN(v));
      if (numericValues.length > 0) {
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        return `numeric, range: ${formatNumber(min)} - ${formatNumber(max)}`;
      }
      return 'numeric values';
      
    case 'categorical':
      if (uniqueCount <= 5) {
        return `${uniqueCount} categories`;
      } else {
        return `${uniqueCount} categories (categorical)`;
      }
      
    case 'temporal':
      return 'date/time values';
      
    case 'array':
      return 'array data';
      
    case 'object':
      return 'object data';
      
    default:
      if (uniqueCount === values.length) {
        return `${uniqueCount} unique values`;
      } else {
        return `${uniqueCount} unique, ${values.length} total`;
      }
  }
}

/**
 * Calculate confidence score for table detection
 */
function calculateTableConfidence(data: any[], fields: FieldInfo[]): number {
  if (data.length === 0 || fields.length === 0) return 0;

  let score = 0.5; // Base score
  
  // Boost for having multiple fields
  if (fields.length >= 3) score += 0.2;
  if (fields.length >= 5) score += 0.1;
  
  // Boost for having different field types (indicates structured data)
  const fieldTypes = [...new Set(fields.map(f => f.type))];
  if (fieldTypes.length >= 2) score += 0.1;
  if (fieldTypes.length >= 3) score += 0.1;
  
  // Boost for having numeric fields (common in tables)
  const numericFields = fields.filter(f => f.type === 'numeric');
  if (numericFields.length > 0) score += 0.05;
  
  // Boost for reasonable row count
  if (data.length >= 10) score += 0.05;
  if (data.length >= 100) score += 0.05;
  
  // Penalty for too many null values
  const totalNulls = fields.reduce((sum, f) => sum + (f.nullCount || 0), 0);
  const totalCells = data.length * fields.length;
  const nullRatio = totalNulls / totalCells;
  if (nullRatio > 0.3) score -= 0.1;
  
  return Math.min(1, Math.max(0, score));
}

/**
 * Helper function to get median of sorted numeric array
 */
function getMedian(sortedNumbers: number[]): number {
  const mid = Math.floor(sortedNumbers.length / 2);
  return sortedNumbers.length % 2 === 0
    ? (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2
    : sortedNumbers[mid];
}

/**
 * Helper function to format numbers for display
 */
function formatNumber(num: number): string {
  if (Number.isInteger(num)) return num.toString();
  if (Math.abs(num) >= 1000) return num.toFixed(0);
  if (Math.abs(num) >= 1) return num.toFixed(2);
  return num.toFixed(4);
}

/**
 * Get the best table from a data structure analysis
 */
export function getPrimaryTable(analysis: DataStructureAnalysis): TableInfo | null {
  if (analysis.primaryTable) return analysis.primaryTable;
  if (analysis.tables.length > 0) return analysis.tables[0];
  return null;
}

/**
 * Extract field options suitable for chart configuration
 */
export function getChartFieldOptions(tableInfo: TableInfo) {
  const allFields = flattenFieldsForCharting(tableInfo.fields);
  
  // Categorize fields, including object/array fields based on their nested content
  const categorized = {
    numeric: [] as FieldInfo[],
    categorical: [] as FieldInfo[],
    temporal: [] as FieldInfo[],
    other: [] as FieldInfo[]
  };

  for (const field of allFields) {
    // Direct type matching
    switch (field.type) {
      case 'numeric':
        categorized.numeric.push(field);
        break;
      case 'categorical':
        categorized.categorical.push(field);
        break;
      case 'temporal':
        categorized.temporal.push(field);
        break;
      case 'object':
      case 'array':
        // For object/array fields, categorize based on their nested field types
        const nestedTypes = getNestedFieldTypes(field);
        
        if (nestedTypes.has('numeric')) {
          categorized.numeric.push(field);
        }
        if (nestedTypes.has('categorical')) {
          categorized.categorical.push(field);
        }
        if (nestedTypes.has('temporal')) {
          categorized.temporal.push(field);
        }
        
        // If no typed nested fields, put in other
        if (nestedTypes.size === 0 || (nestedTypes.size === 1 && nestedTypes.has('other'))) {
          categorized.other.push(field);
        }
        break;
      default:
        categorized.other.push(field);
        break;
    }
  }

  return categorized;
}

/**
 * Get the types of nested fields within an object/array field
 */
function getNestedFieldTypes(field: FieldInfo): Set<string> {
  const types = new Set<string>();
  
  if (field.nestedFields) {
    for (const nestedField of field.nestedFields) {
      types.add(nestedField.type);
      
      // Recursively check deeper nesting
      if (nestedField.nestedFields) {
        const deeperTypes = getNestedFieldTypes(nestedField);
        deeperTypes.forEach(type => types.add(type));
      }
    }
  }
  
  return types;
}

/**
 * Flatten nested fields for chart field selection
 * This includes both root-level fields and navigable nested fields
 */
function flattenFieldsForCharting(fields: FieldInfo[]): FieldInfo[] {
  const flattened: FieldInfo[] = [];
  
  function flattenRecursive(fieldList: FieldInfo[], maxDepth: number = 3) {
    for (const field of fieldList) {
      // Always include the field itself (for object/array fields, user can expand to see nested)
      flattened.push(field);
      
      // Include nested fields up to maxDepth levels
      if (field.nestedFields && (field.depth || 0) < maxDepth) {
        flattenRecursive(field.nestedFields, maxDepth);
      }
    }
  }
  
  flattenRecursive(fields);
  return flattened;
}

/**
 * Analyze nested object structure and extract navigable fields
 */
function analyzeNestedObject(
  obj: any, 
  parentKey: string, 
  depth: number = 0, 
  maxDepth: number = 3,
  parentPath: string = ''
): FieldInfo[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > maxDepth) {
    return [];
  }

  const nestedFields: FieldInfo[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) continue; // Skip metadata fields
    
    const fieldPath = parentPath ? `${parentPath}.${key}` : key;
    const fieldType = inferFieldType(value, [value]);
    
    const fieldInfo: FieldInfo = {
      key,
      type: fieldType,
      sample: value,
      description: getNestedFieldDescription(key, fieldType, value, depth),
      path: fieldPath,
      depth,
      parentField: parentKey,
      uniqueCount: 1,
      nullCount: 0
    };

    // For object types, recursively analyze nested structure
    if (fieldType === 'object' && depth < maxDepth) {
      fieldInfo.nestedFields = analyzeNestedObject(value, key, depth + 1, maxDepth, fieldPath);
    }
    
    // For array types, analyze the first few items to understand structure
    if (fieldType === 'array' && Array.isArray(value) && value.length > 0 && depth < maxDepth) {
      const arrayItemTypes = new Set();
      const nestedObjectFields: Map<string, FieldInfo> = new Map();
      
      // Analyze first few array items
      for (let i = 0; i < Math.min(3, value.length); i++) {
        const item = value[i];
        arrayItemTypes.add(typeof item);
        
        // If array contains objects, analyze their structure
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          for (const [nestedKey, nestedValue] of Object.entries(item)) {
            if (nestedKey.startsWith('_')) continue;
            
            const nestedPath = `${fieldPath}[].${nestedKey}`;
            const existingField = nestedObjectFields.get(nestedKey);
            
            if (!existingField) {
              nestedObjectFields.set(nestedKey, {
                key: nestedKey,
                type: inferFieldType(nestedValue, [nestedValue]),
                sample: nestedValue,
                description: `Array item field: ${getNestedFieldDescription(nestedKey, inferFieldType(nestedValue, [nestedValue]), nestedValue, depth + 1)}`,
                path: nestedPath,
                depth: depth + 1,
                parentField: key,
                uniqueCount: 1,
                nullCount: 0
              });
            }
          }
        }
      }
      
      if (nestedObjectFields.size > 0) {
        fieldInfo.nestedFields = Array.from(nestedObjectFields.values());
      }
    }

    nestedFields.push(fieldInfo);
  }
  
  return nestedFields;
}

/**
 * Generate description for nested fields
 */
function getNestedFieldDescription(
  key: string,
  type: FieldInfo['type'],
  value: any,
  depth: number
): string {
  const prefix = depth > 0 ? `${'  '.repeat(depth)} ` : '';
  
  switch (type) {
    case 'object':
      const objKeys = Object.keys(value || {});
      return `${prefix}object with ${objKeys.length} properties`;
    case 'array':
      const arrayLength = Array.isArray(value) ? value.length : 0;
      return `${prefix}array with ${arrayLength} items`;
    case 'numeric':
      return `${prefix}numeric value`;
    case 'categorical':
      return `${prefix}categorical value`;
    case 'temporal':
      return `${prefix}date/time value`;
    default:
      return `${prefix}${type} value`;
  }
}

/**
 * Analyze array field structure across multiple samples
 */
function analyzeArrayFieldStructure(arrayValues: any[][], parentKey: string): FieldInfo[] {
  if (arrayValues.length === 0) return [];

  const nestedFieldMap: Map<string, {
    values: any[];
    paths: string[];
    depths: number[];
  }> = new Map();

  // Analyze each array sample
  for (const arrayValue of arrayValues) {
    if (!Array.isArray(arrayValue)) continue;

    // Look at first few items in each array
    for (let i = 0; i < Math.min(3, arrayValue.length); i++) {
      const item = arrayValue[i];
      
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        // Recursively extract all nested paths from this object
        extractNestedPaths(item, `${parentKey}[]`, nestedFieldMap, 1);
      }
    }
  }

  // Convert to FieldInfo objects
  const nestedFields: FieldInfo[] = [];
  
  for (const [key, data] of nestedFieldMap.entries()) {
    const pathParts = key.split('.');
    const fieldKey = pathParts[pathParts.length - 1];
    const sampleValue = data.values.find(v => v !== undefined && v !== null) || data.values[0];
    const fieldType = inferFieldType(sampleValue, data.values.slice(0, 10));
    
    nestedFields.push({
      key: fieldKey,
      type: fieldType,
      sample: sampleValue,
      description: `Array item field: ${getNestedFieldDescription(fieldKey, fieldType, sampleValue, Math.max(...data.depths))}`,
      path: key,
      depth: Math.max(...data.depths),
      parentField: parentKey,
      uniqueCount: [...new Set(data.values)].length,
      nullCount: data.values.filter(v => v === null || v === undefined).length
    });
  }

  return nestedFields;
}

/**
 * Recursively extract all nested paths from an object
 */
function extractNestedPaths(
  obj: any,
  currentPath: string,
  fieldMap: Map<string, { values: any[]; paths: string[]; depths: number[] }>,
  depth: number,
  maxDepth: number = 3
) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > maxDepth) {
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;

    const fullPath = `${currentPath}.${key}`;
    
    // Record this field
    if (!fieldMap.has(fullPath)) {
      fieldMap.set(fullPath, { values: [], paths: [], depths: [] });
    }
    
    const fieldData = fieldMap.get(fullPath)!;
    fieldData.values.push(value);
    fieldData.paths.push(fullPath);
    fieldData.depths.push(depth);

    // Recurse into nested objects
    if (value && typeof value === 'object' && !Array.isArray(value) && depth < maxDepth) {
      extractNestedPaths(value, fullPath, fieldMap, depth + 1, maxDepth);
    }
  }
}