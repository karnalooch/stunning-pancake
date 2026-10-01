import type { RideFinishState } from '../features/ride/model/RideFinishState';
import type { NavigatorScreenParams } from '@react-navigation/native';

/** Today is a compatibility route name; its user-facing destination is Ride. */
export type MainTabParamList = {
  Today: undefined;
  Discover: undefined;
  Club: undefined;
  You: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  StartRide: undefined;
  Tracking: undefined;
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
  RideSummary: RideFinishState;
  VisionGallery: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
