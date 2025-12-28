/**
 * Style Utilities for Dashboard Styling System
 *
 * Provides functions to convert style configurations to CSS
 */

import type {
  BackgroundConfig,
  BorderConfig,
  ShadowConfig,
  SpacingConfig,
  TypographyConfig,
  GradientConfig,
  DashboardStyles,
  WidgetStyles,
  AnimationConfig,
} from '../types/styling';

/**
 * Convert a gradient configuration to CSS
 */
export function gradientToCSS(gradient: GradientConfig): string {
  const stops = gradient.stops
    .sort((a, b) => a.position - b.position)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(', ');

  switch (gradient.type) {
    case 'linear':
      return `linear-gradient(${gradient.angle || 180}deg, ${stops})`;
    case 'radial':
      return `radial-gradient(circle, ${stops})`;
    case 'conic':
      return `conic-gradient(from ${gradient.angle || 0}deg, ${stops})`;
    default:
      return `linear-gradient(180deg, ${stops})`;
  }
}

/**
 * Convert a background configuration to CSS properties
 */
export function backgroundToCSS(background: BackgroundConfig): Record<string, string> {
  const css: Record<string, string> = {};

  switch (background.type) {
    case 'solid':
      css.backgroundColor = background.color || 'transparent';
      break;

    case 'gradient':
      if (background.gradient) {
        css.backgroundImage = gradientToCSS(background.gradient);
      }
      break;

    case 'image':
      if (background.image) {
        const { url, size, position, repeat, opacity, blur } = background.image;
        css.backgroundImage = `url(${url})`;
        css.backgroundSize = size;
        css.backgroundPosition = position;
        css.backgroundRepeat = repeat;
        if (opacity < 1) {
          css.opacity = String(opacity);
        }
        if (blur) {
          css.filter = `blur(${blur}px)`;
        }
      }
      break;

    case 'pattern':
      if (background.pattern) {
        const { type, color, size, opacity } = background.pattern;
        css.backgroundImage = generatePattern(type, color, size);
        css.opacity = String(opacity);
      }
      break;
  }

  // Apply overlay if present
  if (background.overlay) {
    const overlayColor = hexToRgba(background.overlay.color, background.overlay.opacity);
    if (css.backgroundImage) {
      css.backgroundImage = `linear-gradient(${overlayColor}, ${overlayColor}), ${css.backgroundImage}`;
    } else {
      css.backgroundColor = overlayColor;
    }
  }

  return css;
}

/**
 * Generate pattern CSS
 */
function generatePattern(
  type: 'dots' | 'grid' | 'lines' | 'diagonal' | 'crosshatch',
  color: string,
  size: number
): string {
  switch (type) {
    case 'dots':
      return `radial-gradient(circle, ${color} 1px, transparent 1px)`;
    case 'grid':
      return `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
    case 'lines':
      return `repeating-linear-gradient(0deg, ${color}, ${color} 1px, transparent 1px, transparent ${size}px)`;
    case 'diagonal':
      return `repeating-linear-gradient(45deg, ${color}, ${color} 1px, transparent 1px, transparent ${size}px)`;
    case 'crosshatch':
      return `repeating-linear-gradient(45deg, ${color}, ${color} 1px, transparent 1px, transparent ${size}px), repeating-linear-gradient(-45deg, ${color}, ${color} 1px, transparent 1px, transparent ${size}px)`;
    default:
      return 'none';
  }
}

/**
 * Convert a border configuration to CSS properties
 */
export function borderToCSS(border: BorderConfig): Record<string, string> {
  const css: Record<string, string> = {};

  if (border.style === 'none') {
    css.border = 'none';
    return css;
  }

  css.borderWidth = `${border.width}px`;
  css.borderStyle = border.style;
  css.borderColor = border.color;

  if (typeof border.radius === 'number') {
    css.borderRadius = `${border.radius}px`;
  } else {
    css.borderRadius = `${border.radius.topLeft}px ${border.radius.topRight}px ${border.radius.bottomRight}px ${border.radius.bottomLeft}px`;
  }

  return css;
}

/**
 * Convert a shadow configuration to CSS
 */
export function shadowToCSS(shadow: ShadowConfig): string {
  if (!shadow.enabled) {
    return 'none';
  }

  const inset = shadow.inset ? 'inset ' : '';
  return `${inset}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`;
}

/**
 * Convert a spacing configuration to CSS
 */
export function spacingToCSS(spacing: SpacingConfig): string {
  return `${spacing.top}px ${spacing.right}px ${spacing.bottom}px ${spacing.left}px`;
}

/**
 * Convert a typography configuration to CSS properties
 */
export function typographyToCSS(typography: TypographyConfig): Record<string, string> {
  const css: Record<string, string> = {
    fontFamily: typography.fontFamily,
    fontSize: `${typography.fontSize}px`,
    fontWeight: String(typography.fontWeight),
    lineHeight: String(typography.lineHeight),
    letterSpacing: `${typography.letterSpacing}em`,
  };

  if (typography.textTransform) {
    css.textTransform = typography.textTransform;
  }

  if (typography.color) {
    css.color = typography.color;
  }

  return css;
}

/**
 * Convert animation configuration to CSS properties
 */
export function animationToCSS(animation: AnimationConfig): Record<string, string> {
  if (!animation.enabled || animation.type === 'none') {
    return {};
  }

  const css: Record<string, string> = {
    animationDuration: `${animation.duration}ms`,
    animationDelay: `${animation.delay}ms`,
    animationTimingFunction: animation.easing,
  };

  switch (animation.type) {
    case 'fade':
      css.animationName = 'fadeIn';
      break;
    case 'slide':
      css.animationName = 'slideIn';
      break;
    case 'scale':
      css.animationName = 'scaleIn';
      break;
    case 'bounce':
      css.animationName = 'bounceIn';
      break;
  }

  return css;
}

/**
 * Convert hex color to rgba
 */
export function hexToRgba(hex: string, alpha: number): string {
  // Handle rgba/rgb inputs
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
    return hex;
  }

  // Remove # if present
  hex = hex.replace('#', '');

  // Handle shorthand hex
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Parse color to extract components
 */
export function parseColor(
  color: string
): { r: number; g: number; b: number; a: number } | null {
  // Handle hex
  if (color.startsWith('#')) {
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: 1,
    };
  }

  // Handle rgba
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  return null;
}

/**
 * Convert RGB to Hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate CSS class string from dashboard styles
 */
export function generateDashboardCSS(styles: DashboardStyles): string {
  const cssRules: string[] = [];

  // Dashboard container styles
  const dashboardBg = backgroundToCSS(styles.background);
  const gridPadding = spacingToCSS(styles.grid.padding);

  cssRules.push(`
    .dashboard-styled {
      ${Object.entries(dashboardBg)
        .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
        .join('\n      ')}
      padding: ${gridPadding};
      min-height: 100vh;
    }
  `);

  // Widget default styles
  const widgetBg = backgroundToCSS(styles.widgetDefaults.background);
  const widgetBorder = borderToCSS(styles.widgetDefaults.border);
  const widgetShadow = shadowToCSS(styles.widgetDefaults.shadow);
  const widgetPadding = spacingToCSS(styles.widgetDefaults.padding);

  cssRules.push(`
    .widget-styled {
      ${Object.entries(widgetBg)
        .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
        .join('\n      ')}
      ${Object.entries(widgetBorder)
        .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
        .join('\n      ')}
      box-shadow: ${widgetShadow};
      padding: ${widgetPadding};
    }
  `);

  // Typography styles
  const headingTypo = typographyToCSS(styles.typography.headings);
  const bodyTypo = typographyToCSS(styles.typography.body);
  const labelTypo = typographyToCSS(styles.typography.labels);

  cssRules.push(`
    .dashboard-styled h1, .dashboard-styled h2, .dashboard-styled h3 {
      ${Object.entries(headingTypo)
        .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
        .join('\n      ')}
    }

    .dashboard-styled p, .dashboard-styled span {
      ${Object.entries(bodyTypo)
        .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
        .join('\n      ')}
    }

    .dashboard-styled label, .dashboard-styled .label {
      ${Object.entries(labelTypo)
        .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
        .join('\n      ')}
    }
  `);

  return cssRules.join('\n');
}

/**
 * Generate inline styles object for a widget
 */
export function generateWidgetStyles(
  widgetStyles: WidgetStyles,
  dashboardDefaults: DashboardStyles['widgetDefaults']
): React.CSSProperties {
  const styles: React.CSSProperties = {};

  // Background
  const bg = widgetStyles.background || dashboardDefaults.background;
  Object.assign(styles, backgroundToCSS(bg));

  // Border
  const border = widgetStyles.border || dashboardDefaults.border;
  const borderCSS = borderToCSS(border);
  Object.entries(borderCSS).forEach(([key, value]) => {
    (styles as any)[key] = value;
  });

  // Shadow
  const shadow = widgetStyles.shadow || dashboardDefaults.shadow;
  styles.boxShadow = shadowToCSS(shadow);

  // Padding
  const padding = widgetStyles.padding || dashboardDefaults.padding;
  styles.padding = spacingToCSS(padding);

  return styles;
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Deep merge two style objects
 */
export function mergeStyles<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };

  for (const key in override) {
    if (override[key] !== undefined) {
      if (
        typeof override[key] === 'object' &&
        override[key] !== null &&
        !Array.isArray(override[key])
      ) {
        (result as any)[key] = mergeStyles(
          (base as any)[key] || {},
          override[key] as any
        );
      } else {
        (result as any)[key] = override[key];
      }
    }
  }

  return result;
}

/**
 * Generate CSS custom properties from dashboard styles
 */
export function generateCSSVariables(styles: DashboardStyles): Record<string, string> {
  const vars: Record<string, string> = {};

  // Color palette
  Object.entries(styles.colorPalette).forEach(([key, value]) => {
    vars[`--dashboard-color-${key}`] = value;
  });

  // Chart colors
  styles.chartColors.forEach((color, index) => {
    vars[`--dashboard-chart-color-${index + 1}`] = color;
  });

  // Typography
  vars['--dashboard-font-heading'] = styles.typography.headings.fontFamily;
  vars['--dashboard-font-body'] = styles.typography.body.fontFamily;
  vars['--dashboard-font-labels'] = styles.typography.labels.fontFamily;

  // Grid
  vars['--dashboard-grid-gap'] = `${styles.grid.gap}px`;
  vars['--dashboard-grid-padding'] = spacingToCSS(styles.grid.padding);

  return vars;
}

/**
 * Validate color string
 */
export function isValidColor(color: string): boolean {
  // Check hex
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)) {
    return true;
  }
  // Check rgb/rgba
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color)) {
    return true;
  }
  // Check hsl/hsla
  if (/^hsla?\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*(,\s*[\d.]+\s*)?\)$/.test(color)) {
    return true;
  }
  return false;
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(color: string, percent: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;

  const factor = percent / 100;
  const r = Math.round(parsed.r + (255 - parsed.r) * factor);
  const g = Math.round(parsed.g + (255 - parsed.g) * factor);
  const b = Math.round(parsed.b + (255 - parsed.b) * factor);

  return rgbToHex(r, g, b);
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(color: string, percent: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;

  const factor = 1 - percent / 100;
  const r = Math.round(parsed.r * factor);
  const g = Math.round(parsed.g * factor);
  const b = Math.round(parsed.b * factor);

  return rgbToHex(r, g, b);
}

/**
 * Get contrasting text color (black or white) for a background
 */
export function getContrastColor(backgroundColor: string): string {
  const parsed = parseColor(backgroundColor);
  if (!parsed) return '#ffffff';

  // Calculate relative luminance
  const luminance = (0.299 * parsed.r + 0.587 * parsed.g + 0.114 * parsed.b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}
