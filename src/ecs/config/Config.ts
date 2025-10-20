/**
 * Config.ts - Configuration centralisée de la simulation
 * 
 * Toutes les constantes physiques et paramètres de configuration.
 */

import * as THREE from 'three';

export const CONFIG = {
  // === KITE ===
  kite: {
    mass: 0.12, // kg (120g) - Augmenté pour ratio réaliste avec surface
    wingspan: 1.65, // m
    chord: 0.65, // m
    surfaceArea: 0.54, // m² (calculé : 1.65 × 0.65 × 0.5)
    
    // Inertie (approximation delta comme plaque triangulaire)
    // Valeurs corrigées selon audit physique du 19/10/2025
    inertia: {
      Ixx: 0.0315, // kg⋅m² (pitch - rotation avant/arrière)
      Iyy: 0.0042, // kg⋅m² (yaw - rotation gauche/droite)
      Izz: 0.0110  // kg⋅m² (roll - rotation latérale)
    },
    
    // Couleur (rouge comme dans main)
    color: 0xff3333 // Rouge
  },
  
  // === LIGNES ===
  lines: {
    length: 15, // m - Longueur réaliste des lignes de vol
    maxTension: 10, // N - Tension max ~8× le poids
    color: 0x0000ff, // Bleu

    // === MODE DE CONTRAINTE ===
    // 'pbd' : Position-Based Dynamics (contraintes géométriques rigides)
    // 'spring-force' : Forces ressort + amortissement (approche physique classique)
    constraintMode: 'pbd' as 'pbd' | 'spring-force',

    // === PARAMÈTRES PBD ===
    // Utilisés seulement si constraintMode === 'pbd'
    pbd: {
      iterations: 4, // 4 itérations pour convergence (legacy utilise 2, on augmente pour stabilité)
      compliance: 0.00001, // Compliance (0 = rigide, >0 = souple) - TRÈS PETIT pour lignes quasi-rigides
      maxCorrection: 2.0, // Correction max par frame (m) - augmenté pour rattraper grandes violations
    },

    // === PARAMÈTRES SPRING-FORCE ===
    // Utilisés seulement si constraintMode === 'spring-force'
    springForce: {
      stiffness: 500, // N/m - Rigidité du ressort (500 N/m pour kite 120g)
      damping: 50, // N·s/m - Amortissement visqueux (critique pour stabilité)
      maxForce: 100, // N - Force maximale appliquée (évite explosions)
    }
  },
  
  // === BRIDES ===
  bridles: {
    nez: 0.65, // m
    inter: 0.65, // m
    centre: 0.65, // m
    color: 0xff0000 // Rouge
  },
  
  // === AÉRODYNAMIQUE ===
  aero: {
    airDensity: 1.225, // kg/m³ (niveau mer, 15°C)

    // Coefficients pour delta (VALEURS RÉALISTES CERF-VOLANT)
    CL0: 0.0, // CL à alpha = 0
    CLAlpha: 0.105, // dCL/dα (par degré) - Augmenté pour valeur réaliste kite
    alpha0: -2, // Angle portance nulle (deg) - Légèrement négatif pour profil cambré
    alphaOptimal: 12, // Angle optimal (deg) - Réduit pour éviter décrochage

    CD0: 0.08, // Traînée parasite - Augmentée (kite moins aérodynamique qu'une aile)
    CM: -0.05, // Moment de tangage - Réduit pour moins d'instabilité

    // Multiplicateurs pour tuning (UI)
    liftScale: 1.0, // Multiplicateur de portance (0-2)
    dragScale: 1.0, // Multiplicateur de traînée (0-2)
    forceSmoothing: 0.05 // Lissage temporel des forces (0-1)
  },
  
  // === VENT ===
  wind: {
    speed: 12, // m/s (~25 km/h - bon pour le vol du kite)
    direction: 270, // degrés (270 = -Z = Nord)
    turbulence: 0 // % (0-100) - Variations aléatoires du vent
  },
  
  // === PHYSIQUE ===
  physics: {
    gravity: 9.81, // m/s²
    linearDamping: 0.8,
    angularDamping: 0.5
  },
  
  // === INITIALISATION ===
  // Système de coordonnées Three.js :
  // X = droite/gauche, Y = haut/bas, Z = devant/derrière (vent vient de -Z)
  // Pilote : centre à (0, 0.8, 0), hauteur 1.6m
  initialization: {
    controlBarPosition: new THREE.Vector3(0, 1, -0.6), // Position du pivot de la barre : 1m hauteur, 60cm devant
    kiteAltitude: 10, // m au-dessus de la barre (Y)
    kiteDistance: 15, // m devant la barre (Z négatif)
    
    // Orientation initiale (face au vent, angle d'attaque faible pour démarrage stable)
    kiteOrientation: {
      pitch: 5, // deg (angle d'attaque de départ réduit pour stabilité)
      yaw: 0, // deg
      roll: 0 // deg
    }
  },
  
  // === SIMULATION ===
  simulation: {
    targetFPS: 60,
    maxFrameTime: 1 / 30, // Max deltaTime (évite instabilités)
    timeScale: 1.0, // Ralenti/accéléré
    
    /**
     * Démarrer automatiquement la simulation au chargement
     * - true : La simulation démarre immédiatement (bouton Play actif)
     * - false : La simulation démarre en pause (l'utilisateur doit cliquer sur Play)
     * 
     * Cette valeur est utilisée par UIFactory pour initialiser InputComponent.isPaused
     */
    autoStart: true
  },
  
  // === RENDU ===
  render: {
    cameraDistance: 25, // m
    cameraHeight: 10, // m
    cameraTarget: new THREE.Vector3(0, 5, 8), // Point visé
    meshSubdivision: 0 // Niveau de subdivision du mesh du kite (0-4)
  },
  
  // === DEBUG ===
  debug: {
    enabled: true,              // ✅ Activer le mode debug
    showForceVectors: true,     // Afficher les vecteurs de force
    showPhysicsInfo: false,     // Afficher les infos physiques
    logLevel: 'info'            // 'debug', 'info', 'warn', 'error'
  }
} as const;
