function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive-day streak counting back from today (or yesterday, so a
 * streak isn't broken just because today's find hasn't happened yet).
 * `sortedDaysDesc` must be distinct 'YYYY-MM-DD' strings, most recent first.
 */
export function computeStreak(sortedDaysDesc: string[]): number {
  if (sortedDaysDesc.length === 0) return 0;

  const today = new Date();
  const todayStr = toDayString(today);
  const yesterdayStr = toDayString(new Date(today.getTime() - 86_400_000));

  let cursor: string;
  if (sortedDaysDesc[0] === todayStr) {
    cursor = todayStr;
  } else if (sortedDaysDesc[0] === yesterdayStr) {
    cursor = yesterdayStr;
  } else {
    return 0;
  }

  let streak = 0;
  const daySet = new Set(sortedDaysDesc);
  let cursorDate = new Date(`${cursor}T00:00:00.000Z`);

  while (daySet.has(toDayString(cursorDate))) {
    streak += 1;
    cursorDate = new Date(cursorDate.getTime() - 86_400_000);
  }

  return streak;
}
