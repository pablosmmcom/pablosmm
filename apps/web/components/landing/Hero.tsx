"use client";
import { motion, AnimatePresence } from 'framer-motion'
import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import { FaYoutube, FaInstagram, FaFacebook, FaTiktok, FaTwitch, FaTelegram, FaSpotify, FaSoundcloud, FaReddit, FaLinkedin, FaDiscord, FaPinterest, FaSnapchat, FaPlay, FaThumbsUp, FaClock, FaUserPlus } from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'
import { useNormalizedServices } from '@/lib/useServices';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { platformCategoryLabels, defaultCategoriesMeta, serviceCategories } from '@/lib/constants';

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', icon: FaYoutube, color: '#ff0000' },
  { id: 'instagram', name: 'Instagram', icon: FaInstagram, color: '#e1306c' },
  { id: 'facebook', name: 'Facebook', icon: FaFacebook, color: '#1877f2' },
  { id: 'tiktok', name: 'TikTok', icon: FaTiktok, color: '#ffffff' },
  { id: 'twitch', name: 'Twitch', icon: FaTwitch, color: '#9146ff' },
  { id: 'kick', name: 'Kick', icon: FaTwitch, color: '#53fc18' },
  { id: 'telegram', name: 'Telegram', icon: FaTelegram, color: '#229ED9' },
  { id: 'spotify', name: 'Spotify', icon: FaSpotify, color: '#1db954' },
  { id: 'soundcloud', name: 'Soundcloud', icon: FaSoundcloud, color: '#ff5500' },
  { id: 'x', name: 'X', icon: FaXTwitter, color: '#ffffff' },
  { id: 'reddit', name: 'Reddit', icon: FaReddit, color: '#ff4500' },
  { id: 'linkedin', name: 'LinkedIn', icon: FaLinkedin, color: '#0a66c2' },
  { id: 'discord', name: 'Discord', icon: FaDiscord, color: '#5865F2' },
  { id: 'pinterest', name: 'Pinterest', icon: FaPinterest, color: '#E60023' },
  { id: 'snapchat', name: 'Snapchat', icon: FaSnapchat, color: '#FFFC00' }
];

const getServiceIcon = (type: string) => {
  switch (type) {
    case 'followers':
      return FaUserPlus;
    case 'likes':
      return FaThumbsUp;
    case 'views':
      return FaPlay;
    case 'comments':
      return FaThumbsUp;
    default:
      return FaThumbsUp;
  }
};

const Hero = () => {
  const [activePlatform, setActivePlatform] = useState('youtube');
  const { services } = useNormalizedServices();
  const { user } = useAuth();
  const router = useRouter();

  const getPlatformInfo = (id: string) => PLATFORMS.find(p => p.id === id) || PLATFORMS[0];

  const getCategoryLabel = (platformId: string, type: string) => {
    const platOverrides = platformCategoryLabels[platformId];
    if (platOverrides && platOverrides[type]) {
      return platOverrides[type].label;
    }
    const def = defaultCategoriesMeta[type];
    if (def) return def.label;
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const handleOrderClick = (platformId: string, serviceType: string) => {
    const targetUrl = `/order?platform=${encodeURIComponent(platformId)}&service=${encodeURIComponent(serviceType)}`;
    if (user) {
      router.push(targetUrl);
    } else {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    }
  };

  const validPlatformCategories = useMemo(() => {
    const cats = (serviceCategories as any)[activePlatform] || [];
    return new Set(cats.map((c: any) => c.name));
  }, [activePlatform]);

  const activeServices = Array.from(
    services
      .filter((s) => s.platform === activePlatform && (validPlatformCategories.size === 0 || validPlatformCategories.has(s.type)))
      .reduce((acc, curr) => {
        const existing = acc.get(curr.type);
        if (!existing || curr.ratePer1000 < existing.ratePer1000) {
          acc.set(curr.type, curr);
        }
        return acc;
      }, new Map<string, typeof services[0]>())
      .values()
  );

  return (
    <div className='hero-section'>
        <div className="text-container">
          <h2>Grow every <br />social platform</h2>
          <p>Buy followers, likes, views, comments, members and more from one beautiful dashboard.</p>
        </div>
        <div className="badges-container">
          <div className="badge">
            <div className="icon">
              <Image src="/landing/laurels/l-heart.png" alt="Laurel-heart" width="32" height="32" />
              <p>MOST<br /><span>LOVED</span><br />SMMPANEL-2026</p>
            </div>
          </div>
          <div className="badge">
            <div className="icon">
              <Image src="/landing/laurels/l-ig.png" alt="Laurel-heart" width="32" height="32" />
              <p>WE<br />SUPPORT-<br /><span>INSTAGRAM</span></p>
            </div>
          </div>
        </div>
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="hero-video"
          suppressHydrationWarning
        >
          <source src="/landing/hero.webm#t=0.001" type="video/webm" />
        </video>
        <div className="platforms-section">
          <div className="platforms-container">
            {/* Active Platform Pill */}
            <div className="active-platform-pill">
              {React.createElement(getPlatformInfo(activePlatform).icon, { className: "icon", color: getPlatformInfo(activePlatform).color })}
              <span className="text">{getPlatformInfo(activePlatform).name}</span>
            </div>

            {/* All Platform Square Buttons */}
            {PLATFORMS.map((platform) => {
              const isActive = activePlatform === platform.id;
              const Icon = platform.icon;
              return (
                <button 
                  key={platform.id} 
                  className={`platform-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActivePlatform(platform.id)}
                >
                  <Icon className="icon" color={isActive ? '#fff' : '#888'} />
                </button>
              )
            })}
          </div>

          <div className="services-grid">
            {activeServices.length > 0 ? (
              activeServices.map((service, idx) => {
                const ServiceIcon = getServiceIcon(service.type);
                const PlatformIcon = getPlatformInfo(activePlatform).icon;
                const cardTitle = `${getPlatformInfo(activePlatform).name} ${getCategoryLabel(activePlatform, service.type)}`;
                return (
                  <div key={idx} className="service-card">
                    <div className="service-header">
                      <h3>{cardTitle}</h3>
                      <div className="service-icon-bg"><ServiceIcon size={12} className="s-icon" /></div>
                    </div>
                    <div className="service-platform">
                      <PlatformIcon color="rgb(130, 128, 126)" size={13} /> <span>{getPlatformInfo(activePlatform).name}</span>
                    </div>
                    <div className="service-price">
                      <span className="price">₹{service.ratePer1000.toFixed(2)}</span>
                      <span className="per">per 1000</span>
                    </div>
                    <button 
                      className="order-btn"
                      onClick={() => handleOrderClick(activePlatform, service.type)}
                    >
                      Order
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="service-card" style={{ gridColumn: '1 / -1', alignItems: 'center', textAlign: 'center', padding: '20px 10px 10px' }}>
                <div className="service-platform" style={{ justifyContent: 'center', marginBottom: '16px' }}>
                  <span>Would you like us to prioritize this platform?</span>
                </div>
                <button className="order-btn" style={{ width: '100%', maxWidth: '100%', padding: '8px 9px' }} onClick={() => alert('Thanks for voting!')}>
                  Vote for {getPlatformInfo(activePlatform).name}
                </button>
              </div>
            )}
          </div>
        </div>
    </div>
  )
}

export default Hero