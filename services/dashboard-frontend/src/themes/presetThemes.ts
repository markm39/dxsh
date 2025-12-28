/**
 * Preset Themes for Dashboard Styling
 *
 * Collection of professionally designed themes users can apply
 */

import type { PresetTheme, DashboardStyles } from '../types/styling';
import { DEFAULT_DASHBOARD_STYLES, DEFAULT_CHART_COLORS } from '../types/styling';

// Midnight Black - Default dark theme
export const midnightBlackTheme: PresetTheme = {
  id: 'midnight-black',
  name: 'Midnight Black',
  description: 'Pure black background with subtle accents. Clean and professional.',
  category: 'dark',
  styles: DEFAULT_DASHBOARD_STYLES,
};

// Deep Ocean - Blue-tinted dark theme
export const deepOceanTheme: PresetTheme = {
  id: 'deep-ocean',
  name: 'Deep Ocean',
  description: 'Deep blue tones with ocean-inspired accents.',
  category: 'dark',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#0a0f1a', position: 0 },
          { color: '#0d1b2a', position: 50 },
          { color: '#1b263b', position: 100 },
        ],
      },
    },
    colorPalette: {
      primary: '#0ea5e9',
      secondary: '#475569',
      accent: '#06b6d4',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#38bdf8',
      neutral: '#94a3b8',
    },
    chartColors: [
      '#0ea5e9',
      '#06b6d4',
      '#10b981',
      '#f59e0b',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
      '#f97316',
      '#84cc16',
      '#6366f1',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: 'rgba(13, 27, 42, 0.8)',
      },
      border: {
        width: 1,
        style: 'solid',
        color: 'rgba(14, 165, 233, 0.2)',
        radius: 12,
      },
      shadow: {
        enabled: true,
        color: 'rgba(14, 165, 233, 0.1)',
        x: 0,
        y: 4,
        blur: 12,
        spread: 0,
      },
    },
  },
};

// Cyberpunk Neon - Vibrant neon accents on dark
export const cyberpunkNeonTheme: PresetTheme = {
  id: 'cyberpunk-neon',
  name: 'Cyberpunk Neon',
  description: 'Futuristic neon colors with a cyberpunk aesthetic.',
  category: 'colorful',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#0a0a0f', position: 0 },
          { color: '#1a0a2e', position: 100 },
        ],
      },
    },
    colorPalette: {
      primary: '#ff00ff',
      secondary: '#00ffff',
      accent: '#ff0080',
      success: '#00ff88',
      warning: '#ffcc00',
      error: '#ff3366',
      info: '#00ccff',
      neutral: '#9999ff',
    },
    chartColors: [
      '#ff00ff',
      '#00ffff',
      '#ff0080',
      '#00ff88',
      '#ffcc00',
      '#ff3366',
      '#00ccff',
      '#9999ff',
      '#ff6600',
      '#6600ff',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: 'rgba(26, 10, 46, 0.9)',
      },
      border: {
        width: 1,
        style: 'solid',
        color: 'rgba(255, 0, 255, 0.3)',
        radius: 4,
      },
      shadow: {
        enabled: true,
        color: 'rgba(255, 0, 255, 0.2)',
        x: 0,
        y: 0,
        blur: 20,
        spread: 0,
      },
    },
  },
};

// Forest Green - Nature-inspired theme
export const forestGreenTheme: PresetTheme = {
  id: 'forest-green',
  name: 'Forest Green',
  description: 'Calm, nature-inspired greens and earth tones.',
  category: 'dark',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#0a1612', position: 0 },
          { color: '#1a2f23', position: 100 },
        ],
      },
    },
    colorPalette: {
      primary: '#22c55e',
      secondary: '#6b8e6b',
      accent: '#10b981',
      success: '#4ade80',
      warning: '#d97706',
      error: '#dc2626',
      info: '#0d9488',
      neutral: '#86a386',
    },
    chartColors: [
      '#22c55e',
      '#10b981',
      '#0d9488',
      '#4ade80',
      '#84cc16',
      '#d97706',
      '#059669',
      '#14b8a6',
      '#65a30d',
      '#16a34a',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: 'rgba(26, 47, 35, 0.9)',
      },
      border: {
        width: 1,
        style: 'solid',
        color: 'rgba(34, 197, 94, 0.2)',
        radius: 8,
      },
      shadow: {
        enabled: true,
        color: 'rgba(34, 197, 94, 0.1)',
        x: 0,
        y: 4,
        blur: 12,
        spread: 0,
      },
    },
  },
};

// Sunset Orange - Warm gradient theme
export const sunsetOrangeTheme: PresetTheme = {
  id: 'sunset-orange',
  name: 'Sunset Orange',
  description: 'Warm sunset colors with orange and purple accents.',
  category: 'colorful',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#1a0a0a', position: 0 },
          { color: '#2d1810', position: 50 },
          { color: '#1a1020', position: 100 },
        ],
      },
    },
    colorPalette: {
      primary: '#f97316',
      secondary: '#ea580c',
      accent: '#fb923c',
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
      info: '#8b5cf6',
      neutral: '#d4a373',
    },
    chartColors: [
      '#f97316',
      '#fb923c',
      '#fbbf24',
      '#8b5cf6',
      '#ec4899',
      '#ef4444',
      '#22c55e',
      '#f59e0b',
      '#a855f7',
      '#f43f5e',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: 'rgba(45, 24, 16, 0.9)',
      },
      border: {
        width: 1,
        style: 'solid',
        color: 'rgba(249, 115, 22, 0.2)',
        radius: 10,
      },
      shadow: {
        enabled: true,
        color: 'rgba(249, 115, 22, 0.15)',
        x: 0,
        y: 4,
        blur: 16,
        spread: 0,
      },
    },
  },
};

// Arctic White - Light minimal theme
export const arcticWhiteTheme: PresetTheme = {
  id: 'arctic-white',
  name: 'Arctic White',
  description: 'Clean white background with subtle blue accents.',
  category: 'light',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'solid',
      color: '#f8fafc',
    },
    colorPalette: {
      primary: '#3b82f6',
      secondary: '#64748b',
      accent: '#0ea5e9',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4',
      neutral: '#94a3b8',
    },
    typography: {
      headings: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 18,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: -0.02,
        color: '#1e293b',
      },
      body: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
        color: '#334155',
      },
      labels: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: 0.02,
        textTransform: 'uppercase',
        color: '#64748b',
      },
    },
    chartColors: DEFAULT_CHART_COLORS,
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: '#ffffff',
      },
      border: {
        width: 1,
        style: 'solid',
        color: '#e2e8f0',
        radius: 12,
      },
      shadow: {
        enabled: true,
        color: 'rgba(0, 0, 0, 0.06)',
        x: 0,
        y: 2,
        blur: 8,
        spread: 0,
      },
    },
  },
};

// Soft Gray - Neutral professional theme
export const softGrayTheme: PresetTheme = {
  id: 'soft-gray',
  name: 'Soft Gray',
  description: 'Neutral gray tones for a professional look.',
  category: 'light',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'solid',
      color: '#f1f5f9',
    },
    colorPalette: {
      primary: '#475569',
      secondary: '#64748b',
      accent: '#3b82f6',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4',
      neutral: '#94a3b8',
    },
    typography: {
      headings: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 18,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: -0.02,
        color: '#1e293b',
      },
      body: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
        color: '#334155',
      },
      labels: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: 0.02,
        textTransform: 'uppercase',
        color: '#64748b',
      },
    },
    chartColors: [
      '#475569',
      '#64748b',
      '#3b82f6',
      '#22c55e',
      '#f59e0b',
      '#ef4444',
      '#06b6d4',
      '#8b5cf6',
      '#ec4899',
      '#84cc16',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: '#ffffff',
      },
      border: {
        width: 1,
        style: 'solid',
        color: '#e2e8f0',
        radius: 8,
      },
      shadow: {
        enabled: true,
        color: 'rgba(0, 0, 0, 0.04)',
        x: 0,
        y: 1,
        blur: 4,
        spread: 0,
      },
    },
  },
};

// Royal Purple - Rich purple theme
export const royalPurpleTheme: PresetTheme = {
  id: 'royal-purple',
  name: 'Royal Purple',
  description: 'Rich purple tones with a luxurious feel.',
  category: 'dark',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#0f0a1a', position: 0 },
          { color: '#1a1025', position: 50 },
          { color: '#150d20', position: 100 },
        ],
      },
    },
    colorPalette: {
      primary: '#8b5cf6',
      secondary: '#a78bfa',
      accent: '#c084fc',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4',
      neutral: '#a1a1aa',
    },
    chartColors: [
      '#8b5cf6',
      '#a78bfa',
      '#c084fc',
      '#e879f9',
      '#f472b6',
      '#fb7185',
      '#06b6d4',
      '#22c55e',
      '#f59e0b',
      '#6366f1',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: 'rgba(26, 16, 37, 0.9)',
      },
      border: {
        width: 1,
        style: 'solid',
        color: 'rgba(139, 92, 246, 0.2)',
        radius: 12,
      },
      shadow: {
        enabled: true,
        color: 'rgba(139, 92, 246, 0.15)',
        x: 0,
        y: 4,
        blur: 16,
        spread: 0,
      },
    },
  },
};

// Minimal Dark - Clean minimal dark theme
export const minimalDarkTheme: PresetTheme = {
  id: 'minimal-dark',
  name: 'Minimal Dark',
  description: 'Ultra-clean dark theme with minimal visual noise.',
  category: 'minimal',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'solid',
      color: '#18181b',
    },
    colorPalette: {
      primary: '#a1a1aa',
      secondary: '#71717a',
      accent: '#fafafa',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4',
      neutral: '#52525b',
    },
    chartColors: [
      '#a1a1aa',
      '#71717a',
      '#52525b',
      '#fafafa',
      '#e4e4e7',
      '#d4d4d8',
      '#a1a1aa',
      '#71717a',
      '#52525b',
      '#3f3f46',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: '#27272a',
      },
      border: {
        width: 0,
        style: 'none',
        color: 'transparent',
        radius: 6,
      },
      shadow: {
        enabled: false,
        color: 'transparent',
        x: 0,
        y: 0,
        blur: 0,
        spread: 0,
      },
    },
  },
};

// Corporate Blue - Professional business theme
export const corporateBlueTheme: PresetTheme = {
  id: 'corporate-blue',
  name: 'Corporate Blue',
  description: 'Professional blue theme for business dashboards.',
  category: 'professional',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'solid',
      color: '#0c1929',
    },
    colorPalette: {
      primary: '#2563eb',
      secondary: '#3b82f6',
      accent: '#60a5fa',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#0ea5e9',
      neutral: '#94a3b8',
    },
    chartColors: [
      '#2563eb',
      '#3b82f6',
      '#60a5fa',
      '#93c5fd',
      '#22c55e',
      '#f59e0b',
      '#0ea5e9',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: '#1e3a5f',
      },
      border: {
        width: 1,
        style: 'solid',
        color: 'rgba(37, 99, 235, 0.3)',
        radius: 8,
      },
      shadow: {
        enabled: true,
        color: 'rgba(0, 0, 0, 0.3)',
        x: 0,
        y: 2,
        blur: 8,
        spread: 0,
      },
    },
  },
};

// Rose Gold - Elegant rose-tinted theme
export const roseGoldTheme: PresetTheme = {
  id: 'rose-gold',
  name: 'Rose Gold',
  description: 'Elegant rose and gold tones for a sophisticated look.',
  category: 'colorful',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#1a1015', position: 0 },
          { color: '#251a1f', position: 100 },
        ],
      },
    },
    colorPalette: {
      primary: '#f43f5e',
      secondary: '#fb7185',
      accent: '#fbbf24',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#ec4899',
      neutral: '#d4a5a5',
    },
    chartColors: [
      '#f43f5e',
      '#fb7185',
      '#fbbf24',
      '#ec4899',
      '#f472b6',
      '#e879f9',
      '#c084fc',
      '#a78bfa',
      '#22c55e',
      '#f59e0b',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: 'rgba(37, 26, 31, 0.9)',
      },
      border: {
        width: 1,
        style: 'solid',
        color: 'rgba(244, 63, 94, 0.2)',
        radius: 12,
      },
      shadow: {
        enabled: true,
        color: 'rgba(244, 63, 94, 0.1)',
        x: 0,
        y: 4,
        blur: 12,
        spread: 0,
      },
    },
  },
};

// Terminal Green - Retro terminal theme
export const terminalGreenTheme: PresetTheme = {
  id: 'terminal-green',
  name: 'Terminal Green',
  description: 'Retro terminal aesthetic with phosphor green.',
  category: 'dark',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'solid',
      color: '#0a0a0a',
    },
    colorPalette: {
      primary: '#00ff00',
      secondary: '#00cc00',
      accent: '#00ff88',
      success: '#00ff00',
      warning: '#ffcc00',
      error: '#ff0000',
      info: '#00ffcc',
      neutral: '#008800',
    },
    typography: {
      headings: {
        fontFamily: 'JetBrains Mono, Consolas, monospace',
        fontSize: 18,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: 0,
        color: '#00ff00',
      },
      body: {
        fontFamily: 'JetBrains Mono, Consolas, monospace',
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
        color: '#00cc00',
      },
      labels: {
        fontFamily: 'JetBrains Mono, Consolas, monospace',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: 0.05,
        textTransform: 'uppercase',
        color: '#00aa00',
      },
    },
    chartColors: [
      '#00ff00',
      '#00cc00',
      '#00ff88',
      '#00ffcc',
      '#88ff00',
      '#ffcc00',
      '#00ff44',
      '#44ff00',
      '#00ffaa',
      '#00aa00',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: '#0f0f0f',
      },
      border: {
        width: 1,
        style: 'solid',
        color: '#00ff00',
        radius: 0,
      },
      shadow: {
        enabled: true,
        color: 'rgba(0, 255, 0, 0.1)',
        x: 0,
        y: 0,
        blur: 10,
        spread: 0,
      },
    },
  },
};

// Warm Sepia - Vintage warm theme
export const warmSepiaTheme: PresetTheme = {
  id: 'warm-sepia',
  name: 'Warm Sepia',
  description: 'Warm, vintage-inspired sepia tones.',
  category: 'light',
  styles: {
    ...DEFAULT_DASHBOARD_STYLES,
    background: {
      type: 'solid',
      color: '#f5f0e6',
    },
    colorPalette: {
      primary: '#8b4513',
      secondary: '#a0522d',
      accent: '#cd853f',
      success: '#228b22',
      warning: '#daa520',
      error: '#b22222',
      info: '#4682b4',
      neutral: '#8b8378',
    },
    typography: {
      headings: {
        fontFamily: 'Georgia, serif',
        fontSize: 18,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: 0,
        color: '#3e2723',
      },
      body: {
        fontFamily: 'Georgia, serif',
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.6,
        letterSpacing: 0,
        color: '#4e342e',
      },
      labels: {
        fontFamily: 'Georgia, serif',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: 0.02,
        textTransform: 'uppercase',
        color: '#6d4c41',
      },
    },
    chartColors: [
      '#8b4513',
      '#a0522d',
      '#cd853f',
      '#deb887',
      '#d2691e',
      '#228b22',
      '#daa520',
      '#4682b4',
      '#bc8f8f',
      '#8fbc8f',
    ],
    widgetDefaults: {
      ...DEFAULT_DASHBOARD_STYLES.widgetDefaults,
      background: {
        type: 'solid',
        color: '#faf6ed',
      },
      border: {
        width: 1,
        style: 'solid',
        color: '#d4c4a8',
        radius: 4,
      },
      shadow: {
        enabled: true,
        color: 'rgba(139, 69, 19, 0.1)',
        x: 0,
        y: 2,
        blur: 8,
        spread: 0,
      },
    },
  },
};

// Export all preset themes
export const PRESET_THEMES: PresetTheme[] = [
  midnightBlackTheme,
  deepOceanTheme,
  cyberpunkNeonTheme,
  forestGreenTheme,
  sunsetOrangeTheme,
  arcticWhiteTheme,
  softGrayTheme,
  royalPurpleTheme,
  minimalDarkTheme,
  corporateBlueTheme,
  roseGoldTheme,
  terminalGreenTheme,
  warmSepiaTheme,
];

// Get theme by ID
export function getPresetTheme(id: string): PresetTheme | undefined {
  return PRESET_THEMES.find((theme) => theme.id === id);
}

// Get themes by category
export function getThemesByCategory(
  category: PresetTheme['category']
): PresetTheme[] {
  return PRESET_THEMES.filter((theme) => theme.category === category);
}

export default PRESET_THEMES;
