# Technical Overview — Hotel Coverage Intelligence Platform

Built for Expedia. Wharton AI Hackathon.

---

## 1. What the Platform Does

Hotels receive thousands of guest reviews, but coverage is uneven. A property might have 200 reviews about staff and almost nothing about the pool, parking, or accessibility. Traditional review platforms don't surface these gaps — they just display reviews chronologically.

This platform introduces a **Coverage Score** (0–100) that measures how well a hotel's guest experience is documented across 15 topic areas. It then actively closes those gaps by guiding guests through a smart review flow that asks targeted follow-up questions about the topics the hotel is missing.

There are two user-facing sides:

- **Manager dashboard** — views the Coverage Score, topic coverage map, sentiment trends, AI-generated insights, and a live review feed
- **Guest review flow** — writes a review, answers 2 AI-generated follow-up questions targeting the hotel's most urgent gaps, optionally uploads photos

---

## 2. Architecture

```
Next.js 16 (App Router)
├── Server components  — data loading, analysis, scoring
├── Client components  — interactive UI, charts, live feed
└── API routes         — ML inference, GPT calls, SSE stream

Data
├── data/Description_PROC.csv   — 13 hotel properties (static Expedia dataset)
├── data/Reviews_PROC.csv       — ~7,200 historical guest reviews
└── lib/store.ts                — in-memory store for live reviews (no database)

ML artefacts (local files, no database)
├── lib/topic-classifications.json   — sha256(review) → topic IDs (GPT pre-computed)
├── lib/ml-sentiment-cache.json      — propertyId → topicId → ABSA score
└── lib/learned-weights.json         — per-property regression weights
```

There is no external database. Property and review data come from static CSV files parsed at startup. Live reviews (submitted during the demo) are held in a `globalThis` singleton (`lib/store.ts`) that survives Next.js Hot Module Replacement. All ML results are persisted as JSON files so they survive server restarts without recomputation.

---

## 3. The 15 Topic Areas

Every review and every score is broken down across these topics:

| ID | Label | Structured rating fields used |
|---|---|---|
| `cleanliness` | Cleanliness | roomcleanliness, hotelcondition |
| `location` | Location & Neighborhood | location, convenienceoflocation, neighborhoodsatisfaction |
| `food_breakfast` | Food & Breakfast | — |
| `wifi_internet` | WiFi & Internet | — |
| `parking` | Parking | — |
| `pool_fitness` | Pool & Fitness | roomamenitiesscore |
| `checkin_checkout` | Check-in & Check-out | checkin |
| `noise` | Noise | — |
| `room_comfort` | Room Comfort | roomcomfort, roomquality |
| `bathroom` | Bathroom | — |
| `staff_service` | Staff & Service | service, communication |
| `value` | Value for Money | valueformoney |
| `spa_wellness` | Spa & Wellness | — |
| `accessibility` | Accessibility | — |
| `eco_sustainability` | Eco-Sustainability | ecofriendliness |

Topics with `amenityKeys` (parking, pool, spa, etc.) are only counted as relevant if the property's amenity listings mention those keywords. A hotel without a pool does not get penalised for having no pool reviews.

---

## 4. The Coverage Score

The Coverage Score is the single 0–100 number shown as the animated ring on every property dashboard. It is a weighted mean of per-topic scores across all relevant topics.

### Per-topic score

```
topicScore = w_coverage × coverage + w_freshness × freshness + w_sentiment × hybridSentiment

coverage  = min(1, reviewCount / 10)
freshness = max(0, 1 − daysSinceLastMention / 365)
```

Default weights: `w_coverage = 0.35`, `w_freshness = 0.35`, `w_sentiment = 0.30`.
These are replaced by per-property learned weights when sufficient data exists (see Section 6.3).

Topics with zero mentions score 0 — no knowledge, no contribution.

### Coverage Score aggregation

```
CoverageScore = Σ(importance_i × topicScore_i) / Σ(importance_i)
```

`importance_i` is a per-property, per-topic learned weight (see Section 6.3). Without learned data it degrades to a simple mean.

### Gap classification

Each topic is assigned a gap label used to prioritise follow-up questions:

```
reviewCount == 0                          → high gap   (red)
reviewCount < 3 OR stale (> 180 days)    → medium gap (amber)
coverageScore < 0.5                       → low gap    (yellow)
otherwise                                 → none       (green)
```

---

## 5. Sentiment Scoring — hybridSentimentScore

The sentiment component of each topic score blends two signals:

**S1 — Structured sub-ratings**
Expedia collects per-topic sub-ratings (e.g. `roomcleanliness`, `service`). These are averaged and normalised to 0–1. Available for ~8 of the 15 topics. Returns `null` when no reviews carry non-zero values for that topic's fields.

**S2 — Text sentiment**
One of two methods, in priority order:

1. **ML ABSA score** (preferred) — pre-computed by `scripts/run-absa.ts` using local ML models, stored in `lib/ml-sentiment-cache.json`. When a cached score exists it is used directly.
2. **Keyword counting** (fallback) — if no ABSA cache exists, counts positive/negative words across reviews mentioning the topic, mapped to `0.1 + (posRatio × 0.8)`.

**Blend formula:**
```
hybridSentiment = α × S1 + (1−α) × S2   (when S1 data exists)
hybridSentiment = S2                      (when no structured ratings)
hybridSentiment = 0.5                     (when no reviews)
```

`α` defaults to 0.55 and is learned per-property per-topic by OLS regression (see Section 6.3).

---

## 6. ML Pipeline — Local Models, No API Calls

All components in this section run entirely in-process using local model weights. There are no API calls, no per-request cost, and no network dependency after the initial model download.

### 6.1 Topic Classification — Three-Tier Pipeline

Every review must be assigned to the topics it covers. `classifyReview()` in `lib/analysis.ts` checks three sources in strict priority order:

**Tier 1 — GPT-4o batch cache** (`lib/topic-classifications.json`)
All 7,200 historical Expedia reviews were pre-classified offline using `scripts/classify-topics-ai.ts`. Results are stored as a map of `sha256(reviewText)[0..16] → string[]` (topic IDs). This covers all historical data at zero runtime cost.

**Tier 2 — Local MiniLM embedding model** (`lib/ml/topic-classifier.ts`)
Live reviews submitted through the guest flow are classified at submission time. The model used is `sentence-transformers/all-MiniLM-L6-v2` (~90MB), loaded via `@xenova/transformers` (ONNX Runtime, in-process).

How it works:
1. The review text is embedded into a 384-dimensional vector
2. Pre-cached embeddings of rich semantic topic descriptions are loaded (computed once, cached in `globalThis`)
3. Cosine similarity is computed between the review embedding and each topic description embedding
4. Topics with similarity ≥ 0.32 are assigned

This handles cases that keywords miss entirely:
- *"couldn't sleep all night"* → `noise` (the word "noise" never appears)
- *"lumpy mattress"* → `room_comfort` (no keyword match)
- *"the room was not dirty"* → `cleanliness` (positive sentiment despite no positive keyword)

Results are stored in `liveClassificationCache` (a `globalThis` Map keyed by `sha256(text)[0..16]`) so repeated analysis passes reuse the result without re-running the model.

**Tier 3 — Keyword matching** (`lib/topics.ts`)
Last resort, reached only if the embedding model fails to load. Each topic has an explicit keyword list. Not expected in normal operation.

### 6.2 Aspect-Based Sentiment Analysis (ABSA) — Local Pipeline

**The problem with keyword counting:** "The room was not dirty" scores as *negative* for cleanliness because the word "dirty" appears. A guest who says "I was worried about cleanliness but it was spotless" scores as mixed because both positive and negative words appear. Keyword counting cannot handle negation or sentence-level context.

**The solution — two local models working in sequence:**

Implemented in `lib/ml/local-absa.ts` and `lib/ml/sentiment-classifier.ts`.

**Step 1 — Sentence splitting and relevance filtering (MiniLM)**
The review is split into sentences. Each sentence is embedded with MiniLM (the same model used for topic classification, already loaded). Cosine similarity is computed between each sentence embedding and the target topic description embedding. Sentences with similarity ≥ 0.22 are kept as topic-relevant. This isolates the parts of the review that actually discuss this topic, ignoring everything else.

Example for topic `parking`:
- *"The breakfast was amazing"* → similarity 0.09 → discarded
- *"Parking was a nightmare, no spaces left"* → similarity 0.61 → kept

**Step 2 — Sentiment classification (DistilBERT)**
The kept sentences are passed to `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (~67MB), loaded via `@xenova/transformers`. This model was fine-tuned on the Stanford Sentiment Treebank (SST-2) and reads each sentence in full context, handling negation correctly.

Output: `POSITIVE` or `NEGATIVE` with a confidence score.
Mapping: `POSITIVE` → score as-is; `NEGATIVE` → `1 - score`. Final range: 0–1.

**Step 3 — Aggregation**
Scores are averaged across contributing sentences, weighted by their MiniLM similarity to the topic description (more relevant sentences count more). The result is a single 0–1 sentiment score for that topic.

**Running ABSA in batch:**
`scripts/run-absa.ts` processes all 13 properties × 15 topics, capping at 50 reviews per topic. Results are written to `lib/ml-sentiment-cache.json`. The script is resumable — re-running skips already-computed pairs. Cost: $0.

**Integration into the Coverage Score:**
`lib/analysis.ts` calls `getAbsaScore(propertyId, topicId)` on every `analyzeProperty()` call. When a cached score exists it replaces keyword counting as the S2 sentiment signal. When no cache exists (e.g. before the script has been run) it falls back to keyword counting transparently.

### 6.3 Continuous Learning — Per-Property Weight Training

Implemented in `lib/ml/continuous-learning.ts`. Triggered on property page load and persisted to `lib/learned-weights.json`.

Three sets of weights are learned per property from guest rating signals. All three use **Bayesian shrinkage** so that learned weights only dominate when sufficient data exists:

```
final_weight = (n / (n + 20)) × learned + (20 / (n + 20)) × default
```

With fewer than ~20 reviews per topic the model defers to defaults. With 50+ reviews the learned weights dominate.

**A — Topic importance weights (Pearson correlation)**

For each topic, reviews mentioning that topic are collected. Pearson r is computed between per-review keyword sentiment scores and `rating.overall / 5`. Topics where text sentiment reliably predicts overall guest satisfaction get higher importance in the Coverage Score weighted mean. Negative correlations are floored at 0. Raw correlations are normalised to sum to 1 across all relevant topics.

Result: `topicImportance[]` — the `importance_i` values in the Coverage Score formula.

**B — Sentiment blend weights (closed-form OLS)**

For topics with Expedia structured sub-ratings, the optimal blend `α` between S1 and S2 is found analytically:

```
α* = Σ((y − S2)(S1 − S2)) / Σ((S1 − S2)²)

where y = rating.overall / 5
```

`α` is clamped to [0.1, 0.9] then shrunk toward 0.55. This finds the weighting of structured ratings vs text sentiment that best predicts actual guest satisfaction at that specific property.

Result: `sentimentBlend[]` — the `α` per topic used in `hybridSentimentScore`.

**C — Topic score component weights (3-column OLS regression)**

The three components of each topic score (coverage, freshness, sentiment) have fixed defaults of 0.35/0.35/0.30. These are also learned per property. For each topic with sufficient data, one regression data point is constructed:

```
X = [coverage_i, freshness_i, mean_text_sentiment_i]
y = mean(rating.overall / 5) for reviews mentioning topic i
```

OLS via normal equations (`β = (XᵀX)⁻¹Xᵀy`) solves for the combination of coverage, freshness, and sentiment that best predicts actual guest satisfaction at this property. Negative weights are clamped to 0.05, then renormalised to sum to 1, then Bayesian shrinkage is applied.

Result: `topicScoreWeights` — the `w_coverage`, `w_freshness`, `w_sentiment` values in the per-topic score formula.

---

## 7. AI Pipeline — GPT-4o-mini API Calls

The following features use GPT-4o-mini via the OpenAI API. These are kept as API calls because they require natural language generation or full-document reasoning that local models cannot match at acceptable quality.

### 7.1 Follow-Up Question Generation

**Trigger:** After a guest submits their free-text review.
**File:** `lib/openai.ts` → `app/api/generate-questions/route.ts`

The guest's review text is analysed to identify which topics it covers. The property's top knowledge gaps (from `analyzeProperty`) are passed to GPT-4o-mini along with the review context. GPT generates exactly 2 contextual follow-up questions targeting the most urgent uncovered gaps. For each question it also selects the appropriate response format: yes/no, free text, or multiple choice.

Example: If the hotel has a spa but no recent reviews mention it, GPT might generate: *"Did you get a chance to use the spa? How would you describe the experience?"*

This is the one per-submission GPT call that is intentionally kept — question quality and contextual naturalness require language model reasoning.

### 7.2 Insights Summarisation

**Trigger:** Manager opens a topic panel on the dashboard.
**File:** `app/api/generate-insights/route.ts`

The 35 most recent reviews mentioning the target topic are batched into a single prompt. GPT-4o-mini returns structured JSON:
- `summary` — plain-English overview of what guests say about this topic
- `issues` — recurring complaints
- `strengths` — what guests consistently praise
- `trend` — whether sentiment is improving or worsening in recent months

Results are cached in `lib/insights-cache.ts` (in-memory, keyed by `propertyId + topicId`) for the server process lifetime. Subsequent opens of the same topic panel return instantly from cache.

### 7.3 Photo Classification

**Trigger:** Guest uploads a photo during the review flow.
**File:** `app/api/analyze-photo/route.ts`

Photos are sent as base64 data URLs to GPT-4o-mini with a structured prompt. The model returns:
- Which of the 15 topics the photo depicts
- Sentiment label: `positive`, `negative`, or `neutral`
- A short caption describing what is shown

This is kept as an API call because running a capable vision model locally would require a 4–7GB bundle, which is not practical in a web application context.

### 7.4 Offline Topic Classification (Batch Script)

**Trigger:** Manual run via `npx tsx scripts/classify-topics-ai.ts`
**File:** `scripts/classify-topics-ai.ts`

This is a one-time batch job that classifies all historical reviews using GPT-4o (not mini — higher quality for the pre-computed baseline). Reviews are sent in batches of 12. Results are stored in `lib/topic-classifications.json` as `sha256(reviewText) → topicIds[]`. This is Tier 1 of the topic classification pipeline and covers all historical data permanently.

---

## 8. How ML and AI Connect to the Final Product

The diagram below shows how each ML and AI component feeds into the numbers and UI elements the user sees.

```
OFFLINE (one-time scripts)
──────────────────────────
scripts/classify-topics-ai.ts  →  lib/topic-classifications.json
  [GPT-4o batch]                   Tier 1 topic assignments for all historical reviews

scripts/run-absa.ts            →  lib/ml-sentiment-cache.json
  [MiniLM + DistilBERT, local]     Per-property × per-topic sentiment scores (0–1)


ON PAGE LOAD (per-property, results cached)
───────────────────────────────────────────
learnPropertyWeights()
  [Pearson + OLS, local]
  ├── topicImportance[]        →  Coverage Score weighted mean (which topics matter most)
  ├── sentimentBlend α[]       →  hybridSentimentScore (how much to trust structured vs text ratings)
  └── topicScoreWeights        →  per-topic formula weights (coverage vs freshness vs sentiment)

analyzeProperty()
  ├── classifyReview()
  │   ├── topic-classifications.json  [Tier 1]
  │   ├── liveClassificationCache     [Tier 2, MiniLM]
  │   └── keyword matching            [Tier 3, fallback]
  │
  ├── getAbsaScore()           →  reads ml-sentiment-cache.json → replaces keyword S2
  │
  ├── computeStructuredRatingScore()  →  S1 signal
  │
  ├── hybridSentimentScore = α×S1 + (1−α)×S2   [α learned by OLS]
  │
  ├── topicScore = w_cov×coverage + w_fresh×freshness + w_sent×hybridSentiment
  │               [w_ learned by OLS regression]
  │
  └── CoverageScore = Σ(importance_i × topicScore_i) / Σ(importance_i)
                      [importance learned by Pearson correlation]
                          │
                          ▼
                   ┌──────────────────────────┐
                   │  Coverage Score ring      │  ← manager dashboard
                   │  Topic coverage map       │  ← green/amber/red grid
                   │  Gap labels               │  ← high / medium / low
                   │  Stat cards               │  ← health score card
                   └──────────────────────────┘


ON GUEST REVIEW SUBMISSION
──────────────────────────
Guest writes review text
  │
  ├── classifyTextML()  [MiniLM, local, fire-and-forget]
  │     → liveClassificationCache   (Tier 2 classification for this review)
  │
  └── /api/generate-questions  [GPT-4o-mini]
        → 2 follow-up questions targeting top knowledge gaps
              │
              Guest answers questions + uploads photos
                │
                ├── /api/analyze-photo  [GPT-4o-mini vision]
                │     → topic, sentiment, caption per photo
                │
                └── /api/process-answer
                      ├── Adds review to in-memory store
                      ├── Invalidates analysis cache + ABSA cache
                      ├── Recomputes analyzeProperty() → new CoverageScore
                      └── SSE event → manager live feed
                                          │
                                          ▼
                               ┌─────────────────────────┐
                               │  Live review notification │  ← manager dashboard
                               │  Coverage Score delta     │  ← +N points
                               │  BeforeAfterScore UI      │  ← animated comparison
                               └─────────────────────────┘


ON MANAGER TOPIC PANEL OPEN
────────────────────────────
/api/generate-insights  [GPT-4o-mini]
  → summary, issues, strengths, trend   (cached per propertyId+topicId)
        │
        ▼
  PropertyInsights component  ← plain-English topic summary on dashboard
```

---

## 9. Guest Review Flow

1. Guest visits `/review?propertyId=...`
2. Writes a free-text review (voice input also supported via Web Speech API)
3. System classifies the review with MiniLM to identify covered topics
4. POST `/api/generate-questions` → GPT-4o-mini generates 2 follow-up questions for uncovered gaps
5. Guest answers the questions and optionally uploads photos
6. Each photo → POST `/api/analyze-photo` → GPT-4o-mini vision returns topic + sentiment + caption
7. POST `/api/process-answer`:
   - Review stored in memory
   - MiniLM classification runs fire-and-forget to populate the Tier 2 cache
   - All analysis caches invalidated
   - `analyzeProperty()` recomputes with the new review
   - SSE event pushed to all open manager dashboards
8. Guest is redirected to `/review/[id]` showing a `BeforeAfterScore` with the Coverage Score change

---

## 10. Manager Dashboard

The property page (`/property/[id]`) is the primary manager view:

- **Coverage Score ring** — animated 0–100 score with colour coding (green ≥ 75, amber ≥ 50, red < 50)
- **Topic coverage map** — 15-topic grid, each tile coloured by gap severity
- **Stat cards** — total reviews, rating, live reviews this session, score
- **Tabs:**
  - *Overview* — top gaps, sentiment alerts, learned weight diagnostics
  - *Insights* — GPT-generated per-topic summaries (lazy-loaded on click)
  - *Trends* — recharts satisfaction trend chart, monthly/yearly toggle
  - *Ratings* — structured rating breakdown per topic
  - *ML Analysis* — side-by-side comparison of keyword vs ML topic classification and sentiment; uses the local ABSA pipeline on demand
  - *Live Feed* — SSE-powered real-time review notifications as guests submit

The **manager login** (`/manager`) authenticates against a static account table (`lib/manager-accounts.ts`) and redirects to that manager's property. The **portfolio view** (`/portfolio`) shows all 13 properties with Coverage Scores for account managers overseeing multiple hotels.

---

## 11. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | recharts |
| Icons | lucide-react |
| Local ML — embeddings | `@xenova/transformers` v2.17, `Xenova/all-MiniLM-L6-v2` (~90MB) |
| Local ML — sentiment | `@xenova/transformers` v2.17, `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (~67MB) |
| Generative AI | OpenAI `gpt-4o-mini` (questions, insights, photo analysis) |
| Offline classification | OpenAI `gpt-4o` (batch script only, pre-computed) |
| Data | Expedia hotel dataset (static CSV, 13 properties, ~7,200 reviews) |
| Runtime data | `globalThis` singleton in-memory store (no database) |

---

## 12. File Reference

```
app/
├── page.tsx                     Hotel listing / portfolio entry
├── manager/page.tsx             Manager login
├── portfolio/page.tsx           Multi-property portfolio view
├── property/[id]/page.tsx       Manager dashboard — Coverage Score, topics, tabs
├── review/page.tsx              Guest review entry point
├── review/[id]/page.tsx         Post-submission result (BeforeAfterScore)
└── api/
    ├── process-answer/          Review submission, cache invalidation, SSE dispatch
    ├── generate-questions/      GPT follow-up question generation
    ├── generate-insights/       GPT topic summarisation (cached)
    ├── analyze-photo/           GPT vision photo classification
    ├── ml-analyze/              On-demand full ML analysis (local ABSA + embeddings)
    ├── train-weights/           Continuous learning trigger
    ├── satisfaction-trend/      Historical satisfaction data for trend chart
    └── events/                  SSE endpoint for live manager feed

lib/
├── analysis.ts                  Core Coverage Score computation
├── data.ts                      CSV loading, property + review types
├── topics.ts                    15 topic definitions + keyword classifier
├── store.ts                     In-memory live review store (globalThis)
├── openai.ts                    GPT follow-up question generation
├── health-utils.ts              getCoverageColor / getCoverageLabel
├── insights-cache.ts            In-memory GPT insights cache
├── live-classification-cache.ts globalThis cache for live embedding results
├── learned-weights.json         Persisted per-property regression weights
├── ml-sentiment-cache.json      Persisted per-property ABSA scores
├── topic-classifications.json   Persisted GPT batch topic assignments
└── ml/
    ├── embeddings.ts            MiniLM model loader + cosine similarity
    ├── topic-classifier.ts      Embedding-based topic classification
    ├── sentiment-classifier.ts  DistilBERT sentiment model loader
    ├── local-absa.ts            Sentence-level ABSA pipeline (MiniLM + DistilBERT)
    ├── absa-cache.ts            File-backed ABSA score cache (read/write)
    ├── absa.ts                  Legacy GPT-based ABSA (still available, not in main path)
    ├── continuous-learning.ts   Pearson + OLS weight learning
    ├── analyze-ml.ts            Full ML analysis pipeline (used by ML Analysis tab)
    ├── ema-scores.ts            Exponential moving average scoring
    ├── spell-correct.ts         SymSpell-based spell correction
    └── symspell.ts              SymSpell algorithm implementation

components/
├── CoverageScore.tsx            Animated SVG score ring
├── TopicCoverageMap.tsx         15-topic grid with gap indicators
├── SatisfactionTrendChart.tsx   recharts line chart — monthly/yearly
├── RatingAnalytics.tsx          Structured rating breakdowns
├── PropertyInsights.tsx         GPT insights panel
├── ReviewFlow.tsx               Multi-step guest review submission UI
├── PhotoUpload.tsx              Photo capture + GPT analysis
├── BeforeAfterScore.tsx         Post-submission score comparison animation
├── MLAnalysis.tsx               ML Analysis tab panel
├── LiveReviewsFeed.tsx          SSE-powered manager notification feed
└── PropertyCard.tsx             Listing card with Coverage Score badge

scripts/
├── run-absa.ts                  Batch local ABSA across all properties ($0 cost)
└── classify-topics-ai.ts        Batch GPT topic classification for historical reviews
```
