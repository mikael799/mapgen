import { useMemo } from "react";
import {
  type MapConfig,
  type MapData,
  generateNoiseData,
  applyBiomes,
} from "~/lib/mapgen";

export const useMapData = (config: MapConfig): MapData => {
  const noiseData = useMemo(() => {
    return generateNoiseData(config);
  }, [config.seed, config.size, config.shape]);

  return useMemo(() => {
    return applyBiomes(noiseData, config);
  }, [
    noiseData,
    config.mountainCoverage,
    config.hillsCoverage,
    config.forestCoverage,
    config.riverCount,
    config.cityCount,
    config.roadDensity,
    config.ruinsCount,
    config.shrineCount,
  ]);
};
