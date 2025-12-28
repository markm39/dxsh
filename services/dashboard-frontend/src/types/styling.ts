/**
 * Custom Styling Types for Dashboard System
 *
 * Comprehensive types for in-depth dashboard and widget customization
 */

// Color value - can be hex, rgb, rgba, hsl, or CSS variable
export type ColorValue = string;

// Gradient configuration
export interface GradientStop {
  color: ColorValue;
  position: number; // 0-100
}

export interface GradientConfig {
  type: 'linear' | 'radial' | 'conic';
  angle?: number; // For linear gradients (0-360)
  stops: GradientStop[];
}

// Background configuration
export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'image' | 'pattern';
  color?: ColorValue;
  gradient?: GradientConfig;
  image?: {
    url: string;
    size: 'cover' | 'contain' | 'auto' | string;
    position: string;
    repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
    opacity: number;
    blur?: number;
  };
  pattern?: {
    type: 'dots' | 'grid' | 'lines' | 'diagonal' | 'crosshatch';
    color: ColorValue;
    size: number;
    opacity: number;
  };
  overlay?: {
    color: ColorValue;
    opacity: number;
  };
}

// Border configuration
export interface BorderConfig {
  width: number;
  style: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  color: ColorValue;
  radius: number | {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
}

// Shadow configuration
export interface ShadowConfig {
  enabled: boolean;
  color: ColorValue;
  x: number;
  y: number;
  blur: number;
  spread: number;
  inset?: boolean;
}

// Typography configuration
export interface TypographyConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  lineHeight: number;
  letterSpacing: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color?: ColorValue;
}

// Spacing configuration
export interface SpacingConfig {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Animation configuration
export interface AnimationConfig {
  enabled: boolean;
  type: 'fade' | 'slide' | 'scale' | 'bounce' | 'none';
  duration: number; // in ms
  delay: number; // in ms
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// Dashboard-level styling
export interface DashboardStyles {
  // Background
  background: BackgroundConfig;

  // Grid layout
  grid: {
    gap: number;
    padding: SpacingConfig;
    columns?: number;
    rowHeight?: number;
  };

  // Global typography
  typography: {
    headings: TypographyConfig;
    body: TypographyConfig;
    labels: TypographyConfig;
  };

  // Color palette for widgets
  colorPalette: {
    primary: ColorValue;
    secondary: ColorValue;
    accent: ColorValue;
    success: ColorValue;
    warning: ColorValue;
    error: ColorValue;
    info: ColorValue;
    neutral: ColorValue;
  };

  // Chart color scheme
  chartColors: ColorValue[];

  // Global widget defaults
  widgetDefaults: {
    background: BackgroundConfig;
    border: BorderConfig;
    shadow: ShadowConfig;
    padding: SpacingConfig;
    animation: AnimationConfig;
  };

  // Header styling
  header?: {
    visible: boolean;
    background: BackgroundConfig;
    typography: TypographyConfig;
    height: number;
  };

  // Footer styling
  footer?: {
    visible: boolean;
    background: BackgroundConfig;
    typography: TypographyConfig;
    height: number;
  };
}

// Widget-level styling (overrides dashboard defaults)
export interface WidgetStyles {
  // Background
  background?: BackgroundConfig;

  // Border
  border?: BorderConfig;

  // Shadow
  shadow?: ShadowConfig;

  // Padding
  padding?: SpacingConfig;

  // Animation
  animation?: AnimationConfig;

  // Header styling
  header?: {
    visible?: boolean;
    background?: BackgroundConfig;
    typography?: TypographyConfig;
    borderBottom?: BorderConfig;
    padding?: SpacingConfig;
  };

  // Content area styling
  content?: {
    background?: BackgroundConfig;
    padding?: SpacingConfig;
    typography?: TypographyConfig;
  };

  // Footer styling
  footer?: {
    visible?: boolean;
    background?: BackgroundConfig;
    typography?: TypographyConfig;
    borderTop?: BorderConfig;
    padding?: SpacingConfig;
  };

  // Hover effects
  hover?: {
    background?: BackgroundConfig;
    border?: BorderConfig;
    shadow?: ShadowConfig;
    scale?: number;
    transition?: string;
  };

  // Widget-type specific styling
  chart?: ChartStyleConfig;
  metric?: MetricStyleConfig;
  text?: TextStyleConfig;
}

// Chart-specific styling
export interface ChartStyleConfig {
  colors?: ColorValue[];
  backgroundColor?: ColorValue;
  gridColor?: ColorValue;
  axisColor?: ColorValue;
  axisLabelColor?: ColorValue;
  tooltipBackground?: ColorValue;
  tooltipTextColor?: ColorValue;
  tooltipBorder?: BorderConfig;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right' | 'none';
  legendTextColor?: ColorValue;
  strokeWidth?: number;
  fillOpacity?: number;
  showDataLabels?: boolean;
  dataLabelColor?: ColorValue;
  animation?: AnimationConfig;
}

// Metric-specific styling
export interface MetricStyleConfig {
  valueColor?: ColorValue;
  valueSize?: number;
  valueFontWeight?: number;
  labelColor?: ColorValue;
  labelSize?: number;
  trendUpColor?: ColorValue;
  trendDownColor?: ColorValue;
  trendNeutralColor?: ColorValue;
  iconColor?: ColorValue;
  iconSize?: number;
  layout?: 'vertical' | 'horizontal' | 'compact';
  alignment?: 'left' | 'center' | 'right';
  sparklineColor?: ColorValue;
  sparklineHeight?: number;
}

// Text-specific styling
export interface TextStyleConfig {
  typography?: TypographyConfig;
  linkColor?: ColorValue;
  linkHoverColor?: ColorValue;
  codeBackground?: ColorValue;
  codeTextColor?: ColorValue;
  blockquoteBorderColor?: ColorValue;
  blockquoteBackground?: ColorValue;
  headingColors?: {
    h1?: ColorValue;
    h2?: ColorValue;
    h3?: ColorValue;
    h4?: ColorValue;
    h5?: ColorValue;
    h6?: ColorValue;
  };
}

// Preset theme definition
export interface PresetTheme {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  category: 'light' | 'dark' | 'colorful' | 'minimal' | 'professional';
  styles: DashboardStyles;
}

// CSS generation utilities
export interface GeneratedCSS {
  dashboardStyles: string;
  widgetStyles: Record<string, string>;
  cssVariables: Record<string, string>;
}

// Default values
export const DEFAULT_BACKGROUND: BackgroundConfig = {
  type: 'solid',
  color: '#0a0a0a',
};

export const DEFAULT_BORDER: BorderConfig = {
  width: 1,
  style: 'solid',
  color: '#2a2a2a',
  radius: 8,
};

export const DEFAULT_SHADOW: ShadowConfig = {
  enabled: true,
  color: 'rgba(0, 0, 0, 0.3)',
  x: 0,
  y: 1,
  blur: 3,
  spread: 0,
};

export const DEFAULT_SPACING: SpacingConfig = {
  top: 16,
  right: 16,
  bottom: 16,
  left: 16,
};

export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 1.5,
  letterSpacing: 0,
};

export const DEFAULT_ANIMATION: AnimationConfig = {
  enabled: true,
  type: 'fade',
  duration: 200,
  delay: 0,
  easing: 'ease-out',
};

export const DEFAULT_CHART_COLORS: ColorValue[] = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

export const DEFAULT_DASHBOARD_STYLES: DashboardStyles = {
  background: {
    type: 'solid',
    color: '#000000',
  },
  grid: {
    gap: 16,
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
  },
  typography: {
    headings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 18,
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: -0.02,
    },
    body: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    labels: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 1.4,
      letterSpacing: 0.02,
      textTransform: 'uppercase',
    },
  },
  colorPalette: {
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#8b5cf6',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
    neutral: '#94a3b8',
  },
  chartColors: DEFAULT_CHART_COLORS,
  widgetDefaults: {
    background: {
      type: 'solid',
      color: '#1a1b1c',
    },
    border: {
      width: 1,
      style: 'solid',
      color: '#2a2a2a',
      radius: 8,
    },
    shadow: {
      enabled: true,
      color: 'rgba(0, 0, 0, 0.3)',
      x: 0,
      y: 1,
      blur: 3,
      spread: 0,
    },
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    animation: {
      enabled: true,
      type: 'fade',
      duration: 200,
      delay: 0,
      easing: 'ease-out',
    },
  },
};

export const DEFAULT_WIDGET_STYLES: WidgetStyles = {};

// Font options for the font selector
export const FONT_OPTIONS = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Open Sans, sans-serif', label: 'Open Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Source Sans Pro, sans-serif', label: 'Source Sans Pro' },
  { value: 'Nunito, sans-serif', label: 'Nunito' },
  { value: 'JetBrains Mono, Consolas, monospace', label: 'JetBrains Mono' },
  { value: 'Fira Code, monospace', label: 'Fira Code' },
  { value: 'IBM Plex Sans, sans-serif', label: 'IBM Plex Sans' },
  { value: 'IBM Plex Mono, monospace', label: 'IBM Plex Mono' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Merriweather, serif', label: 'Merriweather' },
  { value: 'Playfair Display, serif', label: 'Playfair Display' },
];
