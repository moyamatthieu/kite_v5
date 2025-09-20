/**
 * PhysicsConfig.ts - Configuration physique de la simulation
 */

export const PHYSICS_CONFIG = {
  physics: {
    fixedTimestep: 1 / 60, // Pas de temps fixe pour physique (60Hz, stabilité Euler)
    gravity: 9.81, // La gravité terrestre (fait tomber les objets)
    airDensity: 1.225, // Densité de l'air (l'air épais pousse plus fort)
    deltaTimeMax: 0.016, // Mise à jour max 60 fois par seconde (pour rester fluide)
    angularDamping: 0.85, // Amortissement angulaire équilibré
    linearDamping: 0.92, // Friction air réaliste (8% de perte par frame)
    angularDragCoeff: 0.1, // Résistance rotation augmentée pour moins d'oscillations
  },
  aero: {
    liftScale: 1.2, // Facteur de portance ajusté pour vol stable
    dragScale: 1.0, // Traînée naturelle
  },
};
