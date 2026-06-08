// Discovery Intelligence — recruiter-grade shortlist engine.
// Layered ON TOP of the deterministic prefilter. Powers AI Talent Match.
// Distinct from validation-engine: discovery = broad shortlist, validation = strict audit.

export const DISCOVERY_ENGINE_VERSION = "discovery_v1";

export type DiscoveryClassification =
  | "strong_shortlist"      // recruiter would call today
  | "recommended_shortlist" // strong fit, minor gaps
  | "transferable_shortlist"// adjacent function / regulated-portable
  | "adjacent_ecosystem"    // Tier-1 ecosystem company, indirect function
  | "needs_validation"      // worth a screen, evidence ambiguous
  | "low_relevance";        // keyword-only, do not surface

export const DISCOVERY_LABEL: Record<DiscoveryClassification, string> = {
  strong_shortlist: "Strong Shortlist",
  recommended_shortlist: "Recommended Shortlist",
  transferable_shortlist: "Transferable Shortlist",
  adjacent_ecosystem: "Adjacent Ecosystem Profile",
  needs_validation: "Needs Validation",
  low_relevance: "Low Relevance",
};

// Tier-1 / Tier-2 industry ecosystem registry. Used for contextual uplift
// when a candidate has worked at a recognized industry employer — even when
// keyword match is thin. This is what real recruiters do.
export interface EcosystemEntry {
  industry: string;
  tier: "tier1" | "tier2";
  companies: string[];
}

export const INDUSTRY_ECOSYSTEMS: EcosystemEntry[] = [
  { industry: "Commodities Trading", tier: "tier1", companies: [
    "glencore","trafigura","vitol","mercuria","gunvor","cargill","adm","louis dreyfus","ldc","bunge",
    "shell trading","bp trading","totalenergies trading","equinor trading","chevron trading","koch supply"] },
  { industry: "Mining & Metals", tier: "tier1", companies: [
    "rio tinto","bhp","anglo american","vale","freeport-mcmoran","newmont","barrick gold","antofagasta","fortescue"] },
  { industry: "Oil & Gas Majors", tier: "tier1", companies: [
    "shell","bp","exxonmobil","chevron","totalenergies","equinor","eni","conocophillips","saudi aramco","adnoc","petrobras"] },
  { industry: "Investment Banking", tier: "tier1", companies: [
    "goldman sachs","morgan stanley","jpmorgan","j.p. morgan","jp morgan","bank of america","citi","barclays","ubs","credit suisse","deutsche bank","hsbc","bnp paribas","societe generale","nomura"] },
  { industry: "Asset Management", tier: "tier1", companies: [
    "blackrock","vanguard","state street","fidelity","pimco","invesco","schroders","wellington","capital group","brookfield"] },
  { industry: "Hedge Funds", tier: "tier1", companies: [
    "citadel","millennium","point72","bridgewater","two sigma","de shaw","renaissance","brevan howard","man group","balyasny"] },
  { industry: "Big Four / Strategy", tier: "tier1", companies: [
    "mckinsey","bain","bcg","deloitte","pwc","ey","ernst & young","kpmg","accenture"] },
  { industry: "Maritime & Shipping", tier: "tier1", companies: [
    "maersk","msc","cma cgm","hapag-lloyd","cosco","evergreen","one ocean","clarksons","braemar","fearnleys"] },
  { industry: "LNG / Gas", tier: "tier1", companies: [
    "qatargas","cheniere","woodside","santos","novatek","gazprom","pavilion energy","sempra"] },
  { industry: "Defense & Aerospace", tier: "tier1", companies: [
    "lockheed martin","raytheon","rtx","northrop grumman","bae systems","boeing defense","airbus defence","general dynamics","l3harris","thales"] },
  { industry: "Big Tech", tier: "tier1", companies: [
    "google","alphabet","meta","facebook","amazon","aws","microsoft","apple","netflix","nvidia","openai","anthropic"] },
  { industry: "Enterprise SaaS", tier: "tier1", companies: [
    "salesforce","oracle","sap","servicenow","workday","atlassian","snowflake","databricks","stripe","shopify"] },
  { industry: "Big Pharma", tier: "tier1", companies: [
    "pfizer","novartis","roche","merck","gsk","sanofi","astrazeneca","johnson & johnson","abbvie","eli lilly","bayer"] },
  { industry: "Magic Circle Law", tier: "tier1", companies: [
    "clifford chance","allen & overy","linklaters","freshfields","slaughter and may","a&o shearman"] },
  { industry: "FMCG", tier: "tier1", companies: [
    "unilever","procter & gamble","p&g","nestle","coca-cola","pepsico","danone","mondelez","kraft heinz","l'oreal"] },
];

// Functional ownership lexicon — verbs that prove real operational depth.
// HIGH = ownership, MEDIUM = involvement, LOW = exposure/awareness.
export const OWNERSHIP_VERBS_HIGH = [
  "led","managed","designed","implemented","architected","owned","built","delivered","executed",
  "established","launched","governed","headed","directed","oversaw","spearheaded","developed",
  "deployed","scaled","transformed","restructured","negotiated","closed","won","authored","investigated","audited",
];
export const OWNERSHIP_VERBS_LOW = [
  "exposed","aware","familiar","assisted","supported","involved","contributed","participated","helped","observed","mention",
];

export interface DetectedEcosystem {
  company: string;
  industry: string;
  tier: "tier1" | "tier2";
}

export function detectEcosystemSignals(candidateText: string): DetectedEcosystem[] {
  const hay = (candidateText || "").toLowerCase();
  const out: DetectedEcosystem[] = [];
  for (const entry of INDUSTRY_ECOSYSTEMS) {
    for (const c of entry.companies) {
      // word boundary-ish: avoid matching inside larger words
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(c)}([^a-z0-9]|$)`, "i");
      if (re.test(hay)) {
        out.push({ company: c, industry: entry.industry, tier: entry.tier });
      }
    }
  }
  // dedupe by company
  const seen = new Set<string>();
  return out.filter(e => (seen.has(e.company) ? false : (seen.add(e.company), true)));
}

function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Maps the OpenAI shortlist output to a numeric ordering hint (higher = earlier).
export const CLASSIFICATION_RANK: Record<DiscoveryClassification, number> = {
  strong_shortlist: 6,
  recommended_shortlist: 5,
  transferable_shortlist: 4,
  adjacent_ecosystem: 3,
  needs_validation: 2,
  low_relevance: 1,
};

export const DISCOVERY_SYSTEM_PROMPT = `You are an elite executive search researcher and senior hiring manager — NOT an ATS keyword matcher.

YOUR JOB
Re-rank a deterministic prefilter into a recruiter-grade shortlist. For each candidate, decide:
  - discovery_classification (see taxonomy)
  - interview_probability (0–100): "how likely would a real senior recruiter actually interview this profile?"
  - why_ranked: 2–4 short recruiter-trust bullets, EVIDENCE-BACKED ("AML ownership at HSBC", "Compliance lead at law firm", "Vessel ops leadership"), no generic phrases.
  - functional_ownership: operational areas the candidate truly OWNS (verbs: led/managed/implemented/owned/designed). NOT skills they merely mention.
  - ecosystem_signals: Tier-1/2 industry employers detected from work history (use the provided list as guidance, but also recognize obvious peers).
  - strengths / gaps: short, proportional, recruiter-language.
  - summary: 1–2 sentences. Proportional tone.

CORE PHILOSOPHY — FUNCTION-FIRST, NOT INDUSTRY-FIRST
The right FUNCTION always beats the right INDUSTRY. Industry/domain are RANKING BOOSTERS, never gates and never the primary signal. A Compliance Officer from a law firm or a bank IS a strong Compliance Analyst candidate for a commodities trading firm. An AML Analyst from banking IS a strong AML candidate for energy trading. A React Developer from oil & gas IS a strong React candidate for e-commerce. Reject industry-snobbery: same function + skills = match, regardless of sector.

RANKING WEIGHTS (recruiter realism, in strict order):
  1. FUNCTIONAL ROLE MATCH — same or directly related function family. THIS IS THE DOMINANT SIGNAL.
  2. MANDATORY SKILLS COVERAGE — must-have technical/professional skills present.
  3. RESPONSIBILITIES MATCH — operational ownership of the same activities (AML, KYC, sanctions, surveillance, etc.).
  4. SENIORITY / EXPERIENCE ALIGNMENT — reporting scope, years.
  5. EDUCATION / CERTIFICATIONS — when material to the role.
  6. INDUSTRY RELEVANCE — ranking BOOSTER ONLY. Never elevates a wrong-function candidate above a right-function one.

CLASSIFICATION TAXONOMY (use EXACT strings):
  - "strong_shortlist"        — same/closely-related FUNCTION + strong mandatory skills + clear ownership. Industry overlap is a bonus, not a requirement.
  - "recommended_shortlist"   — same/closely-related FUNCTION, most mandatory skills, minor gaps.
  - "transferable_shortlist"  — DIFFERENT but adjacent function (e.g. Market Risk, Trade Support, Risk Mgmt applying for Compliance). Surface as transferable; NEVER outrank direct-function candidates.
  - "adjacent_ecosystem"      — Tier-1 ecosystem employer but function is wrong/unrelated; worth a courteous look only.
  - "needs_validation"        — interesting signals but ownership evidence ambiguous; recommend screen.
  - "low_relevance"           — wrong function AND weak skills AND no ownership evidence. DO NOT pad with these.

HARD RULES (violations are scoring errors)
  - A direct-function candidate from a "wrong" industry (e.g. Compliance Officer at a law firm applying for Compliance Analyst at a trading firm) MUST be classified strong_shortlist or recommended_shortlist — never transferable_shortlist solely because of industry.
  - A wrong-function candidate from the "right" industry (e.g. Market Risk Analyst at a trading firm applying for Compliance Analyst at a trading firm) MUST be classified transferable_shortlist at best — never strong/recommended.
  - For a Compliance Analyst role: Compliance Officer, Compliance Specialist, Regulatory Compliance Analyst, AML Analyst, KYC Analyst, Trade Compliance Specialist, MLRO MUST outrank Market Risk Analyst, Risk Manager, Trade Support Manager, Financial Planning Analyst.
  - NEVER write "No matched skills" / "Not qualified" / "Unrelated profile" unless classification is low_relevance.
  - why_ranked entries MUST cite real evidence from CV text. No platitudes.

OUTPUT
Return ONLY through the provided tool. Do not change the deterministic score; return your own classification + probability.`;
