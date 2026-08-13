"use client";

import * as React from "react";
import { apiClient } from "@/lib/apiClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Server } from "lucide-react";
import { CatalogPicker } from "./catalog-picker";

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
  const [viewMode, setViewMode] = React.useState<"map" | "manage">("map");

  React.useEffect(() => {
    async function loadProviders() {
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
        const allProviders = [masterProvider, ...(data || [])];
        setProviders(allProviders);
        setSelectedProviderKey("pablosmm");
      } catch (err) {
        console.error("Failed to load providers", err);
        const masterProvider: SmmProvider = {
          id: 0,
          key: "pablosmm",
          name: "Pablosmm (Master Catalog)",
          api_url: "",
          api_key: "",
          currency: "INR",
          is_active: true
        };
        setProviders([masterProvider]);
        setSelectedProviderKey("pablosmm");
      }
    }
    loadProviders();
  }, []);

  const currentProviderRawServices = React.useMemo(() => {
    if (!selectedProviderKey) return [];

    // Helper to check if a service belongs to the hidden category
    const isHiddenCategory = (catStr: string) => {
      const c = (catStr || "").toUpperCase();
      return c.includes("NON WORKING") || c.includes("DON'T USE") || c.includes("DON’T USE");
    };

    if (selectedProviderKey === "pablosmm") {
      const pablosmmServices = initialCatalogServices.map((cs: any) => {
        // Find matching raw provider service to enrich details like average_time, desc, badge & stability
        const rawMatch = rawProviderServices.find((r: any) => {
          const rId = String(r.sourceServiceId || r.service || r.id || "").includes(":")
            ? String(r.sourceServiceId || r.service || r.id || "").split(":")[1]
            : String(r.sourceServiceId || r.service || r.id || "");
          const csId = String(cs.provider_service_id || cs.id).includes(":")
            ? String(cs.provider_service_id || cs.id).split(":")[1]
            : String(cs.provider_service_id || cs.id);
          return rId === csId;
        });

        // Parse tag-encoded fields from rawMatch.tags
        const rawTags: string[] = rawMatch?.tags || [];
        let parsedBadge = "auto";
        let parsedStability = "auto";
        let parsedQuality = "High Quality";
        let parsedRefillTag: string | undefined = undefined;
        for (const t of rawTags) {
          if (t.startsWith("badge:")) parsedBadge = t.replace("badge:", "");
          if (t.startsWith("stability:")) parsedStability = t.replace("stability:", "");
          if (t.startsWith("quality:")) parsedQuality = t.replace("quality:", "");
          if (t.startsWith("refill:")) parsedRefillTag = t.replace("refill:", "");
        }

        return {
          id: String(cs.provider_service_id || cs.id),
          sourceServiceId: String(cs.provider_service_id || cs.id),
          providerKey: cs.provider_id || "topsmm",
          name: cs.name,
          displayName: cs.name,
          providerName: rawMatch?.providerName || rawMatch?.name || cs.name,
          platform: cs.platform,
          category: cs.category,
          type: cs.category,
          variant: cs.variant_name || "Default",
          ratePer1000: cs.sell_price_inr || rawMatch?.ratePer1000 || 0,
          rate: cs.sell_price_inr || rawMatch?.ratePer1000 || 0,
          min: rawMatch?.min || 10,
          max: rawMatch?.max || 10000,
          refill: rawMatch?.refill !== undefined ? rawMatch.refill : true,
          cancel: rawMatch?.cancel !== undefined ? rawMatch.cancel : true,
          status: cs.is_active ? "active" : "hidden",
          quality: parsedQuality,
          stability: parsedStability,
          badge: parsedBadge,
          refillTag: parsedRefillTag,
          average_time: rawMatch?.average_time ?? rawMatch?.averageTime,
          averageTime: rawMatch?.averageTime ?? rawMatch?.average_time,
          desc: rawMatch?.desc || rawMatch?.description || "",
          description: rawMatch?.description || rawMatch?.desc || "",
          tags: [
            `variant_name:${cs.variant_name || "Default"}`,
            `sell_price_inr:${cs.sell_price_inr || 0}`,
            ...rawTags
          ]
        };
      });
      return pablosmmServices.filter((s: any) => !isHiddenCategory(s.category));
    }
    
    return rawProviderServices
      .filter((s: any) => 
        s.providerKey === selectedProviderKey && 
        !isHiddenCategory(s.rawProviderCategory || s.providerCategory || s.category)
      )
      .map((svc: any) => {
        const rawTags: string[] = svc.tags || [];
        let parsedBadge = (svc as any).badge || "auto";
        let parsedStability = (svc as any).stability || "auto";
        let parsedQuality = (svc as any).quality || "High Quality";
        let parsedRefillTag: string | undefined = (svc as any).refillTag;

        for (const t of rawTags) {
          if (t.startsWith("badge:")) parsedBadge = t.replace("badge:", "");
          if (t.startsWith("stability:")) parsedStability = t.replace("stability:", "");
          if (t.startsWith("quality:")) parsedQuality = t.replace("quality:", "");
          if (t.startsWith("refill:")) parsedRefillTag = t.replace("refill:", "");
          if (t.startsWith("proposed_refill:")) parsedRefillTag = t.replace("proposed_refill:", "");
        }

        return {
          ...svc,
          badge: parsedBadge,
          stability: parsedStability,
          quality: parsedQuality,
          refillTag: parsedRefillTag
        };
      });
  }, [rawProviderServices, initialCatalogServices, selectedProviderKey]);

  const selectedProviderName = providers.find(p => p.key === selectedProviderKey)?.name || selectedProviderKey;
  const selectedProviderCurrency = providers.find(p => p.key === selectedProviderKey)?.currency || "INR";

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Admin Top Bar */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm mx-4 mt-4">
        <Server className="w-5 h-5 text-gray-500" />
        <span className="text-sm font-['GPB'] text-gray-700">Select Provider Source:</span>
        <Select value={selectedProviderKey} onValueChange={setSelectedProviderKey} disabled={viewMode === "manage"}>
          <SelectTrigger className="w-64 font-['GM'] h-10 bg-[#F7F8F9] border-gray-200 disabled:opacity-50">
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
            className={`px-4 py-1.5 text-sm font-['GPB'] rounded-md transition-colors ${viewMode === "map" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Map Services
          </button>
          <button
            onClick={() => setViewMode("manage")}
            className={`px-4 py-1.5 text-sm font-['GPB'] rounded-md transition-colors ${viewMode === "manage" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Manage Catalog
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      {viewMode === "map" ? (
        selectedProviderKey && (
          <div className="flex-1 w-full relative">
            <CatalogPicker 
              catalogServices={initialCatalogServices}
              rawServices={currentProviderRawServices} 
              providerName={selectedProviderName}
              providerKey={selectedProviderKey}
              providerCurrency={selectedProviderCurrency}
              onRefresh={onRefresh}
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
