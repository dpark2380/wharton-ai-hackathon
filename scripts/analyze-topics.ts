/**
 * scripts/analyze-topics.ts
 *
 * One-time analysis script to discover, validate, and refine hotel review topics
 * using GPT-4o-mini. Makes exactly 4 API calls on a smart stratified sample.
 *
 * Run with:  npx tsx scripts/analyze-topics.ts
 * Cost:      ~$0.30–0.80 depending on review length
 *
 * Outputs:
 *   lib/topics-refined.ts           ← review, then rename to topics.ts when happy
 *   scripts/topic-analysis-report.md ← full human-readable analysis
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // or '.env'

// ── Config ────────────────────────────────────────────────────────────────────

const SAMPLE_SIZE = 400;       // total reviews to sample
const MODEL = "gpt-4o-mini";
const DATA_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(process.cwd(), "lib", "topics-refined.ts");
const REPORT_FILE = path.join(process.cwd(), "scripts", "topic-analysis-report.md");

// Structured rating keys that exist in Reviews_PROC.csv
const AVAILABLE_RATING_KEYS = [
  "roomcleanliness", "service", "roomcomfort", "hotelcondition", "roomquality",
  "convenienceoflocation", "neighborhoodsatisfaction", "valueformoney",
  "roomamenitiesscore", "communication", "ecofriendliness", "checkin", "location",
];

// Current hand-crafted topics, used in reconciliation call
const EXISTING_TOPICS = [
  { id: "cleanliness",       label: "Cleanliness" },
  { id: "location",          label: "Location & Neighborhood" },
  { id: "food_breakfast",    label: "Food & Breakfast" },
  { id: "wifi_internet",     label: "WiFi & Internet" },
  { id: "parking",           label: "Parking" },
  { id: "pool_fitness",      label: "Pool & Fitness" },
  { id: "checkin_checkout",  label: "Check-in & Check-out" },
  { id: "noise",             label: "Noise & Quiet" },
  { id: "room_comfort",      label: "Room Size & Comfort" },
  { id: "bathroom",          label: "Bathroom" },
  { id: "staff_service",     label: "Staff & Service" },
  { id: "value",             label: "Value for Money" },
  { id: "spa_wellness",      label: "Spa & Wellness" },
  { id: "accessibility",     label: "Accessibility" },
  { id: "eco_sustainability", label: "Eco & Sustainability" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiscoveredTopic {
  id: string;
  label: string;
  example_phrases: string[];
  frequency_pct: number;
  typical_sentiment: string;
}

interface ReconciliationEntry {
  action: "keep" | "add" | "merge" | "remove";
  id: string;
  label: string;
  rationale: string;
  amenityKeys: string[];
  ratingKeys: string[];
}

interface ReconciliationResult {
  reconciliation: ReconciliationEntry[];
  final_topics: { id: string; label: string; amenityKeys: string[]; ratingKeys: string[] }[];
}

interface PersonaResult {
  persona_counts: Record<string, number>;
  confidence: string;
  persona_weights: Record<string, Record<string, number>>;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stdout.write(msg + "\n");
}

function parseJSON<T>(raw: string, label: string): T | null {
  try {
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    log(`  ⚠  Failed to parse JSON from ${label}. Raw preview:`);
    log("  " + raw.slice(0, 300));
    return null;
  }
}

async function callGPT(client: OpenAI, prompt: string, label: string): Promise<string> {
  log(`\n🤖  ${label} ...`);
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 3000,
  });
  const tokens = res.usage?.total_tokens ?? "?";
  log(`    ✓ done  (${tokens} tokens used)`);
  return res.choices[0]?.message?.content ?? "";
}

// ── Sampling ──────────────────────────────────────────────────────────────────

interface ReviewRow {
  review_text: string;
  rating: string;
}

function loadAndSample(): { text: string; rating: number }[] {
  log("📂  Loading reviews from CSV ...");
  const raw = fs.readFileSync(path.join(DATA_DIR, "Reviews_PROC.csv"), "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true }) as ReviewRow[];

  // Keep only reviews with meaningful text
  const withText = rows.filter(
    (r) => r.review_text && r.review_text.trim().length > 30
  );
  log(`    ${withText.length} reviews with text  (${rows.length} total)`);

  // Parse overall rating and bucket by 1–5
  const buckets: Record<number, typeof withText> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const r of withText) {
    try {
      const rating = JSON.parse(r.rating) as Record<string, number>;
      const overall = Math.round(rating.overall ?? 0);
      if (overall >= 1 && overall <= 5) buckets[overall].push(r);
    } catch {
      // skip malformed
    }
  }

  // Stratified sample: equal share per bucket, shuffle each bucket first
  const perBucket = Math.floor(SAMPLE_SIZE / 5);
  const sampled: { text: string; rating: number }[] = [];

  for (let star = 1; star <= 5; star++) {
    const pool = buckets[star].sort(() => Math.random() - 0.5);
    for (const r of pool.slice(0, perBucket)) {
      sampled.push({
        text: r.review_text.trim().slice(0, 350), // cap per-review tokens
        rating: star,
      });
    }
  }

  log(`    Sampled ${sampled.length} reviews  (${perBucket} per star rating)`);
  return sampled.sort(() => Math.random() - 0.5);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("❌  OPENAI_API_KEY is not set. Add it to your .env.local and re-run.");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });
  const reviews = loadAndSample();

  // Split sample: half for discovery, half for keyword extraction
  // Persona call reuses the first 150 to avoid extra cost
  const mid = Math.floor(reviews.length / 2);
  const half1 = reviews.slice(0, mid);
  const half2 = reviews.slice(mid);

  const formatBatch = (batch: typeof reviews) =>
    batch.map((r) => `[${r.rating}★] ${r.text}`).join("\n---\n");

  const report: string[] = [
    "# Topic Analysis Report",
    `Generated: ${new Date().toISOString()}`,
    `Sample size: ${reviews.length} reviews`,
    "",
  ];

  // ── Call 1: Topic Discovery ──────────────────────────────────────────────

  const raw1 = await callGPT(
    client,
    `You are analysing hotel guest reviews to discover what topics guests actually discuss.

Here are ${half1.length} real hotel reviews (format: [rating★] text):
${formatBatch(half1)}

Identify 10–20 distinct recurring themes. For each theme provide:
- id: short snake_case identifier
- label: human-readable name (2–4 words)
- example_phrases: 5–8 short phrases actually found in these reviews
- frequency_pct: rough % of reviews that mention this theme
- typical_sentiment: "positive" | "negative" | "mixed"

Respond ONLY with a valid JSON array, no markdown fences, no extra text:
[{"id":"...","label":"...","example_phrases":["..."],"frequency_pct":15,"typical_sentiment":"mixed"}]`,
    "Call 1/4, Discovering themes from reviews"
  );

  const discoveredTopics = parseJSON<DiscoveredTopic[]>(raw1, "topic discovery") ?? [];

  report.push("## 1. Discovered Themes");
  report.push(`Found **${discoveredTopics.length}** themes:\n`);
  for (const t of discoveredTopics) {
    report.push(
      `- **${t.label}** (\`${t.id}\`): ~${t.frequency_pct}% frequency, ` +
      `typically ${t.typical_sentiment}. ` +
      `Examples: _${t.example_phrases.slice(0, 3).join("; ")}_`
    );
  }
  report.push("");

  // ── Call 2: Reconciliation ────────────────────────────────────────────────

  const raw2 = await callGPT(
    client,
    `You are reconciling AI-discovered hotel review themes with an existing hand-crafted topic list.

DISCOVERED themes (from actual reviews):
${JSON.stringify(discoveredTopics, null, 2)}

EXISTING 15 topics (currently in production):
${JSON.stringify(EXISTING_TOPICS, null, 2)}

Available structured rating fields in our database (for ratingKeys):
${AVAILABLE_RATING_KEYS.join(", ")}

For amenityKeys: use short amenity strings a hotel might list in its description
(e.g. "pool", "spa", "parking", "gym", "breakfast", "wifi", "elevator").
Topics with no amenityKeys are always tracked for every property.

Task: Produce a final definitive topic list by deciding for each existing topic:
KEEP (works as-is), MERGE (combine with a discovered theme), SPLIT (too broad),
or REMOVE (not worth tracking). And flag any discovered themes to ADD.

Respond ONLY with valid JSON, no markdown:
{
  "reconciliation": [
    {"action":"keep|add|merge|remove","id":"...","label":"...","rationale":"...","amenityKeys":["..."],"ratingKeys":["..."]}
  ],
  "final_topics": [
    {"id":"...","label":"...","amenityKeys":["..."],"ratingKeys":["..."]}
  ]
}`,
    "Call 2/4, Reconciling discovered themes with existing 15"
  );

  const reconciliation = parseJSON<ReconciliationResult>(raw2, "reconciliation") ?? {
    reconciliation: [],
    final_topics: [],
  };

  report.push("## 2. Reconciliation with Existing 15");
  report.push("");
  for (const r of reconciliation.reconciliation) {
    const icon = { keep: "✅", add: "➕", merge: "🔀", remove: "❌" }[r.action] ?? "•";
    report.push(`${icon} **${r.action.toUpperCase()}** \`${r.id}\`, ${r.label}`);
    report.push(`   > ${r.rationale}`);
  }
  report.push(`\n**Final topic count: ${reconciliation.final_topics.length}**`);
  report.push("");

  // ── Call 3: Keyword Extraction ────────────────────────────────────────────

  const finalTopics = reconciliation.final_topics;

  const raw3 = await callGPT(
    client,
    `You are extracting diagnostic classification keywords for hotel review topics.

Final topic list:
${finalTopics.map((t) => `${t.id}: ${t.label}`).join("\n")}

Here are ${half2.length} hotel reviews to mine for keywords:
${formatBatch(half2)}

For each topic, extract 15–25 keywords or short phrases that are:
- DIAGNOSTIC: strongly signal this specific topic (not generic sentiment words like "good" or "nice")
- DATA-GROUNDED: actually appear in these reviews, not invented
- VARIED: mix of nouns, verbs, adjectives, and compound phrases

Respond ONLY with valid JSON, no markdown:
{"topic_id": ["keyword1", "keyword2", ...], ...}`,
    "Call 3/4, Extracting topic keywords from review text"
  );

  const topicKeywords = parseJSON<Record<string, string[]>>(raw3, "keyword extraction") ?? {};

  report.push("## 3. Extracted Keywords");
  report.push("");
  for (const [id, kws] of Object.entries(topicKeywords)) {
    report.push(`- **${id}** (${kws.length} keywords): ${kws.slice(0, 8).join(", ")}...`);
  }
  report.push("");

  // ── Call 4: Persona Inference ─────────────────────────────────────────────

  const personaBatch = reviews.slice(0, 150);

  const raw4 = await callGPT(
    client,
    `You are analysing hotel reviews to infer traveler persona and derive topic importance weights.

Reviews (format: [rating★] text):
${formatBatch(personaBatch)}

Step 1, Infer persona for each review from language cues:
- "business": work trip, meeting, conference, WiFi for work, business center, etc.
- "family": kids, children, family, pool for children, adjoining rooms, etc.
- "couple": partner, romantic, anniversary, honeymoon, etc.
- "solo": alone, solo, by myself, single traveler, etc.
- "unknown": no clear signal

Step 2, For each persona with ≥5 inferred reviews, analyse:
- Which topics do they mention most frequently?
- Which topics do they rate most negatively?
Then assign a weight (0.1–2.5) per topic reflecting how much this persona cares about it.
1.0 = neutral/average, >1.0 = cares more, <1.0 = cares less or irrelevant.

Topics to weight: ${finalTopics.map((t) => t.id).join(", ")}

Respond ONLY with valid JSON, no markdown:
{
  "persona_counts": {"business": 0, "family": 0, "couple": 0, "solo": 0, "unknown": 0},
  "confidence": "high | medium | low",
  "persona_weights": {
    "business": {"topic_id": 1.5},
    "family":   {"topic_id": 2.0},
    "couple":   {"topic_id": 1.3},
    "solo":     {"topic_id": 1.6}
  },
  "notes": "caveats about data sufficiency or inference quality"
}`,
    "Call 4/4, Inferring personas and deriving weights"
  );

  const personaData = parseJSON<PersonaResult>(raw4, "persona inference") ?? {
    persona_counts: {},
    confidence: "unknown",
    persona_weights: { business: {}, family: {}, couple: {}, solo: {} },
    notes: "Parse failed, using empty weights",
  };

  report.push("## 4. Persona Analysis");
  report.push("");
  report.push(`**Inferred distribution:** ${JSON.stringify(personaData.persona_counts)}`);
  report.push(`**Confidence:** ${personaData.confidence}`);
  if (personaData.notes) report.push(`**Notes:** ${personaData.notes}`);
  report.push("");
  if (personaData.persona_weights) {
    for (const [persona, weights] of Object.entries(personaData.persona_weights)) {
      const top = Object.entries(weights)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      report.push(`- **${persona}**: ${top}`);
    }
  }
  report.push("");

  // ── Build topics-refined.ts ───────────────────────────────────────────────

  log("\n📝  Writing lib/topics-refined.ts ...");

  const topicsArray = finalTopics.map((topic) => ({
    id: topic.id,
    label: topic.label,
    keywords: topicKeywords[topic.id] ?? [],
    amenityKeys: topic.amenityKeys ?? [],
    ratingKeys: topic.ratingKeys ?? [],
  }));

  const tsFile = `// AUTO-GENERATED by scripts/analyze-topics.ts
// ${new Date().toISOString()}
//
// Review this file carefully, then replace lib/topics.ts when satisfied.
// Full analysis: scripts/topic-analysis-report.md
//
// Persona confidence: ${personaData.confidence}
// ${personaData.notes ?? ""}

export interface Topic {
  id: string;
  label: string;
  keywords: string[];
  amenityKeys: string[]; // amenity keywords that make this topic relevant to a property
  ratingKeys: string[];  // structured sub-rating field names from Review.rating
}

export const TOPICS: Topic[] = ${JSON.stringify(topicsArray, null, 2)};

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

// ── Persona weights ──────────────────────────────────────────────────────────
// Derived empirically from ${personaBatch.length} sampled reviews.
// Values are multipliers on gap scores when selecting follow-up questions.
//   1.0 = neutral   >1.0 = this persona cares more   <1.0 = cares less
//
// Confidence: ${personaData.confidence}

export type PersonaType = "business" | "family" | "couple" | "solo";

export const PERSONA_WEIGHTS: Record<PersonaType, Record<string, number>> =
${JSON.stringify(personaData.persona_weights ?? {}, null, 2)};
`;

  fs.writeFileSync(OUT_FILE, tsFile, "utf-8");

  // ── Write report ──────────────────────────────────────────────────────────

  log("📄  Writing scripts/topic-analysis-report.md ...");
  fs.writeFileSync(REPORT_FILE, report.join("\n"), "utf-8");

  // ── Summary ───────────────────────────────────────────────────────────────

  log("\n" + "═".repeat(60));
  log("✅  DONE");
  log("═".repeat(60));
  log(`\n  Discovered themes:   ${discoveredTopics.length}`);
  log(`  Final topics:        ${finalTopics.length}`);
  log(`  Persona confidence:  ${personaData.confidence}`);
  log(`\n  Files written:`);
  log(`    lib/topics-refined.ts            ← review, then swap with topics.ts`);
  log(`    scripts/topic-analysis-report.md ← full analysis`);
  log(`\n  Next steps:`);
  log(`    1. Read scripts/topic-analysis-report.md`);
  log(`    2. Review lib/topics-refined.ts, check keywords and weights`);
  log(`    3. If satisfied: cp lib/topics-refined.ts lib/topics.ts`);
  log(`    4. If persona confidence is low, tune PERSONA_WEIGHTS manually`);
}

main().catch((err) => {
  log(`\n❌  Fatal error: ${err.message}`);
  process.exit(1);
});
