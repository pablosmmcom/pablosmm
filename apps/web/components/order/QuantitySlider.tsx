"use client";
import React, { useRef, useMemo, useState, useEffect } from "react";
import { useCurrency } from "@/components/layout/CurrencyProvider";
import { lightImpact, selectionTick, isMobileDevice } from "@/lib/haptics";
import Image from "next/image";

interface QuantitySliderProps {
  min?: number;
  max?: number;
  pricePerUnit?: number;
  onChange?: (quantity: number) => void;
  // Optional category filter UI just below sliderInfo
  activeCategory?: 'recommended' | 'cheapest' | 'premium';
  onCategoryChange?: (c: 'recommended' | 'cheapest' | 'premium') => void;
  onModeChange?: (mode: 'qty' | 'amount') => void;
  onBudgetChange?: (budgetUsd: number) => void;
  onOrder?: () => Promise<void> | void;
  ordering?: boolean;
  orderStatus?: string | null;
  // Comment props
  comments?: string[];
  setComments?: (c: string[]) => void;
  showComments?: boolean;
  // Custom Input props (e.g. Story poll vote answer)
  customInputRequired?: boolean;
  customInputLabel?: string;
  customInput?: string;
  setCustomInput?: (val: string) => void;
  value?: number;
  mode?: 'qty' | 'amount';
}

import CommentInput from "./CommentInput";

const QuantitySlider: React.FC<QuantitySliderProps> = ({
  min = 50,
  max = 50000,
  pricePerUnit = 0.3,
  onChange,
  activeCategory,
  onCategoryChange,
  onModeChange,
  onBudgetChange,
  onOrder,
  ordering,
  orderStatus,
  comments = [],
  setComments,
  showComments = false,
  customInputRequired = false,
  customInputLabel = "",
  customInput = "",
  setCustomInput,
  value,
  mode: modeProp
}) => {
  const { formatMoneyDirect, formatMoneyDirectCompact, convert, currency, usdToInr, convertToUsd } = useCurrency();
  const [internalQuantity, setInternalQuantity] = useState<number>(1000);
  
  const quantity = value !== undefined ? value : internalQuantity;
  const setQuantity = (v: number) => {
    if (value === undefined) {
      setInternalQuantity(v);
    }
  };

  const [fillPercentage, setFillPercentage] = useState<number>(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingValue, setEditingValue] = useState<string>("");
  const [internalMode, setInternalMode] = useState<'qty' | 'amount'>("qty");
  const mode = modeProp !== undefined ? modeProp : internalMode;
  const [budgetEditing, setBudgetEditing] = useState<boolean>(false);
  const [budgetValue, setBudgetValue] = useState<string>("");

  const lastPulseRef = useRef<number>(0);
  const PULSE_COOLDOWN = 40; // ms

  const isMobile = useMemo(() => isMobileDevice(), []);

  // Choose a dynamic step based on the current value (or min if not set yet)
  const stepFor = (v: number) => {
    if (v < 100) return 10;
    if (v < 1000) return 50;
    if (v < 10000) return 100;
    if (v < 100000) return 500;
    return 1000;
  };

  const snapToStep = (v: number) => {
    const step = stepFor(v);
    const snapped = Math.round((v - min) / step) * step + min;
    return Math.max(min, Math.min(max, snapped));
  };

  const formatCompact = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
    return n.toLocaleString();
  };

  const triggerFeedback = () => {
    if (!isMobile) return;
    const now = Date.now();
    if (now - lastPulseRef.current < PULSE_COOLDOWN) return;
    lastPulseRef.current = now;
    selectionTick();
  };

  useEffect(() => {
    const range = max - min;
    const pct = range <= 0 ? 100 : ((quantity - min) / range) * 100;
    setFillPercentage(Math.max(0, Math.min(100, pct)));
  }, [quantity, min, max]);

  // When service (min/max) changes, clamp or reset the quantity to keep in range
  const prevRange = useRef<{ min: number; max: number }>({ min, max });
  useEffect(() => {
    const changed = prevRange.current.min !== min || prevRange.current.max !== max;
    if (changed) {
      // Prefer resetting to min if current is out of new range; else keep snapped value
      const clamped = Math.max(min, Math.min(max, quantity));
      const snapped = snapToStep(clamped);
      setQuantity(snapped);
      if (!isEditing) setEditingValue(String(snapped));
      prevRange.current = { min, max };
    }
  }, [min, max]);

  useEffect(() => {
    if (!isEditing) setEditingValue(String(quantity));
  }, [quantity, isEditing]);

  const totalPriceInr = quantity * pricePerUnit; // pricePerUnit is provided in INR per unit

  // Keep budget input in sync with quantity when not editing budget
  useEffect(() => {
    if (mode === 'amount' && !budgetEditing) {
      const activeAmt = convert(totalPriceInr);
      const formattedAmt = currency === 'INR' ? Math.round(activeAmt) : parseFloat(activeAmt.toFixed(2));
      setBudgetValue(String(formattedAmt));
    }
  }, [mode, budgetEditing, quantity, pricePerUnit, currency, convert, totalPriceInr]);

  // --- LOGARITHMIC SLIDER MAPPING ---
  // The HTML range slider goes from 0 to 1000 for smooth precision.
  // We map that linear 0-1000 scale to a logarithmic min-max quantity.
  
  const getLogMapping = (q: number, mn: number, mx: number): number => {
    if (mn >= mx) return 0;
    const minLog = Math.log(Math.max(1, mn));
    const maxLog = Math.log(mx);
    // return percentage 0-1000
    const val = ((Math.log(Math.max(1, q)) - minLog) / (maxLog - minLog)) * 1000;
    return Math.max(0, Math.min(1000, val));
  };

  const getValueFromLog = (p: number, mn: number, mx: number): number => {
    if (mn >= mx) return mn;
    const minLog = Math.log(Math.max(1, mn));
    const maxLog = Math.log(mx);
    const scale = (maxLog - minLog) / 1000;
    const raw = Math.exp(minLog + scale * p);
    return Math.max(mn, Math.min(mx, raw));
  };

  // The actual state for the HTML slider (0-1000)
  const [sliderPct, setSliderPct] = useState<number>(0);

  useEffect(() => {
    setSliderPct(getLogMapping(quantity, min, max));
  }, [quantity, min, max]);

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const rawPct = parseFloat((e.target as HTMLInputElement).value);
    setSliderPct(rawPct);
    const rawQty = getValueFromLog(rawPct, min, max);
    const snapped = snapToStep(rawQty);
    setQuantity(snapped);
    onChange?.(snapped);
    triggerFeedback();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawPct = parseFloat(e.target.value);
    setSliderPct(rawPct);
    const rawQty = getValueFromLog(rawPct, min, max);
    const snapped = snapToStep(rawQty);
    setQuantity(snapped);
    onChange?.(snapped);
    triggerFeedback();
  };

  const handleTouchStart = () => {
    if (!isMobile) return;
    // immediate feedback and unlock audio on iOS
    lightImpact();
  };
  const handleTouchMove = () => triggerFeedback();

  const handlePointerDown = () => { if (isMobile) lightImpact(); };
  const handlePointerUp = () => triggerFeedback();

  useEffect(() => {
    onChange?.(quantity);
  }, [quantity]);

  useEffect(() => {
    onBudgetChange?.(totalPriceInr);
  }, [totalPriceInr]);

  const isFixed = min === max;
  const currencySymbol = currency === 'INR' ? '₹' : '$';

  const getQuantityFromBudget = React.useCallback((valStr: string): number => {
    const nActive = parseFloat(valStr || '0');
    if (isNaN(nActive) || nActive <= 0 || pricePerUnit <= 0) return min;
    const budgetInr = currency === 'INR' ? nActive : nActive * usdToInr;
    const rawQ = Math.floor(budgetInr / pricePerUnit);
    return Math.max(min, Math.min(max, isFinite(rawQ) ? rawQ : min));
  }, [currency, usdToInr, pricePerUnit, min, max]);

  // Compute preview quantity for current budget while typing in amount mode
  const previewQuantity = React.useMemo(() => {
    if (mode !== 'amount') return quantity;
    if (budgetEditing) {
      return getQuantityFromBudget(budgetValue);
    }
    return quantity;
  }, [mode, budgetEditing, budgetValue, getQuantityFromBudget, quantity]);

  return (
    <div className="slider-container">
      <div className="sliderWrapper">
        <div className="sliderFill" style={{ width: `${(sliderPct / 1000) * 100}%` }} />
        <input
          type="range"
          min={0}
          max={1000}
          value={sliderPct}
          step={0.1}
          disabled={isFixed}
          onInput={handleInput}            // fires continuously while sliding (mobile-friendly)
          onChange={handleChange}          // extra safety
          onTouchStart={handleTouchStart}  // unlock + initial feedback
          onTouchMove={handleTouchMove}    // continuous feedback on iOS
          onPointerDown={handlePointerDown} // Android/modern browsers
          onPointerUp={handlePointerUp}
          className="slider"
        />
      </div>

      <div className="sliderInfo">
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
          {mode === 'qty' ? (
            <div className="sliderQuantity">
              <input
                type="text"
                name="quantity"
                className="value"
                value={isEditing ? editingValue : formatCompact(quantity)}
                onFocus={() => {
                  setIsEditing(true);
                  setEditingValue(String(quantity));
                }}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                  setEditingValue(digitsOnly);
                }}
                onBlur={() => {
                  const parsed = parseInt(editingValue || String(min), 10);
                  const clamped = Math.min(max, Math.max(min, isNaN(parsed) ? min : parsed));
                  const snapped = snapToStep(clamped);
                  setQuantity(snapped);
                  onChange?.(snapped);
                  setIsEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                readOnly={isFixed}
              />
              <span className="label">quantity</span>
            </div>
          ) : (
            <div className="sliderQuantity budgetBox">
              <span className="currency-symbol">{currencySymbol}</span>
              <input
                type="text"
                name="budget"
                className="value"
                value={budgetEditing ? budgetValue : (currency === 'INR' ? String(Math.round(convert(totalPriceInr))) : convert(totalPriceInr).toFixed(2))}
                onFocus={() => {
                  setBudgetEditing(true);
                  const activeAmt = convert(totalPriceInr);
                  setBudgetValue(currency === 'INR' ? String(Math.round(activeAmt)) : activeAmt.toFixed(2));
                }}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d.]/g, "");
                  setBudgetValue(raw);
                  const newQty = getQuantityFromBudget(raw);
                  setQuantity(newQty);
                  onChange?.(newQty);
                }}
                onBlur={() => {
                  const newQty = getQuantityFromBudget(budgetValue);
                  setQuantity(newQty);
                  onChange?.(newQty);
                  setBudgetEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                readOnly={isFixed}
              />
              <span className="label">amount</span>
            </div>
          )}

          <button
            className="switch-btn"
            onClick={() => {
              const newMode = mode === 'qty' ? 'amount' : 'qty';
              if (newMode === 'amount') {
                const activeAmt = convert(totalPriceInr);
                setBudgetValue(currency === 'INR' ? String(Math.round(activeAmt)) : activeAmt.toFixed(2));
              }
              if (modeProp === undefined) setInternalMode(newMode);
              if (onModeChange) onModeChange(newMode);
              if (isMobile) lightImpact();
            }}
            aria-label="Toggle input mode"
          >
            <Image src="/switch.png" alt="Switch" width={24} height={24} />
          </button>
        </div>

        <div className="info-container">
          <div className="slider-info">
            <span className="label">MIN/MAX</span>
            <span className="value">{formatCompact(min)}/{formatCompact(max)}</span>
          </div>
          {mode !== 'amount' && (
            <div className="slider-info">
              <span className="label">PRICE</span>
              <span className="value">{formatMoneyDirect(totalPriceInr)}</span>
            </div>
          )}
          {mode === 'amount' && (
            <div className="slider-info">
              <span className="label">QTY</span>
              <span className="value">{formatCompact(previewQuantity)}</span>
            </div>
          )}
        </div>
      </div>

      {showComments && setComments && (
        <CommentInput
          targetQuantity={quantity}
          comments={comments}
          setComments={setComments}
        />
      )}

      {customInputRequired && setCustomInput && (
        <div className="custom-input-container" style={{ marginTop: '12px', marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            {customInputLabel || "Required Input / Answer"} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: '14px',
              outline: 'none',
            }}
            placeholder={`Enter ${customInputLabel || 'answer / choice'}...`}
            value={customInput || ''}
            onChange={(e) => setCustomInput(e.target.value)}
          />
        </div>
      )}

      {/* Order button injected here as requested */}
      {typeof onOrder === 'function' && (
        <div className="order-actions" style={{ marginTop: '-10px' }}>
          <button
            className="btn-order"
            onClick={() => { if (!ordering) onOrder(); }}
            disabled={ordering}
            aria-live="polite"
          >
            {ordering ? 'Ordering…' : (
              <span>place order for <span className="order-amount">{formatMoneyDirect(totalPriceInr)}</span></span>
            )}
          </button>
        </div>
      )}

      {/* status toasts are handled globally via react-hot-toast in the summary page */}
    </div>
  );
};

export default QuantitySlider;
