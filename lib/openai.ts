import OpenAI from "openai";
import { Property } from "./data";
import { TopicAnalysis } from "./analysis";

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
  reviewText: string
): Promise<FollowUpQuestion[]> {
  const client = getClient();

  const gapList = gaps
    .slice(0, 5)
    .map(
      (g) =>
        `- ${g.topicLabel}: ${g.reviewCount === 0 ? "never mentioned in any review" : `only ${g.reviewCount} reviews mention it, last was ${g.freshnessDays} days ago`}. Gap level: ${g.gap}`
    )
    .join("\n");

  const prompt = `You are helping Expedia generate smart follow-up questions for hotel reviewers.

Property: ${sanitizeDescription(property.property_description)}
Location: ${property.city}, ${property.country}
Star Rating: ${property.star_rating}
Key Amenities: ${buildAmenityList(property)}
Pets allowed: ${property.pet_policy.join(" ").toLowerCase().includes("not allowed") ? "No" : "Yes"}
Check-in: ${property.check_in_start_time}

The following topics have information gaps or stale data in our review database:
${gapList}

The reviewer just wrote: "${reviewText.slice(0, 500)}"
They already covered these topics: ${coveredTopics.join(", ") || "none"}

Generate exactly 2 short, specific follow-up questions targeting the highest-priority uncovered gaps.
Questions must:
- Be conversational and easy to answer
- Reference specific property features where relevant (don't be generic)
- Feel natural, like a friend asking about their stay
- NOT ask about anything the reviewer already mentioned
- NOT repeat any topics they covered
- CRITICAL: Each question must cover ONE thing only, never combine two questions into one with "and" or "?" mid-sentence. If you need to ask about two aspects, pick the most important one.

Choose the question type carefully:
- Use "yes_no" for binary questions: "Did you use the pool?", "Was parking available?", "Did the room have a bathtub?"
- Use "text" with scaleType "quality" for experience ratings: "How was the WiFi speed?", "How was the fitness center?", "How was the breakfast quality?"
- Use "text" with scaleType "agreement" for statement-based questions: "The staff were helpful and responsive", "The location was convenient for getting around"
- Use "multiple_choice" only when a fixed set of options is clearly better than a scale

Respond ONLY with a valid JSON array (no markdown, no extra text):
[{"question": "...", "type": "text|yes_no|multiple_choice", "scaleType": "quality|agreement", "options": ["..."] (only if multiple_choice), "topic": "human-readable topic name", "topicId": "one of: cleanliness|location|food_breakfast|wifi_internet|parking|pool_fitness|checkin_checkout|noise|room_comfort|bathroom|staff_service|value|spa_wellness|accessibility|eco_sustainability", "priority": "high|medium"}]`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
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
