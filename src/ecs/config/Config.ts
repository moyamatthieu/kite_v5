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

  /** Epsilon pour calculs numériques (évite division par zéro) */
  export const EPSILON = 1e-6;

  /** Position du sol (m) - Y = 0 dans Three.js */
  export const GROUND_Y = 0;

  /** Vitesse angulaire minimale au carré pour intégration rotation */
  export const MIN_ANGULAR_VELOCITY_SQ = 0.0001;

  /** Facteur pour intégration Euler semi-implicite */
  export const SEMI_IMPLICIT_SCALE = 0.5;
}

// ============================================================================
// 🔗 CONTRAINTES (LIGNES ET BRIDLES)
// ============================================================================

namespace ConstraintConfig {
  /** Tether line tensile stiffness (N/m)
   * 
   * Makani reference: tether_params.tensile_stiffness (EA in N)
   *   EA = Young's modulus × cross-sectional area
   *   For Dyneema rope: EA ≈ 1-5 MN (1,000,000 - 5,000,000 N)
   * 
   * Our implementation uses stiffness per meter:
   *   LINE_STIFFNESS = EA / restLength (N/m)
   *   For EA = 120,000 N and L = 15m: k = 8000 N/m
   * 
   * Physical interpretation:
   *   • 1cm elongation → 80N force (≈8kg tension)
   *   • 10cm elongation → 800N force (≈80kg tension)
   * 
   * Tuning guidelines:
   *   • Higher values (10000-20000) = stiffer lines, less stretch
   *   • Lower values (20-100) = soft elastic behavior, progressive forces
   *   • Higher values (1000-5000) = stiff cables, can cause oscillations
   *   • Too high (>50000) = numerical instability
   * 
   * ✅ Current value: 8000 N/m (recommandation Makani pour réalisme/stabilité)
   *    À 1cm excès → 80N, à 10cm excès → 800N (comportement câble Dyneema réaliste)
   */
  export const LINE_STIFFNESS = 8000; // Rigidité Makani-inspired (8000 N/m)

  /** Position-based projection factor (0.0-1.0)
   * 
   * @deprecated Not used in current force-based implementation
   * 
   * This was used in PBD mode for direct position correction.
   * Current implementation uses explicit forces instead.
   */
  export const PBD_PROJECTION_FACTOR = 0.3;

  /** Longitudinal damping coefficient (N·s/m - absolute damping)
   * 
   * Changed from proportional (0.04 × v × k) to absolute (DAMPING_COEF × v)
   * to avoid explosive damping forces when stiffness or velocity is high.
   * 
   * Physical interpretation (avec k=8000 N/m):
   *   • Critical damping: c_crit = 2×√(k×m) = 2×√(8000×0.12) = 62 N·s/m
   *   • Target: 0.1 × c_crit = 6.2 N·s/m (underdamped léger)
   * 
   * ✅ Avec damping = 6.0 N·s/m (OPTIMAL avec k=8000):
   *   - excess = 0.31m → F_spring = 8000×0.31 = 2480N
   *   - v_radial = 22m/s → F_damp = -6×22 = -132N
   *   - F_total = 2480-132 = 2348N > 0 ✅ Force positive appliquée !
   * 
   * Ratio damping/spring = 6×v / (8000×excess) = 0.00075×(v/excess)
   * Pour v/excess < 1333 s⁻¹, le ressort domine (comportement physique correct)
   */
  export const ABSOLUTE_DAMPING = 6.0; // N·s/m - 0.1 × c_crit pour underdamping optimal
  
  /** @deprecated Use ABSOLUTE_DAMPING instead */
  export const PBD_DAMPING = 0.04;

  /** Nombre d'itérations de résolution PBD par frame 
   * Plus d'itérations = meilleure convergence mais plus coûteux
   * 3-5 itérations suffisent généralement pour des contraintes rigides
   */
  export const PBD_ITERATIONS = 5;

  /** Coefficient de stabilisation Baumgarte (0.05-0.2) 
   * @deprecated Non utilisé en mode inextensible pur
   */
  export const BAUMGARTE_COEF = 0.1;

  /** Limite de sécurité pour les forces de contrainte (N)
   * 
   * Prevents numerical explosions when lines are severely overstretched.
   * 
   * With LINE_STIFFNESS=50 N/m:
   *   • At 5m excess → spring force = 250 N
   *   • At 10m/s velocity → damping = 20 N
   *   • Total max ≈ 270 N (well below limit)
   * 
   * ⚠️ Current value: 300 N (cohérent avec nouvelle rigidité douce)
   */
  export const MAX_CONSTRAINT_FORCE = 300; // Limite adaptée à LINE_STIFFNESS=50

  /** Limite d'élongation maximale (% de longueur au repos)
   * 
   * Beyond this limit, the line is considered broken or unstable.
   * Prevents infinite force accumulation in numerical simulations.
   * 
   * Physical interpretation:
   *   • Typical Dyneema kite lines: elastic ~3-5% under normal load
   *   • Safety limit: 2% (30cm sur 15m) allows realistic stretch
   *   • Beyond 5%: risk of line damage or simulation instability
   * 
   * ⚠️ CRITIQUE: 20% était ABSURDE (3m d'élongation → 6000N de force)
   * Maintenant: 2% max = 30cm élongation → tension réaliste 200-600N
   */
  export const MAX_ELONGATION_RATIO = 0.002; // CORRIGÉ: 2% au lieu de 20% !

  /** Force minimale pour considérer une ligne tendue (N)
   * 
   * Below this threshold, the line is considered slack.
   * Prevents micro-oscillations around the slack/taut boundary.
   */
  export const MIN_TAUT_FORCE = 0.1; // Réduit de 1.0 à 0.1 N pour moins de force au repos
}

// ============================================================================
// 🎨 CONSTANTES VISUELLES ET RENDU
// ============================================================================

namespace VisualConstants {
  /** Seuil de recréation géométrie ligne (m) */
  export const LINE_GEOMETRY_UPDATE_THRESHOLD = 0.01;

  /** Rayon des tubes de ligne (m) */
  export const LINE_TUBE_RADIUS = 0.003;

  /** Segments radiaux des tubes */
  export const LINE_TUBE_SEGMENTS = 8;

  /** Couleur verte (poignée droite) */
  export const COLOR_GREEN = 0x00ff00;

  /** Couleur rouge (poignée gauche) */
  export const COLOR_RED = 0xff0000;

  /** Diamètre cylindre barre (m) */
  export const BAR_CYLINDER_DIAMETER = 0.03;       // 3 cm de diamètre (était 1.5 cm)
  
  /** Diamètre des sphères représentant les poignets (m) */
  export const HANDLE_SPHERE_DIAMETER = 0.07;     // 7 cm de diamètre (était 3.5 cm)

  /** Segments sphère poignée */
  export const HANDLE_SPHERE_SEGMENTS = 16;

  /** Diamètre tube bridle (m) */
  export const BRIDLE_TUBE_DIAMETER = 0.003;
}

// ============================================================================
// ⏱️ CONSTANTES DE SIMULATION
// ============================================================================

namespace SimulationConstants {
  /** Delta time maximal (s) - Cap à 50ms pour stabilité */
  export const MAX_DELTA_TIME = 0.05;

  /** Facteur de conversion millisecondes → secondes */
  export const MS_TO_SECONDS = 1000;
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

  /** Surface ailée (m²) - Valeur effective pour kite delta avec profil 3D
   * Calcul géométrique pur : wingspan × chord × 0.5 = 1.65 × 0.65 × 0.5 = 0.536 m²
   * Valeur utilisée : 0.8 m² (surface effective incluant courbure et profil 3D)
   * Note: La surface effective d'un kite est supérieure à la projection 2D
   */
  export const SURFACE_AREA_M2 = 0.8;

  // === Moments d'inertie (kg⋅m²) ===
  // Calcul précis pour plaque triangulaire delta (120g, 1.65m x 0.65m)
  // Formule: I = m * (a² + b²) / 24 pour axes principaux
  /** Pitch (rotation avant/arrière autour de X) */
  export const INERTIA_XX = 0.0158; // m * (wingspan² + chord²) / 24

  /** Yaw (rotation gauche/droite autour de Y) */
  export const INERTIA_YY = 0.0136; // m * wingspan² / 24

  /** Roll (rotation latérale autour de Z) */
  export const INERTIA_ZZ = 0.0158; // m * (wingspan² + chord²) / 24

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
  export const LENGTH_NEZ_M = 0.65; // Aligné avec InputDefaults

  /** Longueur bride inter (m) */
  export const LENGTH_INTER_M = 0.65; // Aligné avec InputDefaults

  /** Longueur bride centre (m) */
  export const LENGTH_CENTRE_M = 0.65; // Aligné avec InputDefaults

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
  export const MAX_TENSION_N = 200;

  // === Couleur ===
  /** Couleur des lignes en RGB hex */
  export const COLOR = 0x0000ff; // Bleu
  
  // Note: Les paramètres physiques (stiffness, damping) sont dans ConstraintConfig
  // LineSystem utilise ConstraintConfig.LINE_STIFFNESS et ABSOLUTE_DAMPING
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
  /** Vitesse du vent par défaut (m/s) - Augmentée pour plus de poussée initiale */
  export const WIND_SPEED_M_S = 8.0;

  /** Direction du vent par défaut (degrés) - 270 = vent du Nord (-Z vector, pousse en +Z) */
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
  /** Damping linéaire (réduction de vélocité)
   * 
   * IMPORTANT: Le damping exponentiel est v_new = v_old × exp(-d × dt)
   * Avec dt ≈ 0.0167s (60 FPS):
   * - d = 0.2  → 0.33% réduction/frame (léger damping numérique)
   * - d = 0.5  → 0.83% réduction/frame (optimal pour stabilité)
   * - d = 1.0  → 1.67% réduction/frame (moyen)
   * - d = 10.0 → 15.3% réduction/frame → vitesse tombe à ZÉRO en 1s ❌ PHYSIQUEMENT ABSURDE
   * 
   * ⚠️ Le freinage doit venir des forces aérodynamiques (drag), PAS d'un damping artificiel !
   * 
   * Le LINEAR_DAMPING est uniquement pour la stabilité numérique, il doit être MINIMAL.
   * Les forces de drag aérodynamiques (F_drag ≈ 0.5×ρ×C_d×A×v²) font le vrai freinage.
   * 
   * ✅ Recommandation: 0.3-0.8 (damping numérique léger uniquement)
   */
  export const LINEAR_DAMPING = 0.5; // Damping minimal pour stabilité numérique uniquement

  /** Damping angulaire (réduction de rotation) - Garde synchronisé avec linéaire */
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

  /** Altitude du kite au-dessus de la barre (m) 
   * ✅ CORRIGÉ : Kite démarre 1m À L'INTÉRIEUR de la sphère de vol (14m)
   * Le vent va pousser le kite vers l'arrière jusqu'à tendre les lignes à 15m
   */
  export const KITE_ALTITUDE_M = 10;

  /** Distance du kite devant la barre (m)
   * Distance 3D = √(10² + 10²) = √200 ≈ 14.14m < 15m ✅ LIGNES SLACK AU DÉPART
   * Élongation initiale = 0m (impossible d'avoir élongation au repos !)
   * Le vent pousse → lignes se tendent progressivement → kite se stabilise à 15m
   */
  export const KITE_DISTANCE_M = 10;

  // === Orientation initiale ===
  /** Pitch initial (deg) - Face au vent avec angle d'attaque favorable
   * ✅ AJUSTÉ à 15° pour générer portance immédiate au démarrage
   */
  export const ORIENTATION_PITCH_DEG = 15;

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
  export const FORCE_VECTOR_SCALE = 1;

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

  /** Vitesse vent par défaut au démarrage (m/s) - 0 = pas de vent */
  export const DEFAULT_WIND_SPEED_MS = 0.0;

  /** Direction vent par défaut au démarrage (°) - 0 = +X (Est) */
  export const DEFAULT_WIND_DIRECTION = 0;

  /** Turbulence par défaut au démarrage (%) */
  export const DEFAULT_TURBULENCE = 10;
}

// ============================================================================
// ✈️ MODES PAR DÉFAUT DE LA SIMULATION
// ============================================================================

namespace SimulationModes {
  /** 
   * Mode aérodynamique par défaut : 'nasa' ou 'perso' 
   * - 'nasa' : Formules officielles NASA (plaques planes)
   * - 'perso' : Modèle personnalisé (Rayleigh)
   */
  export const AERO_MODE = 'nasa' as const;
}

// ============================================================================
// 🎯 VALEURS PAR DÉFAUT POUR INPUTCOMPONENT
// ============================================================================

namespace InputDefaults {
  /** Valeur par défaut pour lineLength (m)
   * ⚠️  Cette valeur doit correspondre à LineSpecs.LENGTH_M pour cohérence
   */
  export const LINE_LENGTH_M = 15;
  
  /** Valeur par défaut pour bridleNez (m) */
  export const BRIDLE_NEZ_M = 1.5;
  
  /** Valeur par défaut pour bridleInter (m) */
  export const BRIDLE_INTER_M = 2.0;
  
  /** Valeur par défaut pour bridleCentre (m) */
  export const BRIDLE_CENTRE_M = 2.5;
  
  /** Valeur par défaut pour meshSubdivisionLevel */
  export const MESH_SUBDIVISION_LEVEL = 2;
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
    // Paramètres physiques réels utilisés par LineSystem (depuis ConstraintConfig)
    constraint: {
      stiffness: ConstraintConfig.LINE_STIFFNESS,     // 8000 N/m
      damping: ConstraintConfig.ABSOLUTE_DAMPING,     // 6.0 N·s/m
      maxForce: ConstraintConfig.MAX_CONSTRAINT_FORCE // 300 N
    }
  },

  // === BRIDES ===
  bridles: {
    nez: BridleConfig.LENGTH_NEZ_M,    // 0.65m = 65cm (correct pour les brides)
    inter: BridleConfig.LENGTH_INTER_M, // 0.65m = 65cm (correct pour les brides)
    centre: BridleConfig.LENGTH_CENTRE_M, // 0.65m = 65cm (correct pour les brides)
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
  ConstraintConfig,
  VisualConstants,
  SimulationConstants,
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
  WindConfig,
  SimulationModes,
  InputDefaults
};

// ============================================================================
// 🌌 CONFIGURATION AÉRODYNAMIQUE NASA (CENTRALISÉE)
// ============================================================================

export namespace NASAAeroConfig {
  /** Densité de l'air standard au niveau de la mer (kg/m³) */
  export const AIR_DENSITY_SEA_LEVEL = 1.225;

  /** Coefficient de pression dynamique = 0.5 */
  export const DYNAMIC_PRESSURE_COEFF = 0.5;

  /** Facteur d'efficacité pour ailes rectangulaires (NASA: 0.7) */
  export const RECTANGULAR_WING_EFFICIENCY = 0.7;

  /** Coefficient pour plaque plane perpendiculaire (NASA: 1.28) */
  export const FLAT_PLATE_DRAG_COEFF = 1.28;

  /** Constante π */
  export const PI = Math.PI;

  // === STALL MODELING ===
  /** Angle de décrochage (stall) en radians - ~15° pour plaque plane */
  export const STALL_ANGLE_DEGREES = 15;
  export const STALL_ANGLE_RAD = (STALL_ANGLE_DEGREES * Math.PI) / 180;

  /** Largeur de transition (°) pour interpolation douce vers le régime post-stall */
  export const STALL_TRANSITION_WIDTH_DEGREES = 20;
  export const STALL_TRANSITION_WIDTH_RAD = (STALL_TRANSITION_WIDTH_DEGREES * Math.PI) / 180;

  /** Post-stall CL max (coefficient de portance au stall) */
  export const CL_MAX = 1.2;
  export const CL_POST_STALL_COEFF = 1.1;

  /** Post-stall CD (traînée augmentée après stall) */
  export const CD_STALL = 1.8;
  export const CD_BASE = 0.08;
  export const CD_POST_STALL_FACTOR = 1.6;

  // === CENTER OF PRESSURE ===
  /** Position du centre de pression par rapport au centre géométrique (% chord) */
  export const CP_POSITION_RATIO = 0.25;

  // === SAFETY LIMITS ===
  /** Force maximale par surface (N) - Limite de sécurité pour éviter instabilité */
  export const MAX_FORCE_PER_SURFACE = 500;

  /** Couple maximal par surface (N·m) - Limite de sécurité */
  export const MAX_TORQUE_PER_SURFACE = 200;

  /** Vitesse apparente maximale considérée (m/s) - Cap réaliste pour kite */
  export const MAX_APPARENT_WIND_SPEED = 30;
}
