import { NextResponse } from "next/server";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty, computeNewHealthScore } from "@/lib/analysis";
import { checkAnswerQuality } from "@/lib/quality";

interface AnswerPayload {
  topicId: string;
  answer: string;
  type: "text" | "yes_no" | "multiple_choice";
}

export async function POST(request: Request) {
  try {
    const { propertyId, answers } = await request.json() as {
      propertyId: string;
      answers: AnswerPayload[];
    };

    if (!propertyId || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Only count answers that pass quality check
    const validAnswers = answers.filter((a) =>
      checkAnswerQuality(a.answer, a.type)
    );

    const validTopicIds = validAnswers.map((a) => a.topicId);

    const properties = loadProperties();
    const property = properties.find((p) => p.eg_property_id === propertyId);
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const reviews = getReviewsForProperty(propertyId);
    const analysis = analyzeProperty(property, reviews);
    const newScore = computeNewHealthScore(analysis, validTopicIds);

    return NextResponse.json({
      previousScore: analysis.knowledgeHealthScore,
      newScore,
      improvement: newScore - analysis.knowledgeHealthScore,
      improvedTopics: validTopicIds,
      rejectedCount: answers.length - validAnswers.length,
    });
  } catch (err) {
    console.error("Error in /api/process-answer:", err);
    return NextResponse.json({ error: "Failed to process answer" }, { status: 500 });
  }
}
