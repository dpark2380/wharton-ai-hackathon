import fs from "fs";
import path from "path";
import Papa from "papaparse";

export interface Property {
  eg_property_id: string;
  guestrating_avg_expedia: number;
  city: string;
  province: string;
  country: string;
  star_rating: number;
  area_description: string;
  property_description: string;
  popular_amenities_list: string[];
  property_amenity_accessibility: string[];
  property_amenity_activities_nearby: string[];
  property_amenity_business_services: string[];
  property_amenity_conveniences: string[];
  property_amenity_family_friendly: string[];
  property_amenity_food_and_drink: string[];
  property_amenity_guest_services: string[];
  property_amenity_internet: string[];
  property_amenity_langs_spoken: string[];
  property_amenity_more: string[];
  property_amenity_outdoor: string[];
  property_amenity_parking: string[];
  property_amenity_spa: string[];
  property_amenity_things_to_do: string[];
  check_in_start_time: string;
  check_in_end_time: string;
  check_out_time: string;
  check_out_policy: string[];
  pet_policy: string[];
  children_and_extra_bed_policy: string[];
  check_in_instructions: string[];
  know_before_you_go: string[];
}

export interface Review {
  eg_property_id: string;
  acquisition_date: string;
  lob: string;
  rating: {
    overall: number;
    roomcleanliness: number;
    service: number;
    roomcomfort: number;
    hotelcondition: number;
    roomquality: number;
    convenienceoflocation: number;
    neighborhoodsatisfaction: number;
    valueformoney: number;
    roomamenitiesscore: number;
    communication: number;
    ecofriendliness: number;
    checkin: number;
    onlinelisting: number;
    location: number;
  };
  review_title: string;
  review_text: string;
}

function safeParseJSON<T>(val: string, fallback: T): T {
  if (!val || val.trim() === "") return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function parseDate(dateStr: string): Date {
  // Format: M/D/YY
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date(0);
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10) + (parseInt(parts[2], 10) < 50 ? 2000 : 1900);
  return new Date(year, month, day);
}

let _properties: Property[] | null = null;
let _reviews: Review[] | null = null;

function getDataDir() {
  // Works both in dev and in Vercel (process.cwd() is the project root)
  return path.join(process.cwd(), "data");
}

export function loadProperties(): Property[] {
  if (_properties) return _properties;

  const filePath = path.join(getDataDir(), "Description_PROC.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  _properties = result.data.map((row) => ({
    eg_property_id: row.eg_property_id,
    guestrating_avg_expedia: parseFloat(row.guestrating_avg_expedia) || 0,
    city: row.city || "",
    province: row.province || "",
    country: row.country || "",
    star_rating: parseFloat(row.star_rating) || 0,
    area_description: row.area_description || "",
    property_description: row.property_description || "",
    popular_amenities_list: safeParseJSON<string[]>(row.popular_amenities_list, []),
    property_amenity_accessibility: safeParseJSON<string[]>(row.property_amenity_accessibility, []),
    property_amenity_activities_nearby: safeParseJSON<string[]>(row.property_amenity_activities_nearby, []),
    property_amenity_business_services: safeParseJSON<string[]>(row.property_amenity_business_services, []),
    property_amenity_conveniences: safeParseJSON<string[]>(row.property_amenity_conveniences, []),
    property_amenity_family_friendly: safeParseJSON<string[]>(row.property_amenity_family_friendly, []),
    property_amenity_food_and_drink: safeParseJSON<string[]>(row.property_amenity_food_and_drink, []),
    property_amenity_guest_services: safeParseJSON<string[]>(row.property_amenity_guest_services, []),
    property_amenity_internet: safeParseJSON<string[]>(row.property_amenity_internet, []),
    property_amenity_langs_spoken: safeParseJSON<string[]>(row.property_amenity_langs_spoken, []),
    property_amenity_more: safeParseJSON<string[]>(row.property_amenity_more, []),
    property_amenity_outdoor: safeParseJSON<string[]>(row.property_amenity_outdoor, []),
    property_amenity_parking: safeParseJSON<string[]>(row.property_amenity_parking, []),
    property_amenity_spa: safeParseJSON<string[]>(row.property_amenity_spa, []),
    property_amenity_things_to_do: safeParseJSON<string[]>(row.property_amenity_things_to_do, []),
    check_in_start_time: row.check_in_start_time || "",
    check_in_end_time: row.check_in_end_time || "",
    check_out_time: row.check_out_time || "",
    check_out_policy: safeParseJSON<string[]>(row.check_out_policy, []),
    pet_policy: safeParseJSON<string[]>(row.pet_policy, []),
    children_and_extra_bed_policy: safeParseJSON<string[]>(row.children_and_extra_bed_policy, []),
    check_in_instructions: safeParseJSON<string[]>(row.check_in_instructions, []),
    know_before_you_go: safeParseJSON<string[]>(row.know_before_you_go, []),
  }));

  return _properties;
}

export function loadReviews(): Review[] {
  if (_reviews) return _reviews;

  const filePath = path.join(getDataDir(), "Reviews_PROC.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  _reviews = result.data.map((row) => ({
    eg_property_id: row.eg_property_id,
    acquisition_date: row.acquisition_date,
    lob: row.lob,
    rating: safeParseJSON(row.rating, {
      overall: 0, roomcleanliness: 0, service: 0, roomcomfort: 0,
      hotelcondition: 0, roomquality: 0, convenienceoflocation: 0,
      neighborhoodsatisfaction: 0, valueformoney: 0, roomamenitiesscore: 0,
      communication: 0, ecofriendliness: 0, checkin: 0, onlinelisting: 0, location: 0,
    }),
    review_title: row.review_title || "",
    review_text: row.review_text || "",
  }));

  return _reviews;
}

export function getReviewsForProperty(propertyId: string): Review[] {
  return loadReviews().filter((r) => r.eg_property_id === propertyId);
}

export function parseReviewDate(dateStr: string): Date {
  return parseDate(dateStr);
}
