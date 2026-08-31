"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import HeaderSwitch from '@/components/layout/HeaderSwitch';
import BottomSheet from '@/components/modal/BottomSheet';
import CurrencyStrip from '@/components/layout/CurrencyStrip';
import FloatingWhatsApp from '@/components/layout/FloatingWhatsApp';
import WhatsAppPromptModal from '@/components/modal/WhatsAppPromptModal';

export default function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/provider');
  const isLandingPage = pathname === '/';
  
  if (isAdmin || isLandingPage) {
    // Render admin routes and landing page without site shell
    return <>{children}</>;
  }
  return (
    <>
      <div className="root">
        <HeaderSwitch />
        {children}
      </div>
      <BottomSheet />
      <FloatingWhatsApp />
      <WhatsAppPromptModal />
    </>
  );
}
