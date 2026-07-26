import { CHAT_MODEL, getOpenAI } from "./llm";

export const ENGLISH = "en";

type ScriptRule = {
  script: string;
  /** Languages plausibly written in this script, most common first. */
  candidates: string[];
  test: RegExp;
};

/**
 * Dominant-script detection. Cheap, offline, and enough to decide whether a
 * romanized ("Hinglish"-style) rendering is even meaningful, plus to constrain
 * the language-ID prompt to a sensible candidate set.
 */
const SCRIPT_RULES: ScriptRule[] = [
  { script: "Devanagari", candidates: ["hi", "mr", "ne", "sa"], test: /[ऀ-ॿ]/g },
  { script: "Bengali", candidates: ["bn", "as"], test: /[ঀ-৿]/g },
  { script: "Gurmukhi", candidates: ["pa"], test: /[਀-੿]/g },
  { script: "Gujarati", candidates: ["gu"], test: /[઀-૿]/g },
  { script: "Odia", candidates: ["or"], test: /[଀-୿]/g },
  { script: "Tamil", candidates: ["ta"], test: /[஀-௿]/g },
  { script: "Telugu", candidates: ["te"], test: /[ఀ-౿]/g },
  { script: "Kannada", candidates: ["kn"], test: /[ಀ-೿]/g },
  { script: "Malayalam", candidates: ["ml"], test: /[ഀ-ൿ]/g },
  { script: "Sinhala", candidates: ["si"], test: /[඀-෿]/g },
  { script: "Thai", candidates: ["th"], test: /[฀-๿]/g },
  { script: "Arabic", candidates: ["ar", "ur", "fa", "ps"], test: /[؀-ۿݐ-ݿ]/g },
  { script: "Hebrew", candidates: ["he", "yi"], test: /[֐-׿]/g },
  { script: "Cyrillic", candidates: ["ru", "uk", "sr", "bg"], test: /[Ѐ-ӿ]/g },
  { script: "Greek", candidates: ["el"], test: /[Ͱ-Ͽ]/g },
  { script: "Hangul", candidates: ["ko"], test: /[가-힯ᄀ-ᇿ]/g },
  { script: "Kana", candidates: ["ja"], test: /[぀-ゟ゠-ヿ]/g },
  { script: "Han", candidates: ["zh", "ja"], test: /[一-鿿]/g },
  { script: "Latin", candidates: ["en", "es", "fr", "de", "pt", "it", "id", "vi", "tr"], test: /[A-Za-z]/g },
];

export type ScriptInfo = {
  script: string;
  candidates: string[];
  isLatin: boolean;
};

export function detectScript(text: string): ScriptInfo {
  const sample = text.slice(0, 4000);
  let best: ScriptRule | null = null;
  let bestCount = 0;

  for (const rule of SCRIPT_RULES) {
    const count = (sample.match(rule.test) || []).length;
    // Kana beats Han for Japanese: any kana at all is decisive.
    if (count > bestCount || (rule.script === "Kana" && count > 0 && best?.script === "Han")) {
      best = rule;
      bestCount = count;
    }
  }

  const script = best?.script ?? "Latin";
  return {
    script,
    candidates: best?.candidates ?? [ENGLISH],
    isLatin: script === "Latin",
  };
}

/**
 * Resolves the source language. A caller-supplied hint (e.g. the YouTube caption
 * track's language code) is authoritative; otherwise the script narrows the
 * options and one small model call picks between them. Falls back to the most
 * likely candidate for the script if that call fails.
 */
export async function detectLanguage(text: string, hint?: string | null): Promise<string> {
  const normalizedHint = normalizeLanguageCode(hint);
  if (normalizedHint) return normalizedHint;

  const { candidates, isLatin } = detectScript(text);

  // Single-candidate scripts need no model call.
  if (candidates.length === 1) return candidates[0];

  const sample = buildSample(text);
  if (!sample) return candidates[0];

  try {
    const response = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Identify the dominant language of the sample. Reply as JSON: " +
            `{"language":"<ISO 639-1 code>"}. ` +
            `Choose from: ${candidates.join(", ")}. ` +
            (isLatin
              ? "The text uses the Latin alphabet; it may be a non-English language " +
                "romanized (e.g. Hindi typed as Hinglish) — in that case return the " +
                "underlying language, not English."
              : ""),
        },
        { role: "user", content: sample },
      ],
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    return normalizeLanguageCode(parsed.language) || candidates[0];
  } catch (err) {
    console.warn("Language detection fell back to script heuristic:", err);
    return candidates[0];
  }
}

/** Takes a spread of excerpts so detection is not skewed by an intro or outro. */
function buildSample(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 900) return trimmed;

  const third = Math.floor(trimmed.length / 3);
  return [
    trimmed.slice(0, 300),
    trimmed.slice(third, third + 300),
    trimmed.slice(third * 2, third * 2 + 300),
  ].join("\n...\n");
}

/** Reduces "en-US", "hi_IN", "HI" to a bare primary subtag. */
export function normalizeLanguageCode(code?: string | null): string | null {
  if (!code || typeof code !== "string") return null;
  const primary = code.trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(primary) ? primary : null;
}

export function isEnglish(code?: string | null): boolean {
  return normalizeLanguageCode(code) === ENGLISH;
}

/** English translation is only worth generating for non-English sources. */
export function needsTranslation(code?: string | null): boolean {
  const normalized = normalizeLanguageCode(code);
  return normalized !== null && normalized !== ENGLISH;
}

/** language code -> the script it is normally written in. */
const LANGUAGE_SCRIPT = new Map<string, string>();
for (const rule of SCRIPT_RULES) {
  for (const candidate of rule.candidates) {
    if (!LANGUAGE_SCRIPT.has(candidate)) LANGUAGE_SCRIPT.set(candidate, rule.script);
  }
}

export function scriptForLanguage(code?: string | null): string | null {
  const normalized = normalizeLanguageCode(code);
  return normalized ? LANGUAGE_SCRIPT.get(normalized) ?? null : null;
}

/** Conservative: an unrecognised language is assumed Latin, so we offer nothing. */
export function isLatinScriptLanguage(code?: string | null): boolean {
  const script = scriptForLanguage(code);
  return script === null || script === "Latin";
}

/**
 * A romanized rendering only makes sense when the source is not already written
 * in the Latin alphabet — "Hinglish" for Devanagari Hindi, Romaji for Japanese,
 * and so on. Decided from the language code when it is known, falling back to
 * the text itself.
 */
export function canRomanize(code: string | null | undefined, sampleText?: string): boolean {
  if (isEnglish(code)) return false;

  const script = scriptForLanguage(code);
  if (script !== null) return script !== "Latin";

  return sampleText ? !detectScript(sampleText).isLatin : false;
}

/** Endonym-first display name, e.g. "हिन्दी (Hindi)". Falls back to the raw code. */
export function languageName(code?: string | null): string {
  const normalized = normalizeLanguageCode(code);
  if (!normalized) return "Unknown";

  try {
    const english = new Intl.DisplayNames(["en"], { type: "language" }).of(normalized);
    const native = new Intl.DisplayNames([normalized], { type: "language" }).of(normalized);

    if (native && english && native.toLowerCase() !== english.toLowerCase()) {
      return `${native} (${english})`;
    }
    return english || native || normalized;
  } catch {
    return normalized;
  }
}

/** Short label for the variant switcher, e.g. "हिन्दी" or "English". */
export function shortLanguageName(code?: string | null): string {
  const normalized = normalizeLanguageCode(code);
  if (!normalized) return "Original";

  try {
    return new Intl.DisplayNames([normalized], { type: "language" }).of(normalized) || normalized;
  } catch {
    return normalized;
  }
}
