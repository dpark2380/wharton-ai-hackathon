import { notFound } from "next/navigation";
import { loadProperties, getReviewsForProperty, type Review } from "@/lib/data";
import { generateHotelDisplayName } from "@/lib/utils";
import { classifyReview } from "@/lib/analysis";
import { reviewStore } from "@/lib/store";
import HotelDetailClient, { type ReviewItem, type PropertyDetail } from "./HotelDetailClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HotelDetailPage({ params }: Props) {
  const { id } = await params;

  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  const csvReviews = getReviewsForProperty(id);
  const liveReviews = reviewStore.getLiveReviewsForProperty(id);

  // Build unified review list (most recent first, limited to 30 CSV + all live)
  const reviews: ReviewItem[] = [];

  // Live reviews first (most recent)
  for (const lr of liveReviews) {
    reviews.push({
      id: lr.id,
      reviewerName: lr.travelerName || "Anonymous Guest",
      reviewerInitial: lr.travelerName ? lr.travelerName.charAt(0).toUpperCase() : "A",
      isAnonymous: !lr.travelerName || lr.travelerName === "Demo User",
      date: lr.submittedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      starsOutOf5: lr.overallRating,
      title: "",
      text: lr.reviewText,
      topics: lr.coveredTopicIds,
      isLive: true,
    });
  }

  // CSV reviews (sort by date desc, take up to 30)
  const sorted = [...csvReviews].sort((a, b) => {
    const da = parseReviewDateString(a.acquisition_date);
    const db = parseReviewDateString(b.acquisition_date);
    return db - da;
  });

  for (let idx = 0; idx < Math.min(sorted.length, 30); idx++) {
    const r = sorted[idx];
    const topicIds = r.review_text ? Array.from(classifyReview(r.review_text)) : [];
    const starsOutOf5 = r.rating.overall > 5
      ? Math.round((r.rating.overall / 10) * 5)
      : r.rating.overall;
    reviews.push({
      id: `csv-${id}-${idx}`,
      reviewerName: "Anonymous Guest",
      reviewerInitial: "A",
      isAnonymous: true,
      date: formatDate(r.acquisition_date),
      starsOutOf5: starsOutOf5 || 0,
      title: r.review_title || "",
      text: r.review_text || "",
      topics: topicIds,
      isLive: false,
    });
  }

  const propertyName = generateHotelDisplayName(
    property.property_description,
    property.city,
    property.country,
    property.star_rating
  );

  // Build amenity groups
  const amenityGroups: { label: string; items: string[] }[] = [
    { label: "Popular", items: property.popular_amenities_list.slice(0, 8) },
    { label: "Food & Drink", items: property.property_amenity_food_and_drink.slice(0, 6) },
    { label: "Spa & Wellness", items: property.property_amenity_spa.slice(0, 6) },
    { label: "Outdoor", items: property.property_amenity_outdoor.slice(0, 6) },
    { label: "Nearby Activities", items: property.property_amenity_activities_nearby.slice(0, 6) },
    { label: "Business", items: property.property_amenity_business_services.slice(0, 6) },
    { label: "Family Friendly", items: property.property_amenity_family_friendly.slice(0, 6) },
  ].filter((g) => g.items.length > 0);

  const detail: PropertyDetail = {
    id,
    name: propertyName,
    city: property.city,
    country: property.country,
    province: property.province,
    starRating: property.star_rating,
    guestRating: property.guestrating_avg_expedia,
    description: property.property_description
      .replace(/\|MASK\|/g, "the hotel")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    amenityGroups,
    checkIn: property.check_in_start_time,
    checkOut: property.check_out_time,
    petPolicy: property.pet_policy.join(" ").toLowerCase().includes("not allowed") ? "No pets" : "Pets allowed",
    totalReviews: csvReviews.length + liveReviews.length,
  };

  return <HotelDetailClient detail={detail} reviews={reviews} />;
}

function parseReviewDateString(dateStr: string): number {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return 0;
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const rawYear = parseInt(parts[2], 10);
  const year = rawYear < 50 ? 2000 + rawYear : 1900 + rawYear;
  return new Date(year, month, day).getTime();
}

function formatDate(dateStr: string): string {
  const ts = parseReviewDateString(dateStr);
  if (!ts) return dateStr;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
