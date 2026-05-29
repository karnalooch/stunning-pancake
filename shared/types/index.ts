// ─── Shared domain types for 4VELO ───────────────────────────
// Fields match backend snake_case serialization.
// Import from '@shared/types' (requires tsconfig path alias) or '../shared/types'.

// ── Auth / User ─────────────────────────────────────────────

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
  tenant_id: string | null;
  tenant_name: string;
  avatar: string | null;
  bio: string;
  is_active: boolean;
}

export interface Tenant {
  id: number;
  name: string;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
}

// ── Activities ──────────────────────────────────────────────

export interface ActivityItem {
  id: number;
  type: string;
  start_time: string;
  end_time: string | null;
  distance: number;          // metres
  duration: number | null;   // seconds (float)
  is_verified: boolean;
  verification_score: number;
}

export interface ActivityDetail extends ActivityItem {
  user: number;
  user_info: { id: number; username: string };
  route_path: Record<string, unknown> | null;  // GeoJSON LineString
  tenant: number | null;
  created_at: string;
  route_coords: Array<[number, number]> | null;
}

// ── Leaderboard ─────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  is_me: boolean;
}

// ── Rewards ─────────────────────────────────────────────────

export interface RewardPool {
  id: number;
  title: string;
  description: string;
  points_required: number;
  sponsor_name: string;
  available: number;
  valid_from: string;   // ISO datetime
  valid_until: string;  // ISO datetime
}

export interface RewardBalance {
  points: number;
}

// ── POI ─────────────────────────────────────────────────────

export interface POI {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  description: string;
  tenant_id: string | null;
}

// ── Events ──────────────────────────────────────────────────

export type EventType = 'GLOBAL' | 'INTER_TENANT' | 'CLUB';
export type EventStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Event {
  id: number;
  title: string;
  slug: string;
  description: string;
  event_type: EventType;
  sport_filter: string;
  status: EventStatus;
  start_date: string;
  end_date: string;
  tenant_id: number;
  opponent_tenant_id: number | null;
  club: number | null;
  opponent_club: number | null;
  require_brouter_validation: boolean;
  boundary: Record<string, unknown> | null;  // GeoJSON Polygon
  created_at: string;
}

// ── Clubs ───────────────────────────────────────────────────

export interface Club {
  id: number;
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  sport_type: string;
  tenant_id: number;
  owner_username: string;
  member_count: number;
  created_at: string;
}

export interface ClubChallenge {
  id: number;
  title: string;
  sport_type: string;
  challenger: number;
  challenger_name: string;
  challenger_score: number;
  opponent: number | null;
  opponent_name: string;
  opponent_score: number;
  winner: number | null;
  winner_name: string;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  start_date: string;
  end_date: string;
  created_at: string;
}

// ── Departments ─────────────────────────────────────────────

export interface Department {
  id: number;
  name: string;
  tenant: number;
  tenant_name: string;
  parent: number | null;
  parent_name: string | null;
  moderator: number | null;
  moderator_name: string | null;
  department_type: string;
  description: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

// ── API Envelope ────────────────────────────────────────────
// Some endpoints wrap responses in { ok: true, data: ... }
// Others return data directly (bare object or array).

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Pagination ──────────────────────────────────────────────
// DRF's standard pagination format (used by many endpoints).

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
