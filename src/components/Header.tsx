import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppStats } from "../lib/types";

interface HeaderProps {
    isRunning: boolean;
    onToggle: () => void;
    stats: AppStats;
    onSettingsClick?: () => void;
}

export const Header = ({ isRunning, onToggle, stats, onSettingsClick }: HeaderProps) => {
    const [uptime, setUptime] = useState("00:00:00");
    const appWindow = getCurrentWindow();

    useEffect(() => {
        const update = () => {
            const s = stats.uptime_seconds;
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            setUptime(
                `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
            );
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [stats.uptime_seconds]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.buttons === 1) {
            if (e.detail === 2) {
                appWindow.toggleMaximize();
            } else {
                appWindow.startDragging();
            }
        }
    };

    return (
        <div className="header" onMouseDown={handleMouseDown}>
            <div className="header-left">
                <div>
                    <div className="app-title">SNIFFF</div>
                    <div className="app-subtitle">NETWORK INTELLIGENCE SYSTEM</div>
                </div>
            </div>
            <div className="header-right" onMouseDown={(e) => e.stopPropagation()}>
                <span className="uptime">{uptime}</span>

                <div className="status-indicator">
                    <span className={`status-dot ${isRunning ? "active" : ""}`} />
                    <span>{isRunning ? "ACTIVE" : "STANDBY"}</span>
                </div>

                <button
                    className={`btn-tactical ${isRunning ? "active" : ""}`}
                    onClick={onToggle}
                >
                    {isRunning ? "■ STOP" : "▶ START"}
                </button>

                {/* Settings button */}
                {onSettingsClick && (
                    <button
                        className="window-btn settings-btn"
                        onClick={onSettingsClick}
                        title="Settings"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                            <path d="M7 4.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                            <path d="M12.7 5.5l-1.1-.2c-.1-.3-.2-.6-.4-.9l.6-.9a.5.5 0 00-.1-.6L10.6 1.8a.5.5 0 00-.6-.1l-.9.6c-.3-.2-.6-.3-.9-.4L8 .8a.5.5 0 00-.5-.3H6.5a.5.5 0 00-.5.3l-.2 1.1c-.3.1-.6.2-.9.4l-.9-.6a.5.5 0 00-.6.1L2.3 2.9a.5.5 0 00-.1.6l.6.9c-.2.3-.3.6-.4.9l-1.1.2a.5.5 0 00-.3.5v1a.5.5 0 00.3.5l1.1.2c.1.3.2.6.4.9l-.6.9a.5.5 0 00.1.6l1.1 1.1a.5.5 0 00.6.1l.9-.6c.3.2.6.3.9.4l.2 1.1a.5.5 0 00.5.3h1a.5.5 0 00.5-.3l.2-1.1c.3-.1.6-.2.9-.4l.9.6a.5.5 0 00.6-.1l1.1-1.1a.5.5 0 00.1-.6l-.6-.9c.2-.3.3-.6.4-.9l1.1-.2a.5.5 0 00.3-.5v-1a.5.5 0 00-.3-.5z" />
                        </svg>
                    </button>
                )}

                {/* Window controls */}
                <div className="window-controls">
                    <button
                        className="window-btn minimize"
                        onClick={() => appWindow.minimize()}
                        title="Minimize"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <rect x="0" y="4" width="10" height="1.5" fill="currentColor" />
                        </svg>
                    </button>
                    <button
                        className="window-btn maximize"
                        onClick={() => appWindow.toggleMaximize()}
                        title="Maximize"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                    </button>
                    <button
                        className="window-btn close"
                        onClick={() => appWindow.close()}
                        title="Close"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
