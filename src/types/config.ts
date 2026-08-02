export interface UptimeKumaConfig {
  slug?: string;
  monitorId?: number;
  apiUrl?: string;
}

export interface ServiceItem {
  name: string;
  url: string;
  icon?: string;
  description?: string;
  type?: 'link' | 'ping';
  uptimeKuma?: UptimeKumaConfig;
}

export interface Section {
  name: string;
  items: ServiceItem[];
}

export interface DashboardConfig {
  title: string;
  subtitle?: string;
  uptimeKumaBaseUrl?: string;
  sections: Section[];
}