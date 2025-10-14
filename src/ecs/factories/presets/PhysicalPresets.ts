/**
 * PhysicalPresets.ts - Constantes physiques centralisées
 *
 * Toutes les constantes physiques, matériaux et configurations
 * utilisées dans la simulation du cerf-volant.
 */

import * as THREE from 'three';

// ============================================================================
// CONSTANTES PHYSIQUES FONDAMENTALES
// ============================================================================

export const PHYSICAL_CONSTANTS = {
  gravity: 9.81, // m/s² - Accélération gravitationnelle terrestre
  airDensity: 1.225, // kg/m³ - Densité de l'air à 15°C
  speedOfSound: 343, // m/s - Vitesse du son dans l'air
  dynamicViscosity: 1.81e-5, // Pa·s - Viscosité dynamique de l'air
} as const;

// ============================================================================
// PRÉSETS DE MATÉRIAUX PHYSIQUES
// ============================================================================

export const MATERIAL_PRESETS = {
  // Matériaux de structure (carbone/kevlar)
  carbon: {
    density: 1600, // kg/m³
    youngModulus: 230e9, // Pa - Module de Young
    tensileStrength: 3500e6, // Pa - Résistance à la traction
    color: 0x333333,
    name: 'Carbone'
  },

  kevlar: {
    density: 1440, // kg/m³
    youngModulus: 130e9, // Pa
    tensileStrength: 3600e6, // Pa
    color: 0x666666,
    name: 'Kevlar'
  },

  // Matériaux de surface (tissus)
  ripstopNylon: {
    density: 40, // g/m² (surface density)
    thickness: 0.00015, // m
    tensileStrength: 150e6, // Pa
    color: 0xffffff,
    name: 'Ripstop Nylon'
  },

  dacron: {
    density: 45, // g/m²
    thickness: 0.00018, // m
    tensileStrength: 180e6, // Pa
    color: 0xf0f0f0,
    name: 'Dacron'
  }
} as const;

// ============================================================================
// PRÉSETS DE LIGNES ET BRIDES
// ============================================================================

export const LINE_PRESETS = {
  standard: {
    stiffness: 2200, // N/m - Rigidité
    preTension: 75, // N - Tension minimale
    maxTension: 800, // N - Tension maximale
    dampingCoeff: 0.05, // Coefficient d'amortissement
    linearMassDensity: 0.0005, // kg/m - Masse linéique
    color: 0xffaa00,
    name: 'Ligne Standard'
  },

  bridle: {
    stiffness: 5000, // N/m - Plus rigide pour les brides
    preTension: 10, // N - Tension minimale faible
    maxTension: 300, // N - Tension maximale
    dampingCoeff: 0.02, // Amortissement faible
    linearMassDensity: 0.0003, // kg/m - Plus léger
    color: 0x00aaff,
    name: 'Bride'
  },

  control: {
    stiffness: 1800, // N/m - Moins rigide pour le contrôle
    preTension: 50, // N
    maxTension: 600, // N
    dampingCoeff: 0.08, // Amortissement plus fort
    linearMassDensity: 0.0007, // kg/m - Plus lourd
    color: 0xff4444,
    name: 'Ligne de Contrôle'
  }
} as const;

// ============================================================================
// PRÉSETS AÉRODYNAMIQUES
// ============================================================================

export const AERODYNAMIC_PRESETS = {
  // Coefficients de portance (lift) selon l'angle d'attaque
  liftCoefficients: {
    low: 0.2,     // Angle d'attaque faible
    medium: 0.8,  // Angle d'attaque moyen
    high: 1.2,    // Angle d'attaque élevé
    stall: 0.1    // Décrochage
  },

  // Coefficients de traînée (drag)
  dragCoefficients: {
    low: 0.05,    // Profil optimisé
    medium: 0.08, // Profil standard
    high: 0.15,   // Profil dégradé
    stall: 0.3    // Décrochage
  },

  // Facteurs d'échelle pour équilibrer la simulation
  scaleFactors: {
    lift: 1.2,    // Facteur de portance
    drag: 1.2,    // Facteur de traînée
    torque: 1.0   // Facteur de couple
  }
} as const;

// ============================================================================
// PRÉSETS DE VENT
// ============================================================================

export const WIND_PRESETS = {
  calm: {
    speed: 5,      // km/h
    direction: 0,  // degrés
    turbulence: 0.001, // %
    name: 'Calme'
  },

  light: {
    speed: 15,     // km/h
    direction: 0,  // degrés
    turbulence: 0.005, // %
    name: 'Léger'
  },

  moderate: {
    speed: 25,     // km/h
    direction: 0,  // degrés
    turbulence: 0.01, // %
    name: 'Modéré'
  },

  strong: {
    speed: 35,     // km/h
    direction: 0,  // degrés
    turbulence: 0.02, // %
    name: 'Fort'
  }
} as const;

// ============================================================================
// PRÉSETS DE CONFIGURATION KITE
// ============================================================================

export const KITE_PRESETS = {
  standard: {
    area: 0.5288,  // m² - Surface calculée
    mass: 0.31,    // kg - Masse calculée
    span: 1.65,    // m - Envergure
    aspectRatio: 3.12, // Rapport d'allongement
    name: 'Kite Standard'
  },

  sport: {
    area: 0.6,     // m²
    mass: 0.28,    // kg
    span: 1.8,     // m
    aspectRatio: 3.5,
    name: 'Kite Sport'
  },

  beginner: {
    area: 0.8,     // m²
    mass: 0.35,    // kg
    span: 2.0,     // m
    aspectRatio: 2.8,
    name: 'Kite Débutant'
  }
} as const;

// ============================================================================
// UTILITAIRES
// ============================================================================

export class PhysicalUtils {
  /**
   * Calcule la pression dynamique
   */
  static dynamicPressure(velocity: THREE.Vector3, airDensity: number = PHYSICAL_CONSTANTS.airDensity): number {
    const speed = velocity.length();
    return 0.5 * airDensity * speed * speed;
  }

  /**
   * Calcule le nombre de Reynolds
   */
  static reynoldsNumber(velocity: number, length: number, viscosity: number = PHYSICAL_CONSTANTS.dynamicViscosity): number {
    return (velocity * length) / viscosity;
  }

  /**
   * Convertit km/h en m/s
   */
  static kmhToMs(speedKmh: number): number {
    return speedKmh / 3.6;
  }

  /**
   * Convertit m/s en km/h
   */
  static msToKmh(speedMs: number): number {
    return speedMs * 3.6;
  }
}