// Client-safe - no fs or server-only imports
// Used in both client components and API routes

export interface QualityResult {
  isValid: boolean;
  score: number; // 0–1
  feedback: string;
}

/**
 * Checks whether a review/answer is genuine text.
 * Detects: keyboard mashing, repeated chars, no vowels, too short,
 * all-same-word, zero lexical diversity.
 */
export function checkTextQuality(text: string): QualityResult {
  const trimmed = text.trim();

  // Empty is handled upstream (field is optional)
  if (trimmed.length === 0) {
    return { isValid: true, score: 0, feedback: "" };
  }

  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);

  const lowerNoSpace = trimmed.toLowerCase().replace(/\s+/g, "");
  const uniqueChars = new Set(lowerNoSpace).size;
  const diversityRatio = uniqueChars / Math.min(lowerNoSpace.length, 50);

  // Very low char diversity → mashing (e.g. "aaaaabbbbb", "asdfasdfasdf")
  if (diversityRatio < 0.12) {
    return {
      isValid: false,
      score: 0,
      feedback: "That doesn't look like a real review. Please describe your stay in your own words.",
    };
  }

  // Repeated char run (e.g. "hahahahaha", "aaaaaa")
  if (/(.)\1{5,}/.test(trimmed)) {
    return {
      isValid: false,
      score: 0,
      feedback: "Please write a genuine review about your stay.",
    };
  }

  // Repeated 2–4 char pattern (e.g. "asdfasdf", "lolololol")
  if (/(.{2,4})\1{3,}/.test(trimmed.toLowerCase())) {
    return {
      isValid: false,
      score: 0,
      feedback: "Please write a genuine review about your stay.",
    };
  }

  // Words with no vowels that are longer than 3 chars → keyboard mash
  // Only apply when there are enough words to judge
  const alphaWords = words.map((w) => w.replace(/[^a-zA-Z]/g, ""));
  const noVowelLong = alphaWords.filter(
    (w) => w.length > 3 && !/[aeiouAEIOU]/.test(w)
  );
  if (noVowelLong.length > words.length * 0.45 && words.length > 4) {
    return {
      isValid: false,
      score: 0.1,
      feedback: "Please write a genuine review about your stay.",
    };
  }

  // Very low lexical diversity (same word repeated), only flag when long enough
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, "")));
  if (words.length > 5 && uniqueWords.size < Math.max(2, words.length * 0.35)) {
    return {
      isValid: false,
      score: 0.15,
      feedback: "Please write a more varied review about your experience.",
    };
  }

  // Passed: compute a quality score
  const lengthBonus = Math.min(0.3, words.length / 50);
  const diversityBonus = Math.min(0.2, (uniqueChars - 5) / 25);
  const vocabBonus = uniqueWords.size > 12 ? 0.1 : 0;
  const score = Math.min(1, 0.4 + lengthBonus + diversityBonus + vocabBonus);

  return { isValid: true, score, feedback: "" };
}

/**
 * Validates a follow-up answer - preset options (yes/no, multiple choice)
 * always pass; free-text needs basic sanity.
 */
export function checkAnswerQuality(
  answer: string,
  type: "text" | "yes_no" | "multiple_choice"
): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;

  // Preset options are always valid
  if (type === "yes_no" || type === "multiple_choice") return true;

  // Likert-scale answers (agreement or quality) are valid even as single words
  const LIKERT_VALUES = new Set([
    "strongly disagree", "disagree", "neutral", "agree", "strongly agree",
    "very poor", "poor", "average", "good", "excellent",
    "n/a", "n/a: did not use this facility",
  ]);
  if (LIKERT_VALUES.has(trimmed.toLowerCase())) return true;
  // Likert with elaboration (e.g. "Agree: great WiFi" or "Good: loved the pool")
  const likertPrefix = trimmed.toLowerCase().split(/\s*[—–-]\s*/)[0].trim();
  if (LIKERT_VALUES.has(likertPrefix)) return true;

  // Free-text: at least 2 words, some char diversity
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;

  const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, "")).size;
  return uniqueChars >= 4;
}
