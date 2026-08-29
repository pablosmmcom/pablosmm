"use client"
import Image from 'next/image'
import React, { useMemo } from 'react'
import { platforms as staticPlatforms } from '@/lib/constants';
import { useNormalizedServices } from '@/lib/useServices';
import type { Platform } from '@/types/smm';

interface PlatformSelectorProps {
  activePlatform: Platform | string;
  onPlatformChange: (platform: string) => void;
}

const PlatformSelector: React.FC<PlatformSelectorProps> = ({ activePlatform, onPlatformChange }) => {
  const { services: normalized } = useNormalizedServices();
  const [taxonomyPlatforms, setTaxonomyPlatforms] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch('/api/taxonomy')
      .then((res) => res.json())
      .then((data) => {
        if (data?.platforms && Array.isArray(data.platforms) && data.platforms.length > 0) {
          setTaxonomyPlatforms(data.platforms);
        }
      })
      .catch((err) => console.warn('Failed to load taxonomy in PlatformSelector', err));
  }, []);

  const displayPlatforms = useMemo(() => {
    const activeSet = new Set<string>();
    if (normalized?.length) {
      for (const s of normalized) {
        if (s.platform) activeSet.add(s.platform.toLowerCase());
      }
    }

    const platformSource = taxonomyPlatforms.length > 0
      ? taxonomyPlatforms.map(p => ({ name: p.id, alt: p.name }))
      : staticPlatforms;

    if (activeSet.size > 0) {
      const list: { name: string; alt: string }[] = [];
      // Include configured taxonomy platforms matching active set first
      platformSource.forEach((p) => {
        if (activeSet.has(p.name.toLowerCase())) {
          list.push(p);
          activeSet.delete(p.name.toLowerCase());
        }
      });
      // Add any remaining custom platforms
      activeSet.forEach((customName) => {
        const formatted = customName.charAt(0).toUpperCase() + customName.slice(1);
        list.push({ name: customName, alt: formatted });
      });
      return list;
    }

    return platformSource;
  }, [normalized, taxonomyPlatforms]);

  const handlePlatformClick = (platformName: string) => {
    onPlatformChange(platformName);
  };

  return (
    <div className='platform-container'>
      <div className="text-container">
        <span>STEP-1</span>
        <h3>Choose the platform you want to boost.</h3>
      </div>
      <div className="platforms">
        {displayPlatforms.map((platform) => (
          <div
            key={platform.name}
            className={`platform-card ${String(activePlatform).toLowerCase() === platform.name.toLowerCase() ? 'active' : ''}`}
            onClick={() => handlePlatformClick(platform.name)}
          >
            <Image
              src={`/platforms/${platform.name}${String(activePlatform).toLowerCase() === platform.name.toLowerCase() ? '-active' : ''}.png`}
              alt={platform.alt}
              width={80}
              height={80}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target && !target.src.includes('instagram')) {
                  target.src = `/platforms/instagram${String(activePlatform).toLowerCase() === platform.name.toLowerCase() ? '-active' : ''}.png`;
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default PlatformSelector