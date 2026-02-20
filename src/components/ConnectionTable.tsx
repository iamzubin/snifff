import React, { useRef, useEffect } from "react";
import type { IpConnection } from "../lib/types";

interface ConnectionTableProps {
    connections: IpConnection[];
    newIps: Set<string>;
}

export const ConnectionTable: React.FC<ConnectionTableProps> = ({ connections, newIps }) => {
    const tableRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to top on new entries
    useEffect(() => {
        if (newIps.size > 0 && tableRef.current) {
            tableRef.current.scrollTop = 0;
        }
    }, [newIps]);

    const formatTime = (isoString: string) => {
        try {
            const d = new Date(isoString);
            return d.toLocaleTimeString("en-US", { hour12: false });
        } catch {
            return "--:--:--";
        }
    };

    return (
        <>
            <div className="table-header">
                <span className="table-title">CONNECTIONS LOG</span>
                <span className="table-count">{connections.length} ENTRIES</span>
            </div>
            <div className="connection-table-wrapper" ref={tableRef}>
                <table className="connection-table">
                    <thead>
                        <tr>
                            <th>IP ADDRESS</th>
                            <th>ORG</th>
                            <th>COUNTRY</th>
                            <th style={{ textAlign: 'right' }}>HITS</th>
                            <th>LAST</th>
                        </tr>
                    </thead>
                    <tbody>
                        {connections.map((conn) => (
                            <tr
                                key={conn.ip}
                                className={newIps.has(conn.ip) ? "new-row" : ""}
                            >
                                <td className="ip-cell">{conn.ip}</td>
                                <td title={conn.as_name || ""}>
                                    {conn.as_name || conn.asn || "—"}
                                </td>
                                <td className="country-cell">
                                    {conn.country_code
                                        ? `${countryFlag(conn.country_code)} ${conn.country_code}`
                                        : "···"}
                                </td>
                                <td className="hit-cell">{conn.hit_count}</td>
                                <td>{formatTime(conn.last_seen)}</td>
                            </tr>
                        ))}
                        {connections.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-dim)" }}>
                                    {`// AWAITING DATA`}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

/** Convert country code to emoji flag */
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
