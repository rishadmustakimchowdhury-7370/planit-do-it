import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Briefcase, MapPin, Linkedin, FileDown, Calendar, GraduationCap, Sparkles, Lock, Clock } from 'lucide-react';

type ShareData = {
  share: { id: string; shared_at: string; recruiter_summary: string | null; ai_insights: any; branded_cv_url: string | null; expires_at: string | null };
  candidate: any;
  job: { title: string; location: string | null; employment_type: string | null; experience_level: string | null };
  client_org: { name: string; logo_url: string | null; primary_color: string | null };
  brand: { company_name: string | null; logo_url: string | null; primary_color: string | null; footer_text: string | null } | null;
};

export default function PublicCandidateSharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Candidate profile';
    if (!token) return;
    (async () => {
      const { data: result, error: rpcErr } = await supabase.rpc('get_public_candidate_share' as any, { p_token: token });
      if (rpcErr) { setError(rpcErr.message); setLoading(false); return; }
      const r = result as any;
      if (r?.error === 'expired') setError('This link has expired.');
      else if (r?.error === 'not_found' || !r) setError('Link not found or revoked.');
      else setData(r as ShareData);
      setLoading(false);
    })();
  }, [token]);

  const primary = data?.client_org?.primary_color || data?.brand?.primary_color;
  const logo = data?.client_org?.logo_url || data?.brand?.logo_url;
  const orgName = data?.client_org?.name || data?.brand?.company_name || 'Talent Profile';

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-10 text-center">
            <Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Link unavailable</h1>
            <p className="text-sm text-muted-foreground mt-1">{error || 'This share link is no longer valid.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const c = data.candidate;
  const skills: string[] = Array.isArray(c.skills) ? c.skills : (c.skills?.list || []);
  const workHistory: any[] = Array.isArray(c.work_history) ? c.work_history : [];
  const education: any[] = Array.isArray(c.education) ? c.education : [];

  return (
    <div
      className="min-h-screen bg-muted/30"
      style={primary ? ({ ['--accent-color' as any]: primary } as React.CSSProperties) : undefined}
    >
      {/* Header */}
      <header className="border-b bg-card/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt={orgName} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-semibold"
                style={{ background: primary || '#0F172A' }}
              >
                {orgName.charAt(0)}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold">{orgName}</div>
              <div className="text-[11px] text-muted-foreground">Shared candidate · {data.job.title}</div>
            </div>
          </div>
          {data.share.expires_at && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> expires {new Date(data.share.expires_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Hero */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-5">
              <Avatar className="h-20 w-20">
                {c.avatar_url && <AvatarImage src={c.avatar_url} alt={c.full_name} />}
                <AvatarFallback className="text-xl" style={{ background: primary || undefined, color: primary ? '#fff' : undefined }}>
                  {(c.full_name || '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">{c.full_name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {[c.current_title, c.current_company].filter(Boolean).join(' · ')}
                </p>
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  {c.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.location}</span>}
                  {c.experience_years != null && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {c.experience_years} yrs experience</span>}
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                      <Linkedin className="h-3 w-3" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>

            {data.share.branded_cv_url && (
              <div className="mt-5 pt-5 border-t">
                <a href={data.share.branded_cv_url} target="_blank" rel="noreferrer">
                  <Button style={primary ? { background: primary } : undefined}>
                    <FileDown className="h-4 w-4 mr-2" /> Download branded CV
                  </Button>
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recruiter notes / AI insights */}
        {(data.share.recruiter_summary || data.share.ai_insights) && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4" style={primary ? { color: primary } : undefined} /> Why this candidate
              </h2>
              {data.share.recruiter_summary && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4">{data.share.recruiter_summary}</p>
              )}
              {data.share.ai_insights?.strengths?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Strengths</p>
                  <ul className="text-sm list-disc ml-5 space-y-0.5">
                    {data.share.ai_insights.strengths.slice(0, 5).map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        {c.summary && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold mb-3">Summary</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{c.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold mb-3">Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {skills.slice(0, 30).map((s, i) => (
                  <Badge key={i} variant="secondary" className="font-normal">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Experience */}
        {workHistory.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <Briefcase className="h-4 w-4" /> Experience
              </h2>
              <ul className="space-y-4">
                {workHistory.slice(0, 8).map((w, i) => (
                  <li key={i} className="border-l-2 pl-4" style={primary ? { borderColor: primary } : undefined}>
                    <p className="text-sm font-medium">{w.title || w.role || w.position}</p>
                    <p className="text-xs text-muted-foreground">{w.company} · {w.duration || [w.start_date, w.end_date].filter(Boolean).join(' – ')}</p>
                    {w.description && <p className="text-xs mt-1 leading-relaxed text-muted-foreground line-clamp-3">{w.description}</p>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Education */}
        {education.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <GraduationCap className="h-4 w-4" /> Education
              </h2>
              <ul className="space-y-3">
                {education.map((e, i) => (
                  <li key={i}>
                    <p className="text-sm font-medium">{e.degree || e.field}</p>
                    <p className="text-xs text-muted-foreground">{e.institution || e.school} {e.year ? `· ${e.year}` : ''}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 inline mr-1" />
          Shared {new Date(data.share.shared_at).toLocaleDateString()} via {data.brand?.company_name || 'HireMetrics'}
          {data.brand?.footer_text && <div className="mt-2 italic">{data.brand.footer_text}</div>}
        </footer>
      </main>
    </div>
  );
}
