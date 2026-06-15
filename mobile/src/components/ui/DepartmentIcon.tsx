import React from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PixelText } from '../PixelText';
import { deptIconFor } from '../../assets/visionAssets';

interface DepartmentIconProps {
  name: string;
  source?: ImageSourcePropType;
  size?: number;
}

/** Team/department icon; falls back to an initial glyph until the PNG exists. */
export const DepartmentIcon: React.FC<DepartmentIconProps> = ({ name, source, size = 32 }) => {
  const { theme } = useUnistyles();
  const c = theme.colors as Record<string, string>;
  const resolved = source ?? deptIconFor(name);

  if (resolved) {
    return <Image source={resolved} style={{ width: size, height: size }} resizeMode="contain" />;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: 2,
        borderColor: c.hudOutline,
        backgroundColor: c.selection,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PixelText style={{ fontSize: Math.max(8, Math.round(size / 3)), color: c.onSelection }}>
        {name.trim().slice(0, 1).toUpperCase()}
      </PixelText>
    </View>
  );
};
