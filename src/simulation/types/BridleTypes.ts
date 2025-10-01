/**
 * BridleTypes.ts - Types et interfaces pour le système de bridage
 *
 * Définit les structures de données pour les brides du cerf-volant.
 * Les brides relient des points anatomiques du kite (NEZ, INTER, CENTRE)
 * aux points de contrôle (CTRL_GAUCHE, CTRL_DROIT).
 */

/**
 * Longueurs physiques des 3 types de brides
 * (identique pour gauche et droite)
 */
export interface BridleLengths {
  /** Longueur bride NEZ → CTRL (mètres) */
  nez: number;

  /** Longueur bride INTER → CTRL (mètres) */
  inter: number;

  /** Longueur bride CENTRE → CTRL (mètres) */
  centre: number;
}

/**
 * Tensions actuelles des 6 brides
 * (3 gauches + 3 droites)
 */
export interface BridleTensions {
  /** Tension bride NEZ gauche (Newtons) */
  leftNez: number;

  /** Tension bride INTER gauche (Newtons) */
  leftInter: number;

  /** Tension bride CENTRE gauche (Newtons) */
  leftCentre: number;

  /** Tension bride NEZ droite (Newtons) */
  rightNez: number;

  /** Tension bride INTER droite (Newtons) */
  rightInter: number;

  /** Tension bride CENTRE droite (Newtons) */
  rightCentre: number;
}

/**
 * Définition d'une attache de bride
 * (relie deux points anatomiques du kite)
 */
export interface BridleAttachment {
  /** Nom du point de départ (ex: "NEZ", "INTER_GAUCHE") */
  startPoint: string;

  /** Nom du point d'arrivée (ex: "CTRL_GAUCHE", "CTRL_DROIT") */
  endPoint: string;

  /** Longueur au repos (mètres) */
  length: number;

  /** Identifiant unique (ex: "bridle_left_nez") */
  id: string;
}

/**
 * Type des côtés du bridage
 */
export type BridleSide = 'left' | 'right';

/**
 * Type des positions de bride
 */
export type BridlePosition = 'nez' | 'inter' | 'centre';

/**
 * Configuration complète d'une bride (utilisé par BridleFactory)
 */
export interface BridleConfig {
  /** Côté de la bride */
  side: BridleSide;

  /** Position de la bride */
  position: BridlePosition;

  /** Longueur (mètres) */
  length: number;

  /** Identifiant unique */
  id: string;
}
