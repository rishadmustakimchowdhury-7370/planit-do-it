/**
 * Environment-Aware Base URL Utility
 * 
 * This module provides a centralized way to get the application base URL
 * that works correctly in both Lovable preview and production environments.
 * 
 * Configuration:
 * - Set APP_URL secret in Supabase to your production domain (e.g., https://hiremetrics.co.uk)
 * - For Lovable preview, it will use the fallback URL
 * 
 * Usage:
 * import { getAppBaseUrl, getDashboardUrl, getAdminUrl } from "../_shared/app-url.ts";
 * 
 * const baseUrl = getAppBaseUrl();
 * const dashboardLink = getDashboardUrl();
 */

// Default fallback URL - used when APP_URL is not set
const DEFAULT_APP_URL = "https://hiremetrics.co.uk";

/**
 * Get the base application URL from environment
 * Prioritizes APP_URL env var, falls back to production URL
 */
export function getAppBaseUrl(): string {
  const appUrl = Deno.env.get("APP_URL");
  
  // Log for debugging in production
  if (!appUrl) {
    console.log("[APP-URL] APP_URL not set, using default:", DEFAULT_APP_URL);
  }
  
  return appUrl || DEFAULT_APP_URL;
}

/**
 * Get the dashboard URL
 */
export function getDashboardUrl(): string {
  return `${getAppBaseUrl()}/dashboard`;
}

/**
 * Get the auth/login URL
 */
export function getAuthUrl(): string {
  return `${getAppBaseUrl()}/auth`;
}

/**
 * Get the admin panel URL
 */
export function getAdminUrl(path: string = ""): string {
  return `${getAppBaseUrl()}/admin${path ? `/${path}` : ""}`;
}

/**
 * Get the team management URL
 */
export function getTeamUrl(): string {
  return `${getAppBaseUrl()}/team`;
}

/**
 * Get the invitation acceptance URL with token
 */
export function getInviteAcceptUrl(token: string): string {
  return `${getAppBaseUrl()}/accept-invitation?token=${token}`;
}

/**
 * Get the billing page URL
 */
export function getBillingUrl(): string {
  return `${getAppBaseUrl()}/billing`;
}

/**
 * Build a full URL for a given path
 */
export function buildAppUrl(path: string): string {
  const base = getAppBaseUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
