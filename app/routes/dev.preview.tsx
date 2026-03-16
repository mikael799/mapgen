import { useEffect, useRef, useState } from "react";
import type { Engine } from "excalibur";
import { type MapConfig } from "~/lib/mapgen";
import { useMapData } from "~/hooks/useMapData";
import { MapControls } from "~/components/MapControls";

export const meta = () => [{ title: "Mapgen Preview" }];

const randomSeed = () => Math.random().toString(36).slice(2, 8);

export default function DevPreview() {
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

  const set = <K extends keyof MapConfig>(key: K, value: MapConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const mapData = useMapData(config);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    import("~/lib/map").then(({ buildMap }) => {
      if (cancelled) return;
      engineRef.current = buildMap(canvas, mapData);
    });

    return () => {
      cancelled = true;
      engineRef.current?.stop();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [mapData]);

  return (
    <div className="relative w-screen h-screen">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 right-4">
        <MapControls config={config} onChange={set} />
      </div>
    </div>
  );
}
