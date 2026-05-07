/**
 * ThemeProvider — Unistyles Initialization Wrapper
 *
 * Initializes react-native-unistyles with octopath/solar themes,
 * reads persisted theme mode from MMKV, applies tenant branding
 * overrides from BrandingService, and syncs changes back to storage.
 *
 * Tamagui has been fully removed in Phase 4. This provider is now
 * the sole theme engine for the application.
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from 'react';
import { MMKV } from 'react-native-mmkv';
import { StyleSheet, UnistylesRuntime } from './unistyles';
import { stitchTheme } from './stitch';
import { BrandingService } from '../services/BrandingService';
import type { StitchTheme } from './unistyles';

// ─── Constants ────────────────────────────────────────────────────

const THEME_STORAGE_KEY = 'theme_mode';
export type ThemeMode = 'stitch';

// ─── MMKV (lazy, crash-safe) ──────────────────────────────────────

let _storage: MMKV | null = null;
function getStorage(): MMKV | null {
    if (_storage) return _storage;
    try {
        _storage = new MMKV();
        return _storage;
    } catch (e) {
        console.error('[ThemeProvider] MMKV init failed.', e);
        return null;
    }
}

function getPersistedTheme(): ThemeMode {
    const storage = getStorage();
    if (!storage) return 'stitch';
    return (storage.getString(THEME_STORAGE_KEY) as ThemeMode) || 'stitch';
}

function persistTheme(mode: ThemeMode): void {
    const storage = getStorage();
    if (storage) storage.set(THEME_STORAGE_KEY, mode);
}

// ─── Context ──────────────────────────────────────────────────────

interface ThemeContextValue {
    /** Current theme mode */
    themeMode: ThemeMode;
    /** Switch theme and persist */
    setThemeMode: (mode: ThemeMode) => void;
    
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── ThemeProvider Component ───────────────────────────────────────

interface ThemeProviderProps {
    /** Override initial theme (useful for tests / deep-links) */
    initialTheme?: ThemeMode;
}

/**
 * Initializes Unistyles and provides theme mode context.
 *
 * Must be rendered above any component using `useStyles()` or
 * `useThemeMode()`. This is now the sole theme provider for the app.
 */
export const ThemeProvider: React.FC<PropsWithChildren<ThemeProviderProps>> = ({
    children,
    initialTheme,
}) => {
    const [themeMode, setThemeModeState] = useState<ThemeMode>(
        () => initialTheme ?? getPersistedTheme(),
    );

    // ── Bootstrap Unistyles (once) ────────────────────────────────
    useEffect(() => {
        const persisted = getPersistedTheme();
        const initial = initialTheme ?? persisted;

        StyleSheet.configure({
            settings: {
                initialTheme: initial,
            },
            themes: {
                stitch: stitchTheme as StitchTheme,
            },
            breakpoints: {
                portrait: 0,
                landscape: 576,
            },
        });

        // Sync branding overrides if available
        const branding = BrandingService.colors();
        if (branding) {
            applyBrandingOverrides(branding);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Sync theme to UnistylesRuntime & MMKV ────────────────────
    const setThemeMode = (mode: ThemeMode) => {
        setThemeModeState(mode);
        UnistylesRuntime.setTheme(mode);
        persistTheme(mode);
    };

        // Keep UnistylesRuntime in sync on external changes
    useEffect(() => {
        UnistylesRuntime.setTheme(themeMode);
    }, [themeMode]);

    const contextValue = useMemo<ThemeContextValue>(
        () => ({
            themeMode,
            setThemeMode,
            }),
        [themeMode],
    );

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

// ─── Internal Hook ────────────────────────────────────────────────

/** Access the ThemeContext (internal, prefer useThemeMode for consumers) */
export function useThemeContext(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error(
            'useThemeContext must be used within <ThemeProvider>. ' +
            'Wrap your app with <ThemeProvider> from @/theme/ThemeProvider.',
        );
    }
    return ctx;
}

// ─── Branding Override Helpers ────────────────────────────────────

/**
 * Apply tenant branding colors as theme overrides.
 *
 * This mutates the theme objects in place so that `useStyles()`
 * consumers automatically receive branded colors. In the future
 * this should use Unistyles' nested theme / ScopedTheme API.
 */
function applyBrandingOverrides(branding: {
    primary: string;
    secondary: string;
}): void {
    const themes = [stitchTheme] as any[];
    for (const theme of themes) {
        theme.branding = {
            primary: branding.primary,
            secondary: branding.secondary,
        };
    }
}

/**
 * Re-apply branding after a fetch. Call this from BrandingService
 * or any component that triggers a tenant switch.
 */
export function refreshBranding(): void {
    const branding = BrandingService.colors();
    if (branding) {
        applyBrandingOverrides(branding);
    } else {
        const themes = [stitchTheme] as any[];
    for (const theme of themes) {
            delete theme.branding;
        }
    }
}
