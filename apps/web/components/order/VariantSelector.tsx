"use client";
import React, { useEffect, useMemo } from 'react';
import { useNormalizedServices } from '@/lib/useServices';
import type { Platform, ServiceType, Variant } from '@/types/smm';

interface VariantSelectorProps {
  platform: Platform;
  serviceType: ServiceType;
  activeVariant: Variant;
  onVariantChange: (v: Variant) => void;
}

const VARIANT_ORDER: Variant[] = [
  'any', 'custom', 'random', 'post', 'reel', 'story', 'comments', 
  'igtv', 'video', 'live', 'short', 'channel', 'community', 
  'adword', 'future', 'tweet', 'premium', 'group'
];

const getVariantLabel = (v: string, platform?: string, serviceType?: string): string => {
  if (platform === 'instagram') {
    if (serviceType === 'followers') {
      if (v === 'any' || v === 'profile') return 'Profile / Account';
      if (v === 'channel') return 'Broadcast Channel';
    }
    if (serviceType === 'likes') {
      if (v === 'post' || v === 'any') return 'Posts';
      if (v === 'reel') return 'Reels';
      if (v === 'story') return 'Story';
      if (v === 'comments') return 'Comment Likes';
    }
    if (serviceType === 'views') {
      if (v === 'reel' || v === 'any') return 'Reels / IGTV / Video';
      if (v === 'post') return 'Posts / Reach';
      if (v === 'story') return 'Story Views';
      if (v === 'dashboard') return 'Dashboard / Profile Views';
    }
    if (serviceType === 'comments') {
      if (v === 'custom') return 'Custom Comments';
      if (v === 'random' || v === 'any') return 'Random Comments';
    }
  }

  if (platform === 'youtube') {
    if (serviceType === 'views') {
      if (v === 'video' || v === 'any') return 'Regular Video Views';
      if (v === 'short') return 'Shorts Views';
      if (v === 'live') return 'Live Stream Concurrent';
      if (v === 'adword') return 'Google AdWords Views';
    }
    if (serviceType === 'likes') {
      if (v === 'video' || v === 'any') return 'Video Likes';
      if (v === 'short') return 'Shorts Likes';
      if (v === 'community') return 'Community Post Likes';
    }
  }

  if (platform === 'telegram') {
    if (serviceType === 'followers') {
      if (v === 'any' || v === 'channel') return 'Public Channel Members';
      if (v === 'group') return 'Private Group Members';
      if (v === 'premium') return 'Telegram Premium Members';
    }
    if (serviceType === 'views') {
      if (v === 'post' || v === 'any') return 'Single Post Views';
      if (v === 'future') return 'Auto Future Posts Views';
    }
  }

  if (platform === 'facebook') {
    if (serviceType === 'views') {
      if (v === 'reel') return 'Reels Views';
      if (v === 'video' || v === 'any') return 'Video Views';
      if (v === 'story') return 'Story Views';
      if (v === 'live') return 'Live Stream Views';
    }
  }

  if (platform === 'tiktok') {
    if (serviceType === 'views') {
      if (v === 'video' || v === 'any') return 'Video Views';
      if (v === 'live') return 'Live Stream Views';
    }
  }

  if (platform === 'x') {
    if (serviceType === 'views') {
      if (v === 'tweet' || v === 'any') return 'Tweet Views';
      if (v === 'video') return 'Video Views';
    }
  }

  switch (v) {
    case 'any':
      return 'All / General';
    case 'custom':
      return 'Custom Comments';
    case 'random':
      return 'Random Comments';
    case 'post':
      return 'Posts';
    case 'reel':
      return 'Reels';
    case 'story':
      return 'Story';
    case 'comments':
      return 'Comment Likes';
    case 'live':
      return 'Live Stream';
    case 'channel':
      return 'Channel / Broadcast';
    case 'igtv':
      return 'IGTV';
    case 'video':
      return 'Video';
    case 'short':
      return 'Shorts';
    case 'community':
      return 'Community Post';
    case 'adword':
      return 'AdWords Views';
    case 'future':
      return 'Auto Future Posts';
    case 'premium':
      return 'Premium Members';
    case 'group':
      return 'Group Members';
    default:
      return String(v).charAt(0).toUpperCase() + String(v).slice(1);
  }
};

const VariantSelector: React.FC<VariantSelectorProps> = ({ platform, serviceType, activeVariant, onVariantChange }) => {
  const { services } = useNormalizedServices();
  const [taxonomyCategories, setTaxonomyCategories] = React.useState<any[]>([]);

  // Load taxonomy from public /api/taxonomy
  React.useEffect(() => {
    fetch('/api/taxonomy')
      .then((res) => res.json())
      .then((data: any) => {
        if (data?.categories && Array.isArray(data.categories)) {
          setTaxonomyCategories(data.categories);
        }
      })
      .catch((err) => console.warn('Failed to load taxonomy in VariantSelector', err));
  }, []);

  const variants = useMemo(() => {
    const sTypeStr = String(serviceType).toLowerCase();
    // 1. Check taxonomy first
    const catObj = taxonomyCategories.find(
      (c) => c.platformId === platform && (
        c.id === sTypeStr ||
        (c.id === 'followers' && sTypeStr === 'subscribers') ||
        (c.id === 'page_followers' && sTypeStr === 'followers') ||
        (c.id === 'saves' && sTypeStr === 'save') ||
        (c.id === 'shares' && sTypeStr === 'repost')
      )
    );
    if (catObj) {
      if (catObj.subcategories && Array.isArray(catObj.subcategories) && catObj.subcategories.length > 0) {
        return catObj.subcategories.map((s: any) => s.id as Variant);
      }
      // If taxonomy defines this category but no subcategories are created for it, return empty array so subcategory section is hidden
      return [] as Variant[];
    }

    // 2. Fallback only if taxonomy hasn't loaded or isn't set up yet
    const set = new Set<Variant>();
    for (const s of services) {
      if (String(s.platform) === String(platform) && String(s.category || s.type) === String(serviceType)) {
        if (s.variant && s.variant.trim() !== '') {
          set.add(s.variant as Variant);
        }
      }
    }

    const arr = Array.from(set);
    arr.sort((a, b) => VARIANT_ORDER.indexOf(a) - VARIANT_ORDER.indexOf(b));
    return arr as Variant[];
  }, [taxonomyCategories, services, platform, serviceType]);

  // Reset invalid active variant - ensure a valid variant is always mandatory and selected
  useEffect(() => {
    if (variants.length > 0) {
      if (!activeVariant || !variants.includes(activeVariant)) {
        onVariantChange(variants[0]);
      }
    } else if (activeVariant !== 'any') {
      onVariantChange('any');
    }
  }, [platform, serviceType, variants, activeVariant, onVariantChange]);

  // If there is 1 or 0 variants available, hide this section completely so "Any" doesn't appear disconnected
  if (variants.length <= 1) return null;

  const sTypeStr = String(serviceType).toLowerCase();
  const currentCatObj = taxonomyCategories.find(
    (c) => c.platformId === platform && (
      c.id === sTypeStr ||
      (c.id === 'followers' && sTypeStr === 'subscribers') ||
      (c.id === 'page_followers' && sTypeStr === 'followers') ||
      (c.id === 'saves' && sTypeStr === 'save') ||
      (c.id === 'shares' && sTypeStr === 'repost')
    )
  );

  return (
    <div className="platform-container">
      <div className="text-container">
        <span>STEP-2.1</span>
        <h3>Choose Sub-Category / Option</h3>
      </div>
      <div className="platforms">
        {variants.map((v: Variant) => {
          const subObj = currentCatObj?.subcategories?.find((s: any) => s.id === v);
          const label = subObj ? subObj.name : getVariantLabel(v, platform, serviceType);
          const isActive = activeVariant === v;
          return (
            <div
              key={v}
              className={`service-card ${isActive ? 'active' : ''}`}
              onClick={() => onVariantChange(v)}
            >
              <span className={isActive ? 'active' : ''}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VariantSelector;
