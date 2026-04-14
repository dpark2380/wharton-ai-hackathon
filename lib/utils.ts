import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// lib/utils.ts
export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function titleCase(str: string) {
  return str.toLowerCase().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

export function generateHotelDisplayName(
  description: string,
  city: string,
  country: string,
  starRating: number
): string {
  const desc = description.toLowerCase();

  let type = "Hotel";
  if (/\bresort\b/.test(desc))        type = "Resort";
  else if (/\bhostel\b/.test(desc))   type = "Hostel";
  else if (/\binn\b/.test(desc))      type = "Inn";
  else if (/\bmotel\b/.test(desc))    type = "Motel";
  else if (/\bvilla\b/.test(desc))    type = "Villa";
  else if (/\bboutique\b/.test(desc)) type = "Boutique Hotel";
  else if (/\baparthotel\b|apartment/.test(desc)) type = "Aparthotel";

  const location = [city, country].filter(Boolean).join(", ");

  return `${type} in ${location}`;
}