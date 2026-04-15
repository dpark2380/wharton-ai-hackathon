# Hotel Knowledge Intelligence Platform

A full-stack web application built for Expedia that helps hotel managers understand what guests know — and don't know — about their property, and actively closes those gaps through intelligent review collection.

---

## Table of Contents

- [For Non-Technical Readers](#for-non-technical-readers)
  - [The Problem](#the-problem)
  - [The Solution](#the-solution)
  - [Key Features](#key-features)
  - [How It Works — Guest Side](#how-it-works--guest-side)
  - [How It Works — Hotel Manager Side](#how-it-works--hotel-manager-side)
- [For Technical Readers](#for-technical-readers)
  - [Architecture Overview](#architecture-overview)
  - [ML & AI Pipeline](#ml--ai-pipeline)
  - [Knowledge Health Score](#knowledge-health-score)
  - [Continuous Learning](#continuous-learning)
  - [API Routes](#api-routes)
  - [Data Flow](#data-flow)
  - [Tech Stack](#tech-stack)
  - [Running Locally](#running-locally)

---

## For Non-Technical Readers

### The Problem

Hotels receive thousands of guest reviews, but those reviews rarely cover every aspect of a property evenly. A hotel might have 200 reviews praising the staff, but almost nothing written about the pool, parking, or accessibility. This creates blind spots — potential guests searching for specific information can't find it, and hotel managers don't know which gaps to prioritize.

Traditional review platforms treat all reviews equally and surface them chronologically. They don't tell a manager: *"You haven't had a review mentioning your breakfast in 8 months"* or *"Guests almost never write about your spa, even though you have one."*

### The Solution

This platform introduces a **Knowledge Health Score (KHS)** — a single 0–100 number that measures how well a hotel's guest experience is documented across 15 key topic areas. Think of it like a coverage map: green means that topic is well-understood, red means there's a gap that needs filling.

The system then actively works to close those gaps by guiding guests through a smart review flow that asks targeted follow-up questions about the topics the hotel is missing.

### Key Features

**Knowledge Health Score**
Every hotel gets a score from 0 to 100 reflecting how comprehensively guests have described the property. The score accounts for how many reviews cover each topic, how recently those reviews were written, and how positive or negative guest sentiment is.

**15 Topic Areas**
The platform tracks guest knowledge across: Cleanliness, Location, Food & Breakfast, WiFi, Parking, Pool & Fitness, Check-in / Check-out, Noise, Room Comfort, Bathroom, Staff & Service, Value for Money, Spa & Wellness, Accessibility, and Eco-Sustainability.

**Gap Detection**
Topics are automatically flagged as high, medium, or low priority gaps based on how little coverage they have or how long ago they were last mentioned. A topic with zero reviews is an immediate high-priority gap; one with only a few reviews from a year ago is medium priority.

**Smart Review Flow**
When a guest submits a review, the system reads what they wrote, identifies which topics they covered, and then asks 2 tailored follow-up questions targeting the hotel's most urgent knowledge gaps — questions that feel natural and conversational, not like a survey.

**Real-Time Score Updates**
After a guest submits a review, the Knowledge Health Score updates immediately to reflect the new information. Hotel managers watching a live dashboard see the change appear in real time.

**AI-Powered Insights**
Hotel managers can view a plain-English summary of what guests are saying about any specific topic — what the recurring complaints are, what guests consistently praise, and whether sentiment is improving or getting worse over recent months.

**Satisfaction Trends**
A historical chart shows how overall guest satisfaction — and satisfaction on individual topics — has changed over time, toggleable between monthly and yearly views.

**Photo Analysis**
Guests can upload photos as part of their review. The system automatically identifies what part of the hotel the photo shows and whether it reflects positively or negatively on that area.

### How It Works — Guest Side

1. A guest visits a hotel's page after their stay.
2. They write a free-text review describing their experience.
3. The platform reads their review and identifies which of the 15 topics they've covered.
4. It then asks 2 short follow-up questions about the hotel's most important uncovered gaps — for example, if the hotel has a spa but no recent reviews mention it, it might ask: *"Did you get a chance to use the spa? How was the experience?"*
5. The guest answers the questions (yes/no, a rating, or free text) and optionally uploads photos.
6. Everything is submitted, the hotel's score updates, and a notification appears on the manager dashboard.

### How It Works — Hotel Manager Side

1. The manager views their property's Knowledge Health Score and topic coverage map.
2. They can see at a glance which topics are well-covered (green), stale (amber), or missing entirely (red).
3. Clicking any topic opens an AI-generated summary of what guests have said about it.
4. The manager can track score changes over time and see which recent guest submissions contributed to improvements.
5. A live notification feed shows new reviews as they come in, including how much each one moved the score.

---

## For Technical Readers

### Architecture Overview

The application is a **Next.js 15** app (App Router) with all data processing happening server-side. There is no external database — property data comes from a static Expedia JSON dataset, and live reviews are held in an in-memory store (`lib/store.ts`) with a globalThis singleton pattern to survive Hot Module Replacement in development.

```
app/
├── page.tsx                    # Property listing / portfolio view
├── property/[id]/page.tsx      # Property detail — KHS, topics, tabs
├── review/[id]/page.tsx        # Review result page
├── review/page.tsx             # Review flow entry
├── portfolio/                  # Portfolio analytics view
└── api/
    ├── process-answer/         # Review submission + embedding classification
    ├── generate-questions/     # GPT follow-up question generation
    ├── generate-insights/      # GPT review summarization
    ├── analyze-photo/          # GPT vision photo classification
    ├── train-weights/          # Continuous learning trigger
    ├── satisfaction-trend/     # Historical satisfaction data
    └── reviews-stream/         # SSE endpoint for live manager feed

lib/
├── analysis.ts                 # Core KHS computation
├── data.ts                     # Property + review data loading
├── topics.ts                   # 15 topic definitions + keyword classifier
├── quality.ts                  # Review quality validation
├── openai.ts                   # GPT follow-up question generation
├── insights-cache.ts           # In-memory insights cache
├── live-classification-cache.ts# globalThis cache for embedding results
└── ml/
    ├── continuous-learning.ts  # Per-property weight training (Pearson + OLS)
    ├── topic-classifier.ts     # Embedding-based topic classification
    ├── embeddings.ts           # Local MiniLM embedding model (no API)
    ├── absa.ts                 # Aspect-Based Sentiment Analysis (GPT)
    ├── analyze-ml.ts           # ML analytics aggregator
    ├── bertopic.ts             # Topic modelling utilities
    ├── ema-scores.ts           # Exponential moving average scoring
    ├── spell-correct.ts        # SymSpell-based spell correction
    └── symspell.ts             # SymSpell algorithm implementation

components/
├── KnowledgeHealthScore.tsx    # Score ring + label
├── TopicCoverageMap.tsx        # 15-topic grid with gap indicators
├── SatisfactionTrendChart.tsx  # recharts line chart — monthly/yearly
├── RatingAnalytics.tsx         # Structured rating breakdowns
├── PropertyInsights.tsx        # GPT insights panel
├── ReviewFlow.tsx              # Multi-step review submission UI
├── PhotoUpload.tsx             # Photo capture + GPT analysis
└── PropertyCard.tsx            # Listing card with score badge
```

### ML & AI Pipeline

#### Topic Classification — Three-Tier Hierarchy

Every review text goes through `classifyReview()` in `lib/analysis.ts`, which checks three sources in strict priority order:

**Tier 1 — Offline GPT batch** (`lib/topic-classifications.json`)
All historical Expedia reviews were pre-classified offline using GPT-4o and stored as a SHA-256 hash → topic ID array map. This covers 100% of the dataset with zero runtime cost.

**Tier 2 — Local embedding model** (`liveClassificationCache`)
Live reviews submitted through the platform are classified at submission time using `classifyTextML()` in `lib/ml/topic-classifier.ts`. This runs `sentence-transformers/all-MiniLM-L6-v2` locally via `@xenova/transformers` (ONNX Runtime, no API call). The review text is embedded into a 384-dimensional vector and compared via cosine similarity against pre-cached embeddings of rich semantic topic descriptions. Topics scoring above threshold 0.32 are assigned. Results are stored in `liveClassificationCache` (globalThis, keyed by `sha256(text)[0..16]`).

**Tier 3 — Keyword matching** (`lib/topics.ts` → `classifyText()`)
Last resort, reached only if the embedding model fails. Not expected in normal operation.

The embedding model handles paraphrasing and indirect references that keywords cannot — *"couldn't sleep all night"* maps to Noise without the word appearing; *"lumpy mattress"* maps to Room Comfort without any keyword hit.

#### Sentiment Scoring — Hybrid S1 + S2

Each topic gets a `hybridSentimentScore` (0–1) blended from two signals:

- **S1** — Structured sub-ratings from Expedia (e.g. `rating.cleanliness`, `rating.service`). Average of all non-zero values for the topic's rating keys, normalized 0–1.
- **S2** — Keyword text sentiment. Positive/negative word counts across reviews mentioning the topic, mapped to `0.1 + (posRatio × 0.8)`.

The blend weight α (defaulting to 0.55 / 0.45 S1/S2) is learned per-property per-topic by the continuous learning pipeline.

#### Photo Classification — GPT-4o-mini Vision

Photos uploaded during review submission are sent as base64 data URLs to `gpt-4o-mini` with a structured prompt. The model returns a topic ID, sentiment label (`positive|negative|neutral`), and a short caption. This is intentionally kept as an API call — a local vision model would require a 4–7GB bundle.

#### Insights Summarization — GPT-4o-mini

The 35 most recent reviews (tagged RECENT / OLDER against a 90-day window) are batched into a single prompt requesting structured JSON output: summary, issues, strengths, and trend. Results are cached in `insightsCache` (in-memory, keyed by `propertyId + topicId`). The cache is hit on all subsequent loads within the same server process lifetime.

#### Follow-Up Question Generation — GPT-4o-mini

After a guest submits their review text, the property's top knowledge gaps (from `analyzeProperty`) are passed to `generateFollowUpQuestions()` in `lib/openai.ts`. GPT generates exactly 2 contextual questions targeting uncovered gaps, selecting the appropriate response type (yes/no, text scale, multiple choice). This is the one per-submission GPT call that is intentionally kept — question quality requires language model reasoning.

### Knowledge Health Score

The KHS is a 0–100 score computed as a weighted mean of per-topic scores across all relevant topics.

**Topic relevance** — topics are filtered by `isPropertyAmenityRelevant()`, which checks whether the property's amenity lists mention the topic's keywords. A hotel without a pool treats `pool_fitness` as non-relevant and it doesn't drag the score.

**Per-topic score:**
```
topicScore = coverage × 0.35 + freshness × 0.35 + hybridSentiment × 0.30

coverage  = min(1, reviewCount / 10)
freshness = max(0, 1 − daysSinceLastMention / 365)
hybrid    = α × S1 + (1−α) × S2   (or S2 alone if no structured data)
```

Topics with zero mentions score 0 — no knowledge means no contribution.

**KHS aggregation:**
```
KHS = Σ(importance_i × topicScore_i) / Σ(importance_i)
```

Where `importance_i` comes from the continuous learning pipeline. Without learned weights, this degrades to a simple mean.

**Gap classification:**
```
reviewCount == 0          → "high" gap
reviewCount < 3 OR stale  → "medium" gap  (stale = last mention > 180 days ago)
coverageScore < 0.5       → "low" gap
```

### Continuous Learning

Implemented in `lib/ml/continuous-learning.ts`. Runs on first page load per property (result persisted to `lib/learned-weights.json`).

**Topic importance weights — Pearson correlation**

For each topic, reviews mentioning that topic are collected. Pearson r is computed between per-review keyword sentiment scores and `rating.overall / 5`. Topics where text sentiment reliably predicts overall guest satisfaction get higher importance in the KHS weighted mean. Negative correlations are floored at 0. Raw correlations are normalised to sum to 1 across all topics.

**Sentiment blend weights — Closed-form OLS**

For topics with Expedia structured sub-ratings, the optimal blend α is found analytically:

```
α* = Σ((y − S2)(S1 − S2)) / Σ((S1 − S2)²)
```

Where y = `rating.overall / 5`. α is clamped to [0.1, 0.9] and then shrunk.

**Topic score component weights — 3×3 OLS regression**

The three components of the per-topic score (coverage, freshness, hybrid sentiment) have fixed defaults of 0.35 / 0.35 / 0.30. These are also learned per-property. For each topic with sufficient data, one regression data point is built:

```
X = [coverage_i, freshness_i, mean_text_sentiment_i]
y = mean(rating.overall / 5) for reviews mentioning topic i
```

OLS via normal equations solves for β = (XᵀX)⁻¹Xᵀy across all topics. This finds the combination of coverage, freshness, and sentiment that best predicts actual guest satisfaction outcomes at this specific property. Negative weights are clamped to 0.05, the three are re-normalised to sum to 1, then Bayesian shrinkage is applied.

**Bayesian shrinkage (all learned weights):**
```
final = (n / (n + 20)) × learned + (20 / (n + 20)) × default
```

With fewer than ~20 reviews per topic, the model defers to defaults. With 50+ reviews, learned weights dominate.

Results include `topicImportance[]`, `sentimentBlend[]`, and `topicScoreWeights` — all persisted to `lib/learned-weights.json` and held in `globalThis._learnedWeightsCache`.

### API Routes

| Route | Method | Trigger | External API |
|---|---|---|---|
| `/api/process-answer` | POST | Review submission | None |
| `/api/generate-questions` | POST | After review text entered | GPT-4o-mini |
| `/api/generate-insights` | POST | Insights panel open | GPT-4o-mini (cached) |
| `/api/analyze-photo` | POST | Photo upload | GPT-4o-mini vision |
| `/api/train-weights` | POST / GET | Page load / manual | None |
| `/api/satisfaction-trend` | GET | Trends tab open | None |
| `/api/reviews-stream` | GET | Manager dashboard | None (SSE) |

### Data Flow

```
Historical reviews
  └─→ GPT (offline batch script)
        └─→ topic-classifications.json  ←── Tier 1 classification

Property page load
  └─→ learnPropertyWeights()
        ├─ Pearson correlation → topic importance weights
        ├─ OLS regression     → sentiment blend weights (α per topic)
        └─ Bayesian shrinkage → both
  └─→ analyzeProperty()
        ├─ classifyReview() [Tier 1 → 2 → 3]
        ├─ hybridSentiment  [α×S1 + (1−α)×S2, learned α]
        ├─ topicScore       [coverage + freshness + sentiment]
        └─ KHS              [importance-weighted mean]

Guest review submission
  └─→ /api/generate-questions → GPT-4o-mini → 2 follow-up questions
  └─→ /api/process-answer
        ├─ reviewStore.addReview()
        ├─ classifyTextML() [MiniLM, local, fire-and-forget]
        │     └─→ liveClassificationCache[sha256(text)]  ←── Tier 2
        ├─ invalidateAnalysisCache()
        ├─ analyzeProperty() [recomputes with new review]
        └─→ SSE event → manager dashboard

Photo upload
  └─→ /api/analyze-photo → GPT-4o-mini vision → topic + sentiment + caption

Insights panel
  └─→ /api/generate-insights → insightsCache hit? return → GPT-4o-mini → cache
```

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | recharts |
| Local ML | @xenova/transformers (all-MiniLM-L6-v2, ONNX Runtime) |
| Generative AI | OpenAI GPT-4o-mini (questions, insights, photo analysis) |
| Icons | lucide-react |
| Data | Expedia hotel dataset (static JSON) |

### Running Locally

```bash
# Install dependencies (includes ~90MB MiniLM model download on first run)
npm install

# Add your OpenAI key (required for question generation, insights, photo analysis)
echo "OPENAI_API_KEY=sk-..." > .env.local

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On first load of any property page, the local embedding model will download and initialise (~2–5s, one-time per process). Subsequent requests use the cached model and are fast.

**Optional: pre-compute topic classifications for the full dataset**
```bash
npx ts-node scripts/classify-topics-ai.ts
```
This runs GPT-4o over all historical reviews and writes `lib/topic-classifications.json`, improving classification coverage for reviews not yet seen by the live embedding pipeline.
