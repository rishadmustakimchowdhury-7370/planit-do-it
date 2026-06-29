// Live promo validation — calls validate-promo edge function with debounce.
// Pricing comes entirely from the server (validate_promo_code RPC). No frontend math.
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Tag, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface PromoValidationResult {
  valid: boolean;
  reason?: string;
  message?: string;
  code?: string;
  promo_id?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  stripe_promotion_code_id?: string | null;
  stripe_coupon_id?: string | null;
  currency?: string;
  original_amount?: number;
  discount_amount?: number;
  final_amount?: number;
}

interface Props {
  planId: string | null;
  interval: 'monthly' | 'yearly' | 'trial';
  onChange?: (result: PromoValidationResult | null) => void;
}

export function PromoCodeInput({ planId, interval, onChange }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PromoValidationResult | null>(null);
  const debounceRef = useRef<number | null>(null);

  const validate = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) { setResult(null); onChange?.(null); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-promo', {
        body: { code: trimmed, planId, interval },
      });
      const res: PromoValidationResult = error
        ? { valid: false, reason: 'network_error', message: error.message ?? 'Validation failed.' }
        : (data as PromoValidationResult);
      setResult(res);
      onChange?.(res.valid ? res : null);
    } finally {
      setLoading(false);
    }
  };

  // Debounced live validation while typing
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!code.trim()) { setResult(null); onChange?.(null); return; }
    debounceRef.current = window.setTimeout(() => { validate(code); }, 450);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, planId, interval]);

  const clear = () => { setCode(''); setResult(null); onChange?.(null); };

  const fmt = (n: number | undefined, cur = result?.currency ?? 'USD') =>
    typeof n === 'number'
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n)
      : '';

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Promo Code</label>
      <div className="flex gap-2">
        <Input
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="font-mono"
          aria-invalid={result ? !result.valid : undefined}
        />
        {code && (
          <Button variant="ghost" size="icon" onClick={clear} aria-label="Clear promo code">
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" onClick={() => validate(code)} disabled={!code.trim() || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
        </Button>
      </div>

      {result && !result.valid && (
        <div className="flex items-start gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{result.message ?? 'This promo code is not valid.'}</span>
        </div>
      )}

      {result && result.valid && (
        <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 text-success font-medium">
            <CheckCircle2 className="h-4 w-4" />
            <Tag className="h-3.5 w-3.5" />
            <span>{result.code}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {result.discount_type === 'percentage' ? `${result.discount_value}% off` : `${fmt(result.discount_value)} off`}
            </span>
          </div>
          {typeof result.original_amount === 'number' && (
            <dl className="grid grid-cols-2 gap-y-0.5 text-xs">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-right tabular-nums">{fmt(result.original_amount)}</dd>
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="text-right tabular-nums text-success">−{fmt(result.discount_amount)}</dd>
              <dt className="font-medium">New total</dt>
              <dd className="text-right font-semibold tabular-nums">{fmt(result.final_amount)}</dd>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
