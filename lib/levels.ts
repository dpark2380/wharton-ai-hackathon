/**
 * lib/levels.ts
 *
 * Reviewer levels system, inspired by Google Local Guides.
 * Points accumulate in localStorage per demo account.
 */

export interface Perk {
  icon: string;
  title: string;
  description: string;
}

export interface Level {
  level: number;
  name: string;
  minPoints: number;
  badge: string | null;
  color: string;
  perks: Perk[];
}

export const LEVELS: Level[] = [
  {
    level: 1,
    name: "Explorer",
    minPoints: 0,
    badge: null,
    color: "#9ca3af",
    perks: [],
  },
  {
    level: 2,
    name: "Insider",
    minPoints: 15,
    badge: null,
    color: "#6b7280",
    perks: [
      { icon: "🏨", title: "Member Rates", description: "Access to exclusive member-only hotel rates on Expedia." },
    ],
  },
  {
    level: 3,
    name: "Local Expert",
    minPoints: 75,
    badge: "⭐",
    color: "#f59e0b",
    perks: [
      { icon: "🏨", title: "Member Rates", description: "Access to exclusive member-only hotel rates on Expedia." },
      { icon: "⚡", title: "Flash Sale Early Access", description: "Get notified of flash sales 24 hours before they go public." },
    ],
  },
  {
    level: 4,
    name: "Trusted Guide",
    minPoints: 250,
    badge: "🌟",
    color: "#f59e0b",
    perks: [
      { icon: "🏨", title: "Member Rates", description: "Access to exclusive member-only hotel rates on Expedia." },
      { icon: "⚡", title: "Flash Sale Early Access", description: "Get notified of flash sales 48 hours before they go public." },
      { icon: "🔔", title: "Deal Alerts", description: "First to know about last-minute price drops on hotels you've reviewed." },
      { icon: "🎧", title: "Priority Support", description: "Skip the queue with dedicated priority customer support." },
    ],
  },
  {
    level: 5,
    name: "Platinum Guide",
    minPoints: 500,
    badge: "💎",
    color: "#8b5cf6",
    perks: [
      { icon: "🏨", title: "Member Rates", description: "Access to exclusive member-only hotel rates on Expedia." },
      { icon: "⚡", title: "Flash Sale Early Access", description: "Get notified of flash sales 72 hours before they go public." },
      { icon: "🔔", title: "Deal Alerts", description: "First to know about last-minute price drops on hotels you've reviewed." },
      { icon: "💸", title: "10% Off Partner Hotels", description: "Automatic 10% discount at 500+ Expedia partner properties." },
      { icon: "🛏️", title: "Complimentary Upgrades", description: "Room upgrade requests prioritised at select properties." },
    ],
  },
  {
    level: 6,
    name: "Elite Guide",
    minPoints: 1500,
    badge: "🏆",
    color: "#ec4899",
    perks: [
      { icon: "⚡", title: "Flash Sale Early Access", description: "Get notified of flash sales 72 hours before public." },
      { icon: "💸", title: "10% Off Partner Hotels", description: "Automatic 10% discount at 500+ Expedia partner properties." },
      { icon: "🛋️", title: "Lounge Access", description: "Complimentary airport lounge access at 30+ international airports." },
      { icon: "🏨", title: "VIP Hotel Previews", description: "Exclusive invitations to review new hotel openings before launch." },
      { icon: "🎧", title: "Priority Support", description: "Dedicated VIP support line with 1-hour response guarantee." },
    ],
  },
  {
    level: 7,
    name: "Master Guide",
    minPoints: 5000,
    badge: "👑",
    color: "#ef4444",
    perks: [
      { icon: "💸", title: "15% Off All Hotels", description: "Automatic 15% discount on all Expedia hotel bookings." },
      { icon: "🚗", title: "Free Airport Transfers", description: "Complimentary airport transfers at participating hotels." },
      { icon: "🛋️", title: "Lounge Access", description: "Complimentary airport lounge access worldwide." },
      { icon: "🤵", title: "Concierge Service", description: "Personal travel concierge available 24/7." },
      { icon: "🏨", title: "VIP Hotel Previews", description: "First access to review and stay at new hotel openings." },
    ],
  },
  {
    level: 8,
    name: "Hall of Fame",
    minPoints: 15000,
    badge: "🌠",
    color: "#06b6d4",
    perks: [
      { icon: "💳", title: "Annual Travel Credit", description: "$200 annual Expedia travel credit." },
      { icon: "💸", title: "20% Off All Hotels", description: "Automatic 20% discount on all Expedia hotel bookings." },
      { icon: "🤵", title: "Concierge Service", description: "Personal travel concierge available 24/7." },
      { icon: "✈️", title: "New Destination Access", description: "First to access curated stays in newly launched destinations." },
    ],
  },
  {
    level: 9,
    name: "Legend",
    minPoints: 50000,
    badge: "🌍",
    color: "#10b981",
    perks: [
      { icon: "🏨", title: "Complimentary Stays", description: "2 complimentary hotel nights per year at partner properties." },
      { icon: "💳", title: "$500 Travel Credit", description: "Annual Expedia travel credit." },
      { icon: "🌐", title: "Global Concierge", description: "24/7 global concierge with dedicated travel manager." },
    ],
  },
  {
    level: 10,
    name: "Icon",
    minPoints: 100000,
    badge: "💫",
    color: "#f59e0b",
    perks: [
      { icon: "✨", title: "Ultimate Access", description: "Lifetime top-tier benefits, personal travel advisor, and exclusive partner experiences." },
    ],
  },
];

// ── Points calculation ─────────────────────────────────────────────────────────

export function calculatePointsEarned(reviewText: string, answerCount: number, photoCount = 0): {
  total: number;
  breakdown: { label: string; points: number }[];
} {
  const breakdown: { label: string; points: number }[] = [];

  // Star rating always given
  breakdown.push({ label: "Star rating", points: 1 });

  // Written review
  if (reviewText.trim().length > 0) {
    if (reviewText.trim().length >= 200) {
      breakdown.push({ label: "Detailed review (200+ chars)", points: 15 });
    } else {
      breakdown.push({ label: "Written review", points: 10 });
    }
  }

  // Follow-up answers
  if (answerCount > 0) {
    breakdown.push({ label: `${answerCount} follow-up answer${answerCount > 1 ? "s" : ""}`, points: answerCount * 3 });
  }

  // Photos, 5 pts each
  if (photoCount > 0) {
    breakdown.push({ label: `${photoCount} photo${photoCount > 1 ? "s" : ""} added`, points: photoCount * 5 });
  }

  const total = breakdown.reduce((s, b) => s + b.points, 0);
  return { total, breakdown };
}

// ── Level lookup ───────────────────────────────────────────────────────────────

export function getLevel(points: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.minPoints) current = level;
    else break;
  }
  return current;
}

export function getNextLevel(points: number): Level | null {
  const current = getLevel(points);
  return LEVELS.find((l) => l.level === current.level + 1) ?? null;
}

export function progressToNextLevel(points: number): number {
  const current = getLevel(points);
  const next = getNextLevel(points);
  if (!next) return 1;
  const range = next.minPoints - current.minPoints;
  const earned = points - current.minPoints;
  return Math.min(1, earned / range);
}

// ── localStorage helpers ───────────────────────────────────────────────────────

const POINTS_KEY_PREFIX = "awm_guide_points_";

export function getStoredPoints(accountId: string): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(POINTS_KEY_PREFIX + accountId) ?? "0", 10);
}

export function addPoints(accountId: string, points: number): number {
  const current = getStoredPoints(accountId);
  const next = current + points;
  localStorage.setItem(POINTS_KEY_PREFIX + accountId, String(next));
  return next;
}

export function initAccountPoints(accountId: string, startingPoints: number): void {
  if (typeof window === "undefined") return;
  const key = POINTS_KEY_PREFIX + accountId;
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, String(startingPoints));
  }
}

// ── Fake exclusive deals (shown to Level 3+) ──────────────────────────────────

export interface ExclusiveDeal {
  hotel: string;
  location: string;
  discount: string;
  originalRate: string;
  dealRate: string;
  expiresIn: string;
  hoursEarly: number;
}

export const EXCLUSIVE_DEALS: ExclusiveDeal[] = [
  {
    hotel: "Grand Hyatt Tokyo",
    location: "Tokyo, Japan",
    discount: "35% off",
    originalRate: "$420/night",
    dealRate: "$273/night",
    expiresIn: "48 hours",
    hoursEarly: 48,
  },
  {
    hotel: "W Barcelona",
    location: "Barcelona, Spain",
    discount: "28% off",
    originalRate: "$310/night",
    dealRate: "$223/night",
    expiresIn: "36 hours",
    hoursEarly: 36,
  },
  {
    hotel: "Amangiri Resort",
    location: "Utah, USA",
    discount: "20% off",
    originalRate: "$1,800/night",
    dealRate: "$1,440/night",
    expiresIn: "72 hours",
    hoursEarly: 72,
  },
];
