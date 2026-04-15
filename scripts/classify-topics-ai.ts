/**
 * scripts/classify-topics-ai.ts
 *
 * Classifies every review in Reviews_PROC.csv by which of the 15 topics it
 * covers, using GPT-4o-mini. Reviews are sent in batches of 12.
 *
 * The result is written to lib/topic-classifications.json, a map of
 * sha256(review_text)[0..15] → string[] (topic IDs).
 *
 * analyzeProperty() reads this cache and falls back to keyword matching for
 * any review not present (e.g. new live reviews submitted during the demo).
 *
 * Run:    npx tsx scripts/classify-topics-ai.ts
 * Cost:   ~$1–3 for the full dataset (gpt-4o-mini)
 * Resume: re-running skips already-classified reviews.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// ── Config ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 12;
const MODEL = "gpt-4o-mini";
const DATA_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(process.cwd(), "lib", "topic-classifications.json");
const DELAY_MS = 300; // between batches, stay well under rate limits

// ── Topics (mirrors lib/topics.ts) ───────────────────────────────────────────

const TOPICS = [
  { id: "cleanliness",        desc: "Room or property cleanliness, hygiene, dust, stains, odor, mold" },
  { id: "location",           desc: "Neighborhood quality, proximity to attractions or transport, area safety" },
  { id: "food_breakfast",     desc: "Breakfast, restaurant, food quality, dining, coffee, bar" },
  { id: "wifi_internet",      desc: "WiFi speed, internet connectivity, signal strength" },
  { id: "parking",            desc: "Parking availability, parking cost, valet, garage" },
  { id: "pool_fitness",       desc: "Swimming pool, gym, fitness equipment, hot tub, sauna" },
  { id: "checkin_checkout",   desc: "Check-in or check-out process, front desk, wait times, key cards" },
  { id: "noise",              desc: "Noise levels, soundproofing, quiet environment, traffic or party noise" },
  { id: "room_comfort",       desc: "Room size, bed comfort, pillows, mattress, temperature, air conditioning" },
  { id: "bathroom",           desc: "Bathroom quality, shower, hot water pressure, toiletries, towels" },
  { id: "staff_service",      desc: "Staff friendliness, helpfulness, professionalism, responsiveness" },
  { id: "value",              desc: "Value for money, pricing fairness, worth the cost" },
  { id: "spa_wellness",       desc: "Spa treatments, massage, wellness facilities, steam room" },
  { id: "accessibility",      desc: "Wheelchair access, elevators, mobility aids, disability accommodation" },
  { id: "eco_sustainability", desc: "Eco-friendly practices, recycling, sustainability, green initiatives" },
];

const TOPIC_LIST = TOPICS.map((t, i) => `${i + 1}. ${t.id}: ${t.desc}`).join("\n");

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Load data ─────────────────────────────────────────────────────────────────

interface RawReview {
  review_text: string;
}

function loadReviews(): string[] {
  const filePath = path.join(DATA_DIR, "Reviews_PROC.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as RawReview[];
  return rows
    .map((r) => (r.review_text || "").trim())
    .filter((t) => t.length > 0);
}

// ── AI classification ─────────────────────────────────────────────────────────

async function classifyBatch(
  openai: OpenAI,
  batch: { hash: string; text: string }[]
): Promise<Record<string, string[]>> {
  const reviewList = batch
    .map((r, i) => `[${i + 1}] ${r.text.slice(0, 600)}`)
    .join("\n\n");

  const prompt = `You are classifying hotel reviews by topic for a hotel analytics platform.

Available topics:
${TOPIC_LIST}

For each numbered review below, identify which topics it meaningfully covers. Only include a topic if the review clearly discusses it, not a vague or passing reference.

Return ONLY a valid JSON object where each key is the review number (as a string) and the value is an array of matching topic IDs. If a review doesn't cover any topic, return an empty array.

Example format: {"1": ["cleanliness", "staff_service"], "2": ["wifi_internet"], "3": []}

Reviews:
${reviewList}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(response.choices[0].message.content || "{}");
  } catch {
    console.warn("  Warning: failed to parse batch response, skipping batch");
    return {};
  }

  const validTopicIds = new Set(TOPICS.map((t) => t.id));
  const result: Record<string, string[]> = {};

  batch.forEach((r, i) => {
    const raw = parsed[String(i + 1)];
    const topics = Array.isArray(raw)
      ? raw.filter((id): id is string => typeof id === "string" && validTopicIds.has(id))
      : [];
    result[r.hash] = topics;
  });

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY not set in .env.local");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  // Load existing cache (so we can resume)
  let cache: Record<string, string[]> = {};
  if (fs.existsSync(OUT_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
      console.log(`Loaded existing cache: ${Object.keys(cache).length} reviews already classified`);
    } catch {
      console.warn("Could not read existing cache, starting fresh");
    }
  }

  // Load all review texts and deduplicate
  console.log("Loading reviews from CSV...");
  const allTexts = loadReviews();
  console.log(`Total reviews with text: ${allTexts.length}`);

  // Deduplicate by hash
  const seen = new Set<string>();
  const toClassify: { hash: string; text: string }[] = [];

  for (const text of allTexts) {
    const hash = hashText(text);
    if (!seen.has(hash)) {
      seen.add(hash);
      if (!cache[hash]) {
        toClassify.push({ hash, text });
      }
    }
  }

  const totalUnique = seen.size;
  const alreadyCached = totalUnique - toClassify.length;
  console.log(`Unique reviews: ${totalUnique} | Already cached: ${alreadyCached} | To classify: ${toClassify.length}`);

  if (toClassify.length === 0) {
    console.log("All reviews already classified. Nothing to do.");
    return;
  }

  // Estimate cost
  const numBatches = Math.ceil(toClassify.length / BATCH_SIZE);
  const estimatedCalls = numBatches;
  console.log(`\nWill make ~${estimatedCalls} API calls in batches of ${BATCH_SIZE}`);
  console.log(`Estimated cost: ~$${(estimatedCalls * 0.002).toFixed(2)}–$${(estimatedCalls * 0.005).toFixed(2)}\n`);

  // Process in batches
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
    const batch = toClassify.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    process.stdout.write(`Batch ${batchNum}/${numBatches} (${batch.length} reviews)... `);

    try {
      const results = await classifyBatch(openai, batch);
      Object.assign(cache, results);
      processed += batch.length;
      console.log(`done. Topics found: ${Object.values(results).filter((t) => t.length > 0).length}/${batch.length} reviews`);
    } catch (err) {
      errors++;
      console.error(`FAILED, ${err instanceof Error ? err.message : err}`);
    }

    // Write cache after every batch so progress is not lost on failure
    fs.writeFileSync(OUT_FILE, JSON.stringify(cache, null, 2));

    if (i + BATCH_SIZE < toClassify.length) {
      await sleep(DELAY_MS);
    }
  }

  // Summary
  console.log("\n── Summary ──────────────────────────────────────────");
  console.log(`Reviews processed this run: ${processed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total cached: ${Object.keys(cache).length}`);
  console.log(`Output: ${OUT_FILE}`);

  // Topic coverage report
  const topicCounts: Record<string, number> = {};
  for (const topics of Object.values(cache)) {
    for (const t of topics) {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    }
  }
  console.log("\nTopic coverage across all classified reviews:");
  Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, count]) => {
      const pct = ((count / Object.keys(cache).length) * 100).toFixed(1);
      console.log(`  ${id.padEnd(22)} ${count.toString().padStart(5)} reviews (${pct}%)`);
    });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
