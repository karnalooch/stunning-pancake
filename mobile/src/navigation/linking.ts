import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import type { RootStackParamList } from './types';
import { ROUTE_PATHS } from './routeContract';

function resolvePrefix(): string {
  try {
    return Linking.createURL('/');
  } catch {
    return 'fourvelo://';
  }
}

const prefixes = Array.from(new Set([resolvePrefix(), 'fourvelo://']));

export const mobileLinking: LinkingOptions<RootStackParamList> = {
  prefixes,
  config: {
    screens: {
      MainTabs: {
        screens: {
          Ride: ROUTE_PATHS.ride,
          Compete: ROUTE_PATHS.compete,
          Explore: ROUTE_PATHS.explore,
          Profile: ROUTE_PATHS.profile,
          Tracking: ROUTE_PATHS.tracking,
        },
      },
      Settings: ROUTE_PATHS.settings,
      TrainingLog: ROUTE_PATHS.trainingLog,
      GpsDiagnostics: ROUTE_PATHS.gpsDiagnostics,
      Clubs: ROUTE_PATHS.clubs,
      Segments: ROUTE_PATHS.segments,
      ExploreMap: ROUTE_PATHS.exploreMap,
      Marketplace: ROUTE_PATHS.marketplace,
      ActivityDetail: {
        path: ROUTE_PATHS.activityDetail,
        parse: {
          activityId: (value: string) => Number(value),
        },
      },
      PerformanceTrends: ROUTE_PATHS.performanceTrends,
      GlobalLeaderboard: ROUTE_PATHS.globalLeaderboard,
      RidePaused: ROUTE_PATHS.ridePaused,
      RideSummary: {
        path: ROUTE_PATHS.rideSummary,
        parse: {
          activityId: (value: string) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
          },
        },
      },
      VisionGallery: ROUTE_PATHS.visionGallery,
    },
  },
};
