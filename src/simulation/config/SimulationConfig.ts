/**
 * SimulationConfig.ts - Configuration globale de la simulation Kite
 *
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
    linearDampingCoeff: 0.15, // Résistance linéaire réduite (0.4 était trop fort - perte 14%/s au lieu de 33%/s)
    // Angular damping : UN SEUL mécanisme (angular drag proportionnel à ω)
    angularDragFactor: 2.0, // Ajusté pour cohérence avec inertie corrigée (×8) - ratio damping/aero ≈ 80%
  },
  aero: {
    liftScale: 1.0, // Portance à 1.0 (coefficient plein)
    dragScale: 1.0, // Traînée à 1.0 (coefficient plein)
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
    defaultSpeed: 20, // km/h
    defaultDirection: 0, // degrés
    defaultTurbulence: 0.001, // % - Turbulence minimale
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
  },
};