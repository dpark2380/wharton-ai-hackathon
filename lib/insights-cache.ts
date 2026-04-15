/**
 * lib/insights-cache.ts
 *
 * Shared globalThis cache for AI-generated insights.
 * Lives on globalThis so it survives HMR and is shared across module instances.
 * Call invalidateInsightsCache(propertyId) whenever a new review is submitted.
 */

export interface InsightsResult {
  summary: string;
  issues: string;
  strengths: string;
  trend: string;
}

declare global {
  // eslint-disable-next-line no-var
  var _insightsCache: Map<string, InsightsResult> | undefined;
}

export const insightsCache: Map<string, InsightsResult> =
  globalThis._insightsCache ?? (globalThis._insightsCache = new Map());

/** Clears all cached insights for a property (property-level + all topic-level). */
export function invalidateInsightsCache(propertyId: string): void {
  for (const key of insightsCache.keys()) {
    if (key.startsWith(`${propertyId}:`)) {
      insightsCache.delete(key);
    }
  }
}

export function insightsCacheKey(propertyId: string, topicId?: string): string {
  return `${propertyId}:${topicId ?? ""}`;
}
