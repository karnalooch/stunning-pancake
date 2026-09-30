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
          Today: ROUTE_PATHS.today,
          Discover: ROUTE_PATHS.discover,
          StartRide: ROUTE_PATHS.startRide,
          Club: ROUTE_PATHS.club,
          You: ROUTE_PATHS.you,
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
      VisionGallery: ROUTE_PATHS.visionGallery,
    },
  },
};
