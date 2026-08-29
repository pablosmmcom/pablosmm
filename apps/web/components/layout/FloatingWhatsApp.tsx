"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/components/providers/auth-provider";
import { usePathname } from "next/navigation";

export default function FloatingWhatsApp() {
  const { user } = useAuth();
  const pathname = usePathname() || "";
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialPosX: number;
    initialPosY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialPosX: 0,
    initialPosY: 0,
    hasMoved: false,
  });

  // Set default initial position bottom-right on mount
  useEffect(() => {
    const handleResize = () => {
      const btnSize = 56;
      const margin = 18;
      const bottomNavHeight = 78;
      const initialX = window.innerWidth - btnSize - margin;
      const initialY = window.innerHeight - btnSize - bottomNavHeight - margin;
      
      setPosition((prev) => {
        if (!prev) return { x: initialX, y: initialY };
        // Clamp existing position to new window dimensions
        return {
          x: Math.max(margin, Math.min(window.innerWidth - btnSize - margin, prev.x)),
          y: Math.max(margin, Math.min(window.innerHeight - btnSize - margin, prev.y)),
        };
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getWhatsAppUrl = () => {
    const userEmail = (user as any)?.email || "Guest";
    const userId = (user as any)?.id ? `#${(user as any).id}` : "Guest";
    const userName = (user as any)?.name || (user as any)?.username || "Customer";

    const msg = 
`Hello PabloSMM Support,

I need assistance. Here are my details:

👤 *User Details:*
• *Name:* ${userName}
• *Email:* ${userEmail}
• *User ID:* ${userId}
• *Current Page:* ${pathname || "/"}

*Query / Message:* `;

    return `https://wa.me/919473528346?text=${encodeURIComponent(msg)}`;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button (left mouse click or touch)
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const currentX = position?.x ?? 0;
    const currentY = position?.y ?? 0;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: currentX,
      initialPosY: currentY,
      hasMoved: false,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    if (Math.hypot(deltaX, deltaY) > 6) {
      dragRef.current.hasMoved = true;
    }

    const btnSize = 56;
    const margin = 10;
    const newX = Math.max(margin, Math.min(window.innerWidth - btnSize - margin, dragRef.current.initialPosX + deltaX));
    const newY = Math.max(margin, Math.min(window.innerHeight - btnSize - margin, dragRef.current.initialPosY + deltaY));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }

    // If movement was less than 6px, treat as a normal click/tap
    if (!dragRef.current.hasMoved) {
      window.open(getWhatsAppUrl(), "_blank", "noopener,noreferrer");
    }
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
  };

  if (!position) return null;

  return (
    <div
      className="floating-whatsapp-container"
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 99999,
        touchAction: "none",
        userSelect: "none",
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        style={{
          position: "relative",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
          boxShadow: "0 8px 24px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid rgba(255, 255, 255, 0.3)",
          transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease",
          transform: isDragging ? "scale(1.08)" : "scale(1)",
        }}
      >
        {/* Subtle glowing animated pulse ring */}
        <span
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "rgba(37, 211, 102, 0.3)",
            animation: "pulse-ring 2.2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />

        <Image
          src="/orders/platforms/whatsapp.png"
          alt="WhatsApp Support"
          width={32}
          height={32}
          priority
          style={{ pointerEvents: "none", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
        />
      </div>

      {/* Modern floating tooltip */}
      {showTooltip && !isDragging && (
        <div
          style={{
            position: "absolute",
            right: "66px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(18, 18, 18, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#ffffff",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
            pointerEvents: "none",
            animation: "fadeIn 0.2s ease",
          }}
        >
          💬 Chat with us
        </div>
      )}
    </div>
  );
}
