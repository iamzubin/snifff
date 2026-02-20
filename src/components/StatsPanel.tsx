import React from "react";
import type { AppStats, CountryStats, IpConnection } from "../lib/types";

interface StatsPanelProps {
    stats: AppStats;
    countryStats: CountryStats[];
    connections: IpConnection[];
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, countryStats, connections }) => {
    // Get top 5 ASNs by aggregating connections
    const asnMap = new Map<string, { name: string; count: number }>();
    connections.forEach((c) => {
        const key = c.as_name || c.asn || null;
        if (key) {
            const existing = asnMap.get(key);
            if (existing) {
                existing.count += c.hit_count;
            } else {
                asnMap.set(key, { name: key, count: c.hit_count });
            }
        }
    });
    const topAsns = Array.from(asnMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Top countries
    const topCountries = countryStats.slice(0, 5);

    return (
        <>
            {/* Stat boxes */}
            <div className="stats-panel">
                <div className="stat-box">
                    <span className="stat-label">UNIQUE IPS</span>
                    <span className="stat-value">{formatNum(stats.total_ips)}</span>
                </div>
                <div className="stat-box">
                    <span className="stat-label">TOTAL HITS</span>
                    <span className="stat-value">{formatNum(stats.total_hits)}</span>
                </div>
                <div className="stat-box">
                    <span className="stat-label">COUNTRIES</span>
                    <span className="stat-value">{stats.total_countries}</span>
                </div>
            </div>

            {/* Top ASNs */}
            {topAsns.length > 0 && (
                <div className="top-asn-section">
                    <div className="top-asn-title">TOP ORGANIZATIONS</div>
                    {topAsns.map((asn) => (
                        <div key={asn.name} className="top-asn-item">
                            <span className="top-asn-name">{asn.name}</span>
                            <span className="top-asn-count">{formatNum(asn.count)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Top Countries */}
            {topCountries.length > 0 && (
                <div className="top-asn-section">
                    <div className="top-asn-title">TOP COUNTRIES</div>
                    {topCountries.map((cs) => (
                        <div key={cs.country_code} className="top-asn-item">
                            <span className="top-asn-name">
                                {countryFlag(cs.country_code)} {cs.country}
                            </span>
                            <span className="top-asn-count">{formatNum(cs.hit_count)}</span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

function formatNum(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
}

function countryFlag(countryCode: string): string {
    try {
        const codePoints = countryCode
            .toUpperCase()
            .split("")
            .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
        return String.fromCodePoint(...codePoints);
    } catch {
        return "";
    }
}
