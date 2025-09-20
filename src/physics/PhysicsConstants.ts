/**
 * PhysicsC  // Limites de sécurité - pour que la simulation ne devienne pas folle
  static readonly MAX_FORCE = 1000; // Force max en Newtons (comme soulever 100kg)
  static readonly MAX_VELOCITY = 30; // Vitesse max : 30 m/s = 108 km/h
  static readonly MAX_ACCELERATION = 100; // Le kite ne peut pas accélérer plus vite qu'une voiture de sport
  static readonly MAX_ANGULAR_ACCELERATION = 20; // La rotation ne peut pas s'emballerts.ts - Constantes physiques globales pour la simulation
 *
 * Les règles du jeu - comme les limites de vitesse sur la route
 * Ces nombres définissent ce qui est possible ou pas dans notre monde virtuel
 */

export class PhysicsConstants {
  static readonly EPSILON = 1e-4; // Un tout petit nombre pour dire "presque zéro"
  static readonly CONTROL_DEADZONE = 0.01; // La barre ne réagit pas si vous la bougez très peu
  static readonly LINE_CONSTRAINT_TOLERANCE = 0.0005; // Les lignes peuvent s'étirer de 5mm max (marge d'erreur)
  static readonly LINE_TENSION_FACTOR = 0.99; // Les lignes restent un peu plus courtes pour rester tendues
  static readonly GROUND_FRICTION = 0.85; // Le sol freine le kite de 15% s'il le touche
  static readonly CATENARY_SEGMENTS = 5; // Nombre de points pour dessiner la courbe des lignes

  // Limites de sécurité - pour que la simulation ne devienne pas folle
  static readonly MAX_FORCE = 1000; // Force max en Newtons (comme soulever 100kg)
  static readonly MAX_VELOCITY = 30; // Vitesse max : 30 m/s = 108 km/h
  static readonly MAX_ANGULAR_VELOCITY = 425; // Rotation max : presque 1 tour par seconde
  static readonly MAX_ACCELERATION = 100; // Le kite ne peut pas accélérer plus vite qu'une voiture de sport
  static readonly MAX_ANGULAR_ACCELERATION = 20; // La rotation ne peut pas s'emballer
}

export const MAX_ANGULAR_VELOCITY = Math.PI * 4; // 720 deg/s maximum reasonable angular speed for stability
