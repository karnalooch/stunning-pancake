/**
 * Row — Horizontal stack layout primitive (replaces Tamagui XStack).
 *
 * Uses plain RN View + Unistyles StyleSheet.create(). Padding, gap,
 * and alignment props map through standard RN styles — no Tamagui
 * dependency.
 */

import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from '../theme/unistyles';

// ─── Types ──────────────────────────────────────────────────────────

export interface RowProps extends Omit<ViewProps, 'style'> {
    /** Gap between children in logical pixels (default: 0) */
    gap?: number;
    /** Uniform padding in logical pixels (default: 0) */
    padding?: number;
    /** Horizontal padding override */
    paddingHorizontal?: number;
    /** Vertical padding override */
    paddingVertical?: number;
    /** Cross-axis alignment (vertical, default: 'center') */
    alignItems?: ViewStyle['alignItems'];
    /** Main-axis alignment (horizontal, default: 'flex-start') */
    justifyContent?: ViewStyle['justifyContent'];
    /** Should children wrap to next line? (default: false) */
    wrap?: boolean;
    /** Flex grow/shrink/basis shorthand */
    flex?: number;
    /** Optional style overrides */
    style?: ViewStyle;
    children?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * Row — A horizontal flex container.
 *
 * Replaces Tamagui's `XStack`. Children are spaced using the `gap` prop
 * (wraps each child in a View with marginRight for cross-platform
 * gap simulation on older RN versions).
 */
export const Row: React.FC<RowProps> = ({
    gap = 0,
    padding = 0,
    paddingHorizontal,
    paddingVertical,
    alignItems = 'center',
    justifyContent = 'flex-start',
    wrap = false,
    flex,
    style,
    children,
    ...rest
}) => {
    useUnistyles(); // subscribe to theme

    const containerStyle: ViewStyle = {
        flexDirection: 'row',
        flexWrap: wrap ? 'wrap' : 'nowrap',
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

    // With gap: wrap each child to apply marginRight
    const childArray = React.Children.toArray(children);
    return (
        <View style={containerStyle} {...rest}>
            {childArray.map((child, index) => (
                <View
                    key={index}
                    style={index < childArray.length - 1 ? { marginRight: gap } : undefined}
                >
                    {child}
                </View>
            ))}
        </View>
    );
};
