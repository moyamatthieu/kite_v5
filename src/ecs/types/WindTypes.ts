
/**
 * WindTypes.ts - Types pour le système de vent de la simulation Kite
 *
 * Rôle :
 *   - Définit la structure des paramètres de vent (vitesse, direction, turbulence)
 *   - Sert à typer les échanges entre le simulateur de vent et les autres modules
 *
 * Dépendances principales :
 *   - Aucun import direct, mais utilisé par WindSimulator et PhysicsEngine
 *
 * Relation avec les fichiers adjacents :
 *   - PhysicsTypes.ts : Définit les types pour la physique
 *   - Tous les modules physiques et de rendu importent WindTypes pour typer le vent
 *
 * Utilisation typique :
 *   - Utilisé dans WindSimulator, PhysicsEngine, DebugRenderer, etc.
 *   - Sert à garantir la cohérence des échanges de données de vent
 *
 * Voir aussi :
 *   - src/simulation/types/PhysicsTypes.ts
 */

export interface WindParams {
  speed: number; // km/h
  direction: number; // degrés
  turbulence: number; // pourcentage
}