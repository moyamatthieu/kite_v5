/**
 * PhysicsConstants.ts - Constantes physiques globales pour la simulation Kite
 *
 * Rôle :
 *   - Définit les limites physiques, tolérances et facteurs de sécurité du monde virtuel
 *   - Sert à garantir la stabilité et la cohérence de la simulation
 *   - Utilisé pour éviter les comportements irréalistes ou dangereux
 *
 * Dépendances principales :
 *   - Aucun import direct, mais utilisé par tous les modules physiques et de configuration
 *
 * Relation avec les fichiers adjacents :
 *   - SimulationConfig.ts : Utilise PhysicsConstants pour fixer les limites
 *   - Tous les modules du projet importent PhysicsConstants pour les vérifications
 *
 * Utilisation typique :
 *   - Importé dans les modules de physique, de contrôle et de rendu
 *   - Sert à valider les valeurs et à limiter les extrêmes
 *
 * Voir aussi :
 *   - src/simulation/config/SimulationConfig.ts
 */
export class PhysicsConstants {
  // Tolérances numériques
  static readonly EPSILON = 1e-4; // Sans unité - Seuil pour "presque zéro" (comparaisons flottants)
  static readonly EPSILON_FINE = 1e-6; // Sans unité - Seuil fin pour calculs précis (LinePhysics)

  // Contrôles et contraintes
  static readonly CONTROL_DEADZONE = 0.01; // rad - Zone morte pour input barre de contrôle
  static readonly LINE_CONSTRAINT_TOLERANCE = 0.0005; // m - Tolérance contraintes lignes (0.5mm)
  static readonly LINE_TENSION_FACTOR = 0.99; // Sans unité - Facteur tension lignes (99% = légèrement tendues)
  static readonly CONSTRAINT_ITERATIONS = 16; // Sans unité - Itérations pour système 8 contraintes couplées
  // Note: 16 itérations = 2 par contrainte pour convergence robuste du système complet
  // Système couplé lignes+brides nécessite plus d'itérations que contraintes indépendantes
  static readonly CONSTRAINT_TOLERANCE = 0.25; // m - Tolérance d'erreur pour convergence PBD (25cm)
  static readonly CONSTRAINT_CLAMP = 0.3; // Sans unité - Facteur de clamping par défaut PBD (30%)
  static readonly CONSTRAINT_MAX_DISTANCE = 15.5; // m - Distance max kite-pilote (lignes 15m + brides 0.5m)

  // ✅ XPBD : Compliance-based constraints pour stabilité temporelle
  // Compliance = inverse de la raideur (1/stiffness)
  // Valeurs basées sur les propriétés matérielles réelles (Young's modulus)
  static readonly LINE_COMPLIANCE = 1e-7; // 1/(Pa*m) - Lignes très rigides (Dyneema ~130 GPa)
  static readonly BRIDLE_COMPLIANCE = 1e-7; // 1/(Pa*m) - Brides similaires aux lignes
  static readonly SPHERE_COMPLIANCE = 1e-8; // 1/(Pa*m) - Contrainte sphère très rigide (sécurité)
  static readonly XPBD_DAMPING = 0.01; // Sans unité - Amortissement XPBD (1% par frame)

  // Sol et friction
  static readonly GROUND_FRICTION = 0.95; // Sans unité - Facteur friction sol (5% perte vitesse)

  // Rendu caténaire
  static readonly CATENARY_SEGMENTS = 10; // Sans unité - Nombre segments pour courbe caténaire

  // Limites de sécurité physique (éviter explosions numériques)
  static readonly MAX_FORCE = 500; // N - Force maximale (équivalent ~50kg)
  static readonly MAX_VELOCITY = 30; // m/s - Vitesse maximale kite (108 km/h)
  static readonly MAX_ANGULAR_VELOCITY = 15; // rad/s - Limite élevée pour permettre convergence naturelle
  static readonly MAX_ACCELERATION = 50; // m/s² - Accélération maximale (~5G)
  static readonly MAX_ANGULAR_ACCELERATION = 5; // rad/s² - Accélération angulaire réaliste
  static readonly MAX_TORQUE = 20; // N·m - Garde-fou sur le couple (émergent)

  // Conversion
  static readonly KMH_TO_MS = 1 / 3.6;
  static readonly DEG_TO_RAD = Math.PI / 180;
  static readonly RAD_TO_DEG = 180 / Math.PI;
}