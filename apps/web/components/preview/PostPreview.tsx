"use client"
import React, { useEffect, useRef } from 'react'
import Image from 'next/image'
import CountUp from 'react-countup'
import type { ServiceType } from '@/types/smm'

type Props = {
  metric?: ServiceType | string
  metricCount?: number
  username?: string
  fullName?: string
  imageUrl?: string
  isLoading?: boolean
}

const PostPreview: React.FC<Props> = ({ metric = 'likes', metricCount = 120, username = 'example_post', imageUrl, isLoading }) => {
  const prevRef = useRef<number>(0);
  useEffect(() => { prevRef.current = metricCount; }, [metricCount]);

  if (isLoading) {
    return (
      <div className='preview post'>
        <div className='post-image skeleton-pulse' style={{ background: '#1a1a1a' }} />
        <div className="post-details">
          <div className="left" style={{ gap: 10 }}>
            <div className="skeleton-pulse" style={{ width: 40, height: 20, borderRadius: 4, background: '#1a1a1a' }} />
            <div className="skeleton-pulse" style={{ width: 40, height: 20, borderRadius: 4, background: '#1a1a1a' }} />
            <div className="skeleton-pulse" style={{ width: 40, height: 20, borderRadius: 4, background: '#1a1a1a' }} />
          </div>
          <div className="right" style={{ gap: 10 }}>
            <div className="skeleton-pulse" style={{ width: 40, height: 20, borderRadius: 4, background: '#1a1a1a' }} />
          </div>
        </div>
      </div>
    );
  }

  const renderCount = (forMetric: string) => {
    const m = String(metric).toLowerCase();
    const fm = String(forMetric).toLowerCase();
    // Accept singular or plural matches (e.g. 'save' vs 'saves')
    if (!(m === fm || m === fm + 's' || m + 's' === fm)) return null;
    return <span className="icon-count"><CountUp start={prevRef.current} end={metricCount} duration={0.8} redraw /></span>;
  };

  return (
    <div className='preview post'>
      <div className='post-image'>
        <Image
          src={imageUrl || '/bg.png'}
          alt='Background'
          fill
          className='blur-bg'
          priority
          unoptimized
        />
        <Image
          src={imageUrl || '/bg.png'}
          alt='Post Image'
          width={300}
          height={300}
          className='main-image'
          unoptimized
        />
      </div>
      <div className="post-details">
        <div className="left">
          <div className="icon"><Image src='/preview/like.svg' alt='Like' width={20} height={20} className='like' />{renderCount('likes')}</div>
          <div className="icon"><Image src='/preview/comment.svg' alt='Comment' width={20} height={20} className='comment' />{renderCount('comments')}</div>
          <div className="icon"><Image src='/preview/share.svg' alt='Share' width={20} height={20} className='share' />{renderCount('shares')}</div>
        </div>
        <div className="right">
          <div className="icon"><Image src='/preview/save.svg' alt='Save' width={20} height={20} className='save' />{renderCount('saves')}</div>
          <div className="icon"><Image src='/preview/views.png' alt='views' width={20} height={20} className='views' />{renderCount('views')}</div>
        </div>
      </div>
    </div>
  )
}

export default PostPreview