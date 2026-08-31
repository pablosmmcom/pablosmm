import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, Download, Loader2, ShieldCheck, QrCode } from 'lucide-react';
import { toast } from 'sonner';

type PaymentPhase = 'idle' | 'utr-input';

interface UpiPaymentScreenProps {
  timeLeft: number;
  formattedAmount: string;
  rawAmount: string;
  upiId: string;
  requestId: number | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (utr?: string) => void;
}

const UpiPaymentScreen: React.FC<UpiPaymentScreenProps> = ({
  timeLeft,
  formattedAmount,
  rawAmount,
  upiId,
  requestId,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [phase, setPhase] = useState<PaymentPhase>('idle');
  const [utr, setUtr] = useState('');
  const [utrError, setUtrError] = useState('');

  const displayAmount = formattedAmount;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const copyUpiId = useCallback(() => {
    if (!upiId) return;

    const showSuccess = () => {
      setCopied(true);
      toast.success("UPI ID copied!");
      setTimeout(() => setCopied(false), 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(upiId).then(showSuccess).catch(() => fallbackCopy(upiId, showSuccess));
    } else {
      fallbackCopy(upiId, showSuccess);
    }
  }, [upiId]);

  const fallbackCopy = (text: string, onSuccess: () => void) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        onSuccess();
      } else {
        toast.error("Failed to copy UPI ID");
      }
    } catch (err) {
      toast.error("Failed to copy UPI ID");
    }
  };

  // Build standard UPI URI for QR code
  const getUpiLink = useCallback(() => {
    const amount = rawAmount;
    const pa = encodeURIComponent(upiId);
    const pn = encodeURIComponent("PabloSMM");
    const tn = encodeURIComponent(`Wallet_${requestId || 'Deposit'}`);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${amount}&cu=INR&tn=${tn}`;
  }, [upiId, rawAmount, requestId]);

  // Download / Save QR Code for Gallery Scan
  const handleDownloadQr = async () => {
    if (!upiId) return;
    setDownloading(true);
    try {
      const upiLink = getUpiLink();
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiLink)}&margin=10`;
      
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PabloSMM_QR_₹${rawAmount}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("QR code saved! Open any UPI app and scan from gallery.");
    } catch (e) {
      toast.info("Please take a screenshot of the QR code to scan from gallery.");
    } finally {
      setDownloading(false);
    }
  };

  const handleIHavePaid = useCallback(() => {
    setPhase('utr-input');
  }, []);

  const handleUtrSubmit = useCallback(() => {
    const trimmed = utr.trim();
    if (!trimmed) {
      setUtrError('Please enter your 12-digit UTR / Reference ID');
      return;
    }
    if (trimmed.length < 6) {
      setUtrError('Please enter a valid UTR / Transaction ID (min 6 digits)');
      return;
    }
    setUtrError('');
    onSubmit(trimmed);
  }, [utr, onSubmit]);

  return (
    <div className="upi-payment-screen">
      {/* Header */}
      <div className="upi-header">
        <button onClick={onClose} className="back-btn" aria-label="Back">
          <Image src="/payment-methods/upi/back.png" alt="Back" width={26} height={26} />
        </button>
      </div>

      <div className="upi-content">
        {/* Timer Badge */}
        <div className="upi-timer">
          Pay within {formatTime(timeLeft)}
        </div>

        {/* Amount */}
        <h3 className="upi-amount">
          ₹{displayAmount}
        </h3>
        <p className="upi-subtitle">Scan QR Code using any UPI App</p>

        {/* QR Code Container */}
        <div className="upi-qr-container">
          {upiId ? (() => {
            const upiLink = getUpiLink();
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiLink)}&margin=0`;
            return (
              <img
                src={qrUrl}
                alt="UPI QR Code"
                width={210}
                height={210}
                className="qr-image"
              />
            );
          })() : (
            <div className="qr-placeholder">
              QR CODE
            </div>
          )}

          {/* Save QR button */}
          <button 
            onClick={handleDownloadQr} 
            disabled={downloading}
            className="upi-save-qr-btn"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span>Save QR to Gallery</span>
          </button>
        </div>

        {/* 3-Step Instructions Card */}
        <div className="upi-instructions-card">
          <p className="instructions-title">
            <QrCode size={14} color="#3b82f6" />
            How to Pay via QR Code
          </p>
          <div className="instructions-list">
            <div className="step-item">
              <span className="step-num">1</span>
              <span>Tap <strong>Save QR to Gallery</strong> above (or take a screenshot).</span>
            </div>
            <div className="step-item">
              <span className="step-num">2</span>
              <span>Open <strong>PhonePe / GPay / Paytm</strong> ➔ Tap <strong>Scanner (📷)</strong> ➔ Upload from Gallery & Pay.</span>
            </div>
            <div className="step-item">
              <span className="step-num">3</span>
              <span>Copy the <strong>12-digit UTR / Ref No.</strong> and submit below.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Fixed Container */}
      <div className="upi-bottom-container">
        <p className="upi-tap-text">Step 2: Enter UTR after payment</p>

        <button
          onClick={handleIHavePaid}
          disabled={isSubmitting || phase !== 'idle'}
          className="upi-submit-btn"
        >
          {isSubmitting ? "Submitting..." : "I have paid — Enter UTR"}
        </button>
      </div>

      {/* ═══════ OVERLAY STATES ═══════ */}

      {/* Glass overlay */}
      {phase !== 'idle' && (
        <div className="upi-glass-overlay active" onClick={() => phase === 'utr-input' && !isSubmitting && setPhase('idle')} />
      )}

      {/* UTR Input Drawer */}
      {phase === 'utr-input' && (
        <div className="upi-drawer upi-drawer-utr">
          <div className="drawer-handle" />
          <div className="drawer-icon-warning" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <ShieldCheck size={28} color="#3b82f6" />
          </div>
          <h3 className="drawer-title">Enter Transaction UTR</h3>
          <p className="drawer-subtitle">Enter the 12-digit UTR / Reference number from your UPI payment receipt</p>
          
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 14px', width: '100%', marginBottom: '16px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: '#64748b' }}>Payable Amount:</span>
              <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{displayAmount}</span>
            </div>
          </div>

          <div className="utr-input-group">
            <input
              type="text"
              value={utr}
              onChange={(e) => { setUtr(e.target.value); setUtrError(''); }}
              placeholder="e.g. 423589123456"
              className="utr-input"
              maxLength={24}
              autoFocus
            />
            {utrError && <span className="utr-error">{utrError}</span>}
          </div>
          <button
            onClick={handleUtrSubmit}
            disabled={isSubmitting || !utr.trim()}
            className="utr-submit-btn"
            style={{ opacity: (!utr.trim() || isSubmitting) ? 0.6 : 1 }}
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Submit UTR for Verification'}
          </button>
          <button onClick={() => setPhase('idle')} disabled={isSubmitting} className="utr-cancel-btn">
            Go back to QR code
          </button>
        </div>
      )}
    </div>
  );
};

export default UpiPaymentScreen;
