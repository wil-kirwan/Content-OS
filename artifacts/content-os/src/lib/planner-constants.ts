export const LANE_GROUPS = [
  {
    key: "marketing_moments",
    label: "Marketing Moments",
    color: "bg-amber-500",
    lightColor: "bg-amber-50 border-amber-200",
    textColor: "text-amber-700",
    dotColor: "bg-amber-500",
    laneNames: ["Campaigns/Promos", "Product Launches", "Holidays", "Livestreams", "Sweepstakes", "YouTube Videos"],
  },
  {
    key: "site",
    label: "Site",
    color: "bg-purple-500",
    lightColor: "bg-purple-50 border-purple-200",
    textColor: "text-purple-700",
    dotColor: "bg-purple-500",
    laneNames: ["Homepage Hero", "Promo Banner", "YouTube Link", "Navigation Menu", "Bundle Offers", "Blog Post", "Other Site Updates"],
  },
  {
    key: "paid_digital",
    label: "Paid Digital",
    color: "bg-rose-500",
    lightColor: "bg-rose-50 border-rose-200",
    textColor: "text-rose-700",
    dotColor: "bg-rose-500",
    laneNames: ["Meta Ads", "Pinterest Paid", "Pinterest Organic", "Google Ads"],
  },
  {
    key: "email",
    label: "Email",
    color: "bg-green-500",
    lightColor: "bg-green-50 border-green-200",
    textColor: "text-green-700",
    dotColor: "bg-green-500",
    laneNames: ["Main Email Campaign", "Segment Email", "Flow Email", "SMS", "Coordinated Promotion"],
  },
  {
    key: "social",
    label: "Social",
    color: "bg-blue-500",
    lightColor: "bg-blue-50 border-blue-200",
    textColor: "text-blue-700",
    dotColor: "bg-blue-500",
    laneNames: ["Facebook Post", "Instagram Post", "Instagram Stories", "TikTok", "Podcast", "YouTube Shorts"],
  },
  {
    key: "influencers",
    label: "Influencers",
    color: "bg-pink-500",
    lightColor: "bg-pink-50 border-pink-200",
    textColor: "text-pink-700",
    dotColor: "bg-pink-500",
    laneNames: ["Influencer 1", "Influencer 2", "Influencer 3", "Influencer 4"],
  },
  {
    key: "affiliates",
    label: "Affiliates",
    color: "bg-teal-500",
    lightColor: "bg-teal-50 border-teal-200",
    textColor: "text-teal-700",
    dotColor: "bg-teal-500",
    laneNames: ["Affiliate 1", "Affiliate 2", "Affiliate 3", "Affiliate 4"],
  },
] as const;

export const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  planned: "bg-blue-100 text-blue-700",
  scheduled: "bg-indigo-100 text-indigo-700",
  synced: "bg-cyan-100 text-cyan-700",
  published: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-500",
};

export const APPROVAL_BADGE_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  approved: "bg-green-100 text-green-700",
  needs_changes: "bg-orange-100 text-orange-700",
  approved_to_publish: "bg-emerald-100 text-emerald-700",
};

export const SYNC_STATUS_COLORS: Record<string, string> = {
  not_synced: "bg-gray-100 text-gray-600",
  syncing: "bg-blue-100 text-blue-700",
  synced: "bg-cyan-100 text-cyan-700",
  failed: "bg-red-100 text-red-700",
  out_of_date: "bg-orange-100 text-orange-700",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-amber-600",
  high: "text-red-600",
};
