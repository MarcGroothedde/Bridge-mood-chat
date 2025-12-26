export type MoodLabel = "negative" | "positive" | "neutral";
export type Mode = "Supportive" | "Exploratory";

export type MoodDecision = {
  mood: MoodLabel;
  mode: Mode;
  score: number;
  confidence: number;
  reason: string;
  matches: {
    positive: string[];
    negative: string[];
  };
};

type WeightedCue = {
  pattern: RegExp;
  weight: number;
  label: string;
};

const positiveCues: WeightedCue[] = [
  { pattern: /\bexcited\b/i, weight: 2, label: "excited" },
  { pattern: /\bhappy\b/i, weight: 2, label: "happy" },
  { pattern: /\bcurious\b/i, weight: 1.5, label: "curious" },
  { pattern: /\binterested\b/i, weight: 1.5, label: "interested" },
  { pattern: /\bgrateful\b/i, weight: 2, label: "grateful" },
  { pattern: /\bthank(s| you)\b/i, weight: 1.5, label: "thankful" },
  { pattern: /\bhopeful\b/i, weight: 1.5, label: "hopeful" },
  { pattern: /\bgreat\b/i, weight: 1.2, label: "great" },
  { pattern: /\bgood\b/i, weight: 1, label: "good" },
  { pattern: /\blove\b/i, weight: 2, label: "love" },
  { pattern: /\bwin|success|awesome\b/i, weight: 1.5, label: "success" },
];

const negativeCues: WeightedCue[] = [
  { pattern: /\bstress(ed)?\b/i, weight: 2.5, label: "stressed" },
  { pattern: /\banxious|anxiety\b/i, weight: 2.5, label: "anxious" },
  { pattern: /\boverwhelmed\b/i, weight: 2.5, label: "overwhelmed" },
  { pattern: /\bworried|worry\b/i, weight: 2, label: "worried" },
  { pattern: /\bsad|upset|down\b/i, weight: 2, label: "sad" },
  { pattern: /\bfrustrated|frustrating\b/i, weight: 2, label: "frustrated" },
  { pattern: /\bconfused|lost\b/i, weight: 1.5, label: "confused" },
  { pattern: /\bangry|mad\b/i, weight: 2.5, label: "angry" },
  { pattern: /\bexhausted|tired\b/i, weight: 1.5, label: "tired" },
  { pattern: /\bhate|terrible|awful\b/i, weight: 2, label: "harsh negative" },
];

const intensifiers = ["very", "really", "so", "extremely", "super", "incredibly"];
const negations = ["not", "never", "hardly", "barely", "rarely"];

function countMatches(message: string, cues: WeightedCue[]) {
  const matches: string[] = [];
  let score = 0;

  for (const cue of cues) {
    const found = message.match(cue.pattern);
    if (found) {
      matches.push(cue.label);
      const around = getContextWindow(message, found.index ?? 0, found[0].length);
      const modifier = computeModifier(around);
      score += cue.weight * modifier;
    }
  }

  return { score, matches };
}

function getContextWindow(message: string, start: number, length: number) {
  const windowStart = Math.max(0, start - 20);
  const windowEnd = Math.min(message.length, start + length + 20);
  return message.slice(windowStart, windowEnd).toLowerCase();
}

function computeModifier(context: string) {
  const hasIntensifier = intensifiers.some((word) => context.includes(word));
  const hasNegation = negations.some((word) => context.includes(word));
  if (hasNegation) {
    return 0.5;
  }
  if (hasIntensifier) {
    return 1.4;
  }
  return 1;
}

function normalize(message: string) {
  return message.replace(/\s+/g, " ").trim();
}

export function detectMood(message: string): MoodDecision {
  const normalized = normalize(message);
  if (!normalized) {
    return {
      mood: "neutral",
      mode: "Exploratory",
      score: 0,
      confidence: 0,
      reason: "Empty message defaults to neutral exploratory mode.",
      matches: { positive: [], negative: [] },
    };
  }

  const lower = normalized.toLowerCase();
  const pos = countMatches(lower, positiveCues);
  const neg = countMatches(lower, negativeCues);

  // penalize for obvious brevity when no cues
  const isVeryShort = normalized.split(" ").length <= 2;
  if (isVeryShort && pos.score === 0 && neg.score === 0) {
    return {
      mood: "neutral",
      mode: "Exploratory",
      score: 0,
      confidence: 0.2,
      reason: "Very short message without sentiment cues stays neutral; explore gently.",
      matches: { positive: [], negative: [] },
    };
  }

  const score = pos.score - neg.score;
  const magnitude = Math.abs(score);
  const total = pos.score + neg.score || 1;
  const confidence = Math.min(1, magnitude / total);

  let mood: MoodLabel = "neutral";
  if (score <= -0.5) mood = "negative";
  else if (score >= 0.5) mood = "positive";

  const mode: Mode = mood === "negative" ? "Supportive" : "Exploratory";

  const reasonSegments = [
    pos.matches.length ? `Positive cues: ${pos.matches.join(", ")}` : null,
    neg.matches.length ? `Negative cues: ${neg.matches.join(", ")}` : null,
    mood === "neutral" ? "Mixed or weak signals; defaulting to exploratory." : null,
  ].filter(Boolean);

  return {
    mood,
    mode,
    score,
    confidence: Number(confidence.toFixed(2)),
    reason: reasonSegments.join(" | "),
    matches: { positive: pos.matches, negative: neg.matches },
  };
}

