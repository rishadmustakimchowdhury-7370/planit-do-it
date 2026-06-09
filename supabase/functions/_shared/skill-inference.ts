// Skill inference / normalization.
// Maps skills, technologies and role labels to the parent/implied skills they
// reasonably imply. Used by the validator so that a "React Developer" is not
// marked as missing JavaScript/HTML/CSS, a "Next.js" engineer is not missing
// React, a "SOC Analyst" is not missing Incident Response, etc.
//
// Rule of thumb (kept conservative on purpose):
//   - Only encode relationships where the parent skill is a near-certain
//     prerequisite or foundational competency of the child.
//   - Never invent rare/optional skills.
//   - Lookup is case-insensitive and alias-aware.

const N = (s: unknown): string =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ").replace(/\s+/g, " ").trim();

// child  =>  list of parent / implied skills
// (children include skills, frameworks, technologies AND role labels)
const IMPLIES: Record<string, string[]> = {
  // ---------- Frontend ecosystem ----------
  "react": ["javascript", "html", "css", "jsx", "frontend development"],
  "react.js": ["javascript", "html", "css", "jsx", "frontend development"],
  "reactjs": ["javascript", "html", "css", "jsx", "frontend development"],
  "react developer": ["react", "javascript", "html", "css", "frontend development", "responsive design"],
  "react native": ["react", "javascript", "mobile development"],
  "next.js": ["react", "javascript", "typescript", "node.js", "ssr", "frontend development"],
  "nextjs": ["react", "javascript", "typescript", "node.js", "ssr", "frontend development"],
  "remix": ["react", "javascript", "typescript", "frontend development"],
  "gatsby": ["react", "javascript", "graphql", "frontend development"],
  "vue": ["javascript", "html", "css", "frontend development"],
  "vue.js": ["javascript", "html", "css", "frontend development"],
  "nuxt": ["vue", "javascript", "frontend development"],
  "nuxt.js": ["vue", "javascript", "frontend development"],
  "angular": ["typescript", "javascript", "html", "css", "rxjs", "frontend development"],
  "svelte": ["javascript", "html", "css", "frontend development"],
  "sveltekit": ["svelte", "javascript", "frontend development"],
  "typescript": ["javascript"],
  "ts": ["javascript"],
  "redux": ["react", "javascript", "state management"],
  "tailwind": ["css", "html", "responsive design"],
  "tailwind css": ["css", "html", "responsive design"],
  "sass": ["css"],
  "scss": ["css"],
  "less": ["css"],
  "frontend development": ["html", "css", "javascript", "responsive design"],
  "front-end development": ["html", "css", "javascript", "responsive design"],
  "frontend developer": ["html", "css", "javascript", "responsive design", "frontend development"],
  "ui developer": ["html", "css", "javascript", "responsive design"],
  "web developer": ["html", "css", "javascript"],

  // ---------- Backend / Node / runtimes ----------
  "node.js": ["javascript", "npm", "backend development"],
  "nodejs": ["javascript", "npm", "backend development"],
  "express": ["node.js", "javascript", "rest apis", "backend development"],
  "nestjs": ["node.js", "typescript", "backend development"],
  "fastify": ["node.js", "javascript", "backend development"],
  "deno": ["typescript", "javascript"],
  "bun": ["javascript", "typescript"],

  // ---------- Python ----------
  "django": ["python", "orm", "rest apis", "backend development"],
  "flask": ["python", "rest apis", "backend development"],
  "fastapi": ["python", "rest apis", "backend development"],
  "pandas": ["python", "data analysis"],
  "numpy": ["python"],
  "pytorch": ["python", "machine learning"],
  "tensorflow": ["python", "machine learning"],
  "scikit-learn": ["python", "machine learning"],
  "sklearn": ["python", "machine learning"],

  // ---------- Java / JVM ----------
  "spring": ["java", "backend development"],
  "spring boot": ["java", "spring", "rest apis", "backend development"],
  "hibernate": ["java", "orm", "sql"],
  "kotlin": ["jvm"],
  "scala": ["jvm"],

  // ---------- .NET ----------
  ".net": ["c#", "backend development"],
  "dotnet": ["c#", "backend development"],
  "asp.net": [".net", "c#", "backend development"],
  "asp.net core": [".net", "c#", "backend development"],
  "entity framework": [".net", "c#", "orm", "sql"],

  // ---------- Mobile ----------
  "ios developer": ["swift", "mobile development"],
  "android developer": ["kotlin", "mobile development"],
  "flutter": ["dart", "mobile development"],
  "xamarin": ["c#", "mobile development"],

  // ---------- Data / DB ----------
  "postgresql": ["sql", "rdbms"],
  "postgres": ["sql", "rdbms"],
  "mysql": ["sql", "rdbms"],
  "mariadb": ["sql", "rdbms"],
  "sql server": ["sql", "rdbms", "t-sql"],
  "oracle db": ["sql", "rdbms", "pl/sql"],
  "snowflake": ["sql", "data warehousing"],
  "bigquery": ["sql", "data warehousing"],
  "redshift": ["sql", "data warehousing"],
  "dbt": ["sql", "data engineering"],
  "airflow": ["python", "data engineering", "orchestration"],
  "spark": ["distributed computing", "data engineering"],
  "kafka": ["event streaming", "distributed systems"],
  "mongodb": ["nosql"],
  "dynamodb": ["nosql", "aws"],
  "elasticsearch": ["search", "nosql"],

  // ---------- Cloud / DevOps ----------
  "aws": ["cloud computing"],
  "amazon web services": ["cloud computing"],
  "gcp": ["cloud computing"],
  "google cloud": ["cloud computing"],
  "google cloud platform": ["cloud computing"],
  "azure": ["cloud computing"],
  "microsoft azure": ["cloud computing"],
  "kubernetes": ["containers", "orchestration", "devops"],
  "k8s": ["containers", "orchestration", "devops"],
  "docker": ["containers", "devops"],
  "terraform": ["infrastructure as code", "devops"],
  "ansible": ["configuration management", "devops"],
  "jenkins": ["ci/cd", "devops"],
  "github actions": ["ci/cd", "devops"],
  "gitlab ci": ["ci/cd", "devops"],
  "circleci": ["ci/cd", "devops"],
  "devops engineer": ["ci/cd", "linux", "cloud computing", "containers"],
  "sre": ["linux", "monitoring", "cloud computing", "incident response"],
  "site reliability engineer": ["linux", "monitoring", "cloud computing", "incident response"],
  "platform engineer": ["cloud computing", "kubernetes", "ci/cd", "devops"],

  // ---------- Security ----------
  "soc analyst": ["security operations", "incident response", "siem", "threat detection", "cybersecurity"],
  "security analyst": ["security operations", "incident response", "cybersecurity"],
  "penetration tester": ["ethical hacking", "vulnerability assessment", "cybersecurity"],
  "pentester": ["ethical hacking", "vulnerability assessment", "cybersecurity"],
  "security engineer": ["application security", "network security", "cybersecurity"],
  "ciso": ["security strategy", "risk management", "compliance", "cybersecurity"],
  "siem": ["security operations", "log analysis"],
  "splunk": ["siem", "log analysis"],
  "qradar": ["siem", "log analysis"],

  // ---------- Compliance / Risk / GRC ----------
  "compliance officer": ["regulatory compliance", "risk management", "audit", "policy"],
  "compliance manager": ["regulatory compliance", "risk management", "audit"],
  "aml analyst": ["regulatory compliance", "financial crime", "kyc"],
  "kyc analyst": ["regulatory compliance", "financial crime", "due diligence"],
  "gdpr": ["data protection", "regulatory compliance"],
  "hipaa": ["healthcare compliance", "regulatory compliance"],
  "sox": ["financial compliance", "regulatory compliance", "audit"],
  "iso 27001": ["information security", "regulatory compliance"],
  "pci dss": ["payment security", "regulatory compliance"],

  // ---------- Data / Analytics roles ----------
  "data scientist": ["python", "statistics", "machine learning", "data analysis"],
  "data analyst": ["sql", "data analysis", "data visualization"],
  "data engineer": ["sql", "python", "etl", "data engineering"],
  "ml engineer": ["python", "machine learning", "model deployment"],
  "machine learning engineer": ["python", "machine learning", "model deployment"],
  "bi developer": ["sql", "data visualization", "etl"],
  "power bi": ["data visualization", "sql"],
  "tableau": ["data visualization", "sql"],
  "looker": ["data visualization", "sql"],

  // ---------- QA ----------
  "qa engineer": ["test automation", "manual testing", "test design"],
  "sdet": ["test automation", "programming", "ci/cd"],
  "selenium": ["test automation", "java", "browser automation"],
  "cypress": ["test automation", "javascript", "browser automation"],
  "playwright": ["test automation", "javascript", "browser automation"],
  "appium": ["test automation", "mobile testing"],

  // ---------- Product / Design / PM ----------
  "product manager": ["product strategy", "stakeholder management", "roadmapping"],
  "product owner": ["agile", "backlog management", "stakeholder management"],
  "scrum master": ["agile", "scrum", "facilitation"],
  "ux designer": ["user research", "wireframing", "prototyping"],
  "ui designer": ["visual design", "figma", "prototyping"],
  "product designer": ["ux design", "ui design", "prototyping", "user research"],
  "figma": ["ui design", "prototyping"],

  // ---------- Sales / Marketing / Ops ----------
  "account executive": ["b2b sales", "pipeline management", "negotiation"],
  "sdr": ["outbound prospecting", "cold outreach", "lead qualification"],
  "bdr": ["outbound prospecting", "cold outreach", "lead qualification"],
  "growth marketer": ["performance marketing", "analytics", "a/b testing"],
  "seo specialist": ["seo", "keyword research", "content strategy"],
  "content marketer": ["content strategy", "copywriting", "seo"],
  "salesforce admin": ["salesforce", "crm administration"],
  "hubspot admin": ["hubspot", "crm administration"],

  // ---------- HR / Recruiting / Finance ----------
  "recruiter": ["sourcing", "candidate screening", "ats"],
  "talent acquisition": ["sourcing", "candidate screening", "employer branding"],
  "hr business partner": ["employee relations", "performance management", "hr policy"],
  "financial analyst": ["financial modeling", "excel", "forecasting"],
  "fp&a": ["financial modeling", "forecasting", "budgeting"],
  "controller": ["accounting", "financial reporting", "gaap"],
  "accountant": ["accounting", "bookkeeping", "gaap"],
};

// Build a normalized alias-aware lookup for the child keys.
const NORMALIZED_IMPLIES: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const [k, v] of Object.entries(IMPLIES)) {
    m.set(N(k), v.map((p) => N(p)));
  }
  return m;
})();

/** Given a single skill / title / tech string, return the implied parent skills (normalized). */
export function impliedSkillsFor(skill: string): string[] {
  const out = new Set<string>();
  const key = N(skill);
  if (!key) return [];
  const direct = NORMALIZED_IMPLIES.get(key);
  if (direct) for (const p of direct) out.add(p);
  // transitive expansion (1 level only — taxonomy is shallow and curated)
  if (direct) {
    for (const p of direct) {
      const next = NORMALIZED_IMPLIES.get(p);
      if (next) for (const q of next) out.add(q);
    }
  }
  return [...out];
}

/**
 * Expand a list of candidate skill names/aliases (and optional role titles)
 * into a full token set that includes all implied parent skills.
 */
export function expandImpliedSkillTokens(inputs: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const raw of inputs) {
    const n = N(raw);
    if (!n) continue;
    out.add(n);
    for (const imp of impliedSkillsFor(n)) out.add(imp);
  }
  return out;
}
