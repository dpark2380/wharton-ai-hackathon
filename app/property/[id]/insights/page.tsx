import { notFound } from "next/navigation";
import { loadProperties } from "@/lib/data";
import PropertyInsights from "@/components/PropertyInsights";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function InsightsPage({ params }: Props) {
  const { id } = await params;
  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-extrabold text-[#1E243A]">AI Insights</h2>
        <p className="text-sm text-gray-500 mt-1">
          Plain-English summaries of what guests are saying, overall and by topic.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E7EF] p-6">
        <PropertyInsights propertyId={id} />
      </div>
    </div>
  );
}
