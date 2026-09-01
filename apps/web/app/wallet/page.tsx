"use client";

import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/config';

interface Transaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function Page() {
  const { user, loading, convertPrice, refreshUser } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Refresh user data on mount to get latest balance (especially after auto-verify)
  useEffect(() => {
    refreshUser();
  }, []);

  // Fetch recent money transactions
  useEffect(() => {
    if (!user) return;
    const fetchTransactions = async () => {
      try {
        const url = isExpanded 
          ? `${getApiBaseUrl()}/wallet/transactions/recent?all=true`
          : `${getApiBaseUrl()}/wallet/transactions/recent`;
        const res = await fetch(url, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setTransactions(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch recent transactions:', err);
      }
    };
    fetchTransactions();
  }, [user, isExpanded]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // Backend user.balance is already a float
  const balance = convertPrice(user.balance);
  const displayName = user.name || user.username || user.email.split('@')[0];
  const avatarUrl = user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ', ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className='wallet-page'>
      <div className="top-nav">
        <Link className='back-btn' href="/order">
          <Image
            src="/wallet/back.png"
            alt="Back Arrow"
            width={32}
            height={32}
          />
        </Link>
        <div className="profile-container">
          <div className="profile">
            <img src={avatarUrl} alt="Profile Icon" width={32} height={32} style={{ borderRadius: '50%' }} />
          </div>
          <span>{displayName}'s Wallet</span>
        </div>
      </div>
      <div 
        className="wallet-container"
        style={{
          backgroundImage: `url(${user.balance > 0 ? "/wallet/wallet-money.png" : "/wallet/wallet-empty.png"})`,
          transition: "background-image 0.5s ease-in-out"
        }}
      >
        <div className="balance-section">
          {/* Using converted price directly, which includes the symbol */}
          <span className="balance-label">{balance}</span>
          <span className="balance-amount">wallet balance</span>
        </div>
      </div>
      <div className="methods-container">
        <p>ADD MONEY TO YOUR WALLET USING</p>
        <div className="methods">
          <Image
            src="/wallet/upi.png"
            alt="UPI"
            width={120}
            height={40}
          />
          <Image
            src="/wallet/rupay.png"
            alt="RuPay"
            width={120}
            height={40}
          />
          <Image
            src="/wallet/visa.png"
            alt="Visa"
            width={120}
            height={40}
          />
          <Image
            src="/wallet/mc.png"
            alt="MasterCard"
            width={120}
            height={40}
          />
          <Image
            src="/wallet/usdt.png"
            alt="USDT"
            width={120}
            height={40}
          />
        </div>
        <div className="wallet-bonus-pill">
          <span className="bonus-tag">🎁 10% BONUS</span>
          <span className="bonus-info">Get 10% signup bonus on ₹100+ deposits • Min. deposit ₹50</span>
        </div>
        <Link href="/wallet/add" style={{ width: '100%' }}><button>Add Money</button></Link>
      </div>
      {transactions.length > 0 && (
        <div className={`recent-transactions ${isExpanded ? 'expanded' : ''}`}>
          <div className="recent-header">
            {isExpanded ? (
               <div className="expanded-top-nav">
                 <button onClick={() => setIsExpanded(false)} className="back-btn">
                   <ArrowLeft size={28} color="#1a1a1a" />
                 </button>
                 <span>All Transactions</span>
               </div>
            ) : (
               <>
                 <div className="recent-title">
                   <p>Recent<br />Transactions</p>
                 </div>
                 <button onClick={() => setIsExpanded(true)} className="see-all-btn">
                   See All
                 </button>
               </>
            )}
          </div>
          <div className="transaction-list">
            {transactions.map((txn) => (
              <div className="transaction-card" key={txn.id}>
                <div className="txn-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                </div>
                <div className="txn-details">
                  <span className="txn-desc">{txn.description}</span>
                  <span className="txn-date">{formatDate(txn.created_at)}</span>
                </div>
                <span className="txn-amount">+{convertPrice(txn.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}