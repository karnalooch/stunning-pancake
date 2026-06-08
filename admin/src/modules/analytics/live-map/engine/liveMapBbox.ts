/** Viewport bbox with padding so edge riders do not pop out when panning slightly. */
export function bboxFromMap(
    map: { getBounds: () => { getWest: () => number; getSouth: () => number; getEast: () => number; getNorth: () => number } },
    paddingRatio = 0.22,
): string {
    const bounds = map.getBounds();
    const west = bounds.getWest();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const north = bounds.getNorth();
    const padW = (east - west) * paddingRatio;
    const padH = (north - south) * paddingRatio;
    return [
        (west - padW).toFixed(4),
        (south - padH).toFixed(4),
        (east + padW).toFixed(4),
        (north + padH).toFixed(4),
    ].join(',');
}
