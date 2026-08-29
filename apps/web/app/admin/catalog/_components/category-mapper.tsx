"use client";

import * as React from "react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Save, Search, Layers, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { cn } from "@/lib/utils";

interface ServiceItem {
  id: string;
  category?: string;
  providerCategory?: string;
  rawProviderCategory?: string;
  platform?: string;
  name?: string;
  providerName?: string;
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

const STANDARD_CATEGORIES = [
  { id: "followers", label: "Followers / Subscribers" },
  { id: "likes", label: "Likes / Reactions" },
  { id: "views", label: "Views / Watchtime" },
  { id: "comments", label: "Comments / Replies" },
  { id: "shares", label: "Shares / Reposts" },
  { id: "votes", label: "Votes / Polls" },
  { id: "saves", label: "Saves / Bookmarks" },
  { id: "bot_start", label: "Bot Start" },
  { id: "reactions", label: "Reactions" },
  { id: "hidden", label: "Hidden / Ignore" },
];

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

export function CategoryMapper({
  rawServices,
  initialMappings,
  taxonomyCategories: taxonomyCategoriesProp,
  onMappingsSaved,
}: {
  rawServices: ServiceItem[];
  initialMappings: Record<string, string>;
  taxonomyCategories?: any[];
  onMappingsSaved?: (mappings: Record<string, string>) => void;
}) {
  const [selectedPlatform, setSelectedPlatform] = React.useState<string>("instagram");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [mappings, setMappings] = React.useState<Record<string, string>>(initialMappings || {});
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [filterMode, setFilterMode] = React.useState<"all" | "mapped" | "unmapped">("all");
  const [taxonomyCategories, setTaxonomyCategories] = React.useState<{ id: string; platformId: string; name: string }[]>(taxonomyCategoriesProp || []);

  // Sync taxonomyCategories if passed from parent
  React.useEffect(() => {
    if (taxonomyCategoriesProp && taxonomyCategoriesProp.length > 0) {
      setTaxonomyCategories(taxonomyCategoriesProp);
    }
  }, [taxonomyCategoriesProp]);

  // Load saved taxonomy from admin settings as fallback
  React.useEffect(() => {
    if (taxonomyCategoriesProp && taxonomyCategoriesProp.length > 0) return;
    apiClient.get("/admin/settings")
      .then((res: any) => {
        const raw = res?.catalog_taxonomy;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.categories && Array.isArray(parsed.categories)) {
              setTaxonomyCategories(parsed.categories);
            }
          } catch (e) {}
        }
      })
      .catch((err) => console.warn("Failed to load taxonomy in CategoryMapper", err));
  }, [taxonomyCategoriesProp]);

  // Compute active categories for selected platform dynamically
  const activeStandardCategories = React.useMemo(() => {
    const customCats = taxonomyCategories.filter((c) => c.platformId === selectedPlatform);
    if (customCats.length > 0) {
      const list = customCats.map((c) => ({ id: c.id, label: c.name }));
      if (!list.some(c => c.id === "hidden")) {
        list.push({ id: "hidden", label: "Hidden / Ignore" });
      }
      return list;
    }
    return STANDARD_CATEGORIES;
  }, [taxonomyCategories, selectedPlatform]);

  // Sync initialMappings if it changes externally
  React.useEffect(() => {
    setMappings(initialMappings || {});
    setHasChanges(false);
  }, [initialMappings]);

  // Extract all unique raw TopSMM categories
  const allRawCategories = React.useMemo(() => {
    const set = new Set<string>();
    rawServices.forEach((s) => {
      const cat = s.rawProviderCategory || s.providerCategory || s.category || "Uncategorized";
      if (!cat || cat.toUpperCase().includes("DON'T USE")) return;
      set.add(cat);
    });
    return Array.from(set);
  }, [rawServices]);

  // Filter categories by platform
  const platformCategories = React.useMemo(() => {
    return allRawCategories.filter((cat) => {
      const p = selectedPlatform;
      if (mappings[`${p}:${cat}`] || mappings[`${p}: ${cat}`]) return true;

      // Find a sample service to check platform text
      const sample = rawServices.find(
        (s) => (s.rawProviderCategory || s.providerCategory || s.category) === cat
      );
      const combined = cat + " " + (sample?.name || sample?.providerName || "");
      return matchesPlatform(combined, p);
    });
  }, [allRawCategories, rawServices, selectedPlatform, mappings]);

  // Filter by search and mapped/unmapped mode
  const displayCategories = React.useMemo(() => {
    return platformCategories.filter((cat) => {
      if (searchQuery && !cat.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      const isMapped = !!mappings[`${selectedPlatform}:${cat}`];
      if (filterMode === "mapped" && !isMapped) return false;
      if (filterMode === "unmapped" && isMapped) return false;
      return true;
    });
  }, [platformCategories, searchQuery, filterMode, mappings, selectedPlatform]);

  const handleMappingChange = (cat: string, standardCat: string) => {
    setMappings((prev) => {
      const next = { ...prev };
      const key = `${selectedPlatform}:${cat}`;
      if (standardCat === "none") {
        delete next[key];
      } else {
        next[key] = standardCat;
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.post("/admin/settings", {
        admin_category_mappings: JSON.stringify(mappings),
      });
      toast.success("Category mappings saved successfully!");
      setHasChanges(false);
      if (onMappingsSaved) onMappingsSaved(mappings);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save mappings");
    } finally {
      setIsSaving(false);
    }
  };

  // Compute counts
  const totalCatCountForPlatform = platformCategories.length;
  const mappedCatCountForPlatform = platformCategories.filter((cat) => !!mappings[`${selectedPlatform}:${cat}`]).length;
  const unmappedCatCountForPlatform = totalCatCountForPlatform - mappedCatCountForPlatform;

  return (
    <div className="flex-1 w-full h-full font-['GM'] bg-[#F7F8F9] text-gray-900 flex flex-col p-4 md:p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-['GPB'] text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Manual Category Mapping
          </h2>
          <p className="text-xs text-gray-500 font-['GM'] mt-1">
            Assign raw TopSMM categories to standard Pablo categories (Followers, Likes, Views, etc.) to organize the Map Services page accurately.
          </p>
        </div>

        <Button
          disabled={!hasChanges || isSaving}
          onClick={handleSave}
          className="h-10 text-sm font-['GPB'] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm px-6 shrink-0"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Mappings"}
        </Button>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)]">
        {/* Left Sidebar: Platforms */}
        <div className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3 overflow-y-auto">
          <h3 className="text-xs font-['GB'] text-gray-400 uppercase tracking-wider px-1">Select Platform</h3>
          <div className="flex flex-col gap-1.5">
            {PLATFORMS.map((p) => {
              const isSelected = selectedPlatform === p.id;

              // Calculate mapped progress for this platform
              const pCats = allRawCategories.filter((cat) => {
                const sample = rawServices.find((s) => (s.rawProviderCategory || s.providerCategory || s.category) === cat);
                return matchesPlatform(cat + " " + (sample?.name || sample?.providerName || ""), p.id);
              });
              const mapped = pCats.filter((c) => !!mappings[`${p.id}:${c}`]).length;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={cn(
                    "flex flex-col items-start px-3 py-2.5 rounded-xl text-xs transition-all border w-full text-left gap-2",
                    isSelected
                      ? "bg-indigo-50/70 border-indigo-200 shadow-sm"
                      : "bg-gray-50/60 border-transparent hover:bg-gray-100"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <img src={p.icon} alt={p.name} className="w-5 h-5 object-contain" />
                      <span className={cn(isSelected ? "font-['GPB'] text-indigo-950" : "font-['GM'] text-gray-600")}>
                        {p.name}
                      </span>
                    </div>
                    {mapped === pCats.length && pCats.length > 0 && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  
                  <div className="w-full">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-['GB']">
                      <span>Mapped</span>
                      <span>{mapped} / {pCats.length}</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", mapped === pCats.length ? "bg-emerald-500" : "bg-indigo-500")}
                        style={{ width: `${pCats.length === 0 ? 0 : (mapped / pCats.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Main Content: Mapping Table */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-w-0">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b border-gray-100">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search raw categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-gray-50/50 border-gray-200 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg shrink-0">
              <button
                onClick={() => setFilterMode("all")}
                className={cn("px-3 py-1.5 rounded-md text-xs font-['GPB'] transition-all", filterMode === "all" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}
              >
                All ({totalCatCountForPlatform})
              </button>
              <button
                onClick={() => setFilterMode("unmapped")}
                className={cn("px-3 py-1.5 rounded-md text-xs font-['GPB'] transition-all", filterMode === "unmapped" ? "bg-white shadow-sm text-amber-600" : "text-gray-500 hover:text-gray-700")}
              >
                Unmapped ({unmappedCatCountForPlatform})
              </button>
              <button
                onClick={() => setFilterMode("mapped")}
                className={cn("px-3 py-1.5 rounded-md text-xs font-['GPB'] transition-all", filterMode === "mapped" ? "bg-white shadow-sm text-emerald-600" : "text-gray-500 hover:text-gray-700")}
              >
                Mapped ({mappedCatCountForPlatform})
              </button>
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/50 text-xs font-['GPB'] text-gray-500 uppercase">
            <div className="col-span-7">TopSMM Raw Category</div>
            <div className="col-span-5">Pablo Internal Category (Slot)</div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto">
            {displayCategories.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 font-['GM']">
                No categories match your filters.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayCategories.map((cat) => {
                  const currentValue = mappings[`${selectedPlatform}:${cat}`] || "none";
                  const isUnmapped = currentValue === "none";

                  return (
                    <div key={cat} className={cn("grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors hover:bg-gray-50/50", isUnmapped && filterMode === "all" ? "bg-amber-50/20" : "")}>
                      <div className="col-span-7 pr-4">
                        <div className="flex items-center gap-3">
                          {isUnmapped ? (
                            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          )}
                          <span className="text-sm font-['GM'] text-gray-800 leading-snug">{cat}</span>
                        </div>
                      </div>
                      <div className="col-span-5">
                        <Select value={currentValue} onValueChange={(val) => handleMappingChange(cat, val)}>
                          <SelectTrigger className={cn("h-9 border-gray-200 text-sm font-['GM'] w-full shadow-sm", isUnmapped ? "bg-white text-gray-400 border-dashed" : "bg-indigo-50 border-indigo-200 text-indigo-700 font-['GPB']")}>
                            <SelectValue placeholder="Select Category..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-gray-400 italic">Unassigned (Unmapped)</SelectItem>
                            {activeStandardCategories.map((sc) => (
                              <SelectItem key={sc.id} value={sc.id}>
                                {sc.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
