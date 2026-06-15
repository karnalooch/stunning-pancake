import React from 'react';
import { ImageBackground, View, type ImageSourcePropType } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PixelText } from '../PixelText';
import { CrestIcon } from '../ui/CrestIcon';

interface CityBannerProps {
  cityName: string;
  label: string;
  source?: ImageSourcePropType;
  height?: number;
}

/** "City of the week" banner with ribbon + crest (vision/05_compete_hub.png). */
export const CityBanner: React.FC<CityBannerProps> = ({ cityName, label, source, height = 120 }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;

  const content = (
    <>
      <View
        style={{
          alignSelf: 'center',
          backgroundColor: c.gpForestGreen,
          borderWidth: 2,
          borderColor: c.hudOutline,
          paddingHorizontal: 12,
          paddingVertical: 4,
          marginTop: 8,
        }}
      >
        <PixelText size="xs" style={{ color: c.onPrimary }}>{label.toUpperCase()}</PixelText>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}>
        <CrestIcon tenant={cityName} size={32} />
        <PixelText size="xl" style={{ color: source ? c.onPrimary : c.onBackground }}>
          {cityName.toUpperCase()}
        </PixelText>
      </View>
    </>
  );

  const frame = {
    height,
    borderWidth: 3,
    borderColor: c.hudOutline,
    overflow: 'hidden' as const,
  };

  if (source) {
    return (
      <ImageBackground source={source} style={frame} resizeMode="cover">
        <View style={{ flex: 1, backgroundColor: c.scrimSoft }}>{content}</View>
      </ImageBackground>
    );
  }

  return <View style={[frame, { backgroundColor: c.sceneSky }]}>{content}</View>;
};
