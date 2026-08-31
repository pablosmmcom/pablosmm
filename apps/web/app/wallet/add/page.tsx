"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getApiBaseUrl } from "@/lib/config";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Clock, CheckCircle, Copy, Check } from "lucide-react";
import PaymentBottomDrawer from "@/components/ui/PaymentBottomDrawer";
import UpiPaymentScreen from "@/components/ui/UpiPaymentScreen";

export default function WalletAddPage() {
  const { user, loading, currencySymbol } = useAuth();
  const router = useRouter();

  // Steps: 'amount' | 'method' | 'pay' | 'success'
  const [step, setStep] = useState<'amount' | 'method' | 'pay' | 'success'>('amount');
  const [rawAmount, setRawAmount] = useState<string>("");
  const [method, setMethod] = useState<'UPI' | 'USDT' | null>(null);
  const [utr, setUtr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UPI Auto-verify: unique amount and UPI ID returned by backend
  const [upiId, setUpiId] = useState<string>("");
  const [requestId, setRequestId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoVerified, setAutoVerified] = useState(false);

  // Timer for QR Page
  const [timeLeft, setTimeLeft] = useState(540); // 30 sec
  useEffect(() => {
    if (step === 'pay' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);



  const formattedAmount = useMemo(() => {
    if (!rawAmount) return "";
    const n = Number(rawAmount);
    return new Intl.NumberFormat("en-IN").format(n);
  }, [rawAmount]);



  const handleKeyPress = (d: string) => {
    if (rawAmount.length >= 7) return;
    if (rawAmount === "0") return setRawAmount(d);
    setRawAmount((s) => (s || "") + d);
  };

  const handleBackspace = () => setRawAmount((s) => s.slice(0, -1));

  const handleMethodSelect = async (selectedMethod: 'UPI' | 'USDT') => {
    setMethod(selectedMethod);

    if (selectedMethod === 'UPI') {
      // Create deposit request and get unique amount from backend
      setIsSubmitting(true);
      try {
        const res = await fetch(`${getApiBaseUrl()}/wallet/deposit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(rawAmount),
            method: "UPI",
            transaction_id: "" // UTR comes later or from auto-verify
          }),
          credentials: "include"
        });

        if (!res.ok) {
          const text = await res.text();
          let msg = "Failed to create deposit request";
          try { const j = JSON.parse(text); msg = j.error || msg; } catch { msg = text || msg; }
          throw new Error(msg);
        }

        const data = await res.json();
        if (data.upi_id) setUpiId(data.upi_id);
        if (data.request_id) setRequestId(data.request_id);

        setStep('pay');
        setTimeLeft(540); // Reset timer
      } catch (error: any) {
        console.error(error);
        toast.error(error.message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setStep('pay');
    }
  };

  const [submittedUtr, setSubmittedUtr] = useState("");

  const submitDeposit = async (utrFromChild?: string) => {
    if (!method || !rawAmount) return;
    const transactionId = utrFromChild || utr || "Paid";
    setSubmittedUtr(transactionId);
    setIsSubmitting(true);
    try {
      let res: Response;

      if (method === 'UPI' && requestId) {
        // UPI: update existing request with UTR (don't create a duplicate)
        res = await fetch(`${getApiBaseUrl()}/wallet/deposit/utr`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_id: requestId,
            transaction_id: transactionId
          }),
          credentials: "include"
        });
      } else {
        // USDT or fallback: create new deposit request
        res = await fetch(`${getApiBaseUrl()}/wallet/deposit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(rawAmount),
            method: method,
            transaction_id: transactionId
          }),
          credentials: "include"
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Submission failed");
      }

      const data = await res.json();
      
      setStep('success');
      toast.success("Deposit request submitted for review!");
      setTimeout(() => router.push('/wallet?r=' + Date.now()), 3000);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyUpiId = useCallback(() => {
    if (upiId) {
      navigator.clipboard.writeText(upiId);
      setCopied(true);
      toast.success("UPI ID copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [upiId]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) return null;

  return (
    <div className="wallet-add-page">
      {/* Header / Close */}
      {step === 'amount' ? (
        <Link href="/wallet" className="close-btn" aria-label="Close">×</Link>
      ) : (
        <button onClick={() => setStep(step === 'pay' ? 'method' : 'amount')}
          className="close-btn" style={{ fontSize: '1rem', width: 'auto', padding: '0 8px', border: 'none' }}>
          <ArrowLeft size={24} />
        </button>
      )}

      {/* STEP 1: AMOUNT */}
      {step === 'amount' && (
        <>
          <div className="header">
            <div className="avatar">
              <img
                src={user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || "User"}`}
                alt="User"
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            </div>
            <h2 className="title">{user?.name?.split(' ')[0]}&apos;s Wallet</h2>
            <p className="subtitle">ADD MONEY TO WALLET</p>
          </div>

          <div className="amount-display">
            <span className="rupee">{currencySymbol}</span>
            <span className="amount">{formattedAmount || "0"}</span>
            <span className={`caret ${rawAmount ? "show" : ""}`} />
          </div>

          <button
            className="proceed"
            disabled={!rawAmount || Number(rawAmount) <= 0}
            onClick={() => setStep('method')}
          >
            Proceed to add money <span className="arrow">→</span>
          </button>

          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k, i) =>
              k === "." ? (
                <div key={i} className="key spacer" />
              ) : k === "⌫" ? (
                <button key={i} className="key erase" onClick={handleBackspace} aria-label="Backspace">⌫</button>
              ) : (
                <button key={i} className="key" onClick={() => handleKeyPress(k)}>{k}</button>
              )
            )}
          </div>
        </>
      )}

      {/* STEP 2: METHOD SELECTION */}
      {step === 'method' && (
        <PaymentBottomDrawer 
          onPay={handleMethodSelect} 
          isSubmitting={isSubmitting} 
          onClose={() => setStep('amount')} 
        />
      )}

      {/* STEP 3: PAY (UPI) */}
      {step === 'pay' && method === 'UPI' && (
        <UpiPaymentScreen
          timeLeft={timeLeft}
          formattedAmount={formattedAmount}
          rawAmount={rawAmount}
          upiId={upiId}
          requestId={requestId}
          isSubmitting={isSubmitting}
          onClose={() => setStep('method')}
          onSubmit={submitDeposit}
        />
      )}

      {/* STEP 3b: PAY (USDT) */}
      {step === 'pay' && method === 'USDT' && (
        <div className="step-container" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
          <button onClick={() => setStep('method')} style={{ position: 'absolute', top: '16px', left: '16px', background: 'none', border: 'none', color: '#888' }}><ArrowLeft size={24} /></button>

          <div style={{ textAlign: 'center', marginTop: '40px', marginBottom: '24px' }}>
            <p style={{ textTransform: 'uppercase', fontSize: '0.7rem', color: '#888', letterSpacing: '1px' }}>Total Payable</p>
            <h3 style={{ fontSize: '2.5rem', fontFamily: 'GB', margin: '4px 0' }}>{currencySymbol}{formattedAmount}</h3>
            <p style={{ fontSize: '0.8rem', color: '#eab308' }}>1 USD ≈ {currencySymbol}92</p>
          </div>

          <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '24px' }}>
            <div style={{ width: '200px', height: '200px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '0.8rem', textAlign: 'center' }}>
              QR CODE FOR<br />USDT
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#eab308', background: 'rgba(234, 179, 8, 0.1)', padding: '8px 16px', borderRadius: '20px', marginBottom: '32px', fontFamily: 'GB' }}>
            <Clock size={16} />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Transaction ID / UTR</label>
              <input
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="Enter 12-digit UTR"
                style={{ width: '100%', background: '#222', border: '1px solid #333', borderRadius: '12px', padding: '14px', color: '#fff', fontSize: '1rem', outline: 'none', textAlign: 'center' }}
              />
            </div>

            <button
              onClick={() => submitDeposit()}
              disabled={!utr || isSubmitting}
              style={{ width: '100%', background: '#3b82f6', color: '#fff', height: '56px', borderRadius: '12px', border: 'none', fontFamily: 'GB', fontSize: '1rem', cursor: 'pointer', opacity: (!utr || isSubmitting) ? 0.5 : 1 }}
            >
              {isSubmitting ? "Submitting..." : "Submit Payment"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: SUCCESS */}
      {step === 'success' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: 'rgba(34, 197, 94, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <CheckCircle className="text-green-500" size={40} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontFamily: 'GB', marginBottom: '8px', color: '#fff' }}>
            Request Submitted!
          </h2>
          <p style={{ color: '#aaa', maxWidth: '300px', marginBottom: '8px', lineHeight: '1.5', fontSize: '0.9rem' }}>
            Your deposit request of <strong style={{ color: '#fff' }}>{currencySymbol}{formattedAmount}</strong> has been submitted.
          </p>
          {submittedUtr && (
            <p style={{ color: '#777', fontSize: '0.78rem', fontFamily: 'monospace', marginBottom: '24px', background: '#111', padding: '6px 14px', borderRadius: '8px', border: '1px solid #222' }}>
              UTR: {submittedUtr}
            </p>
          )}
          <p style={{ color: '#888', fontSize: '0.82rem', maxWidth: '280px', marginBottom: '32px' }}>
            Your wallet balance will be credited shortly after admin verification.
          </p>
          <Link href="/wallet" style={{ background: '#222', border: '1px solid #333', color: '#fff', padding: '14px 32px', borderRadius: '100px', textDecoration: 'none', fontFamily: 'GB', fontSize: '0.95rem' }}>
            Back to Wallet
          </Link>
        </div>
      )}
    </div>
  );
}