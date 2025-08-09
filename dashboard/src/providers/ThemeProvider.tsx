/**
 * Theme Provider
 * 
 * Manages dashboard themes and provides theme context to components
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { DashboardTheme } from '@shared/types';

// Default theme configuration - Chatmark black theme with colored elements
const defaultTheme: DashboardTheme = {
  name: 'default',
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    background: '#000000',
    surface: '#0a0a0a',
    text: {
      primary: '#e2e8f0',
      secondary: '#94a3b8',
      muted: '#64748b',
    },
    border: '#1f1f1f',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  fonts: {
    primary: 'Inter, system-ui, sans-serif',
    secondary: 'JetBrains Mono, Consolas, monospace',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
};

// Dark theme variant - Same as default for Chatmark consistency
const darkTheme: DashboardTheme = {
  ...defaultTheme,
  name: 'dark',
  colors: {
    ...defaultTheme.colors,
    background: '#000000',
    surface: '#0a0a0a',
    text: {
      primary: '#e2e8f0',
      secondary: '#94a3b8',
      muted: '#64748b',
    },
    border: '#1f1f1f',
  },
};

// Available themes
const themes = {
  default: defaultTheme,
  dark: darkTheme,
};

type ThemeName = keyof typeof themes;

interface ThemeContextValue {
  theme: DashboardTheme;
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
  toggleTheme: () => void;
  customTheme: DashboardTheme | null;
  setCustomTheme: (theme: DashboardTheme) => void;
  clearCustomTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme: initialTheme = 'default',
}) => {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    // Load theme from localStorage
    const saved = localStorage.getItem('dashboard-theme');
    return (saved as ThemeName) || initialTheme;
  });

  const [customTheme, setCustomTheme] = useState<DashboardTheme | null>(() => {
    // Load custom theme from localStorage
    const saved = localStorage.getItem('dashboard-custom-theme');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Get current theme (custom or predefined)
  const theme = customTheme || themes[themeName];

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply CSS custom properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      if (typeof value === 'string') {
        root.style.setProperty(`--color-${key}`, value);
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          root.style.setProperty(`--color-${key}-${subKey}`, subValue);
        });
      }
    });

    // Apply font family
    root.style.setProperty('--font-primary', theme.fonts.primary);
    if (theme.fonts.secondary) {
      root.style.setProperty('--font-secondary', theme.fonts.secondary);
    }

    // Apply spacing
    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, `${value}px`);
    });

    // Apply border radius
    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, `${value}px`);
    });

    // Apply shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    // Apply dark mode class
    if (themeName === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, themeName]);

  // Persist theme to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-theme', themeName);
  }, [themeName]);

  // Persist custom theme to localStorage
  useEffect(() => {
    if (customTheme) {
      localStorage.setItem('dashboard-custom-theme', JSON.stringify(customTheme));
    } else {
      localStorage.removeItem('dashboard-custom-theme');
    }
  }, [customTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if no custom theme is set
      if (!customTheme && !localStorage.getItem('dashboard-theme')) {
        setThemeName(e.matches ? 'dark' : 'default');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [customTheme]);

  const handleSetTheme = (newThemeName: ThemeName) => {
    setThemeName(newThemeName);
    // Clear custom theme when switching to predefined theme
    if (customTheme) {
      setCustomTheme(null);
    }
  };

  const toggleTheme = () => {
    const newTheme = themeName === 'default' ? 'dark' : 'default';
    handleSetTheme(newTheme);
  };

  const handleSetCustomTheme = (newCustomTheme: DashboardTheme) => {
    setCustomTheme(newCustomTheme);
  };

  const clearCustomTheme = () => {
    setCustomTheme(null);
  };

  const value: ThemeContextValue = {
    theme,
    themeName,
    setTheme: handleSetTheme,
    toggleTheme,
    customTheme,
    setCustomTheme: handleSetCustomTheme,
    clearCustomTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme utilities
export const getThemeColor = (theme: DashboardTheme, colorPath: string): string => {
  const keys = colorPath.split('.');
  let value: any = theme.colors;
  
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) break;
  }
  
  return typeof value === 'string' ? value : theme.colors.primary;
};

export const createThemeVariant = (
  baseTheme: DashboardTheme,
  overrides: Partial<DashboardTheme>
): DashboardTheme => {
  return {
    ...baseTheme,
    ...overrides,
    colors: {
      ...baseTheme.colors,
      ...overrides.colors,
      text: {
        ...baseTheme.colors.text,
        ...overrides.colors?.text,
      },
    },
  };
};

export default ThemeProvider;