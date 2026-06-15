import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, ExternalLink, Linkedin, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface Person {
  id: string;
  name: string;
  title: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  company: {
    name: string | null;
    website_url: string | null;
    linkedin_url: string | null;
    industry: string | null;
    estimated_num_employees: number | null;
    city: string | null;
    country: string | null;
  };
}

interface SearchResult {
  people: Person[];
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];

export default function ProspectSearchPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    keywords: '',
    industry: '',
    employeeRange: '',
    revenueMin: '',
    revenueMax: '',
    country: '',
    city: '',
  });
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (newPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('apollo-search', {
        body: {
          ...filters,
          revenueMin: filters.revenueMin ? Number(filters.revenueMin) : undefined,
          revenueMax: filters.revenueMax ? Number(filters.revenueMax) : undefined,
          employeeRange: filters.employeeRange || undefined,
          page: newPage,
          perPage,
        },
      });
      if (invokeErr) throw new Error(invokeErr.message);
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setPage(newPage);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Search failed';
      setError(msg);
      toast({ title: 'Search failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(1);
  };

  const locationText = (p: Person) =>
    [p.city, p.state, p.country].filter(Boolean).join(', ') || '—';

  const totalPages = result?.total_pages ?? 1;

  return (
    <AppLayout title="Prospect Search" subtitle="Find companies and contacts via your connected Apollo account">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Search filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <Label htmlFor="keywords">Keywords</Label>
                <Input
                  id="keywords"
                  placeholder="e.g. VP Engineering, SaaS, fintech"
                  value={filters.keywords}
                  onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="e.g. Information Technology"
                  value={filters.industry}
                  onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="employees">Employee Count</Label>
                <Select
                  value={filters.employeeRange || 'any'}
                  onValueChange={(v) => setFilters({ ...filters, employeeRange: v === 'any' ? '' : v })}
                >
                  <SelectTrigger id="employees"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {EMPLOYEE_RANGES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Revenue (USD)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.revenueMin}
                    onChange={(e) => setFilters({ ...filters, revenueMin: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.revenueMax}
                    onChange={(e) => setFilters({ ...filters, revenueMax: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="e.g. United States"
                  value={filters.country}
                  onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="e.g. San Francisco"
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Search
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Results <Badge variant="secondary" className="ml-2">{result.total_entries.toLocaleString()}</Badge>
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Page {result.page} of {totalPages}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>LinkedIn</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.people.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No prospects found. Try adjusting your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      result.people.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.company.name ?? '—'}
                            {p.company.industry && (
                              <div className="text-xs text-muted-foreground">{p.company.industry}</div>
                            )}
                          </TableCell>
                          <TableCell>{p.name || '—'}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{p.title ?? '—'}</TableCell>
                          <TableCell>
                            {p.company.website_url ? (
                              <a href={p.company.website_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                                Visit <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {p.linkedin_url ? (
                              <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                                <Linkedin className="h-3 w-3" /> Profile
                              </a>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-sm">{locationText(p)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(result.page - 1) * result.per_page + 1}–
                  {Math.min(result.page * result.per_page, result.total_entries)} of {result.total_entries.toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={loading || result.page <= 1} onClick={() => runSearch(result.page - 1)}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={loading || result.page >= totalPages} onClick={() => runSearch(result.page + 1)}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
