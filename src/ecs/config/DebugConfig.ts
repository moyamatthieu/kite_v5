/**
 * DebugConfig.ts - Configuration du système de débogage
 *
 * Paramètres pour la visualisation des forces, logging, et outils de debug.
 */

namespace DebugConfig {
  // === VISUALISATION DES FORCES ===

  /** Échelle pour les flèches de force (m/N) - Plus grand = flèches plus visibles */
  export const FORCE_ARROW_SCALE = 0.01;

  /** Échelle pour les flèches de vitesse (m/(m/s)) */
  export const VELOCITY_ARROW_SCALE = 0.1;

  /** Échelle pour les flèches de vent (m/(m/s)) */
  export const WIND_ARROW_SCALE = 0.05;

  /** Longueur minimale des flèches (m) - Évite les flèches trop petites */
  export const MIN_ARROW_LENGTH = 0.01;

  /** Couleur des flèches de force totale */
  export const FORCE_COLOR = 0xff0000; // Rouge

  /** Couleur des flèches de force aérodynamique */
  export const AERO_FORCE_COLOR = 0x00ff00; // Vert

  /** Couleur des flèches de force de gravité */
  export const GRAVITY_FORCE_COLOR = 0x0000ff; // Bleu

  /** Couleur des flèches de force de ligne */
  export const LINE_FORCE_COLOR = 0xffff00; // Jaune

  /** Couleur des flèches de vitesse */
  export const VELOCITY_COLOR = 0xff00ff; // Magenta

  /** Couleur des flèches de vent */
  export const WIND_COLOR = 0x00ffff; // Cyan

  // === LOGGING ===

  /** Intervalle minimum entre logs détaillés (ms) */
  export const LOG_THROTTLE_MS = 1000;

  /** Niveau de logging par défaut */
  export const DEFAULT_LOG_LEVEL = 'INFO';

  /** Activer le logging des forces détaillées */
  export const LOG_FORCES = true;

  /** Activer le logging des positions */
  export const LOG_POSITIONS = false;

  /** Activer le logging des vitesses */
  export const LOG_VELOCITIES = false;

  // === PERFORMANCE ===

  /** Fréquence de mise à jour des visualisations (Hz) */
  export const UPDATE_FREQUENCY_HZ = 10;

  /** Nombre maximum de flèches à afficher simultanément */
  export const MAX_ARROWS = 50;

  // === UI DEBUG ===

  /** Afficher les labels sur les flèches */
  export const SHOW_ARROW_LABELS = true;

  /** Taille des labels */
  export const LABEL_FONT_SIZE = 12;

  /** Couleur des labels */
  export const LABEL_COLOR = 0xffffff;
}

export { DebugConfig };