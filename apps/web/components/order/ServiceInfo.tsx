"use client";
import Image from 'next/image'
import React from 'react'
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi'
import type { NormalizedSmmService } from '@/types/smm'
import { useCurrency } from '@/components/layout/CurrencyProvider'
import { getServiceTags } from '@/lib/serviceTags'

interface Props {
  services?: NormalizedSmmService[];
  index?: number;
  onChangeIndex?: (i: number) => void;
  service?: NormalizedSmmService | null;
  activeCategory?: 'recommended' | 'cheapest' | 'premium';
  onCategoryChange?: (c: 'recommended' | 'cheapest' | 'premium') => void;
  onClose?: () => void;
}

export default function ServiceInfo({ services, index = 0, onChangeIndex, service: single, activeCategory, onCategoryChange, onClose }: Props) {
  const { formatMoneyCompact } = useCurrency();
  const total = services?.length ?? 0;
  const current = single ?? (total > 0 ? services![Math.min(index, total - 1)] : null);

  const platformIcon = current ? `/platforms/${current.platform}-white.png` : '/platforms/instagram-white.png';
  // Raw provider payload for more robust extraction
  const raw: any = current?.raw || {};
  // Extract description if available from provider payload
  const rawDesc: string | undefined = raw?.description || raw?.desc || raw?.details || raw?.note;
  const description: string = current?.displayDescription || (rawDesc && String(rawDesc).trim()) || 'No description available.';

  // Helper extractors for common raw keys (some providers differ)
  function getRawBool(keys: string[]): boolean | undefined {
    for (const k of keys) {
      const v = raw?.[k] ?? (current as any)?.[k];
      if (v === undefined) continue;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (['yes', 'y', 'true', '1', 'available'].includes(s)) return true;
        if (['no', 'n', 'false', '0', 'not available', 'unavailable'].includes(s)) return false;
      }
      if (typeof v === 'number') return v !== 0;
    }
    return undefined;
  }

  function getRawNumber(keys: string[]): number | undefined {
    for (const k of keys) {
      const v = raw?.[k] ?? (current as any)?.[k];
      if (v === undefined || v === null) continue;
      const n = Number(String(v).replace(/[^0-9.-]+/g, ''));
      if (!Number.isNaN(n)) return n;
    }
    return undefined;
  }

  function getRawString(keys: string[]): string | undefined {
    for (const k of keys) {
      const v = raw?.[k] ?? (current as any)?.[k];
      if (v === undefined || v === null) continue;
      return String(v).trim();
    }
    return undefined;
  }

  // Derived fields with fallbacks: prefer NormalizedSmmService values, then raw payload
  const rate = current ? (current.ratePer1000 ?? getRawNumber(['ratePer1000', 'rate', 'price', 'cost'])) : 0.4;
  const refillFlag = current?.refill ?? getRawBool(['refill', 'has_refill', 'guarantee', 'lifetime_refill', 'refilled']) ?? false;
  const cancelFlag = current?.cancel ?? getRawBool(['cancel', 'cancellable', 'can_cancel', 'refundable']) ?? false;
  const cancelText = cancelFlag ? 'Available' : 'Not Available';
  const avgTime = current?.averageTime ?? getRawNumber(['averageTime', 'avg_time', 'average_time', 'start', 'start_time', 'estimated_time']) ?? null;
  const hayOriginal = `${current?.providerName || ''}\n${description}\n${getRawString(['country', 'target', 'targets', 'location']) || ''}`;
  const hay = hayOriginal.toLowerCase();
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    // Handle **bold**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <span key={i} className="font-bold text-foreground text-[13px]">{part.slice(2, -2)}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const descNode = (
    <div className="description-content space-y-1">
      {description.split(/\r?\n/).map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        // Detection for list items provided by AI (preserves AI bullets)
        const isListItem = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed);

        return (
          <div
            key={i}
            className={`leading-relaxed text-[12.5px] transition-all duration-200 ${isListItem ? 'pl-2 opacity-90' : 'font-semibold text-foreground/90 mt-2'
              }`}
          >
            {renderFormattedText(line)}
          </div>
        );
      })}
    </div>
  );

  // ============================================================================
  // ROBUST EXTRACTION UTILITIES
  // ============================================================================

  /**
   * Extract value from "Key: Value" or "Key - Value" patterns
   */
  function extractKeyValue(text: string, keys: string[]): string | null {
    for (const key of keys) {
      const pattern = new RegExp(`(?:^|\\n)\\s*(?:[^a-zA-Z0-9_]*\\s*)?${key}\\s*[:|-]\\s*([^\\n]+)`, 'im');
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Clean and normalize time strings
   */
  function normalizeTimeString(raw: string): string {
    const cleaned = raw
      .replace(/[🚀⏱✅♻️🇪🇸🇮🇳🇺🇸🇬🇧🇹🇷🇧🇷🇮🇩🇷🇺🇩🇪🇫🇷🇳🇵🇳🇬]/g, '')
      .replace(/max\s+\d+k/gi, '')
      .replace(/day\s+\d+k/gi, '')
      .replace(/\|/g, '')
      .trim();

    // Extract time patterns: "0-10 minutes" or "1-2 hours"
    const rangeMatch = cleaned.match(/(\d+)\s*[-–—]\s*(\d+)\s*(min|minutes|hour|hours|hr|hrs|day|days)/i);
    if (rangeMatch) {
      const [, start, end, unit] = rangeMatch;
      const u = unit.toLowerCase().startsWith('h') ? 'hr' : (unit.toLowerCase().startsWith('d') ? 'day' : 'min');
      return `${start}-${end} ${u}`;
    }

    // Single value: "10 minutes"
    const singleMatch = cleaned.match(/(\d+)\s*(min|minutes|hour|hours|hr|hrs|day|days)/i);
    if (singleMatch) {
      const [, val, unit] = singleMatch;
      const u = unit.toLowerCase().startsWith('h') ? 'hr' : (unit.toLowerCase().startsWith('d') ? 'day' : 'min');
      return `${val} ${u}`;
    }

    if (/instant|immediate|^0$/i.test(cleaned)) return 'Instant';

    return cleaned || 'N/A';
  }

  /**
   * Extract location/country with priority for explicit patterns
   */
  function extractLocation(text: string): string {
    const explicit = extractKeyValue(text, ['Location', 'Country', 'Target', 'Targeting']);
    if (explicit) {
      const cleaned = explicit.replace(/[🇪🇸🇮🇳🇺🇸🇬🇧🇹🇷🇧🇷🇮🇩🇷🇺🇩🇪🇫🇷🇳🇵🇳🇬]/g, '').trim();
      if (cleaned) return cleaned;
    }

    // Fallback to text analysis
    if (/(spain|spanish|🇪🇸)/i.test(text)) return 'Spain';
    if (/(india|indian|🇮🇳)/i.test(text)) return 'India';
    if (/(united\s*states|usa|american|🇺🇸)/i.test(text)) return 'USA';
    if (/(united\s*kingdom|uk|british|🇬🇧)/i.test(text)) return 'UK';
    if (/(turkey|turkish|🇹🇷)/i.test(text)) return 'Turkey';
    if (/(brazil|brazilian|🇧🇷)/i.test(text)) return 'Brazil';
    if (/(indonesia|indonesian|🇮🇩)/i.test(text)) return 'Indonesia';
    if (/(russia|russian|🇷🇺)/i.test(text)) return 'Russia';
    if (/(germany|german|🇩🇪)/i.test(text)) return 'Germany';
    if (/(france|french|🇫🇷)/i.test(text)) return 'France';
    if (/(nepal|nepali|🇳🇵)/i.test(text)) return 'Nepal';
    if (/(nigeria|nigerian|🇳🇬)/i.test(text)) return 'Nigeria';
    if (/(global|worldwide|international)/i.test(text)) return 'Global';
    return 'Global';
  }

  /**
   * Extract quality with priority for explicit patterns
   */
  function extractQualityEnhanced(text: string, originalText: string): string {
    const explicit = extractKeyValue(originalText, ['Quality']);
    if (explicit) return explicit;

    // Fallback to text analysis
    const t = text.toLowerCase();

    // Check generic/mix FIRST to avoid partial matches on "quality"
    if (/\b(mix|mixed|normal|standard|medium|average)\b/i.test(t)) return 'Standard';
    if (/\b(bot|fake|low)\b/i.test(t)) return 'Low';

    // Then check premium/high
    if (/(100%\s*real|real\s+accounts|organic|active\s+users|genuine)/i.test(t)) return 'Real';
    if (/\b(vip|elite|premium|pro|super|exclusive)\b/i.test(t)) return 'Premium';
    if (/\b(hq|high\s*quality|\bhigh\b)\b/i.test(t)) return 'High';

    return 'Standard';
  }

  /**
   * Extract refill period
   */
  function extractRefillPeriod(text: string): string | null {
    const explicit = extractKeyValue(text, ['Refill', 'Guarantee', 'Warranty']);
    if (explicit) {
      const match = explicit.match(/(\d+)\s*(day|days|month|months|year|years)/i);
      if (match) return `${match[1]} ${match[2].toLowerCase()}`;
      if (/lifetime|permanent|forever/i.test(explicit)) return 'Lifetime';
    }
    const match = text.match(/(?:R|refill|guarantee)\s*(\d+)\s*(day|days|month|months)/i);
    if (match) return `${match[1]} ${match[2].toLowerCase()}`;
    return null;
  }

  /**
   * Classify speed using minutes first with platform-aware thresholds, falling back to text regex
   */
  function extractSpeed(minutes: number | null, text: string, platform?: string): string {
    const p = (platform || '').toLowerCase();
    const isYoutube = p === 'youtube';
    const thresholds = isYoutube ? { fast: 120, normal: 720, slow: 2880 } : { fast: 30, normal: 120, slow: 720 };

    if (minutes != null && !isNaN(Number(minutes)) && Number(minutes) > 0) {
      const m = Number(minutes);
      if (m <= 10) return 'Instant';
      if (m <= thresholds.fast) return 'Fast';
      if (m <= thresholds.normal) return 'Normal';
      if (m <= thresholds.slow) return 'Slow';
      return isYoutube ? 'Slow' : 'Unstable';
    }

    // Fallback to text matching ONLY when minutes is missing or zero
    if (/\bslow|delayed\b/i.test(text)) return 'Slow';
    if (/0\s*[-–]\s*10\s*min|instant\s*start|immediate/i.test(text)) return 'Instant';
    if (/fast|quick|rapid/i.test(text)) return 'Fast';
    return 'Normal';
  }

  /**
   * Extract stability/drop info
   */
  function extractStability(text: string, hasRefill: boolean): string {
    const t = text.toLowerCase();

    // Check specific drop conditions explicitly
    if (/\b(non[-\s]?drop|no\s*drop|drop\s*protection|zero\s*drop)\b/i.test(t)) return 'Non-Drop';
    if (/\b(may\s*drop|may\s*lose|possible\s*drop|will\s*drop|high\s*drop|drops?\s*(?:after|within|in))\b/i.test(t)) return 'May Drop';
    if (/\b(low\s*drop|low-drop)\b/i.test(t)) return 'Low Drop';
    if (/\b(normal\s*drop)\b/i.test(t)) return 'Normal Drop';

    // If nothing mentioned, return standard
    return 'Standard';
  }

  // Priority-aware tag & attribute extraction matching getServiceTags logic
  const serviceTagsData = current ? getServiceTags(current) : null;

  // 1. Refill
  let explicitRefillTag = (current as any)?.refillTag;
  if (!explicitRefillTag && current?.tags && Array.isArray(current.tags)) {
    const t = current.tags.find((x: string) => x.startsWith("refill:"));
    if (t) explicitRefillTag = t.replace("refill:", "");
  }

  let refillText = 'Not Available';
  if (explicitRefillTag && explicitRefillTag !== "auto") {
    if (explicitRefillTag.toLowerCase() === "no refill") {
      refillText = "No Refill";
    } else {
      refillText = explicitRefillTag;
    }
  } else if (serviceTagsData) {
    const rTag = serviceTagsData.tags.find(t => t.type === 'refill');
    if (rTag) {
      refillText = rTag.label;
    } else if (serviceTagsData.refill === 'Available') {
      refillText = 'Available';
    } else {
      refillText = 'No Refill';
    }
  } else {
    const refillPeriod = extractRefillPeriod(hay);
    const explicitRefill = extractKeyValue(hayOriginal, ['Refill', 'Guarantee']);
    if (explicitRefill && !/\b0\s*days?\b/i.test(explicitRefill)) {
      refillText = explicitRefill;
    } else if (refillPeriod && !/\b0\s*days?\b/i.test(refillPeriod)) {
      refillText = refillPeriod;
    } else {
      refillText = refillFlag ? 'Available' : 'No Refill';
    }
  }

  // 2. Stability / Drop
  let explicitStability = (current as any)?.stability;
  if (!explicitStability && current?.tags && Array.isArray(current.tags)) {
    const t = current.tags.find((x: string) => x.startsWith("stability:"));
    if (t) explicitStability = t.replace("stability:", "");
  }

  let stabilityLabel = 'Standard';
  if (explicitStability && explicitStability !== "auto") {
    stabilityLabel = explicitStability;
  } else if (serviceTagsData) {
    const dropTag = serviceTagsData.tags.find(t => t.type === 'drop');
    if (dropTag) {
      stabilityLabel = dropTag.label;
    } else {
      stabilityLabel = serviceTagsData.drop;
    }
  } else {
    const explicitDrop = extractKeyValue(hayOriginal, ['Drop', 'Stability']);
    const refillPeriod = extractRefillPeriod(hay);
    stabilityLabel = explicitDrop || current?.stability || (extractStability(hay, !!refillFlag) === 'Stable' && refillPeriod
      ? `Refill: ${refillPeriod}`
      : extractStability(hay, !!refillFlag));
  }

  // 3. Speed
  let speedLabel = 'Normal';
  if (serviceTagsData) {
    const speedTag = serviceTagsData.tags.find(t => t.type === 'speed');
    speedLabel = speedTag ? speedTag.label : serviceTagsData.speed;
  } else {
    speedLabel = extractSpeed(avgTime, hay, current?.platform);
  }

  // 4. Quality
  let qualityLabel = current?.quality;
  if (!qualityLabel && current?.tags && Array.isArray(current.tags)) {
    const t = current.tags.find((x: string) => x.startsWith("quality:"));
    if (t) qualityLabel = t.replace("quality:", "");
  }
  if (!qualityLabel) {
    qualityLabel = extractQualityEnhanced(hay, hayOriginal);
  }

  // 5. Targeting
  let targetingLabel = current?.targeting;
  if (!targetingLabel && current?.tags && Array.isArray(current.tags)) {
    const t = current.tags.find((x: string) => x.startsWith("geo:"));
    if (t) targetingLabel = t.replace("geo:", "");
  }
  if (!targetingLabel) {
    const targetingFromRaw = getRawString(['country', 'target', 'targets', 'location']);
    targetingLabel = targetingFromRaw || extractLocation(hay);
  }

  function formatDuration(mins: number | null | undefined): string {
    if (mins == null || Number.isNaN(Number(mins))) return '';
    const m = Math.round(Number(mins));
    if (m <= 0) return 'Instant';
    if (m >= 60) {
      const hours = m / 60;
      if (m % 60 === 0) return `${Math.round(hours)} hr${Math.round(hours) > 1 ? 's' : ''}`;
      return `${hours.toFixed(1)} hrs`;
    }
    return `${m} min`;
  }

  const explicitStart = extractKeyValue(hayOriginal, ['Start Time', 'Start', 'Time']);
  const normalizedStart = explicitStart ? normalizeTimeString(explicitStart) : null;

  const formattedAvgTime = avgTime ? formatDuration(avgTime) : (normalizedStart || (speedLabel === 'Instant' ? 'Instant' : 'N/A'));
  const startLabel = formattedAvgTime || 'N/A';
  const serviceTypeLabel = current ? `${String(current.type || '')}${current.variant && current.variant !== 'any' ? ' · ' + String(current.variant) : ''}` : 'Likes/Reactions';
  function capitalize(s?: string) { if (!s) return ''; return s.charAt(0).toUpperCase() + s.slice(1); }
  const platformLabel = capitalize(current?.platform ?? 'instagram');

  // Extract variant name for display
  let variantName: string | null = (current as any)?.variantName || null;
  if (!variantName && current?.variant && !['any', 'Default', 'Standard'].includes(String(current.variant))) {
    const rawV = String(current.variant);
    variantName = rawV.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  if (!variantName && current?.tags && Array.isArray(current.tags)) {
    for (const t of current.tags) {
      if (t.startsWith('variant_name:')) {
        const tagVariant = t.replace('variant_name:', '').trim();
        if (tagVariant && !['Standard', 'Default', 'any'].includes(tagVariant)) {
          variantName = tagVariant.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          break;
        }
      }
    }
  }

  const baseName = current?.displayName || current?.providerName || 'Service';

  // Check if variantName is redundant with baseName or a generic category name
  const isRedundant = variantName && (
    baseName.toLowerCase().includes(variantName.toLowerCase()) ||
    variantName.toLowerCase().includes(baseName.toLowerCase()) ||
    ['custom comments', 'random comments', 'comments', 'followers', 'likes', 'views', 'shares', 'repost'].includes(variantName.toLowerCase())
  );

  const displayTitle = (variantName && !isRedundant) ? `${baseName} — ${variantName}` : baseName;
  const title = current ? `${displayTitle} · ${current.displayId || ''}` : 'Service';

  const cleanType = capitalize(current?.type || 'Comments');
  const typeVariant = (variantName && !isRedundant) ? ` (${variantName})` : '';

  return (
    <div className='service-info-container'>
      {(onClose || (total > 0 && onChangeIndex)) ? (
        <div className="order-summary">
          {onClose && (
            <button onClick={onClose}>
              <FiArrowLeft /> Go Back
            </button>
          )}
          <h3 className='service-info-title' style={{ margin: 0 }}>{title}</h3>
        </div>
      ) : (
        <h3 className='service-info-title'>{title}</h3>
      )}
      <div className="details-grid">
        <div className="detail-item">
          <span className="detail-label">PLATFORM</span>
          <Image src={platformIcon} alt='Platform' width={20} height={20} />
        </div>
        <div className="detail-item">
          <span className="detail-label">RATE/1K</span>
          <span className="detail-value">{formatMoneyCompact(rate)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">SERVICE TYPE</span>
          <span className="detail-value">{current ? `${cleanType}${typeVariant}` : 'Likes/Reactions'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">DRIPFEED</span>
          <span className="detail-value">{current?.dripfeed ? 'Available' : 'Not Available'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">CANCEL</span>
          <span className="detail-value">{cancelText}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">AVG TIME</span>
          <span className="detail-value">{formattedAvgTime}</span>
        </div>
      </div>
      <div className="cards-container">
        <div className="card-info start-time">
          <div className="text-container start-time">
            <span className='label'>Start Time</span>
            <h2 className='value'>{startLabel}</h2>
          </div>
        </div>
        <div className="card-info speed">
          <div className="text-container">
            <span className='label'>Speed</span>
            <h2 className='value'>{speedLabel}</h2>
          </div>
        </div>
        <div className="card-info targeting">
          <div className="text-container">
            <span className='label'>Targeting</span>
            <h2 className='value'>{targetingLabel}</h2>
          </div>
        </div>
        <div className="card-info refill">
          <div className="text-container">
            <span className='label'>Refill</span>
            <h2 className='value'>{refillText}</h2>
          </div>
        </div>
        <div className="card-info quality">
          <div className="text-container">
            <span className='label'>Quality</span>
            <h2 className='value'>{qualityLabel}</h2>
          </div>
        </div>
        <div className="card-info stability">
          <div className="text-container">
            <span className='label'>Stability</span>
            <h2 className='value'>{stabilityLabel}</h2>
          </div>
        </div>
      </div>
      <div className="description-container">
        <h3 className='description-title'>Description</h3>
        <div className='description-text'>
          {descNode}
        </div>
      </div>
    </div>
  )
}