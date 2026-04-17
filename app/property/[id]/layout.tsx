import { notFound } from "next/navigation";
import { loadProperties } from "@/lib/data";
import { generateHotelDisplayName } from "@/lib/utils";
import PartnerSidebar from "@/components/PartnerSidebar";
import ManagerNotifications from "@/components/ManagerNotifications";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function PropertyLayout({ children, params }: Props) {
  const { id } = await params;
  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  const propertyName = generateHotelDisplayName(
    property.property_description,
    property.city,
    property.country,
    property.star_rating
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: "#F5F7FA" }}>
      {/* Sidebar */}
      <PartnerSidebar
        propertyId={id}
        propertyName={propertyName ?? property.city}
        city={property.city}
        country={property.country}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar, desktop only (sidebar shows on desktop) */}
        <div className="hidden lg:block bg-white border-b border-[#E4E7EF]">
          <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest">Expedia Partner Central</p>
              <h1 className="text-lg font-bold text-[#1E243A] mt-0.5">{propertyName}</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href={`/review/${id}`}
                className="text-sm font-semibold px-4 py-2 rounded-lg text-[#1E243A] transition-all hover:opacity-80"
                style={{ background: "#FFC72C" }}
              >
                Preview guest flow →
              </Link>
              <ManagerNotifications />
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 py-8">
          <div className="max-w-5xl mx-auto px-6 lg:px-10">
            {children}
          </div>
        </main>

        {/* Debug link */}
        <div className="fixed bottom-4 right-4 z-50">
          <Link
            href="/debug"
            className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors px-2 py-1 rounded border border-gray-200 bg-white shadow-sm"
          >
            debug
          </Link>
        </div>
      </div>
    </div>
  );
}
