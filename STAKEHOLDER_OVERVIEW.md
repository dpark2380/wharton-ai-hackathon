# Stakeholder Overview — Hotel Coverage Intelligence Platform

Built for Expedia. Wharton AI Hackathon.

---

## The Problem We're Solving

When a traveller searches for a hotel, they're really asking dozens of questions: *Is the WiFi fast enough to work from? Is it quiet at night? Is there actually a working gym?* Guest reviews exist to answer these questions — but most reviews talk about the same things. A hotel might have 300 reviews about the staff and almost nothing about parking, accessibility, or the spa. The traveller searching for accessibility information finds nothing and either books blind or goes elsewhere.

Traditional review platforms don't know what's missing. They display reviews chronologically and leave the gaps invisible.

This platform makes the gaps visible — and then actively fills them.

---

## What the Platform Does

There are two sides:

**For hotel managers:** A live dashboard that shows, at a glance, how well their property is documented across 15 topic areas — cleanliness, location, food, WiFi, parking, the pool, check-in, noise, room comfort, bathrooms, staff, value, spa, accessibility, and sustainability. Rather than reading through thousands of reviews, a manager sees a single **Coverage Score** (0–100) and a colour-coded map of which topics are well-covered (green), thin (amber), or completely missing (red). They can drill into any topic to read an AI-generated plain-English summary of what guests actually say, what the recurring complaints are, and whether sentiment is improving or declining.

**For guests:** A smart review flow that doesn't just collect a star rating. After a guest writes a review, the system reads it and identifies which topics they already covered. It then asks exactly 2 targeted follow-up questions — chosen specifically because that hotel is missing information on those topics. If 400 guests have written about the pool but nobody has mentioned the spa, the next guest gets asked about the spa. Guests can also upload photos, which the system automatically identifies and tags by topic.

---

## The Coverage Score

The Coverage Score is the headline number. It answers: *"How well does the current body of reviews actually represent what it's like to stay here?"*

It is not an average star rating. A hotel with a 9/10 rating but no reviews about accessibility still has a coverage gap. The Coverage Score captures this.

The score is calculated across all 15 topic areas. Each topic gets its own sub-score based on three things — and every single one of those three things is computed or calibrated by ML or AI:

### 1. How many reviews cover this topic — quality-weighted by ML

Before a review can count toward a topic, the system first has to know it covers that topic. This is done by a local ML model (MiniLM) that reads the meaning of the review, not just its keywords. A review saying *"couldn't sleep a wink"* counts toward noise even though the word "noise" never appears.

Once the relevant reviews are identified, they are not counted equally. Each review is scored for quality between 0 and 1 by the ML pipeline. A review whose text sentiment strongly agrees with the hotel's own numeric sub-rating for that topic scores near 1. A review that praises cleanliness in words but submits a low cleanliness score scores near 0 — the internal contradiction signals it's unreliable. The blend between this consistency-based score and a simpler quality signal (based on review length and vocabulary) is itself a value the system has learned separately for each hotel.

Finally, rather than using a fixed rule like "10 reviews = fully covered," the system has learned — per hotel, per topic — the point at which adding more reviews stops meaningfully changing the picture. A busy city hotel might need 20 reviews on a topic before the signal stabilises; a small boutique property might stabilise at 5. This threshold is detected automatically by watching how the running average shifts as reviews accumulate.

### 2. How recent those reviews are

A topic last mentioned two years ago is treated as partially unknown regardless of how many old reviews exist. Guest experience changes — a pool can be renovated, a chef can leave, a new management team can transform service. This component needs no ML; it is a straightforward time decay. It is included because recency is genuinely informative and balances the system against over-relying on historical data.

### 3. What the sentiment is — hybrid of structured data and local ML

For each topic the sentiment signal combines two sources:

- **Expedia's own numeric sub-ratings** — for 9 of the 15 topics, Expedia collects a direct numeric score per review (e.g. a cleanliness score, a location score). This is a clean, structured signal.
- **ML-derived text sentiment** — a two-model local pipeline reads the relevant sentences of each review and classifies them as positive or negative with a confidence score. This uses DistilBERT, a model trained on a large sentiment dataset, which handles negation and context that simple keyword counting cannot.

These two signals are blended together. The blend ratio — how much to trust the written text versus the numeric rating — is learned separately for each hotel by finding the combination that best matches actual overall guest satisfaction. For 6 topics (food, WiFi, parking, noise, spa, accessibility) Expedia provides no numeric sub-rating, so the sentiment score comes entirely from the ML text analysis.

### Combining the 15 topic scores

The 15 topic scores are combined into the single Coverage Score. This is not a simple average — each topic is weighted by how strongly it predicts guest satisfaction *at this specific hotel*. This relationship is learned from the historical review data using a statistical model that measures the correlation between each topic's sentiment and the hotel's overall ratings. At a business hotel, WiFi coverage might carry twice the weight of spa coverage. At a resort, the reverse might be true. The weights are discovered from the data, not set by hand.

---

**In summary: every parameter in the Coverage Score formula was either produced by ML or learned from data.** The ML models decide which reviews count, how much each review is worth, what the sentiment of each review is, when a topic is "saturated," and how much each topic matters. The formula itself has no hard-coded numbers beyond sensible defaults that only apply when a hotel has too little data to learn from.

---

## Where AI Is Used

### 1. Generating follow-up questions

After a guest submits a free-text review, the system sends that review to GPT-4o-mini (OpenAI's model) along with the hotel's current list of knowledge gaps. The AI writes 2 natural, conversational follow-up questions targeting the most urgent uncovered topics. It also decides the best response format for each question — yes/no, free text, or multiple choice.

This is a deliberate AI call rather than a template because the questions need to feel natural and contextual. A template-generated question like "Did you visit the spa?" reads differently from "You mentioned you had a relaxing stay — did you get to try the spa treatments?"

### 2. Summarising what guests are saying

When a manager clicks on any topic on their dashboard, the system passes the 35 most recent relevant reviews to GPT-4o-mini and asks it to synthesise them into a structured briefing: an overall summary, recurring complaints, consistent strengths, and a trend signal (improving or worsening). This turns hundreds of individual data points into a single actionable paragraph. Results are cached so subsequent views are instant.

### 3. Understanding guest photos

Guests can upload photos during the review flow. Each photo is sent to GPT-4o-mini with vision capabilities, which identifies which topic the photo relates to (pool, room, bathroom, etc.), whether the sentiment is positive, negative, or neutral, and generates a short caption. This adds a visual evidence layer to the coverage analysis.

### 4. Pre-classifying the full review history

Before the platform launched, all 7,200 historical Expedia reviews were sent to GPT-4o (the more powerful version) in a one-time batch job. The result is a permanent, pre-computed index of which topics each review covers. This means the platform does not need to re-classify historical reviews at runtime — they are already tagged.

---

## Where Machine Learning Is Used

The distinction from AI above: these components run entirely on the server using downloaded model weights. There are no API calls, no per-query cost, and no network dependency. The models are embedded directly into the application.

### 1. Understanding new reviews (not just keywords)

When a guest submits a new review, the platform needs to know which topics it covers. Keyword matching — looking for the word "pool" to classify a review as being about the pool — fails in obvious ways: *"couldn't sleep all night"* mentions no keyword but is clearly about noise. *"The room was not dirty"* contains the word "dirty" but is a positive cleanliness review.

Instead, the platform uses a local AI model called MiniLM (a compact sentence-understanding model, about 90MB). It converts the review text into a mathematical representation of its meaning and compares it against pre-computed representations of each topic description. Topics that are semantically similar to the review — regardless of exact word match — are assigned.

### 2. Reading sentiment accurately (ABSA)

For each relevant topic in each review, the platform uses a two-stage local pipeline to determine whether what the guest said was positive or negative:

**Stage 1 — Isolation:** The review is split into individual sentences. The MiniLM model is used again to identify which sentences are actually about the topic in question. For a review covering food, check-in, and noise, only the sentences about noise are kept when scoring the noise topic. This prevents a glowing comment about breakfast from inflating the noise score.

**Stage 2 — Classification:** The kept sentences are passed to a second local model, DistilBERT (about 67MB), which was trained on a large dataset of sentiment-labelled sentences. This model reads each sentence in full context — handling negation, sarcasm, and compound sentences — and returns a positive or negative score with a confidence level. Scores across relevant sentences are averaged, weighted by how closely each sentence relates to the topic.

This pipeline runs offline across all 13 properties and all 15 topics, capping at 50 reviews per topic to keep runtime manageable. Results are saved so live queries are instant.

### 3. Learning what a "complete" review picture looks like — per hotel

The system does not use a fixed rule for when a topic is "well covered." Instead it learns, separately for each hotel, at what point adding more reviews stops changing the average score for that topic. A high-volume city-centre hotel might need 25 reviews on a topic before the picture stabilises. A quiet boutique property might stabilise at 6. The platform detects this stabilisation point automatically by watching how the running average changes as reviews accumulate chronologically.

### 4. Learning which topics matter most — per hotel

Not all topics matter equally to all hotels. For a business hotel, WiFi reliability might be the strongest predictor of whether a guest leaves satisfied. For a resort, the pool and spa might dominate. The platform learns this automatically by measuring how strongly each topic's guest sentiment predicts the hotel's overall satisfaction rating. Topics with stronger predictive power get weighted more heavily in the Coverage Score.

### 5. Learning how much to trust AI text analysis vs structured ratings — per hotel

For 9 of the 15 topics, Expedia provides numeric sub-ratings alongside the text reviews (e.g. a specific cleanliness score, a location score). For these topics, the platform blends its AI-derived text sentiment with the numeric sub-rating. The blend ratio — how much to trust the text versus the number — is learned separately for each hotel by finding the combination that best matches actual overall guest satisfaction. Some hotels have guests who write very consistent reviews; at those properties the text signal is trusted more. Others have large discrepancies between written reviews and numeric scores; at those properties the numeric rating is given more weight.

### 6. Weighting review quality, not just review quantity

Rather than counting every review as equal, the platform scores each review's quality contribution between 0 and 1. When a structured numeric rating exists for a topic, a review that says "the room was filthy" but rates cleanliness 9/10 scores low — the text and the rating contradict each other, suggesting the review is unreliable for this topic. A review where the text sentiment and the structured rating closely agree scores high. The blend between this alignment-based quality measure and a simpler heuristic (based on review length, vocabulary, and specificity) is itself learned per hotel.

---

## How the Signals Flow Into the Final Score

```
Guest review text
       │
       ├─── MiniLM (local AI)  ─────────────────── Which topics does this cover?
       │
       ├─── DistilBERT (local AI) ──────────────── What is the sentiment per topic?
       │
       └─── Expedia numeric sub-ratings ─────────── Structured score for 9 topics


Per topic, per property:
  ├── Quality-weighted review count  ÷  learned saturation threshold
  │         ↓
  │    COVERAGE SCORE (0–1)
  │
  ├── Days since last mention
  │         ↓
  │    FRESHNESS SCORE (0–1)
  │
  └── Blend of structured rating + ML text sentiment
            ↓
       SENTIMENT SCORE (0–1)


  ↓  Combined with learned weights (coverage / freshness / sentiment)

  TOPIC SCORE (0–1) × learned importance for this hotel

  ↓  Summed across all relevant topics

  COVERAGE SCORE (0–100)  ←── the number shown on the dashboard
```

GPT-4o-mini is called separately — not in this scoring pipeline — for:
- Writing follow-up questions when a guest submits a review
- Generating topic summaries when a manager opens a topic panel
- Identifying what a guest's uploaded photo shows

---

## What the Manager Sees

| Dashboard element | What it tells them | Powered by |
|---|---|---|
| Coverage Score ring | Overall documentation health, 0–100 | Full ML pipeline |
| Topic coverage map | Which of the 15 areas are well-documented vs missing | ML pipeline + gap thresholds |
| Gap alerts | Critical topics with no recent reviews | Coverage + freshness scores |
| Sentiment alerts | Topics where guest satisfaction is declining | Trend analysis on ML sentiment scores |
| Topic summaries | Plain-English synthesis of what guests say | GPT-4o-mini |
| Live review feed | New reviews appearing in real time during the demo | Server-Sent Events (live push) |
| Before/After Score | Score change after each guest submits a review | ML pipeline, re-run on new review |

---

## What the Guest Experiences

1. Writes a free-text review (voice input supported)
2. Receives 2 follow-up questions targeted at this hotel's knowledge gaps — written by GPT in context
3. Optionally uploads photos — each tagged by topic and sentiment automatically
4. Submits, and immediately sees how their contribution changed the hotel's Coverage Score — with an animated before/after comparison

The entire flow is designed to feel like a natural conversation, not a survey form. The AI writes questions that reference what the guest already wrote, making it feel responsive rather than generic.

---

## The Business Case

The platform addresses a real gap in how review data is collected and used today:

- **For travellers:** More complete, more reliable information per property. Topics that matter to them — accessibility, quiet rooms, working WiFi — are specifically sought out rather than left to chance.
- **For hotels:** Actionable, topic-level intelligence rather than an undifferentiated star rating. A manager can see exactly which gaps are hurting their coverage and what guests in those few reviews actually said.
- **For Expedia:** Higher review quality per property, more structured data, and a mechanism to surface properties that are under-represented in the review corpus — making recommendations more reliable across the portfolio.

The Coverage Score also creates a natural virtuous cycle: hotels with lower scores have clearer gaps, those gaps are targeted by the guest review flow, which raises the score, which makes the property more reliably searchable. Coverage improves because the system knows exactly what is missing.
