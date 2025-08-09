/**
 * Custom Tooltip Component
 * 
 * Reusable tooltip for all chart types with consistent styling
 */

import React from 'react';

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  labelFormatter?: (label: any) => string;
  valueFormatter?: (value: any, name: string) => [string, string];
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({ 
  active, 
  payload, 
  label,
  labelFormatter,
  valueFormatter
}) => {
  if (!active || !payload || !payload.length) return null;

  const formattedLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div className="bg-background border border-border-subtle rounded-lg shadow-lg p-3 max-w-xs">
      {formattedLabel && (
        <p className="font-medium text-text-primary mb-2 text-sm">
          {formattedLabel}
        </p>
      )}
      
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => {
          const [formattedValue, formattedName] = valueFormatter 
            ? valueFormatter(entry.value, entry.name)
            : [entry.value, entry.name];

          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-text-secondary">
                {formattedName}: <strong className="text-text-primary">{formattedValue}</strong>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomTooltip;