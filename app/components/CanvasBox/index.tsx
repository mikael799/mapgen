import { useRef, useEffect } from "react";
import type { MapData } from "~/lib/mapgen";
import type { DrawFn } from "~/lib/mapgen-draw";

export const CanvasBox = ({
  label,
  draw,
  data,
  legend,
}: {
  label: string;
  draw: DrawFn;
  data: MapData;
  legend?: React.ReactNode;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const { size } = data.config;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d")!;
    draw(ctx, data);
  }, [draw, data, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </h3>
      <canvas
        ref={ref}
        className="border border-gray-800 rounded"
        style={{ imageRendering: "pixelated", width: 512, height: 512 }}
      />
      <div className="h-6 flex items-center w-full">{legend}</div>
    </div>
  );
};
