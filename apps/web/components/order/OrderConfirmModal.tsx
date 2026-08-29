"use client";
import React, { useEffect, useState } from "react";
import ReactModal from "react-modal";
import Image from "next/image";
import { X, Info, AlertTriangle, ExternalLink } from "lucide-react";
import type { NormalizedSmmService } from "@/types/smm";

interface OrderConfirmModalProps {
  open: boolean;
  service: NormalizedSmmService | null;
  quantity: number;
  totalPrice: number;
  initialLink: string;
  onConfirm: (finalLink: string) => void;
  onCancel: () => void;
  ordering?: boolean;
}

export default function OrderConfirmModal({
  open,
  service,
  quantity,
  totalPrice,
  initialLink,
  onConfirm,
  onCancel,
  ordering = false,
}: OrderConfirmModalProps) {
  const [editableLink, setEditableLink] = useState(initialLink || "");

  // Sync state whenever modal opens or initialLink changes
  useEffect(() => {
    if (open) {
      setEditableLink(initialLink || "");
    }
  }, [open, initialLink]);

  useEffect(() => {
    try {
      const root = document.getElementById("__next") || document.body;
      ReactModal.setAppElement(root);
    } catch (e) {
      // ignore
    }
  }, []);

  if (!open || !service) return null;

  const description = (service.displayDescription || service.description || "").trim();

  // Extract or detect link guidance lines if available
  const lines = description ? description.split("\n") : [];
  const linkSpecificLines = lines.filter((l) => {
    const lower = l.toLowerCase();
    return (
      lower.includes("link:") ||
      lower.includes("link format:") ||
      lower.includes("url:") ||
      lower.includes("username:") ||
      lower.includes("example:") ||
      lower.includes("format:")
    );
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editableLink.trim()) return;
    onConfirm(editableLink.trim());
  };

  return (
    <ReactModal
      isOpen={open}
      onRequestClose={onCancel}
      overlayClassName="order-confirm-overlay"
      className="order-confirm-content"
      closeTimeoutMS={180}
    >
      <div role="dialog" aria-modal="true" className="order-confirm-inner">
        {/* Modal Header */}
        <div className="order-confirm-header">
          <div className="header-text">
            <span className="step-tag">CONFIRM ORDER</span>
            <h3 className="modal-title">Review & Verify Link</h3>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onCancel}
            aria-label="Close modal"
          >
            <X size={18} color="#fff" />
          </button>
        </div>

        {/* Service & Order Overview Card */}
        <div className="order-summary-card">
          <div className="service-info-row">
            <span className="platform-badge">
              {service.platform ? service.platform.toUpperCase() : "SMM"}
            </span>
            <h4 className="service-name">
              {service.displayName || service.providerName || "Selected Service"}
            </h4>
          </div>
          <div className="order-meta-grid">
            <div className="meta-box">
              <span className="meta-label">Quantity</span>
              <span className="meta-val">{quantity.toLocaleString()}</span>
            </div>
            <div className="meta-box highlight">
              <span className="meta-label">Total Amount</span>
              <span className="meta-val">₹{totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Service Description & Link Requirements */}
        {description && (
          <div className="description-section">
            <div className="desc-header">
              <Info size={14} color="#a890ff" />
              <span>Service Description & Link Rules</span>
            </div>
            {linkSpecificLines.length > 0 && (
              <div className="link-rule-highlight">
                <div className="rule-title">
                  <AlertTriangle size={13} color="#f59e0b" />
                  <span>Important Link Requirement</span>
                </div>
                {linkSpecificLines.map((line, idx) => (
                  <p key={idx} className="rule-text">
                    {line}
                  </p>
                ))}
              </div>
            )}
            <div className="desc-scroll-box">
              {lines.map((line, idx) => (
                <p key={idx}>{line || "\u00A0"}</p>
              ))}
            </div>
          </div>
        )}

        {/* Editable Target Link Input */}
        <form onSubmit={handleSubmit} className="link-form">
          <div className="input-group">
            <div className="label-row">
              <label htmlFor="target-link-input">Target Link / Username</label>
              <span className="label-hint">Edit if needed</span>
            </div>
            <div className="input-field">
              <Image
                src="/link.png"
                alt="Link Icon"
                width={20}
                height={20}
                className="link-icon"
              />
              <input
                id="target-link-input"
                type="text"
                placeholder="Enter post link, story link or username"
                value={editableLink}
                onChange={(e) => setEditableLink(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="warning-notice">
            <Image
              src="/circle.png"
              alt="Notice Icon"
              width={14}
              height={14}
            />
            <span>
              Please make sure your link format matches the service guidelines above.
            </span>
          </div>

          {/* Modal Actions */}
          <div className="modal-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn-cancel"
              disabled={ordering}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-confirm"
              disabled={ordering || !editableLink.trim()}
            >
              {ordering ? "Placing Order..." : "Confirm & Place Order"}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .order-confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 2, 3, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          padding: 16px;
        }

        .order-confirm-content {
          background: #0d0d10;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 24px 20px;
          width: 100%;
          max-width: 520px;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8),
            0 0 0 1px rgba(255, 255, 255, 0.05);
          outline: none;
          max-height: 90vh;
          overflow-y: auto;
        }

        .order-confirm-inner {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .order-confirm-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 12px;
        }

        .order-confirm-header .header-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .order-confirm-header .step-tag {
          font-family: GSB, sans-serif;
          font-size: 0.68rem;
          color: #a890ff;
          letter-spacing: 0.8px;
        }

        .order-confirm-header .modal-title {
          font-family: GB, sans-serif;
          font-size: 1.25rem;
          color: #ffffff;
          margin: 0;
        }

        .close-modal-btn {
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }

        .close-modal-btn:hover {
          background: rgba(255, 255, 255, 0.14);
          transform: scale(1.05);
        }

        .order-summary-card {
          background: #141418;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .service-info-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .platform-badge {
          font-family: GSB, sans-serif;
          font-size: 0.65rem;
          color: #a890ff;
          letter-spacing: 0.5px;
        }

        .service-name {
          font-family: GB, sans-serif;
          font-size: 0.98rem;
          color: #ffffff;
          margin: 0;
          line-height: 1.35;
        }

        .order-meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .meta-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .meta-box.highlight {
          background: rgba(168, 144, 255, 0.08);
          border-color: rgba(168, 144, 255, 0.2);
        }

        .meta-label {
          font-family: GM, sans-serif;
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.5);
        }

        .meta-val {
          font-family: GB, sans-serif;
          font-size: 1rem;
          color: #ffffff;
        }

        .meta-box.highlight .meta-val {
          color: #c4b5fd;
        }

        .description-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .desc-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: GSB, sans-serif;
          font-size: 0.78rem;
          color: #c4b5fd;
        }

        .link-rule-highlight {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rule-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: GSB, sans-serif;
          font-size: 0.78rem;
          color: #fbbf24;
        }

        .rule-text {
          font-family: GM, sans-serif;
          font-size: 0.8rem;
          color: #fef3c7;
          margin: 0;
          line-height: 1.4;
        }

        .desc-scroll-box {
          background: #09090b;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 10px 12px;
          max-height: 100px;
          overflow-y: auto;
          font-family: GM, sans-serif;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.65);
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .desc-scroll-box p {
          margin: 0 0 4px 0;
        }

        .link-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .label-row label {
          font-family: GSB, sans-serif;
          font-size: 0.88rem;
          color: #ffffff;
        }

        .label-hint {
          font-family: GM, sans-serif;
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.4);
        }

        .input-field {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-field .link-icon {
          position: absolute;
          left: 12px;
          width: 20px;
          height: 20px;
          display: block;
          pointer-events: none;
        }

        .input-field input {
          width: 100%;
          padding: 12px 12px 12px 40px;
          background: #09090b;
          border: 1px solid #333333;
          border-radius: 12px;
          font-family: GM, sans-serif;
          font-size: 0.95rem;
          color: #ffffff;
          box-shadow: inset 0px 3px 6px rgba(0, 0, 0, 0.6);
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .input-field input:focus {
          outline: none;
          border-color: #a890ff;
          box-shadow: 0 0 10px rgba(168, 144, 255, 0.35);
        }

        .input-field input::placeholder {
          color: #666666;
        }

        .warning-notice {
          background: #141418;
          border: 1px solid #222226;
          border-radius: 40px;
          padding: 6px 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          width: fit-content;
        }

        .warning-notice span {
          font-family: GM, sans-serif;
          font-size: 0.68rem;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.1;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 4px;
        }

        .btn-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          border-radius: 10px;
          padding: 0 18px;
          height: 42px;
          font-family: GSB, sans-serif;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }

        .btn-cancel:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .btn-confirm {
          color: rgba(0, 0, 0, 0.9);
          cursor: pointer;
          background-image: url(/bg.png);
          background-position: center;
          background-repeat: no-repeat;
          background-size: cover;
          border: none;
          border-radius: 10px;
          padding: 0 22px;
          height: 42px;
          font-family: GB, sans-serif;
          font-size: 0.95rem;
          letter-spacing: -0.2px;
          transition: opacity 0.2s, transform 0.1s;
        }

        .btn-confirm:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
        }

        .btn-confirm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </ReactModal>
  );
}
