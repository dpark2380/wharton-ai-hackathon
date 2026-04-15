/**
 * lib/accounts.ts
 * Simulated Expedia traveler accounts for the demo.
 * Each account has a recent booking assigned to a real property in the dataset.
 */

export interface DemoAccount {
  id: string;
  name: string;
  initial: string;
  tier: "Gold" | "Silver" | "Blue";
  tripType: "Business" | "Family" | "Couple" | "Solo";
  recentPropertyId: string;
  recentCity: string;
  recentCountry: string;
  checkOutDate: string;
  nightsStayed: number;
  startingPoints: number;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "james",
    name: "James Chen",
    initial: "J",
    tier: "Gold",
    tripType: "Business",
    recentPropertyId: "110f01b8ae518a0ee41047bce5c22572988a435e10ead72dc1af793bba8ce0b0",
    recentCity: "Pompei",
    recentCountry: "Italy",
    checkOutDate: "Apr 10, 2026",
    nightsStayed: 3,
    startingPoints: 420, // Level 4, Trusted Guide
  },
  {
    id: "sarah",
    name: "Sarah Miller",
    initial: "S",
    tier: "Gold",
    tripType: "Family",
    recentPropertyId: "db38b19b897dbece3e34919c662b3fd66d23b615395d11fb69264dd3a9b17723",
    recentCity: "Broomfield",
    recentCountry: "United States",
    checkOutDate: "Apr 8, 2026",
    nightsStayed: 5,
    startingPoints: 820, // Level 5, Platinum Guide
  },
  {
    id: "alex",
    name: "Alex Thompson",
    initial: "A",
    tier: "Silver",
    tripType: "Solo",
    recentPropertyId: "e52d67a758ce4ad0229aacc97e5dfe89984c384c51a70208f9e0cc65c9cd4676",
    recentCity: "Bangkok",
    recentCountry: "Thailand",
    checkOutDate: "Apr 11, 2026",
    nightsStayed: 7,
    startingPoints: 60, // Level 2, Insider (close to Local Expert)
  },
  {
    id: "emma",
    name: "Emma Rodriguez",
    initial: "E",
    tier: "Silver",
    tripType: "Couple",
    recentPropertyId: "823fb2499b4e37d99acb65e7198e75965d6496fd1c579f976205c0e6179206df",
    recentCity: "Rome",
    recentCountry: "Italy",
    checkOutDate: "Apr 9, 2026",
    nightsStayed: 4,
    startingPoints: 1800, // Level 6, Elite Guide
  },
  {
    id: "michael",
    name: "Michael Park",
    initial: "M",
    tier: "Blue",
    tripType: "Business",
    recentPropertyId: "fa014137b3ea9af6a90c0a86a1d099e46f7e56d6eb33db1ad1ec4bdac68c3caa",
    recentCity: "Monterey",
    recentCountry: "United States",
    checkOutDate: "Apr 12, 2026",
    nightsStayed: 2,
    startingPoints: 8, // Level 1, Explorer (just started)
  },
];

export const TIER_COLORS: Record<DemoAccount["tier"], { bg: string; text: string; border: string }> = {
  Gold:   { bg: "#FFF8E1", text: "#B8860B", border: "#FCDB32" },
  Silver: { bg: "#F5F5F5", text: "#6B7280", border: "#D1D5DB" },
  Blue:   { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
};
