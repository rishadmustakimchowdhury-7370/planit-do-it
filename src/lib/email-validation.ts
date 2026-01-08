// List of known disposable email domains to block
const DISPOSABLE_EMAIL_DOMAINS = [
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'tempmail.net',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'throwaway.email',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'fakeinbox.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'dispostable.com',
  'mailnesia.com',
  'maildrop.cc',
  'getnada.com',
  'sharklasers.com',
  'spam4.me',
  'grr.la',
  'getairmail.com',
  'mohmal.com',
  'discard.email',
  'spambox.us',
  'mytemp.email',
  'tmpmail.org',
  'tmpmail.net',
  'fake-box.com',
  'emailondeck.com',
  'inboxkitten.com',
  'mintemail.com',
  'burnermail.io',
  'temp.email',
  'tempinbox.com',
  'tempr.email',
  'emailna.co',
  'crazymailing.com',
  'mailcatch.com',
  'mail-temp.com',
  'dropmail.me',
  'harakirimail.com',
  'jetable.org',
  'mailforspam.com',
  'spamgourmet.com',
  'emailsensei.com',
  'receiveee.com',
  'mailsac.com',
  'generator.email',
  'fakemailgenerator.com',
  'tempmailaddress.com',
  'tempmailo.com',
  'emailfake.com',
];

/**
 * Check if an email domain is a disposable/temporary email provider
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return false;
  
  return DISPOSABLE_EMAIL_DOMAINS.some(d => 
    domain === d || domain.endsWith('.' + d)
  );
}

/**
 * Validate that an email is from a legitimate provider (not disposable)
 */
export function validateEmailDomain(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  if (isDisposableEmail(email)) {
    return { 
      valid: false, 
      error: 'Temporary/disposable email addresses are not allowed. Please use a permanent email.' 
    };
  }
  
  return { valid: true };
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): { 
  valid: boolean; 
  error?: string;
  strength: 'weak' | 'medium' | 'strong';
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
} {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
  
  const passedChecks = Object.values(checks).filter(Boolean).length;
  
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (passedChecks >= 5) strength = 'strong';
  else if (passedChecks >= 3) strength = 'medium';
  
  const errors: string[] = [];
  if (!checks.length) errors.push('at least 8 characters');
  if (!checks.uppercase) errors.push('one uppercase letter');
  if (!checks.lowercase) errors.push('one lowercase letter');
  if (!checks.number) errors.push('one number');
  if (!checks.special) errors.push('one special character');
  
  const valid = passedChecks >= 4 && checks.length; // Require length + 3 other checks
  
  return {
    valid,
    error: errors.length > 0 
      ? `Password must contain ${errors.join(', ')}` 
      : undefined,
    strength,
    checks,
  };
}
