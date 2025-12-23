/**
 * WhatsApp utility functions for phone number formatting and deep link generation
 */

/**
 * Formats a phone number for WhatsApp deep links
 * - Removes all non-numeric characters (spaces, dashes, parentheses)
 * - Removes leading zeros
 * - Adds country code if missing (defaults to no prefix, assumes international format)
 */
export function formatWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const raw = String(phone).trim();
  const hadPlus = raw.startsWith('+');
  const hadLeadingZero = raw.startsWith('0');

  // Remove all non-numeric characters except + at the start
  let cleaned = raw.replace(/[\D]/g, '');

  // Remove leading zeros (common in local formats)
  cleaned = cleaned.replace(/^0+/, '');

  // If user typed a local Bangladeshi mobile like 01XXXXXXXXX, WhatsApp requires country code 880
  // Example: 01926323910 -> 8801926323910
  if (!hadPlus && hadLeadingZero && cleaned.length === 10 && /^1[3-9]\d{8}$/.test(cleaned)) {
    cleaned = `880${cleaned}`;
  }

  // Basic validation - must have at least 10 digits for wa.me in most cases
  if (cleaned.length < 10) return null;

  return cleaned;
}

/**
 * Generates a WhatsApp deep link URL
 * @param phone - Phone number (will be cleaned and formatted)
 * @param message - Optional pre-filled message
 * @returns WhatsApp URL or null if phone is invalid
 */
export function getWhatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  const formattedNumber = formatWhatsAppNumber(phone);
  if (!formattedNumber) return null;
  
  let url = `https://wa.me/${formattedNumber}`;
  
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  
  return url;
}

/**
 * Opens WhatsApp chat in a new tab
 * @param phone - Phone number
 * @param message - Optional pre-filled message
 * @returns true if successful, false if phone is invalid
 */
export function openWhatsAppChat(phone: string | null | undefined, message?: string): boolean {
  const url = getWhatsAppUrl(phone, message);
  if (!url) return false;

  // Prefer a new tab, but fall back to same-tab navigation if popups are blocked.
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    window.location.assign(url);
  }
  return true;
}
