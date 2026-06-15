/**
 * RetroInput — Unistyles-powered retro-styled text input component.
 *
 * Colors flow through the Grand Prix theme (`theme.colors.*`).
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
import { StyleSheet, useUnistyles } from '../theme/unistyles';
import type { GrandPrixTheme } from '../theme/unistyles';

// ─── Types ──────────────────────────────────────────────────────────

export interface RetroInputProps
    extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
    error?: string;
    label?: string;
    containerStyle?: ViewStyle;
    inputStyle?: TextStyle;
}

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

function resolveColors(colors: GrandPrixTheme['colors']): InputColors {
    return {
        bg: colors.surface,
        border: colors.outline,
        text: colors.onSurface,
        placeholder: colors.outlineVariant,
        errorBorder: colors.error,
        errorText: colors.error,
        focusBorder: colors.primary,
        disabledBg: colors.surfaceContainerHigh,
        disabledText: colors.outline,
        label: colors.outline,
    };
}

// ─── Component ──────────────────────────────────────────────────────

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
    const { theme } = useUnistyles();
    const c = resolveColors(theme.colors as GrandPrixTheme['colors']);
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

    const borderColor = error
        ? c.errorBorder
        : isFocused
            ? c.focusBorder
            : c.border;

    return (
        <View style={[styles.container, containerStyle]}>
            {label ? (
                <Text style={[styles.label, { color: c.label }]}>{label}</Text>
            ) : null}
            <TextInput
                {...rest}
                placeholder={placeholder}
                editable={editable}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholderTextColor={c.placeholder}
                style={[
                    styles.input,
                    {
                        backgroundColor: disabled ? c.disabledBg : c.bg,
                        borderColor,
                        color: disabled ? c.disabledText : c.text,
                    },
                    inputStyle,
                ]}
            />
            {error ? (
                <Text style={[styles.error, { color: c.errorText }]}>{error}</Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 6,
    },
    label: {
        fontFamily: 'PressStart2P',
        fontSize: 10,
        letterSpacing: 0.5,
    },
    input: {
        fontFamily: 'PressStart2P',
        fontSize: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 3,
        borderRadius: 0,
        letterSpacing: 0.5,
    },
    error: {
        fontFamily: 'PressStart2P',
        fontSize: 10,
        letterSpacing: 0.5,
    },
});
