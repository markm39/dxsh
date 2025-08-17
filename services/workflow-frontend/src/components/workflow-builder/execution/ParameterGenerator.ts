import { LoopConfiguration, LoopParameter, NodeOutput, ParameterCombination } from './types';

export class ParameterGenerator {
  /**
   * Generate all parameter combinations for loop execution
   */
  async generateParameterCombinations(loopConfig: LoopConfiguration, inputs: NodeOutput[]): Promise<ParameterCombination[]> {
    if (!loopConfig.enabled || loopConfig.parameters.length === 0) {
      return [{}]; // Return single empty combination if no loop
    }

    console.log('🔄 Generating parameter combinations...');
    
    const parameterValues: { [key: string]: any[] } = {};
    
    // Generate values for each parameter
    for (const param of loopConfig.parameters) {
      parameterValues[param.name] = await this.generateParameterValues(param, inputs);
    }
    
    console.log('🔄 Parameter values:', parameterValues);
    
    // Generate all combinations
    const combinations = this.generateCombinations(parameterValues);
    console.log(`🔄 Generated ${combinations.length} parameter combinations`);
    
    return combinations;
  }

  /**
   * Generate values for a single parameter
   */
  private async generateParameterValues(param: LoopParameter, inputs: NodeOutput[]): Promise<any[]> {
    switch (param.type) {
      case 'range':
        return this.generateRangeValues(param);
      
      case 'list':
        return param.values || [];
      
      case 'input_variable':
        return this.extractInputValues(param, inputs);
      
      default:
        console.warn(`Unknown parameter type: ${param.type}`);
        return [];
    }
  }

  /**
   * Generate range values (e.g., 1, 2, 3, ..., 10)
   */
  private generateRangeValues(param: LoopParameter): any[] {
    const start = param.start || 1;
    const end = param.end || 10;
    const step = param.step || 1;
    
    const values = [];
    for (let i = start; i <= end; i += step) {
      values.push(i);
    }
    
    return values;
  }

  /**
   * Extract values from input data using JSONPath-like syntax
   */
  private extractInputValues(param: LoopParameter, inputs: NodeOutput[]): any[] {
    if (!param.inputPath || inputs.length === 0) {
      return [];
    }

    try {
      // Simple JSONPath implementation for common cases
      // Supports patterns like: data.items[*].id, data.users[*].name, etc.
      
      const allValues: any[] = [];
      
      for (const input of inputs) {
        const values = this.extractValuesFromObject(input.data, param.inputPath);
        allValues.push(...values);
      }
      
      // Remove duplicates
      return [...new Set(allValues)];
    } catch (error) {
      console.error('Error extracting input values:', error);
      return [];
    }
  }

  /**
   * Extract values from object using simple JSONPath
   */
  private extractValuesFromObject(data: any, path: string): any[] {
    const parts = path.split('.');
    let current = data;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.includes('[*]')) {
        // Handle array expansion
        const arrayKey = part.replace('[*]', '');
        if (current[arrayKey] && Array.isArray(current[arrayKey])) {
          const remainingPath = parts.slice(i + 1).join('.');
          if (remainingPath) {
            // Continue extracting from each array item
            const results: any[] = [];
            for (const item of current[arrayKey]) {
              results.push(...this.extractValuesFromObject(item, remainingPath));
            }
            return results;
          } else {
            // Return all array items
            return current[arrayKey];
          }
        }
        return [];
      } else {
        // Simple property access
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return [];
        }
      }
    }
    
    return Array.isArray(current) ? current : [current];
  }

  /**
   * Generate all combinations from parameter values
   */
  private generateCombinations(parameterValues: { [key: string]: any[] }): ParameterCombination[] {
    const keys = Object.keys(parameterValues);
    if (keys.length === 0) {
      return [{}];
    }
    
    const combinations: ParameterCombination[] = [];
    
    const generate = (index: number, current: ParameterCombination) => {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }
      
      const key = keys[index];
      const values = parameterValues[key];
      
      for (const value of values) {
        current[key] = value;
        generate(index + 1, current);
      }
    };
    
    generate(0, {});
    return combinations;
  }

  /**
   * Replace parameter placeholders in a string with actual values
   */
  replaceParametersInString(template: string, parameters: ParameterCombination): string {
    let result = template;
    
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
    }
    
    return result;
  }

  /**
   * Replace parameter placeholders in an object recursively
   */
  replaceParametersInObject(obj: any, parameters: ParameterCombination): any {
    if (typeof obj === 'string') {
      return this.replaceParametersInString(obj, parameters);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceParametersInObject(item, parameters));
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceParametersInObject(value, parameters);
      }
      return result;
    }
    
    return obj;
  }
}