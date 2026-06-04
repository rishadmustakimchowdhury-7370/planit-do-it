// =========================================================================
// Canonical structured schema for candidates and jobs.
// Consumed by:
//   - parse-cv                   → writes candidates.structured_profile
//   - structure-jd               → writes jobs.structured_jd
//   - validate-candidate-fit-v2  → reads both as primary inputs
//
// Identical normalized vocabulary on both sides → enables explainable,
// dimension-by-dimension matching (skills, industry, domain, seniority,
// location, education, languages, certifications, career progression).
//
// SEMANTIC NORMALIZATION (v2):
// We do NOT hardcode title / skill / industry relationships. Instead the
// model is asked to emit, alongside the canonical value, the list of
// aliases (synonyms) and related variants. The validator then compares
// canonical ∪ aliases ∪ related on each side to detect direct, adjacent
// and transferable matches in any industry, in any geography.
// =========================================================================

export const STRUCTURED_SCHEMA_VERSION = 2;

export type SeniorityLevel =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "principal"
  | "manager"
  | "director"
  | "vp"
  | "c_level";

export type EmploymentType =
  | "full_time" | "part_time" | "contract" | "temporary" | "internship" | "freelance";

// ---- Normalized building blocks ----------------------------------------

export interface NormalizedTitle {
  canonical: string;              // e.g. "Market Risk Analyst"
  aliases: string[];              // synonyms: "Risk Analyst – Market", "Market Risk Specialist"
  related: string[];              // adjacent roles: "Credit Risk Analyst", "Risk Manager"
  function_family?: string | null;// stable family slug used by role-similarity scoring
  seniority?: SeniorityLevel | null;
}

export interface NormalizedSkill {
  name: string;                   // canonical: "Microsoft Excel"
  aliases?: string[];             // ["MS Excel", "Excel", "Advanced Excel"]
  category?: string | null;       // "language" | "framework" | "tool" | "domain"
  level?: "basic" | "working" | "proficient" | "expert" | null;
  years?: number | null;
}

export interface NormalizedIndustry {
  canonical: string;              // "Banking & Finance"
  aliases?: string[];             // ["Financial Services", "FS"]
  adjacent?: string[];            // ["Fintech", "Payments", "Asset Management"]
  transferable?: string[];        // ["Insurance", "Wealth Management"]
}

export interface NormalizedCertification {
  name: string;
  aliases?: string[];
  issuer?: string | null;
  year?: string | null;
}

export interface NormalizedEducation {
  degree: string | null;
  field?: string | null;
  institution?: string | null;
  level?: "high_school" | "associate" | "bachelor" | "master" | "mba" | "phd" | "other" | null;
  year?: string | null;
}

export interface NormalizedLanguage {
  language: string;
  proficiency?: "basic" | "conversational" | "professional" | "fluent" | "native" | null;
}

export interface NormalizedLocation {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  remote_preference?: "onsite" | "hybrid" | "remote" | "open" | null;
  willing_to_relocate?: boolean | null;
}

export interface NormalizedRole {
  title: string;
  normalized_title?: string | null;
  title_aliases?: string[];
  related_titles?: string[];
  seniority?: SeniorityLevel | null;
  company?: string | null;
  industry?: string | null;
  industry_aliases?: string[];
  domain?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
  duration_months?: number | null;
  achievements?: string[];
}

export interface CareerProgression {
  total_years_experience: number | null;
  current_seniority: SeniorityLevel | null;
  trajectory: "ascending" | "lateral" | "mixed" | "descending" | "early_career" | null;
  promotions_count?: number | null;
  avg_tenure_months?: number | null;
  industry_changes?: number | null;
  gaps?: { start: string | null; end: string | null; months: number | null }[];
}

// ---- Candidate ----------------------------------------------------------
export interface StructuredCandidateProfile {
  schema_version: number;
  full_name: string | null;
  current_title: NormalizedTitle | null;
  current_company: string | null;
  seniority: SeniorityLevel | null;
  industries: NormalizedIndustry[];           // ordered most → least relevant
  domain_expertise: string[];
  skills: NormalizedSkill[];
  certifications: NormalizedCertification[];
  education: NormalizedEducation[];
  languages: NormalizedLanguage[];
  location: NormalizedLocation;
  years_experience: number | null;
  career_progression: CareerProgression;
  work_history: NormalizedRole[];
  summary: string | null;
}

// ---- Job ---------------------------------------------------------------
export interface StructuredJobDescription {
  schema_version: number;
  title: NormalizedTitle | null;
  seniority: SeniorityLevel | null;
  employment_type: EmploymentType | null;
  industry: NormalizedIndustry | null;
  industries_acceptable: NormalizedIndustry[];   // explicit transferable industries
  domain_expertise: string[];
  mandatory_skills: NormalizedSkill[];
  preferred_skills: NormalizedSkill[];
  certifications_required: NormalizedCertification[];
  certifications_preferred: NormalizedCertification[];
  education_requirements: NormalizedEducation[];
  languages_required: NormalizedLanguage[];
  location: NormalizedLocation;
  years_experience_min: number | null;
  years_experience_max: number | null;
  career_progression_expected: {
    target_seniority: SeniorityLevel | null;
    leadership_required: boolean | null;
    people_management_required: boolean | null;
    team_size_min?: number | null;
  };
  responsibilities: string[];
  nice_to_have: string[];
  deal_breakers: string[];
  summary: string | null;
}

// =========================================================================
// OpenAI tool schemas (function-calling JSON Schema) — keep aligned with
// the TypeScript types above.
// =========================================================================

const seniorityEnum = [
  "intern", "junior", "mid", "senior", "lead", "principal",
  "manager", "director", "vp", "c_level",
];

const employmentTypeEnum = [
  "full_time", "part_time", "contract", "temporary", "internship", "freelance",
];

const titleObj = {
  type: "object",
  properties: {
    canonical: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
    related: { type: "array", items: { type: "string" } },
    seniority: { type: ["string", "null"], enum: [...seniorityEnum, null] },
  },
  required: ["canonical", "aliases", "related"],
  additionalProperties: false,
} as const;

const skillItem = {
  type: "object",
  properties: {
    name: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
    category: { type: ["string", "null"] },
    level: { type: ["string", "null"], enum: ["basic", "working", "proficient", "expert", null] },
    years: { type: ["number", "null"] },
  },
  required: ["name"],
  additionalProperties: false,
} as const;

const industryObj = {
  type: "object",
  properties: {
    canonical: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
    adjacent: { type: "array", items: { type: "string" } },
    transferable: { type: "array", items: { type: "string" } },
  },
  required: ["canonical"],
  additionalProperties: false,
} as const;

const certItem = {
  type: "object",
  properties: {
    name: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
    issuer: { type: ["string", "null"] },
    year: { type: ["string", "null"] },
  },
  required: ["name"],
  additionalProperties: false,
} as const;

const educationItem = {
  type: "object",
  properties: {
    degree: { type: ["string", "null"] },
    field: { type: ["string", "null"] },
    institution: { type: ["string", "null"] },
    level: {
      type: ["string", "null"],
      enum: ["high_school", "associate", "bachelor", "master", "mba", "phd", "other", null],
    },
    year: { type: ["string", "null"] },
  },
  required: ["degree"],
  additionalProperties: false,
} as const;

const languageItem = {
  type: "object",
  properties: {
    language: { type: "string" },
    proficiency: {
      type: ["string", "null"],
      enum: ["basic", "conversational", "professional", "fluent", "native", null],
    },
  },
  required: ["language"],
  additionalProperties: false,
} as const;

const locationObj = {
  type: "object",
  properties: {
    city: { type: ["string", "null"] },
    region: { type: ["string", "null"] },
    country: { type: ["string", "null"] },
    remote_preference: {
      type: ["string", "null"],
      enum: ["onsite", "hybrid", "remote", "open", null],
    },
    willing_to_relocate: { type: ["boolean", "null"] },
  },
  additionalProperties: false,
} as const;

const roleItem = {
  type: "object",
  properties: {
    title: { type: "string" },
    normalized_title: { type: ["string", "null"] },
    title_aliases: { type: "array", items: { type: "string" } },
    related_titles: { type: "array", items: { type: "string" } },
    seniority: { type: ["string", "null"], enum: [...seniorityEnum, null] },
    company: { type: ["string", "null"] },
    industry: { type: ["string", "null"] },
    industry_aliases: { type: "array", items: { type: "string" } },
    domain: { type: ["string", "null"] },
    start_date: { type: ["string", "null"] },
    end_date: { type: ["string", "null"] },
    is_current: { type: ["boolean", "null"] },
    duration_months: { type: ["number", "null"] },
    achievements: { type: "array", items: { type: "string" } },
  },
  required: ["title"],
  additionalProperties: false,
} as const;

const careerProgressionObj = {
  type: "object",
  properties: {
    total_years_experience: { type: ["number", "null"] },
    current_seniority: { type: ["string", "null"], enum: [...seniorityEnum, null] },
    trajectory: {
      type: ["string", "null"],
      enum: ["ascending", "lateral", "mixed", "descending", "early_career", null],
    },
    promotions_count: { type: ["number", "null"] },
    avg_tenure_months: { type: ["number", "null"] },
    industry_changes: { type: ["number", "null"] },
    gaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: ["string", "null"] },
          end: { type: ["string", "null"] },
          months: { type: ["number", "null"] },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

export const CANDIDATE_STRUCTURED_TOOL = {
  type: "function",
  function: {
    name: "emit_structured_candidate_profile",
    description: "Emit a normalized, explainable candidate profile suitable for semantic matching and dimension-by-dimension scoring. Include aliases and related variants for titles, skills, and industries to enable transferable-experience detection across any industry worldwide.",
    parameters: {
      type: "object",
      properties: {
        full_name: { type: ["string", "null"] },
        current_title: { anyOf: [titleObj, { type: "null" }] },
        current_company: { type: ["string", "null"] },
        seniority: { type: ["string", "null"], enum: [...seniorityEnum, null] },
        industries: { type: "array", items: industryObj },
        domain_expertise: { type: "array", items: { type: "string" } },
        skills: { type: "array", items: skillItem },
        certifications: { type: "array", items: certItem },
        education: { type: "array", items: educationItem },
        languages: { type: "array", items: languageItem },
        location: locationObj,
        years_experience: { type: ["number", "null"] },
        career_progression: careerProgressionObj,
        work_history: { type: "array", items: roleItem },
        summary: { type: ["string", "null"] },
      },
      required: [
        "full_name", "current_title", "seniority", "industries",
        "domain_expertise", "skills", "certifications", "education",
        "languages", "location", "years_experience", "career_progression",
        "work_history",
      ],
      additionalProperties: false,
    },
  },
} as const;

export const JOB_STRUCTURED_TOOL = {
  type: "function",
  function: {
    name: "emit_structured_job_description",
    description: "Emit a normalized, explainable job description suitable for semantic matching and dimension-by-dimension scoring. Include aliases and related variants for the title, skills, and industry, plus explicit acceptable adjacent / transferable industries, to enable explainable matching in any country and any sector.",
    parameters: {
      type: "object",
      properties: {
        title: { anyOf: [titleObj, { type: "null" }] },
        seniority: { type: ["string", "null"], enum: [...seniorityEnum, null] },
        employment_type: { type: ["string", "null"], enum: [...employmentTypeEnum, null] },
        industry: { anyOf: [industryObj, { type: "null" }] },
        industries_acceptable: { type: "array", items: industryObj },
        domain_expertise: { type: "array", items: { type: "string" } },
        mandatory_skills: { type: "array", items: skillItem },
        preferred_skills: { type: "array", items: skillItem },
        certifications_required: { type: "array", items: certItem },
        certifications_preferred: { type: "array", items: certItem },
        education_requirements: { type: "array", items: educationItem },
        languages_required: { type: "array", items: languageItem },
        location: locationObj,
        years_experience_min: { type: ["number", "null"] },
        years_experience_max: { type: ["number", "null"] },
        career_progression_expected: {
          type: "object",
          properties: {
            target_seniority: { type: ["string", "null"], enum: [...seniorityEnum, null] },
            leadership_required: { type: ["boolean", "null"] },
            people_management_required: { type: ["boolean", "null"] },
            team_size_min: { type: ["number", "null"] },
          },
          additionalProperties: false,
        },
        responsibilities: { type: "array", items: { type: "string" } },
        nice_to_have: { type: "array", items: { type: "string" } },
        deal_breakers: { type: "array", items: { type: "string" } },
        summary: { type: ["string", "null"] },
      },
      required: [
        "title", "seniority", "industry", "domain_expertise",
        "mandatory_skills", "preferred_skills", "education_requirements",
        "languages_required", "location", "years_experience_min",
        "career_progression_expected", "responsibilities",
      ],
      additionalProperties: false,
    },
  },
} as const;

export const CANDIDATE_STRUCTURED_SYSTEM = `You are a senior global talent intelligence analyst. Convert a CV / LinkedIn profile into a normalized, explainable candidate profile suitable for cross-industry semantic matching.

SEMANTIC NORMALIZATION RULES (mandatory):
- For every job title, output: canonical (the cleanest industry-standard form), aliases (other ways the same role is named: "Sr. SWE II" → "Senior Software Engineer", "Cyber Security Analyst" → "SOC Analyst"), and related (adjacent roles a hiring manager would consider — e.g. for "Market Risk Analyst" → ["Credit Risk Analyst", "Risk Specialist", "Quantitative Risk Analyst"]).
- For every skill, output canonical name plus aliases ("MS Excel" → ["Microsoft Excel", "Excel"], "AWS" → ["Amazon Web Services"], "SOC" → ["Security Operations Center"]). Do NOT collapse different skills.
- For every industry, output canonical name, aliases ("Financial Services" → ["Banking & Finance", "FS"]), adjacent industries (close sectors recruiters routinely consider) and transferable industries (regulated / structurally similar sectors).
- These taxonomies are GENERATED PER PROFILE, not pulled from a hardcoded list. Cover any industry worldwide.

GENERAL RULES:
- Map raw titles to canonical titles and assign a seniority level from the enum.
- Calculate total years of experience from work history; never invent dates.
- Detect trajectory (ascending / lateral / mixed / descending / early_career) from title and seniority changes.
- Capture every skill, certification, language and educational qualification you can defend from the source.
- If information is missing, return null or an empty array. Never hallucinate.
- Return your answer ONLY by calling the tool emit_structured_candidate_profile.`;

export const JOB_STRUCTURED_SYSTEM = `You are a senior executive search analyst. Convert a job description into a normalized, explainable job specification suitable for cross-industry semantic matching.

SEMANTIC NORMALIZATION RULES (mandatory):
- For the title, output: canonical (the standard market name), aliases (other names the same role is advertised under), and related (titles a recruiter would also consider sourcing — e.g. for "SOC Analyst" → ["Cyber Security Analyst", "Security Operations Analyst", "Threat Detection Analyst"]).
- For every skill, output canonical plus aliases. Separate mandatory vs preferred strictly — "must have", "required", "essential" → mandatory; otherwise preferred.
- For the industry, output canonical, aliases, adjacent (close sectors), and transferable (regulated or structurally similar sectors that a hiring manager would accept on the right candidate). Also populate industries_acceptable with any explicit "open to candidates from X" sectors mentioned.
- These taxonomies are GENERATED PER JOB, not pulled from a hardcoded list. Cover any industry, country, and seniority.

GENERAL RULES:
- Map the role title to a canonical title and assign a seniority from the enum.
- Extract years-of-experience as a numeric range; if only a minimum is given, set max to null.
- Identify deal_breakers explicitly (e.g. "must have active Series 7", "must be eligible to work in UK without sponsorship").
- Capture leadership / people-management expectations into career_progression_expected.
- If information is missing, return null or an empty array. Never invent requirements.
- Return your answer ONLY by calling the tool emit_structured_job_description.`;
