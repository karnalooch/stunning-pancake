/**
 * ArcadeButton — Unistyles-powered retro arcade button component.
 *
 * Replaces the Tamagui-based arcade/ArcadeButton with plain RN Pressable +
 * StyleSheet.create(). All colors flow through @tokens theme tokens,
 * reactively switching between octopath (dark) and solar (light) palettes.
 *
 * Variants:
 * - 5 colors: primary (gold), secondary (blue), danger (red), success (green), ghost
 * - 3 sizes: sm, md, lg
 * - disabled state with muted gray styling
 *
 * Preserves the signature 3D arcade shadow effect, haptic feedback (expo-haptics),
 * and accessibility labels from the original component.
 */

import React, { useState, useCallback } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles, UnistylesRuntime } from '../theme/unistyles';
import { colors as tokens } from '@tokens/generated/restyle-colors';
import * as Haptics from 'expo-haptics';

// ─── Types ──────────────────────────────────────────────────────────

export type ArcadeButtonVariant =
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'success'
    | 'ghost';

export type ArcadeButtonSize = 'sm' | 'md' | 'lg';

export interface ArcadeButtonProps {
    /** Button label text */
    label: string;
    /** Press handler */
    onPress: () => void;
    /** Color variant (default: 'primary') */
    variant?: ArcadeButtonVariant;
    /** Size preset (default: 'md') */
    size?: ArcadeButtonSize;
    /** When true, button stretches to full container width (default: true) */
    fullWidth?: boolean;
    /** Disabled state (default: false) */
    disabled?: boolean;
    /** Accessibility label override (defaults to `label`) */
    accessibilityLabel?: string;
}

// ─── Size Presets ───────────────────────────────────────────────────

interface SizeConfig {
    height: number;
    px: number;
    fontSize: number;
    shadow: number; // thickness of 3D shadow block below the button
}

const SIZE_CONFIGS: Record<ArcadeButtonSize, SizeConfig> = {
    sm: { height: 36, px: 12, fontSize: 10, shadow: 3 },
    md: { height: 50, px: 20, fontSize: 14, shadow: 5 },
    lg: { height: 64, px: 24, fontSize: 18, shadow: 6 },
};

// ─── Color Resolver ─────────────────────────────────────────────────

interface ColorSet {
    main: string;
    dark: string; // shadow / 3D block color
    text: string; // label text color
}

type ThemeKey = 'octopath' | 'solar' | 'stitch';

function resolveColors(
    variant: ArcadeButtonVariant,
    themeName: ThemeKey,
): ColorSet {
    const t = themeName === 'octopath' ? tokens.octopath : tokens.solar;

    switch (variant) {
        case 'primary':
            return {
                main: t.buttonGoldBg,
                dark: tokens.primitive.woodBorder,
                text: t.buttonGoldText,
            };
        case 'secondary':
            return {
                main: t.buttonBlueBg,
                dark: tokens.primitive.deepSea,
                text: t.buttonBlueText,
            };
        case 'danger':
            return {
                main: t.buttonRedBg,
                dark: tokens.primitive.pixelBlack,
                text: t.buttonRedText,
            };
        case 'success':
            return {
                main: t.buttonGreenBg,
                dark: tokens.primitive.deepBrown,
                text: t.buttonGreenText,
            };
        case 'ghost':
            return {
                main: 'transparent',
                dark: 'transparent',
                text: t.buttonGhostText,
            };
    }
}

/** Disabled state overrides — muted gray regardless of variant */
const DISABLED_COLORS: ColorSet = {
    main: '#6B7280',
    dark: '#374151',
    text: '#9CA3AF',
};

// ─── Component ──────────────────────────────────────────────────────

/**
 * ArcadeButton — True arcade machine feel: presses "down" visually,
 * triggers haptics, features chunky pixel borders, and a 3D drop-shadow block.
 */
export const ArcadeButton: React.FC<ArcadeButtonProps> = ({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    fullWidth = true,
    disabled = false,
    accessibilityLabel,
}) => {
    const [isPressed, setIsPressed] = useState(false);

    // Subscribe to theme changes for reactivity
    useUnistyles();
    const themeName = (UnistylesRuntime.themeName as ThemeKey) ?? 'octopath';

    const c = disabled ? DISABLED_COLORS : resolveColors(variant, themeName);
    const s = SIZE_CONFIGS[size];
    const isGhost = variant === 'ghost';

    // ── Haptic handlers ────────────────────────────────────────────
    const handlePressIn = useCallback(() => {
        if (disabled) return;
        setIsPressed(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    }, [disabled]);

    const handlePressOut = useCallback(() => {
        if (disabled) return;
        setIsPressed(false);
    }, [disabled]);

    const handlePress = useCallback(() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        onPress();
    }, [disabled, onPress]);

    // ── Dynamic styles (recomputed each render for press animation) ──
    const containerStyle: ViewStyle = {
        width: fullWidth ? '100%' : 'auto',
        opacity: disabled ? 0.6 : 1,
    };

    const buttonStyle: ViewStyle = {
        height: s.height,
        backgroundColor: c.main,
        paddingHorizontal: s.px,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: isGhost ? 2 : 3,
        borderColor: isGhost ? c.text : tokens.primitive.pixelBlack,
        // "Press down": translate Y by shadow thickness when pressed
        transform: [{ translateY: isPressed ? s.shadow : 0 }],
    };

    const shadowBlockStyle: ViewStyle = {
        position: 'absolute',
        bottom: -s.shadow - 3,
        left: -3,
        right: -3,
        height: s.shadow,
        backgroundColor: c.dark,
        borderLeftWidth: 3,
        borderRightWidth: 3,
        borderBottomWidth: 3,
        borderColor: tokens.primitive.pixelBlack,
        zIndex: -1,
    };

    const highlightStyle: ViewStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    };

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled }}
            style={containerStyle}
        >
            <View style={buttonStyle}>
                {/* 3D drop-shadow block (hidden when pressed or ghost variant) */}
                {!isGhost && !isPressed && <View style={shadowBlockStyle} />}

                {/* Inner highlight line — simulates a bevel/inset */}
                {!isGhost && <View style={highlightStyle} />}

                {/* Label rendered with pixel font + optional hard shadow */}
                <Text
                    style={[
                        labelStyles.text,
                        {
                            color: c.text,
                            fontSize: s.fontSize,
                            textShadowColor: !isGhost && !disabled ? 'rgba(0,0,0,0.8)' : 'transparent',
                            textShadowOffset:
                                !isGhost && !disabled
                                    ? { width: 2, height: 2 }
                                    : { width: 0, height: 0 },
                            textShadowRadius: 0,
                        },
                    ]}
                >
                    {label}
                </Text>
            </View>
        </Pressable>
    );
};

// ─── Unistyles Stylesheet (shared static styles) ────────────────────

const labelStyles = StyleSheet.create({
    text: {
        fontFamily: 'PressStart2P',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
});
