import type { ImageSourcePropType } from 'react-native';

export const APPROVED_ASSETS = {
  riderCanonical: require('../../assets/approved/v1/rider_canonical_v1.jpg') as ImageSourcePropType,
  homeHeroDay: require('../../assets/approved/v1/home_hero_day_v1.jpg') as ImageSourcePropType,
  rideMarkerRider: require('../../assets/approved/v1/ride_marker_rider_v1.png') as ImageSourcePropType,
  summaryFinish: require('../../assets/approved/v1/summary_finish_v1.jpg') as ImageSourcePropType,
} as const;
