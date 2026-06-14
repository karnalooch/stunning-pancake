import type { ViewStyle } from 'react-native';

/** Hard pixel shadow token (DS §5) — use instead of copy-pasted shadow blocks. */
export function pixelShadow(outlineColor: string, size: 'sm' | 'md' = 'md'): ViewStyle {
  const offset = size === 'sm' ? 2 : 4;
  return {
    shadowColor: outlineColor,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: size === 'sm' ? 4 : 8,
  };
}
