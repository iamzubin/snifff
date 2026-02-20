import { useState, useMemo } from "react";
import type { IpConnection } from "../lib/types";

interface FilterBarProps {
    connections: IpConnection[];
    searchQuery: string;
    onSearchChange: (q: string) => void;
    selectedAsn: string | null;
    onAsnChange: (asn: string | null) => void;
    selectedCountry: string | null;
    onCountryChange: (code: string | null) => void;
    timeRange: { start: string; end: string } | null;
    onTimeRangeChange: (range: { start: string; end: string } | null) => void;
}

export const FilterBar = ({
    connections,
    searchQuery,
    onSearchChange,
    selectedAsn,
    onAsnChange,
    selectedCountry,
    onCountryChange,
    timeRange,
    onTimeRangeChange,
}: FilterBarProps) => {
    const [showFilters, setShowFilters] = useState(false);

    // Unique ASNs/orgs for dropdown
    const uniqueOrgs = useMemo(() => {
        const orgMap = new Map<string, number>();
        connections.forEach((c) => {
            const key = c.as_name || c.asn;
            if (key) {
                orgMap.set(key, (orgMap.get(key) || 0) + c.hit_count);
            }
        });
        return Array.from(orgMap.entries())
            .sort((a, b) => b[1] - a[1]);
    }, [connections]);

    // Unique countries for dropdown
    const uniqueCountries = useMemo(() => {
        const countryMap = new Map<string, { name: string; count: number }>();
        connections.forEach((c) => {
            if (c.country_code && c.country) {
                const existing = countryMap.get(c.country_code);
                if (existing) {
                    existing.count += c.hit_count;
                } else {
                    countryMap.set(c.country_code, { name: c.country, count: c.hit_count });
                }
            }
        });
        return Array.from(countryMap.entries())
            .map(([code, data]) => ({ code, name: data.name, count: data.count }))
            .sort((a, b) => b.count - a.count);
    }, [connections]);

    const hasActiveFilters = searchQuery || selectedAsn || selectedCountry || timeRange;

    const clearAll = () => {
        onSearchChange("");
        onAsnChange(null);
        onCountryChange(null);
        onTimeRangeChange(null);
    };

    return (
        <div className="filter-bar">
            <div className="filter-bar-main">
                <div className="search-input-wrapper">
                    <span className="search-icon">⌕</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="FILTER: IP, ORG, COUNTRY..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="search-clear" onClick={() => onSearchChange("")}>✕</button>
                    )}
                </div>
                <button
                    className={`filter-toggle-btn ${showFilters ? "active" : ""}`}
                    onClick={() => setShowFilters(!showFilters)}
                    title="Advanced filters"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <path d="M1 2h12L8.5 7.5V11l-3 1.5V7.5L1 2z" />
                    </svg>
                    {hasActiveFilters && <span className="filter-badge" />}
                </button>
                {hasActiveFilters && (
                    <button className="filter-clear-all" onClick={clearAll}>
                        CLEAR
                    </button>
                )}
            </div>

            {showFilters && (
                <div className="filter-bar-expanded">
                    {/* ASN/Org filter */}
                    <div className="filter-group">
                        <label className="filter-label">ORGANIZATION</label>
                        <select
                            className="filter-select"
                            value={selectedAsn || ""}
                            onChange={(e) => onAsnChange(e.target.value || null)}
                        >
                            <option value="">ALL ORGS</option>
                            {uniqueOrgs.map(([org, count]) => (
                                <option key={org} value={org}>
                                    {org} ({count})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Country filter */}
                    <div className="filter-group">
                        <label className="filter-label">COUNTRY</label>
                        <select
                            className="filter-select"
                            value={selectedCountry || ""}
                            onChange={(e) => onCountryChange(e.target.value || null)}
                        >
                            <option value="">ALL COUNTRIES</option>
                            {uniqueCountries.map((c) => (
                                <option key={c.code} value={c.code}>
                                    {countryFlag(c.code)} {c.name} ({c.count})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Time range */}
                    <div className="filter-group">
                        <label className="filter-label">TIME RANGE</label>
                        <div className="filter-time-row">
                            <input
                                type="datetime-local"
                                className="filter-time-input"
                                value={timeRange?.start || ""}
                                onChange={(e) => {
                                    const start = e.target.value;
                                    onTimeRangeChange(start ? { start, end: timeRange?.end || "" } : null);
                                }}
                                placeholder="FROM"
                            />
                            <span className="filter-time-sep">→</span>
                            <input
                                type="datetime-local"
                                className="filter-time-input"
                                value={timeRange?.end || ""}
                                onChange={(e) => {
                                    const end = e.target.value;
                                    onTimeRangeChange(end || timeRange?.start ? { start: timeRange?.start || "", end } : null);
                                }}
                                placeholder="TO"
                            />
                        </div>
                    </div>

                    {/* Active filter tags */}
                    {hasActiveFilters && (
                        <div className="filter-active-tags">
                            {selectedAsn && (
                                <span className="filter-tag" onClick={() => onAsnChange(null)}>
                                    ORG: {selectedAsn} ✕
                                </span>
                            )}
                            {selectedCountry && (
                                <span className="filter-tag" onClick={() => onCountryChange(null)}>
                                    COUNTRY: {selectedCountry} ✕
                                </span>
                            )}
                            {timeRange && (
                                <span className="filter-tag" onClick={() => onTimeRangeChange(null)}>
                                    TIME RANGE ✕
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

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
