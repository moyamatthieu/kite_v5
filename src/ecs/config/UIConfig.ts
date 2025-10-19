/**
 * UIConfig.ts - Configuration des valeurs par défaut de l'interface utilisateur
 */

export const UIConfig = {
  wind: {
    defaultSpeed: 10, // m/s
    defaultDirection: 270, // degrés
    defaultTurbulence: 0, // % (0 pour stabilité initiale)
    minSpeed: 0,
    maxSpeed: 30,
    minTurbulence: 0,
    maxTurbulence: 100
  },

  lines: {
    defaultLength: 150, // m
    minLength: 20,
    maxLength: 300,
    bridles: {
      nez: 1.5,
      inter: 2.0,
      centre: 2.5,
      min: 0.5,
      max: 5
    }
  },

  physics: {
    defaultLinearDamping: 0.5,
    defaultAngularDamping: 0.5,
    defaultMeshSubdivision: 2,
    linearDampingRange: [0, 1],
    angularDampingRange: [0, 1],
    meshSubdivisionRange: [0, 4]
  },

  aerodynamics: {
    defaultLiftScale: 1.0,
    defaultDragScale: 1.0,
    defaultForceSmoothing: 0.8,
    liftScaleRange: [0, 2],
    dragScaleRange: [0, 2],
    forceSmoothingRange: [0, 1]
  }
};
