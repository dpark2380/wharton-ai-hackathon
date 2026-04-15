/**
 * lib/ml/analyze-ml.ts
 *
 * ML-enhanced property analysis pipeline.
 *
 * Replaces two components of the existing scoring system:
 *  1. Topic classification: embedding cosine similarity instead of keyword matching
 *  2. Sentiment scoring: ABSA (per-review, per-aspect) instead of word-count heuristics
 *
 * The coverage/freshness weights and overall aggregation formula are unchanged.
 * Only the inputs to those formulas become more accurate.
 *
 * Results are cached in globalThis and invalidated when new reviews come in.
 */

import crypto from "crypto";
import { Property, Review, parseReviewDate } from "@/lib/data";
import { TOPICS } from "@/lib/topics";
import { classifyTextsBatchML } from "./topic-classifier";
import { getAspectSentiments, aggregateSentimentScore, type ReviewAspectSentiment } from "./absa";

// ── Rich descriptions for ABSA prompts (same map as topic-classifier) ─────────
// Duplicated here to keep the ABSA context self-contained without a circular dep.
const TOPIC_DESCRIPTIONS: Record<string, string> = {
  cleanliness:     "Cleanliness, hygiene, tidiness, dirty rooms, dust, stains, mold, odors, spotless surfaces, housekeeping quality.",
  location:        "Location, neighborhood, proximity to attractions, public transport, convenient or inconvenient area, walking distance.",
  food_breakfast:  "Food quality, breakfast options, hotel restaurant, buffet, meals, coffee, tasty or bland food, included breakfast.",
  wifi_internet:   "WiFi and internet connectivity, slow or fast connection, dropped signal, bandwidth, streaming, reliable internet.",
  parking:         "Parking availability, car park, valet, garage, fees, free parking, limited spaces.",
  pool_fitness:    "Swimming pool, fitness center, gym, equipment, jacuzzi, sauna, pool cleanliness and temperature.",
  checkin_checkout:"Check-in and check-out process, front desk, reception queue, wait times, key card, early/late check-in.",
  noise:           "Noise levels, sound insulation, loud neighbors, traffic, thin walls, disturbances, couldn't sleep, peaceful.",
  room_comfort:    "Room size, bed comfort, mattress quality, pillows, lumpy bed, spacious or cramped, temperature, air conditioning.",
  bathroom:        "Bathroom facilities, shower pressure, hot water, bathtub, towels, toiletries, hairdryer, cleanliness.",
  staff_service:   "Staff attitude, helpfulness, friendliness, professional service, went above and beyond, rude or attentive staff.",
  value:           "Value for money, pricing, expensive, overpriced, good deal, worth the cost, price-quality ratio.",
  spa_wellness:    "Spa treatments, massage, wellness facilities, relaxation, sauna, steam room, beauty treatments.",
  accessibility:   "Wheelchair access, disabled facilities, elevator, mobility assistance, special needs accommodation.",
  eco_sustainability:"Eco-friendliness, sustainability, recycling, organic, plastic-free, environmental practices.",
};

const NOW = new Date("2026-04-14");
const STALE_THRESHOLD_DAYS = 180;
const MAX_REVIEWS_TO_ANALYZE = 60; // cap for cost and speed

// ── Result types ───────────────────────────────────────────────────────────────

export interface MLTopicResult {
  topicId: string;
  topicLabel: string;
  isRelevant: boolean;

  // Classification comparison
  keywordReviewCount: number;
  mlReviewCount: number;
  newlyFoundCount: number;  // ML found but keyword missed
  missedCount: number;      // keyword found but ML missed (false positives)

  // Sentiment comparison
  keywordSentimentScore: number; // 0–1 from existing word-count heuristic
  mlSentimentScore: number;      // 0–1 from ABSA
  mlSentiment: "positive" | "negative" | "neutral" | "unknown";
  sentimentDelta: number;        // mlSentimentScore - keywordSentimentScore

  // Topic score using ML inputs (same weights as existing formula)
  mlTopicScore: number;    // 0–1
  keywordTopicScore: number; // 0–1 (from existing system for comparison)

  // Top evidence quotes
  evidence: { text: string; sentiment: ReviewAspectSentiment["sentiment"]; score: number }[];

  // Freshness (unchanged, dates don't change)
  freshnessDays: number | null;
  freshnessScore: number;
  isStale: boolean;
  lastMentionDate: string | null;
}

export interface MLAnalysis {
  propertyId: string;
  reviewsAnalyzed: number;
  keywordHealthScore: number;
  mlHealthScore: number;
  scoreDelta: number;
  topics: MLTopicResult[];
  reclassifiedCount: number;   // reviews that got different topic assignments
  sentimentCorrected: number;  // topics with |sentimentDelta| > 0.1
  computedAt: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _mlAnalysisCache: Map<string, MLAnalysis> | undefined;
}

const mlCache: Map<string, MLAnalysis> =
  globalThis._mlAnalysisCache ?? (globalThis._mlAnalysisCache = new Map());

export function invalidateMLCache(propertyId: string): void {
  mlCache.delete(propertyId);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

function isAmenityRelevant(property: Property, amenityKeys: string[]): boolean {
  if (amenityKeys.length === 0) return true;
  const allText = [
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
  return amenityKeys.some((k) => allText.includes(k.replace(/_/g, " ")) || allText.includes(k));
}

// Keyword sentiment replication (for comparison baseline), same logic as analysis.ts
const POS_WORDS = ["great","excellent","amazing","wonderful","fantastic","loved","perfect",
  "good","nice","lovely","outstanding","superb","best","clean","comfortable",
  "helpful","friendly","beautiful","delicious","spacious","modern","recommend"];
const NEG_WORDS = ["bad","poor","terrible","awful","horrible","worst","dirty","rude",
  "disappointing","disgusting","broken","noisy","stained","cold","slow",
  "unfriendly","unhelpful","cramped","outdated","overpriced","smelly","avoid"];

function keywordSentimentScore(texts: string[]): number {
  if (texts.length === 0) return 0.5;
  let pos = 0, neg = 0;
  for (const t of texts) {
    const lower = t.toLowerCase();
    for (const w of POS_WORDS) if (lower.includes(w)) pos++;
    for (const w of NEG_WORDS) if (lower.includes(w)) neg++;
  }
  const total = pos + neg;
  if (total === 0) return 0.5;
  return 0.1 + (pos / total) * 0.8;
}

function classifyTextKeyword(text: string): Set<string> {
  const lower = text.toLowerCase();
  const matched = new Set<string>();
  for (const topic of TOPICS) {
    for (const kw of topic.keywords) {
      if (lower.includes(kw)) { matched.add(topic.id); break; }
    }
  }
  return matched;
}

// ── Main analysis function ─────────────────────────────────────────────────────

export async function analyzePropertyML(
  property: Property,
  reviews: Review[],
  keywordHealthScore: number // pass current score for comparison
): Promise<MLAnalysis> {
  const cached = mlCache.get(property.eg_property_id);
  if (cached) return cached;

  // Work with reviews that have text; cap at MAX_REVIEWS_TO_ANALYZE (most recent first)
  const reviewsWithText = reviews
    .filter((r) => r.review_text?.trim())
    .sort((a, b) =>
      parseReviewDate(b.acquisition_date).getTime() - parseReviewDate(a.acquisition_date).getTime()
    )
    .slice(0, MAX_REVIEWS_TO_ANALYZE);

  // ── Step 1: Batch classify all reviews via embeddings ─────────────────────
  const texts = reviewsWithText.map((r) => r.review_text.trim());
  const mlClassifications = await classifyTextsBatchML(texts);

  // For comparison: keyword classifications of the same reviews
  const keywordClassifications = texts.map((t) => classifyTextKeyword(t));

  // Build per-topic review lists from ML classifications
  const mlReviewsByTopic: Record<string, Review[]> = {};
  const mlTextsByTopic: Record<string, string[]> = {};
  for (const topic of TOPICS) {
    mlReviewsByTopic[topic.id] = [];
    mlTextsByTopic[topic.id] = [];
  }
  for (let i = 0; i < reviewsWithText.length; i++) {
    for (const { topicId } of mlClassifications[i]) {
      mlReviewsByTopic[topicId].push(reviewsWithText[i]);
      mlTextsByTopic[topicId].push(texts[i]);
    }
  }

  // ── Step 2: ABSA, run in parallel across all relevant topics ─────────────
  const relevantTopics = TOPICS.filter((t) => isAmenityRelevant(property, t.amenityKeys));

  const absa = await Promise.all(
    relevantTopics.map(async (topic) => {
      const topicTexts = mlTextsByTopic[topic.id].slice(0, MAX_REVIEWS_TO_ANALYZE);
      if (topicTexts.length === 0) return { topicId: topic.id, results: [] };
      const results = await getAspectSentiments(
        topic.id,
        topic.label,
        TOPIC_DESCRIPTIONS[topic.id] ?? topic.label,
        topicTexts
      );
      return { topicId: topic.id, results };
    })
  );

  const absaByTopic: Record<string, ReviewAspectSentiment[]> = {};
  for (const { topicId, results } of absa) {
    absaByTopic[topicId] = results;
  }

  // ── Step 3: Compute per-topic ML scores ───────────────────────────────────
  let reclassifiedCount = 0;
  let sentimentCorrected = 0;

  const topicResults: MLTopicResult[] = TOPICS.map((topic) => {
    const isRelevant = isAmenityRelevant(property, topic.amenityKeys);

    // Keyword review set (from the same capped review window)
    const kwReviews = reviewsWithText.filter((_, i) => keywordClassifications[i].has(topic.id));
    const mlReviews = mlReviewsByTopic[topic.id];

    const keywordCount = kwReviews.length;
    const mlCount = mlReviews.length;

    const kwSet = new Set(kwReviews.map((r) => hashText(r.review_text)));
    const mlSet = new Set(mlReviews.map((r) => hashText(r.review_text)));
    const newlyFound = mlReviews.filter((r) => !kwSet.has(hashText(r.review_text))).length;
    const missed = kwReviews.filter((r) => !mlSet.has(hashText(r.review_text))).length;

    if (newlyFound > 0 || missed > 0) reclassifiedCount++;

    // Freshness (same as existing system, based on ML-classified reviews)
    let freshnessDays: number | null = null;
    let freshnessScore = 0;
    let lastMentionDate: string | null = null;

    if (mlReviews.length > 0) {
      const dates = mlReviews.map((r) => parseReviewDate(r.acquisition_date));
      const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
      freshnessDays = Math.floor((NOW.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));
      freshnessScore = Math.max(0, 1 - freshnessDays / 365);
      lastMentionDate = latest.toISOString().split("T")[0];
    }

    // Coverage (using ML count)
    const coverageScore = Math.min(1, mlCount / 10);

    // Sentiment
    const kwSentScore = keywordSentimentScore(kwReviews.map((r) => r.review_text));
    const absaResults = absaByTopic[topic.id] ?? [];
    const mlSentScore = absaResults.length > 0 ? aggregateSentimentScore(absaResults) : (mlCount > 0 ? 0.5 : 0.5);
    const sentimentDelta = mlSentScore - kwSentScore;

    if (Math.abs(sentimentDelta) > 0.1) sentimentCorrected++;

    // Categorical sentiment label from ABSA scores
    let mlSentiment: MLTopicResult["mlSentiment"] = "unknown";
    if (mlCount > 0) {
      if (mlSentScore >= 0.6) mlSentiment = "positive";
      else if (mlSentScore <= 0.4) mlSentiment = "negative";
      else mlSentiment = "neutral";
    }

    // ML topic score (same formula as existing system)
    const mlTopicScore = isRelevant
      ? mlCount === 0 ? 0
        : coverageScore * 0.35 + freshnessScore * 0.35 + mlSentScore * 0.30
      : 1;

    // Keyword topic score for comparison (approximate, freshness same, keyword coverage + sentiment)
    const kwCoverageScore = Math.min(1, keywordCount / 10);
    const keywordTopicScore = isRelevant
      ? keywordCount === 0 ? 0
        : kwCoverageScore * 0.35 + freshnessScore * 0.35 + kwSentScore * 0.30
      : 1;

    // Top evidence quotes from ABSA (exclude not_mentioned, take highest confidence)
    const evidence = absaResults
      .filter((r) => r.sentiment !== "not_mentioned" && r.evidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((r) => ({
        text: r.evidence,
        sentiment: r.sentiment,
        score: r.score,
      }));

    return {
      topicId: topic.id,
      topicLabel: topic.label,
      isRelevant,
      keywordReviewCount: keywordCount,
      mlReviewCount: mlCount,
      newlyFoundCount: newlyFound,
      missedCount: missed,
      keywordSentimentScore: kwSentScore,
      mlSentimentScore: mlSentScore,
      mlSentiment,
      sentimentDelta,
      mlTopicScore,
      keywordTopicScore,
      evidence,
      freshnessDays,
      freshnessScore,
      isStale: isRelevant && freshnessDays !== null && freshnessDays > STALE_THRESHOLD_DAYS,
      lastMentionDate,
    };
  });

  // ── Step 4: Aggregate health scores ───────────────────────────────────────
  const relevantResults = topicResults.filter((t) => t.isRelevant);
  const mlHealthScore = relevantResults.length > 0
    ? Math.round(relevantResults.reduce((s, t) => s + t.mlTopicScore, 0) / relevantResults.length * 100)
    : 0;

  const result: MLAnalysis = {
    propertyId: property.eg_property_id,
    reviewsAnalyzed: reviewsWithText.length,
    keywordHealthScore,
    mlHealthScore,
    scoreDelta: mlHealthScore - keywordHealthScore,
    topics: topicResults,
    reclassifiedCount,
    sentimentCorrected,
    computedAt: new Date().toISOString(),
  };

  mlCache.set(property.eg_property_id, result);
  return result;
}
