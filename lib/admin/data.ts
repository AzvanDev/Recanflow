import { buildDailySeries, createRng, dateLabel, relativeTime } from "./seed";
import type {
  ActivityRecord,
  AiUsageData,
  DailyPoint,
  Direction,
  MiniMetric,
  OverviewData,
  ProviderConfig,
  ProviderStatus,
  ProviderUsage,
  RankedItem,
  ResearchData,
  ResearchSession,
  StatMetric,
  SystemHealthItem,
  UsersData,
} from "./types";

/**
 * All admin dashboard data is synthetic/demo, seeded from a fixed baseline so it reads as
 * "a real, consistent product" without ever being real production data.
 *
 * Every value below is computed exactly ONCE, eagerly, at module load — not lazily inside the
 * exported `getXData()` functions. Server Components call these on every request, and they
 * share one mutable PRNG; computing on-demand would advance that PRNG a different number of
 * times depending on navigation order, so the same metric would read differently on every
 * reload. Precomputing once makes every exported getter a pure "return the stored value" call,
 * which is also a closer shape to a real backend: a production version would replace the
 * eager-computation block with an actual DB read inside each function body — the exported
 * shapes and call sites would not change.
 */

const TOTAL_USERS = 74668;
const DAYS = 90;
const rng = createRng(TOTAL_USERS);

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString("en-US");
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function series(daysAgoStart: number, values: number[]): DailyPoint[] {
  return values.map((value, i) => ({ date: dateLabel(daysAgoStart - i), value }));
}

function statFromPeriods(label: string, current: number, previous: number, trend: DailyPoint[], goodDirectionIsUp = true): StatMetric {
  const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const deltaDirection: Direction = deltaPct >= 0 ? "up" : "down";
  return {
    label,
    value: current,
    formatted: formatCompact(current),
    deltaPct: Math.round(deltaPct * 10) / 10,
    deltaDirection,
    deltaIsGood: deltaDirection === "up" ? goodDirectionIsUp : !goodDirectionIsUp,
    trend,
  };
}

function relabeled(stat: StatMetric, label: string): StatMetric {
  return { ...stat, label };
}

function relabeledMini(mini: MiniMetric, label: string): MiniMetric {
  return { ...mini, label };
}

// ---- base seeded series ----

const newSignupsDaily = buildDailySeries(rng, DAYS, { base: 150, trendPerDay: 0.55, noise: 0.22, weekendFactor: 0.72 });
const totalSignups90d = sum(newSignupsDaily);
const startingBase = TOTAL_USERS - totalSignups90d;

let runningTotal = startingBase;
const growth90d: DailyPoint[] = newSignupsDaily.map((n, i) => {
  runningTotal += n;
  return { date: dateLabel(DAYS - 1 - i), value: runningTotal };
});

const newUsersThisPeriod = sum(newSignupsDaily.slice(-30));
const newUsersPrevPeriod = sum(newSignupsDaily.slice(-60, -30));

const activeMonth = Math.round(TOTAL_USERS * rng.float(0.4, 0.46));
const activeWeek = Math.round(activeMonth * rng.float(0.42, 0.5));
const activeToday = Math.round(activeWeek * rng.float(0.22, 0.3));

// ---- product/usage metrics: one seeded daily series per key, each computed exactly once ----

// Average events per active-monthly-user over 30 days — keeps every usage metric proportional
// to the same underlying "how active is the user base" number.
const USAGE_MULTIPLIERS = {
  questionsAsked: 2.4,
  branchesCreated: 1.1,
  aiAnswers: 2.3,
  summaries: 0.6,
  debates: 0.35,
  researchSessions: 0.5,
  researchSearches: 0.9,
  youtubeSearches: 0.7,
  documentsUploaded: 0.25,
} as const;
type UsageKey = keyof typeof USAGE_MULTIPLIERS;

function computeUsageMetric(key: UsageKey, label: string): { stat: StatMetric; mini: MiniMetric } {
  const dailyAvg = (activeMonth * USAGE_MULTIPLIERS[key]) / 30;
  const daily60 = buildDailySeries(rng, 60, { base: dailyAvg * 0.8, trendPerDay: dailyAvg * 0.01, noise: 0.25, weekendFactor: 0.78 });
  const previous = sum(daily60.slice(0, 30));
  const current = sum(daily60.slice(30));
  const trend = series(13, daily60.slice(-14));
  return {
    stat: statFromPeriods(label, current, previous, trend),
    mini: { key, label, value: current, formatted: formatCompact(current), trend },
  };
}

const USAGE: Record<UsageKey, { stat: StatMetric; mini: MiniMetric }> = {
  questionsAsked: computeUsageMetric("questionsAsked", "Questions Asked"),
  branchesCreated: computeUsageMetric("branchesCreated", "Branches Created"),
  aiAnswers: computeUsageMetric("aiAnswers", "AI Answers"),
  summaries: computeUsageMetric("summaries", "Summaries"),
  debates: computeUsageMetric("debates", "Debates"),
  researchSessions: computeUsageMetric("researchSessions", "Research Sessions"),
  researchSearches: computeUsageMetric("researchSearches", "Research Searches"),
  youtubeSearches: computeUsageMetric("youtubeSearches", "YouTube Searches"),
  documentsUploaded: computeUsageMetric("documentsUploaded", "Documents Uploaded"),
};

// ---- overview KPIs / users stats ----

const activeTrend14Raw = buildDailySeries(rng, 14, { base: activeToday * 0.9, trendPerDay: activeToday * 0.01, noise: 0.12, weekendFactor: 0.85 });

const KPI_TOTAL_USERS = statFromPeriods("Total Users", TOTAL_USERS, TOTAL_USERS - newUsersThisPeriod, series(29, newSignupsDaily.slice(-30)));

const OVERVIEW_SYSTEM_HEALTH: SystemHealthItem[] = [
  { name: "API", level: "good", detail: `${rng.int(80, 180)}ms avg latency` },
  { name: "Database", level: "good", detail: `${rng.int(10, 60)}ms query latency` },
  { name: "Search (Tavily)", level: "good", detail: `${rng.int(120, 340)}ms avg latency` },
  { name: "YouTube", level: "good", detail: `${rng.int(90, 260)}ms avg latency` },
  { name: "Storage", level: rng.bool(0.85) ? "good" : "warning", detail: `${rng.int(38, 74)}% capacity used` },
];

const USERS_STATS: StatMetric[] = [
  KPI_TOTAL_USERS,
  statFromPeriods("Active Today", activeToday, Math.round(activeToday * rng.float(0.85, 0.98)), series(13, activeTrend14Raw)),
  statFromPeriods(
    "Active This Week",
    activeWeek,
    Math.round(activeWeek * rng.float(0.88, 0.99)),
    series(13, activeTrend14Raw.map((v) => Math.round((v * activeWeek) / activeToday)))
  ),
  statFromPeriods(
    "Active This Month",
    activeMonth,
    Math.round(activeMonth * rng.float(0.9, 0.99)),
    series(13, activeTrend14Raw.map((v) => Math.round((v * activeMonth) / activeToday)))
  ),
  statFromPeriods("New Signups", newUsersThisPeriod, newUsersPrevPeriod, series(29, newSignupsDaily.slice(-30)).slice(-14)),
];

// ---- research activity ----

const TOPIC_POOL = [
  "Renewable energy policy",
  "Machine learning ethics",
  "Climate adaptation strategies",
  "Public health interventions",
  "Urban transit planning",
  "Protein folding basics",
  "Behavioral economics",
  "Quantum computing fundamentals",
  "Sustainable agriculture",
  "Cognitive bias in decision-making",
] as const;

const FEATURE_POOL = ["Explore with AI", "Open Research search", "Document upload", "Select + Summarize", "Debate (Argue For/Against)", "Related videos", "Add to Flow", "Follow-up questions"] as const;

const ACTION_POOL = [
  "Explored a question",
  "Started a debate",
  "Summarized a selection",
  "Added research to flow",
  "Uploaded a document",
  "Searched YouTube videos",
  "Opened research search",
  "Asked a follow-up",
] as const;

const FIRST_NAMES = ["Maya", "Devon", "Priya", "Noah", "Elena", "Kai", "Sofia", "Marcus", "Amara", "Liam", "Yuki", "Talia", "Omar", "Ines", "Felix"] as const;
const LAST_INITIALS = ["R.", "K.", "S.", "T.", "M.", "B.", "L.", "D.", "N.", "V."] as const;

function fictionalUser(): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_INITIALS)}`;
}

function rankedFrom(labels: readonly string[], maxValue: number): RankedItem[] {
  return labels
    .map((label) => {
      const value = rng.int(Math.round(maxValue * 0.25), maxValue);
      return { label, value, formatted: formatCompact(value) };
    })
    .sort((a, b) => b.value - a.value);
}

const TOPICS = rankedFrom(TOPIC_POOL, rng.int(180, 420));
const FEATURES = rankedFrom(FEATURE_POOL, rng.int(260, 640));

const SESSIONS: ResearchSession[] = Array.from({ length: 10 }, () => rng.int(4, 60 * 36))
  .sort((a, b) => a - b)
  .map((minutesAgo, i) => ({
    id: `session-${i}`,
    topic: rng.pick(TOPIC_POOL),
    user: fictionalUser(),
    startedAt: relativeTime(minutesAgo),
    items: rng.int(1, 9),
  }));

// ---- AI / provider health ----

const AI_TOTAL_REQUESTS = relabeled(USAGE.aiAnswers.stat, "AI Requests");
const AI_SUCCESS_RATE = rng.float(0.95, 0.99);
const AI_SUCCESSFUL_VALUE = Math.round(AI_TOTAL_REQUESTS.value * AI_SUCCESS_RATE);
const AI_FAILURES_VALUE = AI_TOTAL_REQUESTS.value - AI_SUCCESSFUL_VALUE;

const AI_SUCCESSFUL = statFromPeriods(
  "Successful Requests",
  AI_SUCCESSFUL_VALUE,
  Math.round(AI_SUCCESSFUL_VALUE * rng.float(0.9, 0.99)),
  AI_TOTAL_REQUESTS.trend.map((p) => ({ date: p.date, value: Math.round(p.value * AI_SUCCESS_RATE) }))
);
const AI_FAILURES = statFromPeriods(
  "Failures",
  AI_FAILURES_VALUE,
  Math.round(AI_FAILURES_VALUE * rng.float(0.85, 1.15)),
  AI_TOTAL_REQUESTS.trend.map((p) => ({ date: p.date, value: Math.max(0, Math.round(p.value * (1 - AI_SUCCESS_RATE))) })),
  false
);
const AI_AVG_MS = rng.int(780, 2100);
const AI_AVG_RESPONSE = statFromPeriods(
  "Avg Response Time",
  AI_AVG_MS,
  Math.round(AI_AVG_MS * rng.float(0.95, 1.1)),
  series(13, buildDailySeries(rng, 14, { base: AI_AVG_MS, trendPerDay: -2, noise: 0.08 })),
  false
);

const AI_PROVIDER_USAGE: ProviderUsage[] = [
  { name: "Gemini", sharePct: 38 },
  { name: "Groq", sharePct: 31 },
  { name: "Tavily", sharePct: 19 },
  { name: "YouTube", sharePct: 12 },
].map((p, i) => ({ name: p.name, sharePct: p.sharePct, requests: Math.round((AI_TOTAL_REQUESTS.value * p.sharePct) / 100), color: `var(--chart-cat-${i + 1})` }));

const AI_PROVIDER_STATUS: ProviderStatus[] = [
  { name: "Gemini", level: "warning", detail: "Nearing daily free-tier quota" },
  { name: "Groq", level: "good", detail: "Operational" },
  { name: "Tavily", level: "good", detail: "Operational" },
  { name: "YouTube", level: "good", detail: "Operational" },
];

const AI_GEMINI_QUOTA_PCT = rng.int(58, 88);

// ---- recent activity ----

const ACTIVITY_STATUS_POOL: ActivityRecord["status"][] = ["success", "success", "success", "success", "success", "success", "pending", "success", "failed", "success"];
const ACTIVITY_RECORDS: ActivityRecord[] = Array.from({ length: 14 }, () => rng.int(2, 60 * 20))
  .sort((a, b) => a - b)
  .map((minutesAgo, i) => ({
    id: `activity-${i}`,
    user: fictionalUser(),
    action: rng.pick(ACTION_POOL),
    topic: rng.pick(TOPIC_POOL),
    timestamp: relativeTime(minutesAgo),
    status: rng.pick(ACTIVITY_STATUS_POOL),
  }));

// ---- exported getters: pure reads of the precomputed data above, wrapped in a Promise so
// call sites already look exactly like they would against a real async DB call. ----

export async function getOverviewData(): Promise<OverviewData> {
  return {
    kpis: [
      KPI_TOTAL_USERS,
      USAGE.researchSessions.stat,
      USAGE.questionsAsked.stat,
      AI_TOTAL_REQUESTS,
      USAGE.researchSearches.stat,
      USAGE.documentsUploaded.stat,
    ],
    productUsage: [
      relabeledMini(USAGE.questionsAsked.mini, "Questions created"),
      relabeledMini(USAGE.branchesCreated.mini, "Branches created"),
      relabeledMini(USAGE.aiAnswers.mini, "AI answers"),
      relabeledMini(USAGE.summaries.mini, "Summaries"),
      relabeledMini(USAGE.debates.mini, "Debates"),
      relabeledMini(USAGE.researchSearches.mini, "Research searches"),
      relabeledMini(USAGE.youtubeSearches.mini, "YouTube searches"),
      relabeledMini(USAGE.documentsUploaded.mini, "Documents uploaded"),
    ],
    growth: growth90d,
    systemHealth: OVERVIEW_SYSTEM_HEALTH,
  };
}

export async function getUsersData(): Promise<UsersData> {
  return { stats: USERS_STATS, growth90d, newSignups90d: series(DAYS - 1, newSignupsDaily) };
}

export async function getResearchData(): Promise<ResearchData> {
  return {
    topics: TOPICS,
    features: FEATURES,
    sessions: SESSIONS,
    sourceSearches: relabeled(USAGE.researchSearches.stat, "Source Searches"),
    documentsProcessed: relabeled(USAGE.documentsUploaded.stat, "Documents Processed"),
  };
}

export async function getAiUsageData(): Promise<AiUsageData> {
  return {
    totalRequests: AI_TOTAL_REQUESTS,
    successful: AI_SUCCESSFUL,
    failures: AI_FAILURES,
    avgResponseMs: AI_AVG_RESPONSE,
    providerUsage: AI_PROVIDER_USAGE,
    providerStatus: AI_PROVIDER_STATUS,
    geminiQuotaPct: AI_GEMINI_QUOTA_PCT,
  };
}

export async function getActivityData(): Promise<ActivityRecord[]> {
  return ACTIVITY_RECORDS;
}

export async function getSystemHealthData(): Promise<SystemHealthItem[]> {
  return OVERVIEW_SYSTEM_HEALTH;
}

export async function getSettingsData(): Promise<ProviderConfig[]> {
  return [
    { name: "Gemini", envVar: "GEMINI_API_KEY", configured: Boolean(process.env.GEMINI_API_KEY) },
    { name: "Groq", envVar: "GROQ_API_KEY", configured: Boolean(process.env.GROQ_API_KEY) },
    { name: "Tavily", envVar: "TAVILY_API_KEY", configured: Boolean(process.env.TAVILY_API_KEY) },
    { name: "YouTube", envVar: "YOUTUBE_API_KEY", configured: Boolean(process.env.YOUTUBE_API_KEY) },
  ];
}
