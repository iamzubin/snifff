import { useState } from "react";
import type { AppSettings } from "../hooks/useSettings";
import { THEME_PRESETS } from "../hooks/useSettings";

interface SettingsProps {
    settings: AppSettings;
    onUpdate: (partial: Partial<AppSettings>) => void;
    onApplyPreset: (name: string) => void;
    onReset: () => void;
    onClose: () => void;
}

export const Settings = ({
    settings,
    onUpdate,
    onApplyPreset,
    onReset,
    onClose,
}: SettingsProps) => {
    const [tab, setTab] = useState<"theme" | "general" | "network">("theme");

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h2 className="settings-title">⚙ SETTINGS</h2>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`settings-tab ${tab === "theme" ? "active" : ""}`}
                        onClick={() => setTab("theme")}
                    >
                        THEME
                    </button>
                    <button
                        className={`settings-tab ${tab === "general" ? "active" : ""}`}
                        onClick={() => setTab("general")}
                    >
                        GENERAL
                    </button>
                    <button
                        className={`settings-tab ${tab === "network" ? "active" : ""}`}
                        onClick={() => setTab("network")}
                    >
                        NETWORK
                    </button>
                </div>

                <div className="settings-body">
                    {tab === "theme" && (
                        <ThemeTab
                            settings={settings}
                            onUpdate={onUpdate}
                            onApplyPreset={onApplyPreset}
                        />
                    )}
                    {tab === "general" && (
                        <GeneralTab settings={settings} onUpdate={onUpdate} />
                    )}
                    {tab === "network" && (
                        <NetworkTab settings={settings} onUpdate={onUpdate} />
                    )}
                </div>

                <div className="settings-footer">
                    <button className="btn-settings-reset" onClick={onReset}>
                        RESET DEFAULTS
                    </button>
                    <button className="btn-settings-done" onClick={onClose}>
                        DONE
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Theme Tab ───

function ThemeTab({
    settings,
    onUpdate,
    onApplyPreset,
}: {
    settings: AppSettings;
    onUpdate: (p: Partial<AppSettings>) => void;
    onApplyPreset: (n: string) => void;
}) {
    return (
        <div className="settings-section">
            <div className="settings-section-title">COLOR PRESETS</div>
            <div className="theme-presets-grid">
                {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                    <button
                        key={key}
                        className={`theme-preset-card ${settings.themeName === key ? "active" : ""}`}
                        onClick={() => onApplyPreset(key)}
                    >
                        <div className="theme-preview">
                            <div
                                className="theme-swatch"
                                style={{ background: preset.colors.bgPrimary }}
                            >
                                <span style={{ color: preset.colors.accentPrimary }}>▪</span>
                                <span style={{ color: preset.colors.accentSecondary }}>▪</span>
                                <span style={{ color: preset.colors.accentDanger }}>▪</span>
                            </div>
                        </div>
                        <span className="theme-preset-name">{preset.label}</span>
                    </button>
                ))}
            </div>

            <div className="settings-section-title" style={{ marginTop: 16 }}>
                CUSTOM COLORS
            </div>
            <div className="color-pickers">
                <ColorPicker
                    label="PRIMARY"
                    value={settings.theme.accentPrimary}
                    onChange={(v) =>
                        onUpdate({ theme: { ...settings.theme, accentPrimary: v } })
                    }
                />
                <ColorPicker
                    label="SECONDARY"
                    value={settings.theme.accentSecondary}
                    onChange={(v) =>
                        onUpdate({ theme: { ...settings.theme, accentSecondary: v } })
                    }
                />
                <ColorPicker
                    label="DANGER"
                    value={settings.theme.accentDanger}
                    onChange={(v) =>
                        onUpdate({ theme: { ...settings.theme, accentDanger: v } })
                    }
                />
                <ColorPicker
                    label="BG PRIMARY"
                    value={settings.theme.bgPrimary}
                    onChange={(v) =>
                        onUpdate({ theme: { ...settings.theme, bgPrimary: v } })
                    }
                />
                <ColorPicker
                    label="BG SECONDARY"
                    value={settings.theme.bgSecondary}
                    onChange={(v) =>
                        onUpdate({ theme: { ...settings.theme, bgSecondary: v } })
                    }
                />
            </div>

            <div className="settings-row" style={{ marginTop: 12 }}>
                <ToggleSwitch
                    label="SCANLINES OVERLAY"
                    checked={settings.showScanlines}
                    onChange={(v) => onUpdate({ showScanlines: v })}
                />
            </div>
        </div>
    );
}

// ─── General Tab ───

function GeneralTab({
    settings,
    onUpdate,
}: {
    settings: AppSettings;
    onUpdate: (p: Partial<AppSettings>) => void;
}) {
    return (
        <div className="settings-section">
            <div className="settings-section-title">STARTUP</div>
            <div className="settings-row">
                <ToggleSwitch
                    label="AUTO-START ON LOGIN"
                    checked={settings.autoStart}
                    onChange={(v) => onUpdate({ autoStart: v })}
                />
            </div>
            <div className="settings-hint">
                Automatically launch SNIFFF when you log in to your Mac.
            </div>

            <div className="settings-section-title" style={{ marginTop: 16 }}>
                DISPLAY
            </div>
            <div className="settings-row">
                <label className="settings-label">REFRESH INTERVAL</label>
                <select
                    className="filter-select"
                    value={settings.refreshInterval}
                    onChange={(e) =>
                        onUpdate({ refreshInterval: Number(e.target.value) })
                    }
                >
                    <option value={1000}>1 SECOND</option>
                    <option value={2000}>2 SECONDS</option>
                    <option value={3000}>3 SECONDS</option>
                    <option value={5000}>5 SECONDS</option>
                    <option value={10000}>10 SECONDS</option>
                </select>
            </div>
            <div className="settings-hint">
                How often the connection data refreshes from the database.
            </div>

            <div className="settings-row">
                <label className="settings-label">MAX CONNECTIONS SHOWN</label>
                <select
                    className="filter-select"
                    value={settings.maxConnections}
                    onChange={(e) =>
                        onUpdate({ maxConnections: Number(e.target.value) })
                    }
                >
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={1000}>1,000</option>
                    <option value={2000}>2,000</option>
                </select>
            </div>
            <div className="settings-hint">
                Limits the number of connections displayed for performance.
            </div>

            <div className="settings-row" style={{ marginTop: 8 }}>
                <ToggleSwitch
                    label="NOTIFY ON NEW COUNTRY"
                    checked={settings.notifyNewCountry}
                    onChange={(v) => onUpdate({ notifyNewCountry: v })}
                />
            </div>
            <div className="settings-hint">
                Show a notification when a connection from a new country is detected.
            </div>
        </div>
    );
}

// ─── Network Tab ───

function NetworkTab({
    settings,
    onUpdate,
}: {
    settings: AppSettings;
    onUpdate: (p: Partial<AppSettings>) => void;
}) {
    return (
        <div className="settings-section">
            <div className="settings-section-title">CAPTURE</div>
            <div className="settings-row">
                <label className="settings-label">DEFAULT INTERFACE</label>
                <input
                    type="text"
                    className="search-input"
                    style={{ width: 180 }}
                    placeholder="AUTO (e.g. en0)"
                    value={settings.defaultInterface}
                    onChange={(e) => onUpdate({ defaultInterface: e.target.value })}
                />
            </div>
            <div className="settings-hint">
                Leave blank for auto-detection. Common: en0 (Wi-Fi), en1 (Ethernet).
            </div>

            <div className="settings-section-title" style={{ marginTop: 16 }}>
                API
            </div>
            <div className="settings-row">
                <label className="settings-label">IPINFO TOKEN</label>
                <span className="settings-value-dim">Configured via .env file</span>
            </div>
            <div className="settings-hint">
                Set IPINFO_TOKEN in ~/.env or the project .env file. Get a free token
                at ipinfo.io.
            </div>

            <div className="settings-section-title" style={{ marginTop: 16 }}>
                DATA
            </div>
            <div className="settings-row">
                <label className="settings-label">DATABASE LOCATION</label>
                <span className="settings-value-dim" style={{ fontSize: 9 }}>
                    ~/Library/Application Support/com.snifff.app/snifff.db
                </span>
            </div>
        </div>
    );
}

// ─── Shared components ───

function ColorPicker({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="color-picker">
            <label className="color-picker-label">{label}</label>
            <div className="color-picker-row">
                <input
                    type="color"
                    className="color-input"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <input
                    type="text"
                    className="color-hex-input"
                    value={value}
                    onChange={(e) => {
                        if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                            onChange(e.target.value);
                        }
                    }}
                    maxLength={7}
                />
            </div>
        </div>
    );
}

function ToggleSwitch({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="toggle-row">
            <span className="settings-label">{label}</span>
            <div
                className={`toggle-switch ${checked ? "on" : ""}`}
                onClick={() => onChange(!checked)}
            >
                <div className="toggle-knob" />
            </div>
        </label>
    );
}
