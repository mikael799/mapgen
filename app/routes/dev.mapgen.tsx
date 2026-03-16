import { useState } from "react";
import { type MapConfig } from "../lib/mapgen";
import {
  drawHeightmap,
  drawLandWater,
  drawMoisture,
  drawShapeGradient,
  drawShaped,
  drawWorld,
} from "../lib/mapgen-draw";
import { useMapData } from "~/hooks/useMapData";
import { GrayscaleLegend } from "~/components/GrayscaleLegend";
import { WorldLegend } from "~/components/WorldLegend";
import { CanvasBox } from "~/components/CanvasBox";
import { MapControls } from "~/components/MapControls";

export const meta = () => [{ title: "Mapgen Dev" }];

const randomSeed = () => Math.random().toString(36).slice(2, 8);

export default function DevMapgen() {
  const [config, setConfig] = useState<MapConfig>({
    seed: randomSeed(),
    shape: "squareBump",
    size: 128,
    mountainCoverage: 0.08,
    hillsCoverage: 0.1,
    forestCoverage: 0.3,
    riverCount: 3,
    cityCount: 6,
    roadDensity: 0.3,
    ruinsCount: 8,
    shrineCount: 5,
  });

  const mapData = useMapData(config);

  const set = <K extends keyof MapConfig>(key: K, value: MapConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const steps = [
    {
      title: "1. Heightmap",
      canvases: [
        {
          label: "Noise",
          draw: drawHeightmap,
          legend: <GrayscaleLegend left="low (0)" right="high (1)" />,
        },
        {
          label: "Shape Gradient",
          draw: drawShapeGradient,
          legend: <GrayscaleLegend left="edge (0)" right="center (1)" />,
        },
        {
          label: "Combined",
          draw: drawShaped,
          legend: <GrayscaleLegend left="water" right="land" />,
        },
        {
          label: "Land / Water",
          draw: drawLandWater,
          legend: (
            <div className="flex items-center gap-2 w-full text-xs text-gray-500">
              <span>Water</span>
              <div
                className="flex-1 h-2 rounded"
                style={{
                  background: "linear-gradient(to right, #282828, #c8c8c8)",
                }}
              />
              <span>Land</span>
            </div>
          ),
        },
      ],
    },
    {
      title: "2. Moisture & Ridge",
      canvases: [
        {
          label: "Moisture",
          draw: drawMoisture,
          legend: <GrayscaleLegend left="dry (grass)" right="wet (forest)" />,
        },
      ],
    },
    {
      title: "3. World",
      canvases: [{ label: "World", draw: drawWorld, legend: <WorldLegend /> }],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center p-6 gap-6">
      <h1 className="text-xl font-bold">Map Generator — Dev Pipeline</h1>

      <MapControls config={config} onChange={set} />

      <div className="flex flex-col gap-12 w-full items-center">
        {steps.map((step) => (
          <div
            key={step.title}
            className="flex flex-col gap-4 w-full items-center"
          >
            <h2 className="text-base font-semibold">{step.title}</h2>
            <div className="flex flex-wrap gap-6 justify-center">
              {step.canvases.map((c) => (
                <CanvasBox
                  key={c.label}
                  label={c.label}
                  draw={c.draw}
                  data={mapData}
                  legend={"legend" in c ? c.legend : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
