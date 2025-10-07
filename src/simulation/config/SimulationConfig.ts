/**
 * SimulationConfig.ts - Configuration     // Damping coefficients (en 1/s) - appliqués avec formule exponentielle
  linearDampingCoeff: 1.5, // 🔧 RÉALISTE: Friction aérodynamique modérée pour stabilisation naturelle
    // Angular damping : UN SEUL mécanisme (angular drag proportionnel à ω)
  angularDragFactor: 5.0, // 🔧 STABILITÉ CRITIQUE: Très fort amortissement pour éviter rotation excessive
  },le de la simulation K  wind: {
    defaultSpeed: 25, // km/h - Vitesse réaliste pour cerf-volant sport (15-30 km/h typique)
    defaultDirection: 0, // degrés
    defaultTurbulence: 5, // % - Turbulence réaliste pour conditions normales
    turbulenceScale: 0.05,*
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
 * Utilisation typique :
 *   - Importé dans tous les modules pour accéder aux réglages
 *   - Sert à personnaliser la simulation (test, debug, tuning)
 *
 * Voir aussi :
 *   - src/simulation/config/PhysicsConstants.ts
 *   - src/simulation/config/KiteGeometry.ts
 */
import * as THREE from "three";

import { KiteGeometry } from "./KiteGeometry";

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
    deltaTimeMax: 0.016, // Mise à jour max 60 fois par seconde (pour rester fluide)
    // Damping coefficients (en 1/s) - appliqués avec formule exponentielle
  linearDampingCoeff: 0.8, // 🔧 VIVACITÉ: Réduit pour plus de réactivité
    // Angular damping : UN SEUL mécanisme (angular drag proportionnel à ω)
  angularDragFactor: 4.0, // 🔧 VIVACITÉ: Réduit pour plus de mouvement dynamique
  },
  aero: {
  liftScale: 1.2, // 🔧 VIVACITÉ: Augmenté pour compenser vent faible (20 km/h)
  dragScale: 0.8, // 🔧 VIVACITÉ: Augmenté proportionnellement
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
    minHeight: 0, // m - Altitude minimale (plus haut pour éviter le sol)
  },
  lines: {
    defaultLength: 15, // m - Longueur par défaut
    stiffness: 1200, // N/m - Rigidité réduite pour plus de souplesse (2200 était trop rigide)
    preTension: 75, // N - Tension minimale toujours présente
    maxTension: 800, // N - Tension max avant rupture (~80% charge nominale)
    dampingCoeff: 0.05, // Coefficient d'amortissement interne (0-1)
    linearMassDensity: 0.0005, // kg/m - Masse linéique pour calcul caténaire
  },
  wind: {
    defaultSpeed: 20, // km/h - Vitesse idéale pour cerf-volant
    defaultDirection: 0, // degrés
    defaultTurbulence: 0.001, // % - Turbulence réaliste (0.001 → 10)
    turbulenceScale: 0.05,
    turbulenceFreqBase: 0.05,
    turbulenceFreqY: 0.3,
    turbulenceFreqZ: 0.3,
    turbulenceIntensityXZ: 0.2,
    turbulenceIntensityY: 0.2,
  },
  rendering: {
    shadowMapSize: 2048,
    antialias: true,
    fogStart: 100,
    fogEnd: 1000,
  },
  debugVectors: true, // Active ou désactive l'affichage des vecteurs de debug
  controlBar: {
    width: 0.6, // m - Largeur de la barre
    position: new THREE.Vector3(0, 1.2, 8), // Position initiale
    barRadius: 0.02, // m - Rayon du cylindre de la barre
    barRotation: Math.PI / 2, // rad - Rotation pour orientation horizontale
    handleRadius: 0.03, // m - Rayon des poignées
    handleLength: 0.15, // m - Longueur des poignées
  },
  pilot: {
    width: 0.4, // m - Largeur du corps du pilote
    height: 1.6, // m - Hauteur du corps du pilote
    depth: 0.3, // m - Profondeur du corps du pilote
    offsetY: 0.8, // m - Décalage vertical par rapport à la barre
    offsetZ: 8.5, // m - Distance derrière la barre
  },
  initialization: {
    initialKiteY: 7.0, // m - Altitude initiale du kite
    initialDistanceFactor: 0.99, // Sans unité - Facteur de distance initiale (95% de longueur ligne)
  },
  visualization: {
    lineWidth: 2, // pixels - Largeur des lignes de contrôle
  },
  debug: {
    // Seuils de tension des brides pour couleurs visuelles
    bridleTensionLow: 20, // N - Seuil tension molle (vert)
    bridleTensionHigh: 100, // N - Seuil tension élevée (rouge)
    // Seuils pour vecteurs debug
    minVectorLength: 0.01, // m - Longueur minimale pour afficher un vecteur
    minVelocityDisplay: 0.1, // m/s - Vitesse minimale pour afficher vecteur vitesse
  },
  input: {
    rotationSpeed: 2.5, // rad/s - Vitesse de rotation de la barre (input utilisateur)
    returnSpeed: 3.0, // rad/s - Vitesse de retour au centre de la barre
    maxRotation: Math.PI / 4, // rad - Rotation maximale de la barre (45°)
  },
  kiteInertia: {
    gyrationDivisor: Math.sqrt(2), // Sans unité - Diviseur pour rayon de giration (wingspan / √2)
    inertiaFactor: 0.5, // Sans unité - Facteur ajustement inertie (compromis stabilité/réactivité)
  },
};