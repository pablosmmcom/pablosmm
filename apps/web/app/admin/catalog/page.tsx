"use client";

import * as React from "react";
import { apiClient } from "@/lib/apiClient";
import { CatalogWrapper } from "./_components/catalog-wrapper";
import { Loader2 } from "lucide-react";

export default function CatalogPage() {
  const [loading, setLoading] = React.useState(true);
  const [catalogServices, setCatalogServices] = React.useState<any[]>([]);
  const [rawServices, setRawServices] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [catalogData, rawData] = await Promise.all([
        apiClient.get<any[]>("/admin/catalog"),
        apiClient.get<any>("/admin/provider-services")
      ]);
      setCatalogServices(Array.isArray(catalogData) ? catalogData : []);
      const servicesArray = Array.isArray(rawData) ? rawData : (rawData?.services || []);
      setRawServices(servicesArray);
    } catch (err: any) {
      console.error("Failed to load catalog data", err);
      setError(err.message || "Failed to load data");
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData(true);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 w-full h-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-[#F7F8F9]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        <p className="mt-4 text-sm text-gray-500 font-['GM']">Loading Catalog Manager...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 w-full h-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-[#F7F8F9]">
        <div className="text-red-500 font-['GM']">Error: {error}</div>
        <button onClick={() => fetchData(true)} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded font-['GM']">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full min-h-[calc(100vh-4rem)] flex flex-col bg-[#F7F8F9]">
      <CatalogWrapper 
        initialCatalogServices={catalogServices} 
        rawProviderServices={rawServices} 
        onRefresh={() => fetchData(false)} 
      />
    </div>
  );
}
