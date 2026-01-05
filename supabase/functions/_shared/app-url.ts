/**
 * Environment-Aware Base URL Utility
 *
 * Rules (enterprise-safe):
 * - Never emit relative URLs for emails.
 * - Never hardcode preview URLs.
 * - Resolve base URL in this priority order:
 *   1) APP_BASE_URL (recommended)
 *   2) APP_URL (legacy)
 *   3) Request host (Origin / X-Forwarded-Host / Host)
 * - If none available, THROW (fail fast).
 */

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function resolveBaseUrlFromRequest(req: Request): string {
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      // fall through
    }
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }

  throw new Error("[APP-URL] Unable to resolve base URL from request headers");
}

/**
 * Get the base application URL.
 *
 * IMPORTANT: When generating email links, pass the current Request so we can
 * auto-detect the correct environment (Lovable preview vs production).
 */
export function getAppBaseUrl(req?: Request): string {
  const envUrl = Deno.env.get("APP_BASE_URL") || Deno.env.get("APP_URL");
  if (envUrl) return normalizeBaseUrl(envUrl);

  if (req) return normalizeBaseUrl(resolveBaseUrlFromRequest(req));

  throw new Error(
    "[APP-URL] APP_BASE_URL/APP_URL not set and no Request provided; cannot build absolute URLs"
  );
}

export function getDashboardUrl(req?: Request): string {
  return `${getAppBaseUrl(req)}/dashboard`;
}

export function getAuthUrl(req?: Request): string {
  return `${getAppBaseUrl(req)}/auth`;
}

export function getAdminUrl(path: string = "", req?: Request): string {
  return `${getAppBaseUrl(req)}/admin${path ? `/${path}` : ""}`;
}

export function getTeamUrl(req?: Request): string {
  return `${getAppBaseUrl(req)}/team`;
}

export function getInviteAcceptUrl(token: string, req?: Request): string {
  return `${getAppBaseUrl(req)}/accept-invitation?token=${token}`;
}

export function getBillingUrl(req?: Request): string {
  return `${getAppBaseUrl(req)}/billing`;
}

export function buildAppUrl(path: string, req?: Request): string {
  const base = getAppBaseUrl(req);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

