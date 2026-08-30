"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Eye, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/config";

export default function ImpersonationBanner() {
  const router = useRouter();
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null);
  const [exiting, setExiting] = useState(false);

  const checkImpersonation = () => {
    try {
      const stored = localStorage.getItem("pablo_impersonated_user");
      if (stored) {
        setImpersonatedUser(JSON.parse(stored));
      } else {
        setImpersonatedUser(null);
      }
    } catch {
      setImpersonatedUser(null);
    }
  };

  useEffect(() => {
    checkImpersonation();
    window.addEventListener("storage", checkImpersonation);
    return () => window.removeEventListener("storage", checkImpersonation);
  }, []);

  const handleExit = async () => {
    setExiting(true);
    try {
      const adminBackupToken = localStorage.getItem("pablo_admin_backup_token");
      
      // Clear impersonation state
      localStorage.removeItem("pablo_impersonated_user");
      localStorage.removeItem("pablo_admin_backup_token");

      if (adminBackupToken) {
        // Restore admin auth_token cookie
        document.cookie = `auth_token=${adminBackupToken}; path=/; max-age=604800; SameSite=Lax`;
      }

      toast.success("Exited user speculation mode. Returning to Admin Panel...");
      setImpersonatedUser(null);
      
      // Hard redirect to refresh entire auth context and return to admin
      window.location.href = "/admin/users";
    } catch (err: any) {
      toast.error("Error exiting speculation mode");
      setExiting(false);
    }
  };

  if (!impersonatedUser) return null;

  return (
    <aside
      aria-label="User Speculation Banner"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: "linear-gradient(90deg, #b45309 0%, #d97706 50%, #b45309 100%)",
        color: "#ffffff",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 4px 20px rgba(217, 119, 6, 0.4)",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.2px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            background: "rgba(0, 0, 0, 0.25)",
            padding: "4px 8px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          <Eye size={14} /> Speculating Account
        </div>
        <span>
          Viewing as <strong>{impersonatedUser.name || impersonatedUser.username}</strong> ({impersonatedUser.email} &bull; #{impersonatedUser.id})
        </span>
      </div>

      <button
        onClick={handleExit}
        disabled={exiting}
        style={{
          background: "#111827",
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          padding: "6px 14px",
          borderRadius: "6px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          fontWeight: 700,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#000000")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#111827")}
      >
        <LogOut size={14} />
        {exiting ? "Exiting..." : "Exit & Return to Admin"}
      </button>
    </aside>
  );
}
