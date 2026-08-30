"use client";

import React, { useState, useEffect } from "react";

interface LandingLoaderProps {
  isReady?: boolean;
}

export default function LandingLoader({ isReady = true }: LandingLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Keep document scroll locked while preloader is active
    document.body.style.overflow = "hidden";

    if (isReady) {
      // Graceful display buffer (400ms) so animations smoothly complete
      const fadeTimer = setTimeout(() => {
        setFadeOut(true);
      }, 400);

      const removeTimer = setTimeout(() => {
        setLoading(false);
        document.body.style.overflow = "";
      }, 1000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
        document.body.style.overflow = "";
      };
    } else {
      setFadeOut(false);
    }
  }, [isReady]);

  if (!loading) return null;

  return (
    <div className={`landing-preloader ${fadeOut ? "fade-out" : ""}`}>
      <div className="preloader-glow" />
      
      {/* Transformed install-bottom-label loader */}
      <div className="install-bottom-label preloader-label">
        <span>LOADING</span>
        <span className="install-icon-sm" aria-hidden="true">
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </span>
        <span>PABLOSMM</span>
      </div>

      <span className="preloader-subtext">Initializing Services</span>
    </div>
  );
}
