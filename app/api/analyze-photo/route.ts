import { NextResponse } from "next/server";
import OpenAI from "openai";

const TOPIC_IDS = [
  "cleanliness", "location", "food_breakfast", "wifi_internet", "parking",
  "pool_fitness", "checkin_checkout", "noise", "room_comfort", "bathroom",
  "staff_service", "value", "spa_wellness", "accessibility", "eco_sustainability",
];

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: key });
}

export async function POST(request: Request) {
  try {
    const { dataUrl } = await request.json() as { dataUrl: string };

    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }

    const client = getClient();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "low" },
            },
            {
              type: "text",
              text: `You are analyzing a photo submitted as part of a hotel review.

Identify what part of the hotel this photo shows and its overall impression.

Respond ONLY with valid JSON (no markdown):
{
  "topicId": "one of: ${TOPIC_IDS.join("|")}",
  "topicLabel": "human-readable label for the topic (e.g. 'Room & Comfort', 'Pool & Fitness')",
  "sentiment": "positive|negative|neutral",
  "label": "a short descriptive caption for this photo (max 8 words, e.g. 'Spacious room with city view', 'Cluttered bathroom, poor maintenance')",
  "description": "one sentence describing what you see and why it is positive/negative/neutral"
}`,
            },
          ],
        },
      ],
      max_tokens: 250,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);

    // Validate topicId
    if (!TOPIC_IDS.includes(result.topicId)) {
      result.topicId = "room_comfort";
      result.topicLabel = "Room & Comfort";
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error in /api/analyze-photo:", err);
    return NextResponse.json({ error: "Failed to analyze photo" }, { status: 500 });
  }
}
