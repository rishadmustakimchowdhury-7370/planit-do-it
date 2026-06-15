// Demo Apollo prospect data for the Prospecting Sandbox.
// Lets sales demo the full BD workflow with no paid Apollo plan.

export type DemoDataset = 'recruitment' | 'technology' | 'commodities' | 'healthcare';

export interface DemoContact {
  first_name: string;
  last_name: string;
  full_name: string;
  title: string;
  email: string;
  phone: string;
  linkedin_url: string;
}

export interface DemoCompany {
  id: string;
  dataset: DemoDataset;
  name: string;
  logo_url: string;
  website_url: string;
  linkedin_url: string;
  industry: string;
  estimated_num_employees: number;
  city: string;
  state: string | null;
  country: string;
  short_description: string;
  revenue_range: string;
  match_score: number;
  contact: DemoContact;
  isDemo: true;
}

type SeedContact = { first_name: string; last_name: string; title: string };
type Seed = Omit<DemoCompany, 'id' | 'isDemo' | 'logo_url' | 'contact' | 'match_score'> & {
  contact: SeedContact;
  match_score?: number;
};

const palette = ['1E40AF', '0F766E', '7C3AED', 'B45309', 'BE123C', '15803D', '0369A1', '9333EA'];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const initials = (s: string) =>
  s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const logoFor = (name: string, i: number) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(initials(name))}&background=${palette[i % palette.length]}&color=fff&bold=true&size=128`;
const domainFrom = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
const emailFor = (first: string, last: string, website: string) =>
  `${first.toLowerCase()}.${last.toLowerCase()}@${domainFrom(website)}`;
const linkedinPersonFor = (first: string, last: string) =>
  `https://www.linkedin.com/in/${slug(first + '-' + last)}`;

const ukPhone = (n: number) => `+44 20 7${(1000 + n).toString().padStart(4, '0')} ${(2000 + n).toString().padStart(4, '0')}`;
const usPhone = (n: number) => `+1 (415) 555-${(1000 + n).toString().padStart(4, '0')}`;
const aePhone = (n: number) => `+971 4 ${(300 + n).toString().padStart(3, '0')} ${(4000 + n).toString().padStart(4, '0')}`;
const sgPhone = (n: number) => `+65 6${(300 + n).toString().padStart(3, '0')} ${(4000 + n).toString().padStart(4, '0')}`;

const RECRUITMENT: Seed[] = [
  { dataset: 'recruitment', name: 'Acme Talent Partners', website_url: 'https://acmetalent.example.com', linkedin_url: 'https://www.linkedin.com/company/acme-talent-partners', industry: 'Staffing & Recruiting', estimated_num_employees: 45, city: 'London', state: null, country: 'United Kingdom', short_description: 'Tech recruitment agency placing engineers across the UK.', revenue_range: '$5M-$10M', contact: { first_name: 'Eleanor', last_name: 'Whitfield', title: 'Managing Director' } },
  { dataset: 'recruitment', name: 'Northwind Search', website_url: 'https://northwindsearch.example.com', linkedin_url: 'https://www.linkedin.com/company/northwind-search', industry: 'Executive Search', estimated_num_employees: 12, city: 'Manchester', state: null, country: 'United Kingdom', short_description: 'Boutique executive search for UK fintech.', revenue_range: '$1M-$5M', contact: { first_name: 'James', last_name: 'Holloway', title: 'Founding Partner' } },
  { dataset: 'recruitment', name: 'Harbor Lane Recruitment', website_url: 'https://harborlane.example.com', linkedin_url: 'https://www.linkedin.com/company/harbor-lane-recruitment', industry: 'Staffing & Recruiting', estimated_num_employees: 60, city: 'Dublin', state: null, country: 'Ireland', short_description: 'Finance and accounting recruitment.', revenue_range: '$5M-$10M', contact: { first_name: 'Aoife', last_name: 'Byrne', title: 'Head of Delivery' } },
  { dataset: 'recruitment', name: 'Lighthouse Talent', website_url: 'https://lighthousetalent.example.com', linkedin_url: 'https://www.linkedin.com/company/lighthouse-talent', industry: 'Human Resources', estimated_num_employees: 14, city: 'Edinburgh', state: null, country: 'United Kingdom', short_description: 'Marketing and creative recruitment.', revenue_range: '$1M-$5M', contact: { first_name: 'Iona', last_name: 'McRae', title: 'Director' } },
  { dataset: 'recruitment', name: 'Forge & Field Hiring', website_url: 'https://forgeandfield.example.com', linkedin_url: 'https://www.linkedin.com/company/forge-and-field-hiring', industry: 'Staffing & Recruiting', estimated_num_employees: 28, city: 'Birmingham', state: null, country: 'United Kingdom', short_description: 'Construction and trades recruitment.', revenue_range: '$1M-$5M', contact: { first_name: 'Daniel', last_name: 'Pritchard', title: 'Operations Director' } },
  { dataset: 'recruitment', name: 'Skyline People Group', website_url: 'https://skylinepeople.example.com', linkedin_url: 'https://www.linkedin.com/company/skyline-people-group', industry: 'Human Resources', estimated_num_employees: 41, city: 'Dubai', state: null, country: 'United Arab Emirates', short_description: 'Hospitality and retail staffing across the Middle East.', revenue_range: '$5M-$10M', contact: { first_name: 'Rania', last_name: 'Haddad', title: 'Managing Partner' } },
  { dataset: 'recruitment', name: 'Gulf Talent Bridge', website_url: 'https://gulftalentbridge.example.com', linkedin_url: 'https://www.linkedin.com/company/gulf-talent-bridge', industry: 'Staffing & Recruiting', estimated_num_employees: 34, city: 'Abu Dhabi', state: null, country: 'United Arab Emirates', short_description: 'Energy and infrastructure staffing for GCC clients.', revenue_range: '$5M-$10M', contact: { first_name: 'Omar', last_name: 'Al-Farsi', title: 'CEO' } },
  { dataset: 'recruitment', name: 'Desert Rose Staffing', website_url: 'https://desertrosestaffing.example.com', linkedin_url: 'https://www.linkedin.com/company/desert-rose-staffing', industry: 'Staffing & Recruiting', estimated_num_employees: 22, city: 'Dubai', state: null, country: 'United Arab Emirates', short_description: 'Healthcare and clinical staffing across UAE.', revenue_range: '$1M-$5M', contact: { first_name: 'Layla', last_name: 'Mansour', title: 'Director of Operations' } },
  { dataset: 'recruitment', name: 'Pinecrest Staffing', website_url: 'https://pinecreststaffing.example.com', linkedin_url: 'https://www.linkedin.com/company/pinecrest-staffing', industry: 'Staffing & Recruiting', estimated_num_employees: 88, city: 'Austin', state: 'TX', country: 'United States', short_description: 'Healthcare staffing across the US Southwest.', revenue_range: '$10M-$25M', contact: { first_name: 'Ryan', last_name: 'Caldwell', title: 'VP Talent' } },
  { dataset: 'recruitment', name: 'Ironbridge Search', website_url: 'https://ironbridgesearch.example.com', linkedin_url: 'https://www.linkedin.com/company/ironbridge-search', industry: 'Executive Search', estimated_num_employees: 22, city: 'New York', state: 'NY', country: 'United States', short_description: 'Private equity portfolio leadership search.', revenue_range: '$5M-$10M', contact: { first_name: 'Margaret', last_name: 'Stein', title: 'Partner' } },
  { dataset: 'recruitment', name: 'BlueOrbit Recruiters', website_url: 'https://blueorbit.example.com', linkedin_url: 'https://www.linkedin.com/company/blueorbit-recruiters', industry: 'Human Resources', estimated_num_employees: 27, city: 'Berlin', state: null, country: 'Germany', short_description: 'SaaS go-to-market hiring partner.', revenue_range: '$5M-$10M', contact: { first_name: 'Stefan', last_name: 'Krause', title: 'Managing Director' } },
  { dataset: 'recruitment', name: 'Summit Hire Group', website_url: 'https://summithire.example.com', linkedin_url: 'https://www.linkedin.com/company/summit-hire-group', industry: 'Staffing & Recruiting', estimated_num_employees: 150, city: 'Toronto', state: 'ON', country: 'Canada', short_description: 'Enterprise IT staffing across North America.', revenue_range: '$25M-$50M', contact: { first_name: 'Priya', last_name: 'Nair', title: 'Head of Client Services' } },
  { dataset: 'recruitment', name: 'Vertex People', website_url: 'https://vertexpeople.example.com', linkedin_url: 'https://www.linkedin.com/company/vertex-people', industry: 'Executive Search', estimated_num_employees: 18, city: 'Singapore', state: null, country: 'Singapore', short_description: 'C-suite search for APAC technology firms.', revenue_range: '$1M-$5M', contact: { first_name: 'Wei', last_name: 'Chen', title: 'Managing Partner' } },
  { dataset: 'recruitment', name: 'Cobalt Talent Co.', website_url: 'https://cobalttalent.example.com', linkedin_url: 'https://www.linkedin.com/company/cobalt-talent', industry: 'Human Resources', estimated_num_employees: 33, city: 'Amsterdam', state: null, country: 'Netherlands', short_description: 'Product and design recruitment for scale-ups.', revenue_range: '$1M-$5M', contact: { first_name: 'Sanne', last_name: 'Visser', title: 'Co-Founder' } },
  { dataset: 'recruitment', name: 'Maple & Co. Recruiters', website_url: 'https://mapleco.example.com', linkedin_url: 'https://www.linkedin.com/company/maple-and-co-recruiters', industry: 'Staffing & Recruiting', estimated_num_employees: 75, city: 'Vancouver', state: 'BC', country: 'Canada', short_description: 'Engineering and product talent across Canada.', revenue_range: '$10M-$25M', contact: { first_name: 'Owen', last_name: 'Tremblay', title: 'CEO' } },
  { dataset: 'recruitment', name: 'Granite State Hiring', website_url: 'https://granitestate.example.com', linkedin_url: 'https://www.linkedin.com/company/granite-state-hiring', industry: 'Staffing & Recruiting', estimated_num_employees: 50, city: 'Boston', state: 'MA', country: 'United States', short_description: 'Biotech and life-sciences recruitment.', revenue_range: '$5M-$10M', contact: { first_name: 'Hannah', last_name: 'Wexler', title: 'Director' } },
  { dataset: 'recruitment', name: 'Atlas Recruit Partners', website_url: 'https://atlasrecruit.example.com', linkedin_url: 'https://www.linkedin.com/company/atlas-recruit-partners', industry: 'Executive Search', estimated_num_employees: 9, city: 'Sydney', state: 'NSW', country: 'Australia', short_description: 'Energy sector executive search.', revenue_range: '$1M-$5M', contact: { first_name: 'Liam', last_name: 'O\'Sullivan', title: 'Founder' } },
  { dataset: 'recruitment', name: 'Aurora Search Co.', website_url: 'https://aurorasearch.example.com', linkedin_url: 'https://www.linkedin.com/company/aurora-search-co', industry: 'Executive Search', estimated_num_employees: 16, city: 'Stockholm', state: null, country: 'Sweden', short_description: 'Nordic technology leadership search.', revenue_range: '$1M-$5M', contact: { first_name: 'Astrid', last_name: 'Lindqvist', title: 'Managing Partner' } },
  { dataset: 'recruitment', name: 'Crescent Talent Studio', website_url: 'https://crescenttalent.example.com', linkedin_url: 'https://www.linkedin.com/company/crescent-talent-studio', industry: 'Human Resources', estimated_num_employees: 23, city: 'Paris', state: null, country: 'France', short_description: 'Luxury and fashion recruitment.', revenue_range: '$1M-$5M', contact: { first_name: 'Amélie', last_name: 'Laurent', title: 'Director' } },
  { dataset: 'recruitment', name: 'Beacon Hire Network', website_url: 'https://beaconhire.example.com', linkedin_url: 'https://www.linkedin.com/company/beacon-hire-network', industry: 'Staffing & Recruiting', estimated_num_employees: 200, city: 'Denver', state: 'CO', country: 'United States', short_description: 'Multi-vertical staffing across North America.', revenue_range: '$25M-$50M', contact: { first_name: 'Jordan', last_name: 'Reyes', title: 'VP Sales' } },
];

const TECHNOLOGY: Seed[] = [
  { dataset: 'technology', name: 'Nimbus Analytics', website_url: 'https://nimbusanalytics.example.com', linkedin_url: 'https://www.linkedin.com/company/nimbus-analytics', industry: 'Computer Software', estimated_num_employees: 220, city: 'San Francisco', state: 'CA', country: 'United States', short_description: 'Real-time analytics platform for product teams.', revenue_range: '$25M-$50M', contact: { first_name: 'Caroline', last_name: 'Mitchell', title: 'VP Engineering' } },
  { dataset: 'technology', name: 'Quartz Cloud', website_url: 'https://quartzcloud.example.com', linkedin_url: 'https://www.linkedin.com/company/quartz-cloud', industry: 'Cloud Infrastructure', estimated_num_employees: 410, city: 'Seattle', state: 'WA', country: 'United States', short_description: 'Multi-region cloud orchestration for fintech.', revenue_range: '$50M-$100M', contact: { first_name: 'Aaron', last_name: 'Khatri', title: 'Head of Talent' } },
  { dataset: 'technology', name: 'Lumen Robotics', website_url: 'https://lumenrobotics.example.com', linkedin_url: 'https://www.linkedin.com/company/lumen-robotics', industry: 'Robotics', estimated_num_employees: 130, city: 'Boston', state: 'MA', country: 'United States', short_description: 'Warehouse automation robotics.', revenue_range: '$10M-$25M', contact: { first_name: 'Eli', last_name: 'Rosenberg', title: 'CTO' } },
  { dataset: 'technology', name: 'Vector Pay', website_url: 'https://vectorpay.example.com', linkedin_url: 'https://www.linkedin.com/company/vector-pay', industry: 'Financial Technology', estimated_num_employees: 95, city: 'New York', state: 'NY', country: 'United States', short_description: 'B2B payments and reconciliation API.', revenue_range: '$10M-$25M', contact: { first_name: 'Sophia', last_name: 'Patel', title: 'Director of People' } },
  { dataset: 'technology', name: 'Mosaic AI', website_url: 'https://mosaicai.example.com', linkedin_url: 'https://www.linkedin.com/company/mosaic-ai', industry: 'Artificial Intelligence', estimated_num_employees: 60, city: 'Palo Alto', state: 'CA', country: 'United States', short_description: 'LLM fine-tuning platform for enterprises.', revenue_range: '$5M-$10M', contact: { first_name: 'Marcus', last_name: 'Chen', title: 'Head of Engineering' } },
  { dataset: 'technology', name: 'Pixel Forge Games', website_url: 'https://pixelforgegames.example.com', linkedin_url: 'https://www.linkedin.com/company/pixel-forge-games', industry: 'Gaming', estimated_num_employees: 180, city: 'Los Angeles', state: 'CA', country: 'United States', short_description: 'Mobile-first studio behind two top-50 games.', revenue_range: '$25M-$50M', contact: { first_name: 'Tasha', last_name: 'Brooks', title: 'VP Studio Ops' } },
  { dataset: 'technology', name: 'Helix Security', website_url: 'https://helixsecurity.example.com', linkedin_url: 'https://www.linkedin.com/company/helix-security', industry: 'Cybersecurity', estimated_num_employees: 240, city: 'Austin', state: 'TX', country: 'United States', short_description: 'Identity threat detection for the enterprise.', revenue_range: '$25M-$50M', contact: { first_name: 'David', last_name: 'Nakamura', title: 'Chief People Officer' } },
  { dataset: 'technology', name: 'Orbit Mail', website_url: 'https://orbitmail.example.com', linkedin_url: 'https://www.linkedin.com/company/orbit-mail', industry: 'SaaS', estimated_num_employees: 75, city: 'Denver', state: 'CO', country: 'United States', short_description: 'Email infrastructure for B2B SaaS.', revenue_range: '$5M-$10M', contact: { first_name: 'Riley', last_name: 'Donovan', title: 'Head of Talent' } },
  { dataset: 'technology', name: 'Beacon Health Tech', website_url: 'https://beaconhealthtech.example.com', linkedin_url: 'https://www.linkedin.com/company/beacon-health-tech', industry: 'Health Tech', estimated_num_employees: 320, city: 'Chicago', state: 'IL', country: 'United States', short_description: 'Telehealth platform serving 4M patients.', revenue_range: '$25M-$50M', contact: { first_name: 'Nadia', last_name: 'Greene', title: 'VP People' } },
  { dataset: 'technology', name: 'Anvil DevOps', website_url: 'https://anvildevops.example.com', linkedin_url: 'https://www.linkedin.com/company/anvil-devops', industry: 'DevOps', estimated_num_employees: 110, city: 'Brooklyn', state: 'NY', country: 'United States', short_description: 'CI/CD platform for regulated industries.', revenue_range: '$10M-$25M', contact: { first_name: 'Tom', last_name: 'Schaefer', title: 'Director of Engineering' } },
  { dataset: 'technology', name: 'Cinder Studio', website_url: 'https://cinderstudio.example.com', linkedin_url: 'https://www.linkedin.com/company/cinder-studio', industry: 'Design Software', estimated_num_employees: 48, city: 'San Diego', state: 'CA', country: 'United States', short_description: 'Collaborative design tooling for product teams.', revenue_range: '$5M-$10M', contact: { first_name: 'Jules', last_name: 'Romano', title: 'Co-Founder' } },
  { dataset: 'technology', name: 'Foundry Ops', website_url: 'https://foundryops.example.com', linkedin_url: 'https://www.linkedin.com/company/foundry-ops', industry: 'SaaS', estimated_num_employees: 165, city: 'Atlanta', state: 'GA', country: 'United States', short_description: 'Manufacturing ERP modernization.', revenue_range: '$10M-$25M', contact: { first_name: 'Marcus', last_name: 'Hill', title: 'VP People Ops' } },
  { dataset: 'technology', name: 'Tangerine HRTech', website_url: 'https://tangerinehrtech.example.com', linkedin_url: 'https://www.linkedin.com/company/tangerine-hrtech', industry: 'HR Tech', estimated_num_employees: 90, city: 'Miami', state: 'FL', country: 'United States', short_description: 'Compensation benchmarking SaaS.', revenue_range: '$5M-$10M', contact: { first_name: 'Elena', last_name: 'Vargas', title: 'Director of Talent' } },
  { dataset: 'technology', name: 'Quasar Data', website_url: 'https://quasardata.example.com', linkedin_url: 'https://www.linkedin.com/company/quasar-data', industry: 'Data Infrastructure', estimated_num_employees: 270, city: 'San Francisco', state: 'CA', country: 'United States', short_description: 'Streaming data warehouse for ML teams.', revenue_range: '$25M-$50M', contact: { first_name: 'Henry', last_name: 'Park', title: 'VP Engineering' } },
  { dataset: 'technology', name: 'Cobalt Logistics Tech', website_url: 'https://cobaltlogistics.example.com', linkedin_url: 'https://www.linkedin.com/company/cobalt-logistics-tech', industry: 'Logistics Software', estimated_num_employees: 140, city: 'Dallas', state: 'TX', country: 'United States', short_description: 'Last-mile routing SaaS for 3PLs.', revenue_range: '$10M-$25M', contact: { first_name: 'Olivia', last_name: 'Brennan', title: 'Head of People' } },
  { dataset: 'technology', name: 'Northstar Devices', website_url: 'https://northstardevices.example.com', linkedin_url: 'https://www.linkedin.com/company/northstar-devices', industry: 'IoT', estimated_num_employees: 85, city: 'Minneapolis', state: 'MN', country: 'United States', short_description: 'Industrial IoT sensor platform.', revenue_range: '$5M-$10M', contact: { first_name: 'Kevin', last_name: 'Lund', title: 'CTO' } },
  { dataset: 'technology', name: 'Crystal Commerce', website_url: 'https://crystalcommerce.example.com', linkedin_url: 'https://www.linkedin.com/company/crystal-commerce', industry: 'E-commerce', estimated_num_employees: 200, city: 'Portland', state: 'OR', country: 'United States', short_description: 'Headless commerce platform for DTC brands.', revenue_range: '$25M-$50M', contact: { first_name: 'Amelia', last_name: 'Brookes', title: 'Director of Talent Acquisition' } },
  { dataset: 'technology', name: 'Drift Analytics', website_url: 'https://driftanalytics.example.com', linkedin_url: 'https://www.linkedin.com/company/drift-analytics', industry: 'Analytics', estimated_num_employees: 55, city: 'Raleigh', state: 'NC', country: 'United States', short_description: 'Product analytics for mid-market SaaS.', revenue_range: '$1M-$5M', contact: { first_name: 'Jamal', last_name: 'Carter', title: 'Co-Founder' } },
  { dataset: 'technology', name: 'Loop CRM', website_url: 'https://loopcrm.example.com', linkedin_url: 'https://www.linkedin.com/company/loop-crm', industry: 'CRM Software', estimated_num_employees: 125, city: 'Salt Lake City', state: 'UT', country: 'United States', short_description: 'AI-native CRM for revenue teams.', revenue_range: '$10M-$25M', contact: { first_name: 'Grace', last_name: 'Whittaker', title: 'VP People' } },
  { dataset: 'technology', name: 'Echo Voice Labs', website_url: 'https://echovoicelabs.example.com', linkedin_url: 'https://www.linkedin.com/company/echo-voice-labs', industry: 'AI Voice', estimated_num_employees: 38, city: 'Berkeley', state: 'CA', country: 'United States', short_description: 'Voice cloning APIs for accessibility.', revenue_range: '$1M-$5M', contact: { first_name: 'Sami', last_name: 'Okafor', title: 'Founder' } },
];

const COMMODITIES: Seed[] = [
  { dataset: 'commodities', name: 'Halcyon Commodities', website_url: 'https://halcyoncomm.example.com', linkedin_url: 'https://www.linkedin.com/company/halcyon-commodities', industry: 'Commodities Trading', estimated_num_employees: 320, city: 'Geneva', state: null, country: 'Switzerland', short_description: 'Crude and refined products trading.', revenue_range: '$500M-$1B', contact: { first_name: 'Pierre', last_name: 'Dubois', title: 'Head of HR' } },
  { dataset: 'commodities', name: 'Aurora Metals Trading', website_url: 'https://aurorametals.example.com', linkedin_url: 'https://www.linkedin.com/company/aurora-metals-trading', industry: 'Metals Trading', estimated_num_employees: 180, city: 'London', state: null, country: 'United Kingdom', short_description: 'Base metals and concentrates trading desk.', revenue_range: '$100M-$500M', contact: { first_name: 'Charlotte', last_name: 'Ashworth', title: 'Director of Talent' } },
  { dataset: 'commodities', name: 'Silk Road Trading Co.', website_url: 'https://silkroadtrading.example.com', linkedin_url: 'https://www.linkedin.com/company/silk-road-trading', industry: 'Commodities Trading', estimated_num_employees: 95, city: 'Dubai', state: null, country: 'United Arab Emirates', short_description: 'Agricultural commodity trading across MENA.', revenue_range: '$50M-$100M', contact: { first_name: 'Tarek', last_name: 'El-Sayed', title: 'Managing Director' } },
  { dataset: 'commodities', name: 'Pacific Grain Traders', website_url: 'https://pacificgrain.example.com', linkedin_url: 'https://www.linkedin.com/company/pacific-grain-traders', industry: 'Agricultural Trading', estimated_num_employees: 140, city: 'Singapore', state: null, country: 'Singapore', short_description: 'Wheat, soy and corn trading desk APAC.', revenue_range: '$100M-$500M', contact: { first_name: 'Mei', last_name: 'Tan', title: 'HR Director' } },
  { dataset: 'commodities', name: 'Black Diamond Energy', website_url: 'https://blackdiamondenergy.example.com', linkedin_url: 'https://www.linkedin.com/company/black-diamond-energy', industry: 'Oil & Gas Trading', estimated_num_employees: 260, city: 'Houston', state: 'TX', country: 'United States', short_description: 'Physical crude and LNG trading.', revenue_range: '$500M-$1B', contact: { first_name: 'Brett', last_name: 'McAllister', title: 'Chief People Officer' } },
  { dataset: 'commodities', name: 'Cedar Bay Shipping', website_url: 'https://cedarbayshipping.example.com', linkedin_url: 'https://www.linkedin.com/company/cedar-bay-shipping', industry: 'Maritime & Shipping', estimated_num_employees: 410, city: 'Rotterdam', state: null, country: 'Netherlands', short_description: 'Bulk carrier fleet and chartering.', revenue_range: '$100M-$500M', contact: { first_name: 'Lars', last_name: 'Van der Berg', title: 'Head of HR' } },
  { dataset: 'commodities', name: 'Sahara Energy Trade', website_url: 'https://saharaenergytrade.example.com', linkedin_url: 'https://www.linkedin.com/company/sahara-energy-trade', industry: 'Energy Trading', estimated_num_employees: 110, city: 'Abu Dhabi', state: null, country: 'United Arab Emirates', short_description: 'Refined products and petrochemicals trading.', revenue_range: '$100M-$500M', contact: { first_name: 'Yusuf', last_name: 'Al-Mansoori', title: 'Director' } },
  { dataset: 'commodities', name: 'Greenleaf Cocoa', website_url: 'https://greenleafcocoa.example.com', linkedin_url: 'https://www.linkedin.com/company/greenleaf-cocoa', industry: 'Soft Commodities', estimated_num_employees: 70, city: 'Amsterdam', state: null, country: 'Netherlands', short_description: 'Sustainable cocoa and coffee trading.', revenue_range: '$50M-$100M', contact: { first_name: 'Eline', last_name: 'De Vries', title: 'People Lead' } },
  { dataset: 'commodities', name: 'Tundra LNG Partners', website_url: 'https://tundralng.example.com', linkedin_url: 'https://www.linkedin.com/company/tundra-lng-partners', industry: 'LNG Trading', estimated_num_employees: 85, city: 'Calgary', state: 'AB', country: 'Canada', short_description: 'LNG cargo trading and shipping.', revenue_range: '$100M-$500M', contact: { first_name: 'Ethan', last_name: 'Forsyth', title: 'VP HR' } },
  { dataset: 'commodities', name: 'Pearl Bullion', website_url: 'https://pearlbullion.example.com', linkedin_url: 'https://www.linkedin.com/company/pearl-bullion', industry: 'Precious Metals', estimated_num_employees: 55, city: 'Dubai', state: null, country: 'United Arab Emirates', short_description: 'Gold and silver bullion trading.', revenue_range: '$25M-$50M', contact: { first_name: 'Aisha', last_name: 'Rahman', title: 'Head of People' } },
  { dataset: 'commodities', name: 'Northwind Carbon', website_url: 'https://northwindcarbon.example.com', linkedin_url: 'https://www.linkedin.com/company/northwind-carbon', industry: 'Carbon Trading', estimated_num_employees: 42, city: 'Zurich', state: null, country: 'Switzerland', short_description: 'Voluntary carbon credit origination.', revenue_range: '$10M-$25M', contact: { first_name: 'Anja', last_name: 'Müller', title: 'Director' } },
  { dataset: 'commodities', name: 'Apex Power Markets', website_url: 'https://apexpowermarkets.example.com', linkedin_url: 'https://www.linkedin.com/company/apex-power-markets', industry: 'Power Trading', estimated_num_employees: 130, city: 'Madrid', state: null, country: 'Spain', short_description: 'European electricity trading and origination.', revenue_range: '$100M-$500M', contact: { first_name: 'Diego', last_name: 'Herrera', title: 'HR Director' } },
  { dataset: 'commodities', name: 'Sundance Agri-Trade', website_url: 'https://sundanceagri.example.com', linkedin_url: 'https://www.linkedin.com/company/sundance-agri-trade', industry: 'Agricultural Trading', estimated_num_employees: 75, city: 'Sydney', state: 'NSW', country: 'Australia', short_description: 'Wool, beef and grain exporter.', revenue_range: '$50M-$100M', contact: { first_name: 'Holly', last_name: 'Whitaker', title: 'GM People' } },
  { dataset: 'commodities', name: 'Cobalt Bridge Mining', website_url: 'https://cobaltbridge.example.com', linkedin_url: 'https://www.linkedin.com/company/cobalt-bridge-mining', industry: 'Mining & Trading', estimated_num_employees: 220, city: 'Johannesburg', state: null, country: 'South Africa', short_description: 'Battery metals trading and offtake.', revenue_range: '$100M-$500M', contact: { first_name: 'Thabo', last_name: 'Nkosi', title: 'Head of HR' } },
  { dataset: 'commodities', name: 'Marlin Petrochem', website_url: 'https://marlinpetrochem.example.com', linkedin_url: 'https://www.linkedin.com/company/marlin-petrochem', industry: 'Petrochemicals', estimated_num_employees: 165, city: 'Singapore', state: null, country: 'Singapore', short_description: 'Olefins and polymer trading desk.', revenue_range: '$100M-$500M', contact: { first_name: 'Daniel', last_name: 'Lim', title: 'Talent Director' } },
  { dataset: 'commodities', name: 'Atlas Shipping & Trade', website_url: 'https://atlasshipping.example.com', linkedin_url: 'https://www.linkedin.com/company/atlas-shipping-trade', industry: 'Maritime & Shipping', estimated_num_employees: 305, city: 'Athens', state: null, country: 'Greece', short_description: 'Tanker chartering and operations.', revenue_range: '$100M-$500M', contact: { first_name: 'Nikos', last_name: 'Papadopoulos', title: 'HR Lead' } },
  { dataset: 'commodities', name: 'Orient Sugar Trade', website_url: 'https://orientsugartrade.example.com', linkedin_url: 'https://www.linkedin.com/company/orient-sugar-trade', industry: 'Soft Commodities', estimated_num_employees: 60, city: 'São Paulo', state: 'SP', country: 'Brazil', short_description: 'Raw sugar origination and export.', revenue_range: '$25M-$50M', contact: { first_name: 'Camila', last_name: 'Souza', title: 'People Manager' } },
  { dataset: 'commodities', name: 'Hudson Iron & Steel', website_url: 'https://hudsoniron.example.com', linkedin_url: 'https://www.linkedin.com/company/hudson-iron-steel', industry: 'Metals Trading', estimated_num_employees: 245, city: 'Pittsburgh', state: 'PA', country: 'United States', short_description: 'Ferrous metals trading and distribution.', revenue_range: '$100M-$500M', contact: { first_name: 'Frank', last_name: 'Calabrese', title: 'CHRO' } },
  { dataset: 'commodities', name: 'Indus Cotton Co.', website_url: 'https://induscotton.example.com', linkedin_url: 'https://www.linkedin.com/company/indus-cotton', industry: 'Soft Commodities', estimated_num_employees: 90, city: 'Karachi', state: null, country: 'Pakistan', short_description: 'Cotton lint origination and trading.', revenue_range: '$25M-$50M', contact: { first_name: 'Imran', last_name: 'Siddiqui', title: 'Director' } },
  { dataset: 'commodities', name: 'Vanguard Crude Brokers', website_url: 'https://vanguardcrude.example.com', linkedin_url: 'https://www.linkedin.com/company/vanguard-crude-brokers', industry: 'Oil & Gas Trading', estimated_num_employees: 38, city: 'London', state: null, country: 'United Kingdom', short_description: 'Boutique crude oil broker.', revenue_range: '$10M-$25M', contact: { first_name: 'Henry', last_name: 'Standish', title: 'Founder' } },
];

const HEALTHCARE: Seed[] = [
  { dataset: 'healthcare', name: 'Meridian Health Group', website_url: 'https://meridianhealth.example.com', linkedin_url: 'https://www.linkedin.com/company/meridian-health-group', industry: 'Hospitals & Health Care', estimated_num_employees: 1800, city: 'Chicago', state: 'IL', country: 'United States', short_description: 'Regional hospital network across the Midwest.', revenue_range: '$500M-$1B', contact: { first_name: 'Sarah', last_name: 'Bennett', title: 'VP Talent Acquisition' } },
  { dataset: 'healthcare', name: 'Cypress Care Clinics', website_url: 'https://cypresscare.example.com', linkedin_url: 'https://www.linkedin.com/company/cypress-care-clinics', industry: 'Primary Care', estimated_num_employees: 320, city: 'Dallas', state: 'TX', country: 'United States', short_description: 'Multi-site primary care chain.', revenue_range: '$50M-$100M', contact: { first_name: 'Jonathan', last_name: 'Reyes', title: 'Director of HR' } },
  { dataset: 'healthcare', name: 'Albion Medical', website_url: 'https://albionmedical.example.com', linkedin_url: 'https://www.linkedin.com/company/albion-medical', industry: 'Medical Devices', estimated_num_employees: 540, city: 'Leeds', state: null, country: 'United Kingdom', short_description: 'Cardiology device manufacturer.', revenue_range: '$100M-$500M', contact: { first_name: 'Rebecca', last_name: 'Fairbanks', title: 'Head of Talent' } },
  { dataset: 'healthcare', name: 'Lotus Pharma', website_url: 'https://lotuspharma.example.com', linkedin_url: 'https://www.linkedin.com/company/lotus-pharma', industry: 'Pharmaceuticals', estimated_num_employees: 920, city: 'Basel', state: null, country: 'Switzerland', short_description: 'Generics and biosimilars manufacturer.', revenue_range: '$500M-$1B', contact: { first_name: 'Markus', last_name: 'Brunner', title: 'VP Human Resources' } },
  { dataset: 'healthcare', name: 'Riverside Children\'s Hospital', website_url: 'https://riversidechildrens.example.com', linkedin_url: 'https://www.linkedin.com/company/riverside-childrens', industry: 'Hospitals & Health Care', estimated_num_employees: 1450, city: 'Atlanta', state: 'GA', country: 'United States', short_description: 'Pediatric specialty hospital.', revenue_range: '$500M-$1B', contact: { first_name: 'Patricia', last_name: 'Hall', title: 'CHRO' } },
  { dataset: 'healthcare', name: 'Halo Diagnostics', website_url: 'https://halodiagnostics.example.com', linkedin_url: 'https://www.linkedin.com/company/halo-diagnostics', industry: 'Diagnostics', estimated_num_employees: 380, city: 'San Diego', state: 'CA', country: 'United States', short_description: 'Molecular diagnostics labs.', revenue_range: '$100M-$500M', contact: { first_name: 'Andrew', last_name: 'Cho', title: 'Director of People' } },
  { dataset: 'healthcare', name: 'Greenwood Senior Care', website_url: 'https://greenwoodseniorcare.example.com', linkedin_url: 'https://www.linkedin.com/company/greenwood-senior-care', industry: 'Senior Living', estimated_num_employees: 850, city: 'Phoenix', state: 'AZ', country: 'United States', short_description: 'Senior living and assisted care.', revenue_range: '$100M-$500M', contact: { first_name: 'Linda', last_name: 'Carmichael', title: 'VP People' } },
  { dataset: 'healthcare', name: 'Falcon BioPharma', website_url: 'https://falconbiopharma.example.com', linkedin_url: 'https://www.linkedin.com/company/falcon-biopharma', industry: 'Biotechnology', estimated_num_employees: 240, city: 'Cambridge', state: 'MA', country: 'United States', short_description: 'Oncology biologics developer.', revenue_range: '$50M-$100M', contact: { first_name: 'Hannah', last_name: 'Goldberg', title: 'Head of Talent' } },
  { dataset: 'healthcare', name: 'Pinetree Mental Health', website_url: 'https://pinetreemh.example.com', linkedin_url: 'https://www.linkedin.com/company/pinetree-mental-health', industry: 'Behavioral Health', estimated_num_employees: 175, city: 'Portland', state: 'OR', country: 'United States', short_description: 'Outpatient behavioral health clinics.', revenue_range: '$25M-$50M', contact: { first_name: 'Marcus', last_name: 'Webb', title: 'Director of HR' } },
  { dataset: 'healthcare', name: 'Coral Reef Dental', website_url: 'https://coralreefdental.example.com', linkedin_url: 'https://www.linkedin.com/company/coral-reef-dental', industry: 'Dental Care', estimated_num_employees: 420, city: 'Miami', state: 'FL', country: 'United States', short_description: 'DSO operating 60 clinics across the Southeast.', revenue_range: '$50M-$100M', contact: { first_name: 'Carmen', last_name: 'Ortiz', title: 'VP Talent' } },
  { dataset: 'healthcare', name: 'Stonebridge Surgical', website_url: 'https://stonebridgesurgical.example.com', linkedin_url: 'https://www.linkedin.com/company/stonebridge-surgical', industry: 'Medical Devices', estimated_num_employees: 290, city: 'Birmingham', state: null, country: 'United Kingdom', short_description: 'Orthopedic implants and instruments.', revenue_range: '$50M-$100M', contact: { first_name: 'Oliver', last_name: 'Hayes', title: 'Head of People' } },
  { dataset: 'healthcare', name: 'Aurora Animal Health', website_url: 'https://auroraanimalhealth.example.com', linkedin_url: 'https://www.linkedin.com/company/aurora-animal-health', industry: 'Veterinary', estimated_num_employees: 220, city: 'Kansas City', state: 'MO', country: 'United States', short_description: 'Veterinary pharmaceuticals.', revenue_range: '$50M-$100M', contact: { first_name: 'Daniel', last_name: 'Friedrich', title: 'Director of HR' } },
  { dataset: 'healthcare', name: 'Bluewave Telemedicine', website_url: 'https://bluewavetelemed.example.com', linkedin_url: 'https://www.linkedin.com/company/bluewave-telemedicine', industry: 'Telehealth', estimated_num_employees: 110, city: 'Austin', state: 'TX', country: 'United States', short_description: 'Tele-urgent care platform.', revenue_range: '$10M-$25M', contact: { first_name: 'Anika', last_name: 'Shah', title: 'People Operations Lead' } },
  { dataset: 'healthcare', name: 'Heritage Home Care', website_url: 'https://heritagehomecare.example.com', linkedin_url: 'https://www.linkedin.com/company/heritage-home-care', industry: 'Home Health', estimated_num_employees: 680, city: 'Columbus', state: 'OH', country: 'United States', short_description: 'In-home care services in the Midwest.', revenue_range: '$100M-$500M', contact: { first_name: 'Theresa', last_name: 'Donaldson', title: 'VP HR' } },
  { dataset: 'healthcare', name: 'Sapphire Skincare', website_url: 'https://sapphireskincare.example.com', linkedin_url: 'https://www.linkedin.com/company/sapphire-skincare', industry: 'Dermatology', estimated_num_employees: 95, city: 'Los Angeles', state: 'CA', country: 'United States', short_description: 'Dermatology and aesthetics clinics.', revenue_range: '$10M-$25M', contact: { first_name: 'Vanessa', last_name: 'Park', title: 'Director of People' } },
  { dataset: 'healthcare', name: 'Compass Insurance Health', website_url: 'https://compassinsurancehealth.example.com', linkedin_url: 'https://www.linkedin.com/company/compass-insurance-health', industry: 'Health Insurance', estimated_num_employees: 1100, city: 'Hartford', state: 'CT', country: 'United States', short_description: 'Regional health insurance carrier.', revenue_range: '$500M-$1B', contact: { first_name: 'Brendan', last_name: 'Walsh', title: 'Director of TA' } },
  { dataset: 'healthcare', name: 'Maple Leaf Rehab', website_url: 'https://mapleleafrehab.example.com', linkedin_url: 'https://www.linkedin.com/company/maple-leaf-rehab', industry: 'Rehabilitation', estimated_num_employees: 260, city: 'Toronto', state: 'ON', country: 'Canada', short_description: 'Physical therapy and rehab clinics.', revenue_range: '$25M-$50M', contact: { first_name: 'Erin', last_name: 'McKinley', title: 'HR Director' } },
  { dataset: 'healthcare', name: 'Verdant Wellness', website_url: 'https://verdantwellness.example.com', linkedin_url: 'https://www.linkedin.com/company/verdant-wellness', industry: 'Wellness', estimated_num_employees: 75, city: 'Boulder', state: 'CO', country: 'United States', short_description: 'Corporate wellness programs.', revenue_range: '$5M-$10M', contact: { first_name: 'Maya', last_name: 'Patel', title: 'People Lead' } },
  { dataset: 'healthcare', name: 'Northbay Imaging', website_url: 'https://northbayimaging.example.com', linkedin_url: 'https://www.linkedin.com/company/northbay-imaging', industry: 'Diagnostic Imaging', estimated_num_employees: 340, city: 'San Francisco', state: 'CA', country: 'United States', short_description: 'Outpatient imaging centers.', revenue_range: '$50M-$100M', contact: { first_name: 'Jason', last_name: 'Wu', title: 'VP People' } },
  { dataset: 'healthcare', name: 'Olive Branch Hospice', website_url: 'https://olivebranchhospice.example.com', linkedin_url: 'https://www.linkedin.com/company/olive-branch-hospice', industry: 'Hospice', estimated_num_employees: 195, city: 'Nashville', state: 'TN', country: 'United States', short_description: 'Hospice and palliative care services.', revenue_range: '$25M-$50M', contact: { first_name: 'Caroline', last_name: 'Sutton', title: 'HR Director' } },
];

const phoneFor = (country: string, idx: number) => {
  if (country === 'United Kingdom') return ukPhone(idx);
  if (country === 'United Arab Emirates') return aePhone(idx);
  if (country === 'Singapore') return sgPhone(idx);
  return usPhone(idx);
};

const enrich = (seeds: Seed[]): DemoCompany[] =>
  seeds.map((s, i) => {
    const full_name = `${s.contact.first_name} ${s.contact.last_name}`;
    return {
      id: `demo-${s.dataset}-${i + 1}-${slug(s.name)}`,
      dataset: s.dataset,
      name: s.name,
      logo_url: logoFor(s.name, i),
      website_url: s.website_url,
      linkedin_url: s.linkedin_url,
      industry: s.industry,
      estimated_num_employees: s.estimated_num_employees,
      city: s.city,
      state: s.state,
      country: s.country,
      short_description: s.short_description,
      revenue_range: s.revenue_range,
      match_score: 60 + ((i * 7) % 39), // 60–98 deterministic
      contact: {
        first_name: s.contact.first_name,
        last_name: s.contact.last_name,
        full_name,
        title: s.contact.title,
        email: emailFor(s.contact.first_name, s.contact.last_name, s.website_url),
        phone: phoneFor(s.country, i),
        linkedin_url: linkedinPersonFor(s.contact.first_name, s.contact.last_name),
      },
      isDemo: true,
    };
  });

const DATASETS: Record<DemoDataset, DemoCompany[]> = {
  recruitment: enrich(RECRUITMENT),
  technology: enrich(TECHNOLOGY),
  commodities: enrich(COMMODITIES),
  healthcare: enrich(HEALTHCARE),
};

export function getDemoCompanies(dataset: DemoDataset): DemoCompany[] {
  return DATASETS[dataset];
}

export const DEMO_TABS: { id: DemoDataset; label: string; description: string }[] = [
  { id: 'recruitment', label: 'Recruitment Agencies', description: 'UK & UAE recruitment / staffing firms' },
  { id: 'technology', label: 'Technology Companies', description: 'US SaaS, cloud and AI companies' },
  { id: 'commodities', label: 'Commodities & Trading', description: 'Global commodity, energy and metals traders' },
  { id: 'healthcare', label: 'Healthcare', description: 'Hospitals, medtech and life sciences' },
];

// Back-compat for any older callers.
export function generateDemoCompanies(): DemoCompany[] {
  return DATASETS.recruitment;
}
