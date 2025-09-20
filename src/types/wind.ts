/**
 * wind.ts - Types et interfaces pour la simulation du vent
 */

export interface WindParams {
  speed: number; // km/h
  direction: number; // degrés
  turbulence: number; // pourcentage
}

export interface WindConfig {
  defaultSpeed: number; // km/h
  defaultDirection: number; // degrés
  defaultTurbulence: number; // %
  turbulenceScale: number;
  turbulenceFreqBase: number;
  turbulenceFreqY: number;
  turbulenceFreqZ: number;
  turbulenceIntensityXZ: number;
  turbulenceIntensityY: number;
}