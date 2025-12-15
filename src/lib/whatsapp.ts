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
  
  // Remove all non-numeric characters except + at the start
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove + sign if present (wa.me doesn't need it)
  cleaned = cleaned.replace(/^\+/, '');
  
  // Remove leading zeros (common in local formats)
  cleaned = cleaned.replace(/^0+/, '');
  
  // Basic validation - must have at least 7 digits
  if (cleaned.length < 7) return null;
  
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
  
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
