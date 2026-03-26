import type { BiometricProfile, WeightLogEntry, WorkoutLogEntry } from '../types';

// ─── Constants ───

const ACTIVITY_MULTIPLIERS: Record<BiometricProfile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  intense: 1.9,
};

const GOAL_OFFSETS: Record<BiometricProfile['goalType'], number> = {
  cut: -500,
  maintain: 0,
  bulk: 300,
};

// ─── Core Calculations ───

/** Mifflin-St Jeor BMR (most clinically accurate) */
export function calcBMR(profile: BiometricProfile): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return Math.round(profile.gender === 'male' ? base + 5 : base - 161);
}

/** Total Daily Energy Expenditure */
export function calcTDEE(bmr: number, activityLevel: BiometricProfile['activityLevel']): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/** Goal-adjusted calorie target */
export function calcCalorieTarget(tdee: number, goalType: BiometricProfile['goalType']): number {
  return Math.max(1200, tdee + GOAL_OFFSETS[goalType]);
}

/** Macro split (grams) based on goal */
export function calcMacroSplit(calories: number, goalType: BiometricProfile['goalType'], weightKg: number) {
  // Protein: higher for cut, moderate for bulk
  const proteinPerKg = goalType === 'cut' ? 2.2 : goalType === 'bulk' ? 1.8 : 2.0;
  const proteinGrams = Math.round(proteinPerKg * weightKg);
  const proteinCals = proteinGrams * 4;

  // Fat: 25-30% of calories
  const fatPercent = goalType === 'cut' ? 0.25 : 0.28;
  const fatCals = Math.round(calories * fatPercent);
  const fatGrams = Math.round(fatCals / 9);

  // Carbs: remainder
  const carbCals = Math.max(0, calories - proteinCals - fatCals);
  const carbGrams = Math.round(carbCals / 4);

  return { protein: proteinGrams, carbs: carbGrams, fat: fatGrams };
}

/** BMI calculation */
export function calcBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/** BMI category label */
export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'UNDERWEIGHT';
  if (bmi < 25) return 'NORMAL';
  if (bmi < 30) return 'OVERWEIGHT';
  return 'OBESE';
}

/** Estimated lean mass (if body fat % provided) */
export function calcLeanMass(weightKg: number, bodyFatPercent?: number): number | null {
  if (bodyFatPercent == null || bodyFatPercent <= 0 || bodyFatPercent >= 100) return null;
  return Math.round(weightKg * (1 - bodyFatPercent / 100) * 10) / 10;
}

// ─── Weight Trend Analysis ───

/** 7-day moving average of weight */
export function calcWeightTrend(logs: WeightLogEntry[]): { date: string; avg: number }[] {
  if (logs.length === 0) return [];
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const result: { date: string; avg: number }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const window = sorted.slice(Math.max(0, i - 6), i + 1);
    const avg = window.reduce((s, e) => s + e.weightKg, 0) / window.length;
    result.push({ date: sorted[i].date, avg: Math.round(avg * 10) / 10 });
  }
  return result;
}

/** Weekly weight delta */
export function calcWeeklyDelta(logs: WeightLogEntry[]): number | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted[sorted.length - 1].weightKg;

  // Find entry closest to 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const targetDate = sevenDaysAgo.toISOString().slice(0, 10);

  let closest = sorted[0];
  for (const log of sorted) {
    if (log.date <= targetDate) closest = log;
    else break;
  }

  return Math.round((recent - closest.weightKg) * 10) / 10;
}

// ─── Workout Stats ───

export function calcWorkoutStats(logs: WorkoutLogEntry[], days: number = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = logs.filter(l => l.date >= cutoffStr);
  const totalMinutes = recent.reduce((s, l) => s + l.durationMin, 0);
  const avgIntensity = recent.length > 0
    ? Math.round(recent.reduce((s, l) => s + l.intensity, 0) / recent.length * 10) / 10
    : 0;
  const totalCalories = recent.reduce((s, l) => s + (l.caloriesBurned || estimateCalories(l)), 0);

  return {
    sessions: recent.length,
    totalMinutes,
    avgIntensity,
    totalCalories: Math.round(totalCalories),
  };
}

/** Rough calorie estimation from workout */
function estimateCalories(log: WorkoutLogEntry): number {
  // MET-based rough estimate: intensity maps to ~3-12 METs
  const met = 3 + (log.intensity / 10) * 9;
  // Assume 70kg if no weight context; calories = MET × weight × hours
  return Math.round(met * 70 * (log.durationMin / 60));
}
