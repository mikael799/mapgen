import alea from "alea";
import Heap from "heap-js";
import PoissonDiskSampling from "poisson-disk-sampling";
import { createNoise2D } from "simplex-noise";

export type ShapeType =
  | "none"
  | "square"
  | "squareBump"
  | "distSquared"
  | "hyperboloid"
  | "trigProduct"
  | "squircle";

export type BiomeType =
  | "ocean"
  | "grass"
  | "forest"
  | "hills"
  | "mountains"
  | "river";

export type City = {
  id: number;
  /** Top-left x of the 2×2 tile footprint */
  x: number;
  /** Top-left y of the 2×2 tile footprint */
  y: number;
};

export type Ruin = { id: number; x: number; y: number };
export type Shrine = { id: number; x: number; y: number };

export type Road = {
  from: number;
  to: number;
  /** Tile indices along the path */
  path: number[];
};

export type MapConfig = {
  seed: string;
  size: 64 | 128 | 256 | 512;
  shape: ShapeType;
  /** Fraction of land tiles that are mountains (0–1) */
  mountainCoverage: number;
  /** Fraction of land tiles that are hills (0–1) */
  hillsCoverage: number;
  /** Fraction of non-mountain/hills land tiles that are forest (0–1) */
  forestCoverage: number;
  riverCount: number;
  cityCount: number;
  /** Road connectivity: 0 = MST only, 1 = many extra roads (0–1) */
  roadDensity: number;
  ruinsCount: number;
  shrineCount: number;
};

export type NoiseData = {
  size: MapConfig["size"];
  /** Raw fBm noise output (domain-warped), values in [0, 1] */
  rawElevations: Float32Array;
  /** Shape gradient mask, values in [0, 1] where 1 = center, 0 = edge */
  shapeGradient: Float32Array;
  /** rawElevations adjusted by shape mask; values above 0 are land */
  elevations: Float32Array;
  /** Moisture noise, values in [0, 1]; high = wet (forest), low = dry (grass) */
  moisture: Float32Array;
};

export type MapData = {
  config: MapConfig;
  rawElevations: Float32Array;
  shapeGradient: Float32Array;
  elevations: Float32Array;
  moisture: Float32Array;
  biomes: BiomeType[];
  cities: City[];
  ruins: Ruin[];
  shrines: Shrine[];
  roads: Road[];
  roadTiles: Set<number>;
  bridgeTiles: Set<number>;
  dockTiles: Set<number>;
};

type Noise2D = (x: number, y: number) => number;

const toSigned = (value: number) => value * 2 - 1;

export const fbm2D = (
  noise: Noise2D,
  x: number,
  y: number,
  octaves: number,
  scale = 1,
  persistence = 0.5,
  lacunarity = 2,
): number => {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return (value / maxValue + 1) / 2;
};

const shapeFunctions: Record<
  Exclude<ShapeType, "none">,
  (seed: string) => (x: number, y: number) => number
> = {
  square: () => (x, y) => 1 - Math.max(Math.abs(x), Math.abs(y)),

  squareBump: () => (x, y) => (1 - x * x) * (1 - y * y),

  distSquared: () => (x, y) => Math.max(0, 1 - (x * x + y * y)),

  hyperboloid: () => (x, y) => {
    const rounding = 0.2;
    const denominator = Math.sqrt(1 + rounding * rounding) - rounding;
    return Math.max(
      0,
      1 -
        (Math.sqrt(x * x + y * y + rounding * rounding) - rounding) /
          denominator,
    );
  },

  trigProduct: () => (x, y) =>
    Math.cos((x * Math.PI) / 2) * Math.cos((y * Math.PI) / 2),

  squircle: () => (x, y) =>
    Math.max(0, 1 - Math.sqrt(x * x * x * x + y * y * y * y)),
};

export const generateNoiseData = (
  config: Pick<MapConfig, "seed" | "size" | "shape">,
): NoiseData => {
  const { size, seed, shape } = config;

  const elevationNoise = createNoise2D(alea(seed + ":elevation"));
  const warpNoiseX = createNoise2D(alea(seed + ":warpX"));
  const warpNoiseY = createNoise2D(alea(seed + ":warpY"));
  const moistureNoise = createNoise2D(alea(seed + ":moisture"));

  const rawElevations = new Float32Array(size * size);
  const shapeGradient = new Float32Array(size * size);
  const elevations = new Float32Array(size * size);
  const moisture = new Float32Array(size * size);

  const shapeFn =
    shape !== "none" ? shapeFunctions[shape](seed + ":shape") : null;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const index = row * size + col;
      const normalizedX = (col + 0.5) / size;
      const normalizedY = (row + 0.5) / size;

      const warpX = fbm2D(warpNoiseX, normalizedX, normalizedY, 4, 1.5) - 0.5;
      const warpY = fbm2D(warpNoiseY, normalizedX, normalizedY, 4, 1.5) - 0.5;
      rawElevations[index] = fbm2D(
        elevationNoise,
        normalizedX + 0.4 * warpX,
        normalizedY + 0.4 * warpY,
        8,
        2.5,
      );

      shapeGradient[index] = shapeFn
        ? shapeFn(toSigned(normalizedX), toSigned(normalizedY))
        : 1;

      // At center (gradient=1) elevation is unchanged; at edge (gradient=0)
      // elevation is pushed below zero, creating ocean borders.
      elevations[index] = rawElevations[index] - (1 - shapeGradient[index]);

      moisture[index] = fbm2D(moistureNoise, normalizedX, normalizedY, 6, 1.5);
    }
  }

  return { size, rawElevations, shapeGradient, elevations, moisture };
};

const percentileThreshold = (
  values: Float32Array,
  indices: number[],
  percentile: number,
): number => {
  if (percentile >= 1) return Infinity;
  const sorted = indices.map((index) => values[index]).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * percentile)] ?? 0;
};

const CARDINAL_DIRS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

const nearestOcean = (
  oceanTiles: number[],
  originX: number,
  originY: number,
  size: number,
): number => {
  let nearestIndex = oceanTiles[0];
  let nearestDistSq = Infinity;
  for (const index of oceanTiles) {
    const distSq =
      ((index % size) - originX) ** 2 +
      (Math.floor(index / size) - originY) ** 2;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestIndex = index;
    }
  }
  return nearestIndex;
};

const traceRiver = (
  start: number,
  target: number,
  biomes: BiomeType[],
  elevations: Float32Array,
  tileNoise: Float32Array,
  size: number,
): number[] => {
  const targetX = target % size;
  const targetY = Math.floor(target / size);

  const costToReach = new Map<number, number>([[start, 0]]);
  const cameFrom = new Map<number, number>();
  const open = new Map<number, number>([[start, 0]]);

  while (open.size > 0) {
    let current = -1;
    let lowestFScore = Infinity;
    for (const [index, fScore] of open) {
      if (fScore < lowestFScore) {
        lowestFScore = fScore;
        current = index;
      }
    }
    open.delete(current);

    if (biomes[current] === "ocean") {
      const path: number[] = [];
      for (let tile = current; tile !== -1; tile = cameFrom.get(tile) ?? -1) {
        path.unshift(tile);
      }
      return path;
    }

    const currentX = current % size;
    const currentY = Math.floor(current / size);
    const currentCost = costToReach.get(current)!;

    for (const { dx, dy } of CARDINAL_DIRS) {
      const neighborX = currentX + dx;
      const neighborY = currentY + dy;
      if (
        neighborX < 0 ||
        neighborX >= size ||
        neighborY < 0 ||
        neighborY >= size
      )
        continue;

      const neighborIndex = neighborY * size + neighborX;
      if (biomes[neighborIndex] === "mountains") continue;

      const uphillPenalty =
        Math.max(0, elevations[neighborIndex] - elevations[current]) * 3;
      const neighborCost =
        currentCost + 1 + uphillPenalty + tileNoise[neighborIndex];

      if (neighborCost >= (costToReach.get(neighborIndex) ?? Infinity))
        continue;

      costToReach.set(neighborIndex, neighborCost);
      cameFrom.set(neighborIndex, current);
      open.set(
        neighborIndex,
        neighborCost +
          Math.sqrt((neighborX - targetX) ** 2 + (neighborY - targetY) ** 2),
      );
    }
  }

  return [];
};

const generateRivers = (
  noise: NoiseData,
  biomes: BiomeType[],
  config: MapConfig,
): number[][] => {
  const { size, elevations } = noise;
  const { riverCount, seed } = config;
  if (riverCount === 0) return [];

  const rng = alea(seed + ":rivers");

  const tileNoise = new Float32Array(size * size);
  for (let i = 0; i < tileNoise.length; i++) tileNoise[i] = rng() * 0.8;

  const hillTiles: number[] = [];
  const oceanTiles: number[] = [];
  for (let i = 0; i < biomes.length; i++) {
    if (biomes[i] === "hills") hillTiles.push(i);
    else if (biomes[i] === "ocean") oceanTiles.push(i);
  }

  if (hillTiles.length === 0 || oceanTiles.length === 0) return [];

  const minSourceDistanceSq = (size / 8) ** 2;
  const chosenSources: number[] = [];
  const allPaths: number[][] = [];

  for (let river = 0; river < riverCount; river++) {
    const availableSources = hillTiles.filter((candidate) => {
      const candidateX = candidate % size;
      const candidateY = Math.floor(candidate / size);
      return chosenSources.every((chosen) => {
        const chosenX = chosen % size;
        const chosenY = Math.floor(chosen / size);
        return (
          (candidateX - chosenX) ** 2 + (candidateY - chosenY) ** 2 >=
          minSourceDistanceSq
        );
      });
    });
    if (availableSources.length === 0) break;

    const sourceIndex =
      availableSources[Math.floor(rng() * availableSources.length)];
    chosenSources.push(sourceIndex);

    const target = nearestOcean(
      oceanTiles,
      sourceIndex % size,
      Math.floor(sourceIndex / size),
      size,
    );
    const path = traceRiver(
      sourceIndex,
      target,
      biomes,
      elevations,
      tileNoise,
      size,
    );

    for (const tileIndex of path) {
      if (biomes[tileIndex] !== "ocean") biomes[tileIndex] = "river";
    }
    if (path.length > 0) allPaths.push(path);
  }

  return allPaths;
};

const generateDocks = (
  paths: number[][],
  biomes: BiomeType[],
  size: number,
  rng: () => number,
): Set<number> => {
  const dockTiles = new Set<number>();

  for (const path of paths) {
    const leftBank: number[] = [];
    const rightBank: number[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const currIndex = path[i];
      const currX = currIndex % size;
      const currY = Math.floor(currIndex / size);
      const nextX = path[i + 1] % size;
      const nextY = Math.floor(path[i + 1] / size);
      const dirX = nextX - currX;
      const dirY = nextY - currY;

      const leftX = currX - dirY,
        leftY = currY + dirX;
      if (leftX >= 0 && leftX < size && leftY >= 0 && leftY < size) {
        const leftIndex = leftY * size + leftX;
        if (biomes[leftIndex] !== "river" && biomes[leftIndex] !== "ocean")
          leftBank.push(leftIndex);
      }

      const rightX = currX + dirY,
        rightY = currY - dirX;
      if (rightX >= 0 && rightX < size && rightY >= 0 && rightY < size) {
        const rightIndex = rightY * size + rightX;
        if (biomes[rightIndex] !== "river" && biomes[rightIndex] !== "ocean")
          rightBank.push(rightIndex);
      }
    }

    if (leftBank.length > 0)
      dockTiles.add(leftBank[Math.floor(rng() * leftBank.length)]);
    if (rightBank.length > 0)
      dockTiles.add(rightBank[Math.floor(rng() * rightBank.length)]);
  }

  const coastalTiles = new Set<number>();
  for (let i = 0; i < biomes.length; i++) {
    if (biomes[i] === "ocean" || biomes[i] === "river") continue;
    const x = i % size;
    const y = Math.floor(i / size);
    for (const { dx, dy } of CARDINAL_DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      if (biomes[ny * size + nx] === "ocean") {
        coastalTiles.add(i);
        break;
      }
    }
  }

  const visited = new Set<number>();
  for (const start of coastalTiles) {
    if (visited.has(start)) continue;

    const regionCoastal: number[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (coastalTiles.has(current)) regionCoastal.push(current);
      const cx = current % size;
      const cy = Math.floor(current / size);
      for (const { dx, dy } of CARDINAL_DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const ni = ny * size + nx;
        if (visited.has(ni)) continue;
        if (biomes[ni] === "ocean" || biomes[ni] === "river") continue;
        visited.add(ni);
        queue.push(ni);
      }
    }

    if (regionCoastal.length === 0) continue;

    const dockCount = Math.max(1, Math.floor(regionCoastal.length / 20));
    const candidates = [...regionCoastal];
    for (let d = 0; d < dockCount && candidates.length > 0; d++) {
      const pick = Math.floor(rng() * candidates.length);
      const tile = candidates[pick];
      dockTiles.add(tile);
      const tx = tile % size;
      const ty = Math.floor(tile / size);
      for (let j = candidates.length - 1; j >= 0; j--) {
        const cx = candidates[j] % size;
        const cy = Math.floor(candidates[j] / size);
        if (Math.abs(cx - tx) + Math.abs(cy - ty) <= 4) candidates.splice(j, 1);
      }
    }
  }

  return dockTiles;
};

const generateCities = (
  biomes: BiomeType[],
  config: MapConfig,
  rng: () => number,
): City[] => {
  const { size, cityCount } = config;
  if (cityCount === 0) return [];

  const validFootprint = (x: number, y: number) => {
    if (x < 0 || x + 1 >= size || y < 0 || y + 1 >= size) return false;
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const b = biomes[(y + dy) * size + (x + dx)];
        if (b !== "grass" && b !== "forest") return false;
      }
    }
    return true;
  };

  const minDist = Math.max(3, (size / Math.sqrt(cityCount)) * 0.35);
  const pds = new PoissonDiskSampling(
    { shape: [size, size], minDistance: minDist },
    rng,
  );
  const samples = pds.fill();

  const valid: [number, number][] = [];
  for (const [fx, fy] of samples) {
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    if (validFootprint(x, y)) valid.push([x, y]);
  }

  for (let i = valid.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [valid[i], valid[j]] = [valid[j], valid[i]];
  }

  const cities: City[] = [];
  for (const [x, y] of valid) {
    if (cities.length >= cityCount) break;
    cities.push({ id: cities.length, x, y });
  }

  return cities;
};

const cityTiles = (cities: City[], size: number): Set<number> => {
  const occupied = new Set<number>();
  for (const city of cities) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        occupied.add((city.y + dy) * size + (city.x + dx));
      }
    }
  }
  return occupied;
};

const generateRuins = (
  biomes: BiomeType[],
  cities: City[],
  config: MapConfig,
  rng: () => number,
): Ruin[] => {
  const { size, ruinsCount } = config;
  if (ruinsCount === 0) return [];

  const occupied = cityTiles(cities, size);

  const minDist = Math.max(2, (size / Math.sqrt(ruinsCount)) * 0.3);
  const pds = new PoissonDiskSampling(
    { shape: [size, size], minDistance: minDist },
    rng,
  );
  const samples = pds.fill();

  const valid: [number, number][] = [];
  for (const [fx, fy] of samples) {
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    if (x < 0 || x >= size || y < 0 || y >= size) continue;
    const b = biomes[y * size + x];
    if (b !== "grass" && b !== "forest" && b !== "hills") continue;
    if (occupied.has(y * size + x)) continue;
    valid.push([x, y]);
  }

  for (let i = valid.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [valid[i], valid[j]] = [valid[j], valid[i]];
  }

  const ruins: Ruin[] = [];
  for (const [x, y] of valid) {
    if (ruins.length >= ruinsCount) break;
    ruins.push({ id: ruins.length, x, y });
  }
  return ruins;
};

const generateShrines = (
  biomes: BiomeType[],
  cities: City[],
  ruins: Ruin[],
  config: MapConfig,
  rng: () => number,
): Shrine[] => {
  const { size, shrineCount } = config;
  if (shrineCount === 0) return [];

  const occupied = cityTiles(cities, size);
  for (const ruin of ruins) occupied.add(ruin.y * size + ruin.x);

  const minDist = Math.max(2, (size / Math.sqrt(shrineCount)) * 0.3);
  const pds = new PoissonDiskSampling(
    { shape: [size, size], minDistance: minDist },
    rng,
  );
  const samples = pds.fill();

  const valid: [number, number][] = [];
  for (const [fx, fy] of samples) {
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    if (x < 0 || x >= size || y < 0 || y >= size) continue;
    const b = biomes[y * size + x];
    if (b !== "grass" && b !== "forest") continue;
    if (occupied.has(y * size + x)) continue;
    valid.push([x, y]);
  }

  for (let i = valid.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [valid[i], valid[j]] = [valid[j], valid[i]];
  }

  const shrines: Shrine[] = [];
  for (const [x, y] of valid) {
    if (shrines.length >= shrineCount) break;
    shrines.push({ id: shrines.length, x, y });
  }
  return shrines;
};

const generateRoads = (
  biomes: BiomeType[],
  cities: City[],
  config: MapConfig,
  rng: () => number,
): { roads: Road[]; roadTiles: Set<number>; bridgeTiles: Set<number> } => {
  const { size, roadDensity } = config;
  const roadTiles = new Set<number>();
  const bridgeTiles = new Set<number>();

  // roadDensity = fraction of cities included in the road network (0 = none, 1 = all)
  const networkSize = Math.round(roadDensity * cities.length);
  if (networkSize < 2) return { roads: [], roadTiles, bridgeTiles };

  // Randomly select which cities are in the network
  const shuffledIds = Array.from({ length: cities.length }, (_, i) => i);
  for (let i = shuffledIds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
  }

  const networkIds = shuffledIds.slice(0, networkSize);
  const networkCities = networkIds.map((id) => cities[id]);

  const ccx = (c: City) => c.x + 0.5;
  const ccy = (c: City) => c.y + 0.5;

  const inMST = new Set<number>([0]);
  const mstEdges: [number, number][] = [];
  while (inMST.size < networkCities.length) {
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    for (const a of inMST) {
      for (let b = 0; b < networkCities.length; b++) {
        if (inMST.has(b)) continue;
        const d =
          (ccx(networkCities[a]) - ccx(networkCities[b])) ** 2 +
          (ccy(networkCities[a]) - ccy(networkCities[b])) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = [a, b];
        }
      }
    }
    if (!best) break;
    mstEdges.push(best);
    inMST.add(best[1]);
  }

  const allEdges = mstEdges;

  const tileNoise = new Float32Array(size * size);
  for (let i = 0; i < tileNoise.length; i++) tileNoise[i] = rng() * 0.5;

  const roads: Road[] = [];

  for (const [fromId, toId] of allEdges) {
    const from = networkCities[fromId];
    const to = networkCities[toId];
    const startIdx = (from.y + 1) * size + (from.x + 1);
    const endIdx = (to.y + 1) * size + (to.x + 1);
    const targetX = endIdx % size;
    const targetY = Math.floor(endIdx / size);

    const costToReach = new Float32Array(size * size).fill(Infinity);
    costToReach[startIdx] = 0;
    const cameFrom = new Int32Array(size * size).fill(-1);
    const closed = new Uint8Array(size * size);
    const open = new Heap<[number, number]>((a, b) => a[0] - b[0]);
    open.push([0, startIdx]);

    let found = false;
    while (open.size() > 0) {
      const entry = open.pop()!;
      const current = entry[1];
      if (current === endIdx) {
        found = true;
        break;
      }

      if (closed[current]) continue;
      closed[current] = 1;

      const curX = current % size;
      const curY = Math.floor(current / size);
      const gCurrent = costToReach[current];

      for (const { dx, dy } of CARDINAL_DIRS) {
        const nx = curX + dx;
        const ny = curY + dy;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

        const nIdx = ny * size + nx;
        const biome = biomes[nIdx];
        if (biome === "ocean" || biome === "mountains") continue;

        let moveCost: number;
        if (roadTiles.has(nIdx)) moveCost = 0.5;
        else if (biome === "river") {
          moveCost = biomes[current] === "river" ? 80.0 : 4.0;
        } else if (biome === "hills") moveCost = 2.5;
        else if (biome === "forest") moveCost = 1.5;
        else moveCost = 1.0;

        const gNeighbor = gCurrent + moveCost + tileNoise[nIdx];
        if (gNeighbor >= costToReach[nIdx]) continue;

        costToReach[nIdx] = gNeighbor;
        cameFrom[nIdx] = current;
        open.push([
          gNeighbor + Math.sqrt((nx - targetX) ** 2 + (ny - targetY) ** 2),
          nIdx,
        ]);
      }
    }

    if (!found) continue;

    const path: number[] = [];
    for (let tile = endIdx; tile !== -1; tile = cameFrom[tile]) {
      path.unshift(tile);
      if (tile === startIdx) break;
    }

    for (const tileIdx of path) {
      roadTiles.add(tileIdx);
      if (biomes[tileIdx] === "river") bridgeTiles.add(tileIdx);
    }

    roads.push({ from: networkIds[fromId], to: networkIds[toId], path });
  }

  return { roads, roadTiles, bridgeTiles };
};

export const applyBiomes = (noise: NoiseData, config: MapConfig): MapData => {
  const { size, rawElevations, shapeGradient, elevations, moisture } = noise;
  const { mountainCoverage, hillsCoverage, forestCoverage, seed } = config;

  const landIndices = Array.from({ length: size * size }, (_, i) => i).filter(
    (i) => elevations[i] >= 0,
  );

  const mountainThreshold = percentileThreshold(
    elevations,
    landIndices,
    1 - mountainCoverage,
  );
  const hillsThreshold = percentileThreshold(
    elevations,
    landIndices,
    1 - mountainCoverage - hillsCoverage,
  );
  const flatLandIndices = landIndices.filter(
    (i) => elevations[i] < hillsThreshold,
  );
  const forestThreshold = percentileThreshold(
    moisture,
    flatLandIndices,
    1 - forestCoverage,
  );

  const biomes: BiomeType[] = new Array(size * size);
  for (let i = 0; i < size * size; i++) {
    if (elevations[i] < 0) biomes[i] = "ocean";
    else if (elevations[i] >= mountainThreshold) biomes[i] = "mountains";
    else if (elevations[i] >= hillsThreshold) biomes[i] = "hills";
    else if (moisture[i] >= forestThreshold) biomes[i] = "forest";
    else biomes[i] = "grass";
  }

  // Remove islands smaller than the threshold by converting them to ocean.
  // Scale with map size so the cutoff is proportional on all map sizes.
  const minIslandSize = Math.max(4, Math.round((size / 128) * 20));
  const visitedIslands = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) {
    if (visitedIslands[i] || biomes[i] === "ocean") continue;
    const region: number[] = [];
    const queue = [i];
    visitedIslands[i] = 1;
    while (queue.length > 0) {
      const cur = queue.pop()!;
      region.push(cur);
      const cx = cur % size,
        cy = Math.floor(cur / size);
      for (const { dx, dy } of CARDINAL_DIRS) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const ni = ny * size + nx;
        if (visitedIslands[ni] || biomes[ni] === "ocean") continue;
        visitedIslands[ni] = 1;
        queue.push(ni);
      }
    }
    if (region.length < minIslandSize) {
      for (const t of region) biomes[t] = "ocean";
    }
  }

  const riverPaths = generateRivers(noise, biomes, config);

  const dockTiles = generateDocks(
    riverPaths,
    biomes,
    size,
    alea(seed + ":docks"),
  );
  const cities = generateCities(biomes, config, alea(seed + ":cities"));
  const ruins = generateRuins(biomes, cities, config, alea(seed + ":ruins"));
  const shrines = generateShrines(
    biomes,
    cities,
    ruins,
    config,
    alea(seed + ":shrines"),
  );
  const { roads, roadTiles, bridgeTiles } = generateRoads(
    biomes,
    cities,
    config,
    alea(seed + ":roads"),
  );

  return {
    config,
    rawElevations,
    shapeGradient,
    elevations,
    moisture,
    biomes,
    cities,
    ruins,
    shrines,
    roads,
    roadTiles,
    bridgeTiles,
    dockTiles,
  };
};

export const generateMap = (config: MapConfig): MapData =>
  applyBiomes(generateNoiseData(config), config);
