export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'recruiter';
  avatar?: string;
  createdAt: Date;
}

export interface Client {
  id: string;
  companyName: string;
  address: string;
  website: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  createdAt: Date;
  ownerId: string;
}

export interface Job {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  location: string;
  salaryRange: string;
  description: string;
  status: 'open' | 'closed' | 'on-hold';
  assignedUserId: string;
  assignedUserName: string;
  candidateCount: number;
  createdAt: Date;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experienceYears: number;
  currentTitle: string;
  location: string;
  resumeUrl: string;
  avatar?: string;
  linkedinUrl?: string;
  status: PipelineStage;
  matchScore?: number;
  createdAt: Date;
}

export type PipelineStage = 
  | 'new'
  | 'screening'
  | 'shortlisted'
  | 'interview'
  | 'offer'
  | 'placed'
  | 'rejected';

export interface JobCandidate {
  id: string;
  jobId: string;
  candidateId: string;
  candidate: Candidate;
  status: PipelineStage;
  matchScore?: number;
  appliedAt: Date;
}

export interface MatchScore {
  id: string;
  candidateId: string;
  jobId: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  skillGaps: string[];
  createdAt: Date;
}

export interface Activity {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  entityType: 'job' | 'candidate' | 'client' | 'match';
  entityId: string;
  entityName: string;
  timestamp: Date;
}

export interface DashboardStats {
  openJobs: number;
  activeCandidates: number;
  interviewsScheduled: number;
  placements: number;
  totalClients: number;
  matchesRun: number;
}

export interface SubscriptionPlan {
  id: string;
  name: 'starter' | 'pro' | 'agency';
  price: number;
  features: string[];
  limits: {
    jobs: number;
    candidates: number;
    aiMatches: number;
  };
}
