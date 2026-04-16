# Technical Overview - Hotel Coverage Intelligence Platform

Built for Expedia. Wharton AI Hackathon.

---

## 1. What the Platform Does

Hotels receive thousands of guest reviews, but coverage is uneven. A property might have 200 reviews about staff and almost nothing about the pool, parking, or accessibility. Traditional review platforms don't surface these gaps - they just display reviews chronologically.

This platform introduces a **Coverage Score** (0–100) that measures how well a hotel's guest experience is documented across 15 topic areas. It then actively closes those gaps by guiding guests through a smart review flow that asks targeted follow-up questions about the topics the hotel is missing.

There are two user-facing sides:

- **Manager dashboard** - views the Coverage Score, topic coverage map, sentiment trends, AI-generated insights, and a live review feed
- **Guest review flow** - writes a review, answers 2 AI-generated follow-up questions targeting the hotel's most urgent gaps, optionally uploads photos

---

## 2. Architecture

```
Next.js 16 (App Router)
├── Server components  - data loading, analysis, scoring
├── Client components  - interactive UI, charts, live feed
└── API routes         - ML inference, GPT calls, SSE stream

Data
├── data/Description_PROC.csv   - 13 hotel properties (static Expedia dataset)
├── data/Reviews_PROC.csv       - ~7,200 historical guest reviews
└── lib/store.ts                - in-memory store for live reviews (no database)

ML artefacts (local files, no database)
├── lib/topic-classifications.json   - sha256(review) → topic IDs (GPT pre-computed)
├── lib/ml-sentiment-cache.json      - propertyId → topicId → ABSA score
└── lib/learned-weights.json         - per-property regression weights
```

There is no external database. Property and review data come from static CSV files parsed at startup. Live reviews (submitted during the demo) are held in a `globalThis` singleton (`lib/store.ts`) that survives Next.js Hot Module Replacement. All ML results are persisted as JSON files so they survive server restarts without recomputation.

---

## 3. The 15 Topic Areas

Every review and every score is broken down across these topics:

| ID | Label | S1 structured rating fields | S1 available? |
|---|---|---|---|
| `cleanliness` | Cleanliness | roomcleanliness, hotelcondition | Yes |
| `location` | Location & Neighborhood | location, convenienceoflocation, neighborhoodsatisfaction | Yes |
| `food_breakfast` | Food & Breakfast | - | **No** |
| `wifi_internet` | WiFi & Internet | - | **No** |
| `parking` | Parking | - | **No** |
| `pool_fitness` | Pool & Fitness | roomamenitiesscore | Yes |
| `checkin_checkout` | Check-in & Check-out | checkin, communication | Yes |
| `noise` | Noise & Quiet | - | **No** |
| `room_comfort` | Room Size & Comfort | roomcomfort, roomquality, roomamenitiesscore | Yes |
| `bathroom` | Bathroom | roomcleanliness | Yes |
| `staff_service` | Staff & Service | service, communication | Yes |
| `value` | Value for Money | valueformoney | Yes |
| `spa_wellness` | Spa & Wellness | - | **No** |
| `accessibility` | Accessibility | - | **No** |
| `eco_sustainability` | Eco & Sustainability | ecofriendliness | Yes |

**9 of 15 topics** have Expedia structured sub-ratings (S1). **6 topics** - food_breakfast, wifi_internet, parking, noise, spa_wellness, and accessibility - have no structured rating fields. For those 6 topics the sentiment signal is entirely ML-derived (S2). See Section 5 for how this is handled.

Topics with `amenityKeys` (parking, pool, spa, etc.) are only counted as relevant if the property's amenity listings mention those keywords. A hotel without a pool does not get penalised for having no pool reviews.

---

## 4. The Coverage Score

The Coverage Score is the single 0–100 number shown as the animated ring on every property dashboard. It is a weighted mean of per-topic scores across all relevant topics.

### Per-topic score

```
topicScore = w_coverage × coverage + w_freshness × freshness + w_sentiment × hybridSentiment

coverage  = min(1, effectiveCoverageCount / saturationThreshold)
freshness = max(0, 1 − daysSinceLastMention / 365)
```

Default weights: `w_coverage = 0.35`, `w_freshness = 0.35`, `w_sentiment = 0.30`.
These are replaced by per-property learned weights when sufficient data exists (see Section 6.3).

Topics with zero mentions score 0 - no knowledge, no contribution.

### Quality-weighted coverage count

Rather than counting reviews naively, each review contributes a quality score between 0 and 1:

```
effectiveCoverageCount = Σ qualityScore_i   (over reviews mentioning this topic)
```

For reviews where a structured sub-rating exists for this topic:
```
alignment_i      = 1 − |textSentiment_i − structuredRating_i / 5|
qualityScore_i   = alignmentWeight × alignment_i + (1 − alignmentWeight) × heuristicScore_i
```

For reviews without a structured sub-rating:
```
qualityScore_i   = heuristicScore_i   (length, vocabulary, specificity)
```

`alignmentWeight` and `saturationThreshold` are both ML-learned per property (see Section 6.3 D/E). Defaults are `alignmentWeight = 0.6` and `saturationThreshold = 10`.

**Why this matters:** 10 low-quality, vague reviews should not score the same as 10 detailed reviews whose sentiment closely matches the structured rating. A review that says "great" but rates cleanliness 2/10 is internally inconsistent - its alignment score is low and it contributes less to coverage.

### Coverage Score aggregation

```
CoverageScore = Σ(importance_i × topicScore_i) / Σ(importance_i)
```

`importance_i` is a per-property, per-topic learned weight (see Section 6.3). Without learned data it degrades to a simple mean.

### Gap classification

Each topic is assigned a gap label used to prioritise follow-up questions:

```
effectiveCoverageCount == 0                               → high gap   (red)
effectiveCoverageCount < saturationThreshold × 0.2
  OR stale (> 180 days since last mention)               → medium gap (amber)
topicCoverageScore < 0.5                                  → low gap    (yellow)
otherwise                                                 → none       (green)
```

---

## 5. Sentiment Scoring - hybridSentimentScore

"Hybrid sentiment" means blending two distinct signal types: **structured ratings** (S1) and **ML-derived text sentiment** (S2). It does not involve GPT or any API call - both signals come from either the Expedia dataset or local ML inference.

### S1 - Expedia structured sub-ratings

Expedia's dataset includes per-topic numeric sub-ratings (e.g. `roomcleanliness`, `service`). These are averaged across all reviews and normalised to 0–1. **Available for 9 of 15 topics** (see table in Section 3). Returns `null` when no reviews carry non-zero values for that topic's rating fields.

### S2 - Local ML ABSA (primary) or keyword counting (fallback)

1. **ML ABSA score** (preferred) - pre-computed by `scripts/run-absa.ts` using local MiniLM + DistilBERT models, stored in `lib/ml-sentiment-cache.json`. When a cached score exists it is used directly. This is the principal ML text-sentiment signal and handles negation, context, and nuance correctly.
2. **Keyword counting** (fallback) - if no ABSA cache exists (e.g. the batch script hasn't been run yet), counts positive/negative words across reviews mentioning the topic, mapped to `0.1 + (posRatio × 0.8)`. This is a heuristic, not ML, and should be replaced by the ABSA cache in production.

### Blend formula

```
hybridSentiment = α × S1 + (1−α) × S2   (when S1 data exists for this topic)
hybridSentiment = S2                      (when no structured ratings - 6 topics)
hybridSentiment = 0.5                     (when no reviews)
```

`α` defaults to 0.55 and is learned per-property per-topic by OLS regression (see Section 6.3 B).

### For the 6 topics without S1

food_breakfast, wifi_internet, parking, noise, spa_wellness, and accessibility have no Expedia structured rating fields. For these topics `hybridSentiment = S2` entirely - the score is 100% derived from text via local ML ABSA. This is not a degradation: S2 (local ABSA using MiniLM + DistilBERT) is a strong signal. These topics simply cannot benefit from the cross-validation that S1 provides. The blend weight `α` is irrelevant for them and ignored.

---

## 6. ML Pipeline - Local Models, No API Calls

All components in this section run entirely in-process using local model weights. There are no API calls, no per-request cost, and no network dependency after the initial model download.

### 6.1 Topic Classification - Three-Tier Pipeline

Every review must be assigned to the topics it covers. `classifyReview()` in `lib/analysis.ts` checks three sources in strict priority order:

**Tier 1 - GPT-4o batch cache** (`lib/topic-classifications.json`)
All 7,200 historical Expedia reviews were pre-classified offline using `scripts/classify-topics-ai.ts`. Results are stored as a map of `sha256(reviewText)[0..16] → string[]` (topic IDs). This covers all historical data at zero runtime cost.

**Tier 2 - Local MiniLM embedding model** (`lib/ml/topic-classifier.ts`)
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

**Tier 3 - Keyword matching** (`lib/topics.ts`)
Last resort, reached only if the embedding model fails to load. Each topic has an explicit keyword list. Not expected in normal operation.

### 6.2 Aspect-Based Sentiment Analysis (ABSA) - Local Pipeline

**The problem with keyword counting:** "The room was not dirty" scores as *negative* for cleanliness because the word "dirty" appears. A guest who says "I was worried about cleanliness but it was spotless" scores as mixed because both positive and negative words appear. Keyword counting cannot handle negation or sentence-level context.

**The solution - two local models working in sequence:**

Implemented in `lib/ml/local-absa.ts` and `lib/ml/sentiment-classifier.ts`.

**Step 1 - Sentence splitting and relevance filtering (MiniLM)**
The review is split into sentences. Each sentence is embedded with MiniLM (the same model used for topic classification, already loaded). Cosine similarity is computed between each sentence embedding and the target topic description embedding. Sentences with similarity ≥ 0.22 are kept as topic-relevant. This isolates the parts of the review that actually discuss this topic, ignoring everything else.

Example for topic `parking`:
- *"The breakfast was amazing"* → similarity 0.09 → discarded
- *"Parking was a nightmare, no spaces left"* → similarity 0.61 → kept

**Step 2 - Sentiment classification (DistilBERT)**
The kept sentences are passed to `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (~67MB), loaded via `@xenova/transformers`. This model was fine-tuned on the Stanford Sentiment Treebank (SST-2) and reads each sentence in full context, handling negation correctly.

Output: `POSITIVE` or `NEGATIVE` with a confidence score.
Mapping: `POSITIVE` → score as-is; `NEGATIVE` → `1 - score`. Final range: 0–1.

**Step 3 - Aggregation**
Scores are averaged across contributing sentences, weighted by their MiniLM similarity to the topic description (more relevant sentences count more). The result is a single 0–1 sentiment score for that topic.

**Running ABSA in batch:**
`scripts/run-absa.ts` processes all 13 properties × 15 topics, capping at 50 reviews per topic. Results are written to `lib/ml-sentiment-cache.json`. The script is resumable - re-running skips already-computed pairs. Cost: $0.

**Integration into the Coverage Score:**
`lib/analysis.ts` calls `getAbsaScore(propertyId, topicId)` on every `analyzeProperty()` call. When a cached score exists it replaces keyword counting as the S2 sentiment signal. When no cache exists (e.g. before the script has been run) it falls back to keyword counting transparently.

### 6.3 Continuous Learning - Per-Property Weight Training

Implemented in `lib/ml/continuous-learning.ts`. Triggered on property page load and persisted to `lib/learned-weights.json`.

Five values are learned per property from guest rating signals. All five use **Bayesian shrinkage** so that learned values only dominate when sufficient data exists:

```
final_weight = (n / (n + 20)) × learned + (20 / (n + 20)) × default
```

With fewer than ~20 reviews per topic the model defers to defaults. With 50+ reviews the learned weights dominate.

**A - Topic importance weights (Pearson correlation)**

For each topic, reviews mentioning that topic are collected. Pearson r is computed between per-review keyword sentiment scores and `rating.overall / 5`. Topics where text sentiment reliably predicts overall guest satisfaction get higher importance in the Coverage Score weighted mean. Negative correlations are floored at 0. Raw correlations are normalised to sum to 1 across all relevant topics.

Result: `topicImportance[]` - the `importance_i` values in the Coverage Score formula.

**B - Sentiment blend weights (closed-form OLS)**

For topics with Expedia structured sub-ratings (S1), the optimal blend `α` between S1 and S2 is found analytically:

```
α* = Σ((y − S2)(S1 − S2)) / Σ((S1 − S2)²)

where y = rating.overall / 5
```

`α` is clamped to [0.1, 0.9] then shrunk toward 0.55. This finds the weighting of structured ratings vs ML text sentiment that best predicts actual guest satisfaction at that specific property.

Result: `sentimentBlend[]` - the `α` per topic used in `hybridSentimentScore`. Not used for the 6 topics without S1.

**C - Topic score component weights (3-column OLS regression)**

The three components of each topic score (coverage, freshness, sentiment) have fixed defaults of 0.35/0.35/0.30. These are also learned per property. For each topic with sufficient data, one regression data point is constructed:

```
X = [coverage_i, freshness_i, mean_text_sentiment_i]
y = mean(rating.overall / 5) for reviews mentioning topic i
```

OLS via normal equations (`β = (XᵀX)⁻¹Xᵀy`) solves for the combination of coverage, freshness, and sentiment that best predicts actual guest satisfaction at this property. Negative weights are clamped to 0.05, then renormalised to sum to 1, then Bayesian shrinkage is applied.

Result: `topicScoreWeights` - the `w_coverage`, `w_freshness`, `w_sentiment` values in the per-topic score formula.

**D - Saturation threshold (running mean stabilisation)**

The coverage formula is `min(1, effectiveCoverageCount / saturationThreshold)`. The default threshold of 10 is arbitrary - a property with 500 reviews per topic saturates too early, while a niche property might never reach 10 useful reviews.

Learning procedure: reviews mentioning each topic are sorted chronologically. A running mean of `rating.overall / 5` is computed as each new review is added. The first index `k` at which 3 consecutive deltas fall below 0.03 (i.e. additional reviews stop moving the average) is the stabilisation point for that topic. The median across all relevant topics is taken as the property's threshold. Bayesian shrinkage is applied toward the default of 10.

Result: `saturationThreshold` - the denominator in the coverage formula. Higher at properties with many consistent reviews; lower at properties where a small number of reviews reliably represents the guest experience.

**E - Review alignment weight (1-D OLS)**

When structured sub-ratings exist for a topic, we can measure how much a review's text sentiment agrees with its numeric rating - this is the *alignment* score. The blend between alignment-based quality and heuristic-based quality (text length, vocabulary richness) is itself learned:

```
qualityScore = alignmentWeight × alignment + (1 − alignmentWeight) × heuristicScore

1D OLS: α* = Σ((y − h)(a − h)) / Σ((a − h)²)
  where y = overall / 5
        a = alignment score
        h = heuristic score
```

The value `α*` is clamped to [0, 1] and shrunk toward 0.6.

Result: `reviewAlignmentWeight` - how much weight to give text-rating alignment vs heuristic quality when computing `effectiveCoverageCount`. At properties where structured ratings and text sentiment track each other closely, alignment becomes the dominant quality signal.

---

## 7. AI Pipeline - GPT-4o-mini API Calls

The following features use GPT-4o-mini via the OpenAI API. These are kept as API calls because they require natural language generation or full-document reasoning that local models cannot match at acceptable quality.

### 7.1 Follow-Up Question Generation

**Trigger:** After a guest submits their free-text review.
**File:** `lib/openai.ts` → `app/api/generate-questions/route.ts`

The guest's review text is analysed to identify which topics it covers. The property's top knowledge gaps (from `analyzeProperty`) are passed to GPT-4o-mini along with the review context. GPT generates exactly 2 contextual follow-up questions targeting the most urgent uncovered gaps. For each question it also selects the appropriate response format: yes/no, free text, or multiple choice.

Example: If the hotel has a spa but no recent reviews mention it, GPT might generate: *"Did you get a chance to use the spa? How would you describe the experience?"*

This is the one per-submission GPT call that is intentionally kept - question quality and contextual naturalness require language model reasoning.

### 7.2 Insights Summarisation

**Trigger:** Manager opens a topic panel on the dashboard.
**File:** `app/api/generate-insights/route.ts`

The 35 most recent reviews mentioning the target topic are batched into a single prompt. GPT-4o-mini returns structured JSON:
- `summary` - plain-English overview of what guests say about this topic
- `issues` - recurring complaints
- `strengths` - what guests consistently praise
- `trend` - whether sentiment is improving or worsening in recent months

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

This is a one-time batch job that classifies all historical reviews using GPT-4o (not mini - higher quality for the pre-computed baseline). Reviews are sent in batches of 12. Results are stored in `lib/topic-classifications.json` as `sha256(reviewText) → topicIds[]`. This is Tier 1 of the topic classification pipeline and covers all historical data permanently.

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
  [Pearson + OLS + running mean, local]
  ├── topicImportance[]        →  Coverage Score weighted mean (which topics matter most)
  ├── sentimentBlend α[]       →  hybridSentimentScore (how much to trust structured vs text)
  ├── topicScoreWeights        →  per-topic formula weights (coverage vs freshness vs sentiment)
  ├── saturationThreshold      →  denominator in coverage formula (when does adding reviews stop helping)
  └── reviewAlignmentWeight    →  how much to weight alignment vs heuristic in quality scoring

analyzeProperty()
  ├── classifyReview()
  │   ├── topic-classifications.json  [Tier 1]
  │   ├── liveClassificationCache     [Tier 2, MiniLM]
  │   └── keyword matching            [Tier 3, fallback]
  │
  ├── effectiveCoverageCount = Σ quality_i
  │   quality_i = alignmentWeight × alignment_i + (1−alignmentWeight) × heuristic_i
  │               [uses learned alignmentWeight; alignment requires S1 field]
  │
  ├── coverage = min(1, effectiveCoverageCount / saturationThreshold)
  │              [saturationThreshold learned per property]
  │
  ├── getAbsaScore()           →  reads ml-sentiment-cache.json → S2 signal
  │
  ├── computeStructuredRatingScore()  →  S1 signal (9 topics only)
  │
  ├── hybridSentimentScore = α×S1 + (1−α)×S2   [α learned by OLS; S2-only for 6 topics]
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

## 9. Guest Review Flow - Full Technical Walkthrough

The guest flow is a 4-step wizard (`components/ReviewFlow.tsx`) rendered at `/review/[id]`. The steps are: **Share Your Experience → Smart Follow-ups → Add Photos → Impact**. Each step is described in full below.

---

### Step 1 - Share Your Experience

The guest sees a star rating widget (1–5 required) and an optional free-text box. Voice input is also supported via the Web Speech API (`components/VoiceInput.tsx`, loaded client-side only to avoid SSR hydration issues).

**Client-side quality gate**
When the guest clicks Continue with text present, `checkTextQuality(reviewText)` runs synchronously in the browser (`lib/quality.ts`). This checks review length, vocabulary richness, and content specificity. If the review fails the threshold it displays an inline error and blocks progression - no network call is made yet.

**Topic classification: which gaps does this review already cover?**
If the text passes the quality gate, the client POSTs to `/api/analyze-review` with the review text. This route runs MiniLM (Tier 2 embedding-based classification) to identify which of the 15 topics the review already covers. The result - an array of topic IDs - is called `coveredTopics` and is passed to the next step. This prevents asking the guest about topics they already discussed.

If the guest submitted only a star rating with no text, `coveredTopics` is an empty array and the question generation receives no pre-coverage signal.

**Follow-up question generation**
The client POSTs to `/api/generate-questions` with `{ propertyId, coveredTopics, reviewText }`.

The server:
1. Re-runs `checkTextQuality` as a server-side safety net (rejects with HTTP 422 if text is low quality - the client should have caught this, but the server validates independently)
2. Calls `analyzeProperty()` to get the current topic gap list for this hotel
3. Filters topics to those that are: relevant to this property, have a gap (`high`, `medium`, or `low`), and are NOT already in `coveredTopics`
4. Sorts the remaining gaps by severity (`high` first, then `medium`, then `low`; ties broken randomly to add variety)
5. Checks `getActivePromptsForProperty()` for any manager-set custom prompts (managers can manually flag topics they want guest feedback on)
6. Passes the gap list + review text + active prompts to `generateFollowUpQuestions()` → GPT-4o-mini

GPT receives the hotel context, the guest's review text, and the ordered gap list. It returns exactly **2 questions**, each with:
- `question` - the question text (phrased contextually relative to the review)
- `topicId` - which of the 15 topics this question addresses
- `type` - one of `yes_no`, `text`, or `multiple_choice` (GPT chooses the most appropriate format)
- `options` - if `multiple_choice`, the answer choices

The presence of `reviewText` in the prompt is significant: GPT uses it to phrase follow-up questions that feel like a continuation of the conversation rather than a generic survey. *"You mentioned enjoying the location - did you also get a chance to use the spa?"* vs *"Did you use the spa?"*

---

### Step 2 - Smart Follow-ups

The two generated questions are displayed as interactive cards (`components/FollowUpQuestion.tsx`). Each card adapts its UI to the question type:
- `yes_no` → two large tap targets (Yes / No)
- `multiple_choice` → a list of option buttons
- `text` → a text input

Answers are stored client-side in an `answers[]` array as `{ topicId, topicLabel, answer, type }`. No network call happens here - answers are batched and submitted with everything else at the end.

---

### Step 3 - Add Photos

The guest can upload up to 10 photos. Each photo is immediately sent to `/api/analyze-photo` as a base64 data URL the moment it is selected (`components/PhotoUpload.tsx`). GPT-4o-mini vision processes each photo and returns:
- `topicId` + `topicLabel` - which topic the photo is evidence of
- `sentiment` - `positive`, `negative`, or `neutral`
- `label` - a short caption describing the photo

Photos that fail analysis are quietly dropped. Successfully analysed photos are held in local state as `AnalyzedPhoto[]` and displayed with their AI-generated captions before the guest proceeds.

This step is optional - the guest can click Skip without uploading anything.

---

### Step 4 - Submission and Score Update

When the guest clicks Submit, the client POSTs to `/api/process-answer` with the complete payload:

```
{
  propertyId,
  overallRating,
  reviewText,
  coveredTopicIds,          // from Step 1 MiniLM classification
  answers[],                // from Step 2 follow-up responses
  photos[]                  // from Step 3 GPT-analysed photos
}
```

The server executes the following sequence:

**1. Snapshot the score before**
`analyzeProperty()` is called on the existing reviews to record `previousScore`.

**2. Store the review**
A `LiveReview` object is written to `reviewStore` (the `globalThis` in-memory store). This includes the star rating, review text, topic IDs, follow-up answers, and photo metadata. From this point on, `getReviewsForProperty()` returns this review merged with the historical CSV data.

**3. Classify review text with MiniLM (fire-and-forget)**
If the review contained text, `classifyTextML()` is called asynchronously without awaiting it. When the embedding classification completes, the result is written to `liveClassificationCache` (keyed by `sha256(text)[0..16]`). This upgrades the topic assignment for this review from keyword fallback (Tier 3) to full embedding-based classification (Tier 2) on the next analysis pass.

**4. Invalidate all caches**
Four caches are invalidated for this property:
- `invalidateAnalysisCache(propertyId)` - forces `analyzeProperty()` to recompute
- `invalidateInsightsCache(propertyId)` - GPT topic summaries are now stale
- `invalidateMLCache(propertyId)` - ML analysis tab results are stale
- `invalidateAbsaCache(propertyId)` - ABSA sentiment scores are stale (new review changes the aggregate)

**5. Recompute the score**
`analyzeProperty()` runs again on the updated review set (now including the new review). This produces `newScore`.

**6. Determine which topics improved**
The union of three sets is computed:
- Topics covered by the free-text review (`coveredTopicIds` from MiniLM)
- Topics addressed by follow-up answers that passed `checkAnswerQuality()`
- Topics identified in uploaded photos

These become `improvedTopics` - the topic IDs reported back to the guest and pushed to the manager.

**7. Push SSE event to manager dashboard**
`reviewStore.pushEvent()` broadcasts a live event to all open manager dashboards via the SSE endpoint (`/api/events`). The event includes the guest's name, review text, star rating, photo metadata, `previousScore`, `newScore`, and `improvement`. The manager's live feed shows this in real time without polling.

**8. Return score delta to the client**
The API responds with `{ previousScore, newScore, improvement, improvedTopics }`. The client transitions to Step 4.

---

### Step 4 - Impact (Reviewer Points and Levels)

The final screen renders `components/ReviewerImpact.tsx`, which shows the guest what their contribution achieved.

**Points calculation** (`lib/levels.ts` → `calculatePointsEarned()`):

| Contribution | Points |
|---|---|
| Star rating (always) | +1 |
| Written review (any length) | +10 |
| Detailed review (200+ characters) | +15 (replaces the +10) |
| Each follow-up answer | +3 |
| Each photo uploaded | +5 |

**Level system**
Points accumulate in `localStorage` (keyed by `accountId`) across sessions. There are 10 levels:

| Level | Name | Points threshold |
|---|---|---|
| 1 | Explorer | 0 |
| 2 | Insider | 15 |
| 3 | Local Expert | 75 |
| 4 | Trusted Guide | 250 |
| 5 | Platinum Guide | 500 |
| 6 | Elite Guide | 1,500 |
| 7 | Master Guide | 5,000 |
| 8 | Hall of Fame | 15,000 |
| 9 | Legend | 50,000 |
| 10 | Icon | 100,000 |

The component reads the previous point total before adding the new points, then compares the resulting level to determine whether to show a level-up animation.

**Perks**
Each level unlocks perks shown in the UI: member rates (Level 2+), flash sale early access (Level 3+, with the advance window growing at higher levels), deal alerts, priority support, percentage discounts on all bookings, airport lounge access, and complimentary stays at the highest levels.

**Exclusive deals**
Guests at Level 3 and above are shown a curated list of time-limited hotel deals available earlier to them than to the general public. The advance window matches the level: 24 hours (Level 3), 48 hours (Level 4), 72 hours (Level 5+).

---

## 10. Manager Dashboard

The property page (`/property/[id]`) is the primary manager view:

- **Coverage Score ring** - animated 0–100 score with colour coding (green ≥ 75, amber ≥ 50, red < 50)
- **Topic coverage map** - 15-topic grid, each tile coloured by gap severity
- **Stat cards** - total reviews, rating, live reviews this session, score
- **Tabs:**
  - *Overview* - top gaps, sentiment alerts, learned weight diagnostics
  - *Insights* - GPT-generated per-topic summaries (lazy-loaded on click)
  - *Trends* - recharts satisfaction trend chart, monthly/yearly toggle
  - *Ratings* - structured rating breakdown per topic
  - *ML Analysis* - side-by-side comparison of keyword vs ML topic classification and sentiment; uses the local ABSA pipeline on demand
  - *Live Feed* - SSE-powered real-time review notifications as guests submit

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
| Local ML - embeddings | `@xenova/transformers` v2.17, `Xenova/all-MiniLM-L6-v2` (~90MB) |
| Local ML - sentiment | `@xenova/transformers` v2.17, `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (~67MB) |
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
├── property/[id]/page.tsx       Manager dashboard - Coverage Score, topics, tabs
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
├── SatisfactionTrendChart.tsx   recharts line chart - monthly/yearly
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
