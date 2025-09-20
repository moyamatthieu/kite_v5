/**
 * LinesConfig.ts - Configuration des lignes de contrôle
 */

export const LINES_CONFIG = {
  defaultLength: 15, // m - Longueur par défaut
  stiffness: 25000, // N/m - Rigidité renforcée pour mieux maintenir le kite
  maxTension: 1000, // N - Tension max augmentée pour éviter rupture
  maxSag: 0.008, // Affaissement réduit pour lignes plus tendues
  catenarySagFactor: 3, // Facteur de forme caténaire ajusté
};