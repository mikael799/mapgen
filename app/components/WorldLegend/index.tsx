import {
  BIOME_COLORS,
  BRIDGE_COLOR,
  CITY_COLOR,
  DOCK_COLOR,
  ROAD_COLOR,
  RUIN_COLOR,
  SHRINE_COLOR,
} from "~/lib/mapgen-draw";

const toHex = ([r, g, b]: [number, number, number]) => `rgb(${r},${g},${b})`;

const ENTRIES: { label: string; color: [number, number, number] }[] = [
  { label: "Ocean", color: BIOME_COLORS.ocean },
  { label: "River", color: BIOME_COLORS.river },
  { label: "Grass", color: BIOME_COLORS.grass },
  { label: "Forest", color: BIOME_COLORS.forest },
  { label: "Hills", color: BIOME_COLORS.hills },
  { label: "Mountains", color: BIOME_COLORS.mountains },
  { label: "Road", color: ROAD_COLOR },
  { label: "Bridge", color: BRIDGE_COLOR },
  { label: "Dock", color: DOCK_COLOR },
  { label: "City", color: CITY_COLOR },
  { label: "Ruin", color: RUIN_COLOR },
  { label: "Shrine", color: SHRINE_COLOR },
];

export const WorldLegend = () => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 w-full text-xs text-gray-500">
    {ENTRIES.map(({ label, color }) => (
      <div key={label} className="flex items-center gap-1">
        <div
          className="w-3 h-3 rounded-sm flex-shrink-0"
          style={{ background: toHex(color) }}
        />
        <span>{label}</span>
      </div>
    ))}
  </div>
);
