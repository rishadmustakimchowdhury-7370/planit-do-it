CREATE OR REPLACE FUNCTION public.normalize_candidate_linkedin_url(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
  slug text;
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  s := btrim(raw);
  IF s = '' OR lower(s) IN ('undefined', 'null', '#', 'javascript:void(0)', 'javascript:;') OR lower(s) LIKE 'javascript:%' THEN
    RETURN NULL;
  END IF;

  s := regexp_replace(s, '^\[(https?://[^\]]+)\]\([^)]*\)$', '\1', 'i');
  s := regexp_replace(s, '^\[([^\]]+)\]\([^)]*\)$', '\1', 'i');
  s := regexp_replace(s, '^//', 'https://', 'i');
  s := regexp_replace(s, '^linkedin\.com/', 'https://www.linkedin.com/', 'i');
  s := regexp_replace(s, '^www\.linkedin\.com/', 'https://www.linkedin.com/', 'i');
  s := regexp_replace(s, '^[a-z]{2}\.linkedin\.com/', 'https://www.linkedin.com/', 'i');
  s := regexp_replace(s, '^https?://([a-z]{2}\.)?linkedin\.com/', 'https://www.linkedin.com/', 'i');
  s := regexp_replace(s, '^https?://([a-z]{2}\.)?www\.linkedin\.com/', 'https://www.linkedin.com/', 'i');

  IF s ~* '^/in/[^/?#[:space:]]+/?' THEN
    s := 'https://www.linkedin.com' || s;
  END IF;

  slug := substring(s from '^https://www\.linkedin\.com/in/([^/?#[:space:]]+)/?');
  IF slug IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN 'https://www.linkedin.com/in/' || slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.clean_candidate_contact_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := nullif(btrim(NEW.email), '');
  IF NEW.email IS NOT NULL AND NEW.email ~* 'no-email\.local$' THEN
    NEW.email := NULL;
  END IF;

  NEW.linkedin_url := public.normalize_candidate_linkedin_url(NEW.linkedin_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clean_candidate_contact_fields_trigger ON public.candidates;
CREATE TRIGGER clean_candidate_contact_fields_trigger
BEFORE INSERT OR UPDATE OF email, linkedin_url ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.clean_candidate_contact_fields();

ALTER TABLE public.candidates
DROP CONSTRAINT IF EXISTS candidates_linkedin_url_profile_url_chk;

ALTER TABLE public.candidates
ADD CONSTRAINT candidates_linkedin_url_profile_url_chk
CHECK (
  linkedin_url IS NULL
  OR linkedin_url ~* '^https://(www\.)?linkedin\.com/in/[^/?#[:space:]]+/?$'
);