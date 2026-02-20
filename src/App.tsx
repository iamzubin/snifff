import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import "./index.css";
import { WorldMapComponent } from "./components/WorldMap";
import { ConnectionTable } from "./components/ConnectionTable";
import { StatsPanel } from "./components/StatsPanel";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { Settings } from "./components/Settings";
import { useSettings } from "./hooks/useSettings";
import type { IpConnection, CountryStats, AppStats, NewIpEvent } from "./lib/types";

function App() {
  const [connections, setConnections] = useState<IpConnection[]>([]);
  const [countryStats, setCountryStats] = useState<CountryStats[]>([]);
  const [stats, setStats] = useState<AppStats>({
    total_ips: 0,
    total_hits: 0,
    total_countries: 0,
    uptime_seconds: 0,
    is_running: false,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [newIps, setNewIps] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Settings ───
  const { settings, updateSettings, applyPreset, resetSettings } = useSettings();

  // ─── Filter State ───
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsn, setSelectedAsn] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<{ start: string; end: string } | null>(null);

  // Track seen countries for notifications
  const seenCountriesRef = useRef<Set<string>>(new Set());

  // ─── Autostart sync ───
  useEffect(() => {
    const syncAutostart = async () => {
      try {
        const enabled = await isEnabled();
        if (settings.autoStart && !enabled) {
          await enable();
          console.log("[SNIFFF] Autostart enabled");
        } else if (!settings.autoStart && enabled) {
          await disable();
          console.log("[SNIFFF] Autostart disabled");
        }
      } catch (e) {
        console.error("[SNIFFF] Autostart sync failed:", e);
      }
    };
    syncAutostart();
  }, [settings.autoStart]);

  // ─── Resizable panel ───
  const [panelWidth, setPanelWidth] = useState(settings.sidePanelWidth);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (moveE: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - moveE.clientX;
      const clamped = Math.max(300, Math.min(700, newWidth));
      setPanelWidth(clamped);
    };

    const handleUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      // Persist
      setPanelWidth((w) => {
        updateSettings({ sidePanelWidth: w });
        return w;
      });
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [updateSettings]);

  // Check permissions on mount
  useEffect(() => {
    invoke<boolean>("check_permissions").then(setHasPermission).catch(() => setHasPermission(false));
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    try {
      const result = await invoke<boolean>("request_permissions");
      setHasPermission(result);
    } catch (e) {
      console.error("Permission request failed:", e);
    }
  }, []);

  // Start/stop sniffing
  const toggleSniffing = useCallback(async () => {
    try {
      if (isRunning) {
        await invoke("stop_sniffing");
        setIsRunning(false);
      } else {
        const iface = settings.defaultInterface || undefined;
        await invoke("start_sniffing", { interface: iface });
        setIsRunning(true);
      }
    } catch (e) {
      console.error("Toggle sniffing failed:", e);
    }
  }, [isRunning, settings.defaultInterface]);

  // Poll for updated data
  const refreshData = useCallback(async () => {
    try {
      const [conns, cStats, appStats] = await Promise.all([
        invoke<IpConnection[]>("get_connections", { limit: settings.maxConnections }),
        invoke<CountryStats[]>("get_country_stats"),
        invoke<AppStats>("get_stats"),
      ]);
      setConnections(conns);
      setCountryStats(cStats);
      setStats(appStats);
      setIsRunning(appStats.is_running);
    } catch (e) {
      console.error("Data refresh failed:", e);
    }
  }, [settings.maxConnections]);

  // Set up polling with configurable interval
  useEffect(() => {
    refreshData();
    pollRef.current = setInterval(refreshData, settings.refreshInterval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshData, settings.refreshInterval]);

  // Listen for real-time new IP events + notifications
  useEffect(() => {
    const unlisten = listen<NewIpEvent>("new-ip", async (event) => {
      const { ip, country_code, country, as_name } = event.payload;
      setNewIps((prev) => new Set(prev).add(ip));
      setTimeout(() => {
        setNewIps((prev) => {
          const next = new Set(prev);
          next.delete(ip);
          return next;
        });
      }, 1500);
      refreshData();

      // Notify on new country
      if (settings.notifyNewCountry && country_code && country) {
        if (!seenCountriesRef.current.has(country_code)) {
          seenCountriesRef.current.add(country_code);
          try {
            let permitted = await isPermissionGranted();
            if (!permitted) {
              const perm = await requestPermission();
              permitted = perm === "granted";
            }
            if (permitted) {
              sendNotification({
                title: `SNIFFF — New Country Detected`,
                body: `${country} (${country_code}) via ${as_name || ip}`,
              });
            }
          } catch (e) {
            console.error("[SNIFFF] Notification error:", e);
          }
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refreshData, settings.notifyNewCountry]);

  // ─── Apply Filters ───
  const filteredConnections = useMemo(() => {
    let result = connections;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.ip.toLowerCase().includes(q) ||
          (c.as_name && c.as_name.toLowerCase().includes(q)) ||
          (c.asn && c.asn.toLowerCase().includes(q)) ||
          (c.country && c.country.toLowerCase().includes(q)) ||
          (c.country_code && c.country_code.toLowerCase().includes(q))
      );
    }

    if (selectedAsn) {
      result = result.filter(
        (c) => c.as_name === selectedAsn || c.asn === selectedAsn
      );
    }

    if (selectedCountry) {
      result = result.filter((c) => c.country_code === selectedCountry);
    }

    if (timeRange) {
      const startTime = timeRange.start ? new Date(timeRange.start).getTime() : 0;
      const endTime = timeRange.end ? new Date(timeRange.end).getTime() : Infinity;
      result = result.filter((c) => {
        const lastSeen = new Date(c.last_seen).getTime();
        const firstSeen = new Date(c.first_seen).getTime();
        return (
          (lastSeen >= startTime || firstSeen >= startTime) &&
          firstSeen <= endTime
        );
      });
    }

    return result;
  }, [connections, searchQuery, selectedAsn, selectedCountry, timeRange]);

  const filteredCountryStats = useMemo(() => {
    const hasFilters = searchQuery || selectedAsn || selectedCountry || timeRange;
    if (!hasFilters) return countryStats;

    const statsMap = new Map<string, CountryStats>();
    filteredConnections.forEach((c) => {
      if (c.country_code && c.country) {
        const existing = statsMap.get(c.country_code);
        if (existing) {
          existing.hit_count += c.hit_count;
          existing.unique_ips += 1;
        } else {
          statsMap.set(c.country_code, {
            country_code: c.country_code,
            country: c.country,
            hit_count: c.hit_count,
            unique_ips: 1,
          });
        }
      }
    });
    return Array.from(statsMap.values()).sort((a, b) => b.hit_count - a.hit_count);
  }, [filteredConnections, countryStats, searchQuery, selectedAsn, selectedCountry, timeRange]);

  const handleCountryClick = useCallback(
    (countryCode: string) => {
      setSelectedCountry((prev) => (prev === countryCode ? null : countryCode));
    },
    []
  );

  // Permission screen
  if (hasPermission === false) {
    return (
      <div className="app-container">
        <div className="permission-screen">
          <div className="permission-icon">🔒</div>
          <div className="permission-title">AUTHORIZATION REQUIRED</div>
          <div className="permission-desc">
            SNIFFF requires access to network interfaces for packet capture.
            A one-time administrator authorization is needed to configure
            Berkeley Packet Filter (BPF) device permissions.
          </div>
          <button className="btn-tactical" onClick={requestPermissions}>
            GRANT ACCESS
          </button>
          <div className="permission-desc" style={{ fontSize: '10px', opacity: 0.4 }}>
            This installs a persistent LaunchDaemon — you will not be asked again.
            <br />Touch ID works if enabled in System Settings → Touch ID & Password.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header
        isRunning={isRunning}
        onToggle={toggleSniffing}
        stats={stats}
        onSettingsClick={() => setShowSettings(true)}
      />
      <div className="main-content" ref={containerRef}>
        <div className="map-panel">
          <div className="map-corner tl" />
          <div className="map-corner tr" />
          <div className="map-corner bl" />
          <div className="map-corner br" />
          <span className="map-label">
            GLOBAL NETWORK ACTIVITY
            {selectedCountry && (
              <span className="map-label-filter"> — FILTERED: {selectedCountry}</span>
            )}
          </span>
          <div className="map-container">
            <WorldMapComponent
              countryStats={filteredCountryStats}
              selectedCountry={selectedCountry}
              onCountryClick={handleCountryClick}
              themeColors={settings.theme}
            />
          </div>
        </div>

        {/* Resizable divider */}
        <div className="panel-divider" onMouseDown={handleDividerMouseDown}>
          <div className="divider-grip" />
        </div>

        <div className="side-panel" style={{ width: panelWidth, minWidth: 300 }}>
          <StatsPanel
            stats={stats}
            countryStats={filteredCountryStats}
            connections={filteredConnections}
          />
          <FilterBar
            connections={connections}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedAsn={selectedAsn}
            onAsnChange={setSelectedAsn}
            selectedCountry={selectedCountry}
            onCountryChange={setSelectedCountry}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
          <ConnectionTable connections={filteredConnections} newIps={newIps} />
        </div>
      </div>
      <div className="footer">
        <div className="footer-section">
          <span>SNIFFF v0.1.0</span>
          <span>·</span>
          <span>PCAP ENGINE</span>
        </div>
        <div className="footer-section">
          {filteredConnections.length !== connections.length && (
            <span className="footer-filter-info">
              SHOWING {filteredConnections.length}/{connections.length}
            </span>
          )}
          <span>DB: ~/Library/Application Support/com.snifff.app/snifff.db</span>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          settings={settings}
          onUpdate={updateSettings}
          onApplyPreset={applyPreset}
          onReset={resetSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
