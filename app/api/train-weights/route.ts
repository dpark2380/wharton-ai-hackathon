/**
 * app/api/train-weights/route.ts
 *
 * POST { propertyId? }
 *   → trains learned weights for one property (or all if propertyId omitted)
 *   → returns the LearnedWeights result(s)
 *
 * GET ?propertyId=xxx
 *   → returns current learned weights for that property (null if never trained)
 *
 * In production this POST endpoint would be called nightly by a cron job.
 * For the demo, the manager can trigger it manually from the UI.
 */

import { NextResponse } from "next/server";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { learnPropertyWeights, getLearnedWeights } from "@/lib/ml/continuous-learning";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { propertyId?: string };
    const { propertyId } = body;

    const properties = loadProperties();

    if (propertyId) {
      // Train a single property
      const property = properties.find((p) => p.eg_property_id === propertyId);
      if (!property) {
        return NextResponse.json({ error: "Property not found" }, { status: 404 });
      }
      const reviews = getReviewsForProperty(propertyId);
      const weights = learnPropertyWeights(propertyId, reviews);
      return NextResponse.json(weights);
    }

    // Train all properties
    const results: Record<string, unknown> = {};
    for (const property of properties) {
      const reviews = getReviewsForProperty(property.eg_property_id);
      results[property.eg_property_id] = learnPropertyWeights(property.eg_property_id, reviews);
    }

    return NextResponse.json({ trained: Object.keys(results).length, results });
  } catch (err) {
    console.error("Error in POST /api/train-weights:", err);
    return NextResponse.json({ error: "Training failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json({ error: "propertyId required" }, { status: 400 });
    }

    const weights = getLearnedWeights(propertyId);
    return NextResponse.json(weights ?? { weights: null });
  } catch (err) {
    console.error("Error in GET /api/train-weights:", err);
    return NextResponse.json({ error: "Failed to retrieve weights" }, { status: 500 });
  }
}
