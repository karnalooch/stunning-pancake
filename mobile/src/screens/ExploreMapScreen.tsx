import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { PrimaryButton } from '../components/product';
import { RoadbookNotice, RoadbookRow } from '../components/roadbook/Surface';
import { getAppCopy } from '../components/roadbook/appCopy';
import { useI18n } from '../i18n/useI18n';
import { resolveRideMapStyle } from '../map/mapStyle';
import { isMapCoordinate } from '../map/routeGeometry';
import { POIService, type POI } from '../services/api';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

type PoiResponse = POI[] | { results?: POI[] };
export function normalizePois(data: PoiResponse): POI[] {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : null;
  if (!rows) throw new Error('Invalid POI response');
  const seen = new Set<string>();
  return rows.filter((poi) => {
    if (!poi || !isMapCoordinate([poi.longitude, poi.latitude])) return false;
    const key = String(poi.id);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export const ExploreMapScreen: React.FC<{ onOpenMarketplace?: () => void }> = ({ onOpenMarketplace }) => {
  const { theme } = useUnistyles();
  const { t, locale } = useI18n();
  const c = getAppCopy(locale);
  const semantic = getSemanticColors(theme.colors);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<POI | null>(null);
  const [mapError, setMapError] = useState(false);
  const [mapGeneration, setMapGeneration] = useState(0);
  const cameraRef = useRef<CameraRef>(null);
  const alive = useRef(false);
  const request = useRef(0);
  const mapStyle = useMemo(() => resolveRideMapStyle() as string | StyleSpecification, []);
  const readPois = useCallback(async () => {
    const id = ++request.current;
    try {
      const rows = normalizePois(await POIService.getPOIs());
      if (alive.current && id === request.current) { setPois(rows); setSelected(null); setLoadError(false); }
    } catch {
      if (alive.current && id === request.current) setLoadError(true);
    } finally {
      if (alive.current && id === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => { alive.current = true; void readPois(); return () => { alive.current = false; }; }, [readPois]);
  const loadPois = () => { setLoading(true); setLoadError(false); void readPois(); };
  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return text ? pois.filter((poi) => `${poi.name} ${poi.category ?? ''}`.toLocaleLowerCase().includes(text)) : pois;
  }, [pois, query]);
  const poiGeoJson: GeoJSON.FeatureCollection = useMemo(() => ({ type: 'FeatureCollection', features: filtered.map((poi) => ({
    type: 'Feature', id: poi.id, properties: { name: poi.name },
    geometry: { type: 'Point', coordinates: [poi.longitude, poi.latitude] },
  })) }), [filtered]);
  useEffect(() => {
    const target = selected ?? pois[0];
    if (target) cameraRef.current?.easeTo?.({ center: [target.longitude, target.latitude], zoom: selected ? 15 : 12, duration: 0 });
  }, [selected, pois, mapGeneration]);
  return <SafeAreaView style={styles.page} edges={['top']} testID="roadbook-discover">
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>{c.discover}</Text>
      <TextInput testID="discover-search" accessibilityLabel={c.search} placeholder={c.search}
        placeholderTextColor={semantic.text.secondary} value={query} onChangeText={setQuery} style={styles.input} />
    </View>
    <View style={styles.map} testID="discover-map-region">
      <Map key={mapGeneration} testID="explore-poi-map" style={styles.fill} mapStyle={mapStyle} logo={false} attribution
        touchZoom dragPan touchPitch={false} touchRotate={false}
        onDidFailLoadingMap={() => setMapError(true)}>
        <Camera ref={cameraRef} initialViewState={{ center: [0, 20], zoom: 2 }} />
        <GeoJSONSource id="explore-pois" data={poiGeoJson}>
          <Layer id="explore-poi-points" type="circle" source="explore-pois"
            style={{ circleColor: semantic.action.primary, circleRadius: 7, circleStrokeColor: semantic.text.onAction, circleStrokeWidth: 2 }} />
        </GeoJSONSource>
      </Map>
      {mapError ? <View style={styles.mapNotice}><RoadbookNotice title={c.mapError} testID="discover-map-error"
        action={<PrimaryButton label={c.mapRetry} variant="secondary" onPress={() => { setMapError(false); setMapGeneration((n) => n + 1); }} />} /></View> : null}
    </View>
    <ScrollView style={styles.sheet} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.sectionTitle}>{t.explore.poiTitle}</Text>
      {loading ? <Text style={styles.body} testID="explore-poi-loading">{t.common.loading}</Text> : null}
      {loadError ? <RoadbookNotice error title={t.explore.poiLoadError} message={t.explore.poiLoadErrorHint}
        testID="explore-poi-error" action={<PrimaryButton label={t.common.retry} variant="secondary"
          onPress={loadPois} testID="explore-poi-retry" />} /> : null}
      {!loading && !loadError && pois.length === 0 ? <Text style={styles.body} testID="explore-poi-empty">{t.explore.poiEmpty}</Text> : null}
      {!loading && !loadError && pois.length > 0 && filtered.length === 0 ? <Text style={styles.body}>{c.noMatches}</Text> : null}
      {selected ? <RoadbookNotice testID="discover-selected-place" title={selected.name}
        message={selected.description || selected.category || c.selectedPlace} /> : null}
      {filtered.map((poi) => <RoadbookRow key={poi.id} label={poi.name} detail={poi.category || undefined}
        testID={`explore-poi-${poi.id}`} onPress={() => setSelected(poi)} />)}
      {onOpenMarketplace ? <PrimaryButton label={t.explore.openMarketplace} onPress={onOpenMarketplace}
        variant="secondary" testID="discover-marketplace" /> : null}
    </ScrollView>
  </SafeAreaView>;
};
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    page: { flex: 1, backgroundColor: c.canvas.background }, header: { padding: 20, gap: 12 },
    title: { ...PRODUCT_TYPOGRAPHY.displayEditorial, fontSize: 32, color: c.text.primary },
    input: { minHeight: 48, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border.strong,
      backgroundColor: c.surface.default, ...PRODUCT_TYPOGRAPHY.body, color: c.text.primary },
    map: { flex: 1.2, minHeight: 180 }, fill: { flex: 1 },
    mapNotice: { position: 'absolute', left: 12, right: 12, top: 12 },
    sheet: { flex: 1, borderTopWidth: 1, borderColor: c.border.subtle }, list: { padding: 24, gap: 12, paddingBottom: 32 },
    sectionTitle: { ...PRODUCT_TYPOGRAPHY.title, color: c.text.primary }, body: { ...PRODUCT_TYPOGRAPHY.body, color: c.text.secondary },
  };
});
