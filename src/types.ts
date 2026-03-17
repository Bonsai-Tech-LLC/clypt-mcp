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

export interface ApiError {
  error: string;
  message?: string;
}
