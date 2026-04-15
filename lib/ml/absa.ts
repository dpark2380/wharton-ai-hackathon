/**
 * lib/ml/absa.ts
 *
 * Aspect-Based Sentiment Analysis (ABSA).
 *
 * For each topic, we send a batch of reviews (up to MAX_REVIEWS_PER_CALL) to
 * GPT-4o-mini in a single structured call and ask for per-review sentiment
 * toward that specific aspect.
 *
 * This produces sentiment scores at the topic × review level, far more precise
 * than the current approach which counts positive/negative words across ALL
 * reviews mentioning a topic in aggregate.
 *
 * Key improvement: "The room was not dirty" → correctly scores as positive for
 * Cleanliness because GPT reads negation in context.
 */

import OpenAI from "openai";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

const MAX_REVIEWS_PER_CALL = 12; // GPT-4o-mini context sweet spot for this task

export interface ReviewAspectSentiment {
  reviewIndex: number;       // index within the batch passed in
  sentiment: "positive" | "negative" | "neutral" | "not_mentioned";
  score: number;             // 0.0 (very negative) → 1.0 (very positive); 0.5 = neutral/missing
  confidence: number;        // 0.0–1.0
  evidence: string;          // exact phrase from review supporting the classification
}

/**
 * Run ABSA for one topic across a batch of review texts.
 *
 * @param topicId     - internal topic identifier
 * @param topicLabel  - human-readable name shown in the prompt
 * @param description - semantic description of the aspect to help GPT focus correctly
 * @param reviewTexts - review texts (already pre-filtered to likely mention this topic)
 * @returns per-review sentiment result, same length and order as reviewTexts
 */
export async function getAspectSentiments(
  topicId: string,
  topicLabel: string,
  description: string,
  reviewTexts: string[]
): Promise<ReviewAspectSentiment[]> {
  if (reviewTexts.length === 0) return [];

  // Process in chunks if needed
  if (reviewTexts.length > MAX_REVIEWS_PER_CALL) {
    const chunks: ReviewAspectSentiment[] = [];
    for (let i = 0; i < reviewTexts.length; i += MAX_REVIEWS_PER_CALL) {
      const chunk = reviewTexts.slice(i, i + MAX_REVIEWS_PER_CALL);
      const chunkResults = await getAspectSentimentsChunk(topicId, topicLabel, description, chunk, i);
      chunks.push(...chunkResults);
    }
    return chunks;
  }

  return getAspectSentimentsChunk(topicId, topicLabel, description, reviewTexts, 0);
}

async function getAspectSentimentsChunk(
  _topicId: string,
  topicLabel: string,
  description: string,
  reviewTexts: string[],
  indexOffset: number
): Promise<ReviewAspectSentiment[]> {
  const numbered = reviewTexts
    .map((t, i) => `[${i + 1}] "${t.trim().slice(0, 400)}"`)
    .join("\n\n");

  const prompt = `You are an Aspect-Based Sentiment Analysis (ABSA) system specialised in hotel reviews.

Aspect: "${topicLabel}"
What this covers: ${description}

Task: For each numbered review below, determine the sentiment expressed specifically toward the "${topicLabel}" aspect.

Rules:
- Read carefully for negation: "not dirty" = POSITIVE for cleanliness
- Ignore sentiment toward other aspects: "great staff but terrible parking" → if analyzing parking, score is NEGATIVE
- "not_mentioned": the review text does not meaningfully address this aspect at all
- score: 0.0 = extremely negative, 0.5 = neutral or ambiguous, 1.0 = extremely positive
- evidence: copy the exact short phrase from the review that drives your classification (empty string if not_mentioned)

Reviews:
${numbered}

Respond ONLY with a valid JSON array, one object per review in order:
[{"index": 1, "sentiment": "positive|negative|neutral|not_mentioned", "score": 0.0, "confidence": 0.0, "evidence": ""}]`;

  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 800,
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Array<{
      index: number;
      sentiment: ReviewAspectSentiment["sentiment"];
      score: number;
      confidence: number;
      evidence: string;
    }>;

    // Map back to 0-based indices with offset
    return parsed.map((r) => ({
      reviewIndex: indexOffset + r.index - 1, // convert 1-based to 0-based
      sentiment: r.sentiment,
      score: Math.max(0, Math.min(1, r.score)),
      confidence: Math.max(0, Math.min(1, r.confidence ?? 0.7)),
      evidence: r.evidence ?? "",
    }));
  } catch (err) {
    console.error(`ABSA error for topic ${topicLabel}:`, err);
    // Fallback: neutral score for all reviews in batch
    return reviewTexts.map((_, i) => ({
      reviewIndex: indexOffset + i,
      sentiment: "neutral" as const,
      score: 0.5,
      confidence: 0,
      evidence: "",
    }));
  }
}

/**
 * Compute a single aggregate sentiment score (0–1) from a set of ABSA results.
 * Excludes "not_mentioned" results. Confidence-weighted average.
 */
export function aggregateSentimentScore(results: ReviewAspectSentiment[]): number {
  const valid = results.filter((r) => r.sentiment !== "not_mentioned");
  if (valid.length === 0) return 0.5;

  const totalWeight = valid.reduce((s, r) => s + r.confidence, 0);
  if (totalWeight === 0) {
    return valid.reduce((s, r) => s + r.score, 0) / valid.length;
  }

  return valid.reduce((s, r) => s + r.score * r.confidence, 0) / totalWeight;
}
