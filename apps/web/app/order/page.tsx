"use client"
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import PlatformSelector from '@/components/order/PlatformSelector';
import ServiceSelector from '@/components/order/ServiceSelector';
import { serviceCategories } from '@/lib/constants';
import LinkInput from '@/components/order/LinkInput';
import VariantSelector from '@/components/order/VariantSelector';
import type { Platform, ServiceType, Variant } from '@/types/smm';

type PlatformKey = keyof typeof serviceCategories;

const page = () => {
  const router = useRouter(); // Initialize router
  const [activePlatform, setActivePlatform] = useState<Platform | PlatformKey>('instagram');
  const [activeService, setActiveService] = useState<ServiceType>('followers');
  const [activeVariant, setActiveVariant] = useState<Variant>('any');
  const [link, setLink] = useState<string>('');

  const handlePlatformChange = (platformName: string) => {
    if (platformName === activePlatform) return;
    setActivePlatform(platformName as Platform);
    // Reset service and variant when platform changes
    setActiveService('followers');
    setActiveVariant('any');
  };

  const handleServiceChange = (serviceName: string) => {
    if (serviceName === activeService) return;
    setActiveService(serviceName as ServiceType);
    setActiveVariant('any');
  };

  const handleLinkChange = (newLink: string) => {
    setLink(newLink);
  };

  const handleContinue = () => {
    // Redirect to the desired URL with the parameters
    const qp = new URLSearchParams({
      platform: String(activePlatform),
      service: String(activeService),
      variant: String(activeVariant),
      link: link.trim(),
    });
    router.push(`/order/summary?${qp.toString()}`);
  };

  return (
    <div className="order-page">
      <PlatformSelector onPlatformChange={handlePlatformChange} activePlatform={activePlatform} />
      <ServiceSelector activeService={activeService} activePlatform={activePlatform} onServiceChange={handleServiceChange} />
      <VariantSelector platform={activePlatform as Platform} serviceType={activeService as ServiceType} activeVariant={activeVariant} onVariantChange={setActiveVariant} />
      <LinkInput onLinkChange={handleLinkChange} onContinue={handleContinue} />
    </div>
  );
};

export default page;