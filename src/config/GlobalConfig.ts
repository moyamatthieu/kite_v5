/**
 * Configuration globale unifiée de la simulation
 *
 * 🎛️ CE QUE FAIT CE FICHIER :
 * C'est le "panneau de contrôle" de toute la simulation ! Tous les réglages
 * sont centralisés ici pour qu'on puisse facilement ajuster le comportement
 * sans fouiller dans le code.
 *
 * 🎯 POURQUOI C'EST PRATIQUE :
 * - Un seul endroit pour tout régler
 * - Facile de faire des expériences (changer la gravité, la masse du kite...)
 * - Les valeurs sont expliquées en langage humain
 * - Séparé par catégories logiques (physique, vent, kite...)
 *
 * 🔧 COMMENT L'UTILISER :
 * Changez les valeurs ici et la simulation se comportera différemment !
 * Par exemple : augmentez la masse du kite → il sera plus lent à réagir
 */

// 🌍 CONFIGURATION PHYSIQUE - Les "lois de la nature" de notre monde virtuel
export const PHYSICS_CONFIG = {
  gravity: 9.81, // m/s² - Comme sur Terre ! (fait tomber les objets vers le bas)
  linearDamping: 0.92, // Résistance de l'air (0.92 = perd 8% de vitesse à chaque image)
  angularDamping: 0.85, // Résistance à la rotation (empêche de tourner trop vite)
  adaptiveDampingFactor: 0.05, // Facteur d'adaptation du damping basé sur vitesse (0-1)
  dampingEffectFactor: 0.1, // Facteur d'effet global du damping (0-1) - contrôle l'intensité
  maxVelocityForDamping: 20, // m/s - Vitesse max pour calcul damping adaptatif
  angularDragCoeff: 0.1, // Friction angulaire (comme l'air qui "freine" la rotation)
  deltaTimeMax: 0.016, // 60 images/seconde maximum (fluidité optimale)
  fixedTimestep: 0.016, // Pas de temps fixe pour la physique (60 FPS pour fluidité)
} as const;

// 🪁 CONFIGURATION DU CERF-VOLANT - Les caractéristiques de notre kite
export const KITE_CONFIG = {
  mass: 0.28, // kg - Poids du kite (280g = kite léger et réactif)
  inertia: 0.08, // kg⋅m² - Résistance au changement de rotation (stabilité)
  minHeight: 0.5, // mètres - Altitude minimum (évite que le kite touche le sol)
} as const;

// 🔗 CONFIGURATION DES LIGNES - Les "cordes" qui relient kite et pilote
export const LINES_CONFIG = {
  defaultLength: 15, // mètres - Longueur standard (15m = bon compromis contrôle/sécurité)
  elasticity: 0.8, // Élasticité (0.8 = lignes un peu stretchy, comme dans la réalité)
  dampingFactor: 0.95, // Anti-oscillation (évite que les lignes "vibrent")
  stiffness: 25000, // N/m - Rigidité (25000 = lignes solides qui ne s'étirent pas trop)
  maxTension: 1000, // Newtons - Force max avant rupture (1000N = très solide)
  maxSag: 0.008, // Affaissement quand ligne molle (0.008 = presque droite)
  catenarySagFactor: 3, // Courbure naturelle des lignes (comme une chaînette)
} as const;

// Configuration du vent
export const WIND_CONFIG = {
  baseStrength: 12, // Force de base du vent (m/s)
  turbulenceStrength: 0.3, // Intensité de la turbulence (0-1)
  turbulenceFrequency: 2.0, // Fréquence de la turbulence
  gustStrength: 0.5, // Force des rafales (0-1)
  gustFrequency: 0.1, // Fréquence des rafales
  heightVariation: 0.2, // Variation du vent avec l'altitude
  directionVariation: 15, // Variation de direction en degrés
  defaultSpeed: 18, // Vitesse par défaut optimisée (km/h)
  defaultDirection: 0, // Direction par défaut (0° = Nord)
  defaultTurbulence: 3, // Turbulence réduite pour stabilité
  turbulenceScale: 0.15, // Facteur d'échelle réduit
  turbulenceFreqBase: 0.3, // Fréquence de base ajustée
  turbulenceIntensityXZ: 0.8, // Intensité turbulence horizontale réduite
  turbulenceIntensityY: 0.2, // Intensité turbulence verticale réduite
  turbulenceFreqY: 1.3, // Facteur fréquence turbulence Y
  turbulenceFreqZ: 0.7, // Facteur fréquence turbulence Z
} as const;

// Configuration de la barre de contrôle
export const CONTROL_BAR_CONFIG = {
  width: 0.6, // Largeur de la barre optimisée (mètres)
  maxRotation: Math.PI / 3, // Rotation maximum (60 degrés)
  interpolationSpeed: 0.1, // Vitesse d'interpolation des commandes

  // Physique du retour automatique à l'équilibre
  springConstant: 2.0, // N·m/rad - Raideur du ressort (force de rappel)
  damping: 0.8, // N·m·s/rad - Amortissement (freine les oscillations)
  mass: 0.1, // kg - Masse de la barre (inertie)
  deadzone: 0.01, // rad - Zone morte pour éviter les micro-mouvements
} as const;

// Configuration du rendu
export const RENDER_CONFIG = {
  antialias: true,
  shadowMapSize: 2048,
  fogStart: 50,
  fogEnd: 200,
} as const;

// 🌍 CONFIGURATION DE L'ENVIRONNEMENT - L'apparence du monde virtuel
export const ENVIRONMENT_CONFIG = {
  ground: {
    size: 300, // mètres - Taille du terrain (300x300m)
    segments: 32, // Nombre de subdivisions (pour terrain varié)
    baseColor: 0x4a7c59, // Couleur de base (vert naturel)
    accentColor: 0x6b8e5a, // Couleur d'accent (vert plus clair)
    heightVariation: 2, // mètres - Variation d'altitude max
    textureScale: 4, // Échelle de répétition des motifs
    grassDensity: 0.3, // Densité des détails d'herbe (0-1)
  },
  atmosphere: {
    fogEnabled: true,
    fogColor: 0xa0a0a0, // Gris atmosphérique
    fogNear: 150,
    fogFar: 400,
  },
  lighting: {
    sunIntensity: 0.8,
    sunColor: 0xffffff,
    ambientIntensity: 0.4,
    ambientColor: 0x404040,
  }
} as const;

// Configuration consolidée (pour compatibilité)
export const CONFIG = {
  physics: {
    ...PHYSICS_CONFIG,
    airDensity: 1.225, // Densité de l'air
  },
  aero: {
    liftScale: 1.5, // Portance augmentée pour meilleur vol
    dragScale: 1.0, // Traînée naturelle
  },
  kite: {
    ...KITE_CONFIG,
    area: 2.5, // m² - Surface totale approximative (sera remplacé par KiteGeometry.TOTAL_AREA)
  },
  lines: LINES_CONFIG,
  wind: WIND_CONFIG,
  controlBar: {
    ...CONTROL_BAR_CONFIG,
    position: [0, 1.2, 8], // Position initiale [x, y, z]
  },
  environment: ENVIRONMENT_CONFIG,
  rendering: {
    ...RENDER_CONFIG,
    fogStart: 100,
    fogEnd: 1000,
  },
} as const;
