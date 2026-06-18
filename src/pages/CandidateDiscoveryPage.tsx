import { AppLayout } from '@/components/layout/AppLayout';
import { CandidateSourceIntegrationCard } from '@/components/settings/CandidateSourceIntegrationCard';
import { useAuth } from '@/lib/auth';
import { UserSearch } from 'lucide-react';

export default function CandidateDiscoveryPage() {
  const { isOwner, isManager } = useAuth();
  const canManage = !!(isOwner || isManager);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 mt-1"><UserSearch className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Candidate Discovery</h1>
            <p className="text-muted-foreground text-sm">
              Connect external candidate sources to your workspace. Credentials are encrypted and stored at tenant level.
              Only Owners and Managers can manage credentials; Recruiters can use connected sources.
            </p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <CandidateSourceIntegrationCard
            provider="lusha"
            title="Lusha"
            description="Find verified contact details for candidates from LinkedIn and the open web."
            helpText="Find your key in Lusha → Settings → API."
            canManage={canManage}
          />
          <CandidateSourceIntegrationCard
            provider="vibe_prospecting"
            title="Vibe Prospecting"
            description="Source passive candidates and enrich profiles from Vibe Prospecting's database."
            helpText="Find your key in Vibe Prospecting → Account → API Access."
            canManage={canManage}
          />
        </div>
      </div>
    </AppLayout>
  );
}
