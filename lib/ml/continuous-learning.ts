/**
 * lib/ml/continuous-learning.ts
 *
 * Nightly batch continuous learning pipeline.
 *
 * Learns two sets of weights per property from guest rating signals:
 *
 * 1. TOPIC IMPORTANCE WEIGHTS
 *    How much each topic drives overall guest satisfaction.
 *    Method: Pearson correlation between per-topic text sentiment and
 *    rating.overall across reviews that mention the topic.
 *    Topics with higher correlation get higher importance in the KHS.
 *
 * 2. SENTIMENT BLEND WEIGHTS
 *    Optimal mix of S1 (Expedia structured sub-rating) vs S2 (keyword text
 *    sentiment) per topic. Method: closed-form OLS, finds α that minimises
 *    Σ(α·S1 + (1-α)·S2 - normalized_overall)².
 *
 * Both use Bayesian shrinkage toward defaults when data is sparse:
 *   final = (n / (n + PRIOR_STRENGTH)) × learned + (PRIOR_STRENGTH / (n + PRIOR_STRENGTH)) × default
 *
 * Results are persisted to lib/learned-weights.json and cached in globalThis.
 */

import { Review, parseReviewDate } from "@/lib/data";
import { TOPICS, classifyText } from "@/lib/topics";
import { liveClassificationCache } from "@/lib/live-classification-cache";
import { checkTextQuality } from "@/lib/quality";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_STRUCTURED_WEIGHT = 0.55; // S1
const DEFAULT_TEXT_WEIGHT = 0.45;       // S2
const PRIOR_STRENGTH = 20;              // pseudo-count, need ~20 reviews to move off prior
const MIN_REVIEWS_FOR_LEARNING = 3;     // skip topic if fewer than this many mentions
const WEIGHTS_FILE = path.join(process.cwd(), "lib", "learned-weights.json");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TopicImportance {
  topicId: string;
  topicLabel: string;
  weight: number;           // normalised importance (0-1), sums to 1 across relevant topics
  defaultWeight: number;    // 1/n for n relevant topics
  delta: number;            // weight - defaultWeight (+ve = more important than default)
  reviewCount: number;
  correlation: number;      // raw Pearson r (before shrinkage)
}

export interface SentimentBlend {
  topicId: string;
  topicLabel: string;
  structuredWeight: number;        // α: weight on S1 (0-1)
  textWeight: number;              // 1-α: weight on S2 (0-1)
  defaultStructuredWeight: number; // 0.55
  delta: number;                   // shift in structured weight vs default
  reviewCount: number;
  hasStructuredData: boolean;      // false if topic has no ratingKeys
}

export interface TopicScoreWeights {
  coverageWeight: number;   // β for coverage  (default 0.35)
  freshnessWeight: number;  // β for freshness (default 0.35)
  sentimentWeight: number;  // β for hybrid sentiment (default 0.30)
}

export interface LearnedWeights {
  propertyId: string;
  topicImportance: TopicImportance[];
  sentimentBlend: SentimentBlend[];
  topicScoreWeights: TopicScoreWeights;
  // Coverage model — learned from data rather than hardcoded
  saturationThreshold: number;   // effective review count at which coverage saturates (default 10)
  reviewAlignmentWeight: number; // α: how much to weight text–rating alignment vs heuristic quality (default 0.6)
  reviewsUsed: number;
  trainedAt: string;
  previousTrainedAt: string | null;
}

// ── Persistence ───────────────────────────────────────────────────────────────

let _fileCache: Record<string, LearnedWeights> | null = null;

function loadWeightsFile(): Record<string, LearnedWeights> {
  if (_fileCache !== null) return _fileCache;
  try {
    _fileCache = JSON.parse(fs.readFileSync(WEIGHTS_FILE, "utf-8")) as Record<string, LearnedWeights>;
  } catch {
    _fileCache = {};
  }
  return _fileCache!;
}

function saveWeightsFile(data: Record<string, LearnedWeights>): void {
  _fileCache = data;
  try {
    fs.writeFileSync(WEIGHTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save learned-weights.json:", err);
  }
}

// ── In-memory cache ───────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _learnedWeightsCache: Map<string, LearnedWeights> | undefined;
}

const learnedWeightsCache: Map<string, LearnedWeights> =
  globalThis._learnedWeightsCache ?? (globalThis._learnedWeightsCache = new Map());

export function getLearnedWeights(propertyId: string): LearnedWeights | null {
  // Check in-memory cache first
  if (learnedWeightsCache.has(propertyId)) {
    return learnedWeightsCache.get(propertyId)!;
  }
  // Fall through to file
  const file = loadWeightsFile();
  if (file[propertyId]) {
    learnedWeightsCache.set(propertyId, file[propertyId]);
    return file[propertyId];
  }
  return null;
}

// ── AI classification cache (mirrors lib/analysis.ts) ────────────────────────

let _aiClassifications: Record<string, string[]> | null = null;

function getAiClassifications(): Record<string, string[]> {
  if (_aiClassifications !== null) return _aiClassifications;
  try {
    const filePath = path.join(process.cwd(), "lib", "topic-classifications.json");
    _aiClassifications = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, string[]>;
  } catch {
    _aiClassifications = {};
  }
  return _aiClassifications!;
}

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

function classifyReview(text: string): Set<string> {
  const hash = hashText(text);

  // 1. AI GPT file cache (historical reviews)
  const cache = getAiClassifications();
  if (cache[hash]) return new Set(cache[hash]);

  // 2. Embedding-classified live reviews
  if (liveClassificationCache.has(hash)) {
    return new Set(liveClassificationCache.get(hash)!);
  }

  // 3. Keyword matching, only if embedding API failed at submission
  return classifyText(text);
}

// ── Sentiment scoring (mirrors lib/analysis.ts word lists) ───────────────────

const POS_WORDS = [
  "great", "excellent", "amazing", "wonderful", "fantastic", "loved", "perfect",
  "good", "nice", "lovely", "outstanding", "superb", "best", "clean", "comfortable",
  "helpful", "friendly", "beautiful", "delicious", "spacious", "modern", "recommend",
];
const NEG_WORDS = [
  "bad", "poor", "terrible", "awful", "horrible", "worst", "dirty", "rude",
  "disappointing", "disgusting", "broken", "noisy", "stained", "cold", "slow",
  "unfriendly", "unhelpful", "cramped", "outdated", "overpriced", "smelly", "avoid",
];

function reviewTextSentiment(text: string): number {
  const lower = text.toLowerCase();
  let pos = 0, neg = 0;
  for (const w of POS_WORDS) if (lower.includes(w)) pos++;
  for (const w of NEG_WORDS) if (lower.includes(w)) neg++;
  const total = pos + neg;
  if (total === 0) return 0.5;
  return 0.1 + (pos / total) * 0.8;
}

// ── Pearson correlation ───────────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < MIN_REVIEWS_FOR_LEARNING) return 0;

  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den < 1e-10 ? 0 : num / den;
}

// ── OLS closed-form sentiment blend ──────────────────────────────────────────
//
// Minimise Σ(α·S1 + (1-α)·S2 - y)²
// = Σ(α(S1-S2) + S2 - y)²
//
// d/dα = 0 → α* = Σ((y-S2)(S1-S2)) / Σ((S1-S2)²)

function olsBlend(s1s: number[], s2s: number[], ys: number[]): number {
  let num = 0, den = 0;
  for (let i = 0; i < s1s.length; i++) {
    const diff = s1s[i] - s2s[i];
    num += (ys[i] - s2s[i]) * diff;
    den += diff * diff;
  }
  if (Math.abs(den) < 1e-8) return DEFAULT_STRUCTURED_WEIGHT;
  const alpha = num / den;
  return Math.max(0.1, Math.min(0.9, alpha)); // clamp to [0.1, 0.9]
}

// ── Bayesian shrinkage ────────────────────────────────────────────────────────

function shrink(learned: number, prior: number, n: number): number {
  const trust = n / (n + PRIOR_STRENGTH);
  return trust * learned + (1 - trust) * prior;
}

// ── Coverage saturation threshold learning ────────────────────────────────────
//
// For each topic with enough reviews, we simulate adding them one by one in
// chronological order and track the running mean sentiment. We find the first
// k where the last STABILITY_WINDOW consecutive additions each changed the mean
// by less than STABILITY_EPSILON — this is the stabilisation point for that
// topic. The median across all topics is the learned saturation threshold.
//
// Intuition: a high-volume hotel stabilises faster (lower threshold); a boutique
// with noisy, inconsistent reviews needs more data before the mean settles.

const DEFAULT_SATURATION    = 10;
const STABILITY_EPSILON     = 0.03; // change in running mean < this → stable
const STABILITY_WINDOW      = 3;    // must hold for this many consecutive additions
const MIN_REVIEWS_THRESHOLD = 8;    // need at least this many to detect stabilisation

function learnSaturationThreshold(
  processed: Array<{ review: Review; topics: Set<string>; textSentiment: number }>
): number {
  const stabilisationPoints: number[] = [];

  for (const topic of TOPICS) {
    const mentioning = processed.filter((p) => p.topics.has(topic.id));
    if (mentioning.length < MIN_REVIEWS_THRESHOLD) continue;

    // Chronological order — simulate a manager watching reviews accumulate
    const sorted = [...mentioning].sort(
      (a, b) =>
        parseReviewDate(a.review.acquisition_date).getTime() -
        parseReviewDate(b.review.acquisition_date).getTime()
    );

    // Running means
    let runningSum = 0;
    const runningMeans: number[] = [];
    for (const p of sorted) {
      runningSum += p.textSentiment;
      runningMeans.push(runningSum / runningMeans.length + 1);
    }

    // Find first k where the last STABILITY_WINDOW deltas are all < EPSILON
    let stabilisedAt = sorted.length; // default: never stabilised within the window
    for (let k = STABILITY_WINDOW; k < runningMeans.length; k++) {
      let stable = true;
      for (let w = 1; w <= STABILITY_WINDOW; w++) {
        if (Math.abs(runningMeans[k - w + 1] - runningMeans[k - w]) >= STABILITY_EPSILON) {
          stable = false;
          break;
        }
      }
      if (stable) { stabilisedAt = k + 1; break; } // 1-indexed count
    }

    stabilisationPoints.push(stabilisedAt);
  }

  if (stabilisationPoints.length === 0) return DEFAULT_SATURATION;

  // Median stabilisation point across topics
  const sortedPts = [...stabilisationPoints].sort((a, b) => a - b);
  const median = sortedPts[Math.floor(sortedPts.length / 2)];

  // Bayesian shrinkage toward default (10)
  // Use topic count × 2 as pseudo-observations (more topics = more confident)
  const n = stabilisationPoints.length * 2;
  const learned = shrink(median, DEFAULT_SATURATION, n);

  return Math.round(Math.max(3, Math.min(30, learned)));
}

// ── Review alignment weight learning ─────────────────────────────────────────
//
// For reviews that cover topics with structured sub-ratings (e.g. roomcleanliness
// for Cleanliness), we can measure how well the text sentiment agrees with the
// star rating: alignment = 1 − |textSentiment − structuredRating|.
//
// We also have a heuristic quality score from checkTextQuality (based on
// lexical diversity, length, etc.). We use 1D OLS to find the weight α such
// that α×alignment + (1−α)×heuristic best predicts rating.overall/5.
//
// α > 0.5: alignment is a stronger signal than the heuristic
// α < 0.5: heuristic is more reliable (e.g. noisy structured ratings)

const DEFAULT_ALIGNMENT_WEIGHT = 0.6; // lean toward alignment when data is thin
const MIN_TRIPLES_FOR_LEARNING = 10;

function learnReviewAlignmentWeight(
  processed: Array<{ review: Review; topics: Set<string>; textSentiment: number; overallNorm: number }>
): number {
  const triples: { alignment: number; heuristic: number; y: number }[] = [];

  for (const topic of TOPICS) {
    if (topic.ratingKeys.length === 0) continue; // no structured ratings for this topic

    const mentioning = processed.filter((p) => p.topics.has(topic.id));

    for (const p of mentioning) {
      const r = p.review.rating as Record<string, number>;
      const vals = topic.ratingKeys.map((k) => r[k]).filter((v) => v && v > 0);
      if (vals.length === 0) continue;

      // S1: normalised structured sub-rating for this topic
      const structuredRating = vals.reduce((s, v) => s + v, 0) / vals.length / 5;

      // Alignment: how well does the text match the star rating?
      // High alignment (close to 1) = review text and rating agree → informative
      const alignment = 1 - Math.abs(p.textSentiment - structuredRating);

      // Heuristic: lexical quality of the review text
      const { score: heuristic } = checkTextQuality(p.review.review_text);

      triples.push({ alignment, heuristic, y: p.overallNorm });
    }
  }

  if (triples.length < MIN_TRIPLES_FOR_LEARNING) return DEFAULT_ALIGNMENT_WEIGHT;

  // 1D OLS: y ≈ h + α(a − h)
  // d/dα = 0  →  α* = Σ((y − h)(a − h)) / Σ((a − h)²)
  let num = 0, den = 0;
  for (const { alignment: a, heuristic: h, y } of triples) {
    const diff = a - h;
    num += (y - h) * diff;
    den += diff * diff;
  }

  if (Math.abs(den) < 1e-8) return DEFAULT_ALIGNMENT_WEIGHT;
  const learned = Math.max(0, Math.min(1, num / den));

  // Shrink toward default — need many reviews before trusting alignment over heuristic
  const alpha = shrink(learned, DEFAULT_ALIGNMENT_WEIGHT, triples.length);
  return Math.round(alpha * 100) / 100;
}

// ── Topic score weight learning ───────────────────────────────────────────────
//
// For each topic with enough reviews we build one data point:
//   X = [coverage, freshness, hybridTextSentiment]
//   y = mean(rating.overall / 5) for reviews mentioning that topic
//
// OLS finds β* = (XᵀX)⁻¹Xᵀy, the coverage/freshness/sentiment blend that
// best predicts actual guest satisfaction per topic at this property.
// Weights are clamped ≥ 0.05, normalised to sum to 1, then shrunk toward
// the hardcoded defaults (0.35 / 0.35 / 0.30).

const SCORE_WEIGHT_DEFAULTS: TopicScoreWeights = {
  coverageWeight: 0.35,
  freshnessWeight: 0.35,
  sentimentWeight: 0.30,
};

const NOW_CL = new Date("2026-04-13"); // matches analysis.ts reference date

/** Determinant of a 3×3 matrix. */
function det3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

/** Solve a 3×3 linear system Ax = b via Cramer's rule. */
function solve3x3(A: number[][], b: number[]): number[] | null {
  const d = det3(A);
  if (Math.abs(d) < 1e-10) return null;
  return [0, 1, 2].map((col) =>
    det3(A.map((row, i) => row.map((v, j) => (j === col ? b[i] : v)))) / d
  );
}

/** OLS via normal equations: β = (XᵀX)⁻¹Xᵀy. X is n×3, y is n×1. */
function solveOLS3(X: number[][], y: number[]): number[] | null {
  const XtX: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const Xty: number[] = [0, 0, 0];
  for (let i = 0; i < X.length; i++) {
    for (let j = 0; j < 3; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let k = 0; k < 3; k++) XtX[j][k] += X[i][j] * X[i][k];
    }
  }
  return solve3x3(XtX, Xty);
}

function learnTopicScoreWeights(
  processed: Array<{ review: Review; topics: Set<string>; textSentiment: number; overallNorm: number }>
): TopicScoreWeights {
  // Build one (X row, y) pair per topic with sufficient data
  const rows: { x: number[]; y: number }[] = [];

  for (const topic of TOPICS) {
    const mentioning = processed.filter((p) => p.topics.has(topic.id));
    if (mentioning.length < MIN_REVIEWS_FOR_LEARNING) continue;

    // Coverage
    const coverage = Math.min(1, mentioning.length / 10);

    // Freshness, days since most recent mention
    const dates = mentioning.map((p) => parseReviewDate(p.review.acquisition_date));
    const latestMs = Math.max(...dates.map((d) => d.getTime()));
    const daysSince = (NOW_CL.getTime() - latestMs) / (1000 * 60 * 60 * 24);
    const freshness = Math.max(0, 1 - daysSince / 365);

    // Sentiment, mean text sentiment across mentioning reviews
    const sentiment = mentioning.reduce((s, p) => s + p.textSentiment, 0) / mentioning.length;

    // Target, mean normalised overall rating for these reviews
    const target = mentioning.reduce((s, p) => s + p.overallNorm, 0) / mentioning.length;

    rows.push({ x: [coverage, freshness, sentiment], y: target });
  }

  if (rows.length < 3) return SCORE_WEIGHT_DEFAULTS; // not enough topics to fit 3 params

  const beta = solveOLS3(rows.map((r) => r.x), rows.map((r) => r.y));
  if (!beta) return SCORE_WEIGHT_DEFAULTS;

  // Clamp negatives (a negative β would mean "more coverage → worse score" which is nonsensical)
  const [bc, bf, bs] = beta.map((b) => Math.max(0.05, b));
  const total = bc + bf + bs;

  // Normalise so weights sum to 1
  const learnedCoverage  = bc / total;
  const learnedFreshness = bf / total;
  const learnedSentiment = bs / total;

  // Bayesian shrinkage, use row count as the pseudo-observation count
  const n = rows.length;
  return {
    coverageWeight:  Math.round(shrink(learnedCoverage,  SCORE_WEIGHT_DEFAULTS.coverageWeight,  n) * 1000) / 1000,
    freshnessWeight: Math.round(shrink(learnedFreshness, SCORE_WEIGHT_DEFAULTS.freshnessWeight, n) * 1000) / 1000,
    sentimentWeight: Math.round(shrink(learnedSentiment, SCORE_WEIGHT_DEFAULTS.sentimentWeight, n) * 1000) / 1000,
  };
}

// ── Main learning function ────────────────────────────────────────────────────

export function learnPropertyWeights(
  propertyId: string,
  reviews: Review[]
): LearnedWeights {
  const prev = getLearnedWeights(propertyId);
  const withText = reviews.filter((r) => r.review_text?.trim());

  // Pre-process each review once
  const processed = withText.map((r) => ({
    review: r,
    topics: classifyReview(r.review_text),
    textSentiment: reviewTextSentiment(r.review_text),
    overallNorm: Math.min(1, Math.max(0, (r.rating.overall || 0) / 5)),
  }));

  // ── 1. Topic importance weights ───────────────────────────────────────────

  // Default: equal weight for all 15 topics
  const defaultImportance = 1 / TOPICS.length;

  // Raw correlations per topic
  const rawImportances = TOPICS.map((topic) => {
    const mentioning = processed.filter((p) => p.topics.has(topic.id));
    const n = mentioning.length;

    if (n < MIN_REVIEWS_FOR_LEARNING) {
      return { topicId: topic.id, rawWeight: 0, n, correlation: 0 };
    }

    const xs = mentioning.map((p) => p.textSentiment);
    const ys = mentioning.map((p) => p.overallNorm);
    const r = pearson(xs, ys);
    const rawWeight = Math.max(0, r); // floor at 0, negative correlation → no reduction

    return { topicId: topic.id, rawWeight, n, correlation: r };
  });

  // Normalise raw weights to sum to 1
  const totalRaw = rawImportances.reduce((s, t) => s + t.rawWeight, 0);

  const topicImportance: TopicImportance[] = TOPICS.map((topic) => {
    const raw = rawImportances.find((r) => r.topicId === topic.id)!;
    const learnedNorm = totalRaw > 0 ? raw.rawWeight / totalRaw : defaultImportance;

    // Shrink toward equal-weight prior
    const weight = shrink(learnedNorm, defaultImportance, raw.n);

    return {
      topicId: topic.id,
      topicLabel: topic.label,
      weight: Math.round(weight * 10000) / 10000,
      defaultWeight: Math.round(defaultImportance * 10000) / 10000,
      delta: Math.round((weight - defaultImportance) * 10000) / 10000,
      reviewCount: raw.n,
      correlation: Math.round(raw.correlation * 100) / 100,
    };
  });

  // ── 2. Sentiment blend weights ────────────────────────────────────────────

  const sentimentBlend: SentimentBlend[] = TOPICS.map((topic) => {
    const hasStructured = topic.ratingKeys.length > 0;

    if (!hasStructured) {
      return {
        topicId: topic.id,
        topicLabel: topic.label,
        structuredWeight: DEFAULT_STRUCTURED_WEIGHT,
        textWeight: DEFAULT_TEXT_WEIGHT,
        defaultStructuredWeight: DEFAULT_STRUCTURED_WEIGHT,
        delta: 0,
        reviewCount: 0,
        hasStructuredData: false,
      };
    }

    const mentioning = processed.filter((p) => p.topics.has(topic.id));

    // Build S1/S2/target triples for reviews with valid sub-ratings
    const triples: { s1: number; s2: number; y: number }[] = [];
    for (const p of mentioning) {
      const r = p.review.rating as Record<string, number>;
      const vals = topic.ratingKeys.map((k) => r[k]).filter((v) => v && v > 0);
      if (vals.length === 0) continue;
      const s1 = vals.reduce((s, v) => s + v, 0) / vals.length / 5; // 0-5 → 0-1
      triples.push({ s1, s2: p.textSentiment, y: p.overallNorm });
    }

    const n = triples.length;
    if (n < MIN_REVIEWS_FOR_LEARNING) {
      return {
        topicId: topic.id,
        topicLabel: topic.label,
        structuredWeight: DEFAULT_STRUCTURED_WEIGHT,
        textWeight: DEFAULT_TEXT_WEIGHT,
        defaultStructuredWeight: DEFAULT_STRUCTURED_WEIGHT,
        delta: 0,
        reviewCount: n,
        hasStructuredData: true,
      };
    }

    const learnedAlpha = olsBlend(
      triples.map((t) => t.s1),
      triples.map((t) => t.s2),
      triples.map((t) => t.y)
    );

    const alpha = shrink(learnedAlpha, DEFAULT_STRUCTURED_WEIGHT, n);
    const structuredWeight = Math.round(alpha * 100) / 100;
    const textWeight = Math.round((1 - alpha) * 100) / 100;

    return {
      topicId: topic.id,
      topicLabel: topic.label,
      structuredWeight,
      textWeight,
      defaultStructuredWeight: DEFAULT_STRUCTURED_WEIGHT,
      delta: Math.round((alpha - DEFAULT_STRUCTURED_WEIGHT) * 100) / 100,
      reviewCount: n,
      hasStructuredData: true,
    };
  });

  // ── 3. Topic score weights (coverage / freshness / sentiment blend) ──────

  const topicScoreWeights = learnTopicScoreWeights(processed);

  // ── 4. Coverage saturation threshold ─────────────────────────────────────
  // How many quality-weighted reviews are needed before a topic is "saturated"?
  // Learned from when running mean sentiment stabilises across topics.

  const saturationThreshold = learnSaturationThreshold(processed);

  // ── 5. Review alignment weight ────────────────────────────────────────────
  // How much to weight text–rating alignment vs heuristic quality score?
  // Learned by OLS from reviews with both text and structured sub-ratings.

  const reviewAlignmentWeight = learnReviewAlignmentWeight(processed);

  // ── Persist ───────────────────────────────────────────────────────────────

  const result: LearnedWeights = {
    propertyId,
    topicImportance,
    sentimentBlend,
    topicScoreWeights,
    saturationThreshold,
    reviewAlignmentWeight,
    reviewsUsed: withText.length,
    trainedAt: new Date().toISOString(),
    previousTrainedAt: prev?.trainedAt ?? null,
  };

  learnedWeightsCache.set(propertyId, result);

  const file = loadWeightsFile();
  file[propertyId] = result;
  saveWeightsFile(file);

  return result;
}
