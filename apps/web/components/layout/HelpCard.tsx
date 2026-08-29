import React from 'react'
import Image from 'next/image'

interface HelpCardProps {
  onCancel?: () => void;
  isCancelable?: boolean;
  isCanceling?: boolean;
  customCancelText?: string;
  whatsappUrl?: string;
}

const HelpCard: React.FC<HelpCardProps> = ({ 
  onCancel, 
  isCancelable = false, 
  isCanceling = false, 
  customCancelText,
  whatsappUrl = "https://wa.me/919473528346"
}) => {
  const handleSupportClick = () => {
    if (typeof window !== 'undefined') {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className='help-card'>
        <div className="text-container">
            <h2 className='title'>Need Help with your orders?</h2>
            <p className='description'>Facing issues with delivery, refill,or order status? Get help instantly.</p>
            <div className="btn-wrapper">
                <button className='cta-help whatsapp' onClick={handleSupportClick}>
                    <Image src="/orders/platforms/whatsapp.png" alt="Whatsapp" width={24} height={24} />
                    <span>Contact Support</span>
                </button>
                {isCancelable && (
                  <button className='cta-help cancel' onClick={onCancel} disabled={isCanceling || !!customCancelText}>
                      <div className="circle"></div>
                      <span>{customCancelText ? customCancelText : (isCanceling ? "Canceling..." : "Cancel Order")}</span>
                  </button>
                )}
            </div>
        </div>
        <div className="response-time">
            <div className="glow"></div>
            <span>Avg. resonse time: ~10 mins</span>
        </div>
    </div>
  )
}

export default HelpCard