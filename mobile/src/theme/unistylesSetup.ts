/**
 * unistylesSetup.ts — Unistyles Bootstrap (Side-effect only module)
 *
 * THIS FILE MUST BE THE VERY FIRST IMPORT in index.ts (or any entry point).
 *
 * Problem: ES module `import` statements are ALL hoisted before any code runs.
 * This means if `StyleSheet.configure()` lives in index.ts alongside other
 * imports, the other modules (App → RetroInput, PixelText, etc.) get resolved
 * first and their module-level `StyleSheet.create()` calls fire BEFORE configure().
 *
 * Solution: Isolate `configure()` in its own file. When index.ts does:
 *   import './src/theme/unistylesSetup';   ← first import
 *   import App from './App';               ← second import
 *
 * Metro guarantees that unistylesSetup is fully executed (including configure)
 * before App's dependency graph is resolved.
 */

import { StyleSheet } from 'react-native-unistyles';
import { stitchTheme } from './stitch';

StyleSheet.configure({
    settings: { initialTheme: 'stitch' },
    themes: { stitch: stitchTheme } as any,
});
