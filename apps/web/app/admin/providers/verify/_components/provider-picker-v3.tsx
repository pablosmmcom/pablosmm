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
  rate?: any;
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

function formatInrRate(rate: any): string {
  const parsedRate = typeof rate === "string" ? parseFloat(rate) : rate;
  if (typeof parsedRate !== "number" || isNaN(parsedRate)) return "₹0.00";
  return `₹${parsedRate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
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
function getCleanId(item: any | string): string {
  if (!item) return "";
  if (typeof item === "string") {
    return item.includes(":") ? item.split(":")[1] : item;
  }
  const rawId = String(item.service || item.sourceServiceId || item.id || "");
  return rawId.includes(":") ? rawId.split(":")[1] : rawId;
}

// Helper to format money strictly in INR (₹)
function formatInr(rate: number): string {
  if (typeof rate !== "number" || isNaN(rate)) return "₹0.00";
  return `₹${rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

interface ProviderPickerV3Props {
  initialServices: ServiceItem[];
  providerName: string;
}

export function ProviderPickerV3({ initialServices, providerName }: ProviderPickerV3Props) {
  const router = useRouter();
  // Navigation tabs: "picker" | "edits" | "sales"
  const [activeTab, setActiveTab] = React.useState<"picker" | "edits" | "sales">("picker");
  const [activeServiceId, setActiveServiceId] = React.useState<string | null>(null);
  const [showDescription, setShowDescription] = React.useState<boolean>(false);

  const [selectedPlatform, setSelectedPlatform] = React.useState<string>("instagram");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("followers");

  // Search input for raw catalog
  const [catalogSearch, setCatalogSearch] = React.useState<string>("");
  const [selectedRawCategory, setSelectedRawCategory] = React.useState<string>("all");
  const [showOnlyProviderMarked, setShowOnlyProviderMarked] = React.useState<boolean>(false);

  // Map of working selections: key = `${platform}:${category}` -> array of ServiceItem
  const [workingSelections, setWorkingSelections] = React.useState<Record<string, ServiceItem[]>>({});
  const [rejectedSelections, setRejectedSelections] = React.useState<Set<string>>(new Set());
  
  // Modal state for editing service rules
  const [editingService, setEditingService] = React.useState<ServiceItem | null>(null);
  
  // Custom Override Maps
  const [refillMap, setRefillMap] = React.useState<Record<string, string>>({});
  const [cancelMap, setCancelMap] = React.useState<Record<string, string>>({});
  const [qualityMap, setQualityMap] = React.useState<Record<string, string>>({});
  const [minMap, setMinMap] = React.useState<Record<string, string>>({});
  const [maxMap, setMaxMap] = React.useState<Record<string, string>>({});

  // New Override Maps for V2 Manual Mapping
  const [groupNameMap, setGroupNameMap] = React.useState<Record<string, string>>({});
  const [variantNameMap, setVariantNameMap] = React.useState<Record<string, string>>({});
  const [sellPriceMap, setSellPriceMap] = React.useState<Record<string, string>>({});

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
    const initGroupName: Record<string, string> = {};
    const initVariantName: Record<string, string> = {};
    const initSellPrice: Record<string, string> = {};
    // 1. Restore ONLY unsubmitted draft picks from localStorage if available
    const liveIds = new Set(
      initialServices
        .filter((s: any) => s.hasPendingProviderSubmission || s.pendingProviderStatus === "active" || s.isProviderSubmission || (s.tags && s.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active"))) || s.status === "active" || (!s.isHidden && s.category))
        .map((s) => getCleanId(s))
    );

    if (typeof window !== "undefined" && providerName) {
      try {
        const saved = localStorage.getItem(`provider_working_selections_${providerName}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
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

    // 1.5. Pre-populate workingSelections with all ALREADY LIVE services
    // This ensures that metadata edits (refill, quality, cancel) on live services are actually submitted.
    initialServices.forEach((svc) => {
      const cleanId = getCleanId(svc);
      if (liveIds.has(cleanId)) {
        const slot = resolveServiceSlotKey(svc);
        if (!initialSelections[slot]) initialSelections[slot] = [];
        if (!initialSelections[slot].some(s => getCleanId(s) === cleanId)) {
          initialSelections[slot].push(svc);
        }
      }
    });

    // 2. Pre-populate override maps from initialServices
    initialServices.forEach((svc) => {
      const id = getCleanId(svc);
      initMin[id] = String(svc.min);
      initMax[id] = String(svc.max);
      initRefill[id] = (svc as any).refillTag || (svc.refill ? "30 Days" : "No Refill");
      initCancel[id] = svc.cancel ? "enabled" : "disabled";
      initQuality[id] = svc.quality || "High Quality";
      
      initGroupName[id] = svc.displayName || svc.name || svc.providerName || "";
      
      let vName = "";
      let sPrice = "";
      if (svc.tags && Array.isArray(svc.tags)) {
        svc.tags.forEach(t => {
          if (t.startsWith("variant_name:")) vName = t.replace("variant_name:", "");
          if (t.startsWith("sell_price_inr:")) sPrice = t.replace("sell_price_inr:", "");
        });
      }
      if (!vName) {
         // Fallback logic for variant name
         vName = (svc as any).refillTag || (svc.refill ? "30 Days" : "No Refill");
         if (vName === "Lifetime Guarantee" || vName.toLowerCase().includes("lifetime")) {
             vName = "365 Days";
         }
      }
      if (!sPrice) {
         // Fallback logic for price markup (e.g. 1.5x)
         const baseRate = typeof svc.ratePer1000 === "number" ? svc.ratePer1000 : parseFloat(svc.rate || svc.ratePer1000 || "0");
         sPrice = Math.ceil(baseRate * 1.5).toString();
      }
      
      initVariantName[id] = vName;
      initSellPrice[id] = sPrice;
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
    setGroupNameMap((prev) => ({ ...initGroupName, ...prev }));
    setVariantNameMap((prev) => ({ ...initVariantName, ...prev }));
    setSellPriceMap((prev) => ({ ...initSellPrice, ...prev }));
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

      const query = catalogSearch.toLowerCase().trim();
      const cleanId = getCleanId(s).toLowerCase();
      const rawId = (s.sourceServiceId || s.id || "").toLowerCase();
      const name = (s.name || s.providerName || "").toLowerCase();
      
      const isIdMatch = query.length > 0 && (cleanId === query || rawId === query || cleanId.includes(query) || rawId.includes(query));

      if (!isIdMatch) {
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
      }

      // 3. Search query filter
      if (query) {
        if (!isIdMatch && !(name.includes(query) || catName.toLowerCase().includes(query))) {
          return false;
        }
      }

      // 4. Provider Marked Filter
      if (showOnlyProviderMarked) {
        const isMarked = s.hasPendingProviderSubmission || s.isProviderSubmission || s.status === "active" || (s.tags && s.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active")));
        if (!isMarked) return false;
      }

      return true;
    }).sort((a, b) => {
      const rateA = typeof a.ratePer1000 === "number" ? a.ratePer1000 : parseFloat(a.rate || a.ratePer1000 || "0");
      const rateB = typeof b.ratePer1000 === "number" ? b.ratePer1000 : parseFloat(b.rate || b.ratePer1000 || "0");
      return rateA - rateB;
    });
  }, [initialServices, selectedRawCategory, selectedPlatform, selectedCategory, catalogSearch, showOnlyProviderMarked]);

  React.useEffect(() => {
    if (categoryFilteredServices.length > 0) {
      if (!categoryFilteredServices.some(s => getCleanId(s) === activeServiceId)) {
        setActiveServiceId(getCleanId(categoryFilteredServices[0]));
      }
    } else {
      setActiveServiceId(null);
    }
  }, [categoryFilteredServices, activeServiceId]);

  const groupedFilteredServices = React.useMemo(() => {
    const groups: Record<string, ServiceItem[]> = {};
    categoryFilteredServices.forEach(svc => {
      const cat = svc.rawProviderCategory || svc.providerCategory || svc.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(svc);
    });
    return groups;
  }, [categoryFilteredServices]);

  // Total count of working services across all standard categories
  // Compute live services assigned per platform and category slot
  const liveServicesCounts = React.useMemo(() => {
    const byPlatform: Record<string, number> = {};
    const bySlot: Record<string, number> = {};

    initialServices.forEach((svc) => {
      const isMarked = svc.hasPendingProviderSubmission || svc.pendingProviderStatus === "active" || svc.isProviderSubmission || (svc.tags && svc.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active"))) || svc.status === "active";
      const isLiveOrPending = isMarked && !rejectedSelections.has(getCleanId(svc));
      
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
    
    if (!groupNameMap[cleanId]) setGroupNameMap((prev) => ({ ...prev, [cleanId]: service.displayName || service.name || service.providerName || "" }));
    
    if (!variantNameMap[cleanId]) {
      let vName = (service as any).refillTag || (service.refill ? "30 Days" : "No Refill");
      if (vName === "Lifetime Guarantee" || vName.toLowerCase().includes("lifetime")) {
        vName = "365 Days";
      }
      setVariantNameMap((prev) => ({ ...prev, [cleanId]: vName }));
    }
    
    if (!sellPriceMap[cleanId]) {
      const baseRate = typeof service.ratePer1000 === "number" ? service.ratePer1000 : parseFloat(service.rate || service.ratePer1000 || "0");
      setSellPriceMap((prev) => ({ ...prev, [cleanId]: Math.ceil(baseRate * 1.5).toString() }));
    }

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

  // Discard all unsaved drafts and revert to live state
  const resetDrafts = () => {
    if (typeof window !== "undefined" && providerName) {
      try {
        localStorage.removeItem(`provider_working_selections_${providerName}`);
      } catch (err) {}
    }

    setRejectedSelections(new Set());

    const liveSelections: Record<string, ServiceItem[]> = {};
    const liveIds = new Set(
      initialServices
        .filter((s: any) => s.hasPendingProviderSubmission || s.pendingProviderStatus === "active" || s.isProviderSubmission || (s.tags && s.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active"))) || s.status === "active" || (!s.isHidden && s.category))
        .map((s) => getCleanId(s))
    );

    initialServices.forEach((svc) => {
      const cleanId = getCleanId(svc);
      if (liveIds.has(cleanId)) {
        const slot = resolveServiceSlotKey(svc);
        if (!liveSelections[slot]) liveSelections[slot] = [];
        if (!liveSelections[slot].some((s) => getCleanId(s) === cleanId)) {
          liveSelections[slot].push(svc);
        }
      }
    });

    setWorkingSelections(liveSelections);
    toast.info("Discarded unsaved changes. Reverted to last submitted state.");
  };

  // Submit all working services to backend
  const handleSubmit = async () => {
    if (totalWorkingCount === 0 && rejectedSelections.size === 0) {
      toast.error("Please pick or remove at least 1 service before submitting.");
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
            displayName: groupNameMap[id] || item.name || item.providerName,
            status: "active",
            platform,
            category,
            rate: item.rate || item.ratePer1000,
            min: minMap[id] ? parseInt(minMap[id], 10) : item.min,
            max: maxMap[id] ? parseInt(maxMap[id], 10) : item.max,
            refillTag: refillMap[id] || (item.refill ? "30 Days" : "No Refill"),
            variantName: variantNameMap[id] || "Default",
            sellPriceInr: sellPriceMap[id] ? parseFloat(sellPriceMap[id]) : undefined,
            cancel: cancelOverride !== undefined ? cancelOverride : item.cancel,
            quality: qualityMap[id] || "High Quality"
          });
        });
      });

      rejectedSelections.forEach(id => {
        const sourceId = id.includes(":") ? id.split(":")[1] : id;
        updates.push({
          id: sourceId,
          status: "hidden"
        });
      });

      await apiClient.post("/provider/services/curate", { providerName, updates });
      toast.success(`Verification submitted successfully! ${updates.length} working service(s) saved.`);

      // Clear draft working selections and localStorage
      setWorkingSelections({});
      setRejectedSelections(new Set());
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
    <div className="flex-1 w-full h-full font-['GM'] bg-[#F7F8F9] text-gray-900 flex flex-col">
      {/* Main Grid Workspace */}
      <div className="flex flex-col xl:flex-row gap-6 p-4 md:p-6 h-full flex-1">
        {/* LEFT SIDEBAR: Platform & Category */}
        <div className="w-full xl:w-72 shrink-0 space-y-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          {/* Platforms */}
          <div>
            <h3 className="text-sm font-['GPB'] text-gray-800 mb-3">Select Platform</h3>
            <div className="flex flex-wrap gap-2.5">
              {PLATFORMS.map((p) => {
                if (p.id === "threads") return null;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatform(p.id)}
                    className={cn(
                      "w-11 h-11 flex items-center justify-center rounded-xl transition-all",
                      selectedPlatform === p.id
                        ? "bg-gray-100 ring-2 ring-gray-200 scale-105 shadow-sm"
                        : "hover:bg-gray-50 border border-transparent"
                    )}
                  >
                    <img src={`/landing/icons/${p.id}.png`} alt={p.name} className="w-7 h-7 object-contain" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-['GPB'] text-gray-800 mb-3">Select Category</h3>
            <div className="flex flex-wrap gap-2">
              {categoriesList.map((c) => {
                const isSelected = selectedCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-full text-xs transition-all border",
                      isSelected
                        ? "bg-white border-gray-200 shadow-sm font-['GPB'] text-gray-900"
                        : "bg-gray-50 border-transparent text-gray-600 font-['GM'] hover:bg-gray-100"
                    )}
                  >
                    <img
                      src={`/services/${c.id}${isSelected ? "-active" : ""}.png`}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                      alt={c.name}
                      className="w-4 h-4 object-contain opacity-80"
                    />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT WORKSPACE: Services & Details */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[800px] xl:h-[calc(100vh-140px)]">
          {/* Top Toolbar */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
            {/* Raw Category Dropdown */}
            <div className="flex-1 w-full sm:max-w-md">
              <Select value={selectedRawCategory} onValueChange={setSelectedRawCategory}>
                <SelectTrigger className="w-full h-12 bg-white border-gray-200 rounded-xl shadow-sm text-sm font-['GPB']" style={{padding: '24px 12px'}}>
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[10px] font-['GB'] text-gray-400 uppercase tracking-wider">
                      📁 CATEGORY
                    </span>
                    <SelectValue placeholder="All Categories" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {rawCategoriesList.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Bar & Toggle */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search service ID or Title"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="pl-9 h-10 bg-white border-gray-200 rounded-xl text-xs font-['GM']"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOnlyProviderMarked(!showOnlyProviderMarked)}
                className={cn(
                  "h-10 px-4 rounded-xl text-xs font-['GPB'] whitespace-nowrap transition-colors",
                  showOnlyProviderMarked 
                    ? "bg-[#111] text-white border-[#111] hover:bg-black/90 hover:text-white" 
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                {showOnlyProviderMarked ? "Showing Marked" : "Show Marked"}
              </Button>
            </div>
          </div>

          {/* Split Pane Data View */}
          <div className="flex-1 flex flex-col lg:flex-row h-full min-h-[600px] xl:min-h-0 xl:overflow-hidden">
            {/* Left Pane: Services List */}
            <div className="w-full lg:w-1/2 flex flex-col border-r border-gray-100 h-[60vh] lg:h-full">
              {/* Header */}
              <div className="p-3 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
                <span className="text-xs font-['GPB'] text-gray-400">
                  {categoryFilteredServices.length} services total
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                     let nextRejected = new Set(rejectedSelections);
                     categoryFilteredServices.forEach((svc) => {
                       const cleanId = getCleanId(svc);
                       const isMarkedByProvider = svc.hasPendingProviderSubmission || svc.isProviderSubmission || svc.status === "active" || (svc.tags && svc.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active")));
                       const isAdded = currentWorkingList.some((item) => getCleanId(item) === cleanId) || (isMarkedByProvider && !nextRejected.has(cleanId));
                       
                       if (!isAdded) {
                         if (nextRejected.has(cleanId)) {
                           nextRejected.delete(cleanId);
                         }
                         if (!currentWorkingList.some((item) => getCleanId(item) === cleanId)) {
                           addServiceToCategory(svc);
                         }
                       }
                     });
                     setRejectedSelections(nextRejected);
                  }}
                  className="h-7 text-[11px] bg-[#44B73B] hover:bg-[#3AA032] text-white rounded-md px-3 font-['GPB']"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add all services
                </Button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-3 pb-24 space-y-3 bg-[#fbfbfb]">
                {categoryFilteredServices.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">No services found.</div>
                ) : (
                  Object.entries(groupedFilteredServices).map(([catName, services]) => (
                    <div key={catName} className="space-y-3">
                      {selectedRawCategory === "all" && (
                        <div className="sticky top-0 z-10 bg-[#fbfbfb]/95 backdrop-blur-sm py-2">
                          <div className="text-[10px] font-['GB'] text-gray-400 uppercase tracking-wider px-1">
                            {catName}
                          </div>
                        </div>
                      )}
                      {services.map((svc) => {
                        const isSelected = activeServiceId === getCleanId(svc);
                        const cleanId = getCleanId(svc);
                        const isMarkedByProvider = svc.hasPendingProviderSubmission || svc.isProviderSubmission || svc.status === "active" || (svc.tags && svc.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active")));
                        const isAdded = currentWorkingList.some((item) => getCleanId(item) === cleanId) || (isMarkedByProvider && !rejectedSelections.has(cleanId));
                        
                        return (
                          <div
                            key={cleanId}
                            onClick={() => {
                              setActiveServiceId(cleanId);
                              setShowDescription(false);
                            }}
                            className={cn(
                              "p-4 rounded-xl border bg-white cursor-pointer transition-all",
                              isSelected
                                ? "border-gray-300 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                                : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
                            )}
                          >
                            {/* Pill */}
                            <div className="inline-flex px-2 py-0.5 rounded-full bg-[#111] text-white font-['GPB'] text-[10px] mb-2">
                              {cleanId}
                            </div>

                            {/* Title */}
                            <h4 className="text-[13px] font-['GPB'] text-gray-900 leading-[1.3] mb-4">
                              {svc.name || svc.providerName || "Service"}
                            </h4>

                            {/* Footer: Price & Add */}
                            <div className="flex items-end justify-between mt-2 pt-3 border-t border-gray-100/60">
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-['GB'] text-gray-900">
                                  {formatInrRate(svc.rate || svc.ratePer1000 || 0).replace(/\.00$/, '')}
                                </span>
                                <span className="text-[10px] text-gray-400 font-['GM']">/per 1000</span>
                              </div>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isAdded) {
                                    if (currentWorkingList.some((item) => getCleanId(item) === cleanId)) {
                                      removeServiceFromCategory(cleanId);
                                    } else if (isMarkedByProvider) {
                                      setRejectedSelections(prev => { const n = new Set(prev); n.add(cleanId); return n; });
                                    }
                                  } else {
                                    if (rejectedSelections.has(cleanId)) {
                                      setRejectedSelections(prev => { const n = new Set(prev); n.delete(cleanId); return n; });
                                    }
                                    addServiceToCategory(svc);
                                  }
                                }}
                                variant={isAdded ? "outline" : "default"}
                                className={cn(
                                  "h-7 text-[11px] rounded-md px-3 font-['GPB']",
                                  isAdded 
                                    ? "border-red-200 text-red-600 hover:bg-red-50" 
                                    : "bg-[#44B73B] hover:bg-[#3AA032] text-white"
                                )}
                              >
                                {isAdded ? (
                                  <Trash2 className="w-3 h-3 mr-1" />
                                ) : (
                                  <Plus className="w-3 h-3 mr-1" />
                                )}
                                {isAdded ? (isMarkedByProvider && !currentWorkingList.some((item) => getCleanId(item) === cleanId) ? "Unmark" : "Remove") : "Add to category"}
                              </Button>
                            </div>
                            
                            {/* Manual Mapping Inputs (V2) */}
                            {isAdded && (
                              <div className="mt-3 pt-3 border-t border-gray-100/60 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                                <div>
                                  <label className="text-[10px] font-['GPB'] text-gray-500 uppercase tracking-wider mb-1 block">Group Name</label>
                                  <Input 
                                    value={groupNameMap[cleanId] || ""} 
                                    onChange={(e) => setGroupNameMap(prev => ({ ...prev, [cleanId]: e.target.value }))}
                                    placeholder="e.g. Instagram Followers HQ"
                                    className="h-8 text-xs font-['GM']"
                                  />
                                </div>
                                <div className="flex gap-3">
                                  <div className="flex-1">
                                    <label className="text-[10px] font-['GPB'] text-gray-500 uppercase tracking-wider mb-1 block">Variant Name</label>
                                    <Input 
                                      value={variantNameMap[cleanId] || ""} 
                                      onChange={(e) => setVariantNameMap(prev => ({ ...prev, [cleanId]: e.target.value }))}
                                      placeholder="e.g. 30 Days Refill"
                                      className="h-8 text-xs font-['GM']"
                                    />
                                  </div>
                                  <div className="w-24">
                                    <label className="text-[10px] font-['GPB'] text-gray-500 uppercase tracking-wider mb-1 block">Sell Price (₹)</label>
                                    <Input 
                                      value={sellPriceMap[cleanId] || ""} 
                                      onChange={(e) => setSellPriceMap(prev => ({ ...prev, [cleanId]: e.target.value }))}
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      className="h-8 text-xs font-['GM']"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Pane: Service Details */}
            <div className="w-full lg:w-1/2 flex flex-col bg-white overflow-y-auto p-6 pb-28 relative shadow-[0_-8px_20px_rgba(0,0,0,0.08)] z-10 lg:shadow-none lg:z-auto">
              {(() => {
                const activeSvc = categoryFilteredServices.find((s) => getCleanId(s) === activeServiceId);
                if (!activeSvc)
                  return (
                    <div className="text-center text-xs text-gray-400 mt-10">
                      Select a service to view details
                    </div>
                  );

                // Use API averageTime if exists, else fallback
                const avgTime = (activeSvc as any).average_time || (activeSvc as any).averageTime || "Not specified";

                return (
                  <div className="space-y-6">
                    {/* Descriptions Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2 px-2.5 py-1 bg-[#F5F5F5] rounded-lg text-[11px] font-['GPB'] text-gray-600">
                        <div className="w-4 h-4 rounded-full bg-[#E0E0E0] flex items-center justify-center text-[9px] text-gray-500">
                          i
                        </div>
                        Descriptions
                      </div>
                      <span 
                        onClick={() => setShowDescription(!showDescription)}
                        className="text-[10px] font-['GB'] text-gray-500 cursor-pointer hover:text-gray-900 transition-colors"
                      >
                        {showDescription ? "HIDE" : "SHOW"}
                      </span>
                    </div>

                    {/* Description Text */}
                    {showDescription && (
                      <div className="text-[12px] font-['GM'] text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {activeSvc.description || activeSvc.displayDescription || "No description provided by the API."}
                      </div>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-6 pt-6 border-t border-gray-100 mt-auto">
                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">MIN</h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">
                          {activeSvc.min?.toLocaleString() || "10"}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">REFILL</h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">
                          {activeSvc.refill ? "Available" : "No refill"}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">
                          AVERAGE TIME
                        </h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">{avgTime}</p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">MAX</h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">
                          {activeSvc.max?.toLocaleString() || "10,000"}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">CANCEL</h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">
                          {activeSvc.cancel ? "Available" : "Not available"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Submit Action */}
      {(totalWorkingCount > 0 || rejectedSelections.size > 0) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
           <div className="bg-[#111] text-white p-3 rounded-full flex items-center gap-4 shadow-2xl border border-white/10 pr-4">
              <div className="flex items-center gap-4 pl-2">
                 {totalWorkingCount > 0 && (
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-['GPB'] text-[13px]">
                       {totalWorkingCount}
                     </div>
                     <span className="text-xs font-['GM'] text-gray-300">Added</span>
                   </div>
                 )}
                 {rejectedSelections.size > 0 && (
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-['GPB'] text-[13px]">
                       {rejectedSelections.size}
                     </div>
                     <span className="text-xs font-['GM'] text-gray-300">Removed</span>
                   </div>
                 )}
              </div>
              <div className="flex items-center">
                <Button 
                   onClick={resetDrafts}
                   disabled={isSubmitting}
                   className="h-9 bg-transparent hover:bg-white/10 text-gray-300 hover:text-white font-['GPB'] rounded-full px-4 text-[13px] ml-2 border border-transparent"
                >
                   Undo
                </Button>
                <Button 
                   onClick={handleSubmit}
                   disabled={isSubmitting}
                   className="h-9 bg-white hover:bg-gray-100 text-black font-['GPB'] rounded-full px-5 text-[13px] ml-2"
                >
                   {isSubmitting ? "Submitting..." : "Submit Selection"}
                </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
