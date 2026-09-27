import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { PrimaryButton, ProductCard } from '../components/product';
import { SkeletonBlock } from '../components/ui/SkeletonBlock';
import { useI18n } from '../i18n/useI18n';
import { resolveRideMapStyle } from '../map/mapStyle';
import { POIService, type POI } from '../services/api';
import { LAYOUT } from '../theme/layout';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';

type PoiResponse = POI[] | { results?: POI[] };

function normalizePois(data: PoiResponse): POI[] {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
      ? data.results
      : null;

  if (!rows) {
    throw new Error('Invalid POI response');
  }

  const seen = new Set<string>();
  return rows.filter((poi) => {
    if (!Number.isFinite(poi.latitude) || !Number.isFinite(poi.longitude)) {
      return false;
    }

    const key = `${poi.id}-${poi.latitude.toFixed(5)}-${poi.longitude.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const stylesheet = StyleSheet.create((theme) => {
  const semantic = getSemanticColors(theme.colors);

  return {
    container: {
      flex: 1,
      backgroundColor: semantic.canvas.background,
    },
    header: {
      minHeight: 88,
      paddingHorizontal: LAYOUT.gutter,
      paddingVertical: 12,
      justifyContent: 'center',
      backgroundColor: semantic.surface.raised,
      borderBottomWidth: 1,
      borderBottomColor: semantic.border.subtle,
    },
    title: {
      ...PRODUCT_TYPOGRAPHY.title,
      color: semantic.text.primary,
    },
    hint: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
      marginTop: 3,
    },
    content: {
      padding: LAYOUT.gutter,
      gap: LAYOUT.sectionGap,
      paddingBottom: 112,
    },
    mapFrame: {
      height: 320,
      overflow: 'hidden',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: semantic.border.subtle,
      backgroundColor: semantic.surface.interactive,
    },
    map: {
      flex: 1,
    },
    sectionTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      fontSize: 18,
      lineHeight: 24,
      color: semantic.text.primary,
    },
    stateContent: {
      gap: 10,
    },
    errorTitle: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.status.error,
    },
    stateBody: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
    poiList: {
      gap: 10,
    },
    poiCardContent: {
      gap: 4,
    },
    poiName: {
      ...PRODUCT_TYPOGRAPHY.bodyMedium,
      color: semantic.text.primary,
    },
    poiMeta: {
      ...PRODUCT_TYPOGRAPHY.body,
      color: semantic.text.secondary,
    },
  };
});

export const ExploreMapScreen: React.FC = () => {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const s = stylesheet;
  const semantic = getSemanticColors(theme.colors);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const mapStyle = useMemo<string | StyleSpecification>(
    () => resolveRideMapStyle(false) as string | StyleSpecification,
    [],
  );

  const loadPois = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setPois(normalizePois(await POIService.getPOIs()));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void POIService.getPOIs()
      .then((data) => {
        if (active) setPois(normalizePois(data));
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const mapCenter = useMemo<[number, number] | null>(
    () => (pois.length ? [pois[0].longitude, pois[0].latitude] : null),
    [pois],
  );

  const poiGeoJson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!pois.length) return null;

    return {
      type: 'FeatureCollection',
      features: pois.map((poi) => ({
        type: 'Feature',
        id: poi.id,
        properties: {
          name: poi.name,
          category: poi.category,
        },
        geometry: {
          type: 'Point',
          coordinates: [poi.longitude, poi.latitude],
        },
      })),
    };
  }, [pois]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>{t.explore.poiTitle}</Text>
        <Text style={s.hint}>{t.explore.mapHint}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {loading ? (
          <SkeletonBlock height={320} />
        ) : loadError ? (
          <ProductCard variant="raised" testID="explore-poi-error">
            <View style={s.stateContent}>
              <Text style={s.errorTitle}>{t.explore.poiLoadError}</Text>
              <Text style={s.stateBody}>{t.explore.poiLoadErrorHint}</Text>
              <PrimaryButton
                label={t.common.retry}
                onPress={() => void loadPois()}
                variant="secondary"
                testID="explore-poi-retry"
              />
            </View>
          </ProductCard>
        ) : pois.length === 0 ? (
          <ProductCard testID="explore-poi-empty">
            <Text style={s.stateBody}>{t.explore.poiEmpty}</Text>
          </ProductCard>
        ) : (
          <>
            {mapCenter && poiGeoJson ? (
              <View style={s.mapFrame} testID="explore-poi-map">
                <Map
                  style={s.map}
                  mapStyle={mapStyle}
                  logo={false}
                  attribution
                  touchZoom
                  dragPan
                  touchPitch={false}
                  touchRotate={false}
                >
                  <Camera initialViewState={{ center: mapCenter, zoom: 12 }} />
                  <GeoJSONSource id="explore-pois" data={poiGeoJson}>
                    <Layer
                      id="explore-poi-points"
                      type="circle"
                      source="explore-pois"
                      style={{
                        circleColor: semantic.action.primary,
                        circleRadius: 7,
                        circleStrokeColor: semantic.text.onAction,
                        circleStrokeWidth: 2,
                      }}
                    />
                  </GeoJSONSource>
                </Map>
              </View>
            ) : null}

            <Text style={s.sectionTitle}>{t.explore.poiTitle}</Text>
            <View style={s.poiList}>
              {pois.map((poi) => (
                <ProductCard key={poi.id} testID={`explore-poi-${poi.id}`}>
                  <View style={s.poiCardContent}>
                    <Text style={s.poiName}>{poi.name}</Text>
                    <Text style={s.poiMeta}>{poi.category}</Text>
                    {poi.description ? <Text style={s.poiMeta}>{poi.description}</Text> : null}
                    <Text style={s.poiMeta}>
                      {poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}
                    </Text>
                  </View>
                </ProductCard>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
