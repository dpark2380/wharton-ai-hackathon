import { loadProperties } from "@/lib/data";
import { generateHotelDisplayName } from "@/lib/utils";
import HomeClient, { type HotelSummary } from "./HomeClient";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const properties = loadProperties();

  const hotels: HotelSummary[] = properties.map((p) => ({
    id: p.eg_property_id,
    name: generateHotelDisplayName(p.property_description, p.city, p.country, p.star_rating),
    city: p.city,
    country: p.country,
    province: p.province,
    starRating: p.star_rating,
    guestRating: p.guestrating_avg_expedia,
    description: p.property_description
      .replace(/\|MASK\|/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120),
    amenities: p.popular_amenities_list.slice(0, 4),
  }));

  return <HomeClient hotels={hotels} />;
}
