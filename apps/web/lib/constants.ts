export const platforms = [
  { name: 'instagram', alt: 'Instagram' },
  { name: 'youtube', alt: 'YouTube' },
  { name: 'tiktok', alt: 'TikTok' },
  { name: 'telegram', alt: 'Telegram' },
  { name: 'facebook', alt: 'Facebook' },
  { name: 'x', alt: 'X (Twitter)' },
  { name: 'whatsapp', alt: 'WhatsApp' },
  { name: 'threads', alt: 'Threads' },
];

export interface CategoryMeta {
  id: string;
  name: string;
  alt: string;
  icon: string;
}

export const defaultCategoriesMeta: Record<string, { label: string; icon: string }> = {
  followers: { label: "Followers", icon: "followers" },
  likes: { label: "Likes", icon: "likes" },
  views: { label: "Views", icon: "views" },
  comments: { label: "Comments", icon: "comments" },
  shares: { label: "Shares", icon: "shares" },
  saves: { label: "Saves", icon: "save" },
  votes: { label: "Poll Votes", icon: "votes" },
  reactions: { label: "Reactions", icon: "likes" },
  repost: { label: "Repost", icon: "shares" },
  bot_start: { label: "Bot Start", icon: "followers" },
  members: { label: "Members", icon: "followers" },
  subscribers: { label: "Subscribers", icon: "followers" },
};

// Platform-specific label overrides
export const platformCategoryLabels: Record<string, Record<string, { label: string; icon: string }>> = {
  youtube: {
    followers: { label: "Subscribers", icon: "followers" },
  },
  telegram: {
    followers: { label: "Channel Members", icon: "followers" },
    shares: { label: "Shares / Forwards", icon: "shares" },
    bot_start: { label: "Bot Start", icon: "followers" },
  },
  facebook: {
    followers: { label: "Page Followers", icon: "followers" },
    likes: { label: "Post Likes", icon: "likes" },
    reactions: { label: "Post Reactions", icon: "likes" },
  },
  x: {
    views: { label: "Tweet Views", icon: "views" },
    shares: { label: "Retweets", icon: "shares" },
  },
  whatsapp: {
    followers: { label: "Channel Members", icon: "followers" },
    reactions: { label: "Channel Reactions", icon: "likes" },
  },
};

export const serviceCategories = {
  instagram: [
    { name: "followers", alt: "Followers", icon: "followers" },
    { name: "likes", alt: "Likes", icon: "likes" },
    { name: "views", alt: "Views", icon: "views" },
    { name: "comments", alt: "Comments", icon: "comments" },
    { name: "shares", alt: "Shares", icon: "shares" },
    { name: "saves", alt: "Saves", icon: "save" },
    { name: "votes", alt: "Story Poll Votes", icon: "votes" },
    { name: "reactions", alt: "Channel Reactions", icon: "likes" },
    { name: "repost", alt: "Repost", icon: "shares" },
  ],
  youtube: [
    { name: "followers", alt: "Subscribers", icon: "followers" },
    { name: "views", alt: "Views", icon: "views" },
    { name: "likes", alt: "Likes", icon: "likes" },
    { name: "comments", alt: "Comments", icon: "comments" },
    { name: "shares", alt: "Shares", icon: "shares" },
  ],
  tiktok: [
    { name: "followers", alt: "Followers", icon: "followers" },
    { name: "likes", alt: "Likes", icon: "likes" },
    { name: "views", alt: "Views", icon: "views" },
    { name: "comments", alt: "Comments", icon: "comments" },
    { name: "shares", alt: "Shares", icon: "shares" },
    { name: "saves", alt: "Saves", icon: "save" },
    { name: "repost", alt: "Repost", icon: "shares" },
  ],
  facebook: [
    { name: "followers", alt: "Page Followers", icon: "followers" },
    { name: "likes", alt: "Post Likes", icon: "likes" },
    { name: "views", alt: "Views", icon: "views" },
    { name: "comments", alt: "Comments", icon: "comments" },
    { name: "shares", alt: "Shares", icon: "shares" },
    { name: "reactions", alt: "Post Reactions", icon: "likes" },
    { name: "votes", alt: "Poll Votes", icon: "votes" },
  ],
  telegram: [
    { name: "followers", alt: "Channel Members", icon: "followers" },
    { name: "views", alt: "Post Views", icon: "views" },
    { name: "reactions", alt: "Reactions", icon: "likes" },
    { name: "shares", alt: "Shares / Forwards", icon: "shares" },
    { name: "votes", alt: "Poll Votes", icon: "votes" },
    { name: "bot_start", alt: "Bot Start", icon: "followers" },
  ],
  x: [
    { name: "followers", alt: "Followers", icon: "followers" },
    { name: "likes", alt: "Likes", icon: "likes" },
    { name: "views", alt: "Tweet Views", icon: "views" },
    { name: "shares", alt: "Retweets", icon: "shares" },
    { name: "comments", alt: "Comments", icon: "comments" },
    { name: "votes", alt: "Poll Votes", icon: "votes" },
  ],
  whatsapp: [
    { name: "followers", alt: "Channel Members", icon: "followers" },
    { name: "reactions", alt: "Channel Reactions", icon: "likes" },
    { name: "votes", alt: "Poll Votes", icon: "votes" },
  ],
  threads: [
    { name: "followers", alt: "Followers", icon: "followers" },
    { name: "likes", alt: "Likes", icon: "likes" },
    { name: "comments", alt: "Comments", icon: "comments" },
    { name: "shares", alt: "Shares", icon: "shares" },
  ],
};

export function getCategoryMeta(categoryName: string, platformName?: string, customRegistry?: Record<string, { label: string; icon: string }>): CategoryMeta {
  const catKey = categoryName.toLowerCase().trim();
  const platKey = (platformName || '').toLowerCase().trim();

  // Check custom registry first
  if (customRegistry && customRegistry[catKey]) {
    return {
      id: catKey,
      name: catKey,
      alt: customRegistry[catKey].label,
      icon: customRegistry[catKey].icon || 'followers',
    };
  }

  // Check platform-specific override
  if (platKey && platformCategoryLabels[platKey] && platformCategoryLabels[platKey][catKey]) {
    const item = platformCategoryLabels[platKey][catKey];
    return {
      id: catKey,
      name: catKey,
      alt: item.label,
      icon: item.icon,
    };
  }

  // Check default categories
  if (defaultCategoriesMeta[catKey]) {
    const item = defaultCategoriesMeta[catKey];
    return {
      id: catKey,
      name: catKey,
      alt: item.label,
      icon: item.icon,
    };
  }

  // Fallback for custom category name
  const formattedLabel = categoryName
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(w => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

  return {
    id: catKey,
    name: catKey,
    alt: formattedLabel || categoryName,
    icon: 'followers',
  };
}

