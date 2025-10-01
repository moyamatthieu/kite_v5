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
    angularDamping: 0.85, // Amortissement angulaire équilibré
    linearDamping: 0.92, // Friction air réaliste (8% de perte par frame)
    angularDragCoeff: 0.1, // Résistance rotation augmentée pour moins d'oscillations
  },
  aero: {
    liftScale: 1.5, // Portance augmentée pour meilleur vol
    dragScale: 1.0, // Traînée naturelle
  },
  kite: {
    mass: 0.28, // kg - Masse du cerf-volant
    area: KiteGeometry.TOTAL_AREA, // m² - Surface totale
    inertia: 0.08, // kg·m² - Moment d'inertie réduit pour meilleure réactivité
    minHeight: 0.5, // m - Altitude minimale (plus haut pour éviter le sol)
  },
  lines: {
    defaultLength: 15, // m - Longueur par défaut
    stiffness: 25000, // N/m - Rigidité renforcée pour mieux maintenir le kite
    maxTension: 1000, // N - Tension max augmentée pour éviter rupture
    maxSag: 0.008, // Affaissement réduit pour lignes plus tendues
    catenarySagFactor: 3, // Facteur de forme caténaire ajusté
  },
  wind: {
    defaultSpeed: 18, // km/h
    defaultDirection: 0, // degrés
    defaultTurbulence: 3, // %
    turbulenceScale: 0.15,
    turbulenceFreqBase: 0.3,
    turbulenceFreqY: 1.3,
    turbulenceFreqZ: 0.7,
    turbulenceIntensityXZ: 0.8,
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