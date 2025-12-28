/**
 * Tests for Style Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  gradientToCSS,
  backgroundToCSS,
  borderToCSS,
  shadowToCSS,
  spacingToCSS,
  typographyToCSS,
  hexToRgba,
  parseColor,
  rgbToHex,
  isValidColor,
  lightenColor,
  darkenColor,
  getContrastColor,
  mergeStyles,
} from './styleUtils';
import type {
  GradientConfig,
  BackgroundConfig,
  BorderConfig,
  ShadowConfig,
  SpacingConfig,
  TypographyConfig,
} from '../types/styling';

describe('gradientToCSS', () => {
  it('should convert linear gradient correctly', () => {
    const gradient: GradientConfig = {
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#000000', position: 0 },
        { color: '#ffffff', position: 100 },
      ],
    };
    const result = gradientToCSS(gradient);
    expect(result).toBe('linear-gradient(90deg, #000000 0%, #ffffff 100%)');
  });

  it('should convert radial gradient correctly', () => {
    const gradient: GradientConfig = {
      type: 'radial',
      stops: [
        { color: '#ff0000', position: 0 },
        { color: '#0000ff', position: 100 },
      ],
    };
    const result = gradientToCSS(gradient);
    expect(result).toBe('radial-gradient(circle, #ff0000 0%, #0000ff 100%)');
  });

  it('should handle multiple stops', () => {
    const gradient: GradientConfig = {
      type: 'linear',
      angle: 180,
      stops: [
        { color: '#ff0000', position: 0 },
        { color: '#00ff00', position: 50 },
        { color: '#0000ff', position: 100 },
      ],
    };
    const result = gradientToCSS(gradient);
    expect(result).toBe(
      'linear-gradient(180deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)'
    );
  });
});

describe('backgroundToCSS', () => {
  it('should convert solid background correctly', () => {
    const background: BackgroundConfig = {
      type: 'solid',
      color: '#123456',
    };
    const result = backgroundToCSS(background);
    expect(result.backgroundColor).toBe('#123456');
  });

  it('should convert gradient background correctly', () => {
    const background: BackgroundConfig = {
      type: 'gradient',
      gradient: {
        type: 'linear',
        angle: 45,
        stops: [
          { color: '#000', position: 0 },
          { color: '#fff', position: 100 },
        ],
      },
    };
    const result = backgroundToCSS(background);
    expect(result.backgroundImage).toContain('linear-gradient');
  });
});

describe('borderToCSS', () => {
  it('should convert border with uniform radius', () => {
    const border: BorderConfig = {
      width: 2,
      style: 'solid',
      color: '#ff0000',
      radius: 8,
    };
    const result = borderToCSS(border);
    expect(result.borderWidth).toBe('2px');
    expect(result.borderStyle).toBe('solid');
    expect(result.borderColor).toBe('#ff0000');
    expect(result.borderRadius).toBe('8px');
  });

  it('should convert border with individual radius', () => {
    const border: BorderConfig = {
      width: 1,
      style: 'dashed',
      color: '#00ff00',
      radius: {
        topLeft: 4,
        topRight: 8,
        bottomRight: 12,
        bottomLeft: 16,
      },
    };
    const result = borderToCSS(border);
    expect(result.borderRadius).toBe('4px 8px 12px 16px');
  });

  it('should handle none style', () => {
    const border: BorderConfig = {
      width: 2,
      style: 'none',
      color: '#000',
      radius: 0,
    };
    const result = borderToCSS(border);
    expect(result.border).toBe('none');
  });
});

describe('shadowToCSS', () => {
  it('should return none when disabled', () => {
    const shadow: ShadowConfig = {
      enabled: false,
      color: '#000',
      x: 0,
      y: 0,
      blur: 0,
      spread: 0,
    };
    const result = shadowToCSS(shadow);
    expect(result).toBe('none');
  });

  it('should convert enabled shadow correctly', () => {
    const shadow: ShadowConfig = {
      enabled: true,
      color: 'rgba(0,0,0,0.5)',
      x: 2,
      y: 4,
      blur: 8,
      spread: 1,
    };
    const result = shadowToCSS(shadow);
    expect(result).toBe('2px 4px 8px 1px rgba(0,0,0,0.5)');
  });

  it('should handle inset shadow', () => {
    const shadow: ShadowConfig = {
      enabled: true,
      color: '#000',
      x: 0,
      y: 2,
      blur: 4,
      spread: 0,
      inset: true,
    };
    const result = shadowToCSS(shadow);
    expect(result).toContain('inset');
  });
});

describe('spacingToCSS', () => {
  it('should convert spacing correctly', () => {
    const spacing: SpacingConfig = {
      top: 10,
      right: 20,
      bottom: 30,
      left: 40,
    };
    const result = spacingToCSS(spacing);
    expect(result).toBe('10px 20px 30px 40px');
  });
});

describe('typographyToCSS', () => {
  it('should convert typography correctly', () => {
    const typography: TypographyConfig = {
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 600,
      lineHeight: 1.5,
      letterSpacing: 0.02,
    };
    const result = typographyToCSS(typography);
    expect(result.fontFamily).toBe('Arial, sans-serif');
    expect(result.fontSize).toBe('16px');
    expect(result.fontWeight).toBe('600');
    expect(result.lineHeight).toBe('1.5');
    expect(result.letterSpacing).toBe('0.02em');
  });

  it('should include text transform when specified', () => {
    const typography: TypographyConfig = {
      fontFamily: 'Arial',
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: 0,
      textTransform: 'uppercase',
    };
    const result = typographyToCSS(typography);
    expect(result.textTransform).toBe('uppercase');
  });
});

describe('hexToRgba', () => {
  it('should convert hex to rgba with alpha', () => {
    const result = hexToRgba('#ff0000', 0.5);
    expect(result).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('should handle shorthand hex', () => {
    const result = hexToRgba('#f00', 1);
    expect(result).toBe('rgba(255, 0, 0, 1)');
  });

  it('should pass through rgba values', () => {
    const result = hexToRgba('rgba(100, 100, 100, 0.3)', 0.5);
    expect(result).toBe('rgba(100, 100, 100, 0.3)');
  });
});

describe('parseColor', () => {
  it('should parse hex colors', () => {
    const result = parseColor('#ff5500');
    expect(result).toEqual({ r: 255, g: 85, b: 0, a: 1 });
  });

  it('should parse shorthand hex', () => {
    const result = parseColor('#f50');
    expect(result).toEqual({ r: 255, g: 85, b: 0, a: 1 });
  });

  it('should parse rgba colors', () => {
    const result = parseColor('rgba(100, 150, 200, 0.5)');
    expect(result).toEqual({ r: 100, g: 150, b: 200, a: 0.5 });
  });

  it('should parse rgb colors', () => {
    const result = parseColor('rgb(50, 100, 150)');
    expect(result).toEqual({ r: 50, g: 100, b: 150, a: 1 });
  });
});

describe('rgbToHex', () => {
  it('should convert rgb to hex', () => {
    const result = rgbToHex(255, 128, 0);
    expect(result).toBe('#ff8000');
  });

  it('should handle edge values', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });
});

describe('isValidColor', () => {
  it('should validate hex colors', () => {
    expect(isValidColor('#fff')).toBe(true);
    expect(isValidColor('#ffffff')).toBe(true);
    expect(isValidColor('#FF00FF')).toBe(true);
  });

  it('should validate rgb/rgba colors', () => {
    expect(isValidColor('rgb(0, 0, 0)')).toBe(true);
    expect(isValidColor('rgba(255, 255, 255, 0.5)')).toBe(true);
  });

  it('should reject invalid colors', () => {
    expect(isValidColor('invalid')).toBe(false);
    expect(isValidColor('#gg0000')).toBe(false);
  });
});

describe('lightenColor', () => {
  it('should lighten a color', () => {
    const result = lightenColor('#000000', 50);
    expect(result).toBe('#808080');
  });
});

describe('darkenColor', () => {
  it('should darken a color', () => {
    const result = darkenColor('#ffffff', 50);
    expect(result).toBe('#808080');
  });
});

describe('getContrastColor', () => {
  it('should return white for dark backgrounds', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff');
    expect(getContrastColor('#333333')).toBe('#ffffff');
  });

  it('should return black for light backgrounds', () => {
    expect(getContrastColor('#ffffff')).toBe('#000000');
    expect(getContrastColor('#eeeeee')).toBe('#000000');
  });
});

describe('mergeStyles', () => {
  it('should deep merge style objects', () => {
    const base = {
      background: { type: 'solid' as const, color: '#000' },
      border: { width: 1, style: 'solid' as const, color: '#fff', radius: 4 },
    };
    const override = {
      background: { color: '#fff' },
    };
    const result = mergeStyles(base, override as any);
    expect(result.background.color).toBe('#fff');
    expect(result.background.type).toBe('solid');
    expect(result.border.width).toBe(1);
  });
});
