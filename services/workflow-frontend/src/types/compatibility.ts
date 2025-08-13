/**
 * Data Type Compatibility System
 * 
 * Defines which node output types are compatible with which widget types
 */

// Data types that nodes can output
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
 * Convert string output type to DataType enum
 */
export function stringToDataType(outputType: string): DataType | null {
  const normalizedType = outputType.toLowerCase();
  
  switch (normalizedType) {
    case 'rawdata':
    case 'raw_data':
      return DataType.RAW_DATA;
    case 'structureddata':
    case 'structured_data':
      return DataType.STRUCTURED_DATA;
    case 'textdata':
    case 'text_data':
      return DataType.TEXT_DATA;
    case 'modeldata':
    case 'model_data':
      return DataType.MODEL_DATA;
    case 'predictiondata':
    case 'prediction_data':
      return DataType.PREDICTION_DATA;
    case 'chartdata':
    case 'chart_data':
      return DataType.CHART_DATA;
    case 'any':
      return DataType.ANY;
    default:
      return null;
  }
}