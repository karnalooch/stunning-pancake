/** Lazy-load maplibre-gl with CJS interop flattening (Vite/Rollup). */
let _mlPromise: Promise<any> | null = null;

export function loadMaplibregl(): Promise<any> {
  if (!_mlPromise) {
    _mlPromise = import('maplibre-gl').then((raw: any) => {
      let m: any = raw;
      while (m && m.default && typeof m.default === 'object' && !m.default.Map) {
        m = m.default;
      }
      if (m.default?.Map) return m.default;
      if (m.Map) return m;
      return raw.default || raw;
    });
  }
  return _mlPromise;
}
