/**
 * Maplibre-GL / Static Constructor Imports Audit
 *
 * Detects files that use static ESM imports of maplibre-gl combined with
 * constructor calls (new maplibregl.Map etc.) which are known to break in
 * Vite production builds (CJS/ESM interop issues).
 *
 * Proven safe pattern: dynamic import('maplibre-gl').then(ml => new ml.default.Map(...))
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TARGET_DIR = resolve(ROOT, 'admin', 'src');

interface Finding {
    file: string;
    line: number;
    finding: string;
    suggestion: string;
}

const findings: Finding[] = [];

function auditFile(filePath: string) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = relative(ROOT, filePath);

    const hasStaticImport = content.includes("import") && 
        (content.includes("from 'maplibre-gl'") || content.includes('from "maplibre-gl"'));
    const hasDynamicImport = content.includes("import('maplibre-gl')");
    const hasInteropFallback = content.includes('.default') || content.includes('_maplibregl');

    if (!hasStaticImport) return;

    // Check for constructor calls using the statically imported module
    const hasConstructor = /new\s+maplibregl\.(Map|Marker|Popup|NavigationControl|AttributionControl|GeolocateControl|FullscreenControl|ScaleControl)\b/.test(content);

    if (hasConstructor && !hasInteropFallback) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/new\s+maplibregl\.(Map|Marker|Popup|NavigationControl|AttributionControl|GeolocateControl|FullscreenControl|ScaleControl)\b/.test(line)) {
                findings.push({
                    file: relPath,
                    line: i + 1,
                    finding: 'Static ESM import of maplibre-gl with constructor call — will break in Vite production builds',
                    suggestion: `Replace 'import * as maplibregl from "maplibre-gl"' with dynamic import: import("maplibre-gl").then(ml => { const m = ml.default || ml; new m.Map(...) }). See LiveMap.tsx for the proven pattern.`
                });
                break; // one finding per file is enough
            }
        }
    }

    // Warn about static import even without constructors (potential future risk)
    if (!hasConstructor && !hasDynamicImport) {
        // Only warn for files used in routes (modules/ directory)
        if (filePath.includes('/modules/')) {
            findings.push({
                file: relPath,
                line: 1,
                finding: 'Static maplibre-gl import in route module — risk of Vite production constructor error',
                suggestion: 'If this component is loaded from multiple paths (eager + lazy), consider dynamic import for maplibre-gl.'
            });
        }
    }
}

function walk(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
            const skip = ['node_modules', 'dist', '.git', '__pycache__', 'venv'];
            if (!skip.includes(entry.name) && !entry.name.startsWith('.')) walk(full);
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
            auditFile(full);
        }
    }
}

console.log('🔍 Running Maplibre-GL Static Import Audit...');
walk(TARGET_DIR);

if (findings.length > 0) {
    console.log(`\n❌ Found ${findings.length} risky maplibre-gl import patterns:\n`);
    findings.forEach((f) => {
        console.log(`  [WARNING] ${f.file}:${f.line}`);
        console.log(`    ${f.finding}`);
        console.log(`    ➜ ${f.suggestion}\n`);
    });
    // Warn but don't fail the build (some static imports may work in specific conditions)
    console.log('⚠️  Review these files. Static maplibre-gl imports + constructor calls often break in Vite production.');
    process.exit(0);
} else {
    console.log('✅ Maplibre-GL Static Import Audit passed. No risky patterns found.');
    process.exit(0);
}