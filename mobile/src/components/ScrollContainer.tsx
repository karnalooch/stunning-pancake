/**
 * ScrollContainer — Scrollable layout primitive (replaces Tamagui ScrollView).
 *
 * Uses plain RN ScrollView + Unistyles. Padding, gap, and alignment
 * props are forwarded to the inner content View so that scrolling
 * behaves correctly (padding on ScrollView itself can clip on Android).
 */

import React from 'react';
import {
    ScrollView,
    View,
    type ScrollViewProps,
    type ViewStyle,
} from 'react-native';
import { StyleSheet, useUnistyles } from '../theme/unistyles';

// ─── Types ──────────────────────────────────────────────────────────

export interface ScrollContainerProps
    extends Omit<ScrollViewProps, 'style' | 'contentContainerStyle'> {
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
    /** Optional style applied to the outer ScrollView */
    style?: ViewStyle;
    /** Optional style applied to the inner content container */
    contentContainerStyle?: ViewStyle;
    children?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * ScrollContainer — A vertically-scrolling container.
 *
 * Replaces Tamagui's `ScrollView`. Padding is applied to the inner
 * content wrapper to avoid Android clipping issues. Children are
 * spaced using the `gap` prop.
 */
export const ScrollContainer: React.FC<ScrollContainerProps> = ({
    gap = 0,
    padding = 0,
    paddingHorizontal,
    paddingVertical,
    alignItems = 'stretch',
    justifyContent = 'flex-start',
    style,
    contentContainerStyle,
    children,
    ...rest
}) => {
    useUnistyles(); // subscribe to theme

    const innerStyle: ViewStyle = {
        flexDirection: 'column',
        padding,
        paddingHorizontal,
        paddingVertical,
        alignItems,
        justifyContent,
        // Let content dictate height inside scroll
        flexGrow: 1,
        ...contentContainerStyle,
    };

    // If no gap, render children directly inside the inner View
    if (gap === 0 || !children) {
        return (
            <ScrollView style={style} {...rest}>
                <View style={innerStyle}>{children}</View>
            </ScrollView>
        );
    }

    // With gap: wrap each child to apply marginBottom
    const childArray = React.Children.toArray(children);
    return (
        <ScrollView style={style} {...rest}>
            <View style={innerStyle}>
                {childArray.map((child, index) => (
                    <View
                        key={index}
                        style={
                            index < childArray.length - 1
                                ? { marginBottom: gap }
                                : undefined
                        }
                    >
                        {child}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};
