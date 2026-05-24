import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface ClientBrand {
  name: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

const cache: Record<string, ClientBrand> = {};

/**
 * Loads white-label branding (logo + primary color) for the current
 * client portal user's organization. Returns null while loading.
 */
export function useClientOrgBranding(): ClientBrand | null {
  const { clientPortal } = useAuth();
  const orgId = clientPortal?.client_org_id;
  const [brand, setBrand] = useState<ClientBrand | null>(orgId ? cache[orgId] || null : null);

  useEffect(() => {
    if (!orgId) return;
    if (cache[orgId]) { setBrand(cache[orgId]); return; }
    supabase
      .from('client_organizations')
      .select('name, logo_url, primary_color')
      .eq('id', orgId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          cache[orgId] = data as ClientBrand;
          setBrand(data as ClientBrand);
        }
      });
  }, [orgId]);

  return brand;
}

/**
 * Convert hex (#rrggbb) to HSL string suitable for `hsl(var(--x))`.
 * Returns null on bad input.
 */
export function hexToHslVar(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
