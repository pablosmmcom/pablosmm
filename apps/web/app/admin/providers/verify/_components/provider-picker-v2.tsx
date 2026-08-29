"use client";

import * as React from "react";
import {
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Send,
  Music2,
  MessageSquare,
  AtSign,
  Search,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  SendHorizontal,
  Sparkles,
  Layers,
  ShieldCheck,
  Check,
  Zap,
  Folder,
  TrendingUp,
  DollarSign,
  FileText,
  BarChart3,
  ArrowUpRight,
  Clock,
  RefreshCw,
  Edit3,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/admin/utils";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/admin/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Label } from "@/components/admin/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/admin/ui/dialog";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { useCurrency } from "@/components/layout/CurrencyProvider";
import { AdminSubmissionsView } from "./admin-submissions-view";

export interface ServiceItem {
  id: string;
  sourceServiceId: string;
  name?: string;
  providerName?: string;
  category?: string;
  providerCategory?: string;
  rawProviderCategory?: string;
  platform: string;
  type?: string;
  variant?: string;
  ratePer1000: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  status?: "active" | "hidden" | "disabled";
  isHidden?: boolean;
  displayName?: string;
  quality?: string;
  refillTag?: string;
  description?: string;
  displayDescription?: string;
  hasPendingProviderSubmission?: boolean;
  pendingProviderStatus?: string;
  isProviderSubmission?: boolean;
  tags?: string[];
}

function formatInrRate(rate: number): string {
  if (typeof rate !== "number" || isNaN(rate)) return "₹0.00";
  return `₹${rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}
function decodeHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

interface LimitMismatch {
  isMismatch: boolean;
  statedText?: string;
  statedNum?: number;
  apiMax: number;
}

function detectMaxLimitMismatch(name?: string, description?: string, apiMax?: number): LimitMismatch {
  if (!apiMax) return { isMismatch: false, apiMax: 0 };
  const text = `${name || ""} ${description || ""}`;

  const maxRx = /\bmax[:\s]*(\d+(?:[.,]\d+)?)\s*([km])?\b/i;
  const match = text.match(maxRx);

  if (match) {
    let rawValStr = match[1].replace(/,/g, "");
    let val = parseFloat(rawValStr);
    const unit = (match[2] || "").toLowerCase();
    if (unit === "k") val *= 1000;
    else if (unit === "m") val *= 1000000;

    if (val > 0 && Math.abs(val - apiMax) / apiMax > 0.1) {
      return {
        isMismatch: true,
        statedText: match[0],
        statedNum: val,
        apiMax: apiMax,
      };
    }
  }

  return { isMismatch: false, apiMax };
}

// 1. Platforms Config
const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10" },
  { id: "youtube", name: "YouTube", icon: Youtube, color: "text-red-600", bg: "bg-red-600/10" },
  { id: "tiktok", name: "TikTok", icon: Music2, color: "text-zinc-900 dark:text-white", bg: "bg-zinc-500/10" },
  { id: "telegram", name: "Telegram", icon: Send, color: "text-sky-500", bg: "bg-sky-500/10" },
  { id: "facebook", name: "Facebook", icon: Facebook, color: "text-blue-600", bg: "bg-blue-600/10" },
  { id: "x", name: "X (Twitter)", icon: Twitter, color: "text-zinc-900 dark:text-white", bg: "bg-zinc-500/10" },
  { id: "whatsapp", name: "WhatsApp", icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "threads", name: "Threads", icon: AtSign, color: "text-purple-500", bg: "bg-purple-500/10" },
];

// 2. Standard Category Taxonomy
const STANDARD_CATEGORIES: Record<string, { id: string; name: string }[]> = {
  instagram: [
    { id: "followers", name: "Followers" },
    { id: "likes", name: "Likes" },
    { id: "views", name: "Views" },
    { id: "comments", name: "Comments" },
    { id: "shares", name: "Shares" },
    { id: "saves", name: "Saves" },
    { id: "votes", name: "Story Poll Votes" },
    { id: "reactions", name: "Broadcast Reactions" },
    { id: "repost", name: "Reposts" },
  ],
  youtube: [
    { id: "followers", name: "Subscribers" },
    { id: "views", name: "Views & Watch Hours" },
    { id: "likes", name: "Likes & Dislikes" },
    { id: "comments", name: "Comments" },
    { id: "shares", name: "Shares" },
  ],
  tiktok: [
    { id: "followers", name: "Followers" },
    { id: "likes", name: "Likes" },
    { id: "views", name: "Video Views" },
    { id: "comments", name: "Comments" },
    { id: "shares", name: "Shares" },
    { id: "saves", name: "Favorites & Saves" },
  ],
  telegram: [
    { id: "followers", name: "Channel / Group Members" },
    { id: "views", name: "Post Views" },
    { id: "reactions", name: "Emoji Reactions" },
    { id: "shares", name: "Post Forwards & Shares" },
    { id: "votes", name: "Poll Votes" },
  ],
  facebook: [
    { id: "followers", name: "Page Followers & Likes" },
    { id: "likes", name: "Post Likes & Reactions" },
    { id: "reactions", name: "Post & Story Reactions" },
    { id: "views", name: "Video & Reel Views" },
    { id: "comments", name: "Comments" },
    { id: "shares", name: "Shares" },
  ],
  x: [
    { id: "followers", name: "Followers" },
    { id: "likes", name: "Likes" },
    { id: "views", name: "Tweet Views & Impressions" },
    { id: "shares", name: "Retweets & Reposts" },
    { id: "comments", name: "Comments & Replies" },
  ],
  whatsapp: [
    { id: "followers", name: "Channel Members" },
    { id: "reactions", name: "Post Reactions" },
  ],
  threads: [
    { id: "followers", name: "Followers" },
    { id: "likes", name: "Likes" },
    { id: "views", name: "Views" },
  ],
};

const REFILL_OPTIONS = [
  { value: "auto", label: "Auto / API Default" },
  { value: "No Refill", label: "No Refill (0 Days)" },
  { value: "30 Days", label: "30 Days Guarantee" },
  { value: "60 Days", label: "60 Days Guarantee" },
  { value: "90 Days", label: "90 Days Guarantee" },
  { value: "365 Days", label: "365 Days Guarantee" },
  { value: "Lifetime", label: "Lifetime Guarantee" },
];

const CANCEL_OPTIONS = [
  { value: "auto", label: "Auto (API Default)" },
  { value: "enabled", label: "Enable Cancel Button" },
  { value: "disabled", label: "Disable Cancel Button" },
];

const QUALITY_OPTIONS = [
  { value: "High Quality", label: "High Quality (HQ)" },
  { value: "Real Accounts", label: "Real / Active Accounts" },
  { value: "Bot / Cheap", label: "Bot / Budget Quality" },
  { value: "Targeted / Organic", label: "Targeted / Organic" },
];

// Helper to get clean numeric ID string regardless of prefixes
function getCleanId(item: ServiceItem | string): string {
  if (!item) return "";
  if (typeof item === "string") {
    return item.includes(":") ? item.split(":")[1] : item;
  }
  const rawId = String(item.sourceServiceId || item.id || "");
  return rawId.includes(":") ? rawId.split(":")[1] : rawId;
}

// Helper to format money strictly in INR (₹)
function formatInr(rate: number): string {
  if (typeof rate !== "number" || isNaN(rate)) return "₹0.00";
  return `₹${rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

interface ProviderPickerV2Props {
  initialServices: ServiceItem[];
  providerName: string;
}

export function ProviderPickerV2({ initialServices, providerName }: ProviderPickerV2Props) {
  const router = useRouter();
  // Navigation tabs: "picker" | "edits" | "sales"
  const [activeTab, setActiveTab] = React.useState<"picker" | "edits" | "sales">("picker");

  const [selectedPlatform, setSelectedPlatform] = React.useState<string>("instagram");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("followers");

  // Search input for raw catalog
  const [catalogSearch, setCatalogSearch] = React.useState<string>("");
  const [selectedRawCategory, setSelectedRawCategory] = React.useState<string>("all");

  // Map of working selections: key = `${platform}:${category}` -> array of ServiceItem
  const [workingSelections, setWorkingSelections] = React.useState<Record<string, ServiceItem[]>>({});
  
  // Modal state for editing service rules
  const [editingService, setEditingService] = React.useState<ServiceItem | null>(null);
  
  // Custom Override Maps
  const [refillMap, setRefillMap] = React.useState<Record<string, string>>({});
  const [cancelMap, setCancelMap] = React.useState<Record<string, string>>({});
  const [qualityMap, setQualityMap] = React.useState<Record<string, string>>({});
  const [minMap, setMinMap] = React.useState<Record<string, string>>({});
  const [maxMap, setMaxMap] = React.useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const currentPlatformObj = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];
  const CurrentIcon = currentPlatformObj.icon;
  const categoriesList = STANDARD_CATEGORIES[selectedPlatform] || STANDARD_CATEGORIES.instagram;
  const currentCategoryObj = categoriesList.find((c) => c.id === selectedCategory) || categoriesList[0];

  const slotKey = `${selectedPlatform}:${selectedCategory}`;
  const currentWorkingList = workingSelections[slotKey] || [];

  // Reset selectedRawCategory when platform or category changes
  React.useEffect(() => {
    setSelectedRawCategory("all");
  }, [selectedPlatform, selectedCategory]);

  // Strict helper to match platform names without partial word collision
  const matchesPlatformStrict = (text: string, platform: string): boolean => {
    const t = text.toLowerCase();
    if (platform === "instagram") {
      return /\binstagram\b/.test(t) || /\binsta\b/.test(t) || /\big\b/.test(t);
    }
    if (platform === "youtube") {
      return /\byoutube\b/.test(t) || /\byt\b/.test(t);
    }
    if (platform === "tiktok") {
      return /\btiktok\b/.test(t) || /\btt\b/.test(t);
    }
    if (platform === "telegram") {
      return /\btelegram\b/.test(t) || /\btg\b/.test(t);
    }
    if (platform === "facebook") {
      return /\bfacebook\b/.test(t) || /\bfb\b/.test(t);
    }
    if (platform === "x") {
      return /\btwitter\b/.test(t) || /\bx\b/.test(t);
    }
    if (platform === "whatsapp") {
      return /\bwhatsapp\b/.test(t) || /\bwa\b/.test(t);
    }
    if (platform === "threads") {
      return /\bthreads\b/.test(t);
    }
    return false;
  };

  // Strict helper to match category types (followers, likes, views, etc.)
  const matchesCategoryTypeStrict = (text: string, categoryType: string): boolean => {
    const t = text.toLowerCase();
    if (categoryType === "followers") {
      return /\bfollower|\bsubscriber|\bmember|\bfan/.test(t);
    }
    if (categoryType === "likes") {
      return /\blike|\bupvote|\bheart|\bdislike/.test(t);
    }
    if (categoryType === "views") {
      return /\bview|\bimpression|\bwatch\s*time|\bstream|\bplay|\breel|\bhours?\b/.test(t);
    }
    if (categoryType === "comments") {
      return /\bcomment|\breply|\breplies/.test(t);
    }
    if (categoryType === "shares") {
      return /\bshare|\bretweet|\bforward|\brepost/.test(t);
    }
    if (categoryType === "repost") {
      return /\brepost|\bre-post|\bshare|\bretweet|\bforward/.test(t);
    }
    if (categoryType === "votes") {
      return /\bvote|\bpoll/.test(t);
    }
    if (categoryType === "reactions") {
      return /\breaction|\bemote|\bemoji/.test(t);
    }
    if (categoryType === "saves") {
      return /\bsave|\bbookmark|\bfavorite/.test(t);
    }
    if (categoryType === "mentions") {
      return /\bmention/.test(t);
    }
    return false;
  };

  // Helper to accurately resolve platform:category slot key for any service
  const resolveServiceSlotKey = (svc: ServiceItem): string => {
    let p = (svc.platform || "").toLowerCase();
    let t = (svc.type || "").toLowerCase();
    const text = `${svc.rawProviderCategory || svc.providerCategory || svc.category || ""} ${svc.name || svc.providerName || ""}`;

    if (!p || p === "other") {
      if (matchesPlatformStrict(text, "youtube")) p = "youtube";
      else if (matchesPlatformStrict(text, "tiktok")) p = "tiktok";
      else if (matchesPlatformStrict(text, "telegram")) p = "telegram";
      else if (matchesPlatformStrict(text, "facebook")) p = "facebook";
      else if (matchesPlatformStrict(text, "x")) p = "x";
      else if (matchesPlatformStrict(text, "whatsapp")) p = "whatsapp";
      else if (matchesPlatformStrict(text, "threads")) p = "threads";
      else if (matchesPlatformStrict(text, "instagram")) p = "instagram";
      else p = "other";
    }

    if (!t || t === "other" || t === "default") {
      if (matchesCategoryTypeStrict(text, "followers")) t = "followers";
      else if (matchesCategoryTypeStrict(text, "likes")) t = "likes";
      else if (matchesCategoryTypeStrict(text, "views")) t = "views";
      else if (matchesCategoryTypeStrict(text, "comments")) t = "comments";
      else if (matchesCategoryTypeStrict(text, "shares")) t = "shares";
      else if (matchesCategoryTypeStrict(text, "repost")) t = "repost";
      else if (matchesCategoryTypeStrict(text, "votes")) t = "votes";
      else if (matchesCategoryTypeStrict(text, "reactions")) t = "reactions";
      else if (matchesCategoryTypeStrict(text, "saves")) t = "saves";
      else t = "followers";
    }

    return `${p}:${t}`;
  };

  // Save workingSelections to localStorage whenever it changes
  React.useEffect(() => {
    if (typeof window !== "undefined" && providerName) {
      try {
        if (Object.keys(workingSelections).length > 0) {
          localStorage.setItem(`provider_working_selections_${providerName}`, JSON.stringify(workingSelections));
        } else {
          localStorage.removeItem(`provider_working_selections_${providerName}`);
        }
      } catch (err) {}
    }
  }, [workingSelections, providerName]);

  // Pre-populate workingSelections & override maps from initialServices + localStorage on mount
  React.useEffect(() => {
    if (!initialServices || initialServices.length === 0) return;

    const initialSelections: Record<string, ServiceItem[]> = {};
    const initMin: Record<string, string> = {};
    const initMax: Record<string, string> = {};
    const initRefill: Record<string, string> = {};
    const initCancel: Record<string, string> = {};
    const initQuality: Record<string, string> = {};
    // 1. Restore ONLY unsubmitted draft picks from localStorage if available
    if (typeof window !== "undefined" && providerName) {
      try {
        const saved = localStorage.getItem(`provider_working_selections_${providerName}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            // Collect clean IDs of services that are ALREADY submitted / approved on server
            const liveIds = new Set(
              initialServices
                .filter((s: any) => s.hasPendingProviderSubmission || s.pendingProviderStatus === "active" || s.isProviderSubmission || (s.tags && s.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active"))) || s.status === "active" || !s.isHidden)
                .map((s) => getCleanId(s))
            );

            const cleanSelections: Record<string, ServiceItem[]> = {};
            Object.entries(parsed).forEach(([slot, items]: [string, any]) => {
              if (Array.isArray(items)) {
                const unsubmitted = items.filter((item) => !liveIds.has(getCleanId(item)));
                if (unsubmitted.length > 0) {
                  cleanSelections[slot] = unsubmitted;
                }
              }
            });

            if (Object.keys(cleanSelections).length > 0) {
              Object.assign(initialSelections, cleanSelections);
            } else {
              localStorage.removeItem(`provider_working_selections_${providerName}`);
            }
          }
        }
      } catch (err) {}
    }

    // 2. Pre-populate override maps from initialServices
    initialServices.forEach((svc) => {
      const id = getCleanId(svc);
      initMin[id] = String(svc.min);
      initMax[id] = String(svc.max);
      initRefill[id] = (svc as any).refillTag || (svc.refill ? "30 Days" : "No Refill");
      initCancel[id] = svc.cancel ? "enabled" : "disabled";
      initQuality[id] = svc.quality || "High Quality";
    });

    setWorkingSelections((prev) => {
      const merged: Record<string, ServiceItem[]> = { ...initialSelections };
      Object.entries(prev).forEach(([slot, items]) => {
        if (!merged[slot]) {
          merged[slot] = items;
        } else {
          items.forEach((item) => {
            const cleanId = getCleanId(item);
            if (!merged[slot].some((existing) => getCleanId(existing) === cleanId)) {
              merged[slot].push(item);
            }
          });
        }
      });
      return merged;
    });

    setMinMap((prev) => ({ ...initMin, ...prev }));
    setMaxMap((prev) => ({ ...initMax, ...prev }));
    setRefillMap((prev) => ({ ...initRefill, ...prev }));
    setCancelMap((prev) => ({ ...initCancel, ...prev }));
    setQualityMap((prev) => ({ ...initQuality, ...prev }));
  }, [initialServices, providerName]);

  // Unique list of provider's raw categories filtered strictly by current platform AND category slot (e.g. Instagram + Likes)
  const rawCategoriesList = React.useMemo(() => {
    const categoriesSet = new Set<string>();

    initialServices.forEach((s) => {
      const catName = s.rawProviderCategory || s.providerCategory || s.category || "";
      if (!catName) return;

      const p = (s.platform || "").toLowerCase();
      const t = (s.type || "").toLowerCase();
      const combinedText = catName + " " + (s.name || s.providerName || "");

      // 1. Exclude services that explicitly belong to a DIFFERENT platform
      if (p && p !== "other" && p !== selectedPlatform) return;
      if (!p || p === "other") {
        if (!matchesPlatformStrict(combinedText, selectedPlatform)) return;
      }

      // 2. Exclude services that explicitly belong to a DIFFERENT category type
      if (t && t !== "other" && t !== "default" && t !== selectedCategory) return;
      if (!t || t === "other" || t === "default") {
        if (!matchesCategoryTypeStrict(combinedText, selectedCategory)) return;
      }

      categoriesSet.add(catName);
    });

    return Array.from(categoriesSet);
  }, [initialServices, selectedPlatform, selectedCategory]);

  // Services matching selected raw provider category & search query
  const categoryFilteredServices = React.useMemo(() => {
    return initialServices.filter((s) => {
      const catName = s.rawProviderCategory || s.providerCategory || s.category || "";
      const p = (s.platform || "").toLowerCase();
      const t = (s.type || "").toLowerCase();
      const combinedText = catName + " " + (s.name || s.providerName || "");

      // 1. Strict Platform Match (Exclude any service belonging to a different platform)
      if (p && p !== "other" && p !== selectedPlatform) return false;
      if (!p || p === "other") {
        if (!matchesPlatformStrict(combinedText, selectedPlatform)) return false;
      }

      // 2. Raw Category Filter
      if (selectedRawCategory !== "all") {
        if (catName !== selectedRawCategory) return false;
      }

      // Always enforce the type filter to ensure we don't bleed likes into followers
      if (t && t !== "other" && t !== "default" && t !== selectedCategory) return false;
      if (!t || t === "other" || t === "default") {
        if (!matchesCategoryTypeStrict(combinedText, selectedCategory)) return false;
      }

      // 3. Search query filter
      if (catalogSearch.trim()) {
        const query = catalogSearch.toLowerCase().trim();
        const cleanId = getCleanId(s).toLowerCase();
        const rawId = (s.sourceServiceId || s.id || "").toLowerCase();
        const name = (s.name || s.providerName || "").toLowerCase();
        return cleanId.includes(query) || rawId.includes(query) || name.includes(query) || catName.toLowerCase().includes(query);
      }

      return true;
    }).sort((a, b) => {
      const rateA = typeof a.ratePer1000 === "number" ? a.ratePer1000 : parseFloat(a.ratePer1000 || "0");
      const rateB = typeof b.ratePer1000 === "number" ? b.ratePer1000 : parseFloat(b.ratePer1000 || "0");
      return rateA - rateB;
    });
  }, [initialServices, selectedRawCategory, selectedPlatform, selectedCategory, catalogSearch]);

  // Total count of working services across all standard categories
  // Compute live services assigned per platform and category slot
  const liveServicesCounts = React.useMemo(() => {
    const byPlatform: Record<string, number> = {};
    const bySlot: Record<string, number> = {};

    initialServices.forEach((svc) => {
      const isLiveOrPending = svc.hasPendingProviderSubmission || svc.pendingProviderStatus === "active" || svc.isProviderSubmission || (svc.tags && svc.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active"))) || svc.status === "active" || !svc.isHidden;
      
      if (isLiveOrPending) {
        const slotKey = resolveServiceSlotKey(svc);
        
        byPlatform[svc.platform || ""] = (byPlatform[svc.platform || ""] || 0) + 1;
        bySlot[slotKey] = (bySlot[slotKey] || 0) + 1;
      }
    });

    return { byPlatform, bySlot };
  }, [initialServices]);

  const totalWorkingCount = React.useMemo(() => {
    return Object.values(workingSelections).reduce((acc, arr) => acc + arr.length, 0);
  }, [workingSelections]);

  // List of all picked services across all slots for Audit page
  const allPickedServicesList = React.useMemo(() => {
    const list: { service: ServiceItem; slot: string }[] = [];
    Object.entries(workingSelections).forEach(([slot, items]) => {
      items.forEach((svc) => {
        list.push({ service: svc, slot });
      });
    });
    return list;
  }, [workingSelections]);

  // Add service to current category working list
  const addServiceToCategory = (service: ServiceItem) => {
    const cleanId = getCleanId(service);
    const existsInCurrent = currentWorkingList.some((item) => getCleanId(item) === cleanId);

    if (existsInCurrent) {
      toast.info(`Service #${cleanId} is already in ${currentPlatformObj.name} ${currentCategoryObj.name}`);
      return;
    }

    setWorkingSelections((prev) => {
      const next: Record<string, ServiceItem[]> = {};
      Object.entries(prev).forEach(([key, items]) => {
        next[key] = items.filter((item) => getCleanId(item) !== cleanId);
      });
      next[slotKey] = [...(next[slotKey] || []), service];
      return next;
    });

    if (!refillMap[cleanId]) setRefillMap((prev) => ({ ...prev, [cleanId]: service.refill ? "30 Days" : "No Refill" }));
    if (!cancelMap[cleanId]) setCancelMap((prev) => ({ ...prev, [cleanId]: "auto" }));
    if (!minMap[cleanId]) setMinMap((prev) => ({ ...prev, [cleanId]: String(service.min) }));
    if (!maxMap[cleanId]) setMaxMap((prev) => ({ ...prev, [cleanId]: String(service.max) }));

    toast.success(`Added Service #${cleanId} to ${currentPlatformObj.name} → ${currentCategoryObj.name}!`);
  };

  // Remove service from category working list across all slots
  const removeServiceFromCategory = (serviceId: string) => {
    const cleanId = getCleanId(serviceId);
    setWorkingSelections((prev) => {
      const next: Record<string, ServiceItem[]> = {};
      Object.entries(prev).forEach(([key, items]) => {
        next[key] = items.filter((item) => getCleanId(item) !== cleanId);
      });
      return next;
    });
    toast.info(`Removed service #${cleanId} from working list.`);
  };

  // Submit all working services to backend
  const handleSubmit = async () => {
    if (totalWorkingCount === 0) {
      toast.error("Please pick at least 1 working service before submitting.");
      return;
    }

    try {
      setIsSubmitting(true);
      const updates: any[] = [];

      Object.entries(workingSelections).forEach(([key, items]) => {
        const [platform, category] = key.split(":");
        items.forEach((item) => {
          const id = item.id || item.sourceServiceId;
          const sourceId = id.includes(":") ? id.split(":")[1] : id;

          const cancelSelection = cancelMap[id] || "auto";
          let cancelOverride: boolean | undefined = undefined;
          if (cancelSelection === "enabled") cancelOverride = true;
          if (cancelSelection === "disabled") cancelOverride = false;

          updates.push({
            id: sourceId,
            name: item.name || item.providerName || `Service #${sourceId}`,
            status: "active",
            platform,
            category,
            rate: item.ratePer1000,
            min: minMap[id] ? parseInt(minMap[id], 10) : item.min,
            max: maxMap[id] ? parseInt(maxMap[id], 10) : item.max,
            refillTag: refillMap[id] || (item.refill ? "30 Days" : "No Refill"),
            cancel: cancelOverride !== undefined ? cancelOverride : item.cancel,
            quality: qualityMap[id] || "High Quality",
            isProviderSubmission: true,
          });
        });
      });

      await apiClient.post("/provider/services/curate", { providerName, updates });
      toast.success(`Verification submitted successfully! ${updates.length} working service(s) saved.`);

      // Clear draft working selections and localStorage
      setWorkingSelections({});
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(`provider_working_selections_${providerName}`);
        } catch (e) {}
      }

      setActiveTab("edits");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit working services");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock Orders Data for Sales Page
  const mockOrders = [
    { id: "104928", serviceId: "5303", serviceName: "Whatsapp Channel Auto Post Reactions 👍", qty: 25000, amount: 1091.20, date: "2026-08-03 14:10", status: "Completed" },
    { id: "104927", serviceId: "1540", serviceName: "Instagram Followers [30 Days Refill - 50K/D]", qty: 10000, amount: 480.00, date: "2026-08-03 13:45", status: "Completed" },
    { id: "104925", serviceId: "2810", serviceName: "Telegram Channel Members [Non-Drop HQ]", qty: 5000, amount: 320.50, date: "2026-08-03 12:30", status: "In Progress" },
    { id: "104919", serviceId: "3902", serviceName: "YouTube High Retention Views [Monetizable]", qty: 20000, amount: 1540.00, date: "2026-08-03 11:15", status: "Completed" },
    { id: "104910", serviceId: "1540", serviceName: "Instagram Followers [30 Days Refill - 50K/D]", qty: 50000, amount: 2400.00, date: "2026-08-02 21:00", status: "Completed" },
    { id: "104895", serviceId: "4410", serviceName: "TikTok Video Likes [Instant Start]", qty: 15000, amount: 310.00, date: "2026-08-02 18:20", status: "Completed" },
  ];

  const totalBusinessAmount = 248950.00;
  const totalOrdersCount = 4820;

  return (
    <div className="flex flex-col space-y-5 w-full pb-16 max-w-7xl mx-auto px-4 pt-4">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-card to-emerald-500/10 border-2 border-primary/20 p-5 rounded-2xl shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-xl border bg-card shadow-xs shrink-0 bg-primary/10">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {providerName} — Verification & Partner Portal
              <Badge className="bg-emerald-600 text-white font-mono text-xs">
                {totalWorkingCount > 0 ? `${totalWorkingCount} New Draft Picked` : "Active Verification Session"}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
              Verify working panel services, inspect API default Refill & Cancel behavior, and view business analytics.
            </p>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
          <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-xl border">
            <Button
              size="sm"
              variant={activeTab === "picker" ? "default" : "ghost"}
              onClick={() => setActiveTab("picker")}
              className="gap-1.5 text-xs font-bold h-9 px-3 rounded-lg"
            >
              <Layers className="w-3.5 h-3.5" />
              Pick Services
            </Button>

            <Button
              size="sm"
              variant={activeTab === "edits" ? "default" : "ghost"}
              onClick={() => setActiveTab("edits")}
              className="gap-1.5 text-xs font-bold h-9 px-3 rounded-lg relative"
            >
              <FileText className="w-3.5 h-3.5" />
              Submitted Edits
              {totalWorkingCount > 0 && (
                <Badge className="ml-1 bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">
                  {totalWorkingCount}
                </Badge>
              )}
            </Button>

            <Button
              size="sm"
              variant={activeTab === "sales" ? "default" : "ghost"}
              onClick={() => setActiveTab("sales")}
              className="gap-1.5 text-xs font-bold h-9 px-3 rounded-lg border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
              Business & Sales
            </Button>
          </div>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || totalWorkingCount === 0}
            className={cn(
              "gap-1.5 font-bold h-10 px-4 rounded-xl shadow-xs transition-all",
              totalWorkingCount > 0
                ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
            )}
          >
            <SendHorizontal className="w-4 h-4" />
            {isSubmitting
              ? "Submitting..."
              : totalWorkingCount > 0
              ? `Submit Draft (${totalWorkingCount})`
              : "All Verifications Submitted ✅"}
          </Button>
        </div>
      </div>

      {/* VIEW 1: SERVICE PICKER & VERIFICATION */}
      {activeTab === "picker" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT 30% PANEL: Platform & Standard Category Picker */}
          <Card className="lg:col-span-4 flex flex-col border shadow-sm sticky top-4 rounded-xl">
            <CardHeader className="p-4 border-b bg-muted/30">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Standard Taxonomy
              </CardTitle>
              <CardDescription className="text-xs">
                Select platform & standard category slot
              </CardDescription>
            </CardHeader>

            <div className="p-4 space-y-5 max-h-[calc(100vh-14rem)] overflow-y-auto">
              {/* 1. Platform Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">1️⃣ Select Platform</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PLATFORMS.map((p) => {
                    const Icon = p.icon;
                    const isSelected = selectedPlatform === p.id;
                    const count = liveServicesCounts.byPlatform[p.id] || 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPlatform(p.id);
                          const firstCat = STANDARD_CATEGORIES[p.id]?.[0]?.id || "followers";
                          setSelectedCategory(firstCat);
                        }}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-all text-left border relative overflow-hidden",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm font-bold"
                            : "hover:bg-muted/80 bg-background border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2 relative z-10">
                          <Icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary-foreground" : p.color)} />
                          <span className="truncate">{p.name}</span>
                        </div>
                        {count > 0 && (
                          <Badge variant="outline" className={cn("ml-1 text-[9px] px-1.5 py-0 font-mono h-4 items-center justify-center relative z-10", isSelected ? "border-primary-foreground/30 text-primary-foreground bg-primary-foreground/10" : "text-muted-foreground")}>
                            {count} Live
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Standard Category Selector */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>2️⃣ {currentPlatformObj.name} Standard Slots</span>
                  <span className="text-[10px] text-primary">{categoriesList.length} Categories</span>
                </Label>

                <div className="space-y-1">
                  {categoriesList.map((c) => {
                    const isSelected = selectedCategory === c.id;
                    const key = `${selectedPlatform}:${c.id}`;
                    const count = (workingSelections[key] || []).length;
                    const liveCount = liveServicesCounts.bySlot[key] || 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCategory(c.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors border",
                          isSelected
                            ? "bg-secondary text-secondary-foreground border-primary/50 font-bold shadow-xs"
                            : "hover:bg-muted/50 bg-background border-transparent text-muted-foreground"
                        )}
                      >
                        <span className="truncate">{c.name}</span>
                        <div className="flex items-center gap-1.5">
                          {count > 0 && (
                            <Badge className="bg-emerald-500 text-white font-mono text-[9px] px-1 h-4 flex items-center justify-center">
                              {count} Draft
                            </Badge>
                          )}
                          {liveCount > 0 && (
                            <Badge variant="outline" className={cn("font-mono text-[9px] px-1 h-4 flex items-center justify-center", isSelected ? "border-primary/40 text-primary bg-primary/5" : "text-muted-foreground border-border")}>
                              {liveCount} Live
                            </Badge>
                          )}
                          {count === 0 && liveCount === 0 && isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md text-xs font-bold h-11 rounded-xl shrink-0 mt-4 cursor-pointer"
              >
                <SendHorizontal className="w-4 h-4" />
                {isSubmitting ? "Submitting..." : totalWorkingCount > 0 ? `Submit ${totalWorkingCount} Working Services` : "Submit Working Services"}
              </Button>
            </div>
          </Card>

          {/* RIGHT 70% PANEL: Working Services Search & Assignment */}
          <Card className="lg:col-span-8 flex flex-col border shadow-sm p-5 space-y-5 rounded-xl min-h-[600px]">
            
            {/* Active Target Category Slot Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl border bg-card shrink-0", currentPlatformObj.bg)}>
                  <CurrentIcon className={cn("w-6 h-6", currentPlatformObj.color)} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    {currentPlatformObj.name} → {currentCategoryObj.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Pick and assign working services from your panel into this standard category slot.
                  </p>
                </div>
              </div>

              <Badge variant="outline" className="text-xs font-mono px-3 py-1 self-start sm:self-auto border-primary/30 text-primary">
                {currentWorkingList.length} Working Services Assigned
              </Badge>
            </div>

            {/* Controls: Select Provider's Panel Category & Search Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/20 border border-border/70 p-4 rounded-xl">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-primary" /> Select Panel Category ({rawCategoriesList.length} Categories)
                </Label>
                <Select
                  value={selectedRawCategory}
                  onValueChange={(val) => setSelectedRawCategory(val)}
                >
                  <SelectTrigger className="h-10 text-xs bg-background border-border focus:border-primary">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all" className="text-xs font-semibold">
                      📁 All Panel Categories ({initialServices.length} Services)
                    </SelectItem>
                    {rawCategoriesList.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {decodeHtml(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-primary" /> Search Service ID or Title
                </Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Type ID (e.g. 5303) or title keyword..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="pl-9 h-10 text-xs bg-background border-border focus:border-primary"
                  />
                  {catalogSearch && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setCatalogSearch("")}
                      className="absolute right-2 top-2 h-6 text-[10px] text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Catalog Grid for Picking */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Panel Catalog ({categoryFilteredServices.length} Available)
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Click <strong>Add to Slot</strong> to pick a working service
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {categoryFilteredServices.length === 0 ? (
                  <div className="col-span-2 p-8 text-center text-xs text-muted-foreground border-2 border-dashed rounded-xl">
                    No services match the selected category or search filter.
                  </div>
                ) : (
                  categoryFilteredServices.map((svc) => {
                    const cleanId = getCleanId(svc);
                    const id = cleanId;
                    const isAdded = currentWorkingList.some(
                      (item) => getCleanId(item) === cleanId
                    );

                    // Check if assigned in ANY workingSelections slot
                    let assignedSlotName = "";
                    Object.entries(workingSelections).forEach(([slotK, items]) => {
                      if (items.some((item) => getCleanId(item) === cleanId)) {
                        const [p, c] = slotK.split(":");
                        const pObj = PLATFORMS.find((plat) => plat.id === p);
                        const cList = STANDARD_CATEGORIES[p] || [];
                        const cObj = cList.find((cat) => cat.id === c);
                        assignedSlotName = `${pObj?.name || p} → ${cObj?.name || c}`;
                      }
                    });

                    const isAlreadyLive = svc.status === "active" || (!svc.isHidden && svc.status !== "hidden");
                    const limitMismatch = detectMaxLimitMismatch(svc.name || svc.providerName, svc.description, svc.max);

                    return (
                      <div
                        key={id}
                        className={cn(
                          "p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-3",
                          isAdded || assignedSlotName || isAlreadyLive
                            ? "bg-emerald-500/[0.04] border-emerald-500/40 shadow-xs"
                            : "bg-card border-border/80 hover:border-primary/40 hover:bg-accent/20"
                        )}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md shrink-0">
                                #{svc.sourceServiceId || id}
                              </span>
                              {isAlreadyLive && (
                                <Badge className="bg-emerald-600 text-white font-mono text-[9px] px-1.5 py-0">
                                  Already Live in Slot ✅
                                </Badge>
                              )}
                              {assignedSlotName && !isAdded && (
                                <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-mono text-[9px] px-1.5 py-0">
                                  In {assignedSlotName} 🎯
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]" title={decodeHtml(svc.rawProviderCategory || svc.category)}>
                              {decodeHtml(svc.rawProviderCategory || svc.category)}
                            </span>
                          </div>
                          <h5 className="font-semibold text-xs text-foreground line-clamp-2 leading-snug">
                            {decodeHtml(svc.name || svc.providerName)}
                          </h5>
                        </div>

                        {/* API Default Badges for Refill & Cancel */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <Badge variant={svc.refill ? "default" : "outline"} className={svc.refill ? "bg-emerald-600 text-white text-[10px]" : "text-[10px] text-muted-foreground"}>
                            Refill: {svc.refill ? "API Yes ✅" : "API No ❌"}
                          </Badge>
                          <Badge variant={svc.cancel ? "default" : "outline"} className={svc.cancel ? "bg-sky-600 text-white text-[10px]" : "text-[10px] text-muted-foreground"}>
                            Cancel: {svc.cancel ? "API Yes ✅" : "API No ❌"}
                          </Badge>
                          {limitMismatch.isMismatch && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-medium" title={`Title says ${limitMismatch.statedText}, but API returns Max ${svc.max.toLocaleString()}`}>
                              ⚠️ Title says {limitMismatch.statedText} (API Max: {svc.max.toLocaleString()})
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                          <div className="text-[11px] font-mono text-muted-foreground space-x-2">
                            <span>Rate / 1K: <strong className="text-emerald-600 font-bold">{formatInrRate(svc.ratePer1000)}</strong></span>
                            <span>Min: <strong className="text-foreground">{svc.min}</strong></span>
                            <span>Max: <strong className="text-foreground">{svc.max ? svc.max.toLocaleString() : "50,000"}</strong></span>
                          </div>

                          <Button
                            size="xs"
                            onClick={() => (isAdded ? removeServiceFromCategory(id) : addServiceToCategory(svc))}
                            className={cn(
                              "gap-1 font-semibold text-xs h-8 px-3 rounded-lg transition-all shrink-0 cursor-pointer group",
                              isAdded
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-destructive/20 hover:text-destructive border border-emerald-500/30"
                                : isAlreadyLive
                                ? "bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-500/30"
                                : assignedSlotName
                                ? "bg-sky-500/10 hover:bg-sky-600 text-sky-600 dark:text-sky-400 hover:text-white border border-sky-500/30"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            )}
                          >
                            {isAdded ? (
                              <>
                                <Trash2 className="w-3.5 h-3.5 hidden group-hover:inline" />
                                <Check className="w-3.5 h-3.5 group-hover:hidden" />
                                <span className="group-hover:hidden">Picked ✅</span>
                                <span className="hidden group-hover:inline">Remove 🗑️</span>
                              </>
                            ) : isAlreadyLive ? (
                              <>
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Update / Re-Pick</span>
                              </>
                            ) : assignedSlotName ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Move to This Slot</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add to Slot</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* List of Working Services Picked for this Category */}
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Assigned Working Services for {currentPlatformObj.name} → {currentCategoryObj.name} ({currentWorkingList.length})
              </h4>

              {currentWorkingList.length === 0 ? (
                <div className="p-10 text-center text-xs text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
                  <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="font-medium text-foreground">No working services picked for this slot yet.</p>
                  <p className="text-[11px] max-w-md mx-auto text-muted-foreground">
                    Use the search bar above to type your working Service ID or keyword to add it here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentWorkingList.map((svc) => {
                    const id = svc.id || svc.sourceServiceId;
                    const limitMismatch = detectMaxLimitMismatch(svc.name || svc.providerName, svc.description, svc.max);
                    const currentRefill = refillMap[id] || (svc.refill ? "30 Days" : "No Refill");
                    const currentCancel = cancelMap[id] || (svc.cancel ? "API Enabled" : "API Disabled");
                    const currentMin = minMap[id] ? parseInt(minMap[id], 10) : svc.min;
                    const currentMax = maxMap[id] ? parseInt(maxMap[id], 10) : svc.max;

                    return (
                      <div
                        key={id}
                        onClick={() => setEditingService(svc)}
                        className="p-4 border-2 border-emerald-500/40 rounded-xl bg-card hover:bg-accent/10 hover:border-emerald-500 transition-all cursor-pointer space-y-3 relative group shadow-sm flex flex-col justify-between select-none"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                #{svc.sourceServiceId || id}
                              </span>
                              <Badge className="bg-emerald-600 text-white font-mono text-[9px] px-1.5 py-0">
                                VERIFIED SLOT ✅
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingService(svc);
                                }}
                                className="text-xs h-7 px-2 font-bold text-primary hover:bg-primary/10 gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit Rules
                              </Button>

                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeServiceFromCategory(id);
                                }}
                                className="text-xs h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          <h5 className="font-bold text-xs text-foreground line-clamp-2 leading-snug">
                            {decodeHtml(svc.name || svc.providerName)}
                          </h5>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border/40">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-[10px] text-muted-foreground font-mono">Rate per 1k:</span>
                            <strong className="text-emerald-600 font-bold font-mono text-xs">{formatInrRate(svc.ratePer1000)}</strong>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-[10px] text-muted-foreground font-mono">Min - Max Limits:</span>
                            <span className="font-mono text-[11px] font-semibold text-foreground">
                              {currentMin.toLocaleString()} - {currentMax.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                              ♻️ {currentRefill}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] font-mono border-sky-500/30 text-sky-600 bg-sky-500/5">
                              🚫 Cancel: {currentCancel}
                            </Badge>
                            {limitMismatch.isMismatch && (
                              <Badge variant="outline" className="text-[9px] font-mono border-amber-500/40 text-amber-600 bg-amber-500/10">
                                ⚠️ Limit Fix Set
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* VIEW 2: SUBMITTED EDITS & AUDIT STATUS */}
      {activeTab === "edits" && (
        <div className="space-y-6">
          <AdminSubmissionsView isAdmin={false} providerNameFilter={providerName} />
        </div>
      )}

      {/* VIEW 3: SALES & BUSINESS ANALYTICS DASHBOARD */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          {/* Revenue & Growth Header Card */}
          <div className="bg-gradient-to-r from-purple-900 via-zinc-900 to-emerald-950 text-white p-6 rounded-2xl border border-purple-500/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">
                  🏆 Premium Provider Partnership
                </Badge>
                <h3 className="text-2xl font-extrabold tracking-tight">
                  Business Sent to {providerName}
                </h3>
                <p className="text-xs text-purple-200/80 max-w-xl">
                  Overview of total order volume, monthly business revenue, and orders routed to your API endpoint by PabloSMM.
                </p>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="text-xs text-purple-300 font-medium block">Total Business Value</span>
                <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                  {formatInr(totalBusinessAmount / 95.5)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10 text-xs">
              <div>
                <span className="text-purple-300/80 block">Total Orders Routed</span>
                <strong className="text-lg font-bold text-white font-mono">{totalOrdersCount.toLocaleString()} Orders</strong>
              </div>
              <div>
                <span className="text-purple-300/80 block">Average Order Value</span>
                <strong className="text-lg font-bold text-white font-mono">{formatInr(51.65 / 95.5)}</strong>
              </div>
              <div>
                <span className="text-purple-300/80 block">API Success Rate</span>
                <strong className="text-lg font-bold text-emerald-400 font-mono">99.4%</strong>
              </div>
              <div>
                <span className="text-purple-300/80 block">Average Start Speed</span>
                <strong className="text-lg font-bold text-white font-mono">4.2 Minutes</strong>
              </div>
            </div>
          </div>

          {/* Business Insights Callout */}
          <Card className="p-5 border-2 border-emerald-500/30 bg-emerald-500/5 rounded-xl flex items-start gap-4">
            <TrendingUp className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-foreground">High Volume Partner Status</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your panel currently maintains a <strong>99.4% order completion rate</strong> with fast start speeds. We are routing all Instagram, Telegram, and YouTube traffic directly to your API endpoint. Maintain low refill drop rates to unlock higher priority routing!
              </p>
            </div>
          </Card>

          {/* Orders History Table */}
          <Card className="border shadow-sm p-5 space-y-4 rounded-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Recent Routed Orders
                </h4>
                <p className="text-xs text-muted-foreground">
                  Latest 6 live orders placed automatically via your SMM API
                </p>
              </div>

              <Badge variant="outline" className="font-mono text-xs">
                Showing Recent 6 of {totalOrdersCount}
              </Badge>
            </div>

            <div className="border rounded-xl overflow-hidden divide-y text-xs">
              <div className="p-3 bg-muted/40 font-bold grid grid-cols-12 gap-2 text-muted-foreground uppercase">
                <div className="col-span-2">Order ID</div>
                <div className="col-span-4">Service Name & ID</div>
                <div className="col-span-2 text-right">Quantity</div>
                <div className="col-span-2 text-right">Amount (INR)</div>
                <div className="col-span-2 text-right">Status</div>
              </div>

              {mockOrders.map((ord) => (
                <div key={ord.id} className="p-3.5 grid grid-cols-12 gap-2 items-center hover:bg-muted/20">
                  <div className="col-span-2 font-mono font-bold text-primary">
                    #{ord.id}
                  </div>

                  <div className="col-span-4 space-y-0.5">
                    <div className="font-semibold text-foreground line-clamp-1">{ord.serviceName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">Service #{ord.serviceId} • {ord.date}</div>
                  </div>

                  <div className="col-span-2 text-right font-mono font-semibold text-foreground">
                    {ord.qty.toLocaleString()}
                  </div>

                  <div className="col-span-2 text-right font-mono font-bold text-emerald-600">
                    {formatInr(ord.amount / 95.5)}
                  </div>

                  <div className="col-span-2 text-right">
                    <Badge
                      className={cn(
                        "text-[10px] font-mono",
                        ord.status === "Completed" ? "bg-emerald-600 text-white" : "bg-sky-600 text-white"
                      )}
                    >
                      {ord.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Mobile Floating Sticky Footer for instant submission */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border p-3 flex items-center justify-between shadow-2xl">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Working Picked</span>
          <span className="text-xs font-mono text-emerald-600 font-extrabold">{totalWorkingCount} Services</span>
        </div>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 rounded-xl shadow-md cursor-pointer"
        >
          <SendHorizontal className="w-4 h-4" />
          {isSubmitting ? "Submitting..." : totalWorkingCount > 0 ? `Submit (${totalWorkingCount})` : "Submit"}
        </Button>
      </div>

      {/* EDIT SERVICE RULES POPUP MODAL */}
      {editingService && (() => {
        const id = editingService.id || editingService.sourceServiceId;
        const limitMismatch = detectMaxLimitMismatch(editingService.name || editingService.providerName, editingService.description, editingService.max);

        return (
          <Dialog open={Boolean(editingService)} onOpenChange={(open) => !open && setEditingService(null)}>
            <DialogContent className="sm:max-w-lg p-6 rounded-2xl">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-emerald-600" />
                  Edit Verification Rules — #{editingService.sourceServiceId || id}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {decodeHtml(editingService.name || editingService.providerName)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* API Defaults Info Bar */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-3 rounded-xl border border-border/50">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-mono">Rate / 1K (INR)</span>
                    <strong className="text-emerald-600 font-bold text-sm">{formatInrRate(editingService.ratePer1000)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-mono">API Default Limits</span>
                    <strong className="text-foreground font-mono text-xs">{editingService.min} - {editingService.max.toLocaleString()}</strong>
                  </div>
                </div>

                {/* Overrides Selection Controls */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground">Refill Guarantee Duration</Label>
                    <Select
                      value={refillMap[id] || "auto"}
                      onValueChange={(val) => setRefillMap((prev) => ({ ...prev, [id]: val }))}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Select Refill" />
                      </SelectTrigger>
                      <SelectContent>
                        {REFILL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground">Cancel Button Setting</Label>
                    <Select
                      value={cancelMap[id] || "auto"}
                      onValueChange={(val) => setCancelMap((prev) => ({ ...prev, [id]: val }))}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Select Cancel" />
                      </SelectTrigger>
                      <SelectContent>
                        {CANCEL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground">Quality Tag</Label>
                    <Select
                      value={qualityMap[id] || "High Quality"}
                      onValueChange={(val) => setQualityMap((prev) => ({ ...prev, [id]: val }))}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Select Quality" />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Limit Mismatch Banner */}
                  {limitMismatch.isMismatch && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                      <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">
                        ⚠️ Limit Mismatch: Title states <strong>{limitMismatch.statedText}</strong>, but API returned <strong>Max {editingService.max.toLocaleString()}</strong>.
                      </span>
                      {limitMismatch.statedNum && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setMaxMap((prev) => ({ ...prev, [id]: String(limitMismatch.statedNum) }))}
                          className="h-7 text-xs font-bold border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 shrink-0 cursor-pointer"
                        >
                          Fix Max to {limitMismatch.statedNum.toLocaleString()}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Min / Max Override Inputs */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground font-semibold">Min Limit Override</Label>
                      <Input
                        type="number"
                        value={minMap[id] || String(editingService.min)}
                        onChange={(e) => setMinMap((prev) => ({ ...prev, [id]: e.target.value }))}
                        className="h-9 text-xs font-mono bg-background"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground font-semibold">Max Limit Override</Label>
                      <Input
                        type="number"
                        value={maxMap[id] || String(editingService.max)}
                        onChange={(e) => setMaxMap((prev) => ({ ...prev, [id]: e.target.value }))}
                        className="h-9 text-xs font-mono bg-background"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  onClick={() => {
                    toast.success("Rules applied for #" + (editingService.sourceServiceId || id));
                    setEditingService(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full h-10 rounded-xl cursor-pointer"
                >
                  Save & Apply Rules
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
