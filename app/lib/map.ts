import {
  Color,
  DisplayMode,
  Engine,
  Keys,
  Rectangle,
  Scene,
  TileMap,
  Vector,
} from "excalibur";
import type { MapData } from "./mapgen";
import {
  BIOME_COLORS,
  BRIDGE_COLOR,
  CITY_COLOR,
  DOCK_COLOR,
  ROAD_COLOR,
  RUIN_COLOR,
  SHRINE_COLOR,
} from "./mapgen-draw";

export const VIEWPORT_TILES_W = 50;
export const VIEWPORT_TILES_H = 36;

const computeTileSize = (screenW: number, screenH: number) => {
  return Math.floor(
    Math.min(screenW / VIEWPORT_TILES_W, screenH / VIEWPORT_TILES_H),
  );
};

const makeGraphic = (tileSize: number, rgb: [number, number, number]) => {
  return new Rectangle({
    width: tileSize,
    height: tileSize,
    color: Color.fromRGB(rgb[0], rgb[1], rgb[2]),
  });
};

class MapScene extends Scene {
  mapPixels = 0;

  constructor(
    readonly mapData: MapData,
    readonly tileSize: number,
  ) {
    super();
  }

  onInitialize(engine: Engine) {
    const {
      biomes,
      roadTiles,
      bridgeTiles,
      dockTiles,
      cities,
      ruins,
      shrines,
      config,
    } = this.mapData;
    const { tileSize } = this;
    const size = config.size;

    const make = (rgb: [number, number, number]) => makeGraphic(tileSize, rgb);
    const biomeGraphics = Object.fromEntries(
      Object.entries(BIOME_COLORS).map(([k, rgb]) => [k, make(rgb)]),
    );
    const roadGraphic = make(ROAD_COLOR);
    const bridgeGraphic = make(BRIDGE_COLOR);
    const dockGraphic = make(DOCK_COLOR);
    const cityGraphic = make(CITY_COLOR);
    const ruinGraphic = make(RUIN_COLOR);
    const shrineGraphic = make(SHRINE_COLOR);

    const tilemap = new TileMap({
      tileWidth: tileSize,
      tileHeight: tileSize,
      columns: size,
      rows: size,
      renderFromTopOfGraphic: true,
    });

    for (let i = 0; i < size * size; i++) {
      const tile = tilemap.tiles[i];
      if (bridgeTiles.has(i)) {
        tile.addGraphic(bridgeGraphic);
      } else if (dockTiles.has(i)) {
        tile.addGraphic(dockGraphic);
      } else if (roadTiles.has(i)) {
        tile.addGraphic(roadGraphic);
      } else {
        tile.addGraphic(biomeGraphics[biomes[i]]);
      }
    }

    for (const city of cities) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const tile = tilemap.tiles[(city.y + dy) * size + (city.x + dx)];
          tile.clearGraphics();
          tile.addGraphic(cityGraphic);
        }
      }
    }

    for (const ruin of ruins) {
      const tile = tilemap.tiles[ruin.y * size + ruin.x];
      tile.clearGraphics();
      tile.addGraphic(ruinGraphic);
    }

    for (const shrine of shrines) {
      const tile = tilemap.tiles[shrine.y * size + shrine.x];
      tile.clearGraphics();
      tile.addGraphic(shrineGraphic);
    }

    this.add(tilemap);

    this.mapPixels = size * tileSize;
    this.camera.pos = new Vector(this.mapPixels / 2, this.mapPixels / 2);
    this.clampCamera(engine);
  }

  onPreUpdate(engine: Engine, elapsed: number) {
    const speed = 400 * (elapsed / 1000);
    const { keyboard } = engine.input;
    const dx =
      (keyboard.isHeld(Keys.D) ? speed : 0) -
      (keyboard.isHeld(Keys.A) ? speed : 0);
    const dy =
      (keyboard.isHeld(Keys.S) ? speed : 0) -
      (keyboard.isHeld(Keys.W) ? speed : 0);
    if (dx !== 0 || dy !== 0) {
      this.camera.pos = this.camera.pos.add(new Vector(dx, dy));
      this.clampCamera(engine);
    }
  }

  clampCamera(engine: Engine) {
    const halfW = engine.drawWidth / 2;
    const halfH = engine.drawHeight / 2;

    const mapHalf = this.mapPixels / 2;

    const x =
      halfW >= mapHalf
        ? mapHalf
        : Math.max(halfW, Math.min(this.mapPixels - halfW, this.camera.pos.x));

    const y =
      halfH >= mapHalf
        ? mapHalf
        : Math.max(halfH, Math.min(this.mapPixels - halfH, this.camera.pos.y));

    this.camera.pos = new Vector(x, y);
  }
}

export const buildMap = (
  canvas: HTMLCanvasElement,
  mapData: MapData,
): Engine => {
  const tileSize = computeTileSize(window.innerWidth, window.innerHeight);
  const viewportW = VIEWPORT_TILES_W * tileSize;
  const viewportH = VIEWPORT_TILES_H * tileSize;

  const engine = new Engine({
    canvasElement: canvas,
    displayMode: DisplayMode.FillScreen,
    width: viewportW,
    height: viewportH,
    antialiasing: false,
    suppressConsoleBootMessage: true,
    suppressPlayButton: true,
    backgroundColor: Color.fromRGB(55, 110, 180),
    scenes: { map: new MapScene(mapData, tileSize) },
  });

  engine.start().then(() => engine.goToScene("map"));

  return engine;
};
