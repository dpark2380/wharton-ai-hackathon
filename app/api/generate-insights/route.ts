import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadProperties, getReviewsForProperty, parseReviewDate } from "@/lib/data";
import { classifyText } from "@/lib/topics";
import { insightsCache, insightsCacheKey, type InsightsResult } from "@/lib/insights-cache";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

const NOW = new Date("2026-04-14");
const RECENT_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export async function POST(request: Request) {
  try {
    const { propertyId, topicId, topicLabel } = await request.json() as {
      propertyId: string;
      topicId?: string;
      topicLabel?: string;
    };

    if (!propertyId) {
      return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    }

    // ── Cache hit ────────────────────────────────────────────────────────────
    const key = insightsCacheKey(propertyId, topicId);
    if (insightsCache.has(key)) {
      return NextResponse.json(insightsCache.get(key));
    }

    // ── Load and filter reviews ──────────────────────────────────────────────
    const properties = loadProperties();
    const property = properties.find((p) => p.eg_property_id === propertyId);
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    let reviewsWithText = getReviewsForProperty(propertyId)
      .filter((r) => r.review_text?.trim());

    if (topicId) {
      reviewsWithText = reviewsWithText.filter((r) =>
        classifyText(r.review_text).has(topicId)
      );
    }

    if (reviewsWithText.length === 0) {
      const empty: InsightsResult = {
        summary: "No reviews available for this topic yet.",
        issues: "",
        strengths: "",
        trend: "",
      };
      insightsCache.set(key, empty);
      return NextResponse.json(empty);
    }

    // ── Sort by recency, build context string ────────────────────────────────
    const sorted = [...reviewsWithText].sort(
      (a, b) => parseReviewDate(b.acquisition_date).getTime() - parseReviewDate(a.acquisition_date).getTime()
    );

    const recentCount = sorted.filter(
      (r) => NOW.getTime() - parseReviewDate(r.acquisition_date).getTime() < RECENT_MS
    ).length;

    const reviewContext = sorted.slice(0, 35).map((r) => {
      const isRecent = NOW.getTime() - parseReviewDate(r.acquisition_date).getTime() < RECENT_MS;
      const stars = r.rating.overall > 0 ? `${r.rating.overall}/5` : "no star rating";
      return `[${isRecent ? "RECENT" : "OLDER"} · ${r.acquisition_date} · ${stars}]\n${r.review_text.trim().slice(0, 450)}`;
    }).join("\n\n---\n\n");

    // ── Build prompt ─────────────────────────────────────────────────────────
    let prompt: string;
    const hotelCtx = `${property.star_rating}-star hotel in ${property.city}, ${property.country}`;

    if (topicId) {
      prompt = `You are a hospitality analyst briefing a hotel manager on what guests say about a specific aspect of their property.

Hotel: ${hotelCtx}
Topic: ${topicLabel ?? topicId}
Reviews mentioning this topic (${reviewsWithText.length} total, ${recentCount} in the last 90 days):
RECENT reviews are weighted more heavily.

${reviewContext}

Write a concise 2–3 sentence insight for the hotel manager about "${topicLabel ?? topicId}". Cover:
- The main guest complaints or concerns (be specific, cite actual issues mentioned)
- Any positives worth preserving
- Whether the situation is improving or worsening based on RECENT vs OLDER reviews

Be direct and actionable. Write for someone who wants to fix problems, not read a report.

Respond ONLY with valid JSON: {"summary": "..."}`;
    } else {
      prompt = `You are a hospitality analyst briefing a hotel manager on their overall guest experience.

Hotel: ${hotelCtx}
Total reviews analyzed: ${reviewsWithText.length} (${recentCount} in the last 90 days)
RECENT reviews (last 90 days) are weighted more heavily than OLDER ones.

${reviewContext}

Generate four short insights for the hotel manager:

1. "summary": 2 sentences — overall picture of the guest experience.
2. "issues": 2–3 sentences — the most important, specific problems guests raise that need fixing. Name the actual issues (e.g., "parking," "WiFi reliability," "room noise"). Prioritise problems appearing in RECENT reviews.
3. "strengths": 1–2 sentences — what guests consistently praise and the hotel should protect and market.
4. "trend": 1–2 sentences — how recent guest sentiment compares to older reviews. If stable, say so briefly.

Be direct, specific, and practical. This is an internal briefing, not a public summary.

Respond ONLY with valid JSON: {"summary": "...", "issues": "...", "strengths": "...", "trend": "..."}`;
    }

    // ── Call GPT ─────────────────────────────────────────────────────────────
    const client = getClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 450,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned) as InsightsResult;

    insightsCache.set(key, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Error in /api/generate-insights:", err);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
