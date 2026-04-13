import { NextResponse } from "next/server";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty, computeNewHealthScore } from "@/lib/analysis";

export async function POST(request: Request) {
  try {
    const { propertyId, answeredTopics } = await request.json();

    if (!propertyId || !Array.isArray(answeredTopics)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const properties = loadProperties();
    const property = properties.find((p) => p.eg_property_id === propertyId);

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const reviews = getReviewsForProperty(propertyId);
    const analysis = analyzeProperty(property, reviews);
    const newScore = computeNewHealthScore(analysis, answeredTopics);

    return NextResponse.json({
      previousScore: analysis.knowledgeHealthScore,
      newScore,
      improvement: newScore - analysis.knowledgeHealthScore,
      improvedTopics: answeredTopics,
    });
  } catch (err) {
    console.error("Error in /api/process-answer:", err);
    return NextResponse.json({ error: "Failed to process answer" }, { status: 500 });
  }
}
