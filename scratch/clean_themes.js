const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../mobile/src');

function cleanFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    for (let [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Cleaned:', filePath);
}

// 1. ThemeProvider.tsx
cleanFile(path.join(srcDir, 'theme/ThemeProvider.tsx'), [
    [/import \{ octopathTheme \} from '\.\/octopath';\r?\n/g, ''],
    [/import \{ solarTheme \} from '\.\/solar';\r?\n/g, ''],
    [/export type ThemeMode = 'octopath' \| 'solar' \| 'stitch';/g, "export type ThemeMode = 'stitch';"],
    [/octopath: octopathTheme as AppTheme,\r?\n\s+solar: solarTheme as AppTheme,\r?\n\s+/g, ''],
    [/\/\*\* Toggle between octopath ↔ solar \*\/\r?\n\s+toggleThemeMode: \(\) => void;\r?\n\s+\/\*\* True when dark theme \(octopath\) is active \*\/\r?\n\s+isOctopath: boolean;\r?\n\s+\/\*\* True when light theme \(solar\) is active \*\/\r?\n\s+isSolar: boolean;/g, ''],
    [/isOctopath: themeMode === 'octopath',\r?\n\s+isSolar: themeMode === 'solar',/g, ''],
    [/toggleThemeMode,\r?\n\s+/g, ''],
    [/const toggleThemeMode = \(\) => \{\r?\n\s+setThemeMode\(themeMode === 'octopath' \? 'solar' : 'octopath'\);\r?\n\s+\};\r?\n\r?\n/g, ''],
    [/const themes = \[octopathTheme, solarTheme\] as AppTheme\[\];\r?\n\s+for \(const theme of themes\) \{/g, 'const themes = [stitchTheme] as any[];\n    for (const theme of themes) {'],
    [/import type \{ AppTheme, StitchTheme \} from '\.\/unistyles';/g, "import type { StitchTheme } from './unistyles';"],
    [/\(themeMode === 'octopath' \? 'solar' : 'octopath'\)/g, "'stitch'"]
]);

// 2. unistyles.ts
cleanFile(path.join(srcDir, 'theme/unistyles.ts'), [
    [/import \{ octopathTheme \} from '\.\/octopath';\r?\n/g, ''],
    [/import \{ solarTheme \} from '\.\/solar';\r?\n/g, ''],
    [/octopath: typeof octopathTheme;\r?\n\s+solar: typeof solarTheme;\r?\n\s+/g, ''],
    [/export type AppTheme = typeof octopathTheme;\r?\n/g, 'export type AppTheme = typeof stitchTheme;\n']
]);

// 3. ThemeService.ts
cleanFile(path.join(srcDir, 'services/ThemeService.ts'), [
    [/type ThemeMode = 'octopath' \| 'solar';/g, "type ThemeMode = 'stitch';"],
    [/export const ThemeService = \{\r?\n\s+themeMode: observable<ThemeMode>\(initial\),\r?\n\r?\n\s+toggle\(\) \{\r?\n\s+const current = this\.themeMode\.get\(\);\r?\n\s+const next = current === 'octopath' \? 'solar' : 'octopath';\r?\n\s+this\.themeMode\.set\(next\);\r?\n\s+storage\.set\('theme_mode', next\);\r?\n\s+\},\r?\n\r?\n\s+isOctopath\(\) \{\r?\n\s+return this\.themeMode\.get\(\) === 'octopath';\r?\n\s+\},\r?\n\r?\n\s+isSolar\(\) \{\r?\n\s+return this\.themeMode\.get\(\) === 'solar';\r?\n\s+\}\r?\n\};/g, "export const ThemeService = {\n    themeMode: observable<ThemeMode>(initial),\n    toggle() {}\n};"],
    [/const initial = \(storage\.getString\('theme_mode'\) as ThemeMode\) \|\| 'octopath';/g, "const initial = (storage.getString('theme_mode') as ThemeMode) || 'stitch';"]
]);

// 4. useThemeMode.ts
cleanFile(path.join(srcDir, 'theme/useThemeMode.ts'), [
    [/\(mode === 'octopath' \? 'solar' : 'octopath'\)/g, "'stitch'"],
    [/mode === 'octopath'/g, "false"],
    [/mode === 'solar'/g, "false"],
    [/export function useThemeMode\(\) \{\r?\n\s+const \{ themeMode, setThemeMode \} = useThemeContext\(\);\r?\n\r?\n\s+return \{\r?\n\s+mode: themeMode,\r?\n\s+setMode: setThemeMode,\r?\n\s+toggle: \(\) => setThemeMode\(themeMode === 'octopath' \? 'solar' : 'octopath'\),\r?\n\s+isOctopath: themeMode === 'octopath',\r?\n\s+isSolar: themeMode === 'solar',\r?\n\s+\};\r?\n\}/g, "export function useThemeMode() {\n    const { themeMode, setThemeMode } = useThemeContext();\n    return {\n        mode: themeMode,\n        setMode: setThemeMode,\n        toggle: () => {},\n        isOctopath: false,\n        isSolar: false,\n    };\n}"]
]);
