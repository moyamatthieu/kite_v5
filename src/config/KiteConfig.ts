/**
 * Configuration pour le cerf-volant
 */
export const KITE_CONFIG = {
  mass: 0.3, // kg - masse d'un cerf-volant de taille moyenne
  inertia: 0.05, // kg⋅m² - moment d'inertie du cerf-volant
  minHeight: 0.1, // hauteur minimum au-dessus du sol
} as const;