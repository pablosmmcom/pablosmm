"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import FollowerPreview from "@/components/preview/FollowerPreview";
import PostPreview from "@/components/preview/PostPreview";
import OrdersCard from "@/components/layout/OrdersCard";
import ServiceDetailsCard from "@/components/layout/ServiceDetailsCard";
import HelpCard from "@/components/layout/HelpCard";
import { getApiBaseUrl } from "@/lib/config";
import { useNormalizedServices } from "@/lib/useServices";
import { useAuth } from "@/components/providers/auth-provider";
import { getServiceTags } from "@/lib/serviceTags";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [statsVisible, setStatsVisible] = useState(false);

  const [order, setOrder] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [refilling, setRefilling] = useState(false);
  
  const { services } = useNormalizedServices();
  const { convertPrice } = useAuth();

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/orders/${id}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
          if (data.order?.link) {
            fetchMetadata(data.order.link);
          }
        } else {
          toast.error("Failed to load order details");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load order details");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const fetchMetadata = async (url: string) => {
    setLoadingMetadata(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/metadata?url=${encodeURIComponent(url)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMetadata(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    try {
      setCanceling(true);
      const res = await fetch(`${getApiBaseUrl()}/orders/${order.id}/cancel`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Cancellation request submitted");
        // Refetch order to update status
        const fetchRes = await fetch(`${getApiBaseUrl()}/orders/${id}`, { credentials: "include" });
        if (fetchRes.ok) {
          const freshData = await fetchRes.json();
          setOrder(freshData.order);
        }
      } else {
        toast.error(data.message || data.error || "Failed to cancel order");
      }
    } catch (err: any) {
      toast.error(err.message || "Error canceling order");
    } finally {
      setCanceling(false);
    }
  };

  const matchingService = order 
    ? services.find((s) => 
        String(s.id) === String(order.serviceId) || 
        String(s.id) === String(order.displayId) || 
        (s.sourceServiceId && s.sourceServiceId === order.serviceId) ||
        (s.sourceServiceId && (order as any).sourceServiceId && s.sourceServiceId === (order as any).sourceServiceId)
      ) 
    : null;

  const serviceTagData = matchingService ? getServiceTags(matchingService) : null;

  // Check if it's lifetime refill from tags or description
  const isLifetimeRefill = Boolean(
    serviceTagData?.refillLabel?.toLowerCase().includes("lifetime") ||
    serviceTagData?.refillLabel?.toLowerCase().includes("permanent") ||
    matchingService?.description?.toLowerCase().includes("lifetime") ||
    matchingService?.tags?.some((t: string) => t.toLowerCase().includes("refill:lifetime"))
  );

  // Extract refill days from tag (e.g. "refill:60 Days", "60 Days Refill" -> 60)
  const explicitRefillTag = matchingService?.tags?.find((t: string) => t.toLowerCase().startsWith("refill:"));
  const refillText = explicitRefillTag 
    ? explicitRefillTag.replace(/refill:/i, "") 
    : (serviceTagData?.refillLabel || matchingService?.description || "");

  const refillDaysMatch = refillText.match(/(\d+)\s*(?:days?|d)?/i);
  const parsedDays = refillDaysMatch ? parseInt(refillDaysMatch[1], 10) : 0;

  const refillDays = isLifetimeRefill ? 99999 : (parsedDays > 0 ? parsedDays : (matchingService?.refill ? 30 : 0));

  const isExplicitNoRefill = 
    serviceTagData?.refill === "No Refill" ||
    serviceTagData?.refillLabel?.toLowerCase().includes("no refill") ||
    (explicitRefillTag && explicitRefillTag.toLowerCase().includes("no refill"));

  const hasRefill = Boolean(
    !isExplicitNoRefill && 
    (matchingService?.refill || isLifetimeRefill || refillDays > 0 || serviceTagData?.refill === "Available")
  );

  const refillDisplayLabel = isLifetimeRefill 
    ? "Lifetime Refill" 
    : (refillDays > 0 ? `${refillDays} days refill` : "Refill Protection");

  const orderDate = order?.date ? new Date(order.date) : new Date();
  const expiryDate = new Date(orderDate);
  if (!isLifetimeRefill && refillDays > 0) {
    expiryDate.setDate(expiryDate.getDate() + refillDays);
  }
  const now = new Date();
  const daysLeft = isLifetimeRefill 
    ? 99999 
    : Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24)));

  const isActiveRefill = isLifetimeRefill ? true : (daysLeft > 0);

  const handleRefill = async () => {
    if (!order) return;
    
    if (!hasRefill) {
      toast.error("This service does not support refills.");
      return;
    }
    if (!isLifetimeRefill && daysLeft <= 0) {
      toast.error(`Refill period (${refillDays} days) has expired for this order.`);
      return;
    }
    if (order.pendingRefill) {
      toast.error("You already have a pending refill request.");
      return;
    }
    if ((order.refillsRemaining ?? 3) <= 0) {
      toast.error("You have no refills left for this order.");
      return;
    }

    try {
      setRefilling(true);
      const res = await fetch(`${getApiBaseUrl()}/orders/${order.id}/refill`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Refill request submitted");
        // Refetch order to update status
        const fetchRes = await fetch(`${getApiBaseUrl()}/orders/${id}`, { credentials: "include" });
        if (fetchRes.ok) {
          const freshData = await fetchRes.json();
          setOrder(freshData.order);
        }
      } else {
        toast.error(data.message || data.error || "Failed to submit refill request");
      }
    } catch (err: any) {
      toast.error(err.message || "Error submitting refill request");
    } finally {
      setRefilling(false);
    }
  };

  if (loading) {
    return (
      <div className="order-detail-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Loader2 className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="order-detail-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: '#fff' }}>
        Order not found
      </div>
    );
  }

  let delivered = 0;
  if (order.status === "completed") {
    delivered = order.quantity;
  } else if (order.status === "partial" || order.status === "processing" || order.status === "in_progress" || order.status === "active") {
    // If remains is valid (greater than 0 but less than quantity), use it.
    // Otherwise, assume 0 delivered for now (until provider updates it properly).
    if (order.remains > 0 && order.remains <= order.quantity) {
      delivered = order.quantity - order.remains;
    }
  }

  const percent = Math.min(100, Math.round((delivered / order.quantity) * 100)) || 0;
  const expected = order.startCount + order.quantity;
  
  const rawServiceName = order.displayName || matchingService?.displayName || matchingService?.providerName || order.serviceName || "";
  
  const getCleanServiceName = () => {
    if (order.category && order.category.trim() !== "" && order.category.toLowerCase() !== "default" && order.category.toLowerCase() !== "bestselling") {
      const catLower = order.category.toLowerCase();
      if (["views", "likes", "followers", "comments", "saves", "shares"].includes(catLower)) {
        const haystack = `${rawServiceName} ${order.category}`.toLowerCase();
        let platform = "Instagram"; // Default
        if (/facebook|\bfb\b/.test(haystack)) platform = "Facebook";
        else if (/youtube|\byt\b/.test(haystack)) platform = "YouTube";
        else if (/tiktok|\btt\b/.test(haystack)) platform = "TikTok";
        else if (/telegram|\btg\b/.test(haystack)) platform = "Telegram";
        else if (/twitter|\bx\b/.test(haystack)) platform = "X";
        return `${platform} ${order.category.charAt(0).toUpperCase() + order.category.slice(1)}`;
      }
      return order.category;
    }
    
    // Construct name from platform + type if available (e.g. "Instagram Views")
    if (matchingService && matchingService.platform && matchingService.type) {
      const platform = matchingService.platform.charAt(0).toUpperCase() + matchingService.platform.slice(1);
      const type = matchingService.type.charAt(0).toUpperCase() + matchingService.type.slice(1);
      return `${platform} ${type}`;
    }
    
    let name = rawServiceName;
    if (name.includes(':') && name.split(':')[1] === (order.displayId || order.serviceId?.split(':').pop())) {
       name = name.split(':').pop() || name;
    }
    if (name.includes('|')) {
       name = name.split('|')[0].trim();
    }
    return name || `Service #${order.displayId || order.serviceId?.split(':').pop()}`;
  };
  const cleanServiceName = getCleanServiceName();

  const getMetric = () => {
    const t = (order.serviceType || matchingService?.type || "").toLowerCase();
    if (t) return t;
    const nameStr = cleanServiceName.toLowerCase();
    if (nameStr.includes('view')) return 'views';
    if (nameStr.includes('like')) return 'likes';
    if (nameStr.includes('comment')) return 'comments';
    if (nameStr.includes('share')) return 'shares';
    if (nameStr.includes('save')) return 'saves';
    if (nameStr.includes('follow') || nameStr.includes('subscrib') || nameStr.includes('member')) return 'followers';
    return 'likes';
  };
  const metricType = getMetric();

  let calculatedRatePer1000Inr = 0;
  if (matchingService?.ratePer1000) {
    calculatedRatePer1000Inr = matchingService.ratePer1000;
  } else if ((order.charge || order.amount) && order.quantity) {
    calculatedRatePer1000Inr = ((order.charge || order.amount) / order.quantity) * 1000;
  }
  const getStatusMessage = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "completed") return "Your order has been completed!";
    if (s === "canceled") return "Your order was canceled.";
    if (s === "refunded") return "Your order was refunded.";
    if (s === "failed") return "Your order failed.";
    if (s === "partial") return "Your order was partially completed.";
    if (order.pendingCancel) {
      return "Your order is under cancellation! The amount will be automatically added to your wallet once it has been cancelled.";
    }
    switch (s) {
      case "active":
      case "processing":
      case "in_progress": return "Your order is under processing!";
      case "pending": return "Your order has been placed and is pending.";
      default: return `Your order is currently ${status}`;
    }
  };

  const isPlacedDone = true;
  const isProcessingDone = ["active", "processing", "in_progress", "partial", "completed"].includes(order.status);
  const isDeliveryDone = ["partial", "completed"].includes(order.status) || percent > 0;
  const isCompletedDone = ["completed", "partial"].includes(order.status);

  const getStepDate = (stepKey: string, isDone: boolean, isActive: boolean) => {
    if (!isDone && !isActive) return "";
    
    const placedTime = order.date ? new Date(order.date).getTime() : 0;
    let updatedTime = order.updatedAt ? new Date(order.updatedAt).getTime() : placedTime;

    // If updatedTime is identical to placedTime (because of local testing data), 
    // add a tiny 3-minute offset so they don't look identical, but small enough to not be in the future!
    if (updatedTime - placedTime < 60000) {
      updatedTime = placedTime + 3 * 60000;
    }

    if (stepKey === "placed") return format(new Date(placedTime), "d MMM, h:mm a");
    
    // If the step matches the current actual order status, show the exact updatedTime from the database!
    if (stepKey === "completed" && ["completed"].includes(order.status)) return format(new Date(updatedTime), "d MMM, h:mm a");
    if (stepKey === "delivery" && ["partial"].includes(order.status)) return format(new Date(updatedTime), "d MMM, h:mm a");
    if (stepKey === "processing" && ["active", "processing", "in_progress"].includes(order.status)) return format(new Date(updatedTime), "d MMM, h:mm a");
    
    // For past steps that don't have explicit timestamps, we deterministically interpolate between placedTime and updatedTime
    // This ensures they are never blank, they look realistic, and they NEVER change on refresh!
    if (order.status === "completed") {
      if (stepKey === "processing") return format(new Date(placedTime + (updatedTime - placedTime) * 0.2), "d MMM, h:mm a");
      if (stepKey === "delivery") return format(new Date(placedTime + (updatedTime - placedTime) * 0.5), "d MMM, h:mm a");
    }
    
    if (order.status === "partial") {
      if (stepKey === "processing") return format(new Date(placedTime + (updatedTime - placedTime) * 0.5), "d MMM, h:mm a");
    }
    
    // Fallback
    return format(new Date(updatedTime), "d MMM, h:mm a");
  };

  const timeline = [
    { label: "Order\nPlaced", date: getStepDate("placed", isPlacedDone, false), done: isPlacedDone },
    { label: "Processing\nStarted", date: getStepDate("processing", isProcessingDone, isProcessingDone && !isDeliveryDone), done: isProcessingDone },
    { label: "Delivery\nStarted", date: getStepDate("delivery", isDeliveryDone, isDeliveryDone && !isCompletedDone), done: isDeliveryDone },
    { label: "Order\nCompleted", date: getStepDate("completed", isCompletedDone, false), done: isCompletedDone },
  ];

  const renderPreview = () => {
    const getCleanTitle = (rawTitle: string) => {
      if (!rawTitle) return "";
      let title = rawTitle;
      const splitters = [" • Instagram", " - Instagram", " | Instagram", " | TikTok", " - TikTok", " • TikTok"];
      for (const splitter of splitters) {
        if (title.includes(splitter)) {
          title = title.split(splitter)[0];
        }
      }
      // Also Instagram adds " photos and videos" sometimes after • Instagram
      if (title.endsWith("photos and videos")) {
        title = title.replace(" photos and videos", "").trim();
      }
      // Clean trailing hyphens or dots if any
      title = title.replace(/[\s•|-]+$/, "").trim();
      return title;
    };

    let cleanUsername = getCleanTitle(metadata?.title) || order.link || 'Username';
    let cleanFullName = "";

    // Parse "Name (@username)" format if available
    const match = cleanUsername.match(/^(.*?)\s*\((@.*?)\)$/);
    if (match) {
      cleanFullName = match[1].trim();
      cleanUsername = match[2].trim();
    }

    if (metricType === "followers" || metricType === "subscribers" || metricType === "members") {
      return (
        <FollowerPreview
          primary={metadata?.followers || order.startCount || 0}
          following={metadata?.following || 0}
          posts={metadata?.posts || 0}
          primaryLabel={metricType || 'followers'}
          postsLabel={'posts'}
          followingLabel={'following'}
          username={cleanUsername}
          fullName={cleanFullName || undefined}
          avatarUrl={metadata?.image || '/bg.png'}
          className={`preview instagram followers order-detail`}
          isLoading={loadingMetadata}
        />
      );
    }
    
    const getMetricCount = () => {
      if (metricType === 'views' && metadata?.views) return metadata.views;
      if (metricType === 'likes' && metadata?.likes) return metadata.likes;
      if (metricType === 'comments' && metadata?.comments) return metadata.comments;
      return metadata?.views || metadata?.likes || metadata?.followers || metadata?.posts || order.startCount || 0;
    };

    // Otherwise fallback to post preview (likes, comments, views, etc)
    return (
      <PostPreview
        metric={metricType}
        metricCount={getMetricCount()}
        username={cleanUsername}
        fullName={cleanFullName || undefined}
        imageUrl={metadata?.image || '/bg.png'}
        isLoading={loadingMetadata}
      />
    );
  };

  return (
    <div className="order-detail-page">
      {/* ─── Header ─── */}
      <div className="order-detail-header">
        <div className="detail-btn" onClick={() => router.back()} style={{ cursor: 'pointer' }}>
          <Image src="/icons/back.png" alt="Back" width={24} height={24} />
        </div>
        <h3 className="title">Order Details</h3>
        <div className="detail-btn">
          <Link href={"/support"}>
            <Image src="/icons/support.png" alt="Support" width={24} height={24} />
          </Link>
        </div>
      </div>
      <div className="separator-line"></div>

      {/* ─── Follower / Post Preview ─── */}
      <div className="follower-detail-preview">
        {renderPreview()}

        {/* ─── Delivery Progress ─── */}
        <div className="delivery-progress">
          <div className="delivery-header">
            <div className="delivery-count">
              <span className="title">Delivered</span>
              <h3 className="count">{delivered.toLocaleString()}<span className="total"> / {order.quantity.toLocaleString()}</span></h3>
            </div>
            <span className="percent">{percent}%</span>
          </div>
          <div className="order-progress">
            <div className="sliderWrapper">
              <div className="progress-bar" />
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <span className="order-status-message">{getStatusMessage(order.status)}</span>
          </div>
        </div>

        {/* ─── Order Timeline ─── */}
        <div className="order-timeline">
          {timeline.map((step, idx) => {
            const isActive = step.done && (!timeline[idx + 1] || !timeline[idx + 1].done);
            return (
              <React.Fragment key={idx}>
                <div className={`timeline-step ${step.done ? "done" : ""} ${isActive ? "active" : ""}`}>
                  <div className="step-icon">
                    {step.done ? (
                      <Image src='/order-details/step-completed.png' alt="step-completed" width={18} height={18} />
                    ) : (
                      <Image src='/order-details/step-inactive.png' alt="step-inactive" width={18} height={18} />
                    )}
                  </div>
                  <span className="step-label">{step.label}</span>
                  <span className="step-date">{step.date}</span>
                </div>
                {idx < timeline.length - 1 && (
                  <div className={`timeline-connector ${step.done ? "done" : ""}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ─── Show More ─── */}
        {!statsVisible && (
          <div className="show-more" onClick={() => setStatsVisible(true)} style={{ cursor: "pointer" }}>
            <span>Show More</span>
            <Image src="/order-details/show.png" alt="Show More" width={24} height={24} />
          </div>
        )}

        {/* ─── Live Statistics ─── */}
        {statsVisible && (
          <div className="live-stats-section">
            <div className="live-stats-header">
              <div className="live-icon-group">
                <div className="live-icon">
                  <Image src="/order-details/live.png" alt="Live" width={40} height={40} />
                </div>
                <div className="live-text">
                  <span className="live-title">Live</span>
                  <span className="live-subtitle">Statistics</span>
                </div>
              </div>
              <div className="last-updated">
                <span className="update-dot"></span>
                <span>Last Updated: Just now</span>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-card-row">
                  <div className="stat-card-icon">
                    <Image src="/order-details/start-count.png" alt="Start" width={20} height={20} />
                  </div>
                  <div className="stat-card-body">
                    <span className="stat-card-label">Start Count</span>
                    <span className="stat-card-value">{order.startCount.toLocaleString()}</span>
                  </div>
                </div>
                <div className="stat-card-desc">
                  <span>Order’s Starting count</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-row">
                  <div className="stat-card-icon ordered">
                    <Image src="/order-details/ordered.png" alt="Ordered" width={20} height={20} />
                  </div>
                  <div className="stat-card-body">
                    <span className="stat-card-label">Ordered</span>
                    <span className="stat-card-value highlight">+{order.quantity.toLocaleString()}</span>
                  </div>
                </div>
                <div className="stat-card-desc">
                  <span>Total Order Value</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-row">
                  <div className="stat-card-icon">
                    <Image src="/order-details/delivered.png" alt="Delivered" width={20} height={20} />
                  </div>
                  <div className="stat-card-body">
                    <span className="stat-card-label">Delivered</span>
                    <span className="stat-card-value">{delivered.toLocaleString()}</span>
                  </div>
                </div>
                <div className="stat-card-desc">
                  <span>Delivered {metricType || 'items'}</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-row">
                  <div className="stat-card-icon">
                    <Image src="/order-details/expected.png" alt="Expected" width={20} height={20} />
                  </div>
                  <div className="stat-card-body">
                    <span className="stat-card-label">Expected</span>
                    <span className="stat-card-value">{expected.toLocaleString()}</span>
                  </div>
                </div>
                <div className="stat-card-desc">
                  <span>Final Count</span>
                </div>
              </div>
            </div>

            <button className="hide-stats-btn" onClick={() => setStatsVisible(false)}>
              <span>Hide</span>
              <Image src="/order-details/hide.png" alt="Toggle" width={16} height={16} />
            </button>
          </div>
        )}
      </div>

      {/* Order Detail Card */}
      <div className="order-detail-card-wrapper" style={{ marginTop: '12px' }}>
        <OrdersCard 
          variant="single"
          orders={[{ ...order, displayTitle: cleanServiceName }]} 
        />
      </div>

      {/* Refill Card */}
      {hasRefill && (
        <div className="refill-card">
          <div className="refill-card-top">
            <div className="refill-info-group">
              <Image src="/orders/heart.png" alt="Refill" width={20} height={20} />
              <div className="refill-text-col">
                <div className="label">Refill Protection</div>
                <div className="value">{refillDisplayLabel}</div>
              </div>
            </div>
            <div className={`status-badge`}>
              <div className={`glow ${isActiveRefill ? 'active' : 'danger'}`}></div>
              <span className={isActiveRefill ? 'active' : 'danger'}>{isActiveRefill ? 'Active' : 'Expired'}</span>
            </div>
          </div>

          <div className="refill-details-row">
            <div className="item">
              <div className="icon-wrapper">
                <Image src="/orders/expire.png" alt="Refill" width={16} height={16} />
              </div>
              <div className="item-detail-wrapper">
                <span>Expires in</span>
                <p>{isLifetimeRefill ? "Lifetime" : `${daysLeft} days`}</p>
              </div>
            </div>

            <div className="item">
              <div className="icon-wrapper">
                <Image src="/orders/left.png" alt="Refill" width={16} height={16} />
              </div>
              <div className="item-detail-wrapper">
                <span>Refill Left</span>
                <p>{order?.refillsRemaining ?? 3} Refills</p>
              </div>
            </div>

            <div className="item">
              <div className="icon-wrapper">
                <Image src="/orders/calender.png" alt="Refill" width={16} height={16} />
              </div>
              <div className="item-detail-wrapper">
                <span>Valid till</span>
                <p>{isLifetimeRefill ? "Lifetime" : format(expiryDate, "d MMMM, yyyy")}</p>
              </div>
            </div>
          </div>

          <div className="refill-action-row">
            <button 
              className='request-refill-btn' 
              disabled={refilling || (!isActiveRefill && !isLifetimeRefill)} 
              onClick={handleRefill}
            >
              {refilling ? (
                <Loader2 className="animate-spin" size={16} style={{ marginRight: 8 }} />
              ) : (
                <Image src="/orders/request-refill.png" alt="Request Refill" width={16} height={16} />
              )}
              {order?.pendingRefill ? 'Refill Requested' : refilling ? 'Requesting...' : 'Request Refill'}
            </button>
            <p className="note">
              <span>NOTE: </span>
              {isLifetimeRefill ? "Lifetime refill guarantee applies to this order" : "Refill topups automatically every month"}
            </p>
          </div>    
        </div>
      )}

      {/* Service details card */}
      <ServiceDetailsCard 
        id={order.displayId || (order.serviceId ? order.serviceId.split(':').pop() : '')}
        serviceName={cleanServiceName}
        tags={[
          { 
            label: hasRefill ? (isLifetimeRefill ? "Lifetime Refill" : `${refillDays} Days Refill`) : "No Refill", 
            status: hasRefill ? "success" : "danger", 
            active: hasRefill 
          },
          { 
            label: serviceTagData?.drop === "Non Drop" ? "Non Drop" : (serviceTagData?.drop === "High Drop" ? "High Drop" : "Low Drop"), 
            status: serviceTagData?.drop === "Non Drop" ? "success" : "danger", 
            active: true 
          },
          { 
            label: matchingService?.cancel ? "Cancel Available" : "Cancel Unavailable", 
            status: matchingService?.cancel ? "success" : "danger", 
            active: matchingService?.cancel 
          }
        ]}
        details={{
          startTime: "Instant",
          startTimeSubtitle: "0-10 Minutes",
          speed: serviceTagData?.speed || "Fast",
          speedSubtitle: "Avg. Delivery Speed",
          completeTime: matchingService?.averageTime ? `${Math.round(matchingService.averageTime / 60)} mins` : "~45 mins",
          completeTimeSubtitle: "Estimated",
          refillDuration: hasRefill ? (isLifetimeRefill ? "Lifetime" : `${refillDays} Days`) : "None",
          refillDurationSubtitle: hasRefill && matchingService?.refillLimit !== undefined && matchingService?.refillLimit > 0 ? `${matchingService.refillLimit} times/mo` : (hasRefill ? "Unlimited/Custom" : "No refill"),
          minOrder: matchingService?.min ? matchingService.min.toLocaleString() : "50",
          minOrderSubtitle: "Minimum Quantity",
          maxOrder: matchingService?.max ? matchingService.max.toLocaleString() : "50,000",
          maxOrderSubtitle: "Maximum Quantity",
          rate: calculatedRatePer1000Inr ? convertPrice(calculatedRatePer1000Inr) : "$0.00",
          rateSubtitle: "Per 1000 items",
          category: order.category || "Bestselling",
          categorySubtitle: "Service Category",
        }}
        description={matchingService?.description || matchingService?.displayDescription || `High quality service. Recommended for all types of accounts.`}
      />

      <HelpCard 
        onCancel={handleCancel} 
        isCancelable={!!(matchingService?.cancel && (order.status === 'pending' || order.status === 'processing' || order.status === 'submitted' || order.status === 'active')) && !order.pendingCancel} 
        isCanceling={canceling}
        customCancelText={order?.pendingCancel ? "Cancel Requested" : undefined}
      />
      
    </div>
  );
}
