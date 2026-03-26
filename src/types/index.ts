// ─── Dynamic Architecture ───

export type BlockType = 'wake' | 'body' | 'deep_work' | 'production' | 'reflection' | 'custom';
export type CustomInputType = 'toggle' | 'number' | 'text';

export interface DayBlock {
  id: string;             // Unique ID (e.g., 'wake-1', 'custom-reading')
  type: 'wake' | 'body' | 'deep_work' | 'production' | 'reflection' | 'custom';
  title: string;          // e.g., "WAKE SYSTEM", "READING"
  weight?: number; // importance weight (1.0 default)
  dwCount?: number; // specific to deep_work
  customType?: CustomInputType; // specific to custom
  
  // Phase 4 Adaptive System Properties
  meta?: {
    createdAt: number;
    source: 'template' | 'custom' | 'suggestion';
    locked?: boolean;
  };
  constraints?: {
    min?: number;
    max?: number;
    preferred?: number;
  };
}

export type DayTemplate = DayBlock[];

export interface TemplateDefinition {
  id: string;
  type: 'builtin' | 'custom';
  name: string;
  structure: DayTemplate;
  systemType?: 'domination' | 'balanced' | 'recovery' | 'custom';
  version?: number;
  createdAt?: number;
  
  // Phase 4 System Memory
  performance?: {
    avgScore: number;
    usageCount: number;
    lastUsed: number;
  };
}

export interface DailyValues {
  custom?: Record<string, string | number | boolean>;
  modeName?: string;
  reflection?: ReflectionData;
  bodyHabits?: Record<string, number | boolean | string>; // habitId → value
  [key: string]: any;
}

export interface ReflectionData {
  // ─── Legacy (backward compat) ───
  deepWork?: "All" | "Partial" | "None";
  tasks?: "Yes" | "Mostly" | "No";
  body?: "Yes" | "No";
  energy?: "Low" | "Stable" | "High";
  followUpReason?: string;
  note?: string;

  // Phase 5 — Truth Engine Structured Inputs
  deepWorkFailure?: 'DISTRACTION' | 'LOW_ENERGY' | 'OVERLOAD' | 'NO_CLARITY';
  energyDropReason?: 'SLEEP' | 'STRESS' | 'DIET' | 'UNKNOWN';

  // Phase 6 — Task ↔ Reflection Link
  taskFailure?: {
    taskId: string;
    reason: 'DISTRACTION' | 'OVERLOAD' | 'TIME' | 'UNCLEAR';
  };

  // ─── Realistic Reflection (Phase 7) ───

  // Q1: "Did you follow your planned structure today?"
  planAdherence?: 'FULLY' | 'MOSTLY' | 'PARTIALLY' | 'NOT_AT_ALL';

  // Q2: "What was your biggest obstacle?"
  primaryObstacle?: 'DISTRACTION' | 'FATIGUE' | 'OVERLOAD' | 'UNCLEAR_PRIORITIES'
                   | 'EXTERNAL_INTERRUPTION' | 'PROCRASTINATION' | 'NONE';

  // Q3: "Rate your discipline today" (1-10)
  disciplineScore?: number;

  // Q4: "What was your single biggest win today?"
  biggestWin?: string;

  // Q5: "What would you change about today?"
  wouldChange?: string;

  // Q6: "Tomorrow's #1 non-negotiable"
  tomorrowNonNegotiable?: string;
}

// ─── Body Habits (dynamic body tracking for Daily page) ───

export interface BodyHabit {
  id: string;
  name: string;
  type: 'toggle' | 'rating' | 'duration';
  icon: string;
  isActive: boolean;
  order: number;
}

// ─── Biometrics (Separate Lab — not connected to scoring) ───

export interface BiometricProfile {
  heightCm: number;
  weightKg: number;
  age: number;
  gender: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'intense';
  goalType: 'cut' | 'maintain' | 'bulk';
  bodyFatPercent?: number;
}

export interface WeightLogEntry {
  date: string;        // YYYY-MM-DD
  weightKg: number;
  bodyFatPercent?: number;
  note?: string;
}

export interface WorkoutLogEntry {
  date: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'sport' | 'other';
  name: string;
  durationMin: number;
  intensity: number;   // 1-10
  caloriesBurned?: number;
  note?: string;
}

// ─── Daily Log Entry (maps to Template.md) ───

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  isBuilt?: boolean;

  // Dynamic Structure
  structure_snapshot?: DayTemplate;
  dynamic_values?: DailyValues;

  // Day Information (Legacy fields preserved temporarily or optionally)
  dayOfWeek?: string;
  sleepTime?: string;
  wakeTime?: string;
  totalSleepHours?: number;
  efficiencyRating?: number; // 1-10 (self-rated efficiency)
  energyLevel?: number; // @deprecated — use efficiencyRating (kept for backward compat)

  // 1. Wake Anchor
  actualWakeTime?: string;
  sunlightExposure?: boolean;
  hydration?: boolean;
  morningDistraction?: 0 | 1 | 2;
  wakeNotes?: string;

  // 2. Body System
  gymDuration?: string;
  jawlineWorkout?: boolean;
  gymTraining?: 'completed' | 'partial' | 'skipped' | 'none';
  workoutType?: ('strength' | 'cardio' | 'mobility')[];
  gymIntensity?: number; // 1-10
  energyAfterGym?: number; // 1-10
  bodyNotes?: string;

  // 3. Deep Work
  dw1PlannedTask?: string;
  dw1ActualTask?: string;
  dw1FocusQuality?: number; // 1-10
  dw1Interruptions?: 0 | 1 | 2;
  dw1Output?: string;
  dw1Notes?: string;
  
  // 4. Recovery Window
  recoveryActivities?: ('walk' | 'sunlight' | 'food' | 'relaxation')[];
  mentalResetQuality?: number; // 1-10

  // 5. Deep Work Engine 2
  dw2PrimaryTask?: string;
  dw2SecondaryTask?: string;
  dw2FocusQuality?: number; // 1-10
  dw2Output?: string;
  dw2Notes?: string;

  // For dynamic deep work
  dwQualities?: number[];

  // 6. Flexible Module A
  flexAType?: 'language' | 'reading' | 'research' | 'skill' | 'other' | '';
  flexADuration?: string;
  flexAQuality?: number; // 1-10

  // 7. Flexible Module B
  flexBType?: 'exploration' | 'experiment' | 'side-project' | 'creativity' | '';
  flexBDuration?: string;
  flexBOutput?: string;

  // 8. Production Block
  productionOutput?: string;
  productionType?: ('coding' | 'writing' | 'building' | 'content' | 'business')[];
  outputScore?: number; // 1-10
  goalProgress?: number; // 1-10

  // 9. Reflection
  dailyLessons?: string;
  mistakesToday?: string;
  whatWorkedWell?: string;
  improvementForTomorrow?: string;

  // 10. Reset / Free Buffer
  resetActivities?: ('social' | 'hobby' | 'relaxation' | 'family')[];
  recoveryScore?: number; // 1-10

  // 11. IFZ14 Domain Tracker
  domainBody?: number; // 1-10
  domainMind?: number;
  domainIntelligence?: number;
  domainSkills?: number;
  domainProduct?: number;
  domainMoney?: number;
  domainSocial?: number;
  domainEnvironment?: number;

  // 12. Daily Evolution Score (auto-calculated)
  deepWorkScore?: number;
  physicalScore?: number;
  learningScore?: number;
  productionScore?: number;
  averageScore?: number;

  // 13. Tomorrow Setup
  tomorrowPriorities?: string[];
  tomorrowDeepWorkMission?: string;
  tomorrowGymPlan?: string;
  tomorrowSleepTarget?: string;

  // Phase 5 — Truth Engine Scores
  executionScore?: number;   // 0-100
  conditionScore?: number;   // 0-100
  integrityScore?: number;   // 0-100
  systemScore?: number;      // weighted composite 0-100

  // Meta
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Task (Phase 6 — Execution Intelligence) ───

export type TaskEnergyType = 'deep' | 'light' | 'quick';
export type TaskStatus = 'pending' | 'upcoming' | 'scheduled' | 'active' | 'delayed' | 'done' | 'skipped';

export interface TaskScoreImpact {
  expected: number;
  actual?: number;
}

export interface Task {
  id: string;
  title: string;
  priority: 'HIGH' | 'MED' | 'LOW';

  // Phase 6 execution fields
  estimatedTime: number;           // minutes
  completedTime: number;           // minutes
  energyType: TaskEnergyType;
  status: TaskStatus;
  linkedSessionId?: string;        // links to a DeepWorkSession
  goalId?: string;                 // links to a Goal
  scoreImpact?: TaskScoreImpact;

  // Legacy compat
  completed: boolean;
  createdAt: string;
  completedAt?: string;

  // Auto-split tracking
  parentTaskId?: string;
  subtaskIds?: string[];

  // Phase 7 — Task Intelligence
  preferredTime?: 'morning' | 'afternoon' | 'night';
  energyDemand?: 'low' | 'medium' | 'high';
  splitable?: boolean;
  deadline?: string;          // ISO date string
  scheduledStart?: string;    // ISO datetime for delay detection
}

// ─── Goal ───

export type GoalTargetType = 'task_count' | 'time' | 'milestone';

export interface Goal {
  id: string;
  title: string;

  // Tracking (stored)
  targetType: GoalTargetType;
  targetValue: number;          // total tasks, total minutes, or 100 for milestone
  linkedTaskIds: string[];
  trackDeepWork?: boolean;      // for time-based goals that read from dailyStore
  milestoneCompleted?: boolean; // explicit flag for milestone type
  deadline?: string;            // ISO date string

  // Meta (stored)
  createdAt: string;
}

/**
 * Computed goal data — NEVER persisted.
 * Derived at runtime by goalEngine from tasks + dailyEntries.
 */
export interface GoalComputed {
  currentValue: number;
  progress: number;             // 0–100
  contributionScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiredPace: number | null;
  pressure: number; // dynamically computed execution driver  // units per day, or null if no deadline
}

/** Goal + its runtime-computed fields, used by UI components. */
export type GoalWithComputed = Goal & GoalComputed;

// ─── Engine Outputs ───

export type SystemState = 'CRITICAL' | 'LOW' | 'STABLE' | 'STRONG' | 'PEAK';
export type Trend = 'RISING' | 'DECLINING' | 'STABLE' | 'VOLATILE';

export interface ScoreResult {
  score: number;
  state: SystemState;
}

export interface PatternResult {
  trend: Trend;
  description: string;
}

export interface StreakData {
  gym: number;
  deepWork: number;
  earlyWake: number;
  highScore: number;
}

export interface RiskSignal {
  level: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
  signals: string[];
}

export interface Insight {
  text: string;
  type: 'positive' | 'neutral' | 'warning';
}

export type SuggestionTemplateSystem = 'domination' | 'balanced' | 'recovery' | 'execution';

export interface SuggestionBase {
  id: string;
  message: string;
  impact: number;
  priority: 'high' | 'medium' | 'low';

  // Phase 4 Causality Engine
  confidence: 'High' | 'Medium' | 'Low';
  causalPath?: string;
}

export interface SuggestionAddBlockAction {
  actionType: 'add_block';
  actionPayload: {
    blockType: DayBlock['type'];
    customName?: string;
    customType?: CustomInputType;
  };
}

export interface SuggestionSwitchTemplateAction {
  actionType: 'switch_template';
  actionPayload: {
    systemType: SuggestionTemplateSystem;
  };
}

export interface SuggestionAdjustWeightAction {
  actionType: 'adjust_weight';
  actionPayload: {
    blockId: string;
    newWeight: number;
  };
}

export interface SuggestionRemoveBlockAction {
  actionType: 'remove_block';
  actionPayload: {
    blockType: DayBlock['type'];
  };
}

export interface SuggestionNoAction {
  actionType?: undefined;
  actionPayload?: undefined;
}

export type Suggestion =
  | (SuggestionBase & SuggestionAddBlockAction)
  | (SuggestionBase & SuggestionSwitchTemplateAction)
  | (SuggestionBase & SuggestionAdjustWeightAction)
  | (SuggestionBase & SuggestionRemoveBlockAction)
  | (SuggestionBase & SuggestionNoAction);

// ─── Helpers ───

export function createEmptyEntry(date: string, template?: DayTemplate): DailyEntry {
  const now = new Date().toISOString();
  return {
    id: date,
    date,
    structure_snapshot: template,
    dynamic_values: {},
    dayOfWeek: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
    sleepTime: '',
    wakeTime: '',
    totalSleepHours: 0,
    efficiencyRating: 0,
    actualWakeTime: '',
    sunlightExposure: false,
    hydration: false,
    morningDistraction: 0,
    wakeNotes: '',
    gymDuration: '',
    jawlineWorkout: false,
    gymTraining: 'skipped',
    workoutType: [],
    gymIntensity: 0,
    energyAfterGym: 0,
    bodyNotes: '',
    dw1PlannedTask: '',
    dw1ActualTask: '',
    dw1FocusQuality: 0,
    dw1Interruptions: 0,
    dw1Output: '',
    dw1Notes: '',
    recoveryActivities: [],
    mentalResetQuality: 0,
    dw2PrimaryTask: '',
    dw2SecondaryTask: '',
    dw2FocusQuality: 0,
    dw2Output: '',
    dw2Notes: '',
    flexAType: '',
    flexADuration: '',
    flexAQuality: 0,
    flexBType: '',
    flexBDuration: '',
    flexBOutput: '',
    productionOutput: '',
    productionType: [],
    outputScore: 0,
    goalProgress: 0,
    dailyLessons: '',
    mistakesToday: '',
    whatWorkedWell: '',
    improvementForTomorrow: '',
    resetActivities: [],
    recoveryScore: 0,
    domainBody: 0,
    domainMind: 0,
    domainIntelligence: 0,
    domainSkills: 0,
    domainProduct: 0,
    domainMoney: 0,
    domainSocial: 0,
    domainEnvironment: 0,
    deepWorkScore: 0,
    physicalScore: 0,
    learningScore: 0,
    productionScore: 0,
    averageScore: 0,
    tomorrowPriorities: ['', '', ''],
    tomorrowDeepWorkMission: '',
    tomorrowGymPlan: '',
    tomorrowSleepTarget: '',
    executionScore: 0,
    conditionScore: 0,
    integrityScore: 0,
    systemScore: 0,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Auto-Day Engine ───

export type DayType = 'DOMINATION' | 'BUILD' | 'RECOVERY' | 'SALVAGE';

export type FailureTag = 'DISTRACTION' | 'LOW_ENERGY' | 'OVERLOAD' | 'NO_CLARITY';

export interface StateAnalysis {
  avgDeepWorkQuality: number;
  avgSleep: number;
  avgEnergy: number;
  gymConsistency: number;       // 0-1 ratio
  scoreTrend: Trend;
  avgScore: number;
  last3DayLoad: number;
  deepWorkYesterday: boolean;
  consecutiveDeclines: number;
  recentScores: number[];
  failureTags: FailureTag[];
  dataCompleteness: number;     // 0-1 how much historical data exists
}

export interface CapacityResult {
  maxDeepWorkSessions: number;
  expectedOutput: number;       // 0-100
  gymIntensity: 'rest' | 'light' | 'moderate' | 'intense';
  sleepTarget: number;
}

export interface DeepWorkSession {
  id: string;                   // unique session id
  taskId?: string;              // linked task id
  taskTitle?: string;           // string fallback or task title
  duration: number;             // minutes
  focus: number;                // 0-100
  quality?: number;             // legacy compat alias for focus
  status: 'pending' | 'active' | 'done';
  
  // scheduling context
  startTime?: string;           // HH:MM
  breakAfter?: number;          // minutes

  // Phase 6.9 execution tracking
  isCompleted?: boolean;        // prevents double time-counting

  // Phase 7 timeline control
  isLocked?: boolean;           // user edited → engine won't override
  autoGenerated?: boolean;      // marks auto-day created sessions
}

export interface GymPlan {
  intensity: 'rest' | 'light' | 'moderate' | 'intense';
  notes: string;
}

export interface AutoDayPreFilled {
  wake?: { time: string; sleep: number };
  body?: { gym: boolean; energy: number; intensity: string };
  deepWork?: { sessions: DeepWorkSession[] };
  production?: { target: number };
  custom?: Record<string, string | number | boolean>;
}

export interface AutoDayPrefillValues {
  wake?: AutoDayPreFilled['wake'];
  body?: AutoDayPreFilled['body'];
  deepWork?: AutoDayPreFilled['deepWork'];
  production?: AutoDayPreFilled['production'];
  custom?: AutoDayPreFilled['custom'];
  dwSessions?: Array<Partial<DeepWorkSession> & { quality?: number }>;
  dwQualities?: number[];
}

export interface PredictedOutcome {
  expectedScore: number;
  trend: 'RISING' | 'STABLE' | 'DECLINING';
}

export interface MinimumGuarantee {
  deepWorkSessions: number;
  gymIntensity: 'light' | 'rest';
}

export interface AutoDayPlan {
  dayType: DayType;
  wakeTime: string;
  sleepTarget: number;
  capacity: CapacityResult;
  deepWorkSessions: DeepWorkSession[];
  gymPlan: GymPlan;
  productionTarget: number;
  forceReflection: boolean;
  confidence: number;           // 0-1
  prediction: PredictedOutcome;
  minimum: MinimumGuarantee;
  template: DayTemplate;
  modeName: string;
  preFilled: AutoDayPreFilled;
  topPressureGoals?: (Goal & GoalComputed)[]; // System warnings for UI
  
  // Phase 4 Autonomous System Output
  adaptationLogs?: string[];
}

export interface AdaptiveQuestion {
  id: string;
  title: string;
  type: 'slider' | 'select' | 'text';
  options?: string[];
  min?: number;
  max?: number;
  reason: string;
}

export type AutoDayPhase = 'idle' | 'questions' | 'computing' | 'preview' | 'locked' | 'recalibrating' | 'failed';

// ─── Phase 8 Causation Engine Types ───

export interface CausalInsight {
  cause: 'sleep' | 'energy' | 'deepWork' | 'distraction' | 'overload' | string;
  effect: 'score' | 'deepWork' | 'integrity' | string;
  lag: 0 | 1;           // 0 = same day, 1 = affects next day
  impact: number;       // e.g., +18%, -20%
  confidence: number;   // 0–1
  type: 'boost' | 'harm';
}

export interface FailureAnalysis {
  topFailure: string;   // e.g., 'DISTRACTION'
  frequency: number;    // 0–1
  impact: number;       // e.g., -20
}

export interface PerformanceDriver {
  factor: string;
  impact: number;       // +25, -10
}

export type CausalChain = string[]; // e.g., ['sleep', 'energy', 'deepWork', 'score']

export interface PredictiveState {
  expectedScore: number;
  trend: 'RISING' | 'STABLE' | 'FALLING';
}

export interface AnalyticsHistory {
  id: string;               // uuid
  date: string;             // YYYY-MM-DD
  insightKey: string;       // "sleep→score|lag1"
  confidence: number;       // engine's confidence when predicted
  predictedImpact: number;  // expected score delta
  actualOutcome?: number;   // next day delta (filled later)
  error?: number;           // |predicted - actual|
}
