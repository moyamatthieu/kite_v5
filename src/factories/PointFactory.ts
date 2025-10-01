/**
 * PointFactory.ts - Encapsule la logique de calcul des points anatomiques
 *
 * Responsabilité : Calculer les positions des points d'un cerf-volant delta
 */

export interface KiteParams {
  width: number;   // Envergure
  height: number;  // Hauteur
  depth: number;   // Profondeur whiskers
  bridleLength?: number;  // Facteur longueur bride NEZ->CTRL (1.0 = défaut, 0.5 = court, 1.5 = long)
}

/**
 * Factory simple qui encapsule la logique de calcul des points
 */
export class PointFactory {
  /**
   * Calcule toutes les positions des points anatomiques d'un cerf-volant delta
   */
  static calculateDeltaKitePoints(params: KiteParams): Map<string, [number, number, number]> {
    const { width, height, depth, bridleLength = 1.0 } = params;

    // Logique métier extraite de Kite.ts
    const centreY = height / 4;
    const ratio = (height - centreY) / height;
    const interGaucheX = ratio * (-width / 2);
    const interDroitX = ratio * (width / 2);
    const fixRatio = 2 / 3;

    // Points de contrôle ajustés selon bridleLength
    // Position par défaut: NEZ = (0, height, 0), offset vers l'arrière de 0.4m en Z
    // bridleLength modifie la distance NEZ->CTRL :
    // - 1.0 = position standard (0.4m derrière le NEZ)
    // - 0.5 = plus proche du NEZ (0.2m derrière)
    // - 1.5 = plus loin du NEZ (0.6m derrière)
    const ctrlOffsetZ = 0.4 * bridleLength;
    const ctrlY = height * 0.4; // Y reste constant

    // Retourner la Map exactement comme dans le code original
    return new Map<string, [number, number, number]>([
      // Points structurels principaux
      ["SPINE_BAS", [0, 0, 0]],
      ["CENTRE", [0, height / 4, 0]],
      ["NEZ", [0, height, 0]],

      // Points des bords d'attaque
      ["BORD_GAUCHE", [-width / 2, 0, 0]],
      ["BORD_DROIT", [width / 2, 0, 0]],

      // Points d'intersection pour le spreader
      ["INTER_GAUCHE", [interGaucheX, centreY, 0]],
      ["INTER_DROIT", [interDroitX, centreY, 0]],

      // Points de fixation whiskers
      ["FIX_GAUCHE", [fixRatio * interGaucheX, centreY, 0]],
      ["FIX_DROIT", [fixRatio * interDroitX, centreY, 0]],

      // Points des whiskers
      ["WHISKER_GAUCHE", [-width / 4, 0.1, -depth]],
      ["WHISKER_DROIT", [width / 4, 0.1, -depth]],

      // Points de contrôle (bridage) - AJUSTABLES
      ["CTRL_GAUCHE", [-width * 0.15, ctrlY, ctrlOffsetZ]],
      ["CTRL_DROIT", [width * 0.15, ctrlY, ctrlOffsetZ]],

      // Points d'ancrage des brides
      ["BRIDE_GAUCHE_A", [0, height, 0]],
      ["BRIDE_GAUCHE_B", [interGaucheX, centreY, 0]],
      ["BRIDE_GAUCHE_C", [0, height / 4, 0]],
      ["BRIDE_DROITE_A", [0, height, 0]],
      ["BRIDE_DROITE_B", [interDroitX, centreY, 0]],
      ["BRIDE_DROITE_C", [0, height / 4, 0]],
    ]);
  }
}