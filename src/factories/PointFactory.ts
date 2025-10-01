/**
 * PointFactory.ts - Encapsule la logique de calcul des points anatomiques
 *
 * Responsabilité : Calculer les positions des points d'un cerf-volant delta
 */

export interface KiteParams {
  width: number;   // Envergure
  height: number;  // Hauteur
  depth: number;   // Profondeur whiskers
}

/**
 * Factory simple qui encapsule la logique de calcul des points
 */
export class PointFactory {
  /**
   * Calcule toutes les positions des points anatomiques d'un cerf-volant delta
   */
  static calculateDeltaKitePoints(params: KiteParams): Map<string, [number, number, number]> {
    const { width, height, depth } = params;

    // Logique métier extraite de Kite.ts
    const centreY = height / 4;
    const ratio = (height - centreY) / height;
    const interGaucheX = ratio * (-width / 2);
    const interDroitX = ratio * (width / 2);
    const fixRatio = 2 / 3;

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

      // Points de contrôle (bridage)
      ["CTRL_GAUCHE", [-width * 0.15, height * 0.4, 0.4]],
      ["CTRL_DROIT", [width * 0.15, height * 0.4, 0.4]],

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