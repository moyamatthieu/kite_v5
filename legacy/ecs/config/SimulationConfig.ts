/**
 * SimulationConfig.ts - Configuration centralisée de la simulation Kite
 * Rôle :
 *   - Définit tous les paramètres physiques, aérodynamiques, géométriques et environnementaux
 *   - Sert de source unique de vérité pour les réglages du monde virtuel
 *   - Permet d'ajuster le comportement du kite, du vent, des lignes, etc.
 *
 * Dépendances principales :
 *   - KiteGeometry.ts : Utilisé pour la surface et les points du kite
 *   - Utilisé par tous les modules physiques et de rendu
 *
 * Relation avec les fichiers adjacents :
 *   - PhysicsConstants.ts : Définit les limites et tolérances physiques
 *   - KiteGeometry.ts : Définit la géométrie du kite
 *   - Tous les modules du projet importent SimulationConfig pour accéder aux paramètres
 *
  pilot: PILOT_CONFIG, // Utilise la configuration centralisée du pilote
  controlBar: {
    offsetY: 1.1, // Hauteur réaliste des mains
    offsetZ: 0.7, // Distance devant le pilote
    width: 0.6,   // Largeur de la barre
    handleOffset: 0.25, // Distance des poignées par rapport au centre
  },
 * Utilisation typique :
 *   - Importé dans tous les modules pour accéder aux réglages
 *   - Sert à personnaliser la simulation (test, debug, tuning)
 *
 * Voir aussi :
 *   - src/simulation/config/PhysicsConstants.ts
 *   - src/simulation/config/KiteGeometry.ts
 */
import * as THREE from 'three';

import { KiteGeometry } from './KiteGeometry';
import { PhysicsConstants } from './PhysicsConstants';

/**
 * Configuration centralisée de la simulation Kite
 *
 * Source unique de vérité pour tous les paramètres physiques, aérodynamiques,
 * géométriques et environnementaux du simulateur.
 */

// Configuration des propriétés du pilote (origine du système)
export const PILOT_CONFIG = {
  width: 0.4, // m - Largeur du corps du pilote
  height: 1.6, // m - Hauteur du corps du pilote
  depth: 0.3, // m - Profondeur du corps du pilote
  position: new THREE.Vector3(0, 0, 0), // Position du pilote - origine du système de coordonnées
};

// Configuration de la barre de contrôle
export const CONTROL_BAR_CONFIG = {
  width: 0.6, // m - Largeur de la barre (60cm)
  offsetY: 1.0, // m - Hauteur de la barre par rapport au sol (au niveau des mains)
  offsetZ: -0.5, // m - Décalage en z (devant le pilote en z négatif)
  barRadius: 0.015, // m - Rayon du cylindre de la barre (15mm)
  barRotation: Math.PI / 2, // rad - Rotation pour orientation horizontale
  handleRadius: 0.025, // m - Rayon des poignées (25mm)
  handleLength: 0.12, // m - Longueur des poignées (12cm)
  handleOffset: 0.25, // m - Distance des poignées depuis le centre de la barre
};

/**
 * Configuration épurée de la simulation
 *
 * Les réglages de notre monde virtuel - comme les règles d'un jeu
 * Vous pouvez changer ces valeurs pour voir comment le cerf-volant réagit
 */
export const CONFIG = {
  physics: {
    gravity: 9.81, // La gravité terrestre (fait tomber les objets)
    airDensity: 1.225, // Densité de l'air (l'air épais pousse plus fort)
    deltaTimeMax: 1 / 60, // Mise à jour max 60 fois par seconde (pour rester fluide)
    controlDeadzone: 0.01, // m - Petite zone de tolérance pour la tension des lignes
    // ✨ MAKANI-INSPIRED: Amortissement réaliste validé expérimentalement
    linearDampingCoeff: 0.05, // Amortissement linéaire optimal (DIAGNOSTIC_VOL.md: était 2, trop élevé)
    angularDragFactor: 0.5 // Amortissement angulaire pour réactivité (DIAGNOSTIC_VOL.md: était 2, trop élevé)
  },
  aero: {
    // ✨ VALEURS STABILISÉES: Forces aérodynamiques réduites pour éviter l'instabilité physique
    liftScale: 0.3, // RÉDUIT: Portance plus faible pour stabilité
    dragScale: 0.3, // RÉDUIT: Traînée plus faible pour stabilité
    
    // ✨ MAKANI MODEL: CL = dCL_dalpha * alpha + CL_0 (simple_aero.c)
    // Modèle linéaire validé expérimentalement au lieu de polynômes complexes
    coefficients: {
      lift: {
        CL_0: 0.0,          // CL à alpha=0 (profil symétrique)
        dCL_dalpha: 3.5,    // Pente linéaire [par radian] - Validé pour delta wing
        CL_max: 1.5,        // Saturation haute (stall)
        CL_min: -1.5        // Saturation basse
      },
      drag: {
        CD_0: 0.02,         // Traînée parasite (alpha=0)
        dCD_dalpha: 0.0,    // Pas de terme linéaire
        dCD_dalpha2: 0.08,  // Terme quadratique: CD += dCD_dalpha2 * alpha²
      },
      alphaStall: 30 * PhysicsConstants.DEG_TO_RAD, // 30° - Début du décrochage
      alphaMax: 60 * PhysicsConstants.DEG_TO_RAD,   // 60° - Limite absolue
      cdMax: 2.0  // Traînée maximale
    },
    // Centre de pression: simplifié → toujours le centroïde géométrique (dynamicCP supprimé)
  },
  kite: {
    // Masse et inertie calculées AUTOMATIQUEMENT depuis la géométrie
    // Basées sur:
    // - Frame carbone (spine 5mm, leading edges 5mm, struts 4mm)
    // - Tissu ripstop nylon 120 g/m² (corrigé pour atteindre masse réaliste)
    // - Accessoires (connecteurs, bridage, renforts)
    // Voir KiteGeometry.calculateTotalMass() pour les détails
    mass: KiteGeometry.TOTAL_MASS, // kg - Calculée automatiquement (~0.31 kg après correction)
    area: KiteGeometry.TOTAL_AREA, // m² - Surface totale (calculée automatiquement)
    inertia: KiteGeometry.INERTIA, // kg·m² - Moment d'inertie (I ≈ m·r², calculé automatiquement)
    minHeight: 0.5, // m - Altitude minimale pour éviter collision avec le sol (marge de sécurité)
    // 🔧 MAILLAGE FIN PARAMÉTRABLE (défaut = niveau 1 = 16 triangles)
    defaultMeshSubdivisionLevel: 0 // Niveau par défaut (0=4, 1=16, 2=64, 3=256 triangles)
  },
  bridle: {
    defaultLengths: Object.freeze({
      nez: 0.65,    // m - Longueur bride NEZ → CTRL
      inter: 0.65,  // m - Longueur bride INTER → CTRL
      centre: 0.65  // m - Longueur bride CENTRE → CTRL
    })
  },
  lines: {
    defaultLength: 15, // m - Longueur fixe (segment droit rigide)
    stiffness: 500, // N/m - Pour calcul tension affichage uniquement
    maxTension: 200 // N - Limite sécurité
  },
  wind: {
    defaultSpeed: 20, // km/h - Vitesse idéale pour cerf-volant sport
    defaultDirection: 0, // degrés
    defaultTurbulence: 5, // % - Turbulence réaliste pour conditions normales
    turbulenceScale: 0.05,
    turbulenceFreqBase: 0.05,
    turbulenceFreqY: 0.3,
    turbulenceFreqZ: 0.3,
    turbulenceIntensityXZ: 0.2,
    turbulenceIntensityY: 0.2
  },
  debugVectors: true, // Active ou désactive l'affichage des vecteurs de debug
  pilot: PILOT_CONFIG,
  controlBar: CONTROL_BAR_CONFIG,
  initialization: {
    initialKiteY: 10.0, // m - Altitude initiale du kite (réaliste pour 15m de lignes)
    initialDistanceFactor: 0.98, // Sans unité - Lignes presque tendues au départ (98% de la longueur)
    initialKiteZ: null, // m - Position Z calculée automatiquement pour lignes tendues (null = calcul auto)
    // ✨ MAKANI-INSPIRED: Orientation initiale face au vent (critique pour portance)
    initialKiteOrientation: {
      pitchDeg: 35,  // deg - Nez incliné vers le bas et l'avant (angle d'attaque optimal)
      yawDeg: 0,     // deg - Face au vent
      rollDeg: 0     // deg - Horizontal
    }
  },
  rendering: {
    shadowMapSize: 2048, // Augmenté pour des ombres plus nettes
    antialias: true,
    shadows: true, // Activer/désactiver les ombres
    fogStart: 100,
    fogEnd: 1000,
    lineWidth: 2, // pixels - Largeur des lignes de contrôle
    surfaceVectorOffset: 0.02, // m - Décalage des flèches de forces
  },
  debug: {
    // Seuils de tension des brides pour couleurs visuelles
    bridleTensionLow: 1, // N - Seuil tension molle (vert)
    bridleTensionMedium: 50, // N - Seuil tension moyenne (jaune)
    bridleTensionHigh: 100, // N - Seuil tension élevée (rouge)
    // Seuils pour vecteurs debug
    minVectorLength: 0.01, // m - Longueur minimale pour afficher un vecteur
    minVelocityDisplay: 0.01 // m/s - Vitesse minimale pour afficher vecteur vitesse
  },
  input: {
    rotationSpeed: 0.5, // rad/s - Vitesse de rotation de la barre (input utilisateur)
    returnSpeed: 3.0, // rad/s - Vitesse de retour au centre de la barre
    maxRotation: 60 * PhysicsConstants.DEG_TO_RAD // rad - Rotation maximale de la barre (60°)
  },
  kiteInertia: {
    gyrationDivisor: Math.sqrt(2), // Sans unité - Diviseur pour rayon de giration (wingspan / √2)
    inertiaFactor: 1 // Sans unité - Facteur ajustement inertie (compromis stabilité/réactivité)
  },

  // Constantes de conversion et calculs fréquents
  conversions: {
    kmhToMs: PhysicsConstants.KMH_TO_MS, // Conversion km/h vers m/s
    radToDeg: PhysicsConstants.RAD_TO_DEG, // Conversion radians vers degrés
    degToRad: PhysicsConstants.DEG_TO_RAD, // Conversion degrés vers radians
    gravityFactor: 9.81 // Accélération gravitationnelle standard
  },

  // Valeurs par défaut pour les calculs
  defaults: {
    meshSegments: 20, // Nombre de segments par défaut pour les tubes
    tubeRadius: 0.005, // Rayon des tubes de ligne (5mm)
    tubeRadialSegments: 8, // Segments radiaux pour les tubes
    smoothingFactor: 0.15, // Facteur de lissage pour les animations
    restitutionFactor: 0.3, // Coefficient de restitution pour les collisions
    groundFriction: 0.85 // Friction du sol
  },

  // Couleurs fréquemment utilisées
  colors: {
    bridleLowTension: 0x00ff00, // Vert - tension faible
    bridleMediumTension: 0xffff00, // Jaune - tension moyenne
    bridleHighTension: 0xff0000, // Rouge - tension élevée
    controlBar: 0x333333, // Gris foncé pour la barre
    controlBarHandles: 0x8b4513, // Marron pour les poignées
    kiteFrame: 0x333333, // Gris pour le cadre du kite
    kiteSail: 0xffffff, // Blanc pour la voile
    debugRed: 0xff0000, // Rouge pour le debug
    debugGreen: 0x00ff00, // Vert pour le debug
    debugBlue: 0x0000ff, // Bleu pour le debug
    debugYellow: 0xffff00 // Jaune pour le debug
  },

  // Seuils et limites fréquemment utilisés
  thresholds: {
    minWindSpeed: 0.1, // m/s - Vitesse minimale pour calculs aérodynamiques
    minVelocity: 0.01, // m/s - Vitesse minimale pour éviter division par zéro
    maxLineSegments: 50, // Nombre maximum de segments pour les lignes
    epsilon: 1e-6, // Seuil numérique général
    epsilonFine: 1e-8, // Seuil fin pour calculs précis
    controlDeadzone: 0.001 // Zone morte pour les contrôles
  },

  // Constantes géométriques fréquentes
  geometry: {
    half: 0.5, // Demi pour calculs de moitiés
    third: 1 / 3, // Tiers pour ratios
    twoThirds: 2 / 3, // Deux tiers
    quarter: 0.25, // Quart
    threeQuarters: 0.75, // Trois quarts
    fullCircle: 2 * Math.PI, // Cercle complet en radians
    halfCircle: Math.PI, // Demi-cercle en radians
    quarterCircle: Math.PI / 2 // Quart de cercle en radians
  },

  // Configuration du logging
  logging: {
    kiteStateInterval: 120 // frames - Intervalle de log de l'état du kite (120 frames ≈ 2s à 60 FPS)
  }
};