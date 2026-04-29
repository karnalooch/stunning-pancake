import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

// HD2D Pixel Scale from design_tokens.json
export const PIXEL_SCALE = 2;

/**
 * Scaler for HD2D elements.
 * Ensures that pixel art elements stay on a "virtual grid" by multiplying by PIXEL_SCALE.
 */
export const px = (value: number) => value * PIXEL_SCALE;

/**
 * Precise scaler that accounts for screen density but keeps the HD2D chunky feel.
 */
export const scaledPx = (value: number) => {
  const scaled = value * PIXEL_SCALE;
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
};

export const SCREEN_WIDTH = width;
export const SCREEN_HEIGHT = height;

export const LAYOUT = {
  borderWidth: 1,
  pixelScale: PIXEL_SCALE,
  outlineColor: '#000000',
  shadow: {
    shadowColor: 'rgba(0,0,0,1)',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4, // For Android
  }
};
