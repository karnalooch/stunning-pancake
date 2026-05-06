/**
 * GameCard — Unistyles-powered retro game UI container component.
 *
 * Replaces the Tamagui-based arcade/GameCard with plain RN View +
 * StyleSheet.create(). All colors flow through @tokens theme tokens,
 * reactively switching between octopath (dark) and solar (light) palettes.
 *
 * Variants:
 * - dark: deep sea blue with gold border
 * - metal: industrial gray/metal
 * - parchment: warm paper/wood tones (Octopath style)
 * - hologram: sci-fi cyan overlay
 *
 * Preserves: chunky pixel borders, hard drop shadows, and the
 * inner highlight line for simulated 3D inset from the original.
 */

import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles, UnistylesRuntime } from '../theme/unistyles';
import { colors as tokens } from '@tokens/generated/restyle-colors';

// ─── Types ──────────────────────────────────────────────────────────

export type GameCardVariant = 'dark' | 'metal' | 'parchment' | 'hologram';

export interface GameCardProps extends Omit<ViewProps, 'style'> {
    /** Visual theme variant (default: 'dark') */
    variant?: GameCardVariant;
    /** Border thickness in pixels (default: 3) */
    borderWidth?: number;
    /** Inner padding in pixels (default: 16) */
    padding?: number;
    /** Optional style overrides */
    style?: ViewStyle;
    children: React.ReactNode;
}

// ─── Theme Key ──────────────────────────────────────────────────────

type ThemeKey = 'octopath' | 'solar' | 'stitch';

// ─── Color Resolver ─────────────────────────────────────────────────

interface CardColors {
    bg: string;
    border: string;
    innerHighlight: string;
}

function resolveColors(
    variant: GameCardVariant,
    themeName: ThemeKey,
): CardColors {
    const t = themeName === 'octopath' ? tokens.octopath : tokens.solar;

    switch (variant) {
        case 'dark':
            return {
                bg: t.cardDarkBg,
                border: t.border,
                innerHighlight: 'rgba(255,255,255,0.1)',
            };
        case 'metal':
            return {
                bg: t.cardMetalBg,
                border: tokens.primitive.silver,
                innerHighlight: 'rgba(255,255,255,0.2)',
            };
        case 'parchment':
            return {
                bg: t.cardParchmentBg,
                border: tokens.primitive.woodBorder,
                innerHighlight: 'rgba(255,255,255,0.3)',
            };
        case 'hologram':
            return {
                bg:
                    themeName === 'octopath'
                        ? 'rgba(0, 209, 255, 0.15)'
                        : 'rgba(0, 209, 255, 0.1)',
                border: t.cardHologramBorder,
                innerHighlight: 'rgba(0, 209, 255, 0.4)',
            };
    }
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * GameCard — The core container component replacing RetroCard.
 * Simulates 9-slice game UI panels using thick borders and
 * theme-specific background colors.
 */
export const GameCard: React.FC<GameCardProps> = ({
    variant = 'dark',
    borderWidth = 3,
    padding = 16,
    style,
    children,
    ...rest
}) => {
    useUnistyles(); // subscribe to theme changes
    const themeName = (UnistylesRuntime.themeName as ThemeKey) ?? 'octopath';

    const { bg, border, innerHighlight } = resolveColors(variant, themeName);

    const containerStyle: ViewStyle = {
        backgroundColor: bg,
        borderWidth,
        borderColor: border,
        borderRadius: 0, // always 0 for pixel art
        padding,
        // Hard shadow — no blur, pixel-art style
        shadowColor: tokens.primitive.pixelBlack,
        shadowOffset: { width: 6, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 8,
        ...style,
    };

    return (
        <View style={containerStyle} {...rest}>
            {/* Inner highlight line — simulates 3D inset/bevel */}
            <View
                style={[
                    innerHighlightStyles.base,
                    { borderColor: innerHighlight },
                ]}
                pointerEvents="none"
            />
            {children}
        </View>
    );
};

// ─── Unistyles Stylesheet ────────────────────────────────────────────

const innerHighlightStyles = StyleSheet.create({
    base: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderWidth: 1,
        // borderColor is set dynamically via the style prop above
    },
});
