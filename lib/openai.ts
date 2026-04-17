import OpenAI from "openai";
import { Property } from "./data";
import { TopicAnalysis } from "./analysis";
import { ManagerPrompt } from "./manager-prompts";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export interface FollowUpQuestion {
  question: string;
  type: "text" | "yes_no" | "multiple_choice";
  options?: string[];
  topic: string;
  topicId: string;
  priority: "high" | "medium";
}

function buildAmenityList(property: Property): string {
  const amenities = [
    ...property.popular_amenities_list,
    ...property.property_amenity_food_and_drink.slice(0, 3),
    ...property.property_amenity_spa.slice(0, 3),
    ...property.property_amenity_outdoor.slice(0, 3),
    ...property.property_amenity_activities_nearby.slice(0, 3),
  ]
    .filter(Boolean)
    .slice(0, 20)
    .join(", ");
  return amenities;
}

function sanitizeDescription(desc: string): string {
  return desc
    .replace(/\|MASK\|/g, "[hotel name]")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export async function generateFollowUpQuestions(
  property: Property,
  gaps: TopicAnalysis[],
  coveredTopics: string[],
  reviewText: string,
  requiredPrompts: ManagerPrompt[] = [],
): Promise<FollowUpQuestion[]> {
  const client = getClient();

  // Pre-select topics in code — GPT should write the question wording, not decide which topics
  // to ask about. Without this, GPT ignores priority order at temperature > 0.
  const slotsForGaps = Math.max(0, 2 - requiredPrompts.length);
  const selectedGaps = gaps.slice(0, slotsForGaps);

  const gapList = selectedGaps
    .map(
      (g) =>
        `- ${g.topicLabel}: ${g.reviewCount === 0 ? "never mentioned in any review" : `only ${g.reviewCount} reviews mention it, last was ${g.freshnessDays} days ago`}. Gap level: ${g.gap}`
    )
    .join("\n");

  // Build one unified ordered list so GPT cannot misread two separate instructions.
  // For "Other" prompts (topicId=null), use the manager's note as the topic description
  // since it's the only meaningful signal about what to ask.
  const topicsToAsk: { label: string; note?: string }[] = [
    ...requiredPrompts.map((p) => ({
      label: p.topicId ? p.topicLabel : (p.note || "your overall experience"),
      note: p.topicId ? (p.note || undefined) : undefined, // note already used as label for "Other"
    })),
    ...selectedGaps.map((g) => ({ label: g.topicLabel })),
  ].slice(0, 2);

  const topicInstruction = topicsToAsk.length > 0
    ? `Generate exactly one question per topic, in this exact order:\n${topicsToAsk
        .map((t, i) => `${i + 1}. ${t.label}${t.note ? ` (context: "${t.note}")` : ""}`)
        .join("\n")}\nDo not substitute, reorder, or skip any topic. Do NOT mention to the guest that any topic was specifically requested.`
    : "Generate 2 natural follow-up questions based on the property's information gaps above.";

  const prompt = `You are helping Expedia generate smart follow-up questions for hotel reviewers.

Property: ${sanitizeDescription(property.property_description)}
Location: ${property.city}, ${property.country}
Star Rating: ${property.star_rating}
Key Amenities: ${buildAmenityList(property)}
Pets allowed: ${property.pet_policy.join(" ").toLowerCase().includes("not allowed") ? "No" : "Yes"}
Check-in: ${property.check_in_start_time}

The following topics have information gaps or stale data in our review database:
${gapList || "none identified"}

The reviewer just wrote: "${reviewText.slice(0, 500)}"
They already covered these topics: ${coveredTopics.join(", ") || "none"}

Generate exactly 2 short, specific follow-up questions. ${topicInstruction}
Questions must:
- Be conversational and easy to answer
- Reference specific property features where relevant (don't be generic)
- Feel natural, like a friend asking about their stay
- NOT ask about anything the reviewer already mentioned
- NOT repeat any topics they covered
- CRITICAL: Each question must cover ONE thing only, never combine two questions into one with "and" or "?" mid-sentence. If you need to ask about two aspects, pick the most important one.

Choose the question type carefully:
- Use "yes_no" ONLY when it is genuinely unknown whether the guest personally used something: "Did you use the pool?", "Did you try the hotel restaurant?"
- NEVER use "yes_no" to ask whether a facility exists — if it's in the amenity list, assume it exists and ask about the quality instead
- Use "text" with scaleType "quality" for experience ratings: "How was the fitness center?", "How was the WiFi speed?", "How was the breakfast quality?"
- Use "text" with scaleType "agreement" for statement-based questions: "The staff were helpful and responsive", "The location was convenient for getting around"
- Use "multiple_choice" only when a fixed set of options is clearly better than a scale
- Default to "text" with "quality" for any topic gap — it gives the most useful data

Respond ONLY with a valid JSON array (no markdown, no extra text):
[{"question": "...", "type": "text|yes_no|multiple_choice", "scaleType": "quality|agreement", "options": ["..."] (only if multiple_choice), "topic": "human-readable topic name", "topicId": "one of: cleanliness|location|food_breakfast|wifi_internet|parking|pool_fitness|checkin_checkout|noise|room_comfort|bathroom|staff_service|value|spa_wellness|accessibility|eco_sustainability", "priority": "high|medium"}]`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || "[]";
    // Strip any potential markdown fences
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const questions = JSON.parse(cleaned) as FollowUpQuestion[];
    return questions.slice(0, 2);
  } catch (err) {
    console.error("OpenAI error:", err);
    // Fallback questions based on top gap
    const topGap = gaps[0];
    return [
      {
        question: topGap
          ? `How would you describe the ${topGap.topicLabel.toLowerCase()} at this property?`
          : "What aspect of your stay would you like to tell us more about?",
        type: "text",
        topic: topGap?.topicLabel || "General",
        topicId: topGap?.topicId || "staff_service",
        priority: "high",
      },
    ];
  }
}
