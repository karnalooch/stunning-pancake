/**
 * ThemeProvider — Unistyles Initialization Wrapper
 *
 * Initializes react-native-unistyles with Grand Prix themes,
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
import { grandPrixTheme } from './grandPrix';
import { grandPrixNightTheme } from './grandPrixNight';
import { BrandingService } from '../services/BrandingService';
import { warnMmkvUnavailable } from '../services/mmkvSupport';
import type { GrandPrixTheme } from './unistyles';

// ─── Constants ────────────────────────────────────────────────────

const THEME_STORAGE_KEY = 'theme_mode';
export type ThemeMode = 'grandPrix' | 'grandPrixNight';

// ─── MMKV (lazy, crash-safe) ──────────────────────────────────────

let _storage: MMKV | null = null;
function getStorage(): MMKV | null {
    if (_storage) return _storage;
    try {
        _storage = new MMKV();
        return _storage;
    } catch (e) {
        warnMmkvUnavailable('ThemeProvider', e);
        return null;
    }
}

function getPersistedTheme(): ThemeMode {
    const storage = getStorage();
    if (!storage) return 'grandPrix';
    const raw = storage.getString(THEME_STORAGE_KEY) ?? 'grandPrix';
    if (raw === 'grandPrix' || raw === 'grandPrixNight') return raw;
    return 'grandPrix';
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

    // ── Bootstrap Unistyles (configure called in index.ts at module level) ──
    useEffect(() => {
        // Sync branding overrides if available
        const branding = BrandingService.getCurrent();
        if (branding) {
            applyBrandingOverrides({
                primary: branding.primary_color,
                secondary: branding.secondary_color,
            });
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
    const themes = [grandPrixTheme, grandPrixNightTheme] as any[];
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
    const branding = BrandingService.getCurrent();
    if (branding) {
        applyBrandingOverrides({
            primary: branding.primary_color,
            secondary: branding.secondary_color,
        });
    } else {
        const themes = [grandPrixTheme, grandPrixNightTheme] as any[];
        for (const theme of themes) {
            delete theme.branding;
        }
    }
}
