import { notFound } from "next/navigation";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";
import { getLearnedWeights, learnPropertyWeights } from "@/lib/ml/continuous-learning";
import TopicCoverageMap from "@/components/TopicCoverageMap";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function TopicsPage({ params }: Props) {
  const { id } = await params;
  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  const reviews = getReviewsForProperty(id);
  const learnedWeights = getLearnedWeights(id) ?? learnPropertyWeights(id, reviews);
  const analysis = analyzeProperty(property, reviews, false, learnedWeights);

  const highGaps = analysis.topGaps.filter((g) => g.gap === "high");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#1E243A]">Topic Coverage</h2>
        <p className="text-sm text-gray-500 mt-1">
          How well each topic area is covered by guest reviews: recency, volume, and sentiment.
        </p>
      </div>

      {highGaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {highGaps.length} topics have zero guest reviews
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {highGaps.map((g) => g.topicLabel).join(" · ")}
            </p>
          </div>
          <Link
            href={`/review/${id}`}
            className="ml-auto text-xs font-semibold text-amber-800 underline underline-offset-2 whitespace-nowrap"
          >
            Collect reviews →
          </Link>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E4E7EF] p-6">
        <TopicCoverageMap
          topics={analysis.topics}
          reviews={reviews}
          propertyId={id}
        />
      </div>
    </div>
  );
}
