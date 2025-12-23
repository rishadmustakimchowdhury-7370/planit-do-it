/**
 * WhatsApp utility functions for phone number formatting and deep link generation
 * Uses wa.me deep linking - no API or tokens required
 */

/**
 * Formats a phone number for WhatsApp deep links
 * - Removes all non-numeric characters (spaces, dashes, parentheses, +)
 * - Handles local formats and adds country code where needed
 * 
 * IMPORTANT: Country code is mandatory for WhatsApp deep links
 */
export function formatWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const raw = String(phone).trim();
  
  // Remove all non-numeric characters
  let cleaned = raw.replace(/\D/g, '');

  // Handle common local formats - add country code if missing
  // Bangladesh: 01XXXXXXXXX -> 8801XXXXXXXXX
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    cleaned = '880' + cleaned.substring(1);
  }
  // India: 0XXXXXXXXXX -> 91XXXXXXXXXX (10-digit after 0)
  else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '91' + cleaned.substring(1);
  }
  // Remove leading zeros for other cases
  else {
    cleaned = cleaned.replace(/^0+/, '');
  }

  // Must have at least 10 digits (country code + number)
  if (cleaned.length < 10) return null;

  return cleaned;
}

/**
 * Generates a WhatsApp deep link URL
 * Uses wa.me which redirects to web.whatsapp.com on desktop or the app on mobile
 * 
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
 * Opens WhatsApp chat - simply returns the URL for use in an anchor tag
 * This is the most reliable way to open WhatsApp across all browsers/environments
 * 
 * If the number is not on WhatsApp, WhatsApp will show its native error screen
 * 
 * @param phone - Phone number with country code
 * @param message - Optional pre-filled message
 * @returns The WhatsApp URL if valid, null if phone is invalid
 */
export function openWhatsAppChat(phone: string | null | undefined, message?: string): string | null {
  return getWhatsAppUrl(phone, message);
}
