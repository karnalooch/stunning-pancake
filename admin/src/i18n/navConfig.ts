import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Building2, Users, ShieldAlert, Settings, Gift, Zap, Network,
  Calendar, TrendingUp, MessageSquare, Map, Play, Bike, MapPin, Inbox, Sparkles, Leaf,
} from 'lucide-react';

export type NavItemKey =
  | 'dashboard' | 'whiteLabel' | 'users' | 'departments' | 'activities'
  | 'moderationInbox' | 'moderationHistory' | 'actionInbox' | 'antiCheat' | 'events'
  | 'sponsorDashboard' | 'poiMap' | 'sponsorshipAnalytics' | 'vouchers' | 'campaigns' | 'brandStudio'
  | 'departmentAnalytics' | 'heatmaps' | 'liveMap' | 'feedback' | 'aiCoach' | 'voucher3d' | 'esg'
  | 'simulator' | 'revenue' | 'auditLog' | 'settings' | 'rbac' | 'featureFlags' | 'platformNotices' | 'leaderboards' | 'exportCenter' | 'apiPlayground';

export type NavSectionKey =
  | 'overview' | 'management' | 'operations' | 'sponsorship' | 'analytics' | 'system';

export interface NavItemConfig {
  icon: LucideIcon;
  labelKey: NavItemKey;
  path: string;
  roles: string[];
  badgeKey?: 'moderation';
  requiresHeatmapFlag?: boolean;
}

export interface NavSectionConfig {
  sectionKey: NavSectionKey;
  items: NavItemConfig[];
}

export const NAV_CONFIG: NavSectionConfig[] = [
  {
    sectionKey: 'overview',
    items: [
      { icon: LayoutDashboard, labelKey: 'dashboard', path: '/owner/dashboard', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'] },
    ],
  },
  {
    sectionKey: 'management',
    items: [
      { icon: Building2, labelKey: 'whiteLabel', path: '/owner/white-label', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
      { icon: Users, labelKey: 'users', path: '/owner/users', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
      { icon: Network, labelKey: 'departments', path: '/owner/departments', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
    ],
  },
  {
    sectionKey: 'operations',
    items: [
      { icon: Zap, labelKey: 'activities', path: '/owner/activities', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'] },
      { icon: Inbox, labelKey: 'moderationInbox', path: '/owner/moderation', roles: ['GLOBAL_OWNER', 'TENANT_MODERATOR', 'TENANT_ADMIN'], badgeKey: 'moderation' },
      { icon: Inbox, labelKey: 'moderationHistory', path: '/owner/moderation/history', roles: ['GLOBAL_OWNER', 'TENANT_MODERATOR', 'TENANT_ADMIN'] },
      { icon: Inbox, labelKey: 'actionInbox', path: '/owner/control-plane/inbox', roles: ['GLOBAL_OWNER'] },
      { icon: ShieldAlert, labelKey: 'antiCheat', path: '/owner/anti-cheat', roles: ['GLOBAL_OWNER', 'TENANT_MODERATOR'] },
      { icon: Calendar, labelKey: 'events', path: '/owner/analytics/events', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'] },
    ],
  },
  {
    sectionKey: 'sponsorship',
    items: [
      { icon: Gift, labelKey: 'sponsorDashboard', path: '/owner/sponsor', roles: ['GLOBAL_OWNER', 'SPONSOR'] },
      { icon: MapPin, labelKey: 'poiMap', path: '/owner/sponsor/poi', roles: ['GLOBAL_OWNER', 'SPONSOR'] },
      { icon: TrendingUp, labelKey: 'sponsorshipAnalytics', path: '/owner/analytics/sponsorship', roles: ['GLOBAL_OWNER', 'SPONSOR'] },
      { icon: Gift, labelKey: 'vouchers', path: '/owner/analytics/vouchers', roles: ['GLOBAL_OWNER', 'SPONSOR'] },
      { icon: TrendingUp, labelKey: 'campaigns', path: '/owner/sponsor/campaigns', roles: ['GLOBAL_OWNER', 'SPONSOR'] },
      { icon: Sparkles, labelKey: 'brandStudio', path: '/owner/sponsor/brand', roles: ['GLOBAL_OWNER', 'SPONSOR'] },
    ],
  },
  {
    sectionKey: 'analytics',
    items: [
      { icon: TrendingUp, labelKey: 'departmentAnalytics', path: '/owner/analytics/departments', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
      { icon: Map, labelKey: 'heatmaps', path: '/owner/analytics/heatmaps', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'], requiresHeatmapFlag: true },
      { icon: Bike, labelKey: 'liveMap', path: '/owner/analytics/live-map', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
      { icon: MessageSquare, labelKey: 'feedback', path: '/owner/analytics/feedback', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
      { icon: ShieldAlert, labelKey: 'auditLog', path: '/owner/analytics/audit-log', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
      { icon: Zap, labelKey: 'exportCenter', path: '/owner/analytics/export', roles: ['TENANT_ADMIN'] },
      { icon: Sparkles, labelKey: 'aiCoach', path: '/owner/premium/ai-coach', roles: ['GLOBAL_OWNER'] },
      { icon: Gift, labelKey: 'voucher3d', path: '/owner/premium/voucher-3d', roles: ['GLOBAL_OWNER', 'SPONSOR'] },
      { icon: Leaf, labelKey: 'esg', path: '/owner/premium/esg', roles: ['GLOBAL_OWNER'] },
      { icon: Play, labelKey: 'simulator', path: '/owner/analytics/simulator', roles: ['GLOBAL_OWNER'] },
      { icon: TrendingUp, labelKey: 'revenue', path: '/owner/analytics/revenue', roles: ['GLOBAL_OWNER'] },
    ],
  },
  {
    sectionKey: 'system',
    items: [
      { icon: Settings, labelKey: 'settings', path: '/owner/settings', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
      { icon: ShieldAlert, labelKey: 'rbac', path: '/owner/system/rbac', roles: ['GLOBAL_OWNER'] },
      { icon: Zap, labelKey: 'featureFlags', path: '/owner/system/feature-flags', roles: ['GLOBAL_OWNER'] },
      { icon: MessageSquare, labelKey: 'platformNotices', path: '/owner/system/platform-notices', roles: ['GLOBAL_OWNER', 'TENANT_ADMIN'] },
      { icon: TrendingUp, labelKey: 'leaderboards', path: '/owner/system/leaderboards', roles: ['GLOBAL_OWNER'] },
      { icon: Zap, labelKey: 'exportCenter', path: '/owner/system/export', roles: ['GLOBAL_OWNER'] },
      { icon: Zap, labelKey: 'apiPlayground', path: '/owner/system/api-playground', roles: ['GLOBAL_OWNER'] },
    ],
  },
];
