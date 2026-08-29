"use client"
import React, { useEffect, useMemo } from 'react'
import Image from 'next/image';
import { getCategoryMeta, serviceCategories } from '@/lib/constants';
import { useNormalizedServices } from '@/lib/useServices';
import type { Platform } from '@/types/smm';

interface ServiceCategory {
  name: string;
  alt: string;
  icon: string;
}

type PlatformKey = keyof typeof serviceCategories;

interface ServiceSelectorProps {
  activePlatform: PlatformKey | Platform | string;
  activeService: string;
  onServiceChange: (service: string) => void;
}

const ServiceSelector: React.FC<ServiceSelectorProps> = ({ activePlatform = 'instagram', activeService, onServiceChange }) => {
  const staticServices: ServiceCategory[] = serviceCategories[activePlatform as PlatformKey] || [];
  const { services: normalized } = useNormalizedServices();
  const [taxonomyCategories, setTaxonomyCategories] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch('/api/taxonomy')
      .then((res) => res.json())
      .then((data) => {
        if (data?.categories && Array.isArray(data.categories)) {
          setTaxonomyCategories(data.categories);
        }
      })
      .catch((err) => console.warn('Failed to load taxonomy in ServiceSelector', err));
  }, []);

  // Normalize any category string to its canonical ID for standard matching
  const canonicalizeCategory = (cat: string, platform: string): string => {
    const c = (cat || '').toLowerCase().trim();
    if (platform === 'youtube' && (c === 'followers' || c === 'subscriber' || c === 'subscribers')) return 'followers';
    if (platform === 'facebook' && (c === 'followers' || c === 'page_followers')) return 'page_followers';
    if (c === 'save' || c === 'saves') return 'saves';
    if (c === 'share' || c === 'shares' || c === 'repost' || c === 'reposts') return 'shares';
    if (c === 'subscriber' || c === 'subscribers' || c === 'member' || c === 'members') return 'followers';
    return c;
  };

  // Compute available service types dynamically from live API for the selected platform
  const servicesToShow = useMemo(() => {
    const platformKey = String(activePlatform).toLowerCase();
    const platformServices = (normalized || []).filter(
      (s) => String(s.platform).toLowerCase() === platformKey
    );

    // Collect all canonical category IDs present in the services for this platform
    const presentCategoryIds = new Set<string>();
    platformServices.forEach((s) => {
      const rawCat = String(s.category || s.type || '').toLowerCase().trim();
      if (rawCat) {
        presentCategoryIds.add(rawCat);
        presentCategoryIds.add(canonicalizeCategory(rawCat, platformKey));
      }
    });

    const platformTaxonomy = taxonomyCategories.filter(
      (c: any) => c.platformId === platformKey
    );

    if (platformTaxonomy.length > 0) {
      const list: ServiceCategory[] = [];
      const seenCanonical = new Set<string>();

      platformTaxonomy.forEach((c: any) => {
        const idLower = (c.id || '').toLowerCase().trim();
        const canonId = canonicalizeCategory(idLower, platformKey);

        // Include this category if any service matches its ID or canonicalized ID
        const hasServices = presentCategoryIds.has(idLower) || presentCategoryIds.has(canonId);

        // Deduplicate so each logical category only appears ONCE
        if (hasServices && !seenCanonical.has(canonId) && !seenCanonical.has(idLower)) {
          seenCanonical.add(canonId);
          seenCanonical.add(idLower);

          const meta = getCategoryMeta(idLower, platformKey);
          list.push({
            name: c.id,
            alt: c.name || meta.alt,
            icon: c.icon || meta.icon,
          });
        }
      });

      if (list.length > 0) return list;
    }

    // Fallback: If no taxonomy is configured for this platform, use staticServices deduplicated
    if (presentCategoryIds.size > 0) {
      const list: ServiceCategory[] = [];
      const seenCanonical = new Set<string>();

      staticServices.forEach((s) => {
        const canonId = canonicalizeCategory(s.name, platformKey);
        if (presentCategoryIds.has(canonId) && !seenCanonical.has(canonId)) {
          seenCanonical.add(canonId);
          list.push(s);
        }
      });

      if (list.length > 0) return list;
    }

    return staticServices;
  }, [normalized, activePlatform, staticServices, taxonomyCategories]);

  // Ensure activeService is valid when platform changes or data loads
  useEffect(() => {
    const names = servicesToShow.map((s) => s.name);
    if (names.length && !names.includes(activeService.toLowerCase())) {
      onServiceChange(names[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlatform, servicesToShow]);

  const handleServiceClick = (serviceName: string) => {
    onServiceChange(serviceName);
  };

  return (
    <div className='platform-container'>
      <div className="text-container">
        <span>STEP-2</span>
        <h3>What do you want to boost?</h3>
      </div>
      <div className="platforms">
        {servicesToShow.map((service) => (
          <div
            key={service.name}
            className={`service-card ${activeService.toLowerCase() === service.name.toLowerCase() ? 'active' : ''}`}
            onClick={() => handleServiceClick(service.name)}
          >
            <Image
              src={`/services/${service.icon}${activeService.toLowerCase() === service.name.toLowerCase() ? '-active' : ''}.png`}
              alt={service.alt}
              width={80}
              height={80}
              onError={(e) => {
                // Fallback to default icon if specific asset missing
                const target = e.target as HTMLImageElement;
                if (target && !target.src.includes('followers')) {
                  target.src = `/services/followers${activeService.toLowerCase() === service.name.toLowerCase() ? '-active' : ''}.png`;
                }
              }}
            />
            <span className={`${activeService.toLowerCase() === service.name.toLowerCase() ? 'active' : ''}`}>{service.alt}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServiceSelector;