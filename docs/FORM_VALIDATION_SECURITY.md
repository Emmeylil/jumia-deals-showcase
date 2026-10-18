# Form Validation & Security Guide

A comprehensive template for implementing form validation and security in React and Next.js applications.

## Overview

This guide covers a defence-in-depth approach to form security:

1. **Frontend Validation** - Zod schemas for real-time validation
2. **XSS Sanitization** - Strip malicious content before submission
3. **API Validation** - Server-side re-validation (never trust the client)
4. **CORS Configuration** - Restrict allowed origins

## Dependencies

```bash
npm install zod xss
```

## 1. Frontend Validation (Zod Schemas)

Located in `src/lib/validation.ts`:

- `validatePhone` & `validateUKPhone`: Phone number validation helpers
- `enquiryFormSchema`: Name, email, phone, message, agreedToTerms
- `newsletterSchema`: Email, category, phone, notifyOnFlashDeals
- `dealAlertsSchema`: Name, email, phone, category, agreedToAlerts
- `bookingDetailsSchema`: Detailed multi-field schema with arrays and optional fields
- `getFirstError` & `getFieldErrors`: Utility helpers mapping Zod issues into user-friendly error objects

## 2. XSS Sanitization

Located in `src/lib/sanitize.ts`:

- `sanitize(input)`: Strips HTML tags, script, style tags via `xss`
- `sanitizeObject(obj)`: Recursively sanitizes object properties and string arrays
- `sanitizeEmail(email)`: Trims and forces lowercase
- `sanitizePhone(phone)`: Strips disallowed characters and trims

## 3. Implementation Example in Project

The Black Friday Deal Alerts Modal in `src/components/DealAlertsModal.tsx` demonstrates this architecture:
- Real-time field validation on `onChange` and `onBlur`
- XSS sanitization before storing or transmitting form payload
- Disabling submit buttons during processing to prevent replay attacks
- Displaying clear field-level validation messages
