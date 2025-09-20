/**
 * WindConfig.ts - Configuration par défaut pour la simulation du vent
 */

import type { WindConfig } from "../types/wind";

export const WIND_CONFIG: WindConfig = {
  defaultSpeed: 18, // km/h
  defaultDirection: 180, // degrés - vent venant de l'horizon, soufflant vers le pilote (+Z)
  defaultTurbulence: 3, // %
  turbulenceScale: 0.15,
  turbulenceFreqBase: 0.3,
  turbulenceFreqY: 1.3,
  turbulenceFreqZ: 0.7,
  turbulenceIntensityXZ: 0.8,
  turbulenceIntensityY: 0.2,
};
