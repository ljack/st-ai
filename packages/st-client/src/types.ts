export interface RemoteUserSession {
  sessionkey: string;
  username: string;
  email: string;
  userKey: string;
  country: string;
  emailVerified: boolean;
}

export interface RemoteUser {
  username: string;
  key: string;
  realName?: string;
  country?: string;
  uuid?: string;
  gender?: string;
  profileImageUrl?: string;
}

export interface FollowCounts {
  followers: number;
  followings: number;
  blocked: number;
  blockedBy: number;
}

export interface RemoteSyncedWorkout {
  activityId: number;
  startTime: number; // unix ms
  totalDistance: number; // meters
  totalTime: number; // seconds
  totalAscent?: number; // meters
  key: string;
  energyConsumption?: number; // kcal
  avgHr?: number;
  maxHr?: number;
  description?: string;
  sharingFlags?: number;
  deviceName?: string;
}

export interface WorkoutList {
  items: RemoteSyncedWorkout[];
  until: number;
}

export interface PerActivityStats {
  activityId: number;
  count: number;
  distance: number;
  duration: number;
  energy: number;
}

export interface WorkoutStats {
  totalDistanceSum: number;
  totalTimeSum: number;
  totalEnergyConsumptionSum: number;
  totalNumberOfWorkoutsSum: number;
  totalDays: number;
  allStats: PerActivityStats[];
}

export interface WorkoutCount {
  count: number;
  totalCount: number;
}

export interface AskoResponse<T> {
  error: AskoError | null;
  metadata: any;
  payload: T;
}

export interface AskoError {
  code: number;
  description: string;
}
