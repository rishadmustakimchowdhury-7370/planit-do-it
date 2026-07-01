// Hooks for the Billing Center. Keep one file to limit churn.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface StripeInvoice {
  id: string;
  number: string | null;
  status: string | null;
  created: number;
  period_start: number;
  period_end: number;
  currency: string;
  subtotal: number;
  tax: number | null;
  total: number;
  amount_paid: number;
  amount_due: number;
  discount_amount: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  payment_intent: string | null;
}

export function useStripeInvoices() {
  const [data, setData] = useState<StripeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('stripe-list-invoices');
      if (error) {
        console.error('[useStripeInvoices] stripe-list-invoices failed', error);
        throw error;
      }
      const invoices = (res as any)?.invoices;
      setData(Array.isArray(invoices) ? invoices : []);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load invoices');
      setData([]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { invoices: data, loading, error, refresh };
}

export interface StripePaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export function useStripePaymentMethod() {
  const [pm, setPm] = useState<StripePaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment-method');
      if (error) {
        console.error('[useStripePaymentMethod] stripe-payment-method failed', error);
        throw error;
      }
      setPm((data as any)?.payment_method ?? null);
    } catch (e) {
      console.warn('[useStripePaymentMethod]', e);
      setPm(null);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { paymentMethod: pm, loading, refresh };
}

export interface TimelineEntry {
  id: string; action: string; entity_type: string | null; entity_id: string | null;
  metadata: any; created_at: string; actor: string | null;
}

export function useBillingTimeline() {
  const { tenantId } = useAuth();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!tenantId) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_billing_timeline', {
        p_tenant_id: tenantId, p_limit: 100, p_offset: 0,
      });
      if (error) {
        console.error('[useBillingTimeline] get_billing_timeline failed', error);
        setEntries([]);
        return;
      }
      setEntries(Array.isArray(data) ? (data as any) : []);
    } catch (e) {
      console.warn('[useBillingTimeline]', e);
      setEntries([]);
    } finally { setLoading(false); }
  }, [tenantId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { entries, loading, refresh };
}

export interface BillingNotification {
  id: string; type: string; title: string; message: string;
  link: string | null; is_read: boolean; metadata: any; created_at: string;
}

export function useBillingNotifications() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<BillingNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!tenantId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_billing_notifications', {
        p_tenant_id: tenantId, p_limit: 50,
      });
      if (error) {
        console.error('[useBillingNotifications] get_billing_notifications failed', error);
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? (data as any) : []);
    } catch (e) {
      console.warn('[useBillingNotifications]', e);
      setItems([]);
    } finally { setLoading(false); }
  }, [tenantId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { items, loading, refresh };
}

export interface TenantBillingDetails {
  tenant_id: string;
  company_name: string | null;
  billing_email: string | null;
  vat_number: string | null;
  tax_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  currency: string | null;
  timezone: string | null;
}

export function useTenantBillingDetails() {
  const { tenantId } = useAuth();
  const [data, setData] = useState<TenantBillingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!tenantId) { setData(null); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: row, error } = await supabase
        .from('tenant_billing_details').select('*').eq('tenant_id', tenantId).limit(1);
      if (error) console.error('[useTenantBillingDetails] tenant_billing_details query failed', error);
      setData(((row as any[])?.[0] as any) ?? { tenant_id: tenantId, currency: 'USD', timezone: 'UTC' } as any);
    } catch (e) {
      console.warn('[useTenantBillingDetails]', e);
      setData({ tenant_id: tenantId, currency: 'USD', timezone: 'UTC' } as any);
    } finally { setLoading(false); }
  }, [tenantId]);
  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback(async (patch: Partial<TenantBillingDetails>) => {
    if (!tenantId) return;
    const payload = { tenant_id: tenantId, ...data, ...patch };
    const { error } = await supabase.from('tenant_billing_details').upsert(payload as any, { onConflict: 'tenant_id' });
    if (error) throw error;
    await refresh();
  }, [tenantId, data, refresh]);

  return { details: data, loading, refresh, save };
}
