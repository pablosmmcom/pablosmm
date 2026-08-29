"use client";
import QuantitySlider from '@/components/order/QuantitySlider'
import SearchContainer from '@/components/order/SearchContainer'
import ServiceInfoPanel from '@/components/order/ServiceInfo'
import Preview from '@/components/preview/Preview'
import { useNormalizedServices } from '@/lib/useServices'
import { useSearchParams } from 'next/navigation'
import React, { Suspense, useMemo, useState, startTransition, useRef } from 'react'
import OrderConfirmModal from '@/components/order/OrderConfirmModal'
import { toast } from 'sonner'
import type { Platform, ServiceType, Variant, NormalizedSmmService } from '@/types/smm'
import FollowerPreview from '@/components/preview/FollowerPreview';
import PostPreview from '@/components/preview/PostPreview';
import ServiceCard from '@/components/order/ServiceCard';
import Image from 'next/image';
import { useMetadata } from '@/lib/useMetadata';
import { getApiBaseUrl } from '@/lib/config';
import { createPortal } from 'react-dom';
import { getServiceTags } from '@/lib/serviceTags';
import { groupServices } from '@/lib/serviceGrouping';
import { SlidersHorizontal } from 'lucide-react';

type FilterType = 'all' | null;

// Hook that reads URL search params. Must be used within a <Suspense> boundary in Next.js app router.
function useSelectionFromQuery() {
  const params = useSearchParams();
  const platform = (params.get('platform') || 'instagram') as Platform;
  const service = (params.get('service') || 'likes') as ServiceType;
  const variant = (params.get('variant') || 'any') as Variant;
  const link = params.get('link') || '';
  return { platform, service, variant, link };
}

type Category = 'recommended' | 'cheapest' | 'premium';

function parseAvgMins(s: any): number {
  const raw = s?.averageTime ?? s?.average_time;
  if (raw === undefined || raw === null || raw === '' || raw === 'N/A') return 9999;
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return isNaN(num) || num <= 0 ? 9999 : num;
}

function matchesVariantFilter(s: NormalizedSmmService, variant: string): boolean {
  if (!variant || variant === 'any') return true;

  const v = variant.toLowerCase();

  // 1. If service has an explicit sub-category binding (e.g. 'profile', 'channel', 'post', 'reel')
  if (s.variant && (s.variant as string) !== 'any') {
    return (s.variant as string).toLowerCase() === v;
  }

  // 2. Unbound / General services (variant === 'any') match keyword rules
  const text = `${s.variant ?? ''} ${s.displayName ?? ''} ${s.providerName ?? ''} ${s.category ?? ''} ${s.description ?? ''}`.toLowerCase();

  if (v === 'custom') {
    return s.variant === 'custom' || text.includes('custom');
  }
  if (v === 'random') {
    return s.variant === 'random' || s.variant === 'any' || (!text.includes('custom'));
  }
  const nameCat = `${s.variant ?? ''} ${s.displayName ?? ''} ${s.providerName ?? ''} ${s.category ?? ''}`.toLowerCase();
  const isDashboardSvc = nameCat.includes('dashboard') || nameCat.includes('profile visit') || nameCat.includes('explore') || text.includes('dashboard view') || text.includes('dashboard views');

  if (v === 'dashboard') {
    return isDashboardSvc;
  }
  if (v === 'story') {
    if (isDashboardSvc) return false;
    return text.includes('story') || text.includes('stories');
  }
  if (v === 'reel') {
    if (isDashboardSvc) return false;
    const isExplicitPostSvc = (nameCat.includes('photo') || nameCat.includes('post view') || nameCat.includes('posts')) && !nameCat.includes('reel') && !nameCat.includes('video') && !nameCat.includes('igtv');
    if (isExplicitPostSvc) return false;

    const hasReelVideoInTitle = nameCat.includes('reel') || nameCat.includes('video') || nameCat.includes('igtv') || nameCat.includes('stream');
    if (hasReelVideoInTitle) return true;

    if (nameCat.includes('impression')) return false;

    return (text.includes('reel') || text.includes('video') || text.includes('igtv')) && !nameCat.includes('photo');
  }
  if (v === 'post') {
    if (isDashboardSvc) return false;
    const hasReelVideoInTitle = nameCat.includes('reel') || nameCat.includes('video') || nameCat.includes('igtv');
    if (hasReelVideoInTitle && !nameCat.includes('post')) return false;

    return text.includes('post') || text.includes('photo') || nameCat.includes('impression');
  }
  if (v === 'comments' || v === 'comment') {
    return text.includes('comment');
  }
  if (v === 'live') {
    return text.includes('live') || text.includes('stream');
  }
  if (v === 'igtv') {
    return text.includes('igtv');
  }
  if (v === 'short') {
    return text.includes('short');
  }
  if (v === 'channel') {
    return text.includes('channel') || text.includes('broadcast');
  }
  if (v === 'group') {
    return text.includes('group');
  }
  if (v === 'premium') {
    return text.includes('premium');
  }
  if (v === 'adword') {
    return text.includes('adword');
  }
  if (v === 'future') {
    return text.includes('future');
  }
  if (v === 'community') {
    return text.includes('community');
  }
  if (v === 'tweet') {
    return text.includes('tweet') || text.includes('post');
  }

  return s.variant === variant || text.includes(v);
}

function matchesPlatformAndService(s: NormalizedSmmService, targetPlatform: string, targetService: string): boolean {
  if (s.platform?.toLowerCase() !== targetPlatform.toLowerCase()) return false;
  const sType = (s.type || s.category || '').toLowerCase().trim();
  const tgt = targetService.toLowerCase().trim();
  if (sType === tgt) return true;

  // Handle YouTube followers / subscribers
  if (targetPlatform.toLowerCase() === 'youtube' && (sType === 'followers' || sType === 'subscribers') && (tgt === 'followers' || tgt === 'subscribers')) {
    return true;
  }
  // Handle Facebook followers / page_followers
  if (targetPlatform.toLowerCase() === 'facebook' && (sType === 'followers' || sType === 'page_followers') && (tgt === 'followers' || tgt === 'page_followers')) {
    return true;
  }
  // Handle save/saves, repost/reposts, share/shares
  if ((sType === 'saves' || sType === 'save') && (tgt === 'saves' || tgt === 'save')) return true;
  if ((sType === 'repost' || sType === 'reposts') && (tgt === 'repost' || tgt === 'reposts')) return true;
  if ((sType === 'shares' || sType === 'share') && (tgt === 'shares' || tgt === 'share')) return true;

  return false;
}

function getAdminBadge(s: any): string | undefined {
  if (!s) return undefined;
  if (s.badge) return s.badge;
  if (s.tags && Array.isArray(s.tags)) {
    const t = s.tags.find((x: string) => x.startsWith("badge:"));
    if (t) return t.replace("badge:", "");
  }
  return undefined;
}

function computeBestRatedScore(s: any): number {
  if (!s) return 0;
  const { tags, drop, refill, speed } = getServiceTags(s);
  let score = 0;

  // 0. Admin Badge Override Bonus
  const adminBadge = getAdminBadge(s);
  if (adminBadge === 'recommended') score += 100;
  else if (adminBadge === 'best') score += 90;
  else if (adminBadge === 'premium') score += 80;
  else if (adminBadge === 'cheapest') score += 30;

  // 1. Drop / Stability Score
  if (drop === 'Non Drop') score += 50;
  else if (drop === 'Low Drop') score += 30;
  else if (drop === 'High Drop') score -= 50;

  // 2. Refill Score
  const tagList = tags || [];
  const refillTagLabel = tagList.find((t: any) => t.type === 'refill')?.label || '';
  if (refillTagLabel.includes('Lifetime') || refillTagLabel.includes('365')) score += 50;
  else if (refillTagLabel.includes('Days')) score += 35;
  else if (refill === 'Available') score += 25;
  else score -= 30;

  // 3. Speed Score
  if (speed === 'Instant') score += 30;
  else if (speed === 'Fast') score += 20;
  else if (speed === 'Normal Speed') score += 10;
  else if (speed === 'Slow Speed') score -= 10;
  else if (speed === 'Unstable') score -= 40;

  // 4. Average Time bonus / penalty (trust fast average times significantly more)
  const avgMins = parseAvgMins(s);
  const platform = (s?.platform || '').toLowerCase();
  const isYoutube = platform === 'youtube';

  if (avgMins < 9999) {
    if (avgMins <= 10) score += 40;       // Ultra fast / instant start
    else if (avgMins <= 30) score += 30;  // Very fast (< 30 mins)
    else if (avgMins <= 60) score += 20;  // Fast (< 1 hour)
    else if (avgMins <= 180) score += 10; // Decent (< 3 hours)
    else if (avgMins <= 360) score += 5;  // Moderate (< 6 hours)
    else if (isYoutube && avgMins <= 1440) score += 5; // Normal YT batch delivery (< 24 hours)
    else if (isYoutube && avgMins > 1440) score -= 10; // Very late YT
    else if (!isYoutube && avgMins > 360) {
      // For Instagram and standard platforms, late average time (> 6 hours) is progressively penalized
      const hoursOver = (avgMins - 360) / 60;
      score -= Math.min(60, 20 + Math.round(hoursOver * 5));
    }
  }

  return score;
}

// Isolated content placed under Suspense to satisfy useSearchParams requirements during prerender/hydration
const SummaryContent = () => {
  const { platform, service, variant, link } = useSelectionFromQuery();
  const { services: all, loading } = useNormalizedServices();
  const { metadata, loading: metaLoading } = useMetadata(link, service);
  const [quantity, setQuantity] = useState<number>(1000);
  const deferredQuantity = React.useDeferredValue(quantity);
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<Category>('recommended');
  const [sliderMode, setSliderMode] = useState<'qty' | 'amount'>('qty');
  const [budgetUsd, setBudgetUsd] = useState<number>(0);
  const [selIndex, setSelIndex] = useState<number>(0);
  const [comments, setComments] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState<string>('');
  
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  
  // State for Service Details Inline Panel
  const [viewingServiceDetails, setViewingServiceDetails] = useState<NormalizedSmmService | null>(null);

  // Filter Drawer State
  const [activeDrawer, setActiveDrawer] = useState<FilterType>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { baseList, availableTagsByType, allSortedTags } = useMemo(() => {
    const bySearch = search.trim().toLowerCase();
    const list = all.filter((s) => {
      // 1. Strictly enforce active platform and service type selection (with synonym tolerance)
      if (!matchesPlatformAndService(s, platform, service)) return false;

      // 2. Enforce variant / sub-category filter
      if (!matchesVariantFilter(s, variant)) return false;

      // 3. Apply search query within selected platform/service
      if (bySearch) {
        const hay = `${s.displayId ?? ''} ${s.source ?? ''} ${s.displayName ?? ''} ${s.providerName ?? ''} ${s.variant ?? ''} ${s.type ?? ''} ${s.category ?? ''} ${s.description ?? ''}`.toLowerCase();
        return hay.includes(bySearch);
      }

      return true;
    });

    const tagCounts = new Map<string, { count: number, type: string }>();
    (list || []).forEach(s => {
      const { tags } = getServiceTags(s);
      (tags || []).forEach(t => {
        if (!t || !t.label) return;
        const existing = tagCounts.get(t.label);
        if (existing) {
          existing.count++;
        } else {
          tagCounts.set(t.label, { count: 1, type: t.type });
        }
      });
    });

    const sortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(entry => ({ label: entry[0], type: entry[1].type, count: entry[1].count }));

    const byType = {
      refill: sortedTags.filter(t => t.type === 'refill').map(t => t.label),
      drop: sortedTags.filter(t => t.type === 'drop').map(t => t.label),
      speed: sortedTags.filter(t => t.type === 'speed').map(t => t.label),
      geo: sortedTags.filter(t => t.type === 'geo').map(t => t.label),
    };

    return { baseList: list || [], availableTagsByType: byType, allSortedTags: sortedTags.map(t => t.label) };
  }, [all, platform, service, variant, search]);

  const filtered = useMemo(() => {
    let list = baseList || [];

    if (selectedTags.length > 0) {
      const selectedByType = {
        refill: selectedTags.filter(t => (availableTagsByType?.refill || []).includes(t)),
        drop: selectedTags.filter(t => (availableTagsByType?.drop || []).includes(t)),
        speed: selectedTags.filter(t => (availableTagsByType?.speed || []).includes(t)),
        geo: selectedTags.filter(t => (availableTagsByType?.geo || []).includes(t)),
      };

      list = list.filter(s => {
        const { tags } = getServiceTags(s);
        const serviceTagLabels = (tags || []).map(t => t.label);

        const matchRefill = selectedByType.refill.length === 0 || selectedByType.refill.some(t => serviceTagLabels.includes(t));
        const matchDrop = selectedByType.drop.length === 0 || selectedByType.drop.some(t => serviceTagLabels.includes(t));
        const matchSpeed = selectedByType.speed.length === 0 || selectedByType.speed.some(t => serviceTagLabels.includes(t));
        const matchGeo = selectedByType.geo.length === 0 || selectedByType.geo.some(t => serviceTagLabels.includes(t));

        return matchRefill && matchDrop && matchSpeed && matchGeo;
      });
    }

    const searched = list;

    // Pre-calculate prices and percentiles globally on baseList (entire category for platform/service, not sub-filtered subset)
    const basePrices = (baseList || []).map(s => s.ratePer1000).sort((a, b) => a - b);
    const baseP33 = basePrices[Math.floor(basePrices.length * 0.33)] ?? 0;
    const baseP66 = basePrices[Math.floor(basePrices.length * 0.66)] ?? Infinity;

    if (category === 'cheapest') {
      const cheapList = searched.filter(s => {
        const badge = getAdminBadge(s);
        if (badge === 'cheapest') return true;
        if (badge === 'premium' || badge === 'recommended') return false; // Exclude premium/recommended from cheapest view
        return s.ratePer1000 <= baseP33 || basePrices.length <= 3;
      });
      const result = cheapList.length > 0 ? cheapList : searched.filter(s => getAdminBadge(s) !== 'premium');
      return result.sort((a, b) => a.ratePer1000 - b.ratePer1000);
    }

    if (category === 'premium') {
      const premiumList = searched.filter(s => {
        const badge = getAdminBadge(s);
        // STRICT RULE 1: Never display a service badged as "Cheapest" inside the Premium tab!
        if (badge === 'cheapest') return false;
        
        // Explicit admin premium badge always passes
        if (badge === 'premium') return true;

        const { tags } = getServiceTags(s);
        const tagList = tags || [];
        const isStable = tagList.find(t => t.type === 'drop')?.label === 'Non Drop' || tagList.find(t => t.type === 'refill')?.label !== 'No Refill';
        const isCostly = s.ratePer1000 >= baseP66;
        return isCostly && isStable;
      });
      
      return premiumList.sort((a, b) => b.ratePer1000 - a.ratePer1000);
    }

    // Best Rated (recommended): Filter out High Drop / No Refill / Unstable services if better ones exist
    const bestRatedList = searched.filter(s => {
      if (searched.length <= 3) return true;
      const { drop, refill, speed } = getServiceTags(s);
      const isHighDrop = drop === 'High Drop';
      const isNoRefill = refill === 'No Refill';
      const isUnstable = speed === 'Unstable';
      
      // Keep service only if it is not High Drop or completely un-refillable and unstable
      return !(isHighDrop || (isNoRefill && isUnstable));
    });

    const finalRecommended = bestRatedList.length > 0 ? bestRatedList : searched;

    return finalRecommended.sort((a, b) => {
      const scoreA = computeBestRatedScore(a);
      const scoreB = computeBestRatedScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      
      // Tie breaker 1: lower average time
      const timeA = parseAvgMins(a);
      const timeB = parseAvgMins(b);
      if (timeA !== timeB) return timeA - timeB;

      // Tie breaker 2: lower price
      return a.ratePer1000 - b.ratePer1000;
    });
  }, [baseList, selectedTags, category, availableTagsByType]);

  const groupedFiltered = useMemo(() => {
    let groups = groupServices(filtered);
    // Hide service groups where requested quantity exceeds the maximum supported capacity
    groups = groups.filter((g) => deferredQuantity <= g.max);

    const getMinPrice = (g: any) => {
      if (!g.variants.length) return 0;
      return Math.min(...g.variants.map((v: any) => v.sellPriceInr ?? v.service.ratePer1000));
    };

    if (category === 'premium') {
      return [...groups].sort((a, b) => getMinPrice(b) - getMinPrice(a));
    }
    if (category === 'recommended') {
      const getGroupBestScore = (g: any) => {
        if (!g.variants.length) return 0;
        return Math.max(...g.variants.map((v: any) => computeBestRatedScore(v.service)));
      };
      return [...groups].sort((a, b) => {
        const scoreDiff = getGroupBestScore(b) - getGroupBestScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return getMinPrice(a) - getMinPrice(b);
      });
    }
    // Default and 'cheapest': Sort strictly from lowest price to highest price
    return [...groups].sort((a, b) => getMinPrice(a) - getMinPrice(b));
  }, [filtered, deferredQuantity, category]);

  const selectedGroup = useMemo(() => {
    if (!selectedServiceId) return null;
    return groupedFiltered.find(g => g.variants.some(v => v.id === selectedServiceId)) || null;
  }, [groupedFiltered, selectedServiceId]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId || !selectedGroup) return null;
    return selectedGroup.variants.find(v => v.id === selectedServiceId)?.service || null;
  }, [selectedServiceId, selectedGroup]);

  const selectedVariantInfo = useMemo(() => {
    if (!selectedServiceId || !selectedGroup) return null;
    return selectedGroup.variants.find(v => v.id === selectedServiceId) || null;
  }, [selectedServiceId, selectedGroup]);

  // Preserve user selection when slider or filters change. Only default if current selection is invalid or filtered out.
  React.useEffect(() => {
    if (!groupedFiltered || groupedFiltered.length === 0) {
      if (selectedServiceId !== null) setSelectedServiceId(null);
      return;
    }

    const isCurrentSelectionValid = selectedServiceId && groupedFiltered.some(g => g.variants.some(v => v.id === selectedServiceId));

    if (!isCurrentSelectionValid && selectedServiceId !== null) {
      setSelectedServiceId(null);
    }
  }, [groupedFiltered, selectedServiceId]);

  const min = useMemo(() => {
    if (selectedGroup) return selectedGroup.min;
    if (groupedFiltered.length === 0) return 50;
    return Math.min(...groupedFiltered.map(g => g.min));
  }, [selectedGroup, groupedFiltered]);

  const max = useMemo(() => {
    if (selectedGroup) return selectedGroup.max;
    if (groupedFiltered.length === 0) return 50000;
    return Math.max(...groupedFiltered.map(g => g.max));
  }, [selectedGroup, groupedFiltered]);
  
  // Use explicit sellPriceInr from the mapped variant, otherwise fallback to first available service rate
  const fallbackRate = groupedFiltered[0]?.variants[0]?.sellPriceInr ?? groupedFiltered[0]?.variants[0]?.service?.ratePer1000 ?? 30;
  const activeSellPrice = selectedVariantInfo?.sellPriceInr ?? selectedService?.ratePer1000 ?? fallbackRate;
  const pricePerUnit = activeSellPrice / 1000;

  // Order state
  const [ordering, setOrdering] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  const showComments = useMemo(() => {
    if (!selectedService) return false;
    const isComments = String(service) === 'comments' || String(service) === 'comment';
    if (!isComments) return false;

    const name = (selectedService.displayName || selectedService.providerName || (selectedService as any).name || '').toLowerCase();
    const cat = (selectedService.category || '').toLowerCase();
    const variant = (selectedService.variant || (selectedService as any).variantName || '').toLowerCase();
    const rawType = ((selectedService.raw as any)?.type || '').toLowerCase();

    // If it's explicitly random comments, user does NOT input custom comments
    const isRandom = variant.includes('random') || name.includes('random') || cat.includes('random') || rawType === 'default';
    if (isRandom && !variant.includes('custom') && !name.includes('custom') && !rawType.includes('custom')) {
      return false;
    }

    // Only show for custom comments
    const isCustom = variant.includes('custom') || name.includes('custom') || cat.includes('custom') || rawType.includes('custom_comments');
    return isCustom;
  }, [selectedService, service]);

  async function handleOrder() {
    if (!selectedService) return setOrderStatus('No service selected');

    if (showComments) {
      if (comments.length === 0) {
        toast.error('Please add at least one comment');
        return;
      }
      if (comments.length < quantity) {
        toast.error(`Please add ${quantity - comments.length} more comments or use Smart Fill`);
        return;
      }
    }

    if (selectedService.customInputRequired && !customInput.trim()) {
      toast.error(`Please enter ${selectedService.customInputLabel || 'required input / answer'}`);
      return;
    }

    setConfirmOpen(true);
  }

  const [savedScroll, setSavedScroll] = useState<number>(0);

  // Wrapper for list card click
  const handleViewDetails = (service: NormalizedSmmService) => {
    setSavedScroll(window.scrollY);
    setViewingServiceDetails(service);
    window.scrollTo(0, 0);
  };

  const handleSelectService = (service: NormalizedSmmService) => {
    if (selectedServiceId === service.id) {
      setSelectedServiceId(null);
    } else {
      setSelectedServiceId(service.id);
    }
  };

  // confirm modal state and handler
  const [confirmOpen, setConfirmOpen] = useState(false);
  async function doConfirmedOrder(finalLink?: string) {
    if (!selectedService) {
      setOrderStatus('No service selected');
      setConfirmOpen(false);
      return;
    }

    const orderLink = (finalLink !== undefined ? finalLink : link).trim();
    if (!orderLink) {
      toast.error('Please enter a target link or username');
      return;
    }
    
    if (quantity > selectedService.max) {
      toast.error(`The selected variant only supports up to ${selectedService.max}. Please select a different variant or reduce the quantity.`);
      setConfirmOpen(false);
      return;
    }

    setConfirmOpen(false);
    setOrdering(true);
    setOrderStatus(null);
    try {
      const payload: any = {
        serviceId: selectedService.id,
        sourceServiceId: selectedService.sourceServiceId,
        quantity,
        link: orderLink,
      };

      if (showComments && comments.length > 0) {
        payload.comments = comments.join('\n');
      }

      if (selectedService.customInputRequired || customInput.trim()) {
        payload.customInput = customInput.trim();
        payload.answer = customInput.trim();
      }

      const res = await fetch(`${getApiBaseUrl()}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      let body;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        body = await res.json();
      } else {
        const text = await res.text();
        body = { error: text || res.statusText };
      }

      // Handle Provider Error (nested inside success/failed response)
      // body.status is "failed" when provider rejected, "success" when all went well
      if (body?.status === "failed" && body?.order?.error) {
        const providerError = String(body.order.error);
        if (providerError.toLowerCase().includes('balance')) {
          toast.error("Insufficient Balance on Provider", {
            description: "We are out of balance on the main server. Please contact support.",
            duration: 5000,
          });
          setOrderStatus(`Provider Error: ${providerError}`);
          return;
        }
        toast.error("Order Failed", { description: providerError });
        setOrderStatus(`Provider Error: ${providerError}`);
        return;
      }

      if (res.status === 402 || (body?.error && body.error.includes("Insufficient balance"))) {
        toast.error("Insufficient Balance", {
          description: "You need to recharge your wallet to place this order.",
          action: {
            label: "Add Funds",
            onClick: () => window.location.href = '/wallet'
          },
          duration: 6000,
        });
        setOrderStatus("Insufficient balance. Please recharge.");
      } else if (res.status === 401) {
        toast.error("Session Expired", { description: "Please login again." });
        setOrderStatus("Session expired. Please login again.");
      } else if (!res.ok) {
        const msg = String(body?.error || JSON.stringify(body));
        toast.error("Order Failed", { description: msg });
        setOrderStatus(msg);
      } else if (body?.status === "success") {
        // Explicit success check — always show green toast
        toast.success("🎉 Order Placed Successfully!", {
          description: "Your order has been submitted and is being processed.",
          duration: 4000,
        });
        setOrderStatus("Order submitted successfully.");
        setTimeout(() => {
          if (body?.order_id) {
            window.location.href = `/orders/${body.order_id}`;
          } else {
            window.location.href = `/orders`;
          }
        }, 1200);
      } else if (body?.error) {
        toast.error("Error", { description: body.error });
        setOrderStatus(body.error);
      } else {
        toast.success("Order Placed Successfully!");
        setOrderStatus("Order submitted successfully.");
        setTimeout(() => {
          window.location.href = `/orders`;
        }, 1200);
      }
    } catch (err: any) {
      setOrderStatus(`Request failed: ${err?.message ?? String(err)}`);
      toast.error("Request Failed", { description: err?.message });
    } finally {
      setOrdering(false);
    }
  }

  const handleSelect = (value: string) => {
    setSelectedTags(prev => 
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    );
  };

  const renderFilterDrawer = () => {
    if (!mounted || !activeDrawer) return null;

    return createPortal(
      <>
        <div className="filter-overlay" onClick={() => setActiveDrawer(null)} />
        <div className="filter-drawer">
          <div className="drawer-handle" />
          <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Filters</h3>
            {selectedTags.length > 0 && (
              <button 
                onClick={() => setSelectedTags([])}
                style={{ background: 'none', border: 'none', color: '#a890ff', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'GM' }}
              >
                Clear All
              </button>
            )}
          </div>
          <div className="drawer-sections">
            {availableTagsByType.geo.length > 0 && (
              <div className="drawer-filter-section">
                <h4>Geo (Region)</h4>
                <div className="filter-chips">
                  {availableTagsByType.geo.map((opt) => (
                    <button
                      key={opt}
                      className={`filter-chip ${selectedTags.includes(opt) ? 'selected' : ''}`}
                      onClick={() => handleSelect(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableTagsByType.speed.length > 0 && (
              <div className="drawer-filter-section">
                <h4>Speed</h4>
                <div className="filter-chips">
                  {availableTagsByType.speed.map((opt) => (
                    <button
                      key={opt}
                      className={`filter-chip ${selectedTags.includes(opt) ? 'selected' : ''}`}
                      onClick={() => handleSelect(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableTagsByType.refill.length > 0 && (
              <div className="drawer-filter-section">
                <h4>Refill</h4>
                <div className="filter-chips">
                  {availableTagsByType.refill.map((opt) => (
                    <button
                      key={opt}
                      className={`filter-chip ${selectedTags.includes(opt) ? 'selected' : ''}`}
                      onClick={() => handleSelect(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableTagsByType.drop.length > 0 && (
              <div className="drawer-filter-section">
                <h4>Drop / Non Drop</h4>
                <div className="filter-chips">
                  {availableTagsByType.drop.map((opt) => (
                    <button
                      key={opt}
                      className={`filter-chip ${selectedTags.includes(opt) ? 'selected' : ''}`}
                      onClick={() => handleSelect(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="drawer-footer">
              <button className="apply-btn" onClick={() => setActiveDrawer(null)}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  };

  const triggerRef = useRef<HTMLDivElement>(null);
  const [sliderAtBottom, setSliderAtBottom] = useState(false);

  React.useEffect(() => {
    if (sliderAtBottom) {
      document.body.classList.add('slider-active');
    } else {
      document.body.classList.remove('slider-active');
    }
    return () => {
      document.body.classList.remove('slider-active');
    };
  }, [sliderAtBottom]);

  React.useEffect(() => {
    if (groupedFiltered.length === 0) {
      setSliderAtBottom(false);
      return;
    }

    const rootEl = document.querySelector('.root');
    if (!rootEl) return;

    const handleScroll = () => {
      if (rootEl.scrollTop > 30) {
        setSliderAtBottom(true);
      } else {
        setSliderAtBottom(false);
      }
    };

    handleScroll();

    rootEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      rootEl.removeEventListener('scroll', handleScroll);
    };
  }, [groupedFiltered.length]);

  return (
    <div className='summary-container'>



      {service === 'followers' ? (
        <FollowerPreview
          primary={service === 'followers' ? (metadata?.followers || 0) + quantity : (metadata?.followers || 0)}
          following={metadata?.following || 0}
          posts={metadata?.posts || 0}
          primaryLabel={(() => {
            if (platform === 'youtube') return 'subscribers';
            if (platform === 'telegram') return 'members';
            return 'followers';
          })()}
          postsLabel={platform === 'youtube' ? 'videos' : 'posts'}
          followingLabel={platform === 'youtube' ? 'subscribed' : 'following'}
          username={(() => {
            if (link) {
              try {
                const u = new URL(link);
                const seg = (u.pathname || '').split('/').filter(Boolean).pop();
                if (seg) return decodeURIComponent(seg.replace(/@/, ''));
                const user = u.searchParams.get('u') || u.searchParams.get('user');
                if (user) return user;
              } catch {
                return link.split('/').filter(Boolean).pop() || 'example_user';
              }
            }
            return 'example_user';
          })()}
          avatarUrl={metadata?.image || '/bg.png'}
          className={`preview ${platform} ${service}`}
          isLoading={metaLoading}
        />
      ) : (
        <PostPreview metric={service} metricCount={quantity} username={link || 'example_post'} imageUrl={metadata?.image} isLoading={metaLoading} />
      )}
      

      <div className="service-list-container">
        <div ref={triggerRef} style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, pointerEvents: 'none' }} />
        <div style={{ display: viewingServiceDetails ? 'none' : 'block' }}>
          <div className="search-wrapper">
            <SearchContainer value={search} onChange={setSearch} onFilterClick={() => setActiveDrawer('all')} />
          </div>
          
          <div className="category-tabs">
            <button className={`tab-btn ${category === 'recommended' ? 'active' : ''}`} onClick={() => setCategory('recommended')}>Best Rated</button>
            <button className={`tab-btn ${category === 'cheapest' ? 'active' : ''}`} onClick={() => setCategory('cheapest')}>Cheapest</button>
            <button className={`tab-btn ${category === 'premium' ? 'active' : ''}`} onClick={() => setCategory('premium')}>Premium</button>
          </div>

          <div className="quick-filters-scroll">
            <button className="quick-filter-btn" onClick={() => setActiveDrawer('all')}>
              <SlidersHorizontal size={14} /> Filters
            </button>
            {allSortedTags.slice(0, 10).map((tag) => (
              <button 
                key={tag}
                className={`quick-filter-btn ${selectedTags.includes(tag) ? 'active' : ''}`} 
                onClick={() => {
                  setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                }}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="showing-label">
            <span>Showing <strong>{groupedFiltered.length}</strong> service groups</span>
          </div>

          <div className="services-list">
            {groupedFiltered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', border: '1px dashed rgba(255, 255, 255, 0.15)', margin: '16px 0' }}>
                <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: '0 0 6px 0' }}>
                  No {category === 'premium' ? 'Premium ' : category === 'cheapest' ? 'Cheapest ' : ''}services matching selected criteria
                </p>
                <p style={{ color: '#888888', fontSize: '12px', margin: 0 }}>
                  Try clearing quick filters or switching to "Best Rated" to view available packages.
                </p>
              </div>
            ) : (
              groupedFiltered.map((group) => (
                <ServiceCard 
                  key={group.id} 
                  group={group} 
                  quantity={quantity} 
                  mode={sliderMode}
                  budgetUsd={budgetUsd}
                  link={link} 
                  selectedServiceId={selectedServiceId || undefined}
                  onSelect={handleSelectService}
                  onViewDetails={handleViewDetails} 
                />
              ))
            )}
          </div>
        </div>

        {viewingServiceDetails && (
          <div className="service-details-inline">
            <ServiceInfoPanel
              services={filtered}
              index={filtered.findIndex(s => s.id === viewingServiceDetails.id)}
              onChangeIndex={(i) => {
                setViewingServiceDetails(filtered[i] || null);
              }}
              activeCategory={category}
              onCategoryChange={setCategory}
              onClose={() => {
                const closingId = viewingServiceDetails?.id;
                setViewingServiceDetails(null);
                setTimeout(() => {
                  const el = document.getElementById(`service-${closingId}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'instant', block: 'center' });
                  } else {
                    window.scrollTo(0, savedScroll);
                  }
                }, 50);
              }}
            />
          </div>
        )}
      </div>

      {groupedFiltered.length > 0 && (
        <div className={`sticky-slider-wrapper bottom-slider ${sliderAtBottom ? 'visible' : 'hidden'}`}>
          <QuantitySlider
            value={quantity}
            mode={sliderMode}
            min={min}
            max={max}
            pricePerUnit={pricePerUnit}
            onChange={setQuantity}
            activeCategory={category}
            onCategoryChange={setCategory}
            onModeChange={setSliderMode}
            onBudgetChange={setBudgetUsd}
            showComments={showComments}
            comments={comments}
            setComments={setComments}
            customInputRequired={selectedService?.customInputRequired}
            customInputLabel={selectedService?.customInputLabel}
            customInput={customInput}
            setCustomInput={setCustomInput}
            onOrder={handleOrder}
            ordering={ordering}
            orderStatus={orderStatus}
          />
        </div>
      )}

      <OrderConfirmModal
        open={confirmOpen}
        service={selectedService}
        quantity={quantity}
        totalPrice={pricePerUnit * quantity}
        initialLink={link}
        ordering={ordering}
        onConfirm={doConfirmedOrder}
        onCancel={() => setConfirmOpen(false)}
      />
      {renderFilterDrawer()}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SummaryContent />
    </Suspense>
  );
}