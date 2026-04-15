import { NextResponse } from "next/server";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty, invalidateAnalysisCache } from "@/lib/analysis";
import { checkAnswerQuality } from "@/lib/quality";
import { reviewStore, LiveReview, LiveAnswer, LivePhoto } from "@/lib/store";
import { generateHotelDisplayName } from "@/lib/utils";
import { invalidateInsightsCache } from "@/lib/insights-cache";
import { invalidateMLCache } from "@/lib/ml/analyze-ml";
import { randomUUID, createHash } from "crypto";
import { classifyTextML } from "@/lib/ml/topic-classifier";
import { liveClassificationCache } from "@/lib/live-classification-cache";

interface AnswerPayload {
  topicId: string;
  topicLabel?: string;
  answer: string;
  type: "text" | "yes_no" | "multiple_choice";
}

export async function POST(request: Request) {
  try {
    const { propertyId, answers, coveredTopicIds, overallRating, reviewText, travelerName, photos: rawPhotos } =
      await request.json() as {
        propertyId: string;
        answers: AnswerPayload[];
        coveredTopicIds?: string[];
        overallRating?: number;
        reviewText?: string;
        travelerName?: string;
        photos?: { dataUrl: string; topicId: string; topicLabel: string; sentiment: "positive" | "negative" | "neutral"; label: string }[];
      };

    if (!propertyId || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const properties = loadProperties();
    const property = properties.find((p) => p.eg_property_id === propertyId);
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // ── Score before adding the new review ───────────────────────────────────
    const reviewsBefore = getReviewsForProperty(propertyId);
    const analysisBefore = analyzeProperty(property, reviewsBefore);
    const previousScore = analysisBefore.knowledgeHealthScore;

    // ── Persist new review to in-memory store ────────────────────────────────
    const liveAnswers: LiveAnswer[] = answers.map((a) => ({
      topicId: a.topicId,
      topicLabel: a.topicLabel ?? a.topicId,
      answer: a.answer,
      type: a.type,
    }));

    const livePhotos: LivePhoto[] = (rawPhotos ?? []).map((p) => ({
      id: randomUUID(),
      dataUrl: p.dataUrl,
      topicId: p.topicId,
      topicLabel: p.topicLabel,
      sentiment: p.sentiment,
      label: p.label,
    }));

    const liveReview: LiveReview = {
      id: randomUUID(),
      propertyId,
      submittedAt: new Date(),
      overallRating: overallRating ?? 0,
      reviewText: reviewText ?? "",
      coveredTopicIds: Array.isArray(coveredTopicIds) ? coveredTopicIds : [],
      answers: liveAnswers,
      photos: livePhotos,
      travelerName: travelerName ?? "Anonymous",
    };

    reviewStore.addReview(liveReview);

    // ── Classify review text with embeddings (fire-and-forget) ───────────────
    // Populates liveClassificationCache so classifyReview() in analysis.ts
    // uses embeddings instead of keyword fallback on the next analysis pass.
    if (reviewText?.trim()) {
      const hash = createHash("sha256").update(reviewText.trim()).digest("hex").slice(0, 16);
      classifyTextML(reviewText)
        .then((results) => {
          liveClassificationCache.set(hash, results.map((r) => r.topicId));
        })
        .catch((err) => console.error("Embedding classification failed:", err));
    }

    // ── Invalidate caches so next request picks up the new review ────────────
    invalidateAnalysisCache(propertyId);
    invalidateInsightsCache(propertyId);
    invalidateMLCache(propertyId);

    // ── Compute new score (now includes the live review) ─────────────────────
    const reviewsAfter = getReviewsForProperty(propertyId);
    const analysisAfter = analyzeProperty(property, reviewsAfter);

    // Topics that improved: answered follow-up topics + topics from review text
    const validAnswers = answers.filter((a) => checkAnswerQuality(a.answer, a.type));
    const answerTopicIds = validAnswers.map((a) => a.topicId);
    const reviewTopicIds = Array.isArray(coveredTopicIds) ? coveredTopicIds : [];
    const photoTopicIds = livePhotos.map((p) => p.topicId);
    const improvedTopics = [...new Set([...answerTopicIds, ...reviewTopicIds, ...photoTopicIds])];

    const newScore = analysisAfter.knowledgeHealthScore;
    const improvement = newScore - previousScore;

    // ── Push event for SSE (manager notifications) ───────────────────────────
    const propertyName = generateHotelDisplayName(
      property.property_description,
      property.city,
      property.country,
      property.star_rating
    );

    reviewStore.pushEvent({
      id: liveReview.id,
      propertyId,
      propertyName,
      submittedAt: liveReview.submittedAt,
      previousScore,
      newScore,
      improvement,
      improvedTopics,
      reviewText: liveReview.reviewText,
      overallRating: liveReview.overallRating,
      travelerName: liveReview.travelerName,
      photos: livePhotos.map((p) => ({
        dataUrl: p.dataUrl,
        topicId: p.topicId,
        label: p.label,
        sentiment: p.sentiment,
      })),
    });

    return NextResponse.json({
      previousScore,
      newScore,
      improvement,
      improvedTopics,
      rejectedCount: answers.length - validAnswers.length,
    });
  } catch (err) {
    console.error("Error in /api/process-answer:", err);
    return NextResponse.json({ error: "Failed to process answer" }, { status: 500 });
  }
}
