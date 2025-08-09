/**
 * Data Type Compatibility System
 * 
 * Defines which node output types are compatible with which widget types
 */

// Import DataType from the workflow types
export enum DataType {
  RAW_DATA = 'rawData',
  STRUCTURED_DATA = 'structuredData',
  TEXT_DATA = 'textData',
  MODEL_DATA = 'modelData',
  PREDICTION_DATA = 'predictionData',
  CHART_DATA = 'chartData',
  ANY = 'any',
}

// Widget types that can be connected to data sources
export type ConnectableWidgetType = 'chart' | 'table' | 'metric' | 'text' | 'markdown';

// Compatibility matrix - defines which data types work with which widgets
export const WIDGET_COMPATIBILITY: Record<ConnectableWidgetType, DataType[]> = {
  // Chart widgets can display structured data directly or pre-processed chart data
  chart: [
    DataType.STRUCTURED_DATA,    // Arrays/objects that can be analyzed and charted
    DataType.CHART_DATA,         // Pre-processed chart data from Chart Generator
    DataType.PREDICTION_DATA,    // ML model outputs can be charted
  ],
  
  // Table widgets work with any structured data
  table: [
    DataType.STRUCTURED_DATA,    // Primary use case - tabular data
    DataType.PREDICTION_DATA,    // ML outputs as tables
    DataType.RAW_DATA,           // Can display raw data in table format
  ],
  
  // Metric widgets extract single values or aggregates from data
  metric: [
    DataType.STRUCTURED_DATA,    // Can extract metrics from structured data
    DataType.PREDICTION_DATA,    // Model performance metrics
    DataType.CHART_DATA,         // Can extract single values
  ],
  
  // Text widgets display text content
  text: [
    DataType.TEXT_DATA,          // Primary use case - processed text
    DataType.RAW_DATA,           // Can display raw text
  ],
  
  // Markdown widgets for formatted text
  markdown: [
    DataType.TEXT_DATA,          // Assuming text data can be markdown
  ],
};

/**
 * Check if a node output type is compatible with a widget type
 */
export function isDataTypeCompatible(
  nodeOutputType: DataType, 
  widgetType: ConnectableWidgetType
): boolean {
  const compatibleTypes = WIDGET_COMPATIBILITY[widgetType];
  return compatibleTypes?.includes(nodeOutputType) || false;
}

/**
 * Get available widget types for a node, filtering by compatibility
 * This is the main function that should be called when showing widget options
 */
export function getAvailableWidgetTypes(nodeOutputType: DataType | null): {
  widgetType: ConnectableWidgetType;
  available: boolean;
  reason?: string;
}[] {
  const allWidgetTypes: ConnectableWidgetType[] = ['chart', 'table', 'metric', 'text', 'markdown'];
  
  if (!nodeOutputType) {
    return allWidgetTypes.map(type => ({
      widgetType: type,
      available: false,
      reason: 'Unknown node output type'
    }));
  }
  
  return allWidgetTypes.map(widgetType => {
    const compatible = isDataTypeCompatible(nodeOutputType, widgetType);
    return {
      widgetType,
      available: compatible,
      reason: compatible ? undefined : `${widgetType} widgets don't support ${nodeOutputType} data`
    };
  });
}

/**
 * Get all widget types that can accept a given data type
 */
export function getCompatibleWidgetTypes(dataType: DataType): ConnectableWidgetType[] {
  return Object.entries(WIDGET_COMPATIBILITY)
    .filter(([_, compatibleTypes]) => compatibleTypes.includes(dataType))
    .map(([widgetType]) => widgetType as ConnectableWidgetType);
}

/**
 * Get all data types that a widget can accept
 */
export function getCompatibleDataTypes(widgetType: ConnectableWidgetType): DataType[] {
  return WIDGET_COMPATIBILITY[widgetType] || [];
}

/**
 * Enhanced compatibility check with reasoning
 */
export interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
  suggestions?: string[];
}

export function checkCompatibilityWithReason(
  nodeOutputType: DataType,
  widgetType: ConnectableWidgetType
): CompatibilityResult {
  const compatible = isDataTypeCompatible(nodeOutputType, widgetType);
  
  if (compatible) {
    return { compatible: true };
  }
  
  // Provide helpful feedback for incompatible combinations
  const compatibleTypes = getCompatibleDataTypes(widgetType);
  const compatibleWidgets = getCompatibleWidgetTypes(nodeOutputType);
  
  return {
    compatible: false,
    reason: `${widgetType} widgets don't support ${nodeOutputType} data`,
    suggestions: [
      `This ${widgetType} widget accepts: ${compatibleTypes.join(', ')}`,
      `Your ${nodeOutputType} data works with: ${compatibleWidgets.join(', ')} widgets`,
      ...(nodeOutputType === DataType.RAW_DATA 
        ? ['Consider using an AI Processor node to structure the data first']
        : []
      ),
      ...(widgetType === 'chart' && nodeOutputType === DataType.TEXT_DATA
        ? ['Use a Chart Generator node to convert text to chart data']
        : []
      )
    ]
  };
}