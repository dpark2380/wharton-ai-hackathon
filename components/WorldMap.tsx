"use client";

import { useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const GEO_URL = "/countries-110m.json";

interface CityPin {
  city: string;
  country: string;
  flag: string;
}

interface WorldMapProps {
  pins: CityPin[];
  cityCoords: Record<string, [number, number]>;
}

// Dot colors cycling through a palette for variety
const PIN_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

export default function WorldMap({ pins, cityCoords }: WorldMapProps) {
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-[#93c5fd]"
      style={{ background: "#d4e9f7" }}
    >
      <ComposableMap
        projection="geoEquirectangular"
        projectionConfig={{ scale: 147, center: [10, 10] }}
        width={800}
        height={380}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#e8d8b4"
                stroke="#c4a97d"
                strokeWidth={0.4}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: "#e8d8b4" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {pins.map((pin, i) => {
          const coords = cityCoords[pin.city];
          if (!coords) return null;
          const isHovered = hoveredCity === pin.city;
          const color = PIN_COLORS[i % PIN_COLORS.length];

          return (
            <Marker
              key={pin.city}
              coordinates={coords}
              onMouseEnter={() => setHoveredCity(pin.city)}
              onMouseLeave={() => setHoveredCity(null)}
            >
              {/* Pulse ring */}
              <circle
                r={isHovered ? 9 : 6}
                fill={color}
                opacity={0.2}
                style={{ transition: "r 0.15s" }}
              />
              {/* Dot */}
              <circle
                r={isHovered ? 5 : 3.5}
                fill={color}
                stroke="white"
                strokeWidth={1.5}
                style={{ cursor: "pointer", transition: "r 0.15s" }}
              />
              {/* Tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={6}
                    y={-14}
                    width={pin.city.length * 6.2 + 20}
                    height={20}
                    rx={4}
                    fill="#1e293b"
                    opacity={0.9}
                  />
                  <text
                    x={16}
                    y={-1}
                    fill="white"
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="system-ui, sans-serif"
                  >
                    {pin.flag} {pin.city}
                  </text>
                </g>
              )}
            </Marker>
          );
        })}
      </ComposableMap>

      {/* Legend */}
      {pins.length > 0 && (
        <div className="absolute bottom-2 right-3 flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
          <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
          <span className="text-[10px] font-medium text-gray-600">
            {pins.length} {pins.length === 1 ? "destination" : "destinations"} visited
          </span>
        </div>
      )}
    </div>
  );
}
