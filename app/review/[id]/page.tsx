import { notFound } from "next/navigation";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";
import ReviewPageClient from "./ReviewPageClient";
import { generateHotelDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: Props) {
  const { id } = await params;

  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  const reviews = getReviewsForProperty(id);
  const analysis = analyzeProperty(property, reviews);

  const propertyName = generateHotelDisplayName(
    property.property_description,
    property.city,
    property.country,
    property.star_rating
  );
  const location = [property.city, property.province, property.country]
    .filter(Boolean)
    .join(", ");

  return (
    <ReviewPageClient
      propertyId={id}
      propertyName={propertyName || "This Hotel"}
      city={property.city}
      country={property.country}
      starRating={property.star_rating}
      location={location}
      currentHealthScore={analysis.knowledgeHealthScore}
    />
  );
}
