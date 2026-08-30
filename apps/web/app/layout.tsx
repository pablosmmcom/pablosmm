import type { Metadata } from "next";
import Script from "next/script";
import "./style.css";
import { CurrencyProvider } from "@/components/layout/CurrencyProvider";
import RootShell from "@/components/layout/RootShell";
import ImpersonationBanner from "@/components/layout/ImpersonationBanner";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "PabloSMM - Social Media Marketing Panel",
  description: "Grow your social media presence with affordable Instagram, YouTube, Facebook, X, and TikTok services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="cryptomus" content="e01f06fd" />
      </head>
      <body>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-S9HL88JSY2"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-S9HL88JSY2');
          `}
        </Script>
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `}
        </Script>
        {/* Meta Pixel Code */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1085475980551178');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1085475980551178&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        <CurrencyProvider>
          <AuthProvider>
            <ImpersonationBanner />
            <RootShell>{children}</RootShell>
            <Toaster richColors position="bottom-center" />
          </AuthProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
