export interface TokenPair {
  access: string;
  refresh: string;
}

export interface TokenRefreshResponse {
  access: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role?: string;
  tenant_id?: string | null;
  tenant_name?: string;
  avatar?: string | null;
  bio?: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  tenant_id?: string;
}

export interface ActivitySessionCreate {
  type: string;
  start_time: string;
  event_id?: number;
}
