/**
 * lib/ml/topic-classifier.ts
 *
 * Embedding-based topic classifier.
 *
 * Each topic has a rich natural-language description designed to capture its
 * semantic space, not just surface keywords. The incoming review text is
 * embedded and compared (cosine similarity) against each topic description.
 * Topics above the threshold are assigned.
 *
 * This replaces string.includes() keyword matching and handles:
 *  - Paraphrasing  ("lumpy mattress" → Room Comfort, no keyword hit)
 *  - Indirect references ("couldn't sleep" → Noise without the word "noise")
 *  - Negation context is partially handled by the embedding space
 */

import { TOPICS } from "@/lib/topics";
import { getEmbeddings, cosineSimilarity } from "./embeddings";

// ── Topic descriptions ─────────────────────────────────────────────────────────
// Written to cover the semantic space of each topic: core concept, synonyms,
// common guest phrasings, and indirect signals. Richer than a keyword list.

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  cleanliness:
    "Cleanliness, hygiene, and tidiness of the hotel. Dirty rooms, dust, stains, mold, bad odors, messy bathrooms, unhygienic conditions, spotless rooms, immaculate surfaces, fresh-smelling, sanitized, housekeeping quality.",

  location:
    "Location, neighborhood, and surroundings. Proximity to attractions, public transport, metro, subway, buses. Convenient or inconvenient area, central location, quiet or noisy street, walking distance to restaurants and shops.",

  food_breakfast:
    "Food quality, breakfast options, dining experience. Hotel restaurant, buffet, continental breakfast, cooked meals, coffee, juice, pastries. Tasty or bland food, limited menu, fresh ingredients, included breakfast.",

  wifi_internet:
    "WiFi and internet connectivity. Slow or fast connection, dropped signal, unable to stream, bandwidth issues, password, free WiFi, reliable or unreliable internet access.",

  parking:
    "Parking availability and experience. Car park, valet service, underground garage, parking fees, free parking, limited spaces, vehicle access, convenient or difficult parking.",

  pool_fitness:
    "Swimming pool, fitness center, gym, and recreational facilities. Pool cleanliness and temperature, gym equipment, jacuzzi, hot tub, sauna, heated pool, indoor or outdoor pool, workout facilities.",

  checkin_checkout:
    "Check-in and check-out process. Front desk efficiency, reception queue, long wait, fast service, key card, early check-in, late check-out, arrival experience, welcome process.",

  noise:
    "Noise levels and sound insulation. Loud neighbors, street traffic noise, thin walls, heard everything, construction sounds, disturbances during sleep, peaceful and quiet, earplugs needed, couldn't sleep due to noise.",

  room_comfort:
    "Room size, comfort, and quality. Bed comfort, mattress quality, pillows, lumpy or saggy bed, spacious or cramped room, air conditioning, heating, temperature control, cozy suite, sofa bed, linens and bedding.",

  bathroom:
    "Bathroom facilities and quality. Shower pressure, hot water availability, bathtub, toilet, towels, toiletries, shampoo, soap, hairdryer, vanity, clean or dirty bathroom, en suite.",

  staff_service:
    "Staff attitude, helpfulness, and overall service quality. Friendly or rude staff, professional, attentive, concierge, receptionist, excellent or poor service, went above and beyond, accommodating, ignored guests.",

  value:
    "Value for money and pricing. Expensive, overpriced, good deal, affordable, worth the price, bang for the buck, not worth the cost, price relative to quality and facilities offered.",

  spa_wellness:
    "Spa treatments, wellness, and relaxation facilities. Massage, facial, body treatment, sauna, steam room, aromatherapy, manicure, pedicure, wellness center, rejuvenating experience.",

  accessibility:
    "Accessibility for guests with disabilities or mobility challenges. Wheelchair access, ramps, elevator, lift, hearing loop, visual impairment support, special needs accommodation, ADA compliance.",

  eco_sustainability:
    "Eco-friendliness and sustainability practices. Recycling, solar panels, carbon footprint, organic products, plastic-free, environmental certifications, green hotel, sustainable sourcing.",
};

// ── Topic embedding cache ──────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _topicEmbeddings: Map<string, number[]> | undefined;
}

const topicEmbeddingCache: Map<string, number[]> =
  globalThis._topicEmbeddings ?? (globalThis._topicEmbeddings = new Map());

async function getTopicEmbeddings(): Promise<Map<string, number[]>> {
  const missing = TOPICS.filter((t) => !topicEmbeddingCache.has(t.id));
  if (missing.length > 0) {
    const descriptions = missing.map((t) => TOPIC_DESCRIPTIONS[t.id] ?? t.label);
    const embeddings = await getEmbeddings(descriptions);
    for (let i = 0; i < missing.length; i++) {
      topicEmbeddingCache.set(missing[i].id, embeddings[i]);
    }
  }
  return topicEmbeddingCache;
}

// ── Classifier ─────────────────────────────────────────────────────────────────

export interface ClassificationResult {
  topicId: string;
  similarity: number; // cosine similarity 0–1
}

/**
 * Classify a single review text using embedding similarity.
 * Returns topics whose similarity exceeds the threshold, sorted by score.
 */
export async function classifyTextML(
  text: string,
  threshold = 0.32
): Promise<ClassificationResult[]> {
  const [reviewEmbedding, topicEmbeddings] = await Promise.all([
    getEmbeddings([text]).then((r) => r[0]),
    getTopicEmbeddings(),
  ]);

  const results: ClassificationResult[] = [];
  for (const [topicId, topicEmb] of topicEmbeddings) {
    const sim = cosineSimilarity(reviewEmbedding, topicEmb);
    if (sim >= threshold) {
      results.push({ topicId, similarity: sim });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Batch-classify multiple reviews in one round-trip (one embedding call).
 * Returns an array of classification results, one entry per input text.
 */
export async function classifyTextsBatchML(
  texts: string[],
  threshold = 0.32
): Promise<ClassificationResult[][]> {
  const [reviewEmbeddings, topicEmbeddings] = await Promise.all([
    getEmbeddings(texts),
    getTopicEmbeddings(),
  ]);

  return reviewEmbeddings.map((reviewEmb) => {
    const results: ClassificationResult[] = [];
    for (const [topicId, topicEmb] of topicEmbeddings) {
      const sim = cosineSimilarity(reviewEmb, topicEmb);
      if (sim >= threshold) {
        results.push({ topicId, similarity: sim });
      }
    }
    return results.sort((a, b) => b.similarity - a.similarity);
  });
}
