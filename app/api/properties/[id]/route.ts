import { NextResponse } from "next/server";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const properties = loadProperties();
    const property = properties.find((p) => p.eg_property_id === id);

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const reviews = getReviewsForProperty(id);
    const analysis = analyzeProperty(property, reviews);

    return NextResponse.json({
      property,
      analysis,
      recentReviews: reviews
        .filter((r) => r.review_text)
        .sort((a, b) => {
          const parse = (d: string) => {
            const [m, day, yr] = d.split("/");
            return new Date(2000 + parseInt(yr), parseInt(m) - 1, parseInt(day)).getTime();
          };
          return parse(b.acquisition_date) - parse(a.acquisition_date);
        })
        .slice(0, 10)
        .map((r) => ({
          date: r.acquisition_date,
          text: r.review_text,
          title: r.review_title,
          overallRating: r.rating.overall,
        })),
    });
  } catch (err) {
    console.error("Error in /api/properties/[id]:", err);
    return NextResponse.json({ error: "Failed to load property" }, { status: 500 });
  }
}
