/**
 * Column — Vertical stack layout primitive (replaces Tamagui YStack).
 *
 * Uses plain RN View + Unistyles StyleSheet.create(). Padding, gap,
 * and alignment props map through standard RN styles — no Tamagui
 * dependency.
 */

import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from '../theme/unistyles';

// ─── Types ──────────────────────────────────────────────────────────

export interface ColumnProps extends Omit<ViewProps, 'style'> {
    /** Gap between children in logical pixels (default: 0) */
    gap?: number;
    /** Uniform padding in logical pixels (default: 0) */
    padding?: number;
    /** Horizontal padding override */
    paddingHorizontal?: number;
    /** Vertical padding override */
    paddingVertical?: number;
    /** Cross-axis alignment (default: 'stretch') */
    alignItems?: ViewStyle['alignItems'];
    /** Main-axis alignment (default: 'flex-start') */
    justifyContent?: ViewStyle['justifyContent'];
    /** Flex grow/shrink/basis shorthand */
    flex?: number;
    /** Optional style overrides */
    style?: ViewStyle;
    children?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * Column — A vertical flex container.
 *
 * Replaces Tamagui's `YStack`. Children are spaced using the `gap` prop
 * (wraps each child in a View with marginBottom for cross-platform
 * gap simulation on older RN versions).
 */
export const Column: React.FC<ColumnProps> = ({
    gap = 0,
    padding = 0,
    paddingHorizontal,
    paddingVertical,
    alignItems = 'stretch',
    justifyContent = 'flex-start',
    flex,
    style,
    children,
    ...rest
}) => {
    useUnistyles(); // subscribe to theme (ensures theme-aware children re-render)

    const containerStyle: ViewStyle = {
        flexDirection: 'column',
        padding,
        paddingHorizontal,
        paddingVertical,
        alignItems,
        justifyContent,
        flex,
        ...style,
    };

    // If no gap, render children directly
    if (gap === 0 || !children) {
        return (
            <View style={containerStyle} {...rest}>
                {children}
            </View>
        );
    }

    // With gap: wrap each child to apply marginBottom
    const childArray = React.Children.toArray(children);
    return (
        <View style={containerStyle} {...rest}>
            {childArray.map((child, index) => (
                <View
                    key={index}
                    style={index < childArray.length - 1 ? { marginBottom: gap } : undefined}
                >
                    {child}
                </View>
            ))}
        </View>
    );
};
