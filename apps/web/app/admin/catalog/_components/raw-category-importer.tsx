"use client";

import * as React from "react";
import { apiClient } from "@/lib/apiClient";
import { clearServicesCache } from "@/lib/useServices";
import { toast } from "sonner";
import { Search, Sparkles, Plus, Check, ChevronDown, ChevronRight, Layers, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { cn } from "@/lib/utils";

interface ServiceItem {
  id: string;
  service?: string;
  sourceServiceId?: string;
  name?: string;
  providerName?: string;
  category?: string;
  rawProviderCategory?: string;
  providerCategory?: string;
  platform?: string;
  rate?: number | string;
  ratePer1000?: number | string;
  min?: number;
  max?: number;
  refill?: boolean | string;
  cancel?: boolean;
}

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: "/landing/icons/instagram.png" },
  { id: "facebook", name: "Facebook", icon: "/landing/icons/facebook.png" },
  { id: "youtube", name: "YouTube", icon: "/landing/icons/youtube.png" },
  { id: "telegram", name: "Telegram", icon: "/landing/icons/telegram.png" },
  { id: "whatsapp", name: "WhatsApp", icon: "/landing/icons/whatsapp.png" },
  { id: "x", name: "Twitter / X", icon: "/landing/icons/x.png" },
  { id: "tiktok", name: "TikTok", icon: "/landing/icons/tiktok.png" },
];

// Helper to clean ID
function getCleanId(item: any): string {
  if (!item) return "";
  const rawId = String(item.service || item.sourceServiceId || item.id || "");
  return rawId.includes(":") ? rawId.split(":")[1] : rawId;
}

// Helper to strict match platform
function matchesPlatform(text: string, platform: string): boolean {
  const t = text.toLowerCase();
  if (platform === "instagram") {
    if (/\b(snapchat|snap|telegram|tg|youtube|yt|facebook|fb|whatsapp|wa|tiktok|tt|spotify|threads)\b/.test(t)) {
      return false;
    }
    return /\b(instagram|insta|ig)\b/.test(t);
  }
  if (platform === "youtube") return /\b(youtube|yt)\b/.test(t);
  if (platform === "tiktok") return /\b(tiktok|tt)\b/.test(t);
  if (platform === "telegram") return /\b(telegram|tg)\b/.test(t);
  if (platform === "facebook") return /\b(facebook|fb)\b/.test(t);
  if (platform === "x") return /\b(twitter|x)\b/.test(t);
  if (platform === "whatsapp") return /\b(whatsapp|wa)\b/.test(t);
  return false;
}

export function RawCategoryImporter({ rawServices, onRefresh }: { rawServices: ServiceItem[]; onRefresh?: () => void }) {
  const [selectedPlatform, setSelectedPlatform] = React.useState<string>("instagram");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedCategories, setSelectedCategories] = React.useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set());
  const [multiplier, setMultiplier] = React.useState<number>(2.0);
  const [priceOverrides, setPriceOverrides] = React.useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Group raw TopSMM services strictly by platform and raw category name
  const platformCategories = React.useMemo(() => {
    const map: Record<string, ServiceItem[]> = {};

    rawServices.forEach((s) => {
      const catName = s.rawProviderCategory || s.providerCategory || s.category || "Uncategorized";
      if (catName.toUpperCase().includes("NON WORKING") || catName.toUpperCase().includes("DON'T USE") || catName.toUpperCase().includes("DON’T USE")) {
        return;
      }

      const p = (s.platform || "").toLowerCase();
      const combinedText = catName + " " + (s.name || s.providerName || "");

      let belongs = false;
      if (p && p !== "other" && p === selectedPlatform) {
        belongs = true;
      } else if (!p || p === "other") {
        belongs = matchesPlatform(combinedText, selectedPlatform);
      }

      if (belongs) {
        if (!map[catName]) map[catName] = [];
        map[catName].push(s);
      }
    });

    return map;
  }, [rawServices, selectedPlatform]);

  const categoryNames = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return Object.keys(platformCategories).filter((cat) => {
      if (!q) return true;
      if (cat.toLowerCase().includes(q)) return true;
      const svcs = platformCategories[cat] || [];
      return svcs.some((s) => (s.name || s.providerName || "").toLowerCase().includes(q) || getCleanId(s).includes(q));
    });
  }, [platformCategories, searchQuery]);

  // Expand all categories by default on platform change
  React.useEffect(() => {
    setExpandedCategories(new Set(Object.keys(platformCategories)));
    setSelectedCategories(new Set());
  }, [selectedPlatform, platformCategories]);

  const toggleCategorySelect = (catName: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  };

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedCategories.size === categoryNames.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(categoryNames));
    }
  };

  const calculateSellPrice = (svc: ServiceItem) => {
    const cleanId = getCleanId(svc);
    if (priceOverrides[cleanId] !== undefined) return priceOverrides[cleanId];
    const rate = typeof svc.ratePer1000 === "number" ? svc.ratePer1000 : parseFloat(String(svc.rate || svc.ratePer1000 || "0"));
    return Math.ceil(rate * multiplier);
  };

  const handleImportCategories = async (catsToImport: string[]) => {
    if (catsToImport.length === 0) {
      toast.error("Please select at least one TopSMM category to import.");
      return;
    }

    setIsSubmitting(true);
    const updates: any[] = [];

    catsToImport.forEach((catName) => {
      const svcs = platformCategories[catName] || [];
      svcs.forEach((svc) => {
        const cleanId = getCleanId(svc);
        const rate = typeof svc.ratePer1000 === "number" ? svc.ratePer1000 : parseFloat(String(svc.rate || svc.ratePer1000 || "0"));
        const sellPriceInr = calculateSellPrice(svc);

        // Derive clean group name & variant name from raw service
        let groupName = catName.replace(/\|.*/, "").trim();
        if (!groupName) groupName = svc.name || `Service #${cleanId}`;
        let variantName = svc.name || "Default";
        if (variantName.length > 60) {
          variantName = variantName.slice(0, 60) + "...";
        }

        updates.push({
          id: cleanId,
          name: groupName,
          displayName: groupName,
          status: "active",
          platform: selectedPlatform,
          category: getStandardCategoryType(catName, svc),
          rate: rate,
          min: svc.min || 10,
          max: svc.max || 100000,
          refillTag: svc.refill ? "30 Days" : "No Refill",
          variantName: variantName,
          sellPriceInr: sellPriceInr,
          cancel: Boolean(svc.cancel),
          quality: "High Quality",
          badge: "auto",
          stability: "auto",
        });
      });
    });

    try {
      await apiClient.post("/provider/services/curate", {
        providerName: "topsmm",
        updates,
      });

      try {
        clearServicesCache();
      } catch (e) {}

      toast.success(`Successfully imported ${catsToImport.length} category(ies) containing ${updates.length} service(s) into Pablo Catalog!`);
      if (typeof onRefresh === "function") {
        onRefresh();
      }
    } catch (err: any) {
      console.error("Failed to import categories", err);
      toast.error(err?.response?.data || err?.message || "Failed to import categories.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStandardCategoryType = (catName: string, svc: ServiceItem): string => {
    const text = (catName + " " + (svc.name || "")).toLowerCase();
    if (text.includes("like") || text.includes("reaction")) return "likes";
    if (text.includes("view") || text.includes("reel") || text.includes("story") || text.includes("stream")) return "views";
    if (text.includes("comment")) return "comments";
    if (text.includes("share") || text.includes("repost") || text.includes("forward")) return "shares";
    if (text.includes("vote") || text.includes("poll")) return "votes";
    return "followers";
  };

  const totalSelectedServicesCount = React.useMemo(() => {
    let count = 0;
    selectedCategories.forEach((catName) => {
      count += (platformCategories[catName] || []).length;
    });
    return count;
  }, [selectedCategories, platformCategories]);

  return (
    <div className="flex-1 w-full font-['GM'] bg-[#F7F8F9] text-gray-900 flex flex-col p-4 md:p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-['GPB'] text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            TopSMM Raw Categories Importer
          </h2>
          <p className="text-xs text-gray-500 font-['GM'] mt-1">
            Directly view and import all raw categories from TopSMM without any filtering exclusions. Select all categories or pick specific ones to add them to your catalog.
          </p>
        </div>

        {/* Multiplier Selector */}
        <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-200 shrink-0">
          <span className="text-xs font-['GPB'] text-gray-700">Price Multiplier:</span>
          {[1.5, 2.0, 3.0, 5.0, 10.0].map((m) => (
            <button
              key={m}
              onClick={() => setMultiplier(m)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-['GB'] transition-all",
                multiplier === m ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              )}
            >
              {m}x
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar: Platforms */}
        <div className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-['GB'] text-gray-400 uppercase tracking-wider px-1">Select Platform</h3>
          <div className="flex flex-col gap-1.5">
            {PLATFORMS.map((p) => {
              const isSelected = selectedPlatform === p.id;

              // Count total TopSMM raw categories for this platform
              const catCount = Object.keys(rawServices.reduce((acc: any, s: any) => {
                const cat = s.rawProviderCategory || s.providerCategory || s.category || "";
                if (!cat || cat.toUpperCase().includes("DON'T USE")) return acc;
                const combined = cat + " " + (s.name || "");
                if (matchesPlatform(combined, p.id)) acc[cat] = true;
                return acc;
              }, {})).length;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all border w-full text-left",
                    isSelected
                      ? "bg-indigo-50/70 border-indigo-200 font-['GPB'] text-indigo-950 shadow-sm"
                      : "bg-gray-50/60 border-transparent text-gray-600 font-['GM'] hover:bg-gray-100"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <img src={p.icon} alt={p.name} className="w-5 h-5 object-contain" />
                    <span>{p.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-gray-200/70 text-gray-700 text-[10px] font-['GB']">
                    {catCount} Raw
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Main Content: Categories & Services */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 min-w-0">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search raw category or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-gray-50/50 border-gray-200 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-10 text-xs font-['GPB'] rounded-xl">
                {selectedCategories.size === categoryNames.length ? (
                  <>
                    <CheckSquare className="w-4 h-4 mr-2 text-indigo-600" /> Deselect All
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 mr-2" /> Select All ({categoryNames.length})
                  </>
                )}
              </Button>

              <Button
                disabled={selectedCategories.size === 0 || isSubmitting}
                onClick={() => handleImportCategories(Array.from(selectedCategories))}
                className="h-10 text-xs font-['GPB'] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm px-5"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Import Selected ({selectedCategories.size} Categories, {totalSelectedServicesCount} Services)
              </Button>
            </div>
          </div>

          {/* Categories List */}
          <div className="space-y-4">
            {categoryNames.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 font-['GM']">
                No raw categories found for this platform or search query.
              </div>
            ) : (
              categoryNames.map((catName) => {
                const svcs = platformCategories[catName] || [];
                const isSelected = selectedCategories.has(catName);
                const isExpanded = expandedCategories.has(catName);

                // Min/Max cost in category
                const rates = svcs.map((s) => (typeof s.ratePer1000 === "number" ? s.ratePer1000 : parseFloat(String(s.rate || s.ratePer1000 || "0"))));
                const minCost = Math.min(...rates);
                const maxCost = Math.max(...rates);

                return (
                  <div key={catName} className={cn("border rounded-2xl overflow-hidden transition-all", isSelected ? "border-indigo-300 ring-2 ring-indigo-100 bg-indigo-50/10" : "border-gray-200")}>
                    {/* Category Header */}
                    <div className="p-4 bg-gray-50/80 flex items-center justify-between gap-4 cursor-pointer" onClick={() => toggleCategoryExpand(catName)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCategorySelect(catName);
                          }}
                          className="shrink-0 text-indigo-600 hover:scale-110 transition-transform"
                        >
                          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
                        </button>
                        <h4 className="text-sm font-['GPB'] text-gray-900 truncate">{catName}</h4>
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-['GB'] shrink-0">
                          {svcs.length} Services
                        </span>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-xs font-['GM'] text-gray-500">
                          Cost: ₹{minCost.toFixed(2)} - ₹{maxCost.toFixed(2)} /1k
                        </span>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImportCategories([catName]);
                          }}
                          className="h-8 text-xs font-['GPB'] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Import Category
                        </Button>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>

                    {/* Services Accordion List */}
                    {isExpanded && (
                      <div className="p-4 divide-y divide-gray-100 bg-white">
                        {svcs.map((svc) => {
                          const cleanId = getCleanId(svc);
                          const rate = typeof svc.ratePer1000 === "number" ? svc.ratePer1000 : parseFloat(String(svc.rate || svc.ratePer1000 || "0"));
                          const sellPrice = calculateSellPrice(svc);

                          return (
                            <div key={cleanId} className="py-3 flex items-center justify-between gap-4 text-xs">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="px-2 py-0.5 rounded bg-gray-900 text-white font-['GB'] text-[10px] shrink-0">#{cleanId}</span>
                                <span className="font-['GM'] text-gray-800 truncate">{svc.name || svc.providerName}</span>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <span className="text-gray-400">Cost: ₹{rate.toFixed(2)}</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-['GPB'] text-emerald-700">Sell: ₹</span>
                                  <input
                                    type="number"
                                    value={sellPrice}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setPriceOverrides((prev) => ({ ...prev, [cleanId]: val }));
                                    }}
                                    className="w-20 px-2 py-1 border border-gray-200 rounded-md font-['GB'] text-right focus:border-indigo-500 focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
