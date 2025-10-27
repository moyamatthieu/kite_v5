/**
 * Config.ts - Configuration centralisée de la simulation
 * 
 * Ce fichier centralise TOUTES les constantes physiques et paramètres de configuration.
 * Aucun nombre "magique" ne doit se trouver dans le code métier.
 * 
 * Structure :
 * 1. Constantes physiques universelles
 * 2. Géométrie et masse du kite
 * 3. Systèmes de contrainte (bridles et lignes)
 * 4. Aérodynamique
 * 5. Conditions environnementales
 * 6. Initialisation et simulation
 * 7. Rendu et interface
 * 8. Debug et logging
 */

import * as THREE from 'three';

// ============================================================================
// 🌍 CONSTANTES PHYSIQUES UNIVERSELLES
// ============================================================================

namespace PhysicsConstants {
  /** Accélération due à la gravité (m/s²) - Niveau mer, 45° latitude */
  export const GRAVITY = 9.81;

  /** Densité de l'air standard (kg/m³) - Niveau mer, 15°C */
  export const AIR_DENSITY = 1.225;

  /** Nombre d'itérations PBD pour convergence */
  export const PBD_ITERATIONS = 8;

  /** Compliance PBD (0 = rigide, >0 = souple) */
  export const PBD_COMPLIANCE = 0.00001;

  /** Correction max PBD par frame (m) */
  export const PBD_MAX_CORRECTION = 2.0;

  /** Facteur d'amortissement angulaire PBD (0.95 = 5% damp par frame) */
  export const PBD_ANGULAR_DAMPING = 0.99;

  /** Lambda max pour PBD : limite stricte pour éviter divergence */
  export const PBD_MAX_LAMBDA = 100;
}

// ============================================================================
// 🪁 GÉOMÉTRIE ET MASSE DU KITE
// ============================================================================

namespace KiteSpecs {
  // === Masses ===
  /** Masse du kite (kg) - 120g pour ratio réaliste */
  export const MASS_KG = 0.12;

  // === Dimensions ===
  /** Envergure (m) */
  export const WINGSPAN_M = 1.65;

  /** Corde (m) - Profondeur moyenne */
  export const CHORD_M = 0.65;

  /** Surface ailée (m²) - Calculée : wingspan × chord × 0.5 (delta triangulaire) */
  export const SURFACE_AREA_M2 = 0.54;

  // === Moments d'inertie (kg⋅m²) ===
  // Approximation pour plaque triangulaire (delta)
  // Audit physique : 19/10/2025
  /** Pitch (rotation avant/arrière autour de X) */
  export const INERTIA_XX = 0.0315;

  /** Yaw (rotation gauche/droite autour de Y) */
  export const INERTIA_YY = 0.0042;

  /** Roll (rotation latérale autour de Z) */
  export const INERTIA_ZZ = 0.0110;

  // === Couleur ===
  /** Couleur du kite en RGB hex */
  export const COLOR = 0xff3333; // Rouge

  // === Facteurs géométriques internes ===
  /** Position Y du centre relatif (25% de la hauteur du nez) */
  export const CENTER_HEIGHT_RATIO = 0.25;

  /** Position relative des points intermédiaires (75% vers le bas) */
  export const INTERPOLATION_RATIO = 0.75; // = 1.0 - CENTER_HEIGHT_RATIO

  /** Ratio des points de fixation (2/3 vers l'intérieur) */
  export const FIX_POINT_RATIO = 2 / 3;

  /** Hauteur relative des whiskers (60% du centre) */
  export const WHISKER_HEIGHT_RATIO = 0.6;

  /** Profondeur des whiskers (arrière du kite, m) */
  export const WHISKER_DEPTH_M = 0.20;
}

// ============================================================================
// 🛝 BRIDLES (Système de contrôle)
// ============================================================================

namespace BridleConfig {
  // === Longueurs ===
  /** Longueur bride nez (m) */
  export const LENGTH_NEZ_M = 0.65;

  /** Longueur bride inter (m) */
  export const LENGTH_INTER_M = 0.65;

  /** Longueur bride centre (m) */
  export const LENGTH_CENTRE_M = 0.65;

  // === Couleur ===
  /** Couleur des bridles en RGB hex */
  export const COLOR = 0xff0000; // Rouge
}

// ============================================================================
// 🧵 LIGNES DE VOL
// ============================================================================

namespace LineSpecs {
  // === Géométrie ===
  /** Longueur des lignes (m) */
  export const LENGTH_M = 15;

  /** Tension maximale (N) - ~8× poids du kite */
  export const MAX_TENSION_N = 10;

  // === Couleur ===
  /** Couleur des lignes en RGB hex */
  export const COLOR = 0x0000ff; // Bleu

  // === Contraintes Position-Based Dynamics (PBD) ===
  /** Les lignes sont des contraintes géométriques pures (pas de forces artificielles) */
  export const PBD_ITERATIONS = 2; // Nombre de passes pour convergence
  
  /** Tolérance pour ligne molle (mètres) */
  export const PBD_TOLERANCE = 0.01; // 1 cm
}

// ============================================================================
// 🌬️ AÉRODYNAMIQUE
// ============================================================================

namespace AeroConfig {
  // === Coefficients physiques de calcul ===
  /** Coefficient de pression dynamique = 0.5 ρ V² */
  export const DYNAMIC_PRESSURE_COEFF = 0.5;

  /** Efficacité d'Oswald (e) pour profil delta - typiquement 0.8 */
  export const OSWALD_EFFICIENCY = 0.8;

  // === Coefficients de portance (lift) ===
  /** CL à angle d'attaque zéro */
  export const CL0 = 0.0;

  /** dCL/dα (par degré) - Valeur réaliste pour cerf-volant */
  export const CL_ALPHA_PER_DEG = 0.105;

  /** Angle d'attaque pour portance nulle (deg) - Légèrement négatif pour profil cambré */
  export const ALPHA_ZERO_DEG = -2;

  /** Angle d'attaque optimal (deg) - Réduit pour éviter décrochage */
  export const ALPHA_OPTIMAL_DEG = 12;

  // === Coefficient de traînée (drag) ===
  /** CD à angle d'attaque zéro (traînée parasite) - Augmentée pour kite */
  export const CD0 = 0.08;

  // === Coefficient de moment ===
  /** CM (moment de tangage) - Réduit pour moins d'instabilité */
  export const CM = -0.05;

  // === Multiplicateurs de tuning (UI) ===
  /** Multiplicateur de portance par défaut - Range: [0.0, 2.0] */
  export const LIFT_SCALE_DEFAULT = 1.0;

  /** Multiplicateur de traînée par défaut - Range: [0.0, 2.0] */
  export const DRAG_SCALE_DEFAULT = 1.0;

  /** Lissage temporel des forces - Range: [0.0, 1.0] */
  export const FORCE_SMOOTHING = 0.05;
}

// ============================================================================
// 🌊 CONDITIONS ENVIRONNEMENTALES
// ============================================================================

namespace EnvironmentConfig {
  // === Vent ===
  /** Vitesse du vent par défaut (m/s) - ~25 km/h (bon pour vol cerf-volant) */
  export const WIND_SPEED_M_S = 12;

  /** Direction du vent par défaut (degrés) - 270 = -Z = Nord */
  export const WIND_DIRECTION_DEG = 270;

  /** Turbulence par défaut (%) - Range: [0, 100] */
  export const WIND_TURBULENCE_PERCENT = 0;

  // === Système de coordonnées du vent ===
  // X = droite/gauche, Y = haut/bas, Z = devant/derrière
  // Direction 0° = +X (Est)
  // Direction 90° = +Z (Sud)
  // Direction 180° = -X (Ouest)
  // Direction 270° = -Z (Nord)

  // === Physique générale ===
  /** Damping linéaire (réduction de vélocité) */
  export const LINEAR_DAMPING = 0.8;

  /** Damping angulaire (réduction de rotation) */
  export const ANGULAR_DAMPING = 0.5;
}

// ============================================================================
// 👤 PILOTE
// ============================================================================

namespace PilotSpecs {
  /** Masse du pilote (kg) - Adulte standard */
  export const MASS_KG = 75;

  /** Hauteur du pilote (m) */
  export const HEIGHT_M = 1.6;

  /** Largeur aux épaules (m) */
  export const WIDTH_M = 0.5;

  /** Profondeur (m) */
  export const DEPTH_M = 0.3;

  /** Position Y du centre du pilote (m) */
  export const CENTER_Y_M = 0.8;
}

// ============================================================================
// 🚀 INITIALISATION - POSITIONS ET ORIENTATION
// ============================================================================

namespace InitConfig {
  // === Positions initiales ===
  // Système de coordonnées Three.js :
  // X = droite/gauche, Y = haut/bas, Z = devant/derrière (vent vient de -Z)

  /** Position Y du pivot de la barre (m) */
  export const CONTROL_BAR_POSITION_Y_M = 1;

  /** Distance avant du pivot (m) - 60cm devant le pilote */
  export const CONTROL_BAR_POSITION_Z_M = -0.6;

  /** Altitude du kite au-dessus de la barre (m) */
  export const KITE_ALTITUDE_M = 10;

  /** Distance du kite devant la barre (m) */
  export const KITE_DISTANCE_M = 15;

  // === Orientation initiale ===
  /** Pitch initial (deg) - Face au vent, angle d'attaque faible */
  export const ORIENTATION_PITCH_DEG = 0;

  /** Yaw initial (deg) */
  export const ORIENTATION_YAW_DEG = 0;

  /** Roll initial (deg) */
  export const ORIENTATION_ROLL_DEG = 0;
}

// ============================================================================
// ⚙️ SIMULATION
// ============================================================================

namespace SimulationConfig {
  /** FPS cible */
  export const TARGET_FPS = 60;

  /** Frame time maximal (s) - 1/30 = 33.3ms pour éviter instabilités */
  export const MAX_FRAME_TIME_S = 1 / 30;

  /** Échelle de temps (1.0 = vitesse normale, <1 ralenti, >1 accéléré) */
  export const TIME_SCALE = 1.0;

  /** Démarrer automatiquement au chargement */
  export const AUTO_START = true;
}

// ============================================================================
// 🎨 RENDU
// ============================================================================

namespace RenderConfig {
  // === Caméra - Position et orientation ===
  /** Position X de la caméra relative au pilote (m) - Permet de voir le kite */
  export const CAMERA_POSITION_X = 13.37;

  /** Position Y de la caméra (hauteur, m) - Permet de voir l'altitude du kite */
  export const CAMERA_POSITION_Y = 11.96;

  /** Position Z de la caméra (profondeur, m) - Éloignement du plan XY */
  export const CAMERA_POSITION_Z = 0.45;

  /** Point visé X par la caméra (m) */
  export const CAMERA_LOOKAT_X = -3.92;

  /** Point visé Y par la caméra (m) */
  export const CAMERA_LOOKAT_Y = 0;

  /** Point visé Z par la caméra (m) */
  export const CAMERA_LOOKAT_Z = -12.33;

  /** Niveau de subdivision du mesh du kite - Range: [0, 4] */
  export const MESH_SUBDIVISION_LEVEL = 0;
}

// ============================================================================
// 🔍 DEBUG ET LOGGING
// ============================================================================

namespace DebugConfig {
  /** Mode debug activé */
  export const ENABLED = true;

  /** Afficher les vecteurs de force */
  export const SHOW_FORCE_VECTORS = true;

  /** Afficher les infos physiques détaillées */
  export const SHOW_PHYSICS_INFO = false;

  /** Niveau de log: 'debug' | 'info' | 'warn' | 'error' */
  export const LOG_LEVEL = 'info' as const;

  // === Paramètres de visualisation debug ===
  /** Intervalle de frame pour logging périodique (60 @ 60FPS = 1/sec) */
  export const FRAME_LOG_INTERVAL = 60;

  /** Facteur d'échelle pour vecteurs de force */
  export const FORCE_VECTOR_SCALE = 0.5;

  /** Seuil minimum de force pour afficher (N) */
  export const FORCE_THRESHOLD = 0.001;

  /** Seuil minimum de lift pour afficher (N) */
  export const LIFT_THRESHOLD = 0.0001;

  /** Facteur d'échelle du vecteur vent apparent (5%) */
  export const WIND_VECTOR_SCALE = 0.05;

  /** Longueur fixe pour affichage des normales (m) */
  export const NORMAL_DISPLAY_LENGTH = 2.0;

  /** Taille des labels texte (m) */
  export const TEXT_LABEL_SIZE = 0.2;

  // === Force arrow visualization ===
  /** Seuil minimal force pour affichage flèche (N) */
  export const MIN_FORCE_ARROW_DISPLAY = 0.01;

  /** Longueur maximale flèche force pour visibilité (m) */
  export const MAX_FORCE_ARROW_LENGTH = 30;

  // === Canvas de texture pour labels ===
  /** Dimension petit canvas pour labels simples (pixels) */
  export const CANVAS_SMALL_SIZE = 128;

  /** Dimension grand canvas pour labels complexes (pixels) */
  export const CANVAS_LARGE_SIZE = 512;

  /** Position centre petit canvas (= CANVAS_SMALL_SIZE / 2) */
  export const CANVAS_SMALL_CENTER = CANVAS_SMALL_SIZE / 2;

  /** Position centre grand canvas (= CANVAS_LARGE_SIZE / 2) */
  export const CANVAS_LARGE_CENTER = CANVAS_LARGE_SIZE / 2;
}

// ============================================================================
// 🖥️ INTERFACE UTILISATEUR (UI)
// ============================================================================

namespace UIConfig {
  /** Priorité du système UI dans le pipeline ECS */
  export const PRIORITY = 90;

  /** Précision décimale pour affichage vitesse (km/h) */
  export const DECIMAL_PRECISION_VELOCITY = 2;

  /** Précision décimale pour affichage position (m) */
  export const DECIMAL_PRECISION_POSITION = 2;

  /** Précision décimale pour affichage angles (°) */
  export const DECIMAL_PRECISION_ANGLE = 2;

  /** Facteur de conversion m/s → km/h (correction: était 3.6, mais nous utilisons m/s) */
  export const MS_TO_KMH = 3.6;

  /** Seuil minimum de vitesse vent pour affichage AOA (m/s) */
  export const MIN_WIND_SPEED = 0.01;

  /** Base pour calcul fractale triangles (Level N = TRIANGLES_BASE ^ (N+1)) */
  export const TRIANGLES_BASE = 4;
}

// ============================================================================
// 💨 SYSTÈME DE VENT
// ============================================================================

namespace WindConfig {
  /** Priorité du système Vent dans le pipeline ECS (avant Aéro qui a priorité 30) */
  export const PRIORITY = 20;

  /** Intervalle mise à jour du vent depuis InputComponent (ms) */
  export const UPDATE_INTERVAL = 100;

  /** Seuil de changement détecté en vitesse vent (m/s) */
  export const SPEED_CHANGE_THRESHOLD = 0.01;

  /** Seuil de changement détecté en direction vent (°) */
  export const DIRECTION_CHANGE_THRESHOLD = 0.5;

  /** Seuil de changement détecté en turbulence (%) */
  export const TURBULENCE_CHANGE_THRESHOLD = 0.1;

  /** Facteur d'amortissement turbulence verticale (0.3 = 30% de l'horizontale) */
  export const VERTICAL_TURBULENCE_FACTOR = 0.3;

  /** Vitesse minimale du vent pour calcul direction normalisée (m/s) */
  export const MINIMUM_WIND_SPEED = 0.01;

  /** Vitesse vent par défaut au démarrage (m/s) - ~20 km/h */
  export const DEFAULT_WIND_SPEED_MS = 5.56;

  /** Direction vent par défaut au démarrage (°) - 0 = +X (Est) */
  export const DEFAULT_WIND_DIRECTION = 0;

  /** Turbulence par défaut au démarrage (%) */
  export const DEFAULT_TURBULENCE = 10;
}

// ============================================================================
// ✨ EXPORT DE LA CONFIGURATION PRINCIPALE
// ============================================================================

export const CONFIG = {
  // === KITE ===
  kite: {
    mass: KiteSpecs.MASS_KG,
    wingspan: KiteSpecs.WINGSPAN_M,
    chord: KiteSpecs.CHORD_M,
    surfaceArea: KiteSpecs.SURFACE_AREA_M2,
    inertia: {
      Ixx: KiteSpecs.INERTIA_XX,
      Iyy: KiteSpecs.INERTIA_YY,
      Izz: KiteSpecs.INERTIA_ZZ
    },
    color: KiteSpecs.COLOR
  },

  // === LIGNES ===
  lines: {
    length: LineSpecs.LENGTH_M,
    maxTension: LineSpecs.MAX_TENSION_N,
    color: LineSpecs.COLOR,
    pbd: {
      iterations: LineSpecs.PBD_ITERATIONS,
      tolerance: LineSpecs.PBD_TOLERANCE
    }
  },

  // === BRIDES ===
  bridles: {
    nez: BridleConfig.LENGTH_NEZ_M,
    inter: BridleConfig.LENGTH_INTER_M,
    centre: BridleConfig.LENGTH_CENTRE_M,
    color: BridleConfig.COLOR
  },

  // === AÉRODYNAMIQUE ===
  aero: {
    airDensity: PhysicsConstants.AIR_DENSITY,
    CL0: AeroConfig.CL0,
    CLAlpha: AeroConfig.CL_ALPHA_PER_DEG,
    alpha0: AeroConfig.ALPHA_ZERO_DEG,
    alphaOptimal: AeroConfig.ALPHA_OPTIMAL_DEG,
    CD0: AeroConfig.CD0,
    CM: AeroConfig.CM,
    liftScale: AeroConfig.LIFT_SCALE_DEFAULT,
    dragScale: AeroConfig.DRAG_SCALE_DEFAULT,
    forceSmoothing: AeroConfig.FORCE_SMOOTHING
  },

  // === VENT ===
  wind: {
    speed: EnvironmentConfig.WIND_SPEED_M_S,
    direction: EnvironmentConfig.WIND_DIRECTION_DEG,
    turbulence: EnvironmentConfig.WIND_TURBULENCE_PERCENT
  },

  // === PHYSIQUE ===
  physics: {
    gravity: PhysicsConstants.GRAVITY,
    linearDamping: EnvironmentConfig.LINEAR_DAMPING,
    angularDamping: EnvironmentConfig.ANGULAR_DAMPING
  },

  // === PILOTE ===
  pilot: {
    mass: PilotSpecs.MASS_KG,
    height: PilotSpecs.HEIGHT_M,
    width: PilotSpecs.WIDTH_M,
    depth: PilotSpecs.DEPTH_M
  },

  // === INITIALISATION ===
  initialization: {
    controlBarPosition: new THREE.Vector3(0, InitConfig.CONTROL_BAR_POSITION_Y_M, InitConfig.CONTROL_BAR_POSITION_Z_M),
    kiteAltitude: InitConfig.KITE_ALTITUDE_M,
    kiteDistance: InitConfig.KITE_DISTANCE_M,
    kiteOrientation: {
      pitch: InitConfig.ORIENTATION_PITCH_DEG,
      yaw: InitConfig.ORIENTATION_YAW_DEG,
      roll: InitConfig.ORIENTATION_ROLL_DEG
    }
  },

  // === SIMULATION ===
  simulation: {
    targetFPS: SimulationConfig.TARGET_FPS,
    maxFrameTime: SimulationConfig.MAX_FRAME_TIME_S,
    timeScale: SimulationConfig.TIME_SCALE,
    autoStart: SimulationConfig.AUTO_START
  },

  // === RENDU ===
  render: {
    cameraPosition: new THREE.Vector3(RenderConfig.CAMERA_POSITION_X, RenderConfig.CAMERA_POSITION_Y, RenderConfig.CAMERA_POSITION_Z),
    cameraLookAt: new THREE.Vector3(RenderConfig.CAMERA_LOOKAT_X, RenderConfig.CAMERA_LOOKAT_Y, RenderConfig.CAMERA_LOOKAT_Z),
    meshSubdivision: RenderConfig.MESH_SUBDIVISION_LEVEL
  },

  // === DEBUG ===
  debug: {
    enabled: DebugConfig.ENABLED,
    showForceVectors: DebugConfig.SHOW_FORCE_VECTORS,
    showPhysicsInfo: DebugConfig.SHOW_PHYSICS_INFO,
    logLevel: DebugConfig.LOG_LEVEL
  }
} as const;

// ============================================================================
// 📦 EXPORTS PUBLICS - Pour utilisation dans les systèmes
// ============================================================================

// Exports des namespaces pour accès direct aux constantes spécialisées
export {
  PhysicsConstants,
  KiteSpecs,
  BridleConfig,
  LineSpecs,
  AeroConfig,
  EnvironmentConfig,
  PilotSpecs,
  InitConfig,
  SimulationConfig,
  RenderConfig,
  DebugConfig,
  UIConfig,
  WindConfig
};
