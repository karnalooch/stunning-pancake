/**
 * Audits Live Map LOD crossfades (no MapLibre canvas).
 * Run: node scripts/audit-live-map-lod.mjs
 */
const LOD = {
    cityHubMin: 6,
    cityHubFadeInEnd: 7.2,
    cityHubFadeOutStart: 8.6,
    cityHubFadeOutEnd: 10.8,
    clusterVisibleStart: 6.2,
    clusterPeakEnd: 11.6,
    clusterFadeOutEnd: 13.6,
    dotFadeInStart: 7,
    dotFadeInEnd: 11.2,
    dotFadeOutStart: 11.8,
    dotFadeOutEnd: 13.2,
    iconMinZoom: 11.8,
    iconMaxZoom: 13.35,
    iconFadeInStart: 11.8,
    iconFadeInEnd: 12.2,
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

function layerActive(z, min, max) {
    return z >= min && z < max;
}

const issues = [];
for (let z = 5; z <= 16.001; z = Math.round((z + 0.1) * 10) / 10) {
    const hubOp = interp(z, [
        [LOD.cityHubMin, 0],
        [LOD.cityHubFadeInEnd, 0.72],
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
        [LOD.dotFadeInStart, 0.35],
        [11.2, 0.82],
        [LOD.dotFadeOutStart, 0.45],
        [12, 0.32],
        [12.2, 0.22],
        [12.6, 0.1],
        [LOD.dotFadeOutEnd, 0],
    ]);
    const dotR = interp(z, [
        [LOD.dotFadeInStart, 5],
        [9, 7],
        [11, 8],
        [LOD.dotFadeOutStart, 5.5],
        [12, 3],
        [12.2, 2.5],
        [12.6, 1],
        [LOD.dotFadeOutEnd, 0],
    ]);
    const iconLayer = layerActive(z, LOD.iconMinZoom, LOD.iconMaxZoom);
    const iconOp = iconLayer
        ? interp(z, [
              [LOD.iconFadeInStart, 0.15],
              [LOD.iconFadeInEnd, 0.75],
              [12.6, 0.95],
              [LOD.iconFadeOutStart, 0.92],
              [LOD.iconFadeOutEnd, LOD.labelIconOpacityAtHandoff],
          ])
        : 0;
    const labelLayer = z >= LOD.labelMinZoom;
    const labelIconOp = labelLayer
        ? interp(z, [[LOD.labelFadeInStart, LOD.labelIconOpacityAtHandoff], [LOD.labelFadeInEnd, 1]])
        : 0;
    const labelTextOp = labelLayer
        ? interp(z, [[LOD.labelFadeInStart, 0], [LOD.labelFadeInEnd, 1]])
        : 0;
    const dotVisible = dotOp > 0.2 && dotR > 3;
    const riderVis = Math.max(dotOp * (dotR > 1 ? 1 : 0), iconOp, labelIconOp);
    if (riderVis < 0.25 && clOp < 0.2 && hubOp < 0.2) {
        issues.push({ z, type: 'GAP', riderVis, clOp, hubOp });
    }
    if (dotVisible && iconOp > 0.5) {
        issues.push({ z, type: 'DOUBLE', dotOp: +dotOp.toFixed(2), iconOp: +iconOp.toFixed(2) });
    }
    if (iconOp > 0.6 && labelIconOp > 0.4 && iconLayer && labelLayer) {
        issues.push({
            z,
            type: 'ICON_OVERLAP',
            iconOp: +iconOp.toFixed(2),
            labelIconOp: +labelIconOp.toFixed(2),
        });
    }
    if (labelLayer && iconLayer && Math.abs(iconOp - labelIconOp) > 0.35) {
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
console.log('DOUBLE count:', byType('DOUBLE').length, 'range', byType('DOUBLE')[0]?.z, '-', byType('DOUBLE').at(-1)?.z);
console.log('ICON_OVERLAP count:', byType('ICON_OVERLAP').length);
console.log('ICON_STEP count:', byType('ICON_STEP').length, 'samples:', byType('ICON_STEP').slice(0, 5));
process.exit(byType('GAP').length || byType('ICON_STEP').length > 3 ? 1 : 0);
