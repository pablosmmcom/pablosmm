import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronUp, Eye, Rocket, Gauge, Clock, RotateCw, ShoppingCart, Tag, Star, FileText } from 'lucide-react';

interface ServiceDetailsCardProps {
  id?: string;
  serviceName?: string;
  tags?: { label: string; active?: boolean; status: "success" | "danger" }[];
  details?: {
    startTime: string;
    speed: string;
    completeTime: string;
    refillDuration: string;
    minOrder: string;
    maxOrder: string;
    rate: string;
    category: string;
    startTimeSubtitle: string;
    speedSubtitle: string;
    completeTimeSubtitle: string;
    refillDurationSubtitle: string;
    minOrderSubtitle: string;
    maxOrderSubtitle: string;
    rateSubtitle: string;
    categorySubtitle: string;
  };
  description?: string;
}

const ServiceDetailsCard: React.FC<ServiceDetailsCardProps> = ({ 
  id = "1948", 
  serviceName = "Instagram Followers",
  tags = [
    { label: "Refill available", status: "success", active: true },
    { label: "Cancel Unavailable", status: "danger" },
    { label: "Dripfeed Unavailable", status: "danger" }
  ],
  details = {
    startTime: "Instant",
    startTimeSubtitle: "0-10 Minutes",
    speed: "50K/Day",
    speedSubtitle: "Avg. Delivery Speed",
    completeTime: "~45 mins",
    completeTimeSubtitle: "Estimated",
    refillDuration: "30 Days",
    refillDurationSubtitle: "3 times/mo",
    minOrder: "50",
    minOrderSubtitle: "Minimum Quantity",
    maxOrder: "50,000",
    maxOrderSubtitle: "Maximum Quantity",
    rate: "$0.4",
    rateSubtitle: "Per 1000 followers",
    category: "Bestselling",
    categorySubtitle: "Most Popular Service",
  },
  description = "High quality Instagram followers from real active accounts. Fast delivery with low drop rate. Refill available for 30 days.\nRecommended for all types of accounts."
}) => {
  const [expanded, setExpanded] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const getPlatformIcon = (name: string = "") => {
    const haystack = name.toLowerCase();
    if (haystack.includes('instagram') || haystack.includes('ig')) return '/orders/platforms/instagram.png';
    if (haystack.includes('facebook') || haystack.includes('fb')) return '/orders/platforms/facebook.png';
    if (haystack.includes('twitter') || haystack.includes('x ') || haystack === 'x') return '/orders/platforms/x.png';
    if (haystack.includes('tiktok') || haystack.includes('tt')) return '/orders/platforms/tiktok.png';
    if (haystack.includes('youtube') || haystack.includes('yt')) return '/orders/platforms/youtube.png';
    if (haystack.includes('telegram') || haystack.includes('tg')) return '/orders/platforms/telegram.png';
    return '/orders/platforms/instagram.png';
  };

  return (
    <div className={`service-details-card ${expanded ? 'expanded' : ''}`}>
      <div className="sd-header" onClick={() => setExpanded(!expanded)}>
        <div className="sd-id-badge">ID: {id}</div>
        <span className="sd-title">Service Details</span>
        <button className="sd-toggle">
          {expanded ? <ChevronUp size={20} color="#838384" /> : <ChevronDown size={20} color="#838384" />}
        </button>
      </div>

      <div className="sd-divider-dashed" />

      <div className="sd-body">
        <div className="sd-platform">
          <Image src={getPlatformIcon(serviceName)} alt="Platform" width={44} height={44} className="sd-platform-icon" />
          <h3>{serviceName}</h3>
        </div>

        <div className="sd-tags">
          <div className="sd-tags-row">
            {tags.slice(0, 2).map((tag, idx) => (
              <div key={idx} className={`sd-tag ${tag.status} ${tag.active ? 'active' : ''}`}>
                <div className="sd-tag-dot" />
                {tag.label}
              </div>
            ))}
          </div>
          {tags.length > 2 && (
            <div className="sd-tags-row">
              {tags.slice(2).map((tag, idx) => (
                <div key={idx + 2} className={`sd-tag ${tag.status} ${tag.active ? 'active' : ''}`}>
                  <div className="sd-tag-dot" />
                  {tag.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {!expanded && (
          <div className="sd-show-more" onClick={() => setExpanded(true)}>
            Show More
            <Image src="/order-details/show.png" alt="down-arrow" width={20} height={20} />
          </div>
        )}

        <div className="sd-expandable-content" style={{ display: expanded ? "flex" : "none" }}>
          <div className="sd-grid">
            <div className="sd-grid-item">
              <div className="sd-item-row-wrapper">
                <div className="sd-icon-wrapper"><Image src="/orders/service-detail/start-time.png" alt="Rocket" width={20} height={20} /></div>
                <div className="sd-item-text">
                  <span className="sd-label">Start Time</span>
                  <span className="sd-value">{details.startTime}</span>
                </div>
              </div>
              <span className="sd-subtitle">{details.startTimeSubtitle}</span>
            </div>
            <div className="sd-grid-item">
              <div className="sd-item-row-wrapper">
                <div className="sd-icon-wrapper"><Image src="/orders/service-detail/speed.png" alt="Rocket" width={20} height={20} /></div>
                <div className="sd-item-text">
                  <span className="sd-label">Speed</span>
                  <span className="sd-value">{details.speed}</span>
                </div>
              </div>
              <span className="sd-subtitle">{details.speedSubtitle}</span>
            </div>
            <div className="sd-grid-item">
              <div className="sd-item-row-wrapper">
                <div className="sd-icon-wrapper"><Image src="/orders/service-detail/complete-time.png" alt="Rocket" width={20} height={20} /></div>
                <div className="sd-item-text">
                  <span className="sd-label">Complete Time</span>
                  <span className="sd-value">{details.completeTime}</span>
                </div>
              </div>
              <span className="sd-subtitle">{details.completeTimeSubtitle}</span>
            </div>
            <div className="sd-grid-item">
              <div className="sd-item-row-wrapper">
                <div className="sd-icon-wrapper"><Image src="/orders/service-detail/refill.png" alt="Rocket" width={20} height={20} /></div>
                <div className="sd-item-text">
                  <span className="sd-label">Refill Duration</span>
                  <span className="sd-value">{details.refillDuration}</span>
                </div>
              </div>
              <span className="sd-subtitle">{details.refillDurationSubtitle}</span>
            </div>
            <div className="sd-grid-item">
              <div className="sd-item-row-wrapper">
                <div className="sd-icon-wrapper"><Image src="/orders/service-detail/min.png" alt="Rocket" width={20} height={20} /></div>
                <div className="sd-item-text">
                  <span className="sd-label">Min Order</span>
                  <span className="sd-value">{details.minOrder}</span>
                </div>
              </div>
              <span className="sd-subtitle">{details.minOrderSubtitle}</span>
            </div>
            <div className="sd-grid-item">
              <div className="sd-item-row-wrapper">
                 <div className="sd-icon-wrapper"><Image src="/orders/service-detail/max.png" alt="Rocket" width={20} height={20} /></div>
                <div className="sd-item-text">
                  <span className="sd-label">Max Order</span>
                  <span className="sd-value">{details.maxOrder}</span>
                </div>
              </div>
              <span className="sd-subtitle">{details.maxOrderSubtitle}</span>
            </div>
            <div className="sd-grid-item">
              <div className="sd-item-row-wrapper">
                <div className="sd-icon-wrapper"><Image src="/orders/service-detail/rate.png" alt="Rocket" width={20} height={20} /></div>
                <div className="sd-item-text">
                  <span className="sd-label">Rate/1K</span>
                  <span className="sd-value">{details.rate}</span>
                </div>
              </div>
              <span className="sd-subtitle">{details.rateSubtitle}</span>
            </div>
            <div className="sd-grid-item">
              <div className="sd-item-row-wrapper">
                <div className="sd-icon-wrapper"><Image src="/orders/service-detail/category.png" alt="Rocket" width={20} height={20} /></div>
                <div className="sd-item-text">
                  <span className="sd-label">Category</span>
                  <span className="sd-value">{details.category}</span>
                </div>
              </div>
              <span className="sd-subtitle">{details.categorySubtitle}</span>
            </div>
          </div>

          <div className="sd-description-box">
            <div className="sd-desc-header">
              <div className="sd-icon-wrapper"><Image src="/orders/service-detail/description.png" alt="Rocket" width={20} height={20} /></div>
              <span>Description</span>
            </div>
            <div className={`sd-desc-content ${descExpanded ? 'expanded' : ''}`} style={descExpanded ? { maxHeight: 'none', display: 'block', overflow: 'visible', textOverflow: 'clip', whiteSpace: 'pre-wrap' } : { maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap' }}>
              {description}
            </div>
            <div className="sd-desc-read-more" onClick={() => setDescExpanded(!descExpanded)}>
              {descExpanded ? 'Show Less' : 'Read More'}
              <Image src="/order-details/show.png" alt="toggle" width={20} height={20} style={{ transform: descExpanded ? 'rotate(180deg)' : 'none' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailsCard;
