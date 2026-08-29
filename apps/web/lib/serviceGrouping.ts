import type { NormalizedSmmService } from '@/types/smm';
import { cleanServiceName } from './serviceNameSanitizer';

export interface ServiceVariant {
  id: string;
  name: string;
  service: NormalizedSmmService;
  sellPriceInr?: number; // Custom field parsed from tags
}

export interface ServiceGroup {
  id: string;
  baseName: string; // This is now exactly the 'displayName' set by the admin
  variants: ServiceVariant[];
  platform: string;
  type: string;
  min: number;
  max: number;
}

export function groupServices(services: NormalizedSmmService[]): ServiceGroup[] {
  const groupsMap = new Map<string, ServiceGroup>();

  for (const service of services) {
    // 0. Filter out non-working categories completely from the storefront
    const cat = (service.category || (service as any).providerCategory || (service as any).rawProviderCategory || "").toUpperCase();
    if (cat.includes("NON WORKING") || cat.includes("DON'T USE") || cat.includes("DON’T USE")) {
      continue;
    }

    // 1. We run the sanitizer to get a clean title for display on the card
    const rawDisplayName = service.displayName || service.providerName || (service as any).name || 'Unmapped Service';
    const cleanedFallback = cleanServiceName(rawDisplayName);
    
    // Parse Variant Name and Sell Price from tags (with fallback to catalog service properties)
    const rawVariant = service.variant as any;
    const isDbVariantJunk = !rawVariant || rawVariant === "Default" || rawVariant === "No Refill" || rawVariant === "Standard";
    let variantName: any = isDbVariantJunk 
      ? cleanedFallback.variantName
      : rawVariant;
      
    let sellPriceInr: number | undefined = service.ratePer1000;

    if (service.tags && Array.isArray(service.tags)) {
      for (const t of service.tags) {
        if (t.startsWith('variant_name:')) {
          const tagVariant = t.replace('variant_name:', '');
          if (tagVariant && tagVariant !== "No Refill" && tagVariant !== "Standard") {
              variantName = tagVariant;
          }
        } else if (t.startsWith('sell_price_inr:')) {
          const parsed = parseFloat(t.replace('sell_price_inr:', ''));
          if (!isNaN(parsed)) sellPriceInr = parsed;
        }
      }
    }
    
    // We STRICTLY group by the original SERVICE ID so each imported service remains a distinct separate card!
    const groupKey = service.id.toString();
    
    // Prefer explicit displayName set by admin in catalog, otherwise use cleaned fallback
    const groupBaseName = (service.displayName && service.displayName.trim() !== "")
      ? service.displayName.trim()
      : cleanedFallback.groupName;

    // We build a beautiful title for the card by combining the group name and variant
    let cardTitle = groupBaseName;
    if (variantName && variantName !== "Standard" && variantName !== "No Refill" && !groupBaseName.toLowerCase().includes(variantName.toLowerCase())) {
        cardTitle = `${groupBaseName} — ${variantName}`;
    }

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        id: groupKey,
        baseName: cardTitle,
        variants: [],
        platform: service.platform,
        type: service.type,
        min: service.min,
        max: service.max,
      });
    }

    const group = groupsMap.get(groupKey)!;


    if (!variantName || variantName === "Standard") {
      variantName = service.refill ? "30 Days Refill" : "No Refill";
    }

    group.variants.push({
      id: service.id,
      name: variantName,
      service,
      sellPriceInr
    });

    // Update overall group min/max
    group.min = Math.min(group.min, service.min);
    group.max = Math.max(group.max, service.max);
  }

  // Convert map to array and sort variants inside each group by price
  const groups = Array.from(groupsMap.values());
  for (const group of groups) {
    group.variants.sort((a, b) => {
      // Sort by sell price if available, otherwise fallback to ratePer1000
      const priceA = a.sellPriceInr ?? a.service.ratePer1000;
      const priceB = b.sellPriceInr ?? b.service.ratePer1000;
      return priceA - priceB;
    });
  }

  // Sort groups by starting price (lowest to highest)
  groups.sort((a, b) => {
    const minA = a.variants.length ? Math.min(...a.variants.map((v) => v.sellPriceInr ?? v.service.ratePer1000)) : 0;
    const minB = b.variants.length ? Math.min(...b.variants.map((v) => v.sellPriceInr ?? v.service.ratePer1000)) : 0;
    return minA - minB;
  });

  return groups;
}

