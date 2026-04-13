import { NextResponse } from "next/server";
import { loadProperties, loadReviews, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const properties = loadProperties();
    const reviews = loadReviews();

    const result = properties.map((property) => {
      const propertyReviews = reviews.filter(
        (r) => r.eg_property_id === property.eg_property_id
      );
      const analysis = analyzeProperty(property, propertyReviews);

      return {
        eg_property_id: property.eg_property_id,
        city: property.city,
        country: property.country,
        province: property.province,
        star_rating: property.star_rating,
        guestrating_avg_expedia: property.guestrating_avg_expedia,
        popular_amenities_list: property.popular_amenities_list,
        property_description: property.property_description,
        knowledgeHealthScore: analysis.knowledgeHealthScore,
        totalReviews: analysis.totalReviews,
        reviewsWithText: analysis.reviewsWithText,
        topGaps: analysis.topGaps.slice(0, 3),
        topTopics: analysis.topics
          .filter((t) => t.isRelevant)
          .sort((a, b) => b.coverageScore - a.coverageScore)
          .slice(0, 5),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error in /api/properties:", err);
    return NextResponse.json({ error: "Failed to load properties" }, { status: 500 });
  }
}
