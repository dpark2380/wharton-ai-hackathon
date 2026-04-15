import { notFound } from "next/navigation";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import RatingAnalytics from "@/components/RatingAnalytics";
import AIUsagePieChart from "@/components/AIUsagePieChart";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function AnalyticsPage({ params }: Props) {
  const { id } = await params;
  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  const reviews = getReviewsForProperty(id);
  const ratingsData = reviews.map((r) => ({
    rating: r.rating,
    acquisition_date: r.acquisition_date,
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-extrabold text-[#1E243A]">Rating Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">
          Score breakdowns across Expedia's structured rating categories.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E7EF] p-6">
        <RatingAnalytics reviews={ratingsData} />
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E7EF] p-6">
        <AIUsagePieChart />
      </div>
    </div>
  );
}
