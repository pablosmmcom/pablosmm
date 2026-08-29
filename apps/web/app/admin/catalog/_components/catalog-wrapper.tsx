"use client";

import * as React from "react";
import { apiClient } from "@/lib/apiClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Server } from "lucide-react";
import { cn } from "@/lib/admin/utils";
import { CatalogPicker, getStandardPlatform } from "./catalog-picker";
import { CategoryMapper } from "./category-mapper";
import { RawCategoryImporter } from "./raw-category-importer";
import { CatalogManagerList } from "./catalog-manager-list";

export interface SmmProvider {
  id: number;
  key: string;
  name: string;
  api_url: string;
  api_key: string;
  currency: string;
  is_active: boolean;
}

export function CatalogWrapper({ 
  initialCatalogServices, 
  rawProviderServices,
  onRefresh
}: { 
  initialCatalogServices: any[],
  rawProviderServices: any[],
  onRefresh: () => void
}) {
  const [providers, setProviders] = React.useState<SmmProvider[]>([]);
  const [selectedProviderKey, setSelectedProviderKey] = React.useState<string>("");
  const [viewMode, setViewMode] = React.useState<"map" | "raw" | "manage" | "map_categories">("map");
  const [categoryMappings, setCategoryMappings] = React.useState<Record<string, string>>({});
  const [taxonomyCategories, setTaxonomyCategories] = React.useState<any[]>([]);

  const loadData = React.useCallback(async () => {
    try {
      const data = await apiClient.get<SmmProvider[]>("/admin/providers");
      const masterProvider: SmmProvider = {
        id: 0,
        key: "pablosmm",
        name: "Pablosmm (Master Catalog)",
        api_url: "",
        api_key: "",
        currency: "INR",
        is_active: true
      };
      setProviders([masterProvider, ...(data || [])]);
      if (!selectedProviderKey) setSelectedProviderKey("pablosmm");
    } catch (err) {
      console.error("Failed to load providers", err);
      if (!selectedProviderKey) setSelectedProviderKey("pablosmm");
    }

    try {
      const settings = await apiClient.get<Record<string, string>>("/admin/settings");
      if (settings && settings.admin_category_mappings) {
        setCategoryMappings(JSON.parse(settings.admin_category_mappings));
      }
      if (settings && settings.catalog_taxonomy) {
        try {
          const parsed = JSON.parse(settings.catalog_taxonomy);
          if (parsed?.categories && Array.isArray(parsed.categories)) {
            setTaxonomyCategories(parsed.categories);
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  }, [selectedProviderKey]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const currentProviderRawServices = React.useMemo(() => {
    if (!selectedProviderKey) return [];

    const isHiddenCategory = (catStr: string) => {
      const c = (catStr || "").toUpperCase();
      return c.includes("NON WORKING") || c.includes("DON'T USE") || c.includes("DON’T USE");
    };

    if (selectedProviderKey === "pablosmm") {
      const pablosmmServices = initialCatalogServices.map((cs: any) => {
        const rawMatch = rawProviderServices.find((r: any) => {
          const rId = String(r.sourceServiceId || r.service || r.id || "").includes(":")
            ? String(r.sourceServiceId || r.service || r.id || "").split(":")[1]
            : String(r.sourceServiceId || r.service || r.id || "");
          const csId = String(cs.provider_service_id || "").includes(":")
            ? String(cs.provider_service_id || "").split(":")[1]
            : String(cs.provider_service_id || "");
          return csId !== "" && rId === csId;
        });

        const effectiveTags: string[] = cs.tags && cs.tags.length > 0 ? cs.tags : (rawMatch?.tags || []);
        let parsedBadge = "auto";
        let parsedStability = "auto";
        let parsedQuality = "High Quality";
        let parsedRefillTag: string | undefined = undefined;
        let parsedVariant: string | undefined = cs.variant;

        for (const t of effectiveTags) {
          if (t.startsWith("badge:")) parsedBadge = t.replace("badge:", "");
          if (t.startsWith("stability:")) parsedStability = t.replace("stability:", "");
          if (t.startsWith("quality:")) parsedQuality = t.replace("quality:", "");
          if (t.startsWith("refill:")) parsedRefillTag = t.replace("refill:", "");
          if (t.startsWith("variant:") && !parsedVariant) parsedVariant = t.replace("variant:", "");
        }

        const resolvedPlatform = cs.platform || (rawMatch ? getStandardPlatform(rawMatch) : "instagram");
        const normCat = cs.category === "save" ? "saves" : (cs.category || "followers");
        const rawCat = rawMatch?.rawProviderCategory || rawMatch?.providerCategory || rawMatch?.category || normCat;
        return {
          id: cs.id,
          sourceServiceId: cs.provider_service_id || String(cs.id),
          service: cs.provider_service_id || String(cs.id),
          name: cs.name,
          providerName: cs.name,
          rawProviderName: rawMatch?.name || rawMatch?.displayName || cs.name,
          displayName: cs.name,
          variantName: cs.variant_name || "Default",
          variant: parsedVariant || cs.variant || "any",
          sellPriceInr: cs.sell_price_inr,
          rate: cs.sell_price_inr,
          ratePer1000: cs.sell_price_inr,
          platform: resolvedPlatform,
          category: normCat,
          providerCategory: rawCat,
          rawProviderCategory: rawCat,
          status: cs.is_active ? "active" : "hidden",
          isHidden: !cs.is_active,
          hasPendingProviderSubmission: false,
          isProviderSubmission: true,
          providerKey: cs.provider_id || "topsmm",
          refill: rawMatch?.refill,
          cancel: rawMatch?.cancel,
          average_time: rawMatch?.average_time,
          desc: cs.description || rawMatch?.desc || rawMatch?.description,
          description: cs.description || rawMatch?.description || rawMatch?.desc,
          badge: parsedBadge,
          stability: parsedStability,
          quality: parsedQuality,
          refillTag: parsedRefillTag,
          tags: effectiveTags,
        };
      });

      return pablosmmServices;
    }

    return rawProviderServices.filter((s: any) => {
      const pKey = (s.providerKey || s.provider_id || "topsmm").toLowerCase();
      const cat = s.rawProviderCategory || s.providerCategory || s.category || "";
      return pKey === selectedProviderKey.toLowerCase() && !isHiddenCategory(cat);
    });
  }, [selectedProviderKey, initialCatalogServices, rawProviderServices]);

  const selectedProviderName = providers.find(p => p.key === selectedProviderKey)?.name || "TOPSMM";
  const selectedProviderCurrency = providers.find(p => p.key === selectedProviderKey)?.currency || "USD";

  return (
    <div className="flex-1 w-full h-full flex flex-col font-['GM']">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-['GPB'] text-gray-700">SMM Provider:</span>
        </div>
        <Select value={selectedProviderKey} onValueChange={setSelectedProviderKey}>
          <SelectTrigger className="w-64 h-9 bg-gray-50 border-gray-200 rounded-lg text-sm font-['GM']">
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.key} value={p.key} className="font-['GM'] text-sm">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("map")}
            className={cn("px-4 py-1.5 text-sm font-['GPB'] rounded-md transition-colors", viewMode === "map" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            Map Services
          </button>
          <button
            onClick={() => setViewMode("map_categories")}
            className={cn("px-4 py-1.5 text-sm font-['GPB'] rounded-md transition-colors", viewMode === "map_categories" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            Categories Mapper
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={cn("px-4 py-1.5 text-sm font-['GPB'] rounded-md transition-colors", viewMode === "raw" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            ⚡ Raw Importer
          </button>
          <button
            onClick={() => setViewMode("manage")}
            className={cn("px-4 py-1.5 text-sm font-['GPB'] rounded-md transition-colors", viewMode === "manage" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            Manage Catalog ({initialCatalogServices.length})
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      {viewMode === "map_categories" ? (
        <div className="flex-1 w-full relative overflow-y-auto">
          <CategoryMapper 
            rawServices={rawProviderServices.filter((s: any) => (s.providerKey || s.provider_id || "topsmm").toLowerCase() === (selectedProviderKey === "pablosmm" ? "topsmm" : selectedProviderKey).toLowerCase())} 
            initialMappings={categoryMappings}
            taxonomyCategories={taxonomyCategories}
            onMappingsSaved={(mappings) => setCategoryMappings(mappings)}
          />
        </div>
      ) : viewMode === "raw" ? (
        <div className="flex-1 w-full relative overflow-y-auto">
          <RawCategoryImporter 
            rawServices={rawProviderServices.filter((s: any) => (s.providerKey || s.provider_id || "topsmm").toLowerCase() === (selectedProviderKey === "pablosmm" ? "topsmm" : selectedProviderKey).toLowerCase())} 
            onRefresh={onRefresh} 
          />
        </div>
      ) : viewMode === "map" ? (
        selectedProviderKey && (
          <div className="flex-1 w-full relative">
            <CatalogPicker 
              catalogServices={initialCatalogServices}
              rawServices={currentProviderRawServices} 
              providerName={selectedProviderName}
              providerKey={selectedProviderKey}
              providerCurrency={selectedProviderCurrency}
              categoryMappings={categoryMappings}
              onRefresh={onRefresh}
              onTaxonomyChange={(cats: any[]) => setTaxonomyCategories(cats)}
              key={selectedProviderKey} // Force remount on provider change
            />
          </div>
        )
      ) : (
        <div className="flex-1 w-full relative">
          <CatalogManagerList catalogServices={initialCatalogServices} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  );
}
