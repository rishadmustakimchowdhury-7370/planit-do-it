import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Download, ExternalLink, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useStripeInvoices, StripeInvoice } from '@/hooks/useBillingCenter';

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency?.toUpperCase() || 'USD' })
    .format((amount ?? 0) / 100);
}

const statusVariant = (s: string | null) => ({
  paid: 'default', open: 'secondary', uncollectible: 'destructive',
  draft: 'outline', void: 'outline',
} as Record<string, any>)[s ?? ''] ?? 'outline';

export function InvoicesTab() {
  const { invoices, loading, error, refresh } = useStripeInvoices();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<StripeInvoice | null>(null);
  const pageSize = 15;

  const filtered = useMemo(() => invoices.filter(i => {
    const s = search.toLowerCase();
    const okSearch = !s || (i.number?.toLowerCase().includes(s) ?? false);
    const okStatus = status === 'all' || i.status === status;
    return okSearch && okStatus;
  }), [invoices, search, status]);

  const paged = filtered.slice(page * pageSize, page * pageSize + pageSize);

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by invoice number..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="void">Void</SelectItem>
              <SelectItem value="uncollectible">Uncollectible</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refresh}>Refresh</Button>
        </CardContent>
      </Card>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No invoices yet.</TableCell></TableRow>
              )}
              {paged.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer" onClick={() => setOpen(inv)}>
                  <TableCell className="font-medium">{inv.number ?? inv.id}</TableCell>
                  <TableCell>{format(new Date(inv.created * 1000), 'PP')}</TableCell>
                  <TableCell>{money(inv.total, inv.currency)}</TableCell>
                  <TableCell>{inv.discount_amount ? money(inv.discount_amount, inv.currency) : '—'}</TableCell>
                  <TableCell>{inv.tax ? money(inv.tax, inv.currency) : '—'}</TableCell>
                  <TableCell><Badge variant={statusVariant(inv.status)}>{inv.status}</Badge></TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {inv.invoice_pdf && (
                        <Button asChild variant="ghost" size="icon"><a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a></Button>
                      )}
                      {inv.hosted_invoice_url && (
                        <Button asChild variant="ghost" size="icon"><a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.ceil(filtered.length / pageSize)}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {open && (
            <>
              <SheetHeader><SheetTitle>Invoice {open.number ?? open.id}</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-xs uppercase text-muted-foreground">Status</div><Badge variant={statusVariant(open.status)}>{open.status}</Badge></div>
                  <div><div className="text-xs uppercase text-muted-foreground">Issued</div>{format(new Date(open.created * 1000), 'PPP')}</div>
                  <div><div className="text-xs uppercase text-muted-foreground">Period Start</div>{format(new Date(open.period_start * 1000), 'PP')}</div>
                  <div><div className="text-xs uppercase text-muted-foreground">Period End</div>{format(new Date(open.period_end * 1000), 'PP')}</div>
                </div>
                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(open.subtotal, open.currency)}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>-{money(open.discount_amount, open.currency)}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span>{money(open.tax ?? 0, open.currency)}</span></div>
                  <div className="flex justify-between font-semibold text-base pt-2 border-t"><span>Total</span><span>{money(open.total, open.currency)}</span></div>
                  <div className="flex justify-between"><span>Paid</span><span>{money(open.amount_paid, open.currency)}</span></div>
                </div>
                <div className="flex gap-2 pt-2">
                  {open.invoice_pdf && <Button asChild className="flex-1"><a href={open.invoice_pdf} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /> Download PDF</a></Button>}
                  {open.hosted_invoice_url && <Button asChild variant="outline" className="flex-1"><a href={open.hosted_invoice_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> View in Stripe</a></Button>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
