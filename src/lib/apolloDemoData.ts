// Demo Apollo prospect data for testing CRM workflows without a paid Apollo plan.
export interface DemoCompany {
  id: string;
  name: string;
  website_url: string;
  linkedin_url: string;
  industry: string;
  estimated_num_employees: number;
  city: string;
  state: string | null;
  country: string;
  short_description: string;
  revenue_range: string;
  isDemo: true;
}

const SAMPLE: Omit<DemoCompany, 'id' | 'isDemo'>[] = [
  { name: 'Acme Talent Partners', website_url: 'https://acmetalent.example.com', linkedin_url: 'https://www.linkedin.com/company/acme-talent-partners', industry: 'Staffing & Recruiting', estimated_num_employees: 45, city: 'London', state: null, country: 'United Kingdom', short_description: 'Tech recruitment agency placing engineers across the UK.', revenue_range: '$5M-$10M' },
  { name: 'Northwind Search', website_url: 'https://northwindsearch.example.com', linkedin_url: 'https://www.linkedin.com/company/northwind-search', industry: 'Executive Search', estimated_num_employees: 12, city: 'Manchester', state: null, country: 'United Kingdom', short_description: 'Boutique executive search for fintech.', revenue_range: '$1M-$5M' },
  { name: 'Pinecrest Staffing', website_url: 'https://pinecreststaffing.example.com', linkedin_url: 'https://www.linkedin.com/company/pinecrest-staffing', industry: 'Staffing & Recruiting', estimated_num_employees: 88, city: 'Austin', state: 'TX', country: 'United States', short_description: 'Healthcare staffing across the US Southwest.', revenue_range: '$10M-$25M' },
  { name: 'BlueOrbit Recruiters', website_url: 'https://blueorbit.example.com', linkedin_url: 'https://www.linkedin.com/company/blueorbit-recruiters', industry: 'Human Resources', estimated_num_employees: 27, city: 'Berlin', state: null, country: 'Germany', short_description: 'SaaS go-to-market hiring partner.', revenue_range: '$5M-$10M' },
  { name: 'Summit Hire Group', website_url: 'https://summithire.example.com', linkedin_url: 'https://www.linkedin.com/company/summit-hire-group', industry: 'Staffing & Recruiting', estimated_num_employees: 150, city: 'Toronto', state: 'ON', country: 'Canada', short_description: 'Enterprise IT staffing across North America.', revenue_range: '$25M-$50M' },
  { name: 'Vertex People', website_url: 'https://vertexpeople.example.com', linkedin_url: 'https://www.linkedin.com/company/vertex-people', industry: 'Executive Search', estimated_num_employees: 18, city: 'Singapore', state: null, country: 'Singapore', short_description: 'C-suite search for APAC technology firms.', revenue_range: '$1M-$5M' },
  { name: 'Harbor Lane Recruitment', website_url: 'https://harborlane.example.com', linkedin_url: 'https://www.linkedin.com/company/harbor-lane-recruitment', industry: 'Staffing & Recruiting', estimated_num_employees: 60, city: 'Dublin', state: null, country: 'Ireland', short_description: 'Finance and accounting recruitment.', revenue_range: '$5M-$10M' },
  { name: 'Cobalt Talent Co.', website_url: 'https://cobalttalent.example.com', linkedin_url: 'https://www.linkedin.com/company/cobalt-talent', industry: 'Human Resources', estimated_num_employees: 33, city: 'Amsterdam', state: null, country: 'Netherlands', short_description: 'Product and design recruitment for scale-ups.', revenue_range: '$1M-$5M' },
  { name: 'Ironbridge Search', website_url: 'https://ironbridgesearch.example.com', linkedin_url: 'https://www.linkedin.com/company/ironbridge-search', industry: 'Executive Search', estimated_num_employees: 22, city: 'New York', state: 'NY', country: 'United States', short_description: 'Private equity portfolio leadership search.', revenue_range: '$5M-$10M' },
  { name: 'Maple & Co. Recruiters', website_url: 'https://mapleco.example.com', linkedin_url: 'https://www.linkedin.com/company/maple-and-co-recruiters', industry: 'Staffing & Recruiting', estimated_num_employees: 75, city: 'Vancouver', state: 'BC', country: 'Canada', short_description: 'Engineering and product talent across Canada.', revenue_range: '$10M-$25M' },
  { name: 'Lighthouse Talent', website_url: 'https://lighthousetalent.example.com', linkedin_url: 'https://www.linkedin.com/company/lighthouse-talent', industry: 'Human Resources', estimated_num_employees: 14, city: 'Edinburgh', state: null, country: 'United Kingdom', short_description: 'Marketing and creative recruitment.', revenue_range: '$1M-$5M' },
  { name: 'Granite State Hiring', website_url: 'https://granitestate.example.com', linkedin_url: 'https://www.linkedin.com/company/granite-state-hiring', industry: 'Staffing & Recruiting', estimated_num_employees: 50, city: 'Boston', state: 'MA', country: 'United States', short_description: 'Biotech and life-sciences recruitment.', revenue_range: '$5M-$10M' },
  { name: 'Atlas Recruit Partners', website_url: 'https://atlasrecruit.example.com', linkedin_url: 'https://www.linkedin.com/company/atlas-recruit-partners', industry: 'Executive Search', estimated_num_employees: 9, city: 'Sydney', state: 'NSW', country: 'Australia', short_description: 'Energy sector executive search.', revenue_range: '$1M-$5M' },
  { name: 'Riverstone Talent', website_url: 'https://riverstonetalent.example.com', linkedin_url: 'https://www.linkedin.com/company/riverstone-talent', industry: 'Staffing & Recruiting', estimated_num_employees: 120, city: 'Chicago', state: 'IL', country: 'United States', short_description: 'Industrial and manufacturing staffing.', revenue_range: '$25M-$50M' },
  { name: 'Skyline People Group', website_url: 'https://skylinepeople.example.com', linkedin_url: 'https://www.linkedin.com/company/skyline-people-group', industry: 'Human Resources', estimated_num_employees: 41, city: 'Dubai', state: null, country: 'United Arab Emirates', short_description: 'Hospitality and retail recruitment in the Middle East.', revenue_range: '$5M-$10M' },
  { name: 'Forge & Field Hiring', website_url: 'https://forgeandfield.example.com', linkedin_url: 'https://www.linkedin.com/company/forge-and-field-hiring', industry: 'Staffing & Recruiting', estimated_num_employees: 28, city: 'Birmingham', state: null, country: 'United Kingdom', short_description: 'Construction and trades recruitment.', revenue_range: '$1M-$5M' },
  { name: 'Aurora Search Co.', website_url: 'https://aurorasearch.example.com', linkedin_url: 'https://www.linkedin.com/company/aurora-search-co', industry: 'Executive Search', estimated_num_employees: 16, city: 'Stockholm', state: null, country: 'Sweden', short_description: 'Nordic technology leadership search.', revenue_range: '$1M-$5M' },
  { name: 'Crescent Talent Studio', website_url: 'https://crescenttalent.example.com', linkedin_url: 'https://www.linkedin.com/company/crescent-talent-studio', industry: 'Human Resources', estimated_num_employees: 23, city: 'Paris', state: null, country: 'France', short_description: 'Luxury and fashion recruitment.', revenue_range: '$1M-$5M' },
  { name: 'Beacon Hire Network', website_url: 'https://beaconhire.example.com', linkedin_url: 'https://www.linkedin.com/company/beacon-hire-network', industry: 'Staffing & Recruiting', estimated_num_employees: 200, city: 'Denver', state: 'CO', country: 'United States', short_description: 'Multi-vertical staffing across North America.', revenue_range: '$25M-$50M' },
  { name: 'Pioneer Talent Lab', website_url: 'https://pioneertalent.example.com', linkedin_url: 'https://www.linkedin.com/company/pioneer-talent-lab', industry: 'Executive Search', estimated_num_employees: 11, city: 'Tel Aviv', state: null, country: 'Israel', short_description: 'Cybersecurity and AI startup leadership search.', revenue_range: '$1M-$5M' },
];

export function generateDemoCompanies(): DemoCompany[] {
  return SAMPLE.map((c, i) => ({ ...c, id: `demo-${i + 1}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, isDemo: true }));
}
