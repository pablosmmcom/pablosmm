"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { PhoneInput } from '@/components/ui/phone-input';
import { toast } from 'sonner';
import { Loader2, X, MessageSquare, Bell, ShieldCheck, Gift } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/config';

export default function WhatsAppPromptModal() {
  const { user, loading, refreshUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Only check when user is loaded and logged in
    if (!loading && user) {
      const isMobileMissing = !user.mobile || user.mobile.trim() === '';
      const isDismissed = sessionStorage.getItem('whatsapp_prompt_dismissed');

      if (isMobileMissing && !isDismissed) {
        // Short delay for smooth entrance after page loads
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [user, loading]);

  const handleClose = () => {
    sessionStorage.setItem('whatsapp_prompt_dismissed', 'true');
    setIsOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error('Please enter a valid WhatsApp phone number with country code');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name || '',
          mobile: cleanPhone,
          currency: user.currency || 'INR',
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save WhatsApp number');
      }

      toast.success('WhatsApp number connected successfully! 🎉');
      await refreshUser();
      setIsOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="whatsapp-modal-overlay" onClick={handleClose}>
      <div className="whatsapp-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button 
          onClick={handleClose} 
          className="whatsapp-modal-close"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* WhatsApp Icon with Pulse Effect */}
        <div className="whatsapp-icon-wrapper">
          <div className="whatsapp-icon-circle">
            <MessageSquare size={28} color="#22c55e" />
          </div>
        </div>

        {/* Header */}
        <h3 className="whatsapp-modal-title">Connect your WhatsApp</h3>
        <p className="whatsapp-modal-subtitle">
          Add your WhatsApp number for instant order status alerts, priority VIP support, and exclusive deals.
        </p>

        {/* Benefits List */}
        <div className="whatsapp-benefits">
          <div className="benefit-item">
            <Bell size={15} className="benefit-icon" />
            <span>Real-time order delivery updates</span>
          </div>
          <div className="benefit-item">
            <ShieldCheck size={15} className="benefit-icon" />
            <span>Direct 1-on-1 priority support</span>
          </div>
          <div className="benefit-item">
            <Gift size={15} className="benefit-icon" />
            <span>Special promo codes & balance bonuses</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="whatsapp-modal-form">
          <div className="phone-input-wrapper">
            <label className="phone-label">WhatsApp Number</label>
            <PhoneInput 
              value={phone}
              onChange={(val) => setPhone(val || '')}
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !phone.trim()}
            className="whatsapp-submit-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save & Continue</span>
            )}
          </button>
        </form>

        <button 
          type="button" 
          onClick={handleClose} 
          className="whatsapp-skip-btn"
          disabled={isSubmitting}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
