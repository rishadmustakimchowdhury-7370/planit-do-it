// Internal AI Validation QA Harness (Super Admin only).
// Runs synthetic JD + CV pairs across industries against the SAME validation
// engine the live UI uses, then scores: stability, false-positive rate,
// recommendation inflation, mandatory coverage, functional ownership.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { VALIDATION_SYSTEM_PROMPT } from "../_shared/validation-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Band = "highly_recommended" | "recommended" | "moderate_fit" | "limited_alignment" | "not_suitable";
const BAND_ORDER: Band[] = ["not_suitable", "limited_alignment", "moderate_fit", "recommended", "highly_recommended"];
// Map new Executive Search OS bands → legacy band slots used by scenario expectations.
const BAND_ALIAS: Record<string, Band> = {
  strong_match: "highly_recommended",
  highly_recommended: "highly_recommended",
  recommended: "recommended",
  transferable_match: "moderate_fit",
  needs_validation: "moderate_fit",
  moderate_fit: "moderate_fit",
  weak_match: "limited_alignment",
  limited_alignment: "limited_alignment",
  reject: "not_suitable",
  not_suitable: "not_suitable",
};
const bandIdx = (b: string) => {
  const normalized = BAND_ALIAS[String(b).toLowerCase()] ?? (b as Band);
  return Math.max(0, BAND_ORDER.indexOf(normalized));
};

type Scenario = {
  id: string;
  industry: string;
  label: string;            // e.g. "Backend → Full Stack (adjacent, missing FE ownership)"
  scenario_type: "direct_fit" | "adjacent" | "weak" | "unrelated";
  expected_min: Band;       // inclusive
  expected_max: Band;       // inclusive
  jd: { title: string; description: string; requirements: string };
  candidate: { full_name: string; current_title: string; current_company: string; experience_years: number; skills: string[]; summary: string; cv: string };
};

const SCENARIOS: Scenario[] = [
  // ───────────── TECH ─────────────
  {
    id: "tech-backend-to-fullstack-adjacent",
    industry: "Tech",
    label: "Backend → Full Stack (adjacent, missing FE ownership)",
    scenario_type: "adjacent",
    expected_min: "limited_alignment",
    expected_max: "moderate_fit",
    jd: {
      title: "Senior Full Stack Engineer",
      description: "We need a senior full stack engineer who has shipped production React/Next.js front-ends AND owned Node/TypeScript backends end-to-end. You will lead UI architecture, design systems, accessibility, and backend APIs.",
      requirements: "5+ yrs production React/Next.js; design system ownership; SSR; Node/TypeScript APIs; PostgreSQL; CI/CD; AWS",
    },
    candidate: {
      full_name: "QA-001 Backend Eng",
      current_title: "Senior Backend Engineer",
      current_company: "ScaleCo",
      experience_years: 7,
      skills: ["Node.js", "TypeScript", "PostgreSQL", "Kafka", "AWS", "Docker", "Kubernetes", "React (basic)"],
      summary: "Backend specialist focused on distributed services and event-driven APIs.",
      cv: "7 years building Node/TypeScript backends, REST + gRPC. Owned Kafka pipelines processing 50k msg/s. Led migration to PostgreSQL partitioning. Touched React in internal tools (no design system or production SPA ownership). No SSR or Next.js experience.",
    },
  },
  {
    id: "tech-frontend-to-fullstack-direct",
    industry: "Tech",
    label: "Frontend + Node → Full Stack (direct fit)",
    scenario_type: "direct_fit",
    expected_min: "recommended",
    expected_max: "highly_recommended",
    jd: {
      title: "Senior Full Stack Engineer",
      description: "React/Next.js front-ends and Node/TypeScript backends end-to-end.",
      requirements: "5+ yrs React/Next.js; SSR; Node/TS; PostgreSQL; AWS",
    },
    candidate: {
      full_name: "QA-002 Fullstack Eng",
      current_title: "Senior Full Stack Engineer",
      current_company: "FintechCo",
      experience_years: 6,
      skills: ["React", "Next.js", "TypeScript", "Node.js", "PostgreSQL", "AWS", "SSR", "Design Systems"],
      summary: "Owned a Next.js + Node platform serving 2M MAU.",
      cv: "Led Next.js migration (SSR/ISR). Built and owns the company design system in React + Storybook. Owns Node/TS backend services on AWS, PostgreSQL. 6 yrs production fullstack delivery.",
    },
  },
  {
    id: "tech-devops-to-backend-weak",
    industry: "Tech",
    label: "DevOps → Backend Engineer (weak: no production code ownership)",
    scenario_type: "weak",
    expected_min: "limited_alignment",
    expected_max: "moderate_fit",
    jd: {
      title: "Senior Backend Engineer (Go)",
      description: "Senior backend engineer to own Go services in production, design APIs, and lead service decomposition.",
      requirements: "5+ yrs Go; gRPC; PostgreSQL; production service ownership; system design",
    },
    candidate: {
      full_name: "QA-003 DevOps",
      current_title: "Senior DevOps Engineer",
      current_company: "Platform Inc",
      experience_years: 8,
      skills: ["Terraform", "Kubernetes", "AWS", "CI/CD", "Bash", "Some Go (scripts)"],
      summary: "Infra/SRE engineer.",
      cv: "Owns IaC, k8s clusters, observability. Wrote some Go internal tooling but never owned production Go services or APIs. No system design ownership of customer-facing backends.",
    },
  },
  {
    id: "tech-qa-to-sdet-direct",
    industry: "Tech",
    label: "QA Automation → SDET (direct fit)",
    scenario_type: "direct_fit",
    expected_min: "recommended",
    expected_max: "highly_recommended",
    jd: {
      title: "SDET",
      description: "Build test frameworks in TypeScript/Playwright, own CI gating, partner with engineers.",
      requirements: "Playwright/Cypress; TypeScript; CI integration; test architecture; flaky-test triage",
    },
    candidate: {
      full_name: "QA-004 SDET",
      current_title: "Lead QA Automation Engineer",
      current_company: "SaaSCo",
      experience_years: 6,
      skills: ["Playwright", "TypeScript", "GitHub Actions", "Test Architecture", "Cypress"],
      summary: "Built and owns a Playwright framework adopted across 4 product teams.",
      cv: "Designed Playwright + TS framework, integrated CI gating, reduced flake rate 60%. Mentors devs on testability.",
    },
  },
  {
    id: "tech-cyber-to-devops-adjacent",
    industry: "Tech",
    label: "Cybersecurity Analyst → DevOps Engineer (adjacent, missing IaC ownership)",
    scenario_type: "adjacent",
    expected_min: "limited_alignment",
    expected_max: "moderate_fit",
    jd: {
      title: "DevOps Engineer",
      description: "Own Terraform-managed AWS infra, CI/CD, k8s operations.",
      requirements: "3+ yrs Terraform on AWS; production k8s; CI/CD ownership; observability",
    },
    candidate: {
      full_name: "QA-005 SecAnalyst",
      current_title: "Cybersecurity Analyst (SOC L2)",
      current_company: "BankSec",
      experience_years: 4,
      skills: ["SIEM", "Splunk", "Incident Response", "AWS (read access)", "Some Terraform (internal lab)"],
      summary: "SOC analyst, monitoring and response focus.",
      cv: "4 yrs SOC monitoring, triage, IR. AWS exposure is read-only via SecurityHub. Tried Terraform in a lab. No production IaC or k8s ownership.",
    },
  },

  // ───────────── COMMODITIES / TRADING ─────────────
  {
    id: "comm-tradeops-to-compliance-falsepositive",
    industry: "Commodities",
    label: "Trade Ops → Commodities Compliance Analyst (false-positive trap)",
    scenario_type: "adjacent",
    expected_min: "limited_alignment",
    expected_max: "moderate_fit",
    jd: {
      title: "Commodities Compliance Analyst",
      description: "Direct experience in commodities compliance: AML/CTF, sanctions & embargoes screening, KYC on counterparties, market conduct/market abuse surveillance, trade documentation review.",
      requirements: "Direct commodities compliance experience; AML/CTF; sanctions/embargoes; KYC; market conduct; trade documentation; physical/derivatives commodities",
    },
    candidate: {
      full_name: "QA-006 Trade Ops",
      current_title: "Senior Trade Operations Analyst",
      current_company: "GlobalTrader",
      experience_years: 6,
      skills: ["Trade settlement", "Confirmations", "CTRM", "Physical commodities ops", "Counterparty onboarding (ops side)"],
      summary: "Middle/back office trade ops.",
      cv: "Owns confirmations, settlements, demurrage, post-trade lifecycle in CTRM. Interfaces with compliance for sanctions checks but does NOT own AML/CTF, sanctions screening, KYC reviews or market conduct surveillance.",
    },
  },
  {
    id: "comm-shipping-to-trader-weak",
    industry: "Commodities",
    label: "Shipping/Chartering → Commodities Trader (weak: no P&L ownership)",
    scenario_type: "weak",
    expected_min: "not_suitable",
    expected_max: "limited_alignment",
    jd: {
      title: "Crude Oil Trader",
      description: "Run a crude book, take principal positions, manage P&L, hedge with derivatives.",
      requirements: "Trading book ownership; P&L responsibility; derivatives hedging; physical crude flows; counterparty relationships",
    },
    candidate: {
      full_name: "QA-007 Charterer",
      current_title: "Chartering Manager",
      current_company: "ShipCo",
      experience_years: 9,
      skills: ["Voyage chartering", "Demurrage", "Freight markets", "Crude flows knowledge"],
      summary: "Chartering specialist.",
      cv: "9 yrs chartering tankers, negotiating freight. No trading book, no P&L ownership, no derivatives hedging.",
    },
  },
  {
    id: "comm-risk-to-quant-falsepositive",
    industry: "Commodities",
    label: "Market Risk Analyst → Quant Trader (false-positive trap)",
    scenario_type: "adjacent",
    expected_min: "limited_alignment",
    expected_max: "moderate_fit",
    jd: {
      title: "Quant Trader (Commodities)",
      description: "Build and trade systematic strategies, own Python research stack, own live P&L.",
      requirements: "Systematic strategy R&D; Python; live trading P&L ownership; alpha research; execution algorithms",
    },
    candidate: {
      full_name: "QA-008 Risk",
      current_title: "Senior Market Risk Analyst",
      current_company: "Trading House",
      experience_years: 7,
      skills: ["VaR", "Stress testing", "Python (risk models)", "Greek exposure"],
      summary: "Risk function.",
      cv: "Owns VaR models, stress tests, P&L explain. Python for risk. Does NOT own trading P&L, alpha research, or execution.",
    },
  },

  // ───────────── BANKING / FINANCE ─────────────
  {
    id: "fin-accountant-to-treasury-adjacent",
    industry: "Banking",
    label: "Accountant → Treasury Analyst (adjacent)",
    scenario_type: "adjacent",
    expected_min: "limited_alignment",
    expected_max: "moderate_fit",
    jd: {
      title: "Treasury Analyst",
      description: "Cash & liquidity management, FX hedging, intraday funding, treasury management systems.",
      requirements: "Liquidity management; FX hedging; cash flow forecasting; TMS (Kyriba/SAP TRM); banking relationships",
    },
    candidate: {
      full_name: "QA-009 Accountant",
      current_title: "Senior Accountant",
      current_company: "Corp",
      experience_years: 6,
      skills: ["IFRS", "Month-end close", "Reconciliations", "Excel"],
      summary: "Financial accountant.",
      cv: "Owns close and IFRS reporting. Reads treasury reports but does NOT manage liquidity, FX hedging or TMS.",
    },
  },
  {
    id: "fin-audit-to-risk-falsepositive",
    industry: "Banking",
    label: "Internal Audit → Credit Risk Manager (false-positive trap)",
    scenario_type: "adjacent",
    expected_min: "limited_alignment",
    expected_max: "moderate_fit",
    jd: {
      title: "Credit Risk Manager",
      description: "Own credit risk frameworks, PD/LGD/EAD models, IFRS9, portfolio-level risk decisions.",
      requirements: "Credit risk model ownership; PD/LGD/EAD; IFRS9; Basel; portfolio decisioning",
    },
    candidate: {
      full_name: "QA-010 Auditor",
      current_title: "Senior Internal Auditor (Credit Risk Audits)",
      current_company: "Big Bank",
      experience_years: 7,
      skills: ["Audit methodology", "IFRS9 (audit review)", "Basel (audit review)", "Sampling"],
      summary: "Audits the credit risk function.",
      cv: "Reviews PD/LGD models from a controls perspective. Does NOT build or own the models or portfolio decisions.",
    },
  },

  // ───────────── CYBERSECURITY ─────────────
  {
    id: "cyber-soc-to-cloudsec-adjacent",
    industry: "Cybersecurity",
    label: "SOC L2 → Cloud Security Engineer (adjacent)",
    scenario_type: "adjacent",
    expected_min: "limited_alignment",
    expected_max: "moderate_fit",
    jd: {
      title: "Cloud Security Engineer (AWS)",
      description: "Own AWS security posture: IAM, GuardDuty, Security Hub, IaC scanning, CSPM, container security.",
      requirements: "Hands-on AWS security ownership; IAM design; CSPM (Wiz/Prisma); IaC scanning; container security",
    },
    candidate: {
      full_name: "QA-011 SOC",
      current_title: "SOC Analyst L2",
      current_company: "MSSP",
      experience_years: 4,
      skills: ["Splunk", "SIEM", "Incident Response", "AWS (alert investigation only)"],
      summary: "SOC monitoring & IR.",
      cv: "Monitors alerts including AWS-sourced events but does NOT design IAM, CSPM, or container security.",
    },
  },
  {
    id: "cyber-network-to-soc-direct",
    industry: "Cybersecurity",
    label: "Network Engineer → SOC Analyst (direct enough)",
    scenario_type: "direct_fit",
    expected_min: "moderate_fit",
    expected_max: "recommended",
    jd: {
      title: "SOC Analyst L1/L2",
      description: "Triage SIEM alerts, investigate network anomalies, support IR.",
      requirements: "SIEM exposure; network protocols deep; packet analysis; IR support",
    },
    candidate: {
      full_name: "QA-012 NetEng",
      current_title: "Senior Network Engineer (Security Ops)",
      current_company: "Telco",
      experience_years: 6,
      skills: ["Wireshark", "IDS/IPS", "SIEM (QRadar)", "Firewall ops", "Some IR shadowing"],
      summary: "Network engineer with strong security ops exposure.",
      cv: "6 yrs network with hands-on IDS/IPS tuning, packet analysis, QRadar correlation rules, rotates into IR.",
    },
  },

  // ───────────── OIL & GAS ─────────────
  {
    id: "og-onshore-to-offshore-weak",
    industry: "Oil & Gas",
    label: "Onshore Field Engineer → Offshore Drilling Supervisor (regulated mandatory missing)",
    scenario_type: "weak",
    expected_min: "not_suitable",
    expected_max: "limited_alignment",
    jd: {
      title: "Offshore Drilling Supervisor",
      description: "Offshore drilling supervision with required IWCF/IADC certifications and offshore HSE.",
      requirements: "IWCF/IADC well control certs; offshore drilling experience; HUET; offshore HSE",
    },
    candidate: {
      full_name: "QA-013 Onshore",
      current_title: "Onshore Field Engineer",
      current_company: "OnshoreOps",
      experience_years: 8,
      skills: ["Onshore drilling", "Rig operations", "HSE (onshore)"],
      summary: "Onshore only.",
      cv: "No offshore exposure, no IWCF/IADC, no HUET.",
    },
  },

  // ───────────── AVIATION ─────────────
  {
    id: "av-camo-to-techservices-direct",
    industry: "Aviation",
    label: "CAMO Engineer → Technical Services Engineer (direct fit)",
    scenario_type: "direct_fit",
    expected_min: "recommended",
    expected_max: "highly_recommended",
    jd: {
      title: "Aviation Technical Services Engineer",
      description: "Reliability monitoring, AD/SB evaluation, technical records, EASA Part-M / Part-CAMO familiarity.",
      requirements: "EASA Part-M / Part-CAMO; AD/SB evaluation; reliability; technical records",
    },
    candidate: {
      full_name: "QA-014 CAMO",
      current_title: "CAMO Engineer",
      current_company: "AirlineCo",
      experience_years: 7,
      skills: ["EASA Part-M", "Part-CAMO", "AD/SB review", "AMOS", "Reliability"],
      summary: "Owns CAMO functions.",
      cv: "Direct ownership of AD/SB evaluation, reliability program, technical records under EASA Part-M / Part-CAMO.",
    },
  },
  {
    id: "av-planning-to-flightops-falsepositive",
    industry: "Aviation",
    label: "Maintenance Planning → Flight Operations Officer (false-positive trap)",
    scenario_type: "weak",
    expected_min: "not_suitable",
    expected_max: "limited_alignment",
    jd: {
      title: "Flight Operations Officer / Dispatcher",
      description: "Dispatch licence required, flight planning, weight & balance, weather, NOTAMs, crew scheduling coordination.",
      requirements: "FAA/EASA dispatcher licence; flight planning; W&B; weather/NOTAM; ops control room experience",
    },
    candidate: {
      full_name: "QA-015 MxPlanning",
      current_title: "Maintenance Planning Engineer",
      current_company: "MRO Co",
      experience_years: 5,
      skills: ["Maintenance planning", "AMOS", "Shop visits", "Hangar slotting"],
      summary: "MRO planning.",
      cv: "Plans maintenance slots and shop visits. No dispatcher licence, no flight planning, no ops control room exposure.",
    },
  },

  // ───────────── UNRELATED CONTROL ─────────────
  {
    id: "control-unrelated-retail-to-quant",
    industry: "Control",
    label: "Retail Store Manager → Quant Trader (unrelated control)",
    scenario_type: "unrelated",
    expected_min: "not_suitable",
    expected_max: "not_suitable",
    jd: {
      title: "Quant Trader",
      description: "Systematic alpha research, Python, live P&L.",
      requirements: "Quant research; Python; live trading P&L; statistics",
    },
    candidate: {
      full_name: "QA-016 RetailMgr",
      current_title: "Retail Store Manager",
      current_company: "RetailCo",
      experience_years: 10,
      skills: ["Staff management", "Inventory", "POS systems"],
      summary: "Retail operations.",
      cv: "10 yrs retail store management. No quant, no Python, no trading.",
    },
  },
];

async function runValidation(scenario: Scenario, apiKey: string) {
  const userPrompt = `JOB DESCRIPTION
Title: ${scenario.jd.title}
Description:
${scenario.jd.description}
Requirements:
${scenario.jd.requirements}

CANDIDATE
Name: ${scenario.candidate.full_name}
Current Role: ${scenario.candidate.current_title} @ ${scenario.candidate.current_company}
Experience: ${scenario.candidate.experience_years} years
Skills: ${scenario.candidate.skills.join(", ")}
Summary: ${scenario.candidate.summary}
CV:
${scenario.candidate.cv}

RECRUITER NOTES: (none provided)

Now produce the JSON assessment per the system spec.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: VALIDATION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  try { return JSON.parse(j.choices?.[0]?.message?.content ?? "{}"); }
  catch { return {}; }
}

function normaliseBand(b: string): Band {
  const k = String(b ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (k === "strong_match" || k === "strongly_recommended") return "highly_recommended";
  if (k === "not_recommended") return "not_suitable";
  if (BAND_ORDER.includes(k as Band)) return k as Band;
  return "moderate_fit";
}

function scoreScenario(scenario: Scenario, result: any) {
  const rec = normaliseBand(result?.recommendation);
  const expectedMin = bandIdx(scenario.expected_min);
  const expectedMax = bandIdx(scenario.expected_max);
  const got = bandIdx(rec);
  const within = got >= expectedMin && got <= expectedMax;
  const inflation = got > expectedMax ? got - expectedMax : 0;
  const deflation = got < expectedMin ? expectedMin - got : 0;

  const mm: any[] = Array.isArray(result?.mandate_match) ? result.mandate_match : [];
  const mandatoryRows = mm.filter((r) => String(r?.kind ?? "mandatory").toLowerCase() === "mandatory");
  const mandatoryCount = mandatoryRows.length || 1;
  const mandatoryMissing = mandatoryRows.filter((r) => ["WEAK", "NOT MATCHED"].includes(String(r?.fit ?? "").toUpperCase())).length;
  const mandatoryCoverage = 1 - (mandatoryMissing / mandatoryCount);

  // Evidence quality: ratio of rows with substantive evidence sentences
  const subst = mm.filter((r) => {
    const e = String(r?.evidence ?? "").trim();
    return e && !/no clear evidence/i.test(e) && e.split(/\s+/).length >= 8;
  }).length;
  const evidenceQuality = mm.length ? subst / mm.length : 0;

  // Functional ownership: presence of ownership verbs in evidence on mandatory rows
  const OWNERSHIP_RE = /\b(owned|led|architected|designed|delivered|implemented|built|shipped|managed|operated|executed|deployed|scaled|migrated)\b/i;
  const ownershipHits = mandatoryRows.filter((r) => OWNERSHIP_RE.test(String(r?.evidence ?? ""))).length;
  const functionalOwnership = mandatoryRows.length ? ownershipHits / mandatoryRows.length : 0;

  // Risk of false positive: scenario type adjacent/weak/unrelated AND recommendation ≥ recommended
  const recommendedOrAbove = got >= bandIdx("recommended");
  const isFalsePositive = (scenario.scenario_type !== "direct_fit") && recommendedOrAbove;

  // Industry alignment: AI's detected industry vs scenario industry (loose)
  const detected = String(result?.jd_classification?.industry_domain ?? "").toLowerCase();
  const expectedIndustry = scenario.industry.toLowerCase();
  const industryAlignment = detected && (
    detected.includes(expectedIndustry.split(/\s|&|\//)[0]) ||
    expectedIndustry.includes(detected.split("_")[0])
  ) ? 1 : 0.5;

  // Transferability discipline: in adjacent/weak scenarios, missing_requirements should be populated
  const missing = Array.isArray(result?.missing_requirements) ? result.missing_requirements.length : 0;
  const transferabilityDiscipline = (scenario.scenario_type === "direct_fit")
    ? 1
    : (missing >= 1 ? 1 : 0);

  // Anti-inflation: penalise inflation heavily
  const antiInflation = inflation === 0 ? 1 : Math.max(0, 1 - inflation * 0.5);

  return {
    recommendation: rec,
    within,
    inflation,
    deflation,
    isFalsePositive,
    qa: {
      evidenceQuality: +evidenceQuality.toFixed(2),
      functionalOwnership: +functionalOwnership.toFixed(2),
      mandatoryCoverage: +mandatoryCoverage.toFixed(2),
      transferabilityDiscipline: +transferabilityDiscipline.toFixed(2),
      industryAlignment: +industryAlignment.toFixed(2),
      antiInflation: +antiInflation.toFixed(2),
    },
    summary: String(result?.summary ?? "").slice(0, 400),
    industryDetected: detected || null,
    mandatoryCount,
    mandatoryMissing,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Super admin only
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (!isSuper) {
      return new Response(JSON.stringify({ error: "Super admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const requestedIds: string[] = Array.isArray(body?.scenario_ids) ? body.scenario_ids : [];
    const stabilityRuns: number = Math.max(1, Math.min(3, Number(body?.stability_runs ?? 2)));
    const scenarios = requestedIds.length
      ? SCENARIOS.filter((s) => requestedIds.includes(s.id))
      : SCENARIOS;

    const results: any[] = [];
    for (const sc of scenarios) {
      const runs: any[] = [];
      for (let i = 0; i < stabilityRuns; i++) {
        try {
          const raw = await runValidation(sc, apiKey);
          runs.push(scoreScenario(sc, raw));
        } catch (e: any) {
          runs.push({ error: e?.message ?? String(e) });
        }
      }
      // Stability: same recommendation across runs?
      const recs = runs.filter((r) => r.recommendation).map((r) => r.recommendation);
      const stable = recs.length >= 2 ? recs.every((r) => r === recs[0]) : true;
      const primary = runs[0] ?? {};
      results.push({
        id: sc.id,
        industry: sc.industry,
        label: sc.label,
        scenario_type: sc.scenario_type,
        expected: `${sc.expected_min} → ${sc.expected_max}`,
        ...primary,
        stable,
        runs,
      });
    }

    const total = results.length;
    const correct = results.filter((r) => r.within).length;
    const inflated = results.filter((r) => (r.inflation ?? 0) > 0).length;
    const deflated = results.filter((r) => (r.deflation ?? 0) > 0).length;
    const falsePositives = results.filter((r) => r.isFalsePositive).length;
    const unstable = results.filter((r) => r.stable === false).length;
    const avg = (key: string) => {
      const xs = results.map((r) => r?.qa?.[key]).filter((x) => typeof x === "number");
      return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : 0;
    };
    const summary = {
      total,
      correct,
      accuracy: total ? +(correct / total).toFixed(2) : 0,
      inflated,
      deflated,
      falsePositives,
      unstable,
      stabilityRuns,
      avgEvidenceQuality: avg("evidenceQuality"),
      avgFunctionalOwnership: avg("functionalOwnership"),
      avgMandatoryCoverage: avg("mandatoryCoverage"),
      avgTransferabilityDiscipline: avg("transferabilityDiscipline"),
      avgIndustryAlignment: avg("industryAlignment"),
      avgAntiInflation: avg("antiInflation"),
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ai-qa-runner error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "QA runner failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export const _scenarios = SCENARIOS;
