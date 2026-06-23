import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { normalizeLinkedInUrl, openLinkedInUrl } from '@/lib/discovery';
import { ExternalLink, Loader2 } from 'lucide-react';

interface CandidateLinkedInRow {
  id: string;
  full_name: string;
  linkedin_url: string | null;
  source: string | null;
}

export default function LinkedInDebugTestPage() {
  const { tenantId } = useAuth();
  const [rows, setRows] = useState<CandidateLinkedInRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('candidates')
        .select('id, full_name, linkedin_url, source')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);
      setRows((data as CandidateLinkedInRow[]) ?? []);
      setLoading(false);
    })();
  }, [tenantId]);

  const audit = useMemo(() => {
    const valid = rows.filter((r) => normalizeLinkedInUrl(r.linkedin_url)).length;
    const missing = rows.filter((r) => !r.linkedin_url).length;
    return { total: rows.length, valid, invalid: rows.length - valid - missing, missing };
  }, [rows]);

  return (
    <AppLayout title="LinkedIn Debug Test" subtitle="Audit candidate LinkedIn URL storage, validation, and external opening.">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Audited</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{audit.total}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Valid URLs</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-success">{audit.valid}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Invalid URLs</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-destructive">{audit.invalid}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Missing</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-muted-foreground">{audit.missing}</CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate Name</TableHead>
                  <TableHead>LinkedIn URL</TableHead>
                  <TableHead>Validation Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Button</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading candidates…</TableCell></TableRow>
                ) : rows.map((row) => {
                  const normalized = normalizeLinkedInUrl(row.linkedin_url);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.full_name}</TableCell>
                      <TableCell className="max-w-md truncate text-sm text-muted-foreground">{normalized ?? row.linkedin_url ?? '—'}</TableCell>
                      <TableCell>
                        {normalized ? <Badge>Valid</Badge> : row.linkedin_url ? <Badge variant="destructive">Invalid</Badge> : <Badge variant="secondary">Missing</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.source ?? 'CRM'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={!normalized} onClick={() => openLinkedInUrl(normalized)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Open LinkedIn
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No candidates found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}