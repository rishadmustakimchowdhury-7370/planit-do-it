import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PromoCodeInput, PromoValidationResult } from '@/components/billing/PromoCodeInput';
import { Badge } from '@/components/ui/badge';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : '';
}

export function PromoTab() {
  const sub = useSubscriptionStatus();
  const { tenantId } = useAuth();
  const [result, setResult] = useState<PromoValidationResult | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [applied, setApplied] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!tenantId) return;
      const { data: t, error: tenantError } = await supabase.from('tenants').select('subscription_plan_id').eq('id', tenantId).maybeSingle();
      if (tenantError) console.error('[PromoTab] tenants query failed', tenantError);
      setPlanId((t as any)?.subscription_plan_id ?? null);
      const { data: usage, error: usageError } = await supabase
        .from('promo_code_usage')
        .select('id, used_at, promo_codes(code, discount_type, discount_value, expires_at)')
        .eq('tenant_id', tenantId)
        .order('used_at', { ascending: false })
        .limit(20);
      if (usageError) console.error('[PromoTab] promo_code_usage query failed', usageError);
      setApplied(Array.isArray(usage) ? (usage as any) : []);
    })();
  }, [tenantId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Apply a Promo Code</CardTitle>
          <CardDescription>Promo codes apply to your next renewal. All pricing is computed by the server.</CardDescription>
        </CardHeader>
        <CardContent>
          <PromoCodeInput
            planId={planId}
            interval={sub.inTrial ? 'trial' : 'monthly'}
            onChange={setResult}
          />
          {result?.valid && (
            <div className="mt-3 text-sm text-success">
              You'll save ${((result.discount_amount ?? 0) / 100).toFixed(2)} on the next renewal.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promo History</CardTitle>
          <CardDescription>Promo codes you have used on this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {applied.length === 0 && <div className="text-sm text-muted-foreground">No promo codes applied yet.</div>}
          <ul className="divide-y">
            {applied.map((row) => {
              const promo = row.promo_codes;
              return (
                <li key={row.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{promo?.code ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {promo?.discount_type === 'percentage'
                        ? `${promo.discount_value}% off`
                        : `$${(promo?.discount_value ?? 0)} off`}
                      {promo?.expires_at && ` · expires ${formatDate(promo.expires_at)}`}
                    </div>
                  </div>
                  <Badge variant="outline">{formatDate(row?.used_at) || '—'}</Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
