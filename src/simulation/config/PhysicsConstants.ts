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
  static readonly EPSILON = 1e-4; // Un tout petit nombre pour dire "presque zéro"
  static readonly CONTROL_DEADZONE = 0.01; // La barre ne réagit pas si vous la bougez très peu
  static readonly LINE_CONSTRAINT_TOLERANCE = 0.0005; // Les lignes peuvent s'étirer de 5mm max (marge d'erreur)
  static readonly LINE_TENSION_FACTOR = 0.99; // Les lignes restent un peu plus courtes pour rester tendues
  static readonly GROUND_FRICTION = 0.95; // Le sol freine le kite de 5% s'il le touche
  static readonly CATENARY_SEGMENTS = 5; // Nombre de points pour dessiner la courbe des lignes

  // Limites de sécurité - pour que la simulation ne devienne pas folle
  static readonly MAX_FORCE = 1000; // Force max en Newtons (comme soulever 100kg)
  static readonly MAX_VELOCITY = 30; // Vitesse max : 30 m/s = 108 km/h
  static readonly MAX_ANGULAR_VELOCITY = 25; // Rotation max : presque 1 tour par seconde
  // CORRECTION AUDIT #13 : MAX_ACCELERATION augmenté de 100 à 500 m/s²
  // Calcul cohérent : a_max = F_max/m = 1000N / 0.31kg ≈ 3226 m/s²
  // Limite à 500 pour sécurité numérique tout en permettant forces réalistes
  // Ancienne valeur (100) bridait les forces à seulement 31N (3% du max!)
  static readonly MAX_ACCELERATION = 500; // m/s² - Cohérent avec MAX_FORCE et masse kite
  static readonly MAX_ANGULAR_ACCELERATION = 20; // La rotation ne peut pas s'emballer
}