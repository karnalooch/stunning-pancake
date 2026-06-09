/**
 * Post-deploy Live Map audit — logic matrix, prod bundle markers, no browser.
 * Run: node scripts/audit-live-map-deploy.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ADMIN_URL = process.env.ADMIN_URL || 'https://admin-production-083b.up.railway.app';
const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-production-55c7.up.railway.app';

const checks = [];

function ok(name, pass, detail = '') {
    checks.push({ name, pass, detail });
    console.log(`${pass ? '✅' : '❌'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchText(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return res.text();
}

async function main() {
    console.log('\n═══ Live Map Deploy Audit ═══\n');

    // Dynamic imports from TS sources (tsx resolves via package)
    const { layerVisibilityForRenderMode, MESO_RIDER_LAYERS, MICRO_RIDER_LAYERS } = await import(
        '../src/modules/analytics/live-map/engine/liveMapH3Layer.ts'
    );
    const {
        clusterLayerOpacityAtZoom,
        ridersVisibleAtZoom,
        auditLiveMapLodCrossfade,
        resolveLiveMapTier,
    } = await import('../src/modules/analytics/live-map/engine/liveMapZoom.ts');
    const { mockRenderModeForDetail } = await import('../e2e/fixtures/liveMapTelemetry.ts');

    console.log('─── Layer visibility matrix ───');
    for (const z of [6.5, 8, 9.5, 10, 10.5, 11.5, 12.9, 13.5, 15]) {
        const tier = resolveLiveMapTier(z);
        const detail = tier === 'macro' ? 'summary' : tier === 'meso' ? 'standard' : 'full';
        const mode = mockRenderModeForDetail(detail, 290);
        const mesoVis = MESO_RIDER_LAYERS.every((id) => layerVisibilityForRenderMode(id, mode, z));
        const microVis = MICRO_RIDER_LAYERS.every((id) => layerVisibilityForRenderMode(id, mode, z));
        const expectedMeso = tier === 'meso';
        const expectedMicro = tier === 'micro';
        ok(
            `z=${z} ${tier} render_mode=${mode}`,
            mesoVis === expectedMeso && microVis === expectedMicro,
            `clusters=${mesoVis} micro=${microVis}`,
        );
    }

    console.log('\n─── LOD / paint ───');
    ok('cluster opacity z=10.5 ≥ 0.85', clusterLayerOpacityAtZoom(10.5) >= 0.85, String(clusterLayerOpacityAtZoom(10.5)));
    ok('riders visible z=10.5', ridersVisibleAtZoom(10.5));
    ok('riders visible z=12.9 (micro fix)', ridersVisibleAtZoom(12.9));
    ok('LOD crossfade no GAP', auditLiveMapLodCrossfade().filter((i) => i.type === 'GAP').length === 0);

    console.log('\n─── E2E mock ↔ backend ───');
    ok('standard → clusters', mockRenderModeForDetail('standard', 290) === 'clusters');
    ok('full + 45 → points', mockRenderModeForDetail('full', 45) === 'points');
    ok('full + 290 → clusters', mockRenderModeForDetail('full', 290) === 'clusters');

    console.log('\n─── Prod bundle ───');
    const html = await fetchText(`${ADMIN_URL}/`);
    ok('admin HTML 200', html.includes('SPORT'));
    const indexMatch = html.match(/\/assets\/index-[^"]+\.js/);
    ok('index chunk in HTML', Boolean(indexMatch), indexMatch?.[0] ?? '');
    const indexJs = await fetchText(`${ADMIN_URL}${indexMatch[0]}`);
    const liveMatch = indexJs.match(/LiveMap-[^"]+\.js/);
    ok('LiveMap lazy chunk ref', Boolean(liveMatch), liveMatch?.[0] ?? '');
    const liveJs = await fetchText(`${ADMIN_URL}/assets/${liveMatch[0]}`);
    const markers = [
        '__liveMapLayerVis',
        'live-clusters',
        'live-unclustered',
        'live-rider-labels',
        'getLayerVisibility',
        'clusterMaxZoom',
    ];
    for (const m of markers) {
        const count = (liveJs.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        ok(`prod LiveMap contains "${m}"`, count > 0, `×${count}`);
    }
    ok('prod tier-first vis cache', liveJs.includes('__liveMapLayerVis=a'));

    console.log('\n─── Backend endpoints ───');
    for (const path of ['/api/activities/telemetry/live/', '/api/activities/telemetry/config/', '/api/infra/health/']) {
        const res = await fetch(`${BACKEND_URL}${path}`, { signal: AbortSignal.timeout(15_000) });
        ok(`${path} reachable`, res.status === 401 || res.status === 200, `HTTP ${res.status}`);
    }

    const failed = checks.filter((c) => !c.pass);
    console.log(`\n─── Summary: ${checks.length - failed.length}/${checks.length} passed ───\n`);
    process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
