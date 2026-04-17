import { notFound } from "next/navigation";
import { loadProperties, getReviewsForProperty, parseReviewDate } from "@/lib/data";
import { reviewStore } from "@/lib/store";
import ReviewsPageClient, { HistoricalReview } from "@/components/ReviewsPageClient";
import { LiveReviewEvent } from "@/components/LiveReviewsFeed";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function ReviewsPage({ params }: Props) {
  const { id } = await params;
  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  // All historical reviews
  const rawReviews = getReviewsForProperty(id);
  const allReviews: HistoricalReview[] = rawReviews.map((r, i) => ({
    id: `hist-${i}`,
    date: parseReviewDate(r.acquisition_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    overallRating: r.rating?.overall ?? 0,
    title: r.review_title ?? "",
    text: r.review_text ?? "",
  }));

  // Live reviews (recent events)
  const recentEvents: LiveReviewEvent[] = reviewStore
    .getRecentEvents(50)
    .filter((e) => e.propertyId === id)
    .map((event) => {
      const liveReviews = reviewStore.getLiveReviewsForProperty(id);
      const liveReview = liveReviews.find((r) => r.id === event.id);
      return {
        ...event,
        submittedAt: event.submittedAt.toISOString(),
        answers: liveReview?.answers ?? [],
        photos: event.photos ?? [],
      };
    });

  return <ReviewsPageClient allReviews={allReviews} recentEvents={recentEvents} />;
}
