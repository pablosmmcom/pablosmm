import type { NormalizedSmmService } from '@/types/smm';

export interface ServiceTag {
  label: string;
  icon: string;
  className: string;
  type: 'refill' | 'drop' | 'speed' | 'geo';
}

export interface ServiceTagData {
  tags: ServiceTag[];
  geo: 'Indian' | 'USA' | 'Global';
  speed: 'Instant' | 'Fast' | 'Normal Speed' | 'Slow Speed' | 'Unstable';
  refill: 'No Refill' | 'Available';
  refillLabel: string;
  drop: 'Non Drop' | 'Low Drop' | 'High Drop';
}

export function getServiceTags(service: NormalizedSmmService | any): ServiceTagData {
  if (!service) {
    return { tags: [], geo: 'Global', speed: 'Normal Speed', refill: 'No Refill', refillLabel: 'No Refill', drop: 'Low Drop' };
  }

  const categoryStr = (service.category || '').toLowerCase();
  const nameStr = (service.displayName || service.name || service.providerName || '').toLowerCase();
  const descStr = (service.description || service.displayDescription || service.desc || '').toLowerCase();
  const fullText = `${categoryStr} ${nameStr} ${descStr}`;

  const tags: ServiceTag[] = [];

  // 0. Admin Badge Override (Recommended, Best, Cheapest, Premium)
  let explicitBadge = (service as any).badge;
  if (!explicitBadge && service.tags && Array.isArray(service.tags)) {
    const t = service.tags.find((x: string) => x.startsWith("badge:"));
    if (t) explicitBadge = t.replace("badge:", "");
  }

  if (explicitBadge && explicitBadge !== "auto") {
    const b = explicitBadge.toLowerCase();
    if (b === 'recommended') {
      tags.push({ label: '⭐ Recommended', icon: '', className: 'badge-recommended', type: 'badge' as any });
    } else if (b === 'best') {
      tags.push({ label: '🔥 Best Seller', icon: '', className: 'badge-best', type: 'badge' as any });
    } else if (b === 'cheapest') {
      tags.push({ label: '🏷️ Cheapest', icon: '', className: 'badge-cheapest', type: 'badge' as any });
    } else if (b === 'premium') {
      tags.push({ label: '💎 Premium', icon: '', className: 'badge-premium', type: 'badge' as any });
    }
  }

  // 1. Refill Tag
  let explicitRefillTag = (service as any).refillTag;
  if (!explicitRefillTag && service.tags && Array.isArray(service.tags)) {
    const t = service.tags.find((x: string) => x.startsWith("refill:"));
    if (t) explicitRefillTag = t.replace("refill:", "");
  }

  let hasRefill = false;
  let refillStatus: 'No Refill' | 'Available' = 'No Refill';
  let refillLabel = 'No Refill';

  if (explicitRefillTag && explicitRefillTag !== "auto") {
    if (explicitRefillTag === "No Refill") {
      hasRefill = false;
      refillStatus = 'No Refill';
      refillLabel = 'No Refill';
    } else {
      hasRefill = true;
      refillStatus = 'Available';
      refillLabel = explicitRefillTag.toLowerCase().includes("refill") || explicitRefillTag.toLowerCase().includes("guarantee")
        ? explicitRefillTag 
        : `${explicitRefillTag} Refill`;
    }
  } else {
    // Fallback to description regex parsing if explicitRefillTag is "auto" or missing
    const isExplicitNoRefill = 
      /\b(no\s*refill|non\s*refill|without\s*refill|no-refill|non-refill|refill\s*:\s*(?:no|false|0|none|off|disabled)|0\s*days?\s*refill|no\s*guarantee|no\s*warranty|without\s*guarantee)\b/i.test(fullText);

    const isExplicitRefill = 
      /\b(refill|guarantee|warranty|auto\s*refill|\br30\b|\br60\b|\br90\b|\br365\b)\b/i.test(fullText);

    if (isExplicitNoRefill) {
      hasRefill = false;
    } else if (service.refill === true || isExplicitRefill) {
      hasRefill = true;
    } else {
      hasRefill = false;
    }

    if (hasRefill) {
      refillStatus = 'Available';
      if (fullText.includes('lifetime') || fullText.includes('permanent')) {
        refillLabel = 'Lifetime Refill';
      } else {
        const dayMatch = fullText.match(/\b(365|180|120|90|60|30|14|7)\s*(?:days?|d)?\b(?:\s*(?:refill|guarantee|warranty))?/i) ||
                         fullText.match(/\b(\d+)\s*(?:days?|d)\b/i) ||
                         fullText.match(/\b(?:r|refill\s*for\s*)(\d+)\b/i);
        if (dayMatch) {
          const num = dayMatch[1];
          if (num === '0') {
            hasRefill = false;
            refillStatus = 'No Refill';
            refillLabel = 'No Refill';
          } else {
            refillLabel = `${num} Days Refill`;
          }
        } else {
          refillLabel = '30 Days Refill';
        }
      }
    }
  }

  if (hasRefill) {
    tags.push({ label: refillLabel, icon: '/order/refill.png', className: 'refill', type: 'refill' });
  } else {
    tags.push({ label: 'No Refill', icon: '/order/refill.png', className: 'refill-no', type: 'refill' });
  }

  // 2. Drop / Non-Drop / High Drop Tag
  let explicitStability = service.stability;
  if (!explicitStability && service.tags && Array.isArray(service.tags)) {
    const t = service.tags.find((x: string) => x.startsWith("stability:"));
    if (t) explicitStability = t.replace("stability:", "");
  }

  const isNonDrop = 
    explicitStability === 'Non-Drop' ||
    (service as any).drop === 'non_drop' || 
    service.stability?.toLowerCase().includes('non') ||
    /\b(non[-\s]?drop|no\s*drop|nondrop|zero\s*drop|drop\s*free|never\s*drop|permanent)\b/i.test(fullText);

  const isHighDrop = 
    explicitStability === 'High Drop' || explicitStability === 'May Drop' ||
    (service as any).drop === 'high_drop' ||
    /\b(high[-\s]?drop|may\s*drop|will\s*drop|possible\s*drop|heavy\s*drop|fast\s*drop|high\s*loss|drop\s*rate\s*:?\s*high|drop\s*:\s*high)\b/i.test(fullText);

  let dropStatus: 'Non Drop' | 'Low Drop' | 'High Drop' = 'Low Drop';
  if (isNonDrop) {
    tags.push({ label: 'Non Drop', icon: '/order/non-drop.png', className: 'nondrop', type: 'drop' });
    dropStatus = 'Non Drop';
  } else if (isHighDrop) {
    const label = explicitStability === 'May Drop' ? 'May Drop' : 'High Drop';
    tags.push({ label, icon: '/order/non-drop.png', className: 'highdrop', type: 'drop' });
    dropStatus = 'High Drop';
  } else {
    tags.push({ label: 'Low Drop', icon: '/order/non-drop.png', className: 'drop', type: 'drop' });
    dropStatus = 'Low Drop';
  }

  // 3. Speed Tag (aligned with admin catalog platform-aware thresholds)
  let speedStatus: 'Instant' | 'Fast' | 'Normal Speed' | 'Slow Speed' | 'Unstable' = 'Normal Speed';
  const rawAvg = (service as any).average_time ?? service.averageTime;
  const avgMins = (rawAvg !== undefined && rawAvg !== null && rawAvg !== "" && rawAvg !== "N/A") 
    ? (typeof rawAvg === "number" ? rawAvg : parseFloat(String(rawAvg)))
    : null;

  const platform = ((service as any).platform || "").toLowerCase();
  const isYoutube = platform === "youtube";
  const thresholds = isYoutube ? { fast: 120, normal: 720, slow: 2880 } : { fast: 30, normal: 120, slow: 720 };

  if (avgMins !== null && !isNaN(avgMins) && avgMins > 0) {
    if (avgMins <= 10) {
      tags.push({ label: 'Instant', icon: '/order/instant.png', className: 'instant', type: 'speed' });
      speedStatus = 'Instant';
    } else if (avgMins <= thresholds.fast) {
      tags.push({ label: 'Fast', icon: '/order/instant.png', className: 'fast', type: 'speed' });
      speedStatus = 'Fast';
    } else if (avgMins <= thresholds.normal) {
      tags.push({ label: 'Normal Speed', icon: '/order/instant.png', className: 'normal', type: 'speed' });
      speedStatus = 'Normal Speed';
    } else if (avgMins <= thresholds.slow) {
      tags.push({ label: 'Slow Speed', icon: '/order/instant.png', className: 'slow', type: 'speed' });
      speedStatus = 'Slow Speed';
    } else {
      tags.push({ label: 'Unstable', icon: '/order/instant.png', className: 'unstable', type: 'speed' });
      speedStatus = 'Unstable';
    }
  } else if (nameStr.includes('instant') || descStr.includes('instant')) {
    tags.push({ label: 'Instant', icon: '/order/instant.png', className: 'instant', type: 'speed' });
    speedStatus = 'Instant';
  } else if (nameStr.includes('fast') || descStr.includes('fast')) {
    tags.push({ label: 'Fast', icon: '/order/instant.png', className: 'fast', type: 'speed' });
    speedStatus = 'Fast';
  } else if (nameStr.includes('slow') || descStr.includes('slow')) {
    tags.push({ label: 'Slow Speed', icon: '/order/instant.png', className: 'slow', type: 'speed' });
    speedStatus = 'Slow Speed';
  } else if (nameStr.includes('unstable') || descStr.includes('unstable')) {
    tags.push({ label: 'Unstable', icon: '/order/instant.png', className: 'unstable', type: 'speed' });
    speedStatus = 'Unstable';
  } else {
    tags.push({ label: 'Normal Speed', icon: '/order/instant.png', className: 'normal', type: 'speed' });
    speedStatus = 'Normal Speed';
  }

  // 4. Geo Tag
  let geoStatus: 'Indian' | 'USA' | 'Global' = 'Global';
  if (categoryStr.includes('indian') || nameStr.includes('indian') || categoryStr.includes('india') || nameStr.includes('india') || descStr.includes('indian')) {
    tags.push({ label: 'Indian', icon: '/order/indian.png', className: 'region', type: 'geo' });
    geoStatus = 'Indian';
  } else if (categoryStr.includes('usa ') || nameStr.includes('usa ') || categoryStr.includes(' usa') || nameStr.includes(' usa') || categoryStr.includes('us ') || nameStr.includes('us ') || descStr.includes(' usa ') || descStr.includes(' usa,')) {
    tags.push({ label: 'USA', icon: '/order/us.png', className: 'region', type: 'geo' });
    geoStatus = 'USA';
  } else {
    tags.push({ label: 'Global', icon: '/order/global.png', className: 'region', type: 'geo' });
    geoStatus = 'Global';
  }

  return { tags, geo: geoStatus, speed: speedStatus, refill: refillStatus, refillLabel, drop: dropStatus };
}
