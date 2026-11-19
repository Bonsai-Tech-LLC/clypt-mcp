// API Response types. These mirror what /api/v1 returns: created and
// fetched objects come back unwrapped (no { link } / { tag } / { folder }
// envelope).

export interface ClyptLinkTag {
  id: string;
  name: string;
  color: string;
}

// formatLink() in the Clypt API
export interface ClyptLink {
  id: string;
  shortCode: string;
  shortUrl: string;
  url: string; // destination URL
  title: string | null;
  clickCount: number;
  isActive: boolean;
  expiresAt: string | null;
  folderId: string | null;
  customDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  tags: ClyptLinkTag[];
  createdAt: string;
  updatedAt: string;
}

// GET /links
export interface ClyptLinkList {
  links: ClyptLink[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ClyptCount {
  name: string;
  count: number;
}

// GET /links/:id/analytics
export interface ClyptAnalytics {
  linkId: string;
  shortCode: string;
  url: string;
  period: string;
  totalClicks: number;
  clicksInPeriod: number;
  timeseries: { date: string; count: number }[];
  topCountries: ClyptCount[];
  topDevices: ClyptCount[];
  topBrowsers: ClyptCount[];
  topOS: ClyptCount[];
  topReferrers: ClyptCount[];
}

// GET /analytics
export interface ClyptDashboardStats {
  period: string;
  totalLinks: number;
  totalClicks: number;
  clicksInPeriod: number;
  timeseries: { date: string; count: number }[];
  topLinks: {
    id: string;
    shortCode: string;
    shortUrl: string;
    url: string;
    title: string | null;
    clickCount: number;
  }[];
  topCountries: ClyptCount[];
  topDevices: ClyptCount[];
  topBrowsers: ClyptCount[];
  topReferrers: ClyptCount[];
}

// POST /tags returns the tag record; GET /tags adds linkCount
export interface ClyptTag {
  id: string;
  name: string;
  color: string;
  linkCount?: number;
  createdAt: string;
}

// POST /folders and GET /folders
export interface ClyptFolder {
  id: string;
  name: string;
  parentId: string | null;
  linkCount: number;
  subfolderCount: number;
  createdAt: string;
}

// A/B Testing
export interface ClyptAbTestVariant {
  id: string;
  label: string;
  url: string;
  weight: number;
  clicks: number;
  share: number;
  isWinner: boolean;
}

export interface ClyptAbTestResult {
  linkId: string;
  isActive: boolean;
  duration?: string;
  startedAt?: string;
  totalClicks: number;
  variants: ClyptAbTestVariant[];
  significance: {
    method: string;
    pValue: number;
    confident: boolean;
    minimumSampleReached: boolean;
    estimatedClicksToSignificance: number | null;
    recommendation: string;
  } | null;
}

// AI Artistic QR Codes
export interface ClyptAiQrCode {
  id: string;
  linkId: string;
  status: "generating" | "ready" | "failed";
  imageUrl?: string;
  scanVerified?: boolean;
  prompt?: string;
  style?: string;
  error?: string;
  estimatedSeconds?: number;
  remaining?: number;
}

export interface ClyptAiQrStyle {
  id: string;
  name: string;
}

export interface ApiError {
  error: string;
  message?: string;
  requiredScope?: string; // 403: the scope the API key lacks
}
