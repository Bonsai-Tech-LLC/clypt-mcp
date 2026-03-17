// API Response types

export interface ClyptLink {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  title?: string | null;
  description?: string | null;
  tags?: string[];
  folderId?: string | null;
  password?: boolean;
  expiresAt?: string | null;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClyptAnalytics {
  totalClicks: number;
  uniqueClicks: number;
  clicksByDate: { date: string; clicks: number }[];
  topCountries: { country: string; clicks: number }[];
  topDevices: { device: string; clicks: number }[];
  topReferrers: { referrer: string; clicks: number }[];
  topBrowsers: { browser: string; clicks: number }[];
}

export interface ClyptDashboardStats {
  totalLinks: number;
  totalClicks: number;
  topLinks: {
    id: string;
    shortCode: string;
    shortUrl: string;
    originalUrl: string;
    clickCount: number;
  }[];
}

export interface ClyptTag {
  id: string;
  name: string;
  color?: string | null;
  _count?: { links: number };
  createdAt: string;
}

export interface ClyptFolder {
  id: string;
  name: string;
  parentId?: string | null;
  _count?: { links: number };
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
}
