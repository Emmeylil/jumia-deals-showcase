import React, { useState } from 'react';
import { Bell, Flame, CheckCircle2, X, ShieldCheck, Mail, Phone, User, Tag, Sparkles } from 'lucide-react';
import { dealAlertsSchema, type DealAlertsData, getFieldErrors } from '@/lib/validation';
import { sanitize, sanitizeEmail, sanitizePhone } from '@/lib/sanitize';
import { PRODUCT_CATEGORIES } from '@/lib/constants';

interface DealAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DealAlertsModal: React.FC<DealAlertsModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState<DealAlertsData>({
    name: '',
    email: '',
    phone: '',
    category: 'All Categories',
    agreedToAlerts: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  // Real-time field validation
  const validateField = (field: keyof DealAlertsData, value: unknown) => {
    const fieldSchema = dealAlertsSchema.shape[field];
    const result = fieldSchema.safeParse(value);

    if (!result.success) {
      setErrors((prev) => ({
        ...prev,
        [field]: result.error.issues[0]?.message || 'Invalid value',
      }));
    } else {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const newValue =
      type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setFormData((prev) => ({ ...prev, [name]: newValue }));
    validateField(name as keyof DealAlertsData, newValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 1. Zod SafeParse Validation
    const validationResult = dealAlertsSchema.safeParse(formData);

    if (!validationResult.success) {
      const fieldErrors = getFieldErrors(validationResult.error);
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    // 2. XSS Input Sanitization
    const sanitizedData = {
      name: sanitize(validationResult.data.name || ''),
      email: sanitizeEmail(validationResult.data.email),
      phone: sanitizePhone(validationResult.data.phone || ''),
      category: sanitize(validationResult.data.category),
      agreedToAlerts: validationResult.data.agreedToAlerts,
      subscribedAt: new Date().toISOString(),
    };

    try {
      // Simulate API submission / persist to localStorage
      await new Promise((resolve) => setTimeout(resolve, 800));

      const existingSubs = JSON.parse(
        localStorage.getItem('jumia_deal_alerts') || '[]'
      );
      existingSubs.push(sanitizedData);
      localStorage.setItem('jumia_deal_alerts', JSON.stringify(existingSubs));

      setIsSuccess(true);
      setErrors({});
    } catch (err) {
      console.error('Subscription error:', err);
      setErrors({ form: 'Failed to subscribe. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setFormData({
      name: '',
      email: '',
      phone: '',
      category: 'All Categories',
      agreedToAlerts: true,
    });
    setErrors({});
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleResetAndClose}
    >
      <div
        className="relative w-full max-w-lg bg-gradient-to-b from-[#1b0b2e] via-[#0d0418] to-[#05010a] border border-[#FF550C]/30 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(255,85,12,0.25)] text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing Ambient Corner */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF550C]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#3B2079]/30 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all cursor-pointer z-10"
          aria-label="Close deal alerts modal"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-[#FF550C] to-[#FFA000] p-1 flex items-center justify-center shadow-lg shadow-[#FF550C]/30 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>

            <h3 className="text-2xl font-black text-white tracking-tight">
              You're on the VIP Deal List! ⚡
            </h3>

            <p className="text-sm text-gray-300 max-w-sm mx-auto leading-relaxed">
              We'll send exclusive <span className="text-[#FF550C] font-bold">Black Friday</span> midnight doorbusters and flash deal drops to{' '}
              <span className="text-white font-semibold underline decoration-[#FF550C]">{formData.email}</span>.
            </p>

            <div className="pt-4">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full py-3 px-6 rounded-full font-bold bg-gradient-to-r from-[#FF550C] to-[#bE1d3e] hover:brightness-110 active:scale-95 text-white shadow-lg transition-all cursor-pointer"
              >
                Back to Catalog Deals
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#FF550C] to-[#bE1d3e] text-white shadow-md shadow-[#FF550C]/30">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-widest uppercase bg-[#FF550C]/20 border border-[#FF550C]/40 text-[#FFA000] px-2 py-0.5 rounded-full">
                    Black Friday VIP
                  </span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Sanitized & Secured
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-white mt-0.5">
                  Flash Deal Drop Alerts
                </h2>
              </div>
            </div>

            <p className="text-xs md:text-sm text-gray-300 mb-6 leading-relaxed">
              Never miss up to <span className="text-[#FF550C] font-bold">70% OFF</span> doorbusters. Enter your details below for instant price drop alerts.
            </p>

            {errors.form && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs">
                {errors.form}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email (Required) */}
              <div>
                <label htmlFor="deal-email" className="block text-xs font-bold text-gray-300 mb-1">
                  Email Address <span className="text-[#FF550C]">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    id="deal-email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g. shopper@jumia.com.ng"
                    className={`w-full pl-10 pr-4 py-2.5 bg-white/5 border rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF550C] transition-all ${
                      errors.email ? 'border-red-500 bg-red-500/5' : 'border-white/15 focus:border-[#FF550C]'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1 font-medium">{errors.email}</p>
                )}
              </div>

              {/* Full Name (Optional) */}
              <div>
                <label htmlFor="deal-name" className="block text-xs font-bold text-gray-300 mb-1">
                  First Name <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    id="deal-name"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleChange}
                    placeholder="e.g. Alex"
                    className={`w-full pl-10 pr-4 py-2.5 bg-white/5 border rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF550C] transition-all ${
                      errors.name ? 'border-red-500 bg-red-500/5' : 'border-white/15 focus:border-[#FF550C]'
                    }`}
                  />
                </div>
                {errors.name && (
                  <p className="text-red-400 text-xs mt-1 font-medium">{errors.name}</p>
                )}
              </div>

              {/* Phone (Optional for SMS Flash Alerts) */}
              <div>
                <label htmlFor="deal-phone" className="block text-xs font-bold text-gray-300 mb-1">
                  Phone for SMS Flash Drops <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="tel"
                    id="deal-phone"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    placeholder="e.g. 08012345678 or +44 7900 123456"
                    className={`w-full pl-10 pr-4 py-2.5 bg-white/5 border rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF550C] transition-all ${
                      errors.phone ? 'border-red-500 bg-red-500/5' : 'border-white/15 focus:border-[#FF550C]'
                    }`}
                  />
                </div>
                {errors.phone && (
                  <p className="text-red-400 text-xs mt-1 font-medium">{errors.phone}</p>
                )}
              </div>

              {/* Category Dropdown */}
              <div>
                <label htmlFor="deal-category" className="block text-xs font-bold text-gray-300 mb-1">
                  Preferred Category Alert
                </label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    id="deal-category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#170a27] border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF550C] cursor-pointer"
                  >
                    <option value="All Categories">All Categories (Best Deals)</option>
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div>
                <label className="flex items-start gap-2.5 text-xs text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="agreedToAlerts"
                    checked={formData.agreedToAlerts}
                    onChange={handleChange}
                    className="mt-0.5 rounded border-white/20 bg-white/10 text-[#FF550C] focus:ring-[#FF550C] cursor-pointer"
                  />
                  <span>
                    I agree to receive Black Friday deal alerts and accept the privacy terms.
                  </span>
                </label>
                {errors.agreedToAlerts && (
                  <p className="text-red-400 text-xs mt-1 font-medium">{errors.agreedToAlerts}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-submit-deal-alerts"
                disabled={isSubmitting}
                className="w-full py-3 px-6 mt-2 rounded-xl font-bold bg-gradient-to-r from-[#FF550C] to-[#bE1d3e] hover:brightness-110 active:scale-[0.98] text-white shadow-lg shadow-[#FF550C]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Securing VIP Access...</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    <span>Get Black Friday Deal Alerts</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default DealAlertsModal;
