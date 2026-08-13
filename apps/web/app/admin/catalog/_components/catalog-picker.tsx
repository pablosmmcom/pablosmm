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
  Wand2,
} from "lucide-react";
import { cleanServiceName } from "@/lib/serviceNameSanitizer";
import { getServiceTags } from "@/lib/serviceTags";
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
import { AdminSubmissionsView } from "@/app/admin/providers/verify/_components/admin-submissions-view";

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
  average_time?: any;
  averageTime?: any;
  desc?: string;
}

function formatInrRate(rate: any): string {
  let parsedRate = typeof rate === "string" ? parseFloat(rate) : rate;
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

// ── Stability Tier System ──────────────────────────────────────────
type StabilityTierId = "fast" | "normal" | "slow" | "unstable" | "unknown";

interface StabilityTier {
  id: StabilityTierId;
  label: string;
  color: string;      // text color
  bg: string;         // background color
  dot: string;        // dot color
  sortOrder: number;  // lower = better
}

const STABILITY_TIERS: Record<StabilityTierId, StabilityTier> = {
  fast:     { id: "fast",     label: "Fast",     color: "text-emerald-700", bg: "bg-emerald-50",  dot: "bg-emerald-500", sortOrder: 0 },
  normal:   { id: "normal",   label: "Normal",   color: "text-amber-700",   bg: "bg-amber-50",   dot: "bg-amber-400",   sortOrder: 1 },
  slow:     { id: "slow",     label: "Slow",     color: "text-orange-700",  bg: "bg-orange-50",  dot: "bg-orange-500",  sortOrder: 2 },
  unstable: { id: "unstable", label: "Unstable", color: "text-red-700",     bg: "bg-red-50",     dot: "bg-red-500",     sortOrder: 3 },
  unknown:  { id: "unknown",  label: "No Data",  color: "text-gray-500",    bg: "bg-gray-100",   dot: "bg-gray-400",    sortOrder: 4 },
};

const STABILITY_FILTER_OPTIONS: { value: StabilityTierId | "all"; label: string }[] = [
  { value: "all",      label: "All" },
  { value: "fast",     label: "⚡ Fast" },
  { value: "normal",   label: "✓ Normal" },
  { value: "slow",     label: "🐢 Slow" },
  { value: "unstable", label: "⚠ Unstable" },
  { value: "unknown",  label: "? Unknown" },
];

// Platform-aware thresholds (in minutes)
// YouTube is inherently slow, so it gets 4x more lenient thresholds
const PLATFORM_THRESHOLDS: Record<string, { fast: number; normal: number; slow: number }> = {
  youtube:  { fast: 120,  normal: 720,  slow: 2880 },
  default:  { fast: 30,   normal: 120,  slow: 720  },
};

function getStabilityTier(svc: any): StabilityTier {
  const avgTimeRaw = svc.average_time ?? svc.averageTime;
  if (avgTimeRaw === undefined || avgTimeRaw === null || avgTimeRaw === "" || avgTimeRaw === "N/A") {
    return STABILITY_TIERS.unknown;
  }
  const minutes = typeof avgTimeRaw === "number" ? avgTimeRaw : parseFloat(String(avgTimeRaw));
  if (isNaN(minutes) || minutes <= 0) return STABILITY_TIERS.unknown;

  const platform = (svc.platform || "").toLowerCase();
  const thresholds = PLATFORM_THRESHOLDS[platform] || PLATFORM_THRESHOLDS.default;

  if (minutes <= thresholds.fast)   return STABILITY_TIERS.fast;
  if (minutes <= thresholds.normal) return STABILITY_TIERS.normal;
  if (minutes <= thresholds.slow)   return STABILITY_TIERS.slow;
  return STABILITY_TIERS.unstable;
}

function formatAvgTime(svc: any): string {
  const avgTimeRaw = svc.average_time ?? svc.averageTime;
  if (avgTimeRaw === undefined || avgTimeRaw === null || avgTimeRaw === "" || avgTimeRaw === "N/A") {
    return "No data";
  }
  const minutes = typeof avgTimeRaw === "number" ? avgTimeRaw : parseFloat(String(avgTimeRaw));
  if (isNaN(minutes) || minutes <= 0) return "No data";

  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `~${Math.round(minutes)} min`;
  if (minutes < 1440) {
    const hrs = minutes / 60;
    return hrs < 2 ? `~${Math.round(hrs * 10) / 10} hr` : `~${Math.round(hrs)} hrs`;
  }
  const days = minutes / 1440;
  return days < 2 ? `~${Math.round(days * 10) / 10} day` : `~${Math.round(days)} days`;
}

function StabilityBadge({ svc, size = "sm" }: { svc: any; size?: "sm" | "md" }) {
  const tier = getStabilityTier(svc);
  const isSm = size === "sm";
  return (
    <div className={cn(
      "inline-flex items-center gap-1 rounded-full font-['GPB'] border",
      tier.bg, tier.color,
      isSm ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
      tier.id === "fast" && "border-emerald-200",
      tier.id === "normal" && "border-amber-200",
      tier.id === "slow" && "border-orange-200",
      tier.id === "unstable" && "border-red-200",
      tier.id === "unknown" && "border-gray-200",
    )}>
      <span className={cn("rounded-full", tier.dot, isSm ? "w-1.5 h-1.5" : "w-2 h-2")} />
      {tier.label}
      {tier.id !== "unknown" && (
        <span className="opacity-60 ml-0.5">{formatAvgTime(svc)}</span>
      )}
    </div>
  );
}

function calculateDailySpeed(svc: any): { text: string; speedNum: number | null } {
  const avgTimeRaw = svc.average_time ?? svc.averageTime;
  if (avgTimeRaw === undefined || avgTimeRaw === null || avgTimeRaw === "" || avgTimeRaw === "N/A") {
    return { text: "N/A", speedNum: null };
  }
  const minutes = typeof avgTimeRaw === "number" ? avgTimeRaw : parseFloat(String(avgTimeRaw));
  if (isNaN(minutes) || minutes <= 0) return { text: "N/A", speedNum: null };

  const dailyQty = Math.round((1440 / minutes) * 1000);
  if (dailyQty >= 1000000) {
    return { text: `~${(dailyQty / 1000000).toFixed(1)}M/Day`, speedNum: dailyQty };
  }
  if (dailyQty >= 1000) {
    return { text: `~${Math.round(dailyQty / 1000)}K/Day`, speedNum: dailyQty };
  }
  return { text: `~${dailyQty}/Day`, speedNum: dailyQty };
}

type GeoCode = "all" | "india" | "usa" | "europe" | "arab" | "brazil" | "global";

interface GeoConfig {
  id: GeoCode;
  label: string;
  flag: string;
}

const GEO_CONFIGS: Record<GeoCode, GeoConfig> = {
  all:    { id: "all",    label: "All Geo", flag: "🌐" },
  india:  { id: "india",  label: "India",   flag: "🇮🇳" },
  usa:    { id: "usa",    label: "USA",     flag: "🇺🇸" },
  europe: { id: "europe", label: "Europe",  flag: "🇪🇺" },
  arab:   { id: "arab",   label: "Arab",    flag: "🇦🇪" },
  brazil: { id: "brazil", label: "Brazil",  flag: "🇧🇷" },
  global: { id: "global", label: "Global",  flag: "🌐" },
};

function detectGeo(svc: any): GeoConfig {
  const text = `${svc.rawProviderCategory || svc.providerCategory || svc.category || ""} ${svc.name || svc.providerName || ""}`.toLowerCase();
  
  if (/\b(india|indian|in)\b/.test(text)) return GEO_CONFIGS.india;
  if (/\b(usa|us|america|american)\b/.test(text)) return GEO_CONFIGS.usa;
  if (/\b(uk|england|europe|european|germany|france|spain|italy)\b/.test(text)) return GEO_CONFIGS.europe;
  if (/\b(arab|dubai|uae|saudi|qatar|kuwait|egypt)\b/.test(text)) return GEO_CONFIGS.arab;
  if (/\b(brazil|brasil|br)\b/.test(text)) return GEO_CONFIGS.brazil;
  
  return GEO_CONFIGS.global;
}

interface DisparityResult {
  hasDisparity: boolean;
  maxMismatch?: {
    statedText: string;
    statedNum: number;
    apiMax: number;
  };
  speedMismatch?: {
    statedSpeedText: string;
    statedSpeedNum: number;
    calculatedSpeedText: string;
    calculatedSpeedNum: number;
  };
}

function detectDisparities(svc: any): DisparityResult {
  const name = svc.name || svc.providerName || "";
  const description = svc.desc || svc.description || svc.displayDescription || "";
  const text = `${name} ${description}`;
  const apiMax = Number(svc.max) || 0;

  let maxMismatch: DisparityResult["maxMismatch"] = undefined;
  let speedMismatch: DisparityResult["speedMismatch"] = undefined;

  // 1. Detect Max Limit Mismatch
  if (apiMax > 0) {
    const maxRx = /\bmax[:\s]*(\d+(?:[.,]\d+)?)\s*([km])?\b/i;
    const match = text.match(maxRx);
    if (match) {
      let rawValStr = match[1].replace(/,/g, "");
      let val = parseFloat(rawValStr);
      const unit = (match[2] || "").toLowerCase();
      if (unit === "k") val *= 1000;
      else if (unit === "m") val *= 1000000;

      if (val > 0 && Math.abs(val - apiMax) / apiMax > 0.15) {
        maxMismatch = {
          statedText: match[0],
          statedNum: val,
          apiMax: apiMax,
        };
      }
    }
  }

  // 2. Detect Speed Mismatch (e.g. title says 30K/Day but calculated speed is < 10K/Day)
  const speedObj = calculateDailySpeed(svc);
  if (speedObj.speedNum !== null) {
    const speedRx = /(\d+(?:[.,]\d+)?)\s*([km])?\s*(?:\+\/|\/|per\s*)day/i;
    const speedMatch = name.match(speedRx);
    if (speedMatch) {
      let rawSpeedStr = speedMatch[1].replace(/,/g, "");
      let statedSpeed = parseFloat(rawSpeedStr);
      const unit = (speedMatch[2] || "").toLowerCase();
      if (unit === "k") statedSpeed *= 1000;
      else if (unit === "m") statedSpeed *= 1000000;

      if (statedSpeed > 0 && speedObj.speedNum < statedSpeed * 0.5) {
        speedMismatch = {
          statedSpeedText: speedMatch[0],
          statedSpeedNum: statedSpeed,
          calculatedSpeedText: speedObj.text,
          calculatedSpeedNum: speedObj.speedNum,
        };
      }
    }
  }

  return {
    hasDisparity: Boolean(maxMismatch || speedMismatch),
    maxMismatch,
    speedMismatch,
  };
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


function getStandardCategory(item: any, currentSelectedCategory?: string): string {
  const cat = String(item.type || item.category || "").toLowerCase();
  const STANDARD = ["followers", "likes", "views", "comments", "shares", "story", "reels", "subscribers", "members", "reactions", "mentions"];
  
  if (STANDARD.includes(cat)) {
    return cat;
  }
  
  const text = `${item.category || ''} ${item.type || ''} ${item.name || ''} ${item.displayName || ''} ${item.providerName || ''} ${item.rawProviderCategory || ''}`.toLowerCase();
  if (text.includes('like')) return 'likes';
  if (text.includes('view') || text.includes('reel') || text.includes('video') || text.includes('impression')) return 'views';
  if (text.includes('comment')) return 'comments';
  if (text.includes('story') || text.includes('stories')) return 'story';
  if (text.includes('share') || text.includes('repost') || text.includes('retweet')) return 'shares';
  if (text.includes('follower') || text.includes('member') || text.includes('subscriber')) return 'followers';

  return currentSelectedCategory || "followers";
}

function getStandardPlatform(item: any, currentSelectedPlatform?: string): string {
  const plat = String(item.platform || "").toLowerCase();
  const STANDARD = ["instagram", "facebook", "youtube", "x", "telegram", "whatsapp", "threads", "tiktok", "spotify"];
  
  if (STANDARD.includes(plat)) {
    return plat;
  }
  
  const text = `${item.platform || ''} ${item.category || ''} ${item.name || ''} ${item.displayName || ''} ${item.providerName || ''}`.toLowerCase();
  if (text.includes('facebook') || text.includes('fb')) return 'facebook';
  if (text.includes('youtube') || text.includes('yt')) return 'youtube';
  if (text.includes('twitter') || text.includes('x ')) return 'x';
  if (text.includes('telegram') || text.includes('tg')) return 'telegram';
  if (text.includes('instagram') || text.includes('insta') || text.includes('ig')) return 'instagram';

  return currentSelectedPlatform || "instagram";
}

export function CatalogPicker({ catalogServices, rawServices: initialServices, providerName, providerKey, providerCurrency, onRefresh }: any) {
  const router = useRouter();
  // Navigation tabs: "picker" | "edits" | "sales"
  const [activeTab, setActiveTab] = React.useState<"picker" | "edits" | "sales">("picker");
  const [activeServiceId, setActiveServiceId] = React.useState<string | null>(null);
  // Description always visible — no toggle needed

  const [selectedPlatform, setSelectedPlatform] = React.useState<string>("instagram");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("followers");

  // Search input for raw catalog
  const [catalogSearch, setCatalogSearch] = React.useState<string>("");
  const [selectedRawCategory, setSelectedRawCategory] = React.useState<string>("all");
  const [showOnlyProviderMarked, setShowOnlyProviderMarked] = React.useState<boolean>(false);
  const [stabilityFilter, setStabilityFilter] = React.useState<StabilityTierId | "all">("all");
  const [selectedGeoFilter, setSelectedGeoFilter] = React.useState<GeoCode>("all");

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
  const [multiplierMap, setMultiplierMap] = React.useState<Record<string, string>>({});
  const [badgeMap, setBadgeMap] = React.useState<Record<string, string>>({});
  const [stabilityMap, setStabilityMap] = React.useState<Record<string, string>>({});
  const [modifiedServiceIds, setModifiedServiceIds] = React.useState<Set<string>>(new Set());

  const [globalMultiplier, setGlobalMultiplier] = React.useState<string>("1.5");
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

    const hasFollowerKw = /\bfollowers?\b|\bsubscribers?\b|\bmembers?\b|\bfans?\b/.test(t);
    const hasLikeKw = /\blikes?\b|\bupvotes?\b|\bhearts?\b|\bdislikes?\b/.test(t);
    const hasViewKw = /\bviews?\b|\bimpressions?\b|\bwatch\s*time\b|\bstreams?\b|\bplays?\b/.test(t);
    const hasCommentKw = /\bcomments?\b|\breplies?\b|\breply\b/.test(t);
    const hasShareKw = /\bshares?\b|\bretweets?\b|\bforwards?\b|\breposts?\b/.test(t);

    if (categoryType === "followers") {
      return hasFollowerKw;
    }
    if (categoryType === "likes") {
      return hasLikeKw && !hasFollowerKw;
    }
    if (categoryType === "views") {
      return hasViewKw && !hasLikeKw && !hasFollowerKw && !hasCommentKw;
    }
    if (categoryType === "comments") {
      return hasCommentKw;
    }
    if (categoryType === "shares" || categoryType === "repost") {
      return hasShareKw;
    }
    if (categoryType === "votes") {
      return /\bvotes?\b|\bpolls?\b/.test(t);
    }
    if (categoryType === "reactions") {
      return /\breactions?\b|\bemotes?\b|\bemojis?\b/.test(t);
    }
    if (categoryType === "saves") {
      return /\bsaves?\b|\bbookmarks?\b|\bfavorites?\b/.test(t);
    }
    if (categoryType === "mentions") {
      return /\bmentions?\b/.test(t);
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

  // Saved Catalog Map from pablo_catalog (props)
  const savedCatalogMap = React.useMemo(() => {
    const map = new Map<string, any>();
    if (Array.isArray(catalogServices)) {
      catalogServices.forEach((cs: any) => {
        if (cs.is_active && cs.provider_service_id) {
          map.set(String(cs.provider_service_id), cs);
        }
      });
    }
    return map;
  }, [catalogServices]);

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
    const initMultiplier: Record<string, string> = {};
    const initBadge: Record<string, string> = {};
    const initStability: Record<string, string> = {};

    // 1. Live IDs from saved catalog and submission tags
    const liveIds = new Set(Array.from(savedCatalogMap.keys()));
    initialServices.forEach((s: any) => {
      if (s.hasPendingProviderSubmission || s.pendingProviderStatus === "active" || s.isProviderSubmission || (s.tags && s.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active")))) {
        liveIds.add(getCleanId(s));
      }
    });

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

    // 1.5. Live services are tracked via savedCatalogMap (not placed in workingSelections unless edited)

    // 2. Pre-populate override maps from initialServices & savedCatalogMap
    initialServices.forEach((svc: any) => {
      const id = getCleanId(svc);
      const savedCS = savedCatalogMap.get(id);

      initMin[id] = String(svc.min);
      initMax[id] = String(svc.max);
      let refillVal = (svc as any).refillTag;
      let badgeVal = (svc as any).badge || "auto";
      let stabilityVal = (svc as any).stability || "auto";
      let qualityVal = (svc as any).quality || "High Quality";
      let cancelVal = "auto";
      if (svc.tags && Array.isArray(svc.tags)) {
        svc.tags.forEach((t: string) => {
          if (t.startsWith("badge:")) badgeVal = t.replace("badge:", "");
          if (t.startsWith("stability:")) stabilityVal = t.replace("stability:", "");
          if (t.startsWith("quality:")) qualityVal = t.replace("quality:", "");
          if (t.startsWith("refill:")) refillVal = t.replace("refill:", "");
          if (t.startsWith("proposed_refill:")) refillVal = t.replace("proposed_refill:", "");
          if (t.startsWith("cancel:")) cancelVal = t.replace("cancel:", "");
        });
      }

      initRefill[id] = refillVal || "auto";
      initCancel[id] = cancelVal !== "auto" ? cancelVal : (svc.cancel ? "enabled" : "disabled");
      initQuality[id] = qualityVal;
      initBadge[id] = badgeVal;
      initStability[id] = stabilityVal;
      
      const cleaned = cleanServiceName(svc.displayName || svc.name || svc.providerName || "");

      if (savedCS) {
        initGroupName[id] = savedCS.name || svc.displayName || cleaned.groupName;
        initVariantName[id] = savedCS.variant_name || cleaned.variantName;
        initSellPrice[id] = savedCS.sell_price_inr !== undefined && savedCS.sell_price_inr !== null ? String(savedCS.sell_price_inr) : "";
      } else {
        initGroupName[id] = svc.displayName || cleaned.groupName;
        
        let vName = "";
        let sPrice = "";
        if (svc.tags && Array.isArray(svc.tags)) {
          svc.tags.forEach((t: string) => {
            if (t.startsWith("variant_name:")) vName = t.replace("variant_name:", "");
            if (t.startsWith("sell_price_inr:")) sPrice = t.replace("sell_price_inr:", "");
          });
        }
        if (!vName) {
           vName = (svc as any).refillTag || cleaned.variantName;
           if (vName === "Lifetime Guarantee" || vName.toLowerCase().includes("lifetime")) {
               vName = "365 Days Guarantee";
           }
        }
        if (!sPrice) {
           let baseRate = typeof svc.ratePer1000 === "number" ? svc.ratePer1000 : parseFloat(svc.rate || svc.ratePer1000 || "0");
           const m = parseFloat(globalMultiplier) || 1.5;
           sPrice = Math.ceil(baseRate * m).toString();
        }
        
        let baseR = typeof svc.ratePer1000 === "number" ? svc.ratePer1000 : parseFloat(svc.rate || svc.ratePer1000 || "0");
        let initialM = baseR > 0 ? (parseFloat(sPrice) / baseR).toFixed(2) : "1.00";
        
        initVariantName[id] = vName;
        initSellPrice[id] = sPrice;
        initMultiplier[id] = initialM;
      }
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
    setMultiplierMap((prev) => ({ ...initMultiplier, ...prev }));
    setBadgeMap((prev) => ({ ...initBadge, ...prev }));
    setStabilityMap((prev) => ({ ...initStability, ...prev }));
  }, [initialServices, providerName, savedCatalogMap]);

  // Unique list of provider's raw categories filtered strictly by current platform AND category slot (e.g. Instagram + Likes)
  const rawCategoriesList = React.useMemo(() => {
    const categoriesSet = new Set<string>();

    initialServices.forEach((s: any) => {
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
    return initialServices.filter((s: ServiceItem) => {
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
        const isMarked = savedCatalogMap.has(cleanId) || Object.values(workingSelections).some(slot => slot.some(item => getCleanId(item) === cleanId));
        if (!isMarked) return false;
      }

      // 5. Stability Filter
      if (stabilityFilter !== "all") {
        const tier = getStabilityTier(s);
        if (tier.id !== stabilityFilter) return false;
      }

      // 6. Geo Filter
      if (selectedGeoFilter !== "all") {
        const geo = detectGeo(s);
        if (geo.id !== selectedGeoFilter) return false;
      }

      return true;
    }).sort((a: ServiceItem, b: ServiceItem) => {
      // Smart sort: stability tier first, then price within same tier
      const tierA = getStabilityTier(a).sortOrder;
      const tierB = getStabilityTier(b).sortOrder;
      if (tierA !== tierB) return tierA - tierB;
      const rateA = typeof a.ratePer1000 === "number" ? a.ratePer1000 : parseFloat(a.rate || a.ratePer1000 || "0");
      const rateB = typeof b.ratePer1000 === "number" ? b.ratePer1000 : parseFloat(b.rate || b.ratePer1000 || "0");
      return rateA - rateB;
    });
  }, [initialServices, selectedRawCategory, selectedPlatform, selectedCategory, catalogSearch, showOnlyProviderMarked, stabilityFilter, selectedGeoFilter]);

  React.useEffect(() => {
    if (categoryFilteredServices.length > 0) {
      if (!categoryFilteredServices.some((s: ServiceItem) => getCleanId(s) === activeServiceId)) {
        setActiveServiceId(getCleanId(categoryFilteredServices[0]));
      }
    } else {
      setActiveServiceId(null);
    }
  }, [categoryFilteredServices, activeServiceId]);

  const groupedFilteredServices = React.useMemo(() => {
    const groups: Record<string, ServiceItem[]> = {};
    categoryFilteredServices.forEach((svc: ServiceItem) => {
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

    initialServices.forEach((svc: any) => {
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
  const addServiceToCategory = (service: ServiceItem, silent: boolean = false) => {
    const cleanId = getCleanId(service);
    const existsInCurrent = currentWorkingList.some((item) => getCleanId(item) === cleanId);

    if (existsInCurrent) {
      if (!silent) toast.info(`Service #${cleanId} is already in ${currentPlatformObj.name} ${currentCategoryObj.name}`);
      return;
    }

    setWorkingSelections((prev) => {
      const next: Record<string, ServiceItem[]> = {};
      Object.entries(prev).forEach(([key, items]) => {
        next[key] = items.filter((item: ServiceItem) => getCleanId(item) !== cleanId);
      });
      next[slotKey] = [...(next[slotKey] || []), service];
      return next;
    });

    if (!refillMap[cleanId]) setRefillMap((prev) => ({ ...prev, [cleanId]: "auto" }));
    if (!cancelMap[cleanId]) setCancelMap((prev) => ({ ...prev, [cleanId]: "auto" }));
    if (!minMap[cleanId]) setMinMap((prev) => ({ ...prev, [cleanId]: String(service.min) }));
    if (!maxMap[cleanId]) setMaxMap((prev) => ({ ...prev, [cleanId]: String(service.max) }));
    
    const cleanedAdd = cleanServiceName(service.displayName || service.name || service.providerName || "");
    if (!groupNameMap[cleanId]) setGroupNameMap((prev) => ({ ...prev, [cleanId]: service.displayName || cleanedAdd.groupName }));
    
    if (!variantNameMap[cleanId]) {
      let vName = (service as any).refillTag || cleanedAdd.variantName;
      if (vName === "Lifetime Guarantee" || vName.toLowerCase().includes("lifetime")) {
        vName = "365 Days Guarantee";
      }
      setVariantNameMap((prev) => ({ ...prev, [cleanId]: vName }));
    }
    
    if (!sellPriceMap[cleanId]) {
      let baseRate = typeof service.ratePer1000 === "number" ? service.ratePer1000 : parseFloat(service.rate || service.ratePer1000 || "0");
      const multiplier = parseFloat(globalMultiplier) || 1.5;
      setSellPriceMap((prev) => ({ ...prev, [cleanId]: Math.ceil(baseRate * multiplier).toString() }));
    }

    if (!silent) toast.success(`Added Service #${cleanId} to ${currentPlatformObj.name} → ${currentCategoryObj.name}!`);
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

  const handleFieldChange = (
    field: "groupName" | "variantName" | "sellPrice" | "multiplier" | "badge" | "refillTag" | "stability" | "cancel", 
    value: string, 
    svc: ServiceItem
  ) => {
    const cleanId = getCleanId(svc);
    if (field === "groupName") setGroupNameMap(prev => ({ ...prev, [cleanId]: value }));
    if (field === "variantName") setVariantNameMap(prev => ({ ...prev, [cleanId]: value }));
    if (field === "badge") setBadgeMap(prev => ({ ...prev, [cleanId]: value }));
    if (field === "refillTag") setRefillMap(prev => ({ ...prev, [cleanId]: value }));
    if (field === "stability") setStabilityMap(prev => ({ ...prev, [cleanId]: value }));
    if (field === "cancel") setCancelMap(prev => ({ ...prev, [cleanId]: value }));
    setModifiedServiceIds((prev) => new Set(prev).add(cleanId));
    
    if (field === "sellPrice") {
        setSellPriceMap(prev => ({ ...prev, [cleanId]: value }));
        const baseRate = typeof svc.ratePer1000 === "number" ? svc.ratePer1000 : parseFloat(svc.rate || svc.ratePer1000 || "0");
        const sPrice = parseFloat(value);
        if (baseRate > 0 && !isNaN(sPrice)) {
            setMultiplierMap(prev => ({ ...prev, [cleanId]: (sPrice / baseRate).toFixed(2) }));
        } else if (value === "") {
            setMultiplierMap(prev => ({ ...prev, [cleanId]: "" }));
        }
    }
    
    if (field === "multiplier") {
        setMultiplierMap(prev => ({ ...prev, [cleanId]: value }));
        const baseRate = typeof svc.ratePer1000 === "number" ? svc.ratePer1000 : parseFloat(svc.rate || svc.ratePer1000 || "0");
        const m = parseFloat(value);
        if (baseRate > 0 && !isNaN(m)) {
            setSellPriceMap(prev => ({ ...prev, [cleanId]: (baseRate * m).toFixed(2) }));
        } else if (value === "") {
            setSellPriceMap(prev => ({ ...prev, [cleanId]: "" }));
        }
    }

    // Auto-stage edit into workingSelections if not already present
    if (!currentWorkingList.some(item => getCleanId(item) === cleanId)) {
      addServiceToCategory(svc, true);
    }
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
        .filter((s: any) => s.hasPendingProviderSubmission || s.pendingProviderStatus === "active" || s.isProviderSubmission || (s.tags && s.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active"))))
        .map((s: any) => getCleanId(s))
    );

    initialServices.forEach((svc: any) => {
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
    // 1. Gather all services to update: items in workingSelections AND saved catalog items
    const allServicesToSave = new Map<string, ServiceItem>();

    // Add all working selections
    Object.values(workingSelections).forEach((items) => {
      items.forEach((item) => {
        const cleanId = getCleanId(item);
        if (cleanId) allServicesToSave.set(cleanId, item);
      });
    });

    // Add all saved catalog services
    initialServices.forEach((svc: any) => {
      const cleanId = getCleanId(svc);
      if (cleanId && savedCatalogMap.has(cleanId) && !rejectedSelections.has(cleanId)) {
        if (!allServicesToSave.has(cleanId)) {
          allServicesToSave.set(cleanId, svc);
        }
      }
    });

    // Add any modified services
    modifiedServiceIds.forEach((cleanId) => {
      if (!rejectedSelections.has(cleanId) && !allServicesToSave.has(cleanId)) {
        const match = initialServices.find((s: any) => getCleanId(s) === cleanId);
        if (match) {
          allServicesToSave.set(cleanId, match);
        }
      }
    });

    if (allServicesToSave.size === 0 && rejectedSelections.size === 0) {
      toast.error("Please pick, edit or remove at least 1 service before submitting.");
      return;
    }

    try {
      setIsSubmitting(true);
      const updates: any[] = [];

      allServicesToSave.forEach((item, cleanId) => {
        const sourceId = cleanId;

        // Resolve platform & category slot using robust detection
        const platform = getStandardPlatform(item, selectedPlatform);
        const category = getStandardCategory(item, selectedCategory);

        const cancelSelection = cancelMap[cleanId] || "auto";
        let cancelOverride: boolean | undefined = undefined;
        if (cancelSelection === "enabled") cancelOverride = true;
        if (cancelSelection === "disabled") cancelOverride = false;

        let sellPriceInr: number | undefined = undefined;
        if (sellPriceMap[cleanId] && !isNaN(parseFloat(sellPriceMap[cleanId]))) {
          sellPriceInr = parseFloat(sellPriceMap[cleanId]);
        } else {
          let baseRate = typeof item.ratePer1000 === "number" ? item.ratePer1000 : parseFloat(item.rate || item.ratePer1000 || "0");
          sellPriceInr = Math.ceil(baseRate * 1.5);
        }

        updates.push({
          id: sourceId,
          name: item.name || item.providerName || `Service #${sourceId}`,
          displayName: groupNameMap[cleanId] || item.displayName || item.name || item.providerName,
          status: "active",
          platform,
          category,
          rate: item.rate || item.ratePer1000,
          min: minMap[cleanId] ? parseInt(minMap[cleanId], 10) : item.min,
          max: maxMap[cleanId] ? parseInt(maxMap[cleanId], 10) : item.max,
          refillTag: refillMap[cleanId] || "auto",
          variantName: variantNameMap[cleanId] || "Default",
          sellPriceInr,
          cancel: cancelOverride !== undefined ? cancelOverride : item.cancel,
          quality: qualityMap[cleanId] || "High Quality",
          badge: badgeMap[cleanId] || "auto",
          stability: stabilityMap[cleanId] || "auto"
        });
      });

      rejectedSelections.forEach(id => {
        const sourceId = id.includes(":") ? id.split(":")[1] : id;
        updates.push({
          id: sourceId,
          status: "hidden"
        });
      });

      console.log("[CURATE DEBUG] Sending updates:", JSON.stringify(updates, null, 2));
      console.log("[CURATE DEBUG] providerName:", providerKey || providerName);
      console.log("[CURATE DEBUG] allServicesToSave size:", allServicesToSave.size);
      console.log("[CURATE DEBUG] workingSelections keys:", Object.keys(workingSelections));
      console.log("[CURATE DEBUG] modifiedServiceIds:", [...modifiedServiceIds]);
      console.log("[CURATE DEBUG] savedCatalogMap size:", savedCatalogMap.size, "keys:", [...savedCatalogMap.keys()].slice(0, 10));
      
      const response = await apiClient.post("/provider/services/curate", { providerName: providerKey || providerName, updates });
      console.log("[CURATE DEBUG] API response:", response);
      try {
        const { clearServicesCache } = await import("@/lib/useServices");
        clearServicesCache();
      } catch (e) {}
      toast.success(`Verification submitted successfully! ${updates.length} service(s) saved.`);

      // Clear draft working selections and localStorage
      setWorkingSelections({});
      setRejectedSelections(new Set());
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(`provider_working_selections_${providerName}`);
        } catch (e) {}
      }

      if (typeof onRefresh === "function") {
        onRefresh();
      }
      setActiveTab("edits");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit services");
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
              {providerKey !== "pablosmm" && (
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
              )}
            </div>
          </div>

          {/* Stability & Geo Filter Row */}
          <div className="px-4 py-2.5 flex flex-wrap items-center gap-y-2 gap-x-4 border-b border-gray-100 bg-gray-50/30">
            {/* Speed Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-[10px] font-['GPB'] text-gray-400 uppercase tracking-wider mr-1">Speed:</span>
              {STABILITY_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStabilityFilter(opt.value)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-['GPB'] transition-all border",
                    stabilityFilter === opt.value
                      ? "bg-[#111] text-white border-[#111] shadow-sm"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-gray-200 hidden sm:block" />

            {/* Geo Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-['GPB'] text-gray-400 uppercase tracking-wider mr-1">Geo:</span>
              {Object.values(GEO_CONFIGS).map((geo) => (
                <button
                  key={geo.id}
                  onClick={() => setSelectedGeoFilter(geo.id)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-['GPB'] transition-all border",
                    selectedGeoFilter === geo.id
                      ? "bg-[#111] text-white border-[#111] shadow-sm"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700"
                  )}
                >
                  {geo.flag} {geo.label}
                </button>
              ))}
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
                     let addedCount = 0;
                     let nextRejected = new Set(rejectedSelections);
                     categoryFilteredServices.forEach((svc: ServiceItem) => {
                       const cleanId = getCleanId(svc);
                       const isMarkedByProvider = svc.hasPendingProviderSubmission || svc.isProviderSubmission || svc.status === "active" || (svc.tags && svc.tags.some((t: string) => t.includes("provider_status:active") || t.includes("proposed_status:active")));
                       const isAdded = currentWorkingList.some((item) => getCleanId(item) === cleanId) || (isMarkedByProvider && !nextRejected.has(cleanId));
                       
                       if (!isAdded) {
                         if (nextRejected.has(cleanId)) {
                           nextRejected.delete(cleanId);
                         }
                         if (!currentWorkingList.some((item) => getCleanId(item) === cleanId)) {
                           addServiceToCategory(svc, true);
                           addedCount++;
                         }
                       }
                     });
                     setRejectedSelections(nextRejected);
                     if (addedCount > 0) {
                       toast.success(`Added ${addedCount} services to ${currentPlatformObj.name} → ${currentCategoryObj.name}`);
                     } else {
                       toast.info("All services are already added.");
                     }
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
                        const isSaved = savedCatalogMap.has(cleanId);
                        const isInDraft = currentWorkingList.some((item) => getCleanId(item) === cleanId);
                        const isStagedForRemoval = rejectedSelections.has(cleanId);
                        const isAdded = isInDraft || (isSaved && !isStagedForRemoval);

                        const geo = detectGeo(svc);
                        const calculatedSpeed = calculateDailySpeed(svc);
                        const disparities = detectDisparities(svc);

                        // 4 Core Metadata Attributes (Category, Refill, Drop, Cancel)
                        const categoryVal = svc.rawProviderCategory || svc.providerCategory || svc.category || "";
                        
                        let rawRefill = refillMap[cleanId];
                        if (!rawRefill || rawRefill === "auto") {
                          const { refillLabel } = getServiceTags(svc);
                          rawRefill = refillLabel || (svc.refill ? "30 Days Refill" : "No Refill");
                        }
                        const isRefillActive = rawRefill && rawRefill !== "No Refill" && rawRefill !== "0 Days";

                        const cancelVal = cancelMap[cleanId] && cancelMap[cleanId] !== "auto"
                          ? cancelMap[cleanId] === "enabled"
                          : Boolean(svc.cancel);

                        let dropVal = (qualityMap[cleanId] && qualityMap[cleanId] !== "auto")
                          ? qualityMap[cleanId]
                          : (svc as any).stability || (svc as any).quality || "";

                        if (!dropVal || dropVal === "auto" || dropVal === "default") {
                          const text = `${svc.name || svc.providerName || ""} ${svc.desc || svc.description || ""}`.toLowerCase();
                          if (/\b(non[-\s]?drop|no\s*drop|zero\s*drop)\b/.test(text)) dropVal = "Non-Drop";
                          else if (/\b(low\s*drop|low-drop)\b/.test(text)) dropVal = "Low Drop";
                          else if (/\b(high\s*drop|may\s*drop)\b/.test(text)) dropVal = "High Drop";
                          else dropVal = "Low Drop";
                        }
                        
                        return (
                          <div
                            key={cleanId}
                            onClick={() => {
                              setActiveServiceId(cleanId);
                            }}
                            className={cn(
                              "p-4 rounded-xl border bg-white cursor-pointer transition-all",
                              isSelected
                                ? "border-gray-300 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                                : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
                            )}
                          >
                            {/* Badges Bar */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                              <div className="inline-flex px-2 py-0.5 rounded-full bg-[#111] text-white font-['GPB'] text-[10px]">
                                {cleanId}
                              </div>
                              {isSaved && !isStagedForRemoval && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-['GPB'] text-[10px] border border-emerald-300">
                                  ✓ Saved in Catalog
                                </span>
                              )}
                              {isStagedForRemoval && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-['GPB'] text-[10px] border border-red-300">
                                  ⚠️ Staged for Removal
                                </span>
                              )}
                              <StabilityBadge svc={svc} size="sm" />
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-['GPB'] text-[10px]">
                                {geo.flag} {geo.label}
                              </span>
                              {calculatedSpeed.speedNum !== null && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-['GPB'] text-[10px]">
                                  ⚡ {calculatedSpeed.text}
                                </span>
                              )}
                              {disparities.hasDisparity && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-['GPB'] text-[10px] border border-red-200">
                                  ⚠️ Disparity Alert
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h4 className="text-[13px] font-['GPB'] text-gray-900 leading-[1.3] mb-3">
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
                                  if (isStagedForRemoval) {
                                    setRejectedSelections(prev => { const n = new Set(prev); n.delete(cleanId); return n; });
                                  } else if (isInDraft) {
                                    removeServiceFromCategory(cleanId);
                                  } else if (isSaved) {
                                    removeServiceFromCategory(cleanId);
                                    setRejectedSelections(prev => { const n = new Set(prev); n.add(cleanId); return n; });
                                  } else {
                                    if (rejectedSelections.has(cleanId)) {
                                      setRejectedSelections(prev => { const n = new Set(prev); n.delete(cleanId); return n; });
                                    }
                                    addServiceToCategory(svc);
                                  }
                                }}
                                variant={isStagedForRemoval ? "secondary" : isAdded ? "outline" : "default"}
                                className={cn(
                                  "h-7 text-[11px] rounded-md px-3 font-['GPB']",
                                  isStagedForRemoval
                                    ? "bg-gray-200 hover:bg-gray-300 text-gray-800"
                                    : isAdded 
                                      ? "border-red-200 text-red-600 hover:bg-red-50" 
                                      : "bg-[#44B73B] hover:bg-[#3AA032] text-white"
                                )}
                              >
                                {isStagedForRemoval ? (
                                  "Undo Remove"
                                ) : isInDraft ? (
                                  <>
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Remove Draft
                                  </>
                                ) : isSaved ? (
                                  <>
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Remove
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add to category
                                  </>
                                )}
                              </Button>
                            </div>
                            
                            {/* Manual Mapping Inputs (V2) */}
                            {isAdded && (
                              <div className="mt-3 pt-3 border-t border-gray-100/60 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                                  <p className="text-[10px] text-blue-700 font-['GM'] leading-relaxed">
                                    <strong className="font-['GPB']">Pro Tip:</strong> Use <strong>Group Name</strong> for the main category (e.g. <em>Instagram Followers</em>). Use <strong>Variant Name</strong> for the specific tier (e.g. <em>Max 10K</em>). The system automatically combines them to create the final Card Title (e.g. <em>Instagram Followers — Max 10K</em>).
                                  </p>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-['GPB'] text-gray-500 uppercase tracking-wider block">Group Name (Category)</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cleaned = cleanServiceName(svc.name || svc.providerName || "");
                                        handleFieldChange("groupName", cleaned.groupName, svc);
                                        handleFieldChange("variantName", cleaned.variantName, svc);
                                        toast.success(`Auto-cleaned: "${cleaned.groupName}" (${cleaned.variantName})`);
                                      }}
                                      className="text-[10px] font-['GPB'] text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded transition-colors"
                                    >
                                      <Wand2 className="w-2.5 h-2.5" />
                                      Auto-Clean Name
                                    </button>
                                  </div>
                                  <Input 
                                    value={groupNameMap[cleanId] || ""} 
                                    onChange={(e) => handleFieldChange("groupName", e.target.value, svc)}
                                    placeholder="e.g. Instagram Followers"
                                    className="h-8 text-xs font-['GM']"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-['GPB'] text-gray-500 uppercase tracking-wider mb-1 block">Variant Name (Tier)</label>
                                  <Input 
                                    value={variantNameMap[cleanId] || ""} 
                                    onChange={(e) => handleFieldChange("variantName", e.target.value, svc)}
                                    placeholder="e.g. 30 Days Refill"
                                    className="h-8 text-xs font-['GM']"
                                  />
                                </div>
                                
                                {/* Profit & Pricing Widget */}
                                {(() => {
                                  const baseRate = typeof svc.ratePer1000 === "number" ? svc.ratePer1000 : parseFloat(svc.rate || svc.ratePer1000 || "0");
                                  const sellingPrice = parseFloat(sellPriceMap[cleanId]) || 0;
                                  const profit = sellingPrice - baseRate;
                                  const profitPercent = baseRate > 0 ? (profit / baseRate) * 100 : 0;
                                  const currentMultiplierStr = multiplierMap[cleanId] ?? (baseRate > 0 ? (sellingPrice / baseRate).toFixed(2) : "1.00");

                                  return (
                                    <div className="space-y-4 pt-3 border-t border-gray-100/60 mt-1">
                                        <h4 className="text-[10px] font-['GB'] text-gray-400 uppercase tracking-wider block">Profit & Pricing</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                            <div className="flex flex-col gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-['GPB'] text-gray-500 uppercase tracking-wider block">Selling Price (per 1,000)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-['GB'] text-[14px]">₹</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            className="pl-7 h-9 text-[13px] font-['GB'] text-gray-900"
                                                            value={sellPriceMap[cleanId] || ""}
                                                            onChange={(e) => handleFieldChange("sellPrice", e.target.value, svc)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-['GPB'] text-gray-500 uppercase tracking-wider block flex justify-between">
                                                        <span>Price Multiplier</span>
                                                        <span className="font-['GB'] text-blue-600 lowercase">{currentMultiplierStr}x</span>
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        className="h-8 text-xs font-['GM'] bg-gray-50/50"
                                                        value={currentMultiplierStr}
                                                        onChange={(e) => handleFieldChange("multiplier", e.target.value, svc)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="rounded-xl border bg-blue-50/50 p-4 flex flex-col justify-between h-full border-blue-100/50 shadow-[0_0_10px_rgba(59,130,246,0.03)]">
                                                <div>
                                                    <div className="text-[9px] font-['GPB'] text-blue-600/70 uppercase mb-2 tracking-widest">Profit Analysis</div>
                                                    <div className="flex items-baseline gap-2">
                                                        <div className="text-xl font-['GB'] text-blue-700 tracking-tight">
                                                            ₹{profit.toFixed(2)}
                                                        </div>
                                                        <div className={cn(
                                                            "text-[9px] font-['GPB'] px-2 py-0.5 rounded-full uppercase tracking-tighter border",
                                                            profitPercent > 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                                                        )}>
                                                            {profitPercent > 0 ? "+" : ""}{profitPercent.toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-blue-100/50 flex justify-between items-center text-[10px]">
                                                    <span className="text-gray-500 font-['GM']">Margin on cost</span>
                                                    <span className="font-['GPB'] text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">
                                                        +{profitPercent.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                  );
                                })()}
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
                const activeSvc = categoryFilteredServices.find((s: ServiceItem) => getCleanId(s) === activeServiceId);
                if (!activeSvc)
                  return (
                    <div className="text-center text-xs text-gray-400 mt-10">
                      Select a service to view details
                    </div>
                  );

                const activeTier = getStabilityTier(activeSvc);
                const avgTimeDisplay = formatAvgTime(activeSvc);
                const activeGeo = detectGeo(activeSvc);
                const activeSpeed = calculateDailySpeed(activeSvc);
                const activeDisparities = detectDisparities(activeSvc);
                const rawMinutes = (() => {
                  const raw = (activeSvc as any).average_time ?? (activeSvc as any).averageTime;
                  if (raw === undefined || raw === null || raw === "") return null;
                  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
                  return isNaN(n) || n <= 0 ? null : n;
                })();

                const activeCleanId = getCleanId(activeSvc);

                return (
                  <div className="space-y-6">
                    {/* Disparity Warning Box */}
                    {activeDisparities.hasDisparity && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-['GPB'] text-red-800">
                          <span>⚠️</span>
                          Live Disparity Alert
                        </div>
                        <div className="text-[11px] font-['GM'] text-red-700 space-y-1">
                          {activeDisparities.maxMismatch && (
                            <p>
                              • <strong>Max Limit Disparity:</strong> Title states <strong>{activeDisparities.maxMismatch.statedText}</strong>, but live API Max is <strong>{activeDisparities.maxMismatch.apiMax.toLocaleString()}</strong>. Customers will be capped at live API Max.
                            </p>
                          )}
                          {activeDisparities.speedMismatch && (
                            <p>
                              • <strong>Speed Disparity:</strong> Title states <strong>{activeDisparities.speedMismatch.statedSpeedText}</strong>, but calculated live speed is <strong>{activeDisparities.speedMismatch.calculatedSpeedText}</strong>. Server is running slower than title claims.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stability Banner */}
                    <div className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl border",
                      activeTier.bg,
                      activeTier.id === "fast" && "border-emerald-200",
                      activeTier.id === "normal" && "border-amber-200",
                      activeTier.id === "slow" && "border-orange-200",
                      activeTier.id === "unstable" && "border-red-200",
                      activeTier.id === "unknown" && "border-gray-200",
                    )}>
                      <span className={cn("w-3 h-3 rounded-full shrink-0", activeTier.dot)} />
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-[13px] font-['GPB']", activeTier.color)}>
                          {activeTier.label}
                          {rawMinutes !== null && (
                            <span className="opacity-70 font-['GM'] ml-1.5">
                              — {avgTimeDisplay} per 1K qty
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-['GM'] text-gray-500 mt-0.5">
                          {activeTier.id === "fast" && "Orders complete quickly. Safe to offer."}
                          {activeTier.id === "normal" && "Reasonable delivery speed. Acceptable for most services."}
                          {activeTier.id === "slow" && "Slow delivery. Only offer if no faster alternative exists."}
                          {activeTier.id === "unstable" && "Very slow or broken. Avoid unless it's a niche service."}
                          {activeTier.id === "unknown" && "Provider does not report speed data for this service."}
                        </div>
                      </div>
                      {rawMinutes !== null && (
                        <div className={cn("text-right shrink-0", activeTier.color)}>
                          <div className="text-[18px] font-['GB'] leading-none">{Math.round(rawMinutes)}</div>
                          <div className="text-[9px] font-['GM'] opacity-60">min</div>
                        </div>
                      )}
                    </div>

                    {/* Interactive Service Tagging & Badges Controls */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-['GPB'] text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                          🏷️ Service Tagging & Custom Badges
                        </h4>
                        <span className="text-[10px] font-['GM'] text-gray-500">Service #{activeCleanId}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {/* Catalog Badge / Tag */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-['GPB'] text-gray-600 uppercase tracking-wider block">Badge / Tagging</label>
                          <select
                            value={badgeMap[activeCleanId] || "auto"}
                            onChange={(e) => handleFieldChange("badge", e.target.value, activeSvc)}
                            className="w-full h-8 text-xs font-['GM'] bg-white border border-gray-300 rounded-lg px-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="auto">Auto / Default</option>
                            <option value="Recommended">⭐ Recommended</option>
                            <option value="Best">🔥 Best Selling</option>
                            <option value="Cheapest">💰 Cheapest Rate</option>
                            <option value="Premium">💎 Premium Quality</option>
                          </select>
                        </div>

                        {/* Refill Guarantee */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-['GPB'] text-gray-600 uppercase tracking-wider block">Refill Guarantee</label>
                          <select
                            value={refillMap[activeCleanId] || "auto"}
                            onChange={(e) => handleFieldChange("refillTag", e.target.value, activeSvc)}
                            className="w-full h-8 text-xs font-['GM'] bg-white border border-gray-300 rounded-lg px-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="auto">Auto-Detect</option>
                            <option value="No Refill">❌ No Refill</option>
                            <option value="30 Days">🔄 30 Days Refill</option>
                            <option value="60 Days">🔄 60 Days Refill</option>
                            <option value="90 Days">🔄 90 Days Refill</option>
                            <option value="365 Days">🔄 365 Days Refill</option>
                            <option value="Lifetime">♾️ Lifetime Guarantee</option>
                          </select>
                        </div>

                        {/* Drop & Stability */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-['GPB'] text-gray-600 uppercase tracking-wider block">Drop & Stability</label>
                          <select
                            value={stabilityMap[activeCleanId] || "auto"}
                            onChange={(e) => handleFieldChange("stability", e.target.value, activeSvc)}
                            className="w-full h-8 text-xs font-['GM'] bg-white border border-gray-300 rounded-lg px-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            <option value="auto">Auto-Detect</option>
                            <option value="Non-Drop">🛡️ Non-Drop</option>
                            <option value="Low Drop">📉 Low Drop</option>
                            <option value="May Drop">⚠️ May Drop</option>
                            <option value="High Drop">🔥 High Drop</option>
                          </select>
                        </div>

                        {/* Cancel Feature */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-['GPB'] text-gray-600 uppercase tracking-wider block">Cancel Button</label>
                          <select
                            value={cancelMap[activeCleanId] || "auto"}
                            onChange={(e) => handleFieldChange("cancel", e.target.value, activeSvc)}
                            className="w-full h-8 text-xs font-['GM'] bg-white border border-gray-300 rounded-lg px-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="auto">Auto-Detect</option>
                            <option value="enabled">⚡ Cancel Supported</option>
                            <option value="disabled">🚫 No Cancel</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* User-Side Service Card Live Preview */}
                    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-4 text-white shadow-md border border-indigo-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-['GPB'] uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          Live User Service Card Preview
                        </span>
                        <span className="text-[11px] font-['GPB'] text-emerald-400 flex items-center gap-1">
                          ★ 4.9 <span className="text-gray-400 font-['GM']">(User View)</span>
                        </span>
                      </div>
                      <h4 className="text-sm font-['GB'] text-white line-clamp-1 mb-2">
                        {groupNameMap[activeCleanId] || cleanServiceName(activeSvc.name || activeSvc.providerName || "").groupName}
                      </h4>
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg text-xs font-['GM'] text-indigo-200">
                          <span>{variantNameMap[activeCleanId] || cleanServiceName(activeSvc.name || activeSvc.providerName || "").variantName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-400 mr-1 font-['GM']">Rate:</span>
                          <span className="text-sm font-['GB'] text-emerald-400">
                            ₹{sellPriceMap[activeCleanId] || Math.ceil((activeSvc.rate || activeSvc.ratePer1000 || 0) * 1.5)} <span className="text-[10px] text-gray-400 font-['GM']">/ 1k</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Descriptions Header — always visible */}
                    <div className="flex items-center pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2 px-2.5 py-1 bg-[#F5F5F5] rounded-lg text-[11px] font-['GPB'] text-gray-600">
                        <div className="w-4 h-4 rounded-full bg-[#E0E0E0] flex items-center justify-center text-[9px] text-gray-500">
                          i
                        </div>
                        Description
                      </div>
                    </div>

                    {/* Description Text — always shown */}
                    <div className="text-[12px] font-['GM'] text-gray-600 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar rounded-lg bg-gray-50/60 p-3 border border-gray-100">
                      {activeSvc.desc || activeSvc.description || activeSvc.displayDescription || (
                        <span className="text-gray-400 italic">
                          {`This provider (${providerName}) does not supply a description for this service. Type: ${activeSvc.type || "Default"}`}
                        </span>
                      )}
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-6 pt-6 border-t border-gray-100 mt-auto">
                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">COST / 1K</h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">
                          {formatInrRate(activeSvc.rate || activeSvc.ratePer1000 || 0)}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">MIN</h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">
                          {Number(activeSvc.min)?.toLocaleString() || "10"}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">MAX</h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">
                          {Number(activeSvc.max)?.toLocaleString() || "10,000"}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">REFILL</h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">
                          {activeSvc.refill ? "Available" : "No refill"}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className={cn("text-[15px] font-['GB'] tracking-tight uppercase", activeTier.color)}>
                          AVG TIME
                        </h5>
                        <p className={cn("text-[12px] font-['GPB']", activeTier.color)}>
                          {avgTimeDisplay}
                          {rawMinutes !== null && (
                            <span className="text-[10px] text-gray-400 ml-1">({Math.round(rawMinutes)} min raw)</span>
                          )}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">DAILY SPEED</h5>
                        <p className="text-[12px] font-['GPB'] text-blue-700">
                          {activeSpeed.text}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-b border-gray-200 pb-2">
                        <h5 className="text-[15px] font-['GB'] text-black tracking-tight uppercase">GEO TARGET</h5>
                        <p className="text-[12px] font-['GPB'] text-gray-800">
                          {activeGeo.flag} {activeGeo.label}
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
