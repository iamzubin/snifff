import { useState, useCallback, useRef, useEffect } from "react";
import WorldMap from "react-svg-worldmap";
import type { CountryContext } from "react-svg-worldmap";
import type { CountryStats } from "../lib/types";
import type { ThemeColors } from "../hooks/useSettings";

interface WorldMapComponentProps {
    countryStats: CountryStats[];
    selectedCountry?: string | null;
    onCountryClick?: (countryCode: string) => void;
    themeColors?: ThemeColors;
}

export const WorldMapComponent = ({
    countryStats,
    selectedCountry,
    onCountryClick,
    themeColors,
}: WorldMapComponentProps) => {
    const data = countryStats.map((cs) => ({
        country: cs.country_code.toLowerCase() as string,
        value: cs.hit_count as number,
    }));

    // ─── Zoom & Pan ───
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isPanning = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const accent = themeColors?.accentPrimary || "#C67237";
    const accentSecondary = themeColors?.accentSecondary || "#D0A347";
    const bgTertiary = themeColors?.bgTertiary || "#1F1413";

    // Parse hex to rgba
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const styleFunction = useCallback((context: CountryContext<number>) => {
        const val = typeof context.countryValue === 'number' ? context.countryValue : 0;
        const countryCode = context.countryCode?.toUpperCase();
        const isSelected = selectedCountry && countryCode === selectedCountry;

        if (!val) {
            return {
                fill: isSelected ? hexToRgba(accent, 0.15) : bgTertiary,
                stroke: isSelected ? accentSecondary : hexToRgba(accent, 0.3),
                strokeWidth: isSelected ? 1.5 : 0.5,
                strokeOpacity: isSelected ? 0.8 : 0.3,
                cursor: "pointer",
            };
        }

        const range = (context.maxValue || 1) - (context.minValue || 0);
        const normalized = range > 0
            ? (val - (context.minValue || 0)) / range
            : 0.5;

        const intensity = 0.3 + normalized * 0.7;

        return {
            fill: isSelected
                ? hexToRgba(accentSecondary, intensity)
                : hexToRgba(accent, intensity),
            stroke: accentSecondary,
            strokeWidth: isSelected ? 2 : normalized > 0.5 ? 1 : 0.5,
            strokeOpacity: isSelected ? 1 : 0.4 + normalized * 0.4,
            cursor: "pointer",
            transition: "fill 0.3s ease",
        };
    }, [accent, accentSecondary, bgTertiary, selectedCountry]);

    // ─── Resize Handling for Auto-Fit ───
    const [mapSize, setMapSize] = useState(600);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                const height = entry.contentRect.height;
                // World map is roughly 2:1 ratio. 
                // We want to fit it such that it doesn't overflow either dimension.
                const optimalWidth = Math.min(width, height * 2);
                setMapSize(optimalWidth);
            }
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // ─── Native DOM Events for Zoom/Pan ───
    const [isPanningState, setIsPanningState] = useState(false);
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const dragStartPos = useRef({ x: 0, y: 0 });
    const didDrag = useRef(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setZoom((prev) => {
                const delta = e.deltaY > 0 ? -0.2 : 0.2;
                const next = Math.max(1, Math.min(5, prev + delta));
                if (next <= 1) setPan({ x: 0, y: 0 });
                return next;
            });
        };

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0 || zoomRef.current <= 1) return;
            isPanning.current = true;
            setIsPanningState(true);
            didDrag.current = false;
            lastMouse.current = { x: e.clientX, y: e.clientY };
            dragStartPos.current = { x: e.clientX, y: e.clientY };
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isPanning.current) return;
            const dx = e.clientX - lastMouse.current.x;
            const dy = e.clientY - lastMouse.current.y;
            lastMouse.current = { x: e.clientX, y: e.clientY };

            const totalDx = Math.abs(e.clientX - dragStartPos.current.x);
            const totalDy = Math.abs(e.clientY - dragStartPos.current.y);
            if (totalDx > 5 || totalDy > 5) {
                didDrag.current = true;
            }

            setPan((prev) => ({
                x: prev.x + dx,
                y: prev.y + dy,
            }));
        };

        const onMouseUp = () => {
            if (isPanning.current) {
                isPanning.current = false;
                setIsPanningState(false);
            }
        };

        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("mousedown", onMouseDown, true);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("mousedown", onMouseDown, true);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, []);

    // Reset zoom and pan
    const resetZoom = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    return (
        <div
            ref={containerRef}
            className="map-zoom-container"
            style={{ cursor: zoom > 1 ? (isPanningState ? "grabbing" : "grab") : "default" }}
        >
            <div
                className="map-zoom-inner"
                style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: "center center",
                    pointerEvents: "auto",
                }}
            >
                <WorldMap
                    color={accent}
                    valueSuffix="hits"
                    size={mapSize}
                    data={data}
                    backgroundColor="transparent"
                    borderColor={bgTertiary}
                    strokeOpacity={0.3}
                    frame={false}
                    tooltipBgColor={themeColors?.bgSecondary || "#0D1117"}
                    tooltipTextColor={accentSecondary}
                    richInteraction
                    styleFunction={styleFunction}
                    onClickFunction={(context) => {
                        // Crucial: Only ignore if we actually moved significantly
                        if (didDrag.current) {
                            didDrag.current = false;
                            return;
                        }
                        if (onCountryClick && context.countryCode) {
                            onCountryClick(context.countryCode.toUpperCase());
                        }
                    }}
                />
            </div>

            {/* Zoom controls */}
            <div className="map-zoom-controls">
                <button
                    className="map-zoom-btn"
                    onClick={() => setZoom((z) => Math.min(5, z + 0.3))}
                    title="Zoom in"
                >+</button>
                <div className="map-zoom-level">{Math.round(zoom * 100)}%</div>
                <button
                    className="map-zoom-btn"
                    onClick={() => { setZoom((z) => Math.max(1, z - 0.3)); if (zoom <= 1.3) setPan({ x: 0, y: 0 }); }}
                    title="Zoom out"
                >−</button>
                {zoom > 1 && (
                    <button
                        className="map-zoom-btn reset"
                        onClick={resetZoom}
                        title="Reset zoom"
                    >⟲</button>
                )}
            </div>
        </div>
    );
};
