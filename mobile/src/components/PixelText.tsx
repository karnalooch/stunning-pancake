/**
 * PixelText — Unistyles-powered retro pixel typography component.
 *
 * Replaces the Tamagui-based arcade/PixelText with plain RN Text +
 * Unistyles StyleSheet.create(). All colors flow through theme.colors.* tokens
 * and reactively switch between octopath (dark) and solar (light) palettes.
 *
 * Size variants: xs (10), sm (12), md (14), lg (18), xl (24), 2xl (32)
 * Color variants: text, muted, inverse, primary, secondary, success, warning, error, cream, sepia
 */

import React from 'react';
import { Text, type TextProps } from 'react-native';
import { StyleSheet, useUnistyles, UnistylesRuntime } from '../theme/unistyles';
import { colors as tokens } from '@tokens/generated/restyle-colors';

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

/**
 * PixelText — Base typography component for the entire app.
 * Enforces the "Press Start 2P" font and handles arcade-style drop shadows.
 *
 * Colors auto-switch based on the active Unistyles theme:
 * - octopath (dark): cream text on deep sea backgrounds
 * - solar (light): dark brown text on cream backgrounds
 */
export const PixelText: React.FC<PixelTextProps> = ({
    size = 'md',
    color = 'text',
    shadow = false,
    style,
    children,
    ...rest
}) => {
    useUnistyles(); // Subscribe to theme changes for reactivity

    // Resolve the current theme name for color resolution
    const themeName = (UnistylesRuntime.themeName ?? 'octopath') as ThemeKey;

    return (
        <Text
            style={[
                styles.base,
                SIZE_STYLES[size],
                resolveColor(color, themeName),
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

type ThemeKey = 'octopath' | 'solar' | 'stitch';

/** Resolve a color variant to the correct theme group and return a style object. */
function resolveColor(
    variant: PixelTextColor,
    themeName: ThemeKey,
): TextProps['style'] {
    // Semantic colors are theme-independent
    if (variant === 'primary') return { color: tokens.semantic.primary };
    if (variant === 'secondary') return { color: tokens.semantic.secondary };
    if (variant === 'success') return { color: tokens.semantic.success };
    if (variant === 'warning') return { color: tokens.semantic.warning };
    if (variant === 'error') return { color: tokens.semantic.error };

    // Primitive colors are theme-independent
    if (variant === 'cream') return { color: tokens.primitive.cream };
    if (variant === 'sepia') return { color: tokens.primitive.sepia };

    // Text colors depend on the active theme (octopath vs solar palette)
    if (variant === 'text') {
        return {
            color:
                themeName === 'octopath'
                    ? tokens.octopath.text
                    : tokens.solar.text,
        };
    }
    if (variant === 'muted') {
        return {
            color:
                themeName === 'octopath'
                    ? tokens.octopath.textMuted
                    : tokens.solar.textMuted,
        };
    }
    // inverse
    return {
        color:
            themeName === 'octopath'
                ? tokens.octopath.textInverse
                : tokens.solar.textInverse,
    };
}

// ─── Unistyles Stylesheet ────────────────────────────────────────────

const styles = StyleSheet.create({
    base: {
        fontFamily: 'PressStart2P',
        letterSpacing: 0.5,
    },
    shadow: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 0, // hard shadow — no blur for pixel art
    },
});
