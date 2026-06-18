import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Send, Paperclip, Loader2, AlertCircle, FileText, X, MapPin,
  Briefcase, Wrench, Calendar, Search,
} from 'lucide-react';

interface Criteria {
  role_titles?: string[];
  skills?: string[];
  locations?: string[];
  industries?: string[];
  seniority?: string | null;
  min_years_experience?: number | null;
  max_years_experience?: number | null;
  keywords?: string[];
  languages?: string[];
  notes?: string | null;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  fileName?: string;
  criteria?: Criteria;
  extractedPreview?: string;
  extractedChars?: number;
  error?: string;
}

const EXAMPLES = [
  'Find Java Developers in London with 5+ years experience.',
  'Find Commodity Traders in Switzerland.',
  'Find Guidewire Developers in the UK.',
];

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function readFilePayload(file: File): Promise<{ fileText?: string; fileBase64?: string; fileMime: string }> {
  const mime = file.type || '';
  const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    const buf = await file.arrayBuffer();
    return { fileBase64: arrayBufferToBase64(buf), fileMime: 'application/pdf' };
  }
  if (mime.startsWith('text/') || file.name.toLowerCase().endsWith('.txt')) {
    return { fileText: await file.text(), fileMime: mime || 'text/plain' };
  }
  // DOCX / other: best-effort text decode (the AI is tolerant of partial text).
  const buf = await file.arrayBuffer();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const txt = decoder.decode(buf).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]+/g, ' ').slice(0, 30000);
  return { fileText: txt, fileMime: mime };
}

export default function AICandidateDiscoveryPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, sending]);

  const handleFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5 MB.', variant: 'destructive' });
      return;
    }
    setFile(f);
  };

  const send = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? prompt).trim();
    if (!promptText && !file) return;
    setSending(true);
    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: 'user',
      text: promptText || undefined,
      fileName: file?.name,
    };
    setTurns((t) => [...t, userTurn]);
    setPrompt('');
    const activeFile = file;
    setFile(null);

    try {
      const payload = activeFile ? await readFilePayload(activeFile) : {};
      console.log('[discovery] sending', {
        fileName: activeFile?.name,
        fileMime: (payload as { fileMime?: string }).fileMime,
        fileBytes: activeFile?.size,
        hasBase64: !!(payload as { fileBase64?: string }).fileBase64,
        textChars: (payload as { fileText?: string }).fileText?.length ?? 0,
      });
      const { data, error } = await supabase.functions.invoke('ai-candidate-discovery', {
        body: { prompt: promptText, fileName: activeFile?.name, ...payload },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      console.log('[discovery] extracted', data?.extractedChars, 'chars');
      setTurns((t) => [...t, {
        id: crypto.randomUUID(),
        role: 'assistant',
        criteria: data.criteria as Criteria,
        extractedPreview: data.extractedText,
        extractedChars: data.extractedChars,
      }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[discovery] failed', msg);
      setTurns((t) => [...t, { id: crypto.randomUUID(), role: 'assistant', error: msg }]);
      toast({ title: 'Failed to analyse', description: msg, variant: 'destructive' });
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const runSearch = (criteria: Criteria) => {
    const params = new URLSearchParams();
    const q = [
      ...(criteria.role_titles ?? []),
      ...(criteria.skills ?? []),
    ].filter(Boolean).join(' ');
    if (q) params.set('q', q);
    if (criteria.locations?.length) params.set('location', criteria.locations.join(','));
    if (criteria.min_years_experience != null) params.set('min_years', String(criteria.min_years_experience));
    if (criteria.seniority) params.set('seniority', criteria.seniority);
    navigate(`/candidate-discovery/results?${params.toString()}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending) send();
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto w-full">
        <header className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2"><Sparkles className="h-5 w-5 text-primary" /></div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">AI Candidate Discovery</h1>
              <p className="text-sm text-muted-foreground">Describe the role, paste a JD, or upload a file. AI extracts the search criteria for you.</p>
            </div>
          </div>
        </header>

        <div ref={transcriptRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {turns.length === 0 && (
            <div className="text-center space-y-6 py-12">
              <div className="mx-auto rounded-full bg-primary/10 h-16 w-16 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-medium">What kind of candidate are you looking for?</h2>
                <p className="text-sm text-muted-foreground mt-1">Try one of these examples:</p>
              </div>
              <div className="grid gap-2 max-w-xl mx-auto">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="text-left rounded-lg border bg-card hover:bg-accent transition-colors px-4 py-3 text-sm"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t) => t.role === 'user' ? (
            <div key={t.id} className="flex justify-end">
              <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl px-4 py-2.5 space-y-1">
                {t.text && <p className="text-sm whitespace-pre-wrap">{t.text}</p>}
                {t.fileName && (
                  <div className="flex items-center gap-1.5 text-xs opacity-90"><FileText className="h-3.5 w-3.5" />{t.fileName}</div>
                )}
              </div>
            </div>
          ) : (
            <div key={t.id} className="flex justify-start">
              <div className="max-w-[90%] w-full space-y-3">
                {t.error ? (
                  <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="whitespace-pre-wrap">{t.error}</AlertDescription></Alert>
                ) : (
                  <>
                    {t.extractedPreview && (
                      <details className="rounded-lg border bg-muted/30 text-sm">
                        <summary className="cursor-pointer px-3 py-2 font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Extracted text preview ({t.extractedChars?.toLocaleString() ?? 0} chars)
                        </summary>
                        <pre className="px-3 pb-3 pt-1 whitespace-pre-wrap text-xs max-h-64 overflow-y-auto">{t.extractedPreview}</pre>
                      </details>
                    )}
                    {t.criteria && <CriteriaCard criteria={t.criteria} onSearch={() => runSearch(t.criteria!)} />}
                  </>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing your request…
            </div>
          )}
        </div>

        <div className="border-t bg-background/95 backdrop-blur px-6 py-4">
          {file && (
            <div className="flex items-center justify-between mb-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
              <div className="flex items-center gap-2 truncate"><FileText className="h-4 w-4 text-muted-foreground" /><span className="truncate">{file.name}</span></div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          )}
          <div className="relative rounded-2xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Describe the candidate you need, or paste a job description…"
              className="min-h-[60px] max-h-48 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pr-24 pb-12"
              disabled={sending}
            />
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <input
                ref={fileInputRef} type="file" className="hidden"
                accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={sending} className="gap-1.5">
                <Paperclip className="h-4 w-4" /> Upload JD
              </Button>
              <Button type="button" size="sm" onClick={() => send()} disabled={sending || (!prompt.trim() && !file)} className="gap-1.5">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Enter to send · Shift+Enter for newline · PDF, DOCX, TXT supported (max 5 MB)
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

function CriteriaCard({ criteria, onSearch }: { criteria: Criteria; onSearch: () => void }) {
  const empty = !criteria.role_titles?.length && !criteria.skills?.length && !criteria.locations?.length;
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Generated Search Criteria
            </CardTitle>
            {criteria.notes && <p className="text-sm text-muted-foreground mt-1">{criteria.notes}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {empty && <p className="text-sm text-muted-foreground">No specific criteria detected. Try giving more detail about role, skills, or location.</p>}
        <Section icon={<Briefcase className="h-3.5 w-3.5" />} label="Roles" items={criteria.role_titles} />
        <Section icon={<Wrench className="h-3.5 w-3.5" />} label="Skills" items={criteria.skills} />
        <Section icon={<MapPin className="h-3.5 w-3.5" />} label="Locations" items={criteria.locations} />
        <Section icon={<Briefcase className="h-3.5 w-3.5" />} label="Industries" items={criteria.industries} />
        {(criteria.min_years_experience != null || criteria.max_years_experience != null || criteria.seniority) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Experience</span>
            {criteria.seniority && <Badge variant="secondary" className="capitalize">{criteria.seniority}</Badge>}
            {criteria.min_years_experience != null && <Badge variant="secondary">{criteria.min_years_experience}+ years</Badge>}
            {criteria.max_years_experience != null && <Badge variant="secondary">up to {criteria.max_years_experience} years</Badge>}
          </div>
        )}
        <Section label="Keywords" items={criteria.keywords} />
        <Section label="Languages" items={criteria.languages} />
        <div className="pt-2 flex justify-end">
          <Button size="sm" onClick={onSearch} disabled={empty} className="gap-1.5">
            <Search className="h-4 w-4" /> Search Candidates
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ icon, label, items }: { icon?: React.ReactNode; label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground min-w-20">{icon}{label}</span>
      {items.map((s, i) => <Badge key={`${label}-${i}`} variant="outline">{s}</Badge>)}
    </div>
  );
}
