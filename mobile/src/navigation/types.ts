import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Ride: undefined;
  Compete: undefined;
  Explore: undefined;
  Profile: undefined;
  Tracking: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Settings: undefined;
  TrainingLog: undefined;
  GpsDiagnostics: undefined;
  Clubs: undefined;
  Segments: undefined;
  ExploreMap: undefined;
  Marketplace: undefined;
  ActivityDetail: { activityId: number };
  PerformanceTrends: undefined;
  GlobalLeaderboard: undefined;
  RidePaused: undefined;
  RideSummary: {
    distanceKm: number;
    elapsedS: number;
    elevationGainM: number;
    activityId?: number;
  };
  VisionGallery: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
