/**
 * PixelText — Unistyles-powered retro pixel typography component.
 *
 * Colors flow through the Grand Prix theme (`theme.colors.*`).
 *
 * Size variants: xs (10), sm (12), md (14), lg (18), xl (24), 2xl (32)
 * Color variants: text, muted, inverse, primary, secondary, success, warning, error, cream, sepia
 */

import React from 'react';
import { Text, type TextProps } from 'react-native';
import { StyleSheet, useUnistyles } from '../theme/unistyles';
import type { GrandPrixTheme } from '../theme/unistyles';
import { FONTS } from '../theme/fonts';

// ─── Types ──────────────────────────────────────────────────────────

export type PixelTextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export type PixelTextColor =
    | 'text'
    | 'muted'
    | 'inverse'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'cream'
    | 'sepia';

export interface PixelTextProps extends Omit<TextProps, 'style'> {
    /** Pre-set size variant (default: 'md') */
    size?: PixelTextSize;
    /** Color variant mapped to theme tokens (default: 'text') */
    color?: PixelTextColor;
    /** Enable hard 2px pixel-art drop shadow */
    shadow?: boolean;
    /** Optional style overrides merged after variant styles */
    style?: TextProps['style'];
}

// ─── Component ──────────────────────────────────────────────────────

export const PixelText: React.FC<PixelTextProps> = ({
    size = 'md',
    color = 'text',
    shadow = false,
    style,
    children,
    ...rest
}) => {
    const { theme } = useUnistyles();
    const themeColors = theme.colors as GrandPrixTheme['colors'];

    return (
        <Text
            style={[
                styles.base,
                SIZE_STYLES[size],
                resolveColor(color, themeColors),
                shadow && styles.shadow,
                style,
            ]}
            {...rest}
        >
            {children}
        </Text>
    );
};

// ─── Size Styles (static, theme-independent) ────────────────────────

const SIZE_STYLES: Record<PixelTextSize, TextProps['style']> = {
    xs: { fontSize: 10 },
    sm: { fontSize: 12 },
    md: { fontSize: 14 },
    lg: { fontSize: 18 },
    xl: { fontSize: 24 },
    '2xl': { fontSize: 32 },
};

// ─── Color Resolver ─────────────────────────────────────────────────

function resolveColor(
    variant: PixelTextColor,
    colors: GrandPrixTheme['colors'],
): TextProps['style'] {
    if (variant === 'primary') return { color: colors.primary };
    if (variant === 'secondary') return { color: colors.secondary };
    if (variant === 'success') return { color: colors.primary };
    if (variant === 'warning') return { color: colors.hudWarning };
    if (variant === 'error') return { color: colors.error };
    if (variant === 'cream') return { color: colors.gpGoldLight };
    if (variant === 'sepia') return { color: colors.gpSepia };
    if (variant === 'text') return { color: colors.onBackground };
    if (variant === 'muted') return { color: colors.outline };
    return { color: colors.onPrimary };
}

// ─── Unistyles Stylesheet ────────────────────────────────────────────

const styles = StyleSheet.create({
    base: {
        fontFamily: FONTS.display,
        letterSpacing: 0.5,
    },
    shadow: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 0,
    },
});
