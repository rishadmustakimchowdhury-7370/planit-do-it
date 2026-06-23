import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { friendlyDiscoveryError } from '@/lib/discoveryErrors';
import { Database, Search, Loader2, AlertCircle, Mail, MapPin, Briefcase, ArrowLeft } from 'lucide-react';

interface Row {
  id: string;
  full_name: string;
  email: string;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  skills: unknown;
}

function skillsArray(s: unknown): string[] {
  if (!s) return [];
  if (Array.isArray(s)) return s.map(String);
  return [];
}

export default function InternalCrmSearchPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('candidates')
        .select('id,full_name,email,current_title,current_company,location,skills')
        .limit(50);

      if (title.trim()) q = q.ilike('current_title', `%${title.trim()}%`);
      if (location.trim()) q = q.ilike('location', `%${location.trim()}%`);

      const { data, error } = await q;
      if (error) throw error;

      const requiredSkills = skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const filtered = (data ?? []).filter(c => {
        if (!requiredSkills.length) return true;
        const cs = skillsArray(c.skills).map(s => s.toLowerCase());
        return requiredSkills.every(rs => cs.some(s => s.includes(rs)));
      });

      setRows(filtered as Row[]);
      toast({ title: 'Internal CRM search complete', description: `${filtered.length} candidate(s) matched.` });
    } catch (e) {
      const msg = friendlyDiscoveryError(e instanceof Error ? e.message : 'Search failed');
      setError(msg);
      toast({ title: 'Search failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 mt-1"><Database className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Internal CRM Search</h1>
              <p className="text-muted-foreground text-sm">
                Search candidates already in your CRM. Use this to validate Candidate Discovery when external providers are out of credits.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/candidate-discovery/sources"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Source Dashboard</Link>
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search criteria</CardTitle>
            <CardDescription>All filters are optional. Combine to narrow results.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="title">Job title</Label>
              <Input id="title" placeholder="e.g. Operations Manager" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="e.g. London" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Skills (comma separated)</Label>
              <Input id="skills" placeholder="e.g. Java, AWS" value={skills} onChange={e => setSkills(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <Button onClick={runSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Search Internal CRM
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {rows && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Results ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No candidates match these criteria.</p>
              ) : (
                <ul className="divide-y">
                  {rows.map(c => (
                    <li key={c.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.full_name}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-1">
                          {c.current_title && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{c.current_title}{c.current_company ? ` @ ${c.current_company}` : ''}</span>}
                          {c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>}
                          {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                        </div>
                        {skillsArray(c.skills).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {skillsArray(c.skills).slice(0, 8).map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/candidates/${c.id}`}>Open</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
