"use client";
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';

// Order Components
import PlatformSelector from '@/components/order/PlatformSelector';
import ServiceSelector from '@/components/order/ServiceSelector';
import VariantSelector from '@/components/order/VariantSelector';
import LinkInput from '@/components/order/LinkInput';

// Summary Components
import QuantitySlider from '@/components/order/QuantitySlider';
import SearchContainer from '@/components/order/SearchContainer';
import ServiceCard from '@/components/order/ServiceCard';
import FollowerPreview from '@/components/preview/FollowerPreview';
import ServiceInfo from '@/components/order/ServiceInfo';
import type { NormalizedSmmService, Platform, ServiceType, Variant } from '@/types/smm';
import PhoneMockup from './PhoneMockup';
const STEPS = [
  { num: '01', title: 'Pick your\nplatform', subtitle: 'Choose from 50+ supported social media platforms, then select a service type.' },
  { num: '02', title: 'Set the\nquantity', subtitle: 'Paste your profile link and drag the slider to your desired count.' },
  { num: '03', title: 'Choose\nyour plan', subtitle: 'Browse services and select the best plan — rated, cheapest, or premium.' },
  { num: '04', title: 'Order\nplaced!', subtitle: 'Your order is live. Sit back and watch your account grow instantly.' },
];

const SCROLL_HEIGHT_VH = 450; // total scroll distance in vh units

const Howworks = () => {
  const outerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [enterProgress, setEnterProgress] = useState(0);

  // Cache dimensions to prevent mobile address bar jumpiness
  const cachedViewportH = useRef<number>(0);
  const cachedElH = useRef<number>(0);
  const cachedRootW = useRef<number>(0);

  useEffect(() => {
    const root = document.querySelector('.root') as HTMLElement;
    if (!root || !outerRef.current) return;

    let ticking = false;

    const compute = () => {
      const el = outerRef.current;
      if (!el) {
        ticking = false;
        return;
      }
      
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const elTopRelativeToRoot = elRect.top - rootRect.top;

      const currentRootW = root.clientWidth;
      // Only update cached heights if width changed (real resize) or uninitialized
      if (currentRootW !== cachedRootW.current || cachedViewportH.current === 0) {
        cachedRootW.current = currentRootW;
        cachedViewportH.current = root.clientHeight;
        cachedElH.current = el.clientHeight;
      }

      const viewportH = cachedViewportH.current;
      const elH = cachedElH.current;

      const scrollable = elH - viewportH;
      const scrolledIntoEl = -elTopRelativeToRoot;
      const scrolled = Math.max(0, Math.min(scrollable, scrolledIntoEl));

      setProgress(scrolled / (scrollable || 1));

      const pixelsVisible = viewportH - elTopRelativeToRoot;
      // Transition quickly over the first 100px
      const enter = Math.max(0, Math.min(1, Math.max(0, pixelsVisible) / 100));
      setEnterProgress(enter);

      if (root) {
        // Interpolate root background from #0f0f0f (rgb 15,15,15) to #000000
        const v = Math.round(15 * (1 - enter));
        root.style.backgroundColor = `rgb(${v}, ${v}, ${v})`;
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(compute);
        ticking = true;
      }
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    compute();
    const t = setTimeout(compute, 200);
    return () => {
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      root.style.backgroundColor = '';
      clearTimeout(t);
    };
  }, []);



  // ——————————————————————————————————————————————————————————————————————
  let step = 1;
  let activePlatform: Platform = 'instagram';
  let activeService: ServiceType = 'followers';
  let activeVariant: Variant = 'any';
  let link = '';
  let quantity = 1000;
  let category: 'recommended' | 'cheapest' | 'premium' = 'recommended';
  let selIndex = -1;
  let cursorX = '50%';
  let cursorY = '50%';
  let showCursor = true;
  let showServiceInfo = false;
  let showToast = false;
  let ordering = false;
  let buttonText = 'Continue →';
  let innerScrollY = 0;

  // --- Epic Intro & Scene Calculations ---
  // The entire scroll is driven directly by `progress` (0 to 1)

  // 1. Video Scroll Up (0 to 0.10)
  const videoScrollProgress = Math.min(1, progress / 0.10);
  const videoTranslateY = videoScrollProgress * -30; // Moves up 30vh
  
  // 2. Text Centers (0 to 0.10)
  // 3. Text slides down as phone comes up to prevent it from peeking out the top
  const phoneEntranceProgress = Math.min(1, Math.max(0, (progress - 0.15) / 0.15));
  const textTranslateY = 30 - videoScrollProgress * 30 + (phoneEntranceProgress * 25); 

  // 3. Video Fades Out (0.10 to 0.15)
  const videoOpacity = 1 - Math.min(1, Math.max(0, (progress - 0.10) / 0.05));

  // 4. Phone Comes Up (0.15 to 0.30)
  
  // 5. Text fades out smoothly as the phone comes up to prevent jittering overlaps
  const textOpacity = 1 - Math.min(1, Math.max(0, (phoneEntranceProgress - 0.2) / 0.8)); 
  
  // 6. Step Panel Fades In (0.25 to 0.30)
  const stepPanelOpacity = Math.min(1, Math.max(0, (progress - 0.25) / 0.05));

  // Determine current step and internal animations based on overall progress
  if (progress < 0.30) {
    // Intro phase: keep defaults
    step = 1;
  } else if (progress < 0.50) {
    // Scene 1: Platform & Setup
    step = 1;
    const sub = (progress - 0.30) / 0.20;
    if (sub < 0.25) {
      cursorX = '50%'; cursorY = '35%'; // Start near bottom
    } else if (sub < 0.5) {
      cursorX = '12%'; cursorY = '18%'; // Click Instagram
      activePlatform = 'instagram';
    } else if (sub < 0.75) {
      cursorX = '45%'; cursorY = '40%'; // Click Followers
      activeService = 'followers';
    } else {
      const scrollAnim = (sub - 0.75) / 0.25; // 0 to 1
      innerScrollY = scrollAnim * 180;
      
      cursorX = '50%'; cursorY = '84%'; // Move down to input/continue button
      activeVariant = 'any';
      link = 'instagram.com/pablosmmhq'; // Simulate typing link
    }
  } else if (progress < 0.70) {
    // Scene 2: Quantity & Selection
    step = 2;
    link = 'instagram.com/pablosmmhq';
    const sub = (progress - 0.50) / 0.20;
    if (sub < 0.2) {
      cursorX = '9%'; cursorY = '25%'; quantity = 1000; // Grab slider
    } else if (sub < 0.7) {
      const drag = (sub - 0.2) / 0.5;
      cursorX = `${10 + drag * 40}%`; cursorY = '25%'; // Drag slider
      quantity = Math.round(1000 + drag * 24000);
    } else {
      quantity = 25000;
      cursorX = '18%'; cursorY = '69%'; // Move down, preparing to scroll
    }
  } else if (progress < 0.88) {
    // Scene 3: View Details
    step = 3;
    link = 'instagram.com/pablosmmhq';
    quantity = 25000;
    const sub = (progress - 0.70) / 0.18;
    if (sub < 0.25) {
      cursorX = '80%'; cursorY = '27%'; // Move to "Premium" tab
      category = 'recommended';
    } else if (sub < 0.55) {
      category = 'premium'; // Clicked Premium
      cursorX = '85%'; cursorY = '52%'; // Move to "View Details"
    } else if (sub < 0.85) {
      category = 'premium';
      showServiceInfo = true; // Open ServiceInfo
      cursorX = '50%'; cursorY = '58%'; // View info
    } else {
      category = 'premium';
      showServiceInfo = true;
      cursorX = '7%'; cursorY = '4%'; // Click back button top-left
    }
  } else {
    // Scene 4: Finish & Toast
    step = 4;
    link = 'instagram.com/pablosmmhq';
    quantity = 25000;
    category = 'premium';
    const sub = (progress - 0.88) / 0.12;
    if (sub < 0.3) {
      cursorX = '50%'; cursorY = '40%'; ordering = false; // Move to Order button
    } else if (sub < 0.6) {
      cursorX = '50%'; cursorY = '45%';
      ordering = true; // Loading state
      showCursor = false;
    } else {
      cursorX = '50%'; cursorY = '45%';
      showCursor = false;
      showToast = true; // Show Success Toast
    }
  }

  // Calculate exit slide up progress for Step 4
  let phoneExitSlideProgress = 0;
  if (progress > 0.88) {
    phoneExitSlideProgress = Math.min(1, (progress - 0.88) / 0.12);
  }

  const currentStep = STEPS[step - 1];
  // Progress bar smoothly fills from 0 to 100% during the interactive scroll phase (progress 0.3 to 1.0)
  const stepBarPct = `${Math.min(1, Math.max(0, (progress - 0.3) / 0.7)) * 100}%`;

  // Determine fade of intro text based on phone sliding up
  const introVisible = phoneEntranceProgress < 0.5;

  const handleSkip = useCallback(() => {
    const root = document.querySelector('.root') as HTMLElement;
    if (!outerRef.current || !root) return;

    const nextEl = outerRef.current.nextElementSibling as HTMLElement;
    if (nextEl) {
      const rootRect = root.getBoundingClientRect();
      const nextRect = nextEl.getBoundingClientRect();
      const targetScroll = root.scrollTop + (nextRect.top - rootRect.top);
      root.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      });
    } else {
      const rootRect = root.getBoundingClientRect();
      const elRect = outerRef.current.getBoundingClientRect();
      const targetScroll = root.scrollTop + (elRect.bottom - rootRect.top);
      root.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      });
    }
  }, []);

  return (
    <div
      ref={outerRef}
      className="how-works"
      style={{ height: `${SCROLL_HEIGHT_VH}vh` }}
    >
      {/* ── Native Sticky Container ── */}
      <div
        className="hw-sticky-container"
        style={{
          position: 'sticky',
          top: 0,
          height: '100lvh', // Use large viewport height so it doesn't jump when mobile address bar hides
          width: '100%',
          backgroundColor: `rgba(0, 0, 0, ${enterProgress})`,
        }}
      >
        <motion.div 
          style={{ 
            width: '100%', height: '100%', 
            transform: `translateY(-${phoneExitSlideProgress * 28}vh)` 
          }}
        >
        {/* ── Intro Video Background ── */}
        <motion.div
          className="hw-video-container"
          style={{
            transform: `translateY(${videoTranslateY}vh)`,
            opacity: videoOpacity,
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 30%, transparent 60%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 30%, transparent 60%)',
          }}
        >
          <video
            src="/landing/how-works/bg.mp4#t=0.001"
            autoPlay loop muted playsInline
            suppressHydrationWarning
          />
          {/* Overlay to tint the video with colors from bg.png */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'url(/bg.png) center/cover no-repeat',
              mixBlendMode: 'color', // Applies the hue/saturation of bg.png to the video
              opacity: 0.8,
              pointerEvents: 'none',
            }}
          />
        </motion.div>

        {/* ── Intro Text ("BUILT FOR SPEED") ── */}
        <motion.div
          className="hw-intro-text-container"
          style={{
            transform: `translateY(${textTranslateY}vh)`,
            opacity: textOpacity,
          }}
        >
          <h2 className="hw-intro-title">
            BUILT<br/><span>FORSPEED</span>
          </h2>
          <div className="hw-intro-subtitle-row">
            <span className="hw-intro-subtitle">
              SCROLL AND SEE HOW IT WORKS
            </span>
            <div className="hw-mouse-icon" />
          </div>
        </motion.div>

        {/* ── Main content: Steps + Phone (overlapping) ── */}
        <div className="hw-main-content">
          {/* Top — Step panel (Instructions above phone) */}
          <motion.div 
            className="hw-step-panel"
            style={{ opacity: stepPanelOpacity }}
          >
            {/* Progress bar (Full width at top) */}
            <div className="hw-progress-track">
              <motion.div
                className="hw-progress-fill"
                animate={{ width: stepBarPct }}
                transition={{ type: 'spring', stiffness: 60, damping: 18 }}
              />
            </div>

            {/* Step numbers row */}
            <div className="hw-step-progress-row">
              <span className="hw-step-num">
                {currentStep.num}
              </span>
              <div style={{ flex: 1 }} />
              <span className="hw-step-total">04</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.h3 key={`t${step}`}
                className="hw-step-title"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}
              >
                {currentStep.title}
              </motion.h3>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.p key={`s${step}`}
                className="hw-step-subtitle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.22, delay: 0.1 }}
              >
                {currentStep.subtitle}
              </motion.p>
            </AnimatePresence>

            {/* Skip button below subtitle */}
            <div className="hw-skip-wrapper">
              <button 
                type="button"
                className="hw-skip-btn"
                onClick={handleSkip}
                aria-label="Skip to next section"
              >
                Skip <span>↓</span>
              </button>
            </div>
          </motion.div>

          {/* Bottom — Phone area (Flex layout to perfectly fit below text) */}
          <div className="hw-phone-container">
            <motion.div
              className="hw-phone-inner"
              style={{
                transform: `translateY(${(1 - phoneEntranceProgress) * 100}vh) scale(${0.9 + phoneEntranceProgress * 0.1})`,
                opacity: 1,
              }}
            >
              <PhoneMockup 
                step={step}
                activePlatform={activePlatform}
                activeService={activeService}
                activeVariant={activeVariant}
                link={link}
                quantity={quantity}
                category={category}
                selIndex={selIndex}
                cursorX={cursorX}
                cursorY={cursorY}
                showCursor={showCursor}
                showServiceInfo={showServiceInfo}
                showToast={showToast}
                ordering={ordering}
                innerScrollY={innerScrollY}
              />

            </motion.div>
          </div>
        </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Howworks;
