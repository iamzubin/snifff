import { useState, useEffect, useCallback } from "react";

export interface ThemeColors {
    accentPrimary: string;
    accentSecondary: string;
    accentDanger: string;
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
}

export interface AppSettings {
    theme: ThemeColors;
    themeName: string;
    autoStart: boolean;
    refreshInterval: number;     // ms
    defaultInterface: string;
    maxConnections: number;
    showScanlines: boolean;
    sidePanelWidth: number;      // px
    notifyNewCountry: boolean;
}

const STORAGE_KEY = "snifff-settings";

export const THEME_PRESETS: Record<string, { label: string; colors: ThemeColors }> = {
    tactical: {
        label: "TACTICAL (DEFAULT)",
        colors: {
            accentPrimary: "#C67237",
            accentSecondary: "#D0A347",
            accentDanger: "#903B27",
            bgPrimary: "#070A0E",
            bgSecondary: "#0D1117",
            bgTertiary: "#1F1413",
        },
    },
    cyberpunk: {
        label: "CYBERPUNK",
        colors: {
            accentPrimary: "#00F0FF",
            accentSecondary: "#FF006E",
            accentDanger: "#FF4444",
            bgPrimary: "#0A0A12",
            bgSecondary: "#12121F",
            bgTertiary: "#1A1A2E",
        },
    },
    phosphor: {
        label: "PHOSPHOR GREEN",
        colors: {
            accentPrimary: "#39FF14",
            accentSecondary: "#7FFF00",
            accentDanger: "#FF3131",
            bgPrimary: "#050A05",
            bgSecondary: "#0A140A",
            bgTertiary: "#0F1F0F",
        },
    },
    arctic: {
        label: "ARCTIC",
        colors: {
            accentPrimary: "#5B9BD5",
            accentSecondary: "#8DC6FF",
            accentDanger: "#E06C75",
            bgPrimary: "#0B0E14",
            bgSecondary: "#10151E",
            bgTertiary: "#1A2030",
        },
    },
    crimson: {
        label: "CRIMSON",
        colors: {
            accentPrimary: "#E63946",
            accentSecondary: "#FF6B6B",
            accentDanger: "#FF1744",
            bgPrimary: "#0A0608",
            bgSecondary: "#140C10",
            bgTertiary: "#1F1218",
        },
    },
    solar: {
        label: "SOLAR FLARE",
        colors: {
            accentPrimary: "#FCA311",
            accentSecondary: "#FFD166",
            accentDanger: "#E63946",
            bgPrimary: "#0A0A0A",
            bgSecondary: "#141414",
            bgTertiary: "#1F1A10",
        },
    },
};

const DEFAULT_SETTINGS: AppSettings = {
    theme: THEME_PRESETS.tactical.colors,
    themeName: "tactical",
    autoStart: false,
    refreshInterval: 3000,
    defaultInterface: "",
    maxConnections: 500,
    showScanlines: true,
    sidePanelWidth: 420,
    notifyNewCountry: false,
};

function loadSettings(): AppSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch {
        // ignore
    }
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AppSettings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // ignore
    }
}

function applyTheme(colors: ThemeColors, showScanlines: boolean) {
    const root = document.documentElement;
    root.style.setProperty("--accent-primary", colors.accentPrimary);
    root.style.setProperty("--accent-secondary", colors.accentSecondary);
    root.style.setProperty("--accent-danger", colors.accentDanger);
    root.style.setProperty("--accent-glow", hexToRgba(colors.accentPrimary, 0.4));
    root.style.setProperty("--bg-primary", colors.bgPrimary);
    root.style.setProperty("--bg-secondary", colors.bgSecondary);
    root.style.setProperty("--bg-tertiary", colors.bgTertiary);
    root.style.setProperty("--bg-panel", hexToRgba(colors.bgSecondary, 0.85));
    root.style.setProperty("--bg-panel-solid", colors.bgSecondary);
    root.style.setProperty("--text-primary", colors.accentSecondary);
    root.style.setProperty("--text-secondary", colors.accentPrimary);
    root.style.setProperty("--text-dim", hexToRgba(colors.accentSecondary, 0.5));
    root.style.setProperty("--text-muted", hexToRgba(colors.accentPrimary, 0.3));
    root.style.setProperty("--border-color", hexToRgba(colors.accentPrimary, 0.25));
    root.style.setProperty("--border-bright", hexToRgba(colors.accentSecondary, 0.5));

    // Toggle scanlines
    const rootEl = document.getElementById("root");
    if (rootEl) {
        rootEl.classList.toggle("no-scanlines", !showScanlines);
    }
}

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function useSettings() {
    const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

    // Apply theme on mount and whenever settings change
    useEffect(() => {
        applyTheme(settings.theme, settings.showScanlines);
    }, [settings.theme, settings.showScanlines]);

    const updateSettings = useCallback((partial: Partial<AppSettings>) => {
        setSettingsState((prev) => {
            const next = { ...prev, ...partial };
            saveSettings(next);
            return next;
        });
    }, []);

    const applyPreset = useCallback((name: string) => {
        const preset = THEME_PRESETS[name];
        if (preset) {
            setSettingsState((prev) => {
                const next = { ...prev, theme: preset.colors, themeName: name };
                saveSettings(next);
                return next;
            });
        }
    }, []);

    const resetSettings = useCallback(() => {
        setSettingsState(DEFAULT_SETTINGS);
        saveSettings(DEFAULT_SETTINGS);
    }, []);

    return { settings, updateSettings, applyPreset, resetSettings };
}
