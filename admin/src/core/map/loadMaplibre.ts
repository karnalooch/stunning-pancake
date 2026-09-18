import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

/** Lazy-load maplibre-gl with CJS interop flattening (Vite/Rollup). */
let _mlPromise: Promise<any> | null = null;

export function loadMaplibregl(): Promise<any> {
  if (!_mlPromise) {
    _mlPromise = import('maplibre-gl').then((raw: any) => {
      let m: any = raw;
      while (m && m.default && typeof m.default === 'object' && !m.default.Map) {
        m = m.default;
      }
      const resolved = m.default?.Map ? m.default : (m.Map ? m : (raw.default || raw));
      resolved.setWorkerUrl?.(maplibreWorkerUrl);
      return resolved;
    });
  }
  return _mlPromise;
}
