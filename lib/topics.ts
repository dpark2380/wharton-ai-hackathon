export interface Topic {
  id: string;
  label: string;
  keywords: string[];
  amenityKeys: string[]; // amenity keywords that make this topic relevant
}

export const TOPICS: Topic[] = [
  {
    id: "cleanliness",
    label: "Cleanliness",
    keywords: [
      "clean", "dirty", "spotless", "filthy", "hygiene", "hygienic", "dust", "dusty",
      "stain", "stained", "immaculate", "tidy", "mess", "messy", "sanitize", "sanitized",
      "fresh", "odor", "smell", "smelly", "wipe", "mold", "mould", "germ", "bacteria"
    ],
    amenityKeys: [],
  },
  {
    id: "location",
    label: "Location & Neighborhood",
    keywords: [
      "location", "located", "neighborhood", "neighbourhood", "area", "nearby",
      "walking distance", "close to", "near", "central", "convenient", "accessible",
      "public transport", "subway", "metro", "bus", "taxi", "uber", "downtown",
      "city center", "quiet street", "noisy street", "surroundings"
    ],
    amenityKeys: ["convenienceoflocation", "neighborhoodsatisfaction"],
  },
  {
    id: "food_breakfast",
    label: "Food & Breakfast",
    keywords: [
      "breakfast", "food", "meal", "dining", "restaurant", "buffet", "brunch",
      "lunch", "dinner", "menu", "cuisine", "delicious", "tasty", "bland",
      "coffee", "tea", "juice", "eggs", "pastry", "continental", "cooked",
      "included breakfast", "free breakfast", "bar", "snack"
    ],
    amenityKeys: ["breakfast", "restaurant", "bar", "food_and_drink"],
  },
  {
    id: "wifi_internet",
    label: "WiFi & Internet",
    keywords: [
      "wifi", "wi-fi", "internet", "connection", "online", "bandwidth",
      "slow wifi", "fast wifi", "network", "signal", "streaming", "speed",
      "connectivity", "disconnect", "password", "hotspot"
    ],
    amenityKeys: ["internet", "wifi"],
  },
  {
    id: "parking",
    label: "Parking",
    keywords: [
      "parking", "car park", "carpark", "park my car", "valet", "garage",
      "lot", "spaces", "vehicle", "free parking", "paid parking",
      "parking fee", "parking spot", "underground parking"
    ],
    amenityKeys: ["parking", "free_parking"],
  },
  {
    id: "pool_fitness",
    label: "Pool & Fitness",
    keywords: [
      "pool", "swimming", "swim", "gym", "fitness", "workout", "exercise",
      "jacuzzi", "hot tub", "sauna", "heated pool", "indoor pool",
      "outdoor pool", "lap pool", "poolside", "weights", "treadmill", "spa pool"
    ],
    amenityKeys: ["pool", "fitness_equipment", "hot_tub", "outdoor"],
  },
  {
    id: "checkin_checkout",
    label: "Check-in & Check-out",
    keywords: [
      "check-in", "check in", "checkout", "check-out", "check out",
      "arrival", "reception", "front desk", "late check-in", "early check-in",
      "key card", "key", "welcome", "greeted", "wait", "queue", "line"
    ],
    amenityKeys: ["checkin", "frontdesk_24_hour"],
  },
  {
    id: "noise",
    label: "Noise & Quiet",
    keywords: [
      "noise", "noisy", "quiet", "loud", "sound", "peaceful", "silent",
      "disturbance", "distracted", "neighbors", "party", "music", "traffic",
      "earplugs", "thin walls", "sound insulation", "heard everything", "construction"
    ],
    amenityKeys: [],
  },
  {
    id: "room_comfort",
    label: "Room Size & Comfort",
    keywords: [
      "room", "bed", "pillow", "mattress", "comfortable", "uncomfortable",
      "spacious", "cramped", "small room", "large room", "cozy", "suite",
      "king bed", "queen bed", "twin", "double", "sofa bed", "bedding",
      "linens", "blanket", "duvet", "temperature", "air conditioning", "heating", "ac"
    ],
    amenityKeys: ["roomcomfort", "roomquality", "ac"],
  },
  {
    id: "bathroom",
    label: "Bathroom",
    keywords: [
      "bathroom", "shower", "bath", "tub", "bathtub", "toilet", "sink",
      "towel", "toiletries", "shampoo", "soap", "hot water", "water pressure",
      "bidet", "hairdryer", "hair dryer", "vanity", "mirror", "en suite"
    ],
    amenityKeys: [],
  },
  {
    id: "staff_service",
    label: "Staff & Service",
    keywords: [
      "staff", "service", "helpful", "friendly", "rude", "professional",
      "attentive", "concierge", "receptionist", "manager", "housekeeper",
      "responsive", "excellent service", "poor service", "accommodating",
      "hospitality", "went above and beyond", "helpful staff", "team"
    ],
    amenityKeys: ["service", "guest_services"],
  },
  {
    id: "value",
    label: "Value for Money",
    keywords: [
      "value", "price", "worth", "expensive", "cheap", "affordable", "overpriced",
      "good value", "bad value", "price point", "cost", "fee", "charge",
      "money's worth", "budget", "luxury", "bang for your buck"
    ],
    amenityKeys: ["valueformoney"],
  },
  {
    id: "spa_wellness",
    label: "Spa & Wellness",
    keywords: [
      "spa", "massage", "treatment", "facial", "wellness", "relaxation",
      "sauna", "steam room", "therapy", "body wrap", "aromatherapy",
      "manicure", "pedicure", "nail", "relaxing", "rejuvenate"
    ],
    amenityKeys: ["spa"],
  },
  {
    id: "accessibility",
    label: "Accessibility",
    keywords: [
      "wheelchair", "disabled", "disability", "accessible", "accessibility",
      "ramp", "elevator", "lift", "mobility", "hearing loop", "visual impairment",
      "special needs", "ada", "handicap", "assistance"
    ],
    amenityKeys: ["accessibility", "elevator"],
  },
  {
    id: "eco_sustainability",
    label: "Eco & Sustainability",
    keywords: [
      "eco", "sustainable", "green", "environment", "recycling", "solar",
      "carbon", "organic", "eco-friendly", "environmental", "planet",
      "renewable", "plastic-free", "compost", "local produce"
    ],
    amenityKeys: ["ecofriendliness"],
  },
];

export function classifyText(text: string): Set<string> {
  if (!text) return new Set();
  const lower = text.toLowerCase();
  const matched = new Set<string>();
  for (const topic of TOPICS) {
    for (const kw of topic.keywords) {
      if (lower.includes(kw)) {
        matched.add(topic.id);
        break;
      }
    }
  }
  return matched;
}

export function getTopicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}
