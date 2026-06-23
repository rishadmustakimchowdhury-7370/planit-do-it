
-- ========= P1: Lock down user_roles INSERT (privilege escalation) =========
-- Drop any existing permissive insert policy if present (no-op if absent)
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated can insert user roles" ON public.user_roles;

-- Only tenant owners may add roles in their tenant.
-- Self-assignment is blocked; super_admin cannot be minted via this policy.
CREATE POLICY "Owners can add tenant roles (no self, no super_admin)"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id <> auth.uid()
  AND role <> 'super_admin'::app_role
  AND public.is_owner_in_tenant(auth.uid(), tenant_id)
);

-- ========= P2: finance_settings hardening =========
-- Block client SELECT of sensitive bank columns. Non-sensitive columns still readable
-- via existing owner/manager RLS policy.
REVOKE SELECT (bank_account_name, bank_account_number, bank_sort_code, bank_iban, bank_swift)
  ON public.finance_settings FROM authenticated;
REVOKE UPDATE (bank_account_name, bank_account_number, bank_sort_code, bank_iban, bank_swift)
  ON public.finance_settings FROM authenticated;
REVOKE INSERT (bank_account_name, bank_account_number, bank_sort_code, bank_iban, bank_swift)
  ON public.finance_settings FROM authenticated;

-- Owner-only RPC: reveal full bank details
CREATE OR REPLACE FUNCTION public.get_finance_bank_details(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.finance_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT public.is_owner_in_tenant(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'forbidden: owner role required';
  END IF;
  SELECT * INTO _row FROM public.finance_settings WHERE tenant_id = _tenant_id;
  RETURN jsonb_build_object(
    'bank_name', _row.bank_name,
    'bank_account_name', _row.bank_account_name,
    'bank_account_number', _row.bank_account_number,
    'bank_sort_code', _row.bank_sort_code,
    'bank_iban', _row.bank_iban,
    'bank_swift', _row.bank_swift
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_finance_bank_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_bank_details(uuid) TO authenticated;

-- Owner+Manager RPC: snapshot bank details into a new invoice. Returns full JSON
-- to be embedded in invoices.bank_details. Managers never see this data in UI.
CREATE OR REPLACE FUNCTION public.snapshot_invoice_bank_details(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.finance_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT public.is_owner_or_manager_in_tenant(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO _row FROM public.finance_settings WHERE tenant_id = _tenant_id;
  RETURN jsonb_build_object(
    'bank_name', _row.bank_name,
    'bank_account_name', _row.bank_account_name,
    'bank_account_number', _row.bank_account_number,
    'bank_sort_code', _row.bank_sort_code,
    'bank_iban', _row.bank_iban,
    'bank_swift', _row.bank_swift
  );
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_invoice_bank_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_invoice_bank_details(uuid) TO authenticated;

-- Owner-only RPC: upsert bank details (write path that bypasses revoked column grants)
CREATE OR REPLACE FUNCTION public.upsert_finance_bank_details(
  _tenant_id uuid,
  _bank_name text,
  _bank_account_name text,
  _bank_account_number text,
  _bank_sort_code text,
  _bank_iban text,
  _bank_swift text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT public.is_owner_in_tenant(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'forbidden: owner role required';
  END IF;
  INSERT INTO public.finance_settings (tenant_id, bank_name, bank_account_name, bank_account_number, bank_sort_code, bank_iban, bank_swift)
  VALUES (_tenant_id, _bank_name, _bank_account_name, _bank_account_number, _bank_sort_code, _bank_iban, _bank_swift)
  ON CONFLICT (tenant_id) DO UPDATE
    SET bank_name = EXCLUDED.bank_name,
        bank_account_name = EXCLUDED.bank_account_name,
        bank_account_number = EXCLUDED.bank_account_number,
        bank_sort_code = EXCLUDED.bank_sort_code,
        bank_iban = EXCLUDED.bank_iban,
        bank_swift = EXCLUDED.bank_swift,
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_finance_bank_details(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_finance_bank_details(uuid, text, text, text, text, text, text) TO authenticated;

-- ========= P3: whatsapp_settings — remove secrets from DB =========
ALTER TABLE public.whatsapp_settings DROP COLUMN IF EXISTS api_key;
ALTER TABLE public.whatsapp_settings DROP COLUMN IF EXISTS api_secret;
