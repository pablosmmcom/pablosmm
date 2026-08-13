export type Platform = 'instagram' | 'facebook' | 'x' | 'telegram' | 'tiktok' | 'youtube' | 'whatsapp' | 'threads' | 'snapchat' | 'linkedin' | 'twitch';
export type ServiceType = 'followers' | 'likes' | 'views' | 'comments' | 'shares' | 'votes' | 'saves' | 'repost' | 'reactions';
export type Variant = 'any' | 'post' | 'reel' | 'story' | 'igtv' | 'video' | 'live' | 'short' | 'channel' | 'comments' | 'custom' | 'random' | 'community' | 'adword' | 'future' | 'tweet' | 'premium' | 'group' | 'india' | 'targeted' | 'dashboard';

export interface NormalizedSmmService {
	id: string; // provider service id
	// Source panel/provider key, e.g., 'earthpanel', 'anotherpanel'
	source?: string;
	// Original provider's service id (stringified)
	sourceServiceId?: string;
	platform: Platform;
	type: ServiceType;
	variant: Variant;
	providerName: string;
	category: string;
	// Final display rate per 1000 units after applying admin overrides/margins
	ratePer1000: number;
	// Provider base rate per 1000 before overrides
	baseRatePer1000?: number;
	// Currency the provider reports `baseRatePer1000` in. Defaults to 'USD' when unspecified.
	providerCurrency?: 'USD' | 'INR';
	// Optional admin display name override
	displayName?: string;
	displayDescription?: string;
	displayId?: string;
	min: number;
	max: number;
	refill: boolean;
	dripfeed: boolean;
	cancel: boolean;
	refillLimit?: number;
	averageTime: number | null;
	raw?: unknown; // full provider payload for debugging
	targeting?: string;
	quality?: string;
	stability?: string;
	badge?: string;
	tags?: string[];
	description?: string;
	isHidden?: boolean;
	status?: 'active' | 'hidden' | 'disabled';
	customInputRequired?: boolean;
	customInputLabel?: string;
}

