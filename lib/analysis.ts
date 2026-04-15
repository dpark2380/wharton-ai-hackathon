import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Property, Review, parseReviewDate } from "./data";
import { TOPICS, Topic, classifyText } from "./topics";
import type { LearnedWeights } from "./ml/continuous-learning";
import { liveClassificationCache } from "./live-classification-cache";

// ── AI topic classification cache ─────────────────────────────────────────────
// Populated by scripts/classify-topics-ai.ts. Falls back to keyword matching
// for any review not present (live reviews, or if the script hasn't been run).

let _aiClassifications: Record<string, string[]> | null = null;

function getAiClassifications(): Record<string, string[]> {
  if (_aiClassifications !== null) return _aiClassifications;
  try {
    const filePath = path.join(process.cwd(), "lib", "topic-classifications.json");
    _aiClassifications = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    _aiClassifications = {}; // file not generated yet — use keyword matching only
  }
  return _aiClassifications!;
}

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

/**
 * Returns the set of topic IDs for a review.
 * Priority: AI file cache → embedding live cache → keyword matching (last resort).
 * Live reviews are classified with embeddings at submission time and stored in
 * liveClassificationCache, so keyword matching is only reached if the embedding
 * API failed during submission.
 */
function classifyReview(reviewText: string): Set<string> {
  const hash = hashText(reviewText);

  // 1. AI GPT file cache (all historical reviews)
  const classifications = getAiClassifications();
  if (classifications[hash]) {
    return new Set(classifications[hash]);
  }

  // 2. Embedding-classified live reviews (cached at submission time)
  if (liveClassificationCache.has(hash)) {
    return new Set(liveClassificationCache.get(hash)!);
  }

  // 3. Keyword matching — only reached if embedding API failed at submission
  return classifyText(reviewText);
}

export interface TopicAnalysis {
  topicId: string;
  topicLabel: string;
  isRelevant: boolean;
  reviewCount: number;      // how many reviews mention this topic
  coverageScore: number;    // 0-1
  freshnessDays: number | null; // days since most recent mention (null = never mentioned)
  freshnessScore: number;   // 0-1
  sentiment: "positive" | "negative" | "mixed" | "unknown";
  sentimentConfidence: number; // 0-1
  // Hybrid scoring signals
  structuredRatingScore: number | null; // 0-1 from sub-rating fields; null = no data
  textSentimentScore: number;           // 0-1 from keyword analysis of review text
  hybridSentimentScore: number;         // 0-1 blended (S1×0.55 + S2×0.45, or S2 alone)
  topicScore: number;       // 0-1, weighted composite
  isStale: boolean;
  hasSentimentShift: boolean;
  lastMentionDate: string | null;
  gap: "high" | "medium" | "low" | "none";
}

export interface PropertyAnalysis {
  propertyId: string;
  knowledgeHealthScore: number; // 0-100
  topics: TopicAnalysis[];
  totalReviews: number;
  reviewsWithText: number;
  topGaps: TopicAnalysis[];
}

const NOW = new Date("2026-04-13");
const STALE_THRESHOLD_DAYS = 180; // 6 months

function isPropertyAmenityRelevant(property: Property, topic: Topic): boolean {
  if (topic.amenityKeys.length === 0) return true; // always relevant (cleanliness, noise, etc.)

  const allAmenityText = [
    ...property.popular_amenities_list,
    ...property.property_amenity_food_and_drink,
    ...property.property_amenity_spa,
    ...property.property_amenity_outdoor,
    ...property.property_amenity_internet,
    ...property.property_amenity_parking,
    ...property.property_amenity_accessibility,
    ...property.property_amenity_activities_nearby,
    ...property.property_amenity_more,
    property.property_description,
  ].join(" ").toLowerCase();

  return topic.amenityKeys.some((key) => allAmenityText.includes(key.replace(/_/g, " ")) || allAmenityText.includes(key));
}

const POS_WORDS = ["great", "excellent", "amazing", "wonderful", "fantastic", "loved", "perfect",
  "good", "nice", "lovely", "outstanding", "superb", "best", "clean", "comfortable",
  "helpful", "friendly", "beautiful", "delicious", "spacious", "modern", "recommend"];
const NEG_WORDS = ["bad", "poor", "terrible", "awful", "horrible", "worst", "dirty", "rude",
  "disappointing", "disgusting", "broken", "noisy", "stained", "cold", "slow",
  "unfriendly", "unhelpful", "cramped", "outdated", "overpriced", "smelly", "avoid"];

// Signal 2: continuous 0-1 sentiment score derived from review text keywords
function detectTextSentimentScore(mentioningReviews: Review[]): number {
  if (mentioningReviews.length === 0) return 0.5; // no data - neutral

  let posCount = 0;
  let negCount = 0;
  for (const review of mentioningReviews) {
    const text = (review.review_text || "").toLowerCase();
    for (const w of POS_WORDS) if (text.includes(w)) posCount++;
    for (const w of NEG_WORDS) if (text.includes(w)) negCount++;
  }

  const total = posCount + negCount;
  if (total === 0) return 0.5;

  // Map purely-positive → 0.9, purely-negative → 0.1
  const positiveRatio = posCount / total;
  return 0.1 + positiveRatio * 0.8;
}

// Categorical label + confidence (kept for backward-compat UI fields)
function detectSentiment(mentioningReviews: Review[]): {
  sentiment: "positive" | "negative" | "mixed" | "unknown";
  confidence: number;
} {
  if (mentioningReviews.length === 0) return { sentiment: "unknown", confidence: 0 };

  let posCount = 0;
  let negCount = 0;
  for (const review of mentioningReviews) {
    const text = (review.review_text || "").toLowerCase();
    for (const w of POS_WORDS) if (text.includes(w)) posCount++;
    for (const w of NEG_WORDS) if (text.includes(w)) negCount++;
  }

  const total = posCount + negCount;
  if (total === 0) return { sentiment: "unknown", confidence: 0 };

  const confidence = Math.min(1, total / 20);
  if (posCount > negCount * 2) return { sentiment: "positive", confidence };
  if (negCount > posCount * 2) return { sentiment: "negative", confidence };
  return { sentiment: "mixed", confidence };
}

// Signal 1: average of structured rating sub-categories, normalized 0-1
// Returns null when no reviews carry non-zero values for those fields
function computeStructuredRatingScore(reviews: Review[], ratingKeys: string[]): number | null {
  if (ratingKeys.length === 0) return null;

  const values: number[] = [];
  for (const review of reviews) {
    const r = review.rating as Record<string, number>;
    for (const key of ratingKeys) {
      const val = r[key];
      if (val && val > 0) values.push(val); // 0 means the reviewer didn't rate this sub-category
    }
  }

  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return avg / 5; // normalize: 5-star max → 1.0
}

function detectSentimentShift(reviews: Review[], topicSets: Set<string>[], topicId: string): boolean {
  const cutoff = new Date(NOW);
  cutoff.setMonth(cutoff.getMonth() - 3);

  const recent: Review[] = [];
  const older: Review[] = [];
  for (let i = 0; i < reviews.length; i++) {
    if (!topicSets[i].has(topicId)) continue;
    const d = parseReviewDate(reviews[i].acquisition_date);
    if (d >= cutoff) recent.push(reviews[i]);
    else older.push(reviews[i]);
  }

  if (recent.length < 2 || older.length < 5) return false;

  const negWords = ["bad", "poor", "terrible", "awful", "horrible", "dirty", "disappointing", "broken", "noisy"];
  const recentNegRatio = recent.filter((r) => negWords.some((w) => r.review_text?.toLowerCase().includes(w))).length / recent.length;
  const olderNegRatio = older.filter((r) => negWords.some((w) => r.review_text?.toLowerCase().includes(w))).length / older.length;

  return Math.abs(recentNegRatio - olderNegRatio) > 0.3;
}

// Use globalThis so the cache survives Next.js HMR and is shared across all
// module instances in the same process (API routes + page renders).
declare global {
  // eslint-disable-next-line no-var
  var _analysisCache: Map<string, PropertyAnalysis> | undefined;
}

const _analysisCache: Map<string, PropertyAnalysis> =
  globalThis._analysisCache ?? (globalThis._analysisCache = new Map());

/** Call after adding a live review so the next analyzeProperty call recomputes. */
export function invalidateAnalysisCache(propertyId: string): void {
  _analysisCache.delete(propertyId);
}

export function analyzeProperty(
  property: Property,
  reviews: Review[],
  skipCache = false,
  learnedWeights: LearnedWeights | null = null
): PropertyAnalysis {
  if (!skipCache && !learnedWeights) {
    const cached = _analysisCache.get(property.eg_property_id);
    if (cached) return cached;
  }

  const reviewsWithText = reviews.filter((r) => r.review_text && r.review_text.trim().length > 0);

  // Pre-classify every review once (not once per topic)
  // Uses AI cache when available, falls back to keyword matching
  const reviewTopicSets = reviewsWithText.map((r) => classifyReview(r.review_text));

  const topics: TopicAnalysis[] = TOPICS.map((topic) => {
    const isRelevant = isPropertyAmenityRelevant(property, topic);

    const mentioningReviews = reviewsWithText.filter((_, i) =>
      reviewTopicSets[i].has(topic.id)
    );

    const reviewCount = mentioningReviews.length;
    const coverageScore = Math.min(1, reviewCount / 10);

    let freshnessDays: number | null = null;
    let lastMentionDate: string | null = null;
    let freshnessScore = 0;

    if (mentioningReviews.length > 0) {
      const dates = mentioningReviews.map((r) => parseReviewDate(r.acquisition_date));
      const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
      freshnessDays = Math.floor((NOW.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));
      freshnessScore = Math.max(0, 1 - freshnessDays / 365);
      lastMentionDate = latest.toISOString().split("T")[0];
    }

    const { sentiment, confidence: sentimentConfidence } = detectSentiment(mentioningReviews);
    const hasSentimentShift = detectSentimentShift(reviewsWithText, reviewTopicSets, topic.id);

    // ── Hybrid scoring ─────────────────────────────────────────────────────────
    // Signal 1: structured sub-ratings across all reviews for this property
    const structuredRatingScore = computeStructuredRatingScore(reviews, topic.ratingKeys);

    // Signal 2: keyword sentiment on text reviews mentioning this topic
    const textSentimentScore = detectTextSentimentScore(mentioningReviews);

    // Blend: structured ratings enrich text sentiment, but only when text coverage exists.
    // Use learned sentiment blend weights if available, otherwise fall back to defaults.
    const learnedBlend = learnedWeights?.sentimentBlend.find((b) => b.topicId === topic.id);
    const s1Weight = learnedBlend?.hasStructuredData ? learnedBlend.structuredWeight : 0.55;
    const s2Weight = learnedBlend?.hasStructuredData ? learnedBlend.textWeight : 0.45;

    const hybridSentimentScore = reviewCount > 0 && structuredRatingScore !== null
      ? structuredRatingScore * s1Weight + textSentimentScore * s2Weight
      : reviewCount > 0
      ? textSentimentScore
      : 0.5; // neutral - no text data to draw from

    const wCoverage  = learnedWeights?.topicScoreWeights?.coverageWeight  ?? 0.35;
    const wFreshness = learnedWeights?.topicScoreWeights?.freshnessWeight ?? 0.35;
    const wSentiment = learnedWeights?.topicScoreWeights?.sentimentWeight ?? 0.30;

    const topicScore = isRelevant
      ? reviewCount === 0
        ? 0 // no text mentions = no knowledge = zero contribution
        : coverageScore * wCoverage + freshnessScore * wFreshness + hybridSentimentScore * wSentiment
      : 1; // non-relevant topics don't drag the score

    const isStale = isRelevant && freshnessDays !== null && freshnessDays > STALE_THRESHOLD_DAYS;

    // Gap priority
    let gap: "high" | "medium" | "low" | "none" = "none";
    if (isRelevant) {
      if (reviewCount === 0) gap = "high";
      else if (reviewCount < 3 || isStale) gap = "medium";
      else if (coverageScore < 0.5) gap = "low";
    }

    return {
      topicId: topic.id,
      topicLabel: topic.label,
      isRelevant,
      reviewCount,
      coverageScore,
      freshnessDays,
      freshnessScore,
      sentiment,
      sentimentConfidence,
      structuredRatingScore,
      textSentimentScore,
      hybridSentimentScore,
      topicScore,
      isStale,
      hasSentimentShift,
      lastMentionDate,
      gap,
    };
  });

  const relevantTopics = topics.filter((t) => t.isRelevant);

  // Use learned importance weights if available, otherwise equal weight (simple mean)
  let knowledgeHealthScore = 0;
  if (relevantTopics.length > 0) {
    if (learnedWeights) {
      const totalImportance = relevantTopics.reduce((sum, t) => {
        const imp = learnedWeights.topicImportance.find((i) => i.topicId === t.topicId);
        return sum + (imp?.weight ?? 1 / TOPICS.length);
      }, 0);
      const weightedSum = relevantTopics.reduce((sum, t) => {
        const imp = learnedWeights.topicImportance.find((i) => i.topicId === t.topicId);
        const w = imp?.weight ?? 1 / TOPICS.length;
        return sum + w * t.topicScore;
      }, 0);
      knowledgeHealthScore = Math.round((weightedSum / totalImportance) * 100);
    } else {
      knowledgeHealthScore = Math.round(
        (relevantTopics.reduce((sum, t) => sum + t.topicScore, 0) / relevantTopics.length) * 100
      );
    }
  }

  const topGaps = topics
    .filter((t) => t.isRelevant && t.gap !== "none")
    .sort((a, b) => {
      const gapOrder = { high: 0, medium: 1, low: 2, none: 3 };
      return gapOrder[a.gap] - gapOrder[b.gap];
    })
    .slice(0, 5);

  const result: PropertyAnalysis = {
    propertyId: property.eg_property_id,
    knowledgeHealthScore,
    topics,
    totalReviews: reviews.length,
    reviewsWithText: reviewsWithText.length,
    topGaps,
  };

  _analysisCache.set(property.eg_property_id, result);
  return result;
}

export function getKnowledgeHealthColor(score: number): string {
  if (score >= 75) return "#22c55e"; // green
  if (score >= 50) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

export function getKnowledgeHealthLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Attention";
}

export function computeNewHealthScore(
  currentAnalysis: PropertyAnalysis,
  newlyCoveredTopics: string[]
): number {
  const updatedTopics = currentAnalysis.topics.map((t) => {
    if (newlyCoveredTopics.includes(t.topicId) && t.isRelevant) {
      // Simulate adding one fresh positive review for this topic
      const newCoverageScore = Math.min(1, (t.reviewCount + 1) / 10);
      const newFreshnessScore = 1.0; // just submitted
      const newHybridSentiment = t.hybridSentimentScore > 0.5
        ? Math.min(1, t.hybridSentimentScore + 0.05) // slight positive nudge
        : 0.75; // new answer assumed positive
      return {
        ...t,
        topicScore: newCoverageScore * 0.35 + newFreshnessScore * 0.35 + newHybridSentiment * 0.30,
      };
    }
    return t;
  });

  const relevantTopics = updatedTopics.filter((t) => t.isRelevant);
  return relevantTopics.length > 0
    ? Math.round((relevantTopics.reduce((sum, t) => sum + t.topicScore, 0) / relevantTopics.length) * 100)
    : 0;
}
