import { NextResponse } from "next/server";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";
import { generateFollowUpQuestions } from "@/lib/openai";
import { checkTextQuality } from "@/lib/quality";

export async function POST(request: Request) {
  try {
    const { propertyId, coveredTopics, reviewText } = await request.json();

    if (!propertyId) {
      return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    }

    // ── Server-side review quality gate (only when text was provided) ────────
    if (reviewText && reviewText.trim()) {
      const quality = checkTextQuality(reviewText);
      if (!quality.isValid) {
        return NextResponse.json(
          { error: "low_quality", feedback: quality.feedback },
          { status: 422 }
        );
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const properties = loadProperties();
    const property = properties.find((p) => p.eg_property_id === propertyId);

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const reviews = getReviewsForProperty(propertyId);
    const analysis = analyzeProperty(property, reviews);

    const gaps = analysis.topics
      .filter(
        (t) =>
          t.isRelevant &&
          t.gap !== "none" &&
          !coveredTopics.includes(t.topicId)
      )
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2, none: 3 };
        return order[a.gap] - order[b.gap];
      });

    const questions = await generateFollowUpQuestions(
      property,
      gaps,
      coveredTopics,
      reviewText
    );

    return NextResponse.json({
      questions,
      currentScore: analysis.knowledgeHealthScore,
      gaps: gaps.slice(0, 5),
    });
  } catch (err) {
    console.error("Error in /api/generate-questions:", err);
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
