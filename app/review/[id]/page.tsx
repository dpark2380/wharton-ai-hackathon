import { notFound } from "next/navigation";
import Link from "next/link";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";
import ReviewFlow from "@/components/ReviewFlow";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { generateHotelDisplayName } from "@/lib/utils";

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

  const propertyName = generateHotelDisplayName(property.property_description, property.city, property.country, property.star_rating);

  const location = [property.city, property.province, property.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen" style={{ background: "#faf8f5" }}>
      {/* Header - minimal, traveler-focused */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ background: "#FEBF4F", color: "#1E243A" }}>E</div>
            <span className="font-bold text-[#1E243A] text-sm">Leave a Review</span>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#1E243A] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Change hotel
          </Link>
        </div>
      </header>

      {/* Property context - just enough so the traveler knows they're in the right place */}
      <div style={{ background: "linear-gradient(160deg, #FEBF4F 0%, #FDD47C 60%, #FFF3CD 100%)" }}>
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl font-bold"
              style={{ background: "#1E243A", color: "#FEBF4F" }}
            >
              {(propertyName[0] || "H").toUpperCase()}
            </div>
            <div>
              {property.star_rating > 0 && (
                <div className="mb-0.5">
                  <StarRow rating={property.star_rating} />
                </div>
              )}
              <h1 className="text-lg font-bold text-[#1E243A] leading-tight">{propertyName}</h1>
              <div className="flex items-center gap-1 text-[#1E243A]/60 text-sm">
                <MapPin className="w-3 h-3" />
                <span>{location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review flow - the only thing on the page */}
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
