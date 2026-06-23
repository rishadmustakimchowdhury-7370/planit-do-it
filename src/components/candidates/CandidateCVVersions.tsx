import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Upload, Download, Sparkles, Check, Loader2, FileText, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CVVersion {
  id: string;
  version: number;
  source: string;
  label: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  ai_content: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  candidateId: string;
  tenantId: string;
  candidate: {
    full_name: string;
    summary: string | null;
    current_title: string | null;
    current_company: string | null;
    skills: string[] | null;
    experience_years: number | null;
  };
}

const sourceLabels: Record<string, string> = {
  uploaded: 'Uploaded',
  ai_generated: 'AI Resume',
  linkedin: 'LinkedIn',
  apollo: 'Apollo',
  lusha: 'Lusha',
  vibe: 'Vibe',
  open_web: 'Open Web Discovery',
};

export function CandidateCVVersions({ candidateId, tenantId, candidate }: Props) {
  const [rows, setRows] = useState<CVVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('candidate_cv_versions')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('version', { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as CVVersion[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [candidateId]);

  const nextVersion = () => (rows.length ? Math.max(...rows.map(r => r.version)) + 1 : 1);

  const setActive = async (id: string) => {
    setBusy(id);
    const { error: e1 } = await supabase
      .from('candidate_cv_versions')
      .update({ is_active: false })
      .eq('candidate_id', candidateId);
    const { error: e2 } = await supabase
      .from('candidate_cv_versions')
      .update({ is_active: true })
      .eq('id', id);
    setBusy(null);
    if (e1 || e2) { toast.error((e1 || e2)!.message); return; }
    // Mirror file_path onto candidates.cv_file_url for backwards compatibility
    const sel = rows.find(r => r.id === id);
    if (sel?.file_path) {
      await supabase.from('candidates').update({ cv_file_url: sel.file_path }).eq('id', candidateId);
    }
    toast.success('Active resume updated');
    load();
  };

  const handleUpload = async (file: File) => {
    setBusy('upload');
    try {
      const version = nextVersion();
      const path = `${tenantId}/candidates/${candidateId}/cv-v${version}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('candidate_cv_versions').update({ is_active: false }).eq('candidate_id', candidateId);
      const { error: insErr } = await supabase.from('candidate_cv_versions').insert({
        candidate_id: candidateId,
        tenant_id: tenantId,
        version,
        source: 'uploaded',
        label: `Uploaded CV v${version}`,
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        is_active: true,
        created_by: user?.id,
      });
      if (insErr) throw insErr;
      await supabase.from('candidates').update({ cv_file_url: path }).eq('id', candidateId);
      toast.success(`Resume uploaded as Version ${version}`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Upload failed');
    } finally {
      setBusy(null);
    }
  };

  const generateAI = async () => {
    setBusy('ai');
    try {
      const lines: string[] = [];
      lines.push(candidate.full_name);
      if (candidate.current_title || candidate.current_company) {
        lines.push([candidate.current_title, candidate.current_company].filter(Boolean).join(' @ '));
      }
      if (candidate.experience_years) lines.push(`${candidate.experience_years} years of experience`);
      if (candidate.summary) { lines.push('', 'SUMMARY', candidate.summary); }
      if (candidate.skills?.length) { lines.push('', 'SKILLS', candidate.skills.join(' • ')); }
      const ai_content = lines.join('\n');

      const version = nextVersion();
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('candidate_cv_versions').update({ is_active: false }).eq('candidate_id', candidateId);
      const { error } = await supabase.from('candidate_cv_versions').insert({
        candidate_id: candidateId,
        tenant_id: tenantId,
        version,
        source: 'ai_generated',
        label: `AI Resume v${version}`,
        ai_content,
        is_active: true,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success(`AI Resume generated as Version ${version}`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'AI generation failed');
    } finally {
      setBusy(null);
    }
  };

  const download = async (row: CVVersion) => {
    setBusy(row.id);
    try {
      if (row.file_path) {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(row.file_path, 120);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } else if (row.ai_content) {
        const blob = new Blob([row.ai_content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${candidate.full_name.replace(/\s+/g, '_')}_AI_Resume_v${row.version}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Download failed');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: CVVersion) => {
    if (!confirm(`Delete Version ${row.version}?`)) return;
    setBusy(row.id);
    if (row.file_path) {
      await supabase.storage.from('documents').remove([row.file_path]);
    }
    const { error } = await supabase.from('candidate_cv_versions').delete().eq('id', row.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Version deleted');
    load();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Resume Versions</h3>
          <p className="text-sm text-muted-foreground">Switch between AI-generated and uploaded resumes. Full version history kept.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={generateAI} disabled={busy === 'ai'} className="gap-2">
            {busy === 'ai' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate AI Resume
          </Button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.rtf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ''; }}
          />
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={busy === 'upload'} className="gap-2">
            {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {rows.length ? 'Replace / Upload New' : 'Upload Resume'}
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
          No resume versions yet. Upload a CV or generate an AI resume to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${row.is_active ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Version {row.version}</span>
                    <Badge variant="secondary">{sourceLabels[row.source] ?? row.source}</Badge>
                    {row.is_active && <Badge className="gap-1"><Check className="w-3 h-3" /> Active</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {row.file_name ?? row.label ?? 'AI-generated content'} · {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!row.is_active && (
                  <Button size="sm" variant="ghost" onClick={() => setActive(row.id)} disabled={busy === row.id}>
                    Set Active
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => download(row)} disabled={busy === row.id} className="gap-1">
                  <Download className="w-4 h-4" /> Download
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(row)} disabled={busy === row.id} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
