export interface ServiceItem {
  name: string;
  url: string;
  icon?: string;
  description?: string;
  type?: 'link' | 'uptime-kuma';
}

export interface Section {
  name: string;
  items: ServiceItem[];
}

export interface DashboardConfig {
  title: string;
  subtitle?: string;
  sections: Section[];
}