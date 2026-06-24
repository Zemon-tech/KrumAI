/**
 * Simple in-memory rate limiter for single-user usage.
 * Tracks daily generation count and resets at midnight UTC.
 * For multi-user or persistent tracking, swap this for a database-backed solution.
 */

interface RateLimitState {
  count: number;
  date: string; // ISO date string (YYYY-MM-DD)
}

let state: RateLimitState = {
  count: 0,
  date: new Date().toISOString().split("T")[0],
};

function getMaxDaily(): number {
  const envLimit = process.env.MAX_DAILY_GENERATIONS;
  if (envLimit) {
    const parsed = parseInt(envLimit, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 50; // Default: 50 generations per day
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function checkRateLimit(): { allowed: boolean; remaining: number; limit: number } {
  const today = getTodayDate();
  const limit = getMaxDaily();

  // Reset counter if it's a new day
  if (state.date !== today) {
    state = { count: 0, date: today };
  }

  const remaining = Math.max(0, limit - state.count);
  return {
    allowed: state.count < limit,
    remaining,
    limit,
  };
}

export function incrementRateLimit(): void {
  const today = getTodayDate();

  // Reset if new day
  if (state.date !== today) {
    state = { count: 0, date: today };
  }

  state.count++;
}

export function getRateLimitStatus(): { count: number; limit: number; remaining: number; date: string } {
  const today = getTodayDate();
  const limit = getMaxDaily();

  if (state.date !== today) {
    return { count: 0, limit, remaining: limit, date: today };
  }

  return {
    count: state.count,
    limit,
    remaining: Math.max(0, limit - state.count),
    date: state.date,
  };
}
