// Translate raw provider/API errors into recruiter-friendly messages.

export function friendlyDiscoveryError(raw: string | null | undefined, status?: number): string {
  if (!raw && !status) return 'Unknown error';
  const text = (raw ?? '').toLowerCase();

  if (status === 401 || /unauthor|invalid api key|api[_ ]?key/.test(text))
    return 'API key is invalid or expired. Update your key in Settings.';
  if (status === 402 || /payment required|insufficient credit|out of credit|no credits|credit.*exhaust/.test(text))
    return 'Credits exhausted. Please top up or upgrade your plan.';
  if (status === 403 || /forbidden|not supported on your current plan|plan does not/.test(text))
    return 'Your current plan does not support this feature.';
  if (status === 429 || /rate limit|too many requests/.test(text))
    return 'Rate limit reached. Please wait a moment and try again.';
  if (status && status >= 500) return 'Provider is temporarily unavailable. Please try again shortly.';
  if (/network|fetch failed|timeout|econnreset/.test(text))
    return 'Network issue reaching the provider. Please retry.';
  if (/at least one filter|empty/.test(text))
    return 'Search returned no usable filters. Try broadening your criteria.';

  // Fallback: short, recruiter-readable version of raw
  return raw && raw.length > 160 ? raw.slice(0, 160) + '…' : (raw ?? `Error ${status ?? ''}`.trim());
}
