import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, Download, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useCreditTransactions, CREDIT_COSTS } from '@/hooks/useCredits';
import { format } from 'date-fns';
import { RoleGate } from '@/components/auth/RoleGate';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

const ACTION_LABELS: Record<string, string> = {
  ai_match: 'AI Match',
  cv_parse: 'CV Parse',
  email_compose: 'Email Compose',
  brand_cv: 'Brand CV',
  purchase: 'Credit Purchase',
  refund: 'Refund',
  admin_adjustment: 'Admin Adjustment',
};

export default function CreditsLedgerPage() {
  const { transactions, isLoading, refreshTransactions } = useCreditTransactions();
  const [profiles, setProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchProfiles = async () => {
      const userIds = [...new Set(transactions.map(t => t.user_id))];
      if (userIds.length === 0) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      if (data) {
        const profileMap = data.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);
        setProfiles(profileMap);
      }
    };

    if (transactions.length > 0) {
      fetchProfiles();
    }
  }, [transactions]);

  const exportCSV = () => {
    const csv = [
      ['Date', 'Time', 'User', 'Action', 'Cost', 'Before', 'After', 'Metadata'].join(','),
      ...transactions.map(t => [
        format(new Date(t.created_at), 'yyyy-MM-dd'),
        format(new Date(t.created_at), 'HH:mm:ss'),
        profiles[t.user_id]?.full_name || profiles[t.user_id]?.email || 'Unknown',
        ACTION_LABELS[t.action_type] || t.action_type,
        t.cost,
        t.balance_before,
        t.balance_after,
        `"${JSON.stringify(t.metadata).replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credits-ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <RoleGate allowedRoles={['owner']} redirectTo="/dashboard">
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Coins className="h-8 w-8 text-warning" />
              Credits Ledger
            </h1>
            <p className="text-muted-foreground">Complete transaction history for your workspace</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={refreshTransactions} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={exportCSV} variant="outline" size="sm" disabled={transactions.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Credits Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {transactions.filter(t => t.cost > 0).reduce((sum, t) => sum + t.cost, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Credits Added</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {Math.abs(transactions.filter(t => t.cost < 0).reduce((sum, t) => sum + t.cost, 0))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Immutable audit log of all credit transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    const profile = profiles[transaction.user_id];
                    const isCredit = transaction.cost < 0;
                    
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          <div className="text-sm">
                            {format(new Date(transaction.created_at), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(transaction.created_at), 'HH:mm:ss')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={profile?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {profile?.full_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                              <div>{profile?.full_name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{profile?.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ACTION_LABELS[transaction.action_type] || transaction.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`flex items-center justify-end gap-1 ${isCredit ? 'text-success' : 'text-destructive'}`}>
                            {isCredit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            <span className="font-mono font-medium">
                              {isCredit ? '+' : '-'}{Math.abs(transaction.cost)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm">{transaction.balance_before}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm font-medium">{transaction.balance_after}</span>
                        </TableCell>
                        <TableCell>
                          {Object.keys(transaction.metadata || {}).length > 0 && (
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {JSON.stringify(transaction.metadata, null, 0).slice(0, 50)}...
                            </code>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Credit Costs Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credit Costs</CardTitle>
            <CardDescription>Current costs for AI-powered features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(CREDIT_COSTS).map(([action, cost]) => (
                <div key={action} className="bg-muted/50 rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">{ACTION_LABELS[action]}</div>
                  <div className="text-lg font-bold">{cost} credits</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
