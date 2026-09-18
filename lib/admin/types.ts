export type DailyPoint = { date: string; value: number };

export type Direction = "up" | "down";

export type StatMetric = {
  label: string;
  value: number;
  formatted: string;
  deltaPct: number;
  deltaDirection: Direction;
  /** Whether this delta's direction should read as good (colored success) or bad (error). */
  deltaIsGood: boolean;
  trend: DailyPoint[];
};

export type MiniMetric = {
  key: string;
  label: string;
  value: number;
  formatted: string;
  trend: DailyPoint[];
};

export type RankedItem = { label: string; value: number; formatted: string };

export type HealthLevel = "good" | "warning" | "critical";

export type SystemHealthItem = {
  name: string;
  level: HealthLevel;
  detail: string;
};

export type OverviewData = {
  kpis: StatMetric[];
  productUsage: MiniMetric[];
  growth: DailyPoint[];
  systemHealth: SystemHealthItem[];
};

export type UsersData = {
  stats: StatMetric[];
  growth90d: DailyPoint[];
  newSignups90d: DailyPoint[];
};

export type ResearchSession = {
  id: string;
  topic: string;
  user: string;
  startedAt: string;
  items: number;
};

export type ResearchData = {
  topics: RankedItem[];
  features: RankedItem[];
  sessions: ResearchSession[];
  sourceSearches: StatMetric;
  documentsProcessed: StatMetric;
};

export type ProviderUsage = { name: string; requests: number; sharePct: number; color: string };
export type ProviderStatus = { name: string; level: HealthLevel; detail: string };

export type AiUsageData = {
  totalRequests: StatMetric;
  successful: StatMetric;
  failures: StatMetric;
  avgResponseMs: StatMetric;
  providerUsage: ProviderUsage[];
  providerStatus: ProviderStatus[];
  geminiQuotaPct: number;
};

export type ActivityStatus = "success" | "pending" | "failed";
export type ActivityRecord = {
  id: string;
  user: string;
  action: string;
  topic: string;
  timestamp: string;
  status: ActivityStatus;
};

export type ProviderConfig = { name: string; envVar: string; configured: boolean };
