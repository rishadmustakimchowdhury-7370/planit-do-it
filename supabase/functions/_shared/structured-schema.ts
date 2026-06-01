// =========================================================================
// Canonical structured schema for candidates and jobs.
// Consumed by:
//   - parse-cv         → writes candidates.structured_profile
//   - structure-jd     → writes jobs.structured_jd
//   - validate-candidate-fit (Stage 3) → reads both as primary inputs
//
// Identical normalized vocabulary on both sides → enables explainable,
// dimension-by-dimension matching (skills, industry, domain, seniority,
// location, education, languages, certifications, career progression).
// =========================================================================

export const STRUCTURED_SCHEMA_VERSION = 1;

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

export interface NormalizedSkill {
  name: string;                 // canonical skill, e.g. "TypeScript"
  category?: string | null;     // e.g. "language", "framework", "tool", "domain"
  level?: "basic" | "working" | "proficient" | "expert" | null;
  years?: number | null;
}

export interface NormalizedCertification {
  name: string;
  issuer?: string | null;
  year?: string | null;
}

export interface NormalizedEducation {
  degree: string | null;        // e.g. "BSc Computer Science"
  field?: string | null;        // e.g. "Computer Science"
  institution?: string | null;
  level?: "high_school" | "associate" | "bachelor" | "master" | "mba" | "phd" | "other" | null;
  year?: string | null;
}

export interface NormalizedLanguage {
  language: string;             // e.g. "English"
  proficiency?: "basic" | "conversational" | "professional" | "fluent" | "native" | null;
}

export interface NormalizedLocation {
  city?: string | null;
  region?: string | null;       // state / county / province
  country?: string | null;
  remote_preference?: "onsite" | "hybrid" | "remote" | "open" | null;
  willing_to_relocate?: boolean | null;
}

export interface NormalizedRole {
  title: string;
  normalized_title?: string | null;   // canonicalised (e.g. "Software Engineer")
  seniority?: SeniorityLevel | null;
  company?: string | null;
  industry?: string | null;
  domain?: string | null;             // e.g. "Payments", "Talent Acquisition"
  start_date?: string | null;         // ISO-ish, may be partial "YYYY" or "YYYY-MM"
  end_date?: string | null;           // null if current
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
  current_title: string | null;
  current_company: string | null;
  seniority: SeniorityLevel | null;
  industries: string[];               // ordered most → least relevant
  domain_expertise: string[];         // functional/subject domains
  skills: NormalizedSkill[];
  certifications: NormalizedCertification[];
  education: NormalizedEducation[];
  languages: NormalizedLanguage[];
  location: NormalizedLocation;
  years_experience: number | null;
  career_progression: CareerProgression;
  work_history: NormalizedRole[];
  summary: string | null;             // 1–3 sentence professional summary
}

// ---- Job ---------------------------------------------------------------
export interface StructuredJobDescription {
  schema_version: number;
  title: string | null;
  normalized_title: string | null;
  seniority: SeniorityLevel | null;
  employment_type: EmploymentType | null;
  industry: string | null;
  industries_acceptable: string[];    // adjacent / transferable industries
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
// OpenAI tool schemas (function-calling JSON Schema) — keep aligned with the
// TypeScript types above. We use tool calling instead of asking the model to
// "return JSON" so we get strict, validated structure.
// =========================================================================

const seniorityEnum = [
  "intern", "junior", "mid", "senior", "lead", "principal",
  "manager", "director", "vp", "c_level",
];

const employmentTypeEnum = [
  "full_time", "part_time", "contract", "temporary", "internship", "freelance",
];

const skillItem = {
  type: "object",
  properties: {
    name: { type: "string" },
    category: { type: ["string", "null"] },
    level: { type: ["string", "null"], enum: ["basic", "working", "proficient", "expert", null] },
    years: { type: ["number", "null"] },
  },
  required: ["name"],
  additionalProperties: false,
} as const;

const certItem = {
  type: "object",
  properties: {
    name: { type: "string" },
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
    seniority: { type: ["string", "null"], enum: [...seniorityEnum, null] },
    company: { type: ["string", "null"] },
    industry: { type: ["string", "null"] },
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
    description: "Emit a normalized, explainable candidate profile suitable for semantic matching and dimension-by-dimension scoring.",
    parameters: {
      type: "object",
      properties: {
        full_name: { type: ["string", "null"] },
        current_title: { type: ["string", "null"] },
        current_company: { type: ["string", "null"] },
        seniority: { type: ["string", "null"], enum: [...seniorityEnum, null] },
        industries: { type: "array", items: { type: "string" } },
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
    description: "Emit a normalized, explainable job description suitable for semantic matching and dimension-by-dimension scoring.",
    parameters: {
      type: "object",
      properties: {
        title: { type: ["string", "null"] },
        normalized_title: { type: ["string", "null"] },
        seniority: { type: ["string", "null"], enum: [...seniorityEnum, null] },
        employment_type: { type: ["string", "null"], enum: [...employmentTypeEnum, null] },
        industry: { type: ["string", "null"] },
        industries_acceptable: { type: "array", items: { type: "string" } },
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

export const CANDIDATE_STRUCTURED_SYSTEM = `You are a senior talent intelligence analyst. Convert a CV / LinkedIn profile into a normalized, explainable candidate profile.

Rules:
- Use canonical industry and domain names (e.g. "Financial Services", "SaaS", "Healthcare", "Payments", "Talent Acquisition").
- Map raw titles to normalized titles (e.g. "Sr. SWE II" → "Senior Software Engineer") and assign a seniority level from the enum.
- Calculate total years of experience from work history; never invent dates.
- Detect trajectory (ascending / lateral / mixed / descending / early_career) from title and seniority changes.
- Capture every skill, certification, language and educational qualification you can defend from the source.
- If information is missing, return null or an empty array. Never hallucinate.
- Return your answer ONLY by calling the tool emit_structured_candidate_profile.`;

export const JOB_STRUCTURED_SYSTEM = `You are a senior executive search analyst. Convert a job description into a normalized, explainable job specification.

Rules:
- Separate mandatory vs preferred skills strictly — if it's framed as "must have", "required", "essential" → mandatory; otherwise preferred.
- Use canonical industry and domain names matching the candidate vocabulary (e.g. "Financial Services", "Payments", "Talent Acquisition").
- Map the role title to a normalized_title and assign a seniority from the enum.
- Extract years-of-experience as a numeric range when stated; if only a minimum is given, set years_experience_max to null.
- Identify deal_breakers explicitly (e.g. "must have active Series 7", "must be eligible to work in UK without sponsorship").
- Capture leadership / people-management expectations into career_progression_expected.
- If information is missing, return null or an empty array. Never invent requirements.
- Return your answer ONLY by calling the tool emit_structured_job_description.`;
