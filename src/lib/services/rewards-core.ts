export const DEFAULT_REWARD_POINTS = {
  CHECK_IN: 10,
  SERVICE_CHECK_IN: 20,
  RSVP_HONORED: 2,
  TASK_COMPLETED: 5,
  NO_SHOW: -3,
} as const;

export type RewardSourceType =
  keyof typeof DEFAULT_REWARD_POINTS | "BADGE_BONUS" | "MANUAL_ADJUSTMENT";

export function rewardPoints(
  source: keyof typeof DEFAULT_REWARD_POINTS,
  config?: Record<string, unknown> | null,
) {
  const configured = config?.[source];
  return typeof configured === "number" && Number.isFinite(configured)
    ? Math.trunc(configured)
    : DEFAULT_REWARD_POINTS[source];
}

export function earnedBadgeKeys(input: {
  checkIns: number;
  serviceCheckIns: number;
  completedTasks: number;
}) {
  const keys: string[] = [];
  if (input.checkIns >= 1) keys.push("FIRST_CHECK_IN");
  if (input.serviceCheckIns >= 1) keys.push("FIRST_SERVICE");
  if (input.serviceCheckIns >= 10) keys.push("SERVICE_10");
  if (input.completedTasks >= 10) keys.push("TASK_FINISHER");
  return keys;
}
