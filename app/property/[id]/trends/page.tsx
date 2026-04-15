import { notFound } from "next/navigation";
import { loadProperties } from "@/lib/data";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function TrendsPage({ params }: Props) {
  const { id } = await params;
  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  // Dynamically import the client chart component
  const { default: TrendsClient } = await import("./TrendsClient");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-extrabold text-[#1E243A]">Satisfaction Trends</h2>
        <p className="text-sm text-gray-500 mt-1">
          Historical guest satisfaction over time, overall and by topic.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E7EF] p-6">
        <TrendsClient propertyId={id} />
      </div>
    </div>
  );
}
