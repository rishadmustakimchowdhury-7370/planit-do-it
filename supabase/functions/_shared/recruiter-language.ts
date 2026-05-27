// Executive-search language guardrail.
// Replaces blunt ATS-style phrasing with consultative, recruiter-grade wording
// without inflating evidence. Applied to summary, strengths, considerations,
// risks, missing_requirements and recruiter_review before persistence so EVERY
// downstream surface (UI cards, validation modal, submission pack, executive
// PDF, client portal) reads identical, client-safe wording.

type Rule = [RegExp, string];

const REPLACEMENTS: Rule[] = [
  // Outright dismissals → consultative phrasing
  [/\bno (matched|relevant) skills?\b/gi, "limited direct stack overlap"],
  [/\bno (clear )?match\b/gi, "limited alignment"],
  [/\bnot a match\b/gi, "limited alignment for this brief"],
  [/\bnot suitable\b/gi, "limited alignment for this brief"],
  [/\bnot (a )?qualified\b/gi, "would benefit from technical validation"],
  [/\bunqualified\b/gi, "requires further technical validation"],
  [/\bpoor (fit|match|candidate)\b/gi, "limited alignment"],
  [/\bweak candidate\b/gi, "profile requires further validation"],
  [/\bweak profile\b/gi, "profile that would benefit from further validation"],

  // Negative absolutes → softened gap language
  [/\b(lacks|lacking)\b/gi, "shows limited evidence of"],
  [/\bmissing (experience|background|skills?)\b/gi, "experience appears limited in the provided CV"],
  [/\bdoes not have\b/gi, "shows no direct evidence of"],
  [/\bdoesn['']?t have\b/gi, "shows no direct evidence of"],
  [/\bno (production|deployment|architecture|enterprise) experience\b/gi, "production-scale exposure should be explored at interview"],
  [/\bfails to\b/gi, "does not yet demonstrate"],
  [/\bunable to\b/gi, "not yet showing ability to"],
  [/\bcannot\b/gi, "may need additional ramp-up to"],
  [/\binsufficient\b/gi, "limited"],
  [/\b(too )?junior for\b/gi, "earlier in their career than"],
  [/\boverqualified\b/gi, "more senior than the stated band"],

  // ATS rejection vocabulary
  [/\breject(ed|ion)?\b/gi, "deprioritise"],
  [/\bdisqualif(y|ied|ication)\b/gi, "deprioritise"],
];

export function softenLanguage(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  for (const [re, repl] of REPLACEMENTS) s = s.replace(re, repl);
  // Collapse accidental double spaces from replacements
  return s.replace(/\s{2,}/g, " ").trim();
}

export function softenList(items: any[] | null | undefined): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x) => softenLanguage(typeof x === "string" ? x : String(x ?? "")))
    .filter((s) => s.length > 0);
}
