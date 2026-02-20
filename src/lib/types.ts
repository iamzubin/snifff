export interface IpConnection {
  ip: string;
  asn: string | null;
  as_name: string | null;
  as_domain: string | null;
  country_code: string | null;
  country: string | null;
  continent_code: string | null;
  continent: string | null;
  hit_count: number;
  first_seen: string;
  last_seen: string;
}

export interface CountryStats {
  country_code: string;
  country: string;
  hit_count: number;
  unique_ips: number;
}

export interface AppStats {
  total_ips: number;
  total_hits: number;
  total_countries: number;
  uptime_seconds: number;
  is_running: boolean;
}

export interface NewIpEvent {
  ip: string;
  country_code: string | null;
  country: string | null;
  asn: string | null;
  as_name: string | null;
}
