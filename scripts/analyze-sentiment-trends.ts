/**
 * scripts/analyze-sentiment-trends.ts
 *
 * For each property, compares recent vs historical review sentiment per topic.
 * Flags topics where guest complaints have increased recently so managers
 * can act before the issue compounds.
 *
 * Requires lib/topic-classifications.json to exist (run classify-topics-ai first).
 *
 * Run:   npx tsx scripts/analyze-sentiment-trends.ts
 * Cost:  ~$0.05–0.20 (one GPT call per property, gpt-4o-mini)
 *
 * Output: lib/sentiment-alerts.json
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// ── Config ────────────────────────────────────────────────────────────────────

const MODEL = "gpt-4o-mini";
const DATA_DIR = path.join(process.cwd(), "data");
const CLASSIFICATIONS_FILE = path.join(process.cwd(), "lib", "topic-classifications.json");
const OUT_FILE = path.join(process.cwd(), "lib", "sentiment-alerts.json");

// Reviews from the last 18 months are "recent"; older reviews are "historical"
const NOW = new Date("2026-04-13");
const RECENT_CUTOFF = new Date(NOW);
RECENT_CUTOFF.setMonth(RECENT_CUTOFF.getMonth() - 18);

const MIN_RECENT_REVIEWS = 2;   // need at least this many recent mentions to analyse
const MIN_HISTORICAL_REVIEWS = 3; // need this many historical to have a baseline

const TOPICS = [
  { id: "cleanliness",        label: "Cleanliness" },
  { id: "location",           label: "Location & Neighborhood" },
  { id: "food_breakfast",     label: "Food & Breakfast" },
  { id: "wifi_internet",      label: "WiFi & Internet" },
  { id: "parking",            label: "Parking" },
  { id: "pool_fitness",       label: "Pool & Fitness" },
  { id: "checkin_checkout",   label: "Check-in & Check-out" },
  { id: "noise",              label: "Noise & Quiet" },
  { id: "room_comfort",       label: "Room Size & Comfort" },
  { id: "bathroom",           label: "Bathroom" },
  { id: "staff_service",      label: "Staff & Service" },
  { id: "value",              label: "Value for Money" },
  { id: "spa_wellness",       label: "Spa & Wellness" },
  { id: "accessibility",      label: "Accessibility" },
  { id: "eco_sustainability", label: "Eco & Sustainability" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SentimentAlert {
  topicId: string;
  topicLabel: string;
  recentSentiment: "positive" | "neutral" | "negative";
  trend: "improving" | "stable" | "worsening";
  severity: "urgent" | "watch" | "none";
  summary: string | null;
  recentReviewCount: number;
  historicalReviewCount: number;
}

export interface PropertySentimentResult {
  generatedAt: string;
  alerts: SentimentAlert[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

function parseDate(dateStr: string): Date {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date(0);
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10) + (parseInt(parts[2], 10) < 50 ? 2000 : 1900);
  return new Date(year, month, day);
}

// ── Load data ─────────────────────────────────────────────────────────────────

interface RawReview {
  eg_property_id: string;
  acquisition_date: string;
  review_text: string;
}

interface RawProperty {
  eg_property_id: string;
  property_description: string;
  city: string;
  country: string;
}

function loadData() {
  const reviewsRaw = parse(
    fs.readFileSync(path.join(DATA_DIR, "Reviews_PROC.csv"), "utf-8"),
    { columns: true, skip_empty_lines: true }
  ) as RawReview[];

  const propertiesRaw = parse(
    fs.readFileSync(path.join(DATA_DIR, "Description_PROC.csv"), "utf-8"),
    { columns: true, skip_empty_lines: true }
  ) as RawProperty[];

  return { reviewsRaw, propertiesRaw };
}

// ── AI analysis ───────────────────────────────────────────────────────────────

interface TopicReviews {
  topicId: string;
  topicLabel: string;
  recent: string[];
  historical: string[];
}

async function analyseProperty(
  openai: OpenAI,
  propertyDesc: string,
  city: string,
  country: string,
  topicGroups: TopicReviews[]
): Promise<Record<string, Omit<SentimentAlert, "topicId" | "topicLabel" | "recentReviewCount" | "historicalReviewCount">>> {
  const sections = topicGroups.map((tg) => {
    const recentSample = tg.recent.slice(0, 5).map((t) => `"${t.slice(0, 200)}"`).join("\n");
    const historicalSample = tg.historical.slice(0, 5).map((t) => `"${t.slice(0, 200)}"`).join("\n");
    return `[${tg.topicLabel}]
RECENT (${tg.recent.length} reviews):
${recentSample}
HISTORICAL (${tg.historical.length} reviews):
${historicalSample}`;
  }).join("\n\n");

  const prompt = `You are a hotel analytics AI helping managers identify emerging guest complaints.

Property: ${propertyDesc.replace(/\|MASK\|/g, "[hotel]").slice(0, 200)}
Location: ${city}, ${country}

Below are hotel review excerpts grouped by topic. Each group shows RECENT reviews vs HISTORICAL reviews for comparison.

${sections}

For each topic, assess:
1. recentSentiment: is the recent guest experience "positive", "neutral", or "negative"?
2. trend: compared to historical reviews, is sentiment "improving", "stable", or "worsening"?
3. severity:
   - "urgent" = recent sentiment is negative AND trend is worsening (action needed now)
   - "watch" = trend is worsening but not yet negative, OR recent sentiment is neutral trending negative
   - "none" = stable or improving
4. summary: if severity is "urgent" or "watch", write one concise sentence describing the specific issue for the manager. Otherwise null.

Return ONLY valid JSON mapping topic IDs to their results. Example:
{
  "cleanliness": {"recentSentiment": "negative", "trend": "worsening", "severity": "urgent", "summary": "Guests increasingly report unclean rooms and poor housekeeping since late 2025"},
  "staff_service": {"recentSentiment": "positive", "trend": "stable", "severity": "none", "summary": null}
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  try {
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch {
    return {};
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { console.error("OPENAI_API_KEY not set"); process.exit(1); }

  if (!fs.existsSync(CLASSIFICATIONS_FILE)) {
    console.error("lib/topic-classifications.json not found, run classify-topics-ai first");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });
  const classifications: Record<string, string[]> = JSON.parse(
    fs.readFileSync(CLASSIFICATIONS_FILE, "utf-8")
  );

  console.log("Loading data...");
  const { reviewsRaw, propertiesRaw } = loadData();

  // Group reviews by property
  const byProperty = new Map<string, RawReview[]>();
  for (const r of reviewsRaw) {
    if (!r.review_text?.trim()) continue;
    const arr = byProperty.get(r.eg_property_id) ?? [];
    arr.push(r);
    byProperty.set(r.eg_property_id, arr);
  }

  const results: Record<string, PropertySentimentResult> = {};
  const properties = propertiesRaw.filter((p) => byProperty.has(p.eg_property_id));

  console.log(`Analysing ${properties.length} properties...\n`);

  for (let pi = 0; pi < properties.length; pi++) {
    const prop = properties[pi];
    const reviews = byProperty.get(prop.eg_property_id) ?? [];

    process.stdout.write(`[${pi + 1}/${properties.length}] ${prop.city}, ${prop.country}, `);

    // Classify each review and split into recent vs historical by topic
    const topicRecent = new Map<string, string[]>();
    const topicHistorical = new Map<string, string[]>();

    for (const r of reviews) {
      const hash = hashText(r.review_text);
      const topicIds = classifications[hash] ?? [];
      const date = parseDate(r.acquisition_date);
      const isRecent = date >= RECENT_CUTOFF;

      for (const tid of topicIds) {
        if (isRecent) {
          const arr = topicRecent.get(tid) ?? [];
          arr.push(r.review_text.trim());
          topicRecent.set(tid, arr);
        } else {
          const arr = topicHistorical.get(tid) ?? [];
          arr.push(r.review_text.trim());
          topicHistorical.set(tid, arr);
        }
      }
    }

    // Only analyse topics with enough data in both windows
    const eligibleTopics: TopicReviews[] = [];
    for (const topic of TOPICS) {
      const recent = topicRecent.get(topic.id) ?? [];
      const historical = topicHistorical.get(topic.id) ?? [];
      if (recent.length >= MIN_RECENT_REVIEWS && historical.length >= MIN_HISTORICAL_REVIEWS) {
        eligibleTopics.push({ topicId: topic.id, topicLabel: topic.label, recent, historical });
      }
    }

    if (eligibleTopics.length === 0) {
      console.log(`skipped (insufficient data in both windows)`);
      results[prop.eg_property_id] = { generatedAt: NOW.toISOString(), alerts: [] };
      continue;
    }

    console.log(`${eligibleTopics.length} topics eligible`);

    try {
      const aiResults = await analyseProperty(
        openai,
        prop.property_description,
        prop.city,
        prop.country,
        eligibleTopics
      );

      const alerts: SentimentAlert[] = eligibleTopics.map((tg) => {
        const ai = aiResults[tg.topicId] ?? {};
        return {
          topicId: tg.topicId,
          topicLabel: tg.topicLabel,
          recentSentiment: ai.recentSentiment ?? "neutral",
          trend: ai.trend ?? "stable",
          severity: ai.severity ?? "none",
          summary: ai.summary ?? null,
          recentReviewCount: tg.recent.length,
          historicalReviewCount: tg.historical.length,
        };
      }).filter((a) => a.severity !== "none");

      results[prop.eg_property_id] = {
        generatedAt: NOW.toISOString(),
        alerts,
      };

      const urgent = alerts.filter((a) => a.severity === "urgent").length;
      const watch = alerts.filter((a) => a.severity === "watch").length;
      if (urgent || watch) {
        console.log(`  → ${urgent} urgent, ${watch} watch`);
        alerts.filter(a => a.severity !== "none").forEach(a => {
          console.log(`    ${a.severity.toUpperCase()} [${a.topicLabel}]: ${a.summary}`);
        });
      }
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
      results[prop.eg_property_id] = { generatedAt: NOW.toISOString(), alerts: [] };
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));

  const totalUrgent = Object.values(results).flatMap((r) => r.alerts).filter((a) => a.severity === "urgent").length;
  const totalWatch = Object.values(results).flatMap((r) => r.alerts).filter((a) => a.severity === "watch").length;

  console.log(`\n── Done ──────────────────────────────────────────────`);
  console.log(`Output: ${OUT_FILE}`);
  console.log(`Total urgent alerts: ${totalUrgent}`);
  console.log(`Total watch alerts:  ${totalWatch}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
