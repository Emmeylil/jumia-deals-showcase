import { z } from 'zod';

// ===========================================
// HELPER: Phone Number Validation (Supports UK & International / Nigeria)
// ===========================================
export const validatePhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');

  // UK formats
  if (digits.startsWith('44')) {
    return digits.length === 12 && (digits.startsWith('447') || digits.startsWith('441') || digits.startsWith('442'));
  } else if (digits.startsWith('0') && digits.length === 11) {
    return true;
  } else if (digits.startsWith('7') && digits.length === 10) {
    return true;
  }
  // Nigeria format (234...)
  if (digits.startsWith('234')) {
    return digits.length === 13;
  }
  // General standard phone number (10 to 15 digits)
  return digits.length >= 10 && digits.length <= 15;
};

export const validateUKPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('44')) {
    return digits.length === 12 && (digits.startsWith('447') || digits.startsWith('441') || digits.startsWith('442'));
  } else if (digits.startsWith('0')) {
    return digits.length === 11 && (digits.startsWith('07') || digits.startsWith('01') || digits.startsWith('02') || digits.startsWith('03'));
  } else if (digits.startsWith('7')) {
    return digits.length === 10;
  }

  return false;
};

// ===========================================
// NEWSLETTER / DEAL ALERTS SCHEMA
// ===========================================
export const newsletterSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(254, 'Email must be less than 254 characters')
    .toLowerCase(),
  category: z
    .string()
    .optional()
    .default('All'),
  phone: z
    .string()
    .max(20, 'Phone number must be less than 20 characters')
    .refine((val) => !val || validatePhone(val), 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  notifyOnFlashDeals: z
    .boolean()
    .default(true),
});

export type NewsletterData = z.infer<typeof newsletterSchema>;

// ===========================================
// BLACK FRIDAY DEAL ALERTS SCHEMA
// ===========================================
export const dealAlertsSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .optional()
    .or(z.literal('')),

  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(254, 'Email must be less than 254 characters')
    .toLowerCase(),

  phone: z
    .string()
    .max(20, 'Phone number must be less than 20 characters')
    .refine((val) => !val || validatePhone(val), 'Please enter a valid phone number (e.g. 08012345678 or +44 7900 123456)')
    .optional()
    .or(z.literal('')),

  category: z
    .string()
    .min(1, 'Please select a deal category'),

  agreedToAlerts: z
    .boolean()
    .refine((val) => val === true, 'You must agree to receive Black Friday deal alerts and accept terms'),
});

export type DealAlertsData = z.infer<typeof dealAlertsSchema>;

// ===========================================
// CONTACT / ENQUIRY FORM SCHEMA
// ===========================================
export const enquiryFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name can only contain letters, spaces, hyphens, apostrophes and dots'),

  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(254, 'Email must be less than 254 characters')
    .toLowerCase(),

  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(20, 'Phone number must be less than 20 characters')
    .refine(validatePhone, 'Please enter a valid phone number (e.g., 08012345678 or +44 7900 123456)'),

  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must be less than 2000 characters'),

  agreedToTerms: z
    .boolean()
    .refine((val) => val === true, 'You must agree to the terms and privacy policy'),
});

export type EnquiryFormData = z.infer<typeof enquiryFormSchema>;

// ===========================================
// BOOKING / DETAILED FORM SCHEMA
// ===========================================
export const bookingDetailsSchema = z.object({
  parentName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name can only contain letters, spaces, hyphens, apostrophes and dots'),

  parentEmail: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(254, 'Email must be less than 254 characters')
    .toLowerCase(),

  parentPhone: z
    .string()
    .max(20, 'Phone number must be less than 20 characters')
    .refine(
      (val) => !val || validatePhone(val),
      'Please enter a valid phone number'
    )
    .optional()
    .or(z.literal('')),

  school: z
    .string()
    .min(2, 'School name must be at least 2 characters')
    .max(200, 'School name must be less than 200 characters'),

  yearGroup: z
    .string()
    .min(1, 'Please select a year group'),

  subjects: z
    .array(z.string())
    .min(1, 'Please select at least one subject'),

  referralSource: z
    .string()
    .min(1, 'Please tell us how you heard about us'),

  comments: z
    .string()
    .max(2000, 'Comments must be less than 2000 characters')
    .optional()
    .or(z.literal('')),
});

export type BookingDetailsData = z.infer<typeof bookingDetailsSchema>;

// ===========================================
// HELPER: Get first validation error message
// ===========================================
export const getFirstError = (error: z.ZodError): string => {
  return error.issues[0]?.message || 'Validation failed';
};

// ===========================================
// HELPER: Get all validation errors as object
// ===========================================
export const getFieldErrors = (error: z.ZodError): Record<string, string> => {
  const errors: Record<string, string> = {};
  error.issues.forEach((err: z.ZodIssue) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });
  return errors;
};
