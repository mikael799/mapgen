import type { BiomeType, MapData } from "./mapgen";

export type DrawFn = (ctx: CanvasRenderingContext2D, data: MapData) => void;

const fromHex = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export const BIOME_COLORS: Record<BiomeType, [number, number, number]> = {
  ocean: fromHex("#376eb4"),
  river: fromHex("#5aa5d7"),
  grass: fromHex("#69a23e"),
  forest: fromHex("#3a702a"),
  hills: fromHex("#9b8058"),
  mountains: fromHex("#98948e"),
};

export const ROAD_COLOR = fromHex("#b69b66");
export const BRIDGE_COLOR = fromHex("#84663e");
export const DOCK_COLOR = fromHex("#bc7030");
export const CITY_COLOR = fromHex("#d7b62a");
export const RUIN_COLOR = fromHex("#9e8062");
export const SHRINE_COLOR = fromHex("#bc9ed7");

const drawNormalized = (
  ctx: CanvasRenderingContext2D,
  size: number,
  values: Float32Array,
) => {
  const img = ctx.createImageData(size, size);

  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < size * size; i++) {
    min = Math.min(min, values[i]);
    max = Math.max(max, values[i]);
  }

  const range = max - min || 1;
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(((values[i] - min) / range) * 255);
    const px = i * 4;
    img.data[px] = v;
    img.data[px + 1] = v;
    img.data[px + 2] = v;
    img.data[px + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
};

export const drawHeightmap: DrawFn = (
  ctx,
  { rawElevations, config: { size } },
) => {
  drawNormalized(ctx, size, rawElevations);
};

export const drawShapeGradient: DrawFn = (
  ctx,
  { shapeGradient, config: { size } },
) => {
  const img = ctx.createImageData(size, size);

  for (let i = 0; i < size * size; i++) {
    const v = Math.round(shapeGradient[i] * 255);

    const px = i * 4;
    img.data[px] = v;
    img.data[px + 1] = v;
    img.data[px + 2] = v;
    img.data[px + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
};

export const drawShaped: DrawFn = (ctx, { elevations, config: { size } }) => {
  drawNormalized(ctx, size, elevations);
};

export const drawLandWater: DrawFn = (
  ctx,
  { elevations, config: { size } },
) => {
  const img = ctx.createImageData(size, size);

  for (let i = 0; i < size * size; i++) {
    const c = elevations[i] > 0 ? 200 : 40;
    const px = i * 4;
    img.data[px] = c;
    img.data[px + 1] = c;
    img.data[px + 2] = c;
    img.data[px + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
};

export const drawMoisture: DrawFn = (ctx, { moisture, config: { size } }) => {
  drawNormalized(ctx, size, moisture);
};

export const drawWorld: DrawFn = (
  ctx,
  {
    biomes,
    cities,
    ruins,
    shrines,
    roadTiles,
    bridgeTiles,
    dockTiles,
    config: { size },
  },
) => {
  const img = ctx.createImageData(size, size);

  for (let i = 0; i < size * size; i++) {
    let color: [number, number, number];
    if (bridgeTiles.has(i)) color = BRIDGE_COLOR;
    else if (dockTiles.has(i)) color = DOCK_COLOR;
    else if (roadTiles.has(i)) color = ROAD_COLOR;
    else color = BIOME_COLORS[biomes[i]];

    const px = i * 4;
    img.data[px] = color[0];
    img.data[px + 1] = color[1];
    img.data[px + 2] = color[2];
    img.data[px + 3] = 255;
  }

  for (const city of cities) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const px = ((city.y + dy) * size + (city.x + dx)) * 4;
        img.data[px] = CITY_COLOR[0];
        img.data[px + 1] = CITY_COLOR[1];
        img.data[px + 2] = CITY_COLOR[2];
        img.data[px + 3] = 255;
      }
    }
  }

  for (const ruin of ruins) {
    const px = (ruin.y * size + ruin.x) * 4;
    img.data[px] = RUIN_COLOR[0];
    img.data[px + 1] = RUIN_COLOR[1];
    img.data[px + 2] = RUIN_COLOR[2];
    img.data[px + 3] = 255;
  }

  for (const shrine of shrines) {
    const px = (shrine.y * size + shrine.x) * 4;
    img.data[px] = SHRINE_COLOR[0];
    img.data[px + 1] = SHRINE_COLOR[1];
    img.data[px + 2] = SHRINE_COLOR[2];
    img.data[px + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
};
