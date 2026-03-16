import { type MapConfig, type ShapeType } from "~/lib/mapgen";
import { SliderField } from "~/components/SliderField";

const SHAPES: { value: ShapeType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "square", label: "Square (Chebyshev)" },
  { value: "squareBump", label: "Square Bump" },
  { value: "distSquared", label: "Distance²" },
  { value: "hyperboloid", label: "Hyperboloid" },
  { value: "trigProduct", label: "Trig Product" },
  { value: "squircle", label: "Squircle" },
];

const randomSeed = () => Math.random().toString(36).slice(2, 8);
const pct = (v: number) => `${Math.round(v * 100)}%`;

export const MapControls = ({
  config,
  onChange,
}: {
  config: MapConfig;
  onChange: <K extends keyof MapConfig>(key: K, value: MapConfig[K]) => void;
}) => (
  <div className="sticky top-4 z-10 flex flex-wrap gap-4 items-end bg-black/80 backdrop-blur px-4 py-3 rounded-lg shadow-sm border border-gray-700">
    <label className="flex flex-col gap-1 text-sm">
      Seed
      <div className="flex gap-1">
        <input
          className="border px-2 py-1 rounded font-mono"
          value={config.seed}
          onChange={(e) => onChange("seed", e.target.value)}
        />
        <button
          className="border px-2 py-1 rounded"
          onClick={() => onChange("seed", randomSeed())}
        >
          New
        </button>
      </div>
    </label>

    <label className="flex flex-col gap-1 text-sm">
      Shape
      <select
        className="border px-2 py-1 rounded"
        value={config.shape}
        onChange={(e) => onChange("shape", e.target.value as ShapeType)}
      >
        {SHAPES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>

    <label className="flex flex-col gap-1 text-sm">
      Size
      <select
        className="border px-2 py-1 rounded"
        value={config.size}
        onChange={(e) =>
          onChange("size", Number(e.target.value) as MapConfig["size"])
        }
      >
        <option value={64}>64 x 64</option>
        <option value={128}>128 x 128</option>
        <option value={256}>256 x 256</option>
        <option value={512}>512 x 512</option>
      </select>
    </label>

    <SliderField
      label="Mountains"
      value={config.mountainCoverage}
      min={0}
      max={0.25}
      step={0.01}
      format={pct}
      onChange={(v) => onChange("mountainCoverage", v)}
    />
    <SliderField
      label="Hills"
      value={config.hillsCoverage}
      min={0}
      max={0.25}
      step={0.01}
      format={pct}
      onChange={(v) => onChange("hillsCoverage", v)}
    />
    <SliderField
      label="Forest"
      value={config.forestCoverage}
      min={0}
      max={0.6}
      step={0.01}
      format={pct}
      onChange={(v) => onChange("forestCoverage", v)}
    />
    <SliderField
      label="Rivers"
      value={config.riverCount}
      min={0}
      max={10}
      step={1}
      onChange={(v) => onChange("riverCount", v)}
    />
    <SliderField
      label="Cities"
      value={config.cityCount}
      min={0}
      max={80}
      step={1}
      onChange={(v) => onChange("cityCount", v)}
    />
    <SliderField
      label="Road network"
      value={config.roadDensity}
      min={0}
      max={1}
      step={0.05}
      format={pct}
      onChange={(v) => onChange("roadDensity", v)}
    />
    <SliderField
      label="Ruins"
      value={config.ruinsCount}
      min={0}
      max={40}
      step={1}
      onChange={(v) => onChange("ruinsCount", v)}
    />
    <SliderField
      label="Shrines"
      value={config.shrineCount}
      min={0}
      max={40}
      step={1}
      onChange={(v) => onChange("shrineCount", v)}
    />
  </div>
);
