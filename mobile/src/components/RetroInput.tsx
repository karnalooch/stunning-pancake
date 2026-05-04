/**
 * RetroInput — Unistyles-powered retro-styled text input component.
 *
 * Replaces Tamagui `Input` with plain RN TextInput + Unistyles.
 * Supports: placeholder, error, focused, and disabled states with
 * retro pixel-art styling consistent with the design system.
 *
 * All colors flow through @tokens theme tokens and reactively
 * switch between octopath (dark) and solar (light) palettes.
 */

import React, { useState, useCallback } from 'react';
import {
    TextInput,
    View,
    Text,
    type TextInputProps,
    type ViewStyle,
    type TextStyle,
} from 'react-native';
import { StyleSheet, useUnistyles, UnistylesRuntime } from '../theme/unistyles';
import { colors as tokens } from '@tokens/generated/restyle-colors';

// ─── Types ──────────────────────────────────────────────────────────

export interface RetroInputProps
    extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
    /** Error message to display below the input (triggers error styling) */
    error?: string;
    /** Optional label rendered above the input */
    label?: string;
    /** Override container style */
    containerStyle?: ViewStyle;
    /** Override input style */
    inputStyle?: TextStyle;
}

// ─── Theme Key ──────────────────────────────────────────────────────

type ThemeKey = 'octopath' | 'solar';

// ─── Color Resolver ─────────────────────────────────────────────────

interface InputColors {
    bg: string;
    border: string;
    text: string;
    placeholder: string;
    errorBorder: string;
    errorText: string;
    focusBorder: string;
    disabledBg: string;
    disabledText: string;
    label: string;
}

function resolveColors(themeName: ThemeKey): InputColors {
    const t = themeName === 'octopath' ? tokens.octopath : tokens.solar;

    return {
        bg: t.surface,
        border: t.border,
        text: t.text,
        placeholder: t.textMuted,
        errorBorder: tokens.semantic.error,
        errorText: tokens.semantic.error,
        focusBorder: tokens.semantic.primary,
        disabledBg: themeName === 'octopath' ? '#1A1A2E' : '#E8E0CC',
        disabledText: themeName === 'octopath' ? '#6B7280' : '#A0A0A0',
        label: t.textMuted,
    };
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * RetroInput — A retro pixel-art themed text input.
 *
 * Features:
 * - Chunked pixel borders (3px) with error/disabled/focused variants
 * - Label rendered in pixel font above the field
 * - Error message below with warning color
 * - Theme-aware colors that switch with octopath/solar
 */
export const RetroInput: React.FC<RetroInputProps> = ({
    error,
    label,
    containerStyle,
    inputStyle,
    editable = true,
    placeholder,
    ...rest
}) => {
    const [isFocused, setIsFocused] = useState(false);

    useUnistyles(); // subscribe to theme changes
    const themeName = (UnistylesRuntime.themeName as ThemeKey) ?? 'octopath';
    const c = resolveColors(themeName);
    const disabled = !editable;

    const handleFocus = useCallback(
        (e: any) => {
            setIsFocused(true);
            rest.onFocus?.(e);
        },
        [rest.onFocus],
    );

    const handleBlur = useCallback(
        (e: any) => {
            setIsFocused(false);
            rest.onBlur?.(e);
        },
        [rest.onBlur],
    );

    // Resolve border color based on state priority: error > focused > default
    const borderColor = error
        ? c.errorBorder
        : isFocused
            ? c.focusBorder
            : c.border;

    const inputContainerStyle: ViewStyle = {
        backgroundColor: disabled ? c.disabledBg : c.bg,
        borderWidth: 3,
        borderColor,
        borderRadius: 0, // pixel-art: no radius
        paddingHorizontal: 12,
        paddingVertical: 10,
        ...containerStyle,
    };

    return (
        <View style={styles.wrapper}>
            {/* Optional label */}
            {label ? (
                <Text style={[labelStyles.text, { color: c.label }]}>{label}</Text>
            ) : null}

            <View style={inputContainerStyle}>
                <TextInput
                    {...rest}
                    editable={editable}
                    placeholder={placeholder}
                    placeholderTextColor={c.placeholder}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    style={[
                        inputStyles.text,
                        {
                            color: disabled ? c.disabledText : c.text,
                        },
                        inputStyle,
                    ]}
                />
            </View>

            {/* Error message */}
            {error ? (
                <Text style={[errorStyles.text, { color: c.errorText }]}>
                    {error}
                </Text>
            ) : null}
        </View>
    );
};

// ─── Unistyles Stylesheets ──────────────────────────────────────────

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
    },
});

const labelStyles = StyleSheet.create({
    text: {
        fontFamily: 'PressStart2P',
        fontSize: 10,
        letterSpacing: 0.5,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
});

const inputStyles = StyleSheet.create({
    text: {
        fontFamily: 'PressStart2P',
        fontSize: 12,
        letterSpacing: 0.5,
        padding: 0, // reset RN defaults for pixel-precise padding
    },
});

const errorStyles = StyleSheet.create({
    text: {
        fontFamily: 'PressStart2P',
        fontSize: 8,
        letterSpacing: 0.5,
        marginTop: 4,
    },
});
