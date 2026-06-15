import React from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PixelText } from '../PixelText';
import { crestForTenant, crestInitials } from '../../assets/visionAssets';

interface CrestIconProps {
  /** Tenant id or display name; resolved to a crest PNG when available. */
  tenant: string;
  /** Explicit source overrides the tenant lookup. */
  source?: ImageSourcePropType;
  size?: number;
}

/** City crest; falls back to an initialed pixel shield until the PNG exists. */
export const CrestIcon: React.FC<CrestIconProps> = ({ tenant, source, size = 28 }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const resolved = source ?? crestForTenant(tenant);

  if (resolved) {
    return <Image source={resolved} style={{ width: size, height: size }} resizeMode="contain" />;
  }

  return (
    <View
      accessibilityLabel={`${tenant} crest`}
      style={{
        width: size,
        height: size,
        borderWidth: 2,
        borderColor: c.hudOutline,
        backgroundColor: c.primaryContainer,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PixelText style={{ fontSize: Math.max(8, Math.round(size / 3)), color: c.onBackground }}>
        {crestInitials(tenant)}
      </PixelText>
    </View>
  );
};
