/**
 * Audits Live Map LOD crossfades (no MapLibre canvas).
 * Run: node scripts/audit-live-map-lod.mjs
 *
 * Keep in sync with liveMapZoom.ts LIVE_MAP_LOD + paint stops.
 */
const LOD = {
    cityHubMin: 4.5,
    cityHubFadeInEnd: 5.8,
    cityHubFadeOutStart: 8.2,
    cityHubFadeOutEnd: 9,
    clusterVisibleStart: 9,
    clusterPeakEnd: 11.6,
    clusterFadeOutEnd: 13.6,
    dotFadeInStart: 12,
    dotFadeInEnd: 12.15,
    dotFadeOutStart: 13.15,
    dotFadeOutEnd: 13.35,
    dotMicroMinOpacity: 0.55,
    iconMinZoom: 12,
    iconMaxZoom: 13.35,
    iconFadeInStart: 12,
    iconFadeInEnd: 12.15,
    iconMicroMinOpacity: 0.85,
    iconFadeOutStart: 13.15,
    iconFadeOutEnd: 13.35,
    labelMinZoom: 13.35,
    labelFadeInStart: 13.35,
    labelFadeInEnd: 13.7,
    labelIconOpacityAtHandoff: 0.85,
};

function interp(z, stops) {
    if (z <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
        if (z <= stops[i][0]) {
            const [z0, v0] = stops[i - 1];
            const [z1, v1] = stops[i];
            return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0);
        }
    }
    return stops[stops.length - 1][1];
}

const issues = [];
for (let z = 5; z <= 16.001; z = Math.round((z + 0.1) * 10) / 10) {
    const hubOp = interp(z, [
        [LOD.cityHubMin, 0.55],
        [LOD.cityHubFadeInEnd, 0.85],
        [8.2, 0.95],
        [LOD.cityHubFadeOutStart, 0.88],
        [LOD.cityHubFadeOutEnd, 0],
    ]);
    const clOp = interp(z, [
        [LOD.clusterVisibleStart, 0.32],
        [8, 0.72],
        [10.5, 0.88],
        [LOD.clusterPeakEnd, 0.94],
        [LOD.clusterFadeOutEnd - 1.2, 0.62],
        [LOD.clusterFadeOutEnd, 0],
    ]);
    const dotOp = interp(z, [
        [LOD.clusterVisibleStart - 0.5, 0],
        [LOD.dotFadeInStart, 0],
        [LOD.dotFadeInStart + 0.25, 0.35],
        [LOD.dotFadeInEnd, 0.82],
        [LOD.iconFadeInEnd, LOD.dotMicroMinOpacity],
        [LOD.dotFadeOutStart, LOD.dotMicroMinOpacity],
        [LOD.dotFadeOutEnd, 0],
    ]);
    const dotR = interp(z, [
        [LOD.clusterVisibleStart - 0.5, 0],
        [LOD.dotFadeInStart, 0],
        [LOD.dotFadeInStart + 0.25, 5],
        [12.2, 8],
        [LOD.dotFadeInEnd, 7],
        [LOD.dotFadeOutStart, 6],
        [LOD.dotFadeOutEnd, 0],
    ]);
    const iconLayer = z >= LOD.iconMinZoom && z < LOD.iconMaxZoom;
    const iconOp = iconLayer
        ? interp(z, [
              [LOD.iconFadeInStart, LOD.iconMicroMinOpacity],
              [LOD.iconFadeInEnd, LOD.iconMicroMinOpacity],
              [LOD.iconFadeOutStart, LOD.iconMicroMinOpacity],
              [LOD.iconFadeOutEnd, LOD.labelIconOpacityAtHandoff],
          ])
        : 0;
    const labelLayer = z >= LOD.labelMinZoom;
    const labelIconOp = labelLayer
        ? interp(z, [[LOD.labelFadeInStart, LOD.labelIconOpacityAtHandoff], [LOD.labelFadeInEnd, 1]])
        : 0;
    const dotVisible = dotOp > 0.2 && dotR > 3;
    const riderVis = Math.max(dotVisible ? dotOp : 0, iconOp, labelIconOp);
    if (riderVis < 0.25 && clOp < 0.2 && hubOp < 0.2) {
        issues.push({ z, type: 'GAP', riderVis, clOp, hubOp });
    }
    const inHandoff = z >= LOD.iconFadeInStart && z < LOD.labelMinZoom;
    if (dotVisible && iconOp > 0.5 && !inHandoff) {
        issues.push({ z, type: 'DOUBLE', dotOp: +dotOp.toFixed(2), iconOp: +iconOp.toFixed(2) });
    }
    if (iconOp > 0.35 && labelIconOp > 0.35 && iconLayer && labelLayer) {
        issues.push({
            z,
            type: 'ICON_OVERLAP',
            iconOp: +iconOp.toFixed(2),
            labelIconOp: +labelIconOp.toFixed(2),
        });
    }
    if (labelLayer && iconLayer && Math.abs(iconOp - labelIconOp) > 0.4) {
        issues.push({
            z,
            type: 'ICON_STEP',
            iconOp: +iconOp.toFixed(2),
            labelIconOp: +labelIconOp.toFixed(2),
        });
    }
}

const byType = (t) => issues.filter((i) => i.type === t);
console.log('GAP zooms:', byType('GAP').map((i) => i.z));
console.log('DOUBLE count:', byType('DOUBLE').length);
console.log('ICON_OVERLAP count:', byType('ICON_OVERLAP').length);
console.log('ICON_STEP count:', byType('ICON_STEP').length, 'samples:', byType('ICON_STEP').slice(0, 5));
process.exit(byType('GAP').length || byType('ICON_STEP').length > 3 ? 1 : 0);
