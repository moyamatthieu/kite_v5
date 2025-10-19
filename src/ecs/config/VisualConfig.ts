/**
 * VisualConfig.ts - Constantes pour le rendu visuel
 * 
 * Centralise tous les paramètres visuels pour faciliter l'ajustement
 * et éviter les "nombres magiques" dans le code.
 */

export const VISUAL_CONFIG = {
  // === PILOTE ===
  pilot: {
    width: 0.5,    // m - Largeur (épaules)
    height: 1.6,   // m - Hauteur (taille humaine)
    depth: 0.3,    // m - Profondeur
    color: 0x4a4a4a, // Gris foncé
    roughness: 0.8,
    metalness: 0.2
  },

  // === BARRE DE CONTRÔLE ===
  controlBar: {
    barDiameter: 0.030,    // m - 3cm de diamètre
    barColor: 0x8B4513,    // Marron (SaddleBrown)
    barRoughness: 0.6,
    barMetalness: 0.1,
    
    handleDiameter: 0.070, // m - 7cm de diamètre  
    handleSpacing: 0.65,   // m - Espacement entre poignées
    leftHandleColor: 0xff0000,  // Rouge
    rightHandleColor: 0x00ff00, // Vert
    handleRoughness: 0.4,
    handleMetalness: 0.2
  },

  // === KITE ===
  kite: {
    // Toile
    sailColor: 0xff3333,    // Rouge vif
    sailOpacity: 0.8,
    sailRoughness: 0.8,
    sailMetalness: 0.1,
    
    // Frame
    frameDiameter: 0.008,   // m - 8mm de diamètre
    frameColor: 0x000000,   // Noir
    
    // Whiskers  
    whiskerDiameter: 0.005, // m - 5mm de diamètre
    whiskerColor: 0x333333, // Gris foncé
    
    // Bridles
    bridleDiameter: 0.002,  // m - 2mm de diamètre
    bridleColor: 0x666666,  // Gris
    bridleOpacity: 0.8,
    
    // Points de contrôle
    ctrlMarkerDiameter: 0.050, // m - 5cm de diamètre
    ctrlLeftColor: 0xff0000,    // Rouge (gauche)
    ctrlRightColor: 0x00ff00,   // Vert (droite)
    ctrlRoughness: 0.5,
    ctrlMetalness: 0.3,
    ctrlEmissiveLeft: 0xaa0000,
    ctrlEmissiveRight: 0x00aa00
  },

  // === LIGNES DE VOL ===
  lines: {
    diameter: 0.006,        // m - 6mm de diamètre
    leftColor: 0xff0000,    // Rouge
    rightColor: 0x00ff00,   // Vert
    roughness: 0.8,
    metalness: 0.1,
    updateThreshold: 0.01   // m - Seuil de recréation de géométrie
  },

  // === ENVIRONNEMENT ===
  environment: {
    skyColor: 0x87CEEB,           // Bleu ciel
    groundColor: 0x228B22,        // Vert forêt
    groundRoughness: 0.8,
    groundMetalness: 0.0,
    gridSize: 100,
    gridDivisions: 100,
    gridColor: 0x444444,
    gridCenterColor: 0x888888,
    gridHeightOffset: 0.01,       // m - Pour éviter z-fighting
    
    // Lumières
    ambientLightColor: 0xffffff,
    ambientLightIntensity: 0.6,
    directionalLightColor: 0xffffff,
    directionalLightIntensity: 0.8,
    directionalLightPosition: { x: 10, y: 10, z: 10 }
  },

  // === CAMÉRA ===
  camera: {
    fov: 60,
    near: 0.1,
    far: 1000,
    // Position optimale trouvée manuellement
    position: { x: 13.37, y: 11.96, z: 0.45 },
    target: { x: -3.92, y: 0, z: -12.33 },
    dampingFactor: 0.05,
    minDistance: 5,
    maxDistance: 100,
    maxPolarAngle: Math.PI / 2 - 0.05 // Empêche passage sous le sol
  },

  // === QUALITÉ DE RENDU ===
  quality: {
    // Segments pour géométries cylindriques
    cylinderSegments: 8,      // Lignes, whiskers
    barCylinderSegments: 16,  // Barre de contrôle
    
    // Segments pour sphères
    sphereSegments: 16,       // Résolution standard
    
    // Anti-aliasing
    antialias: true
  },

  // === CONSTANTES PHYSIQUES VISUELLES ===
  physics: {
    degreesToRadians: Math.PI / 180,
    degreesFullCircle: 360
  }
} as const;
