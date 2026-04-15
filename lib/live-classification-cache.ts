/**
 * lib/live-classification-cache.ts
 *
 * Shared in-memory cache for embedding-classified live reviews.
 * Written by process-answer at submission time, read by classifyReview
 * in analysis.ts and continuous-learning.ts.
 *
 * Key: sha256(review_text)[0..16]   (same format as topic-classifications.json)
 * Value: string[] of topicIds
 */

declare global {
  // eslint-disable-next-line no-var
  var _liveClassificationCache: Map<string, string[]> | undefined;
}

export const liveClassificationCache: Map<string, string[]> =
  globalThis._liveClassificationCache ??
  (globalThis._liveClassificationCache = new Map());
