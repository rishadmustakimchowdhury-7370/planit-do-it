import { z } from 'zod';

/**
 * Input validation utilities for security
 * All user inputs should be validated before processing
 */

// Email validation
export const emailSchema = z
  .string()
  .trim()
  .email({ message: 'Invalid email address' })
  .max(255, { message: 'Email must be less than 255 characters' });

// Name validation (prevents XSS and injection)
export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: 'Name is required' })
  .max(100, { message: 'Name must be less than 100 characters' })
  .regex(/^[a-zA-Z\s\-'\.]+$/, { message: 'Name contains invalid characters' });

// General text input (for notes, descriptions)
export const textSchema = z
  .string()
  .trim()
  .max(5000, { message: 'Text must be less than 5000 characters' });

// Phone number validation
export const phoneSchema = z
  .string()
  .trim()
  .max(30, { message: 'Phone number must be less than 30 characters' })
  .regex(/^[\d\s\-\+\(\)\.]*$/, { message: 'Invalid phone number format' })
  .optional()
  .or(z.literal(''));

// URL validation
export const urlSchema = z
  .string()
  .trim()
  .url({ message: 'Invalid URL' })
  .max(2048, { message: 'URL must be less than 2048 characters' })
  .optional()
  .or(z.literal(''));

// Subject line validation (for emails)
export const subjectSchema = z
  .string()
  .trim()
  .min(1, { message: 'Subject is required' })
  .max(200, { message: 'Subject must be less than 200 characters' });

// Email body validation
export const emailBodySchema = z
  .string()
  .trim()
  .min(1, { message: 'Email body is required' })
  .max(50000, { message: 'Email body is too long' });

// UUID validation
export const uuidSchema = z
  .string()
  .uuid({ message: 'Invalid ID format' });

// Search query validation
export const searchQuerySchema = z
  .string()
  .trim()
  .max(500, { message: 'Search query is too long' })
  .transform(val => val.replace(/[<>\"\']/g, '')); // Remove potential XSS characters

// Contact form validation
export const contactFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  message: z
    .string()
    .trim()
    .min(10, { message: 'Message must be at least 10 characters' })
    .max(2000, { message: 'Message must be less than 2000 characters' }),
  phone: phoneSchema,
});

// Candidate form validation
export const candidateFormSchema = z.object({
  full_name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  current_title: z.string().trim().max(200).optional(),
  current_company: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  linkedin_url: urlSchema,
  notes: textSchema.optional(),
});

// Job form validation
export const jobFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Job title is required' })
    .max(200, { message: 'Job title must be less than 200 characters' }),
  description: textSchema.optional(),
  location: z.string().trim().max(200).optional(),
  salary_min: z.number().min(0).optional().nullable(),
  salary_max: z.number().min(0).optional().nullable(),
});

// Client form validation
export const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Company name is required' })
    .max(200, { message: 'Company name must be less than 200 characters' }),
  contact_name: nameSchema.optional(),
  contact_email: emailSchema.optional().or(z.literal('')),
  contact_phone: phoneSchema,
  website: urlSchema,
  industry: z.string().trim().max(100).optional(),
  notes: textSchema.optional(),
});

// Email send form validation
export const sendEmailSchema = z.object({
  to_email: emailSchema,
  cc_email: z.string().trim().max(500).optional(),
  bcc_email: z.string().trim().max(500).optional(),
  subject: subjectSchema,
  body: emailBodySchema,
});

// Sanitize HTML content (strips all tags)
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Encode for URL parameters
export function encodeForUrl(str: string): string {
  return encodeURIComponent(str || '');
}

// Validate and sanitize search input
export function sanitizeSearchInput(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .slice(0, 500) // Max length
    .replace(/[<>\"\'\\]/g, ''); // Remove dangerous characters
}

// Rate limiting helper (for client-side)
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const requests: number[] = [];
  
  return function checkLimit(): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Remove old requests
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }
    
    if (requests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    requests.push(now);
    return true;
  };
}

// Validate file upload
export function validateFileUpload(file: File, options: {
  maxSize?: number;
  allowedTypes?: string[];
} = {}): { valid: boolean; error?: string } {
  const { 
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
    ]
  } = options;

  if (file.size > maxSize) {
    return { valid: false, error: `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)` };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  // Check for suspicious file names
  const suspiciousPatterns = /[<>:\"\/\\|?*\x00-\x1f]/;
  if (suspiciousPatterns.test(file.name)) {
    return { valid: false, error: 'Invalid file name' };
  }

  return { valid: true };
}

// Type exports for use in components
export type ContactFormData = z.infer<typeof contactFormSchema>;
export type CandidateFormData = z.infer<typeof candidateFormSchema>;
export type JobFormData = z.infer<typeof jobFormSchema>;
export type ClientFormData = z.infer<typeof clientFormSchema>;
export type SendEmailData = z.infer<typeof sendEmailSchema>;
