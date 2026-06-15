/**
 * ArcadeButton — Unistyles-powered retro arcade button component.
 *
 * Colors flow through the Grand Prix theme (`theme.colors.*`).
 *
 * Variants:
 * - 5 colors: primary (gold), secondary (blue), danger (red), success (green), ghost
 * - 3 sizes: sm, md, lg
 * - disabled state with muted gray styling
 */

import React, { useState, useCallback } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from '../theme/unistyles';
import * as Haptics from 'expo-haptics';
import type { GrandPrixTheme } from '../theme/unistyles';
import { FONTS } from '../theme/fonts';

// ─── Types ──────────────────────────────────────────────────────────

export type ArcadeButtonVariant =
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'success'
    | 'cta'
    | 'ghost';

export type ArcadeButtonSize = 'sm' | 'md' | 'lg';

export interface ArcadeButtonProps {
    label: string;
    onPress: () => void;
    variant?: ArcadeButtonVariant;
    size?: ArcadeButtonSize;
    fullWidth?: boolean;
    disabled?: boolean;
    accessibilityLabel?: string;
    testID?: string;
}

// ─── Size Presets ───────────────────────────────────────────────────

interface SizeConfig {
    height: number;
    px: number;
    fontSize: number;
    shadow: number;
}

const SIZE_CONFIGS: Record<ArcadeButtonSize, SizeConfig> = {
    sm: { height: 36, px: 12, fontSize: 10, shadow: 3 },
    md: { height: 50, px: 20, fontSize: 14, shadow: 5 },
    lg: { height: 64, px: 24, fontSize: 18, shadow: 6 },
};

// ─── Color Resolver ─────────────────────────────────────────────────

interface ColorSet {
    main: string;
    dark: string;
    text: string;
}

function resolveColors(
    variant: ArcadeButtonVariant,
    colors: GrandPrixTheme['colors'],
): ColorSet {
    switch (variant) {
        case 'primary':
            return {
                main: colors.goldAmber,
                dark: colors.hudOutline,
                text: colors.onBackground,
            };
        case 'secondary':
            return {
                main: colors.primary,
                dark: colors.gpDeepSea,
                text: colors.onPrimary,
            };
        case 'danger':
            return {
                main: colors.error,
                dark: colors.gpDeepSea,
                text: colors.onError,
            };
        case 'success':
            return {
                main: colors.gpForestGreen,
                dark: colors.gpDeepSea,
                text: colors.onPrimary,
            };
        case 'cta':
            return {
                main: colors.cta,
                dark: colors.ctaDark,
                text: colors.onCta,
            };
        case 'ghost':
            return {
                main: 'transparent',
                dark: 'transparent',
                text: colors.onBackground,
            };
    }
}

function resolveDisabledColors(colors: GrandPrixTheme['colors']): ColorSet {
    return {
        main: colors.disabledSurface,
        dark: colors.disabledDark,
        text: colors.onDisabled,
    };
}

// ─── Component ──────────────────────────────────────────────────────

export const ArcadeButton: React.FC<ArcadeButtonProps> = ({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    fullWidth = true,
    disabled = false,
    accessibilityLabel,
    testID,
}) => {
    const [isPressed, setIsPressed] = useState(false);
    const { theme } = useUnistyles();
    const themeColors = theme.colors as GrandPrixTheme['colors'];

    const c = disabled ? resolveDisabledColors(themeColors) : resolveColors(variant, themeColors);
    const s = SIZE_CONFIGS[size];
    const isGhost = variant === 'ghost';

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

    const pressOffset = isPressed && !disabled ? s.shadow : 0;

    const faceStyle: ViewStyle = {
        backgroundColor: c.main,
        height: s.height - s.shadow,
        paddingHorizontal: s.px,
        borderWidth: isGhost ? 2 : 3,
        borderColor: isGhost ? c.text : c.dark,
        transform: [{ translateY: pressOffset }],
    };

    return (
        <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled }}
            style={[styles.wrapper, fullWidth && styles.fullWidth]}
        >
            {!isGhost && (
                <View
                    style={[
                        styles.shadowBlock,
                        {
                            height: s.height,
                            backgroundColor: c.dark,
                        },
                    ]}
                />
            )}
            <View style={[styles.face, faceStyle]}>
                <Text
                    style={[
                        styles.label,
                        {
                            fontSize: s.fontSize,
                            color: c.text,
                        },
                    ]}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
        alignSelf: 'flex-start',
    },
    fullWidth: {
        alignSelf: 'stretch',
        width: '100%',
    },
    shadowBlock: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderRadius: 0,
    },
    face: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 0,
    },
    label: {
        fontFamily: FONTS.display,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
});
