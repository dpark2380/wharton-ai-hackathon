import { notFound } from "next/navigation";
import Link from "next/link";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";
import ReviewFlow from "@/components/ReviewFlow";
import { ArrowLeft, MapPin, Star } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />
      ))}
    </div>
  );
}

export default async function ReviewPage({ params }: Props) {
  const { id } = await params;

  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  const reviews = getReviewsForProperty(id);
  const analysis = analyzeProperty(property, reviews);

  const propertyName = property.property_description
    .replace(/\|MASK\|/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

  const location = [property.city, property.province, property.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen" style={{ background: "#faf8f5" }}>
      {/* Header — minimal, traveler-focused */}
      <header style={{ background: "#1a1a2e" }} className="sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}>E</div>
            <span className="text-white font-bold text-sm">Leave a Review</span>
          </div>
          <Link href="/review" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Change hotel
          </Link>
        </div>
      </header>

      {/* Property context — just enough so the traveler knows they're in the right place */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl font-bold text-white"
              style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
            >
              {(propertyName[0] || "H").toUpperCase()}
            </div>
            <div>
              {property.star_rating > 0 && (
                <div className="mb-0.5">
                  <StarRow rating={property.star_rating} />
                </div>
              )}
              <h1 className="text-lg font-bold text-white leading-tight">{propertyName}</h1>
              <div className="flex items-center gap-1 text-gray-400 text-sm">
                <MapPin className="w-3 h-3" />
                <span>{location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review flow — the only thing on the page */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <ReviewFlow
          propertyId={id}
          propertyName={propertyName || "This Hotel"}
          city={property.city}
          country={property.country}
          currentHealthScore={analysis.knowledgeHealthScore}
        />
      </main>
    </div>
  );
}
