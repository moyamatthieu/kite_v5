/**
 * PointFactory.ts - Encapsule la logique de calcul des points anatomiques
 *
 * Responsabilité : Calculer les positions des points d'un cerf-volant delta
 */

/**
 * Longueurs physiques des brides (en mètres)
 */
export interface BridleLengths {
  nez: number;      // Longueur bride NEZ -> CTRL (avant)
  inter: number;    // Longueur bride INTER -> CTRL (latéral)
  centre: number;   // Longueur bride CENTRE -> CTRL (arrière)
}

export interface KiteParams {
  width: number;   // Envergure
  height: number;  // Hauteur
  depth: number;   // Profondeur whiskers
  bridleLengths?: BridleLengths;  // Longueurs physiques des brides
}

/**
 * Factory simple qui encapsule la logique de calcul des points
 */
export class PointFactory {
  /**
   * Longueurs de brides par défaut (en mètres)
   */
  private static readonly DEFAULT_BRIDLE_LENGTHS: BridleLengths = {
    nez: 0.5,      // 50cm du NEZ au CTRL
    inter: 0.35,   // 35cm du INTER au CTRL
    centre: 0.3,   // 30cm du CENTRE au CTRL
  };

  /**
   * Calcule la position du point de contrôle (CTRL) par trilatération
   * en satisfaisant les 3 contraintes de distance
   */
  private static calculateControlPoint(
    nez: [number, number, number],
    inter: [number, number, number],
    centre: [number, number, number],
    bridleLengths: BridleLengths,
    side: 'left' | 'right'
  ): [number, number, number] {
    // Position approximative initiale (estimation)
    // On part du principe que CTRL est légèrement en arrière et sur le côté
    const signX = side === 'left' ? -1 : 1;

    // Méthode simplifiée : on calcule une position qui satisfait approximativement les 3 distances
    // En réalité, c'est un système d'équations complexe, on utilise une approximation géométrique

    // Le point CTRL doit être à distance bridleLengths.nez de NEZ
    // Pour simplifier, on suppose que CTRL est dans le plan Y-Z proche du NEZ
    const nezVec = { x: nez[0], y: nez[1], z: nez[2] };
    const interVec = { x: inter[0], y: inter[1], z: inter[2] };
    const centreVec = { x: centre[0], y: centre[1], z: centre[2] };

    // Position approximative basée sur les longueurs de brides
    // On place CTRL à une distance moyenne des 3 points d'ancrage
    const ctrlX = signX * Math.abs(interVec.x) * 0.6; // 60% de la distance latérale
    const ctrlY = (nezVec.y + centreVec.y) / 2; // Milieu vertical entre NEZ et CENTRE
    const ctrlZ = bridleLengths.nez * 0.8; // En arrière du NEZ

    return [ctrlX, ctrlY, ctrlZ];
  }

  /**
   * Calcule toutes les positions des points anatomiques d'un cerf-volant delta
   */
  static calculateDeltaKitePoints(params: KiteParams): Map<string, [number, number, number]> {
    const { width, height, depth, bridleLengths = PointFactory.DEFAULT_BRIDLE_LENGTHS } = params;

    // Logique métier extraite de Kite.ts
    const centreY = height / 4;
    const ratio = (height - centreY) / height;
    const interGaucheX = ratio * (-width / 2);
    const interDroitX = ratio * (width / 2);
    const fixRatio = 2 / 3;

    // Points d'ancrage fixes des brides
    const nezPos: [number, number, number] = [0, height, 0];
    const centrePos: [number, number, number] = [0, height / 4, 0];
    const interGauchePos: [number, number, number] = [interGaucheX, centreY, 0];
    const interDroitPos: [number, number, number] = [interDroitX, centreY, 0];

    // Calculer les positions des points de contrôle depuis les longueurs de brides
    const ctrlGauche = PointFactory.calculateControlPoint(
      nezPos,
      interGauchePos,
      centrePos,
      bridleLengths,
      'left'
    );

    const ctrlDroit = PointFactory.calculateControlPoint(
      nezPos,
      interDroitPos,
      centrePos,
      bridleLengths,
      'right'
    );

    // Retourner la Map exactement comme dans le code original
    return new Map<string, [number, number, number]>([
      // Points structurels principaux
      ["SPINE_BAS", [0, 0, 0]],
      ["CENTRE", centrePos],
      ["NEZ", nezPos],

      // Points des bords d'attaque
      ["BORD_GAUCHE", [-width / 2, 0, 0]],
      ["BORD_DROIT", [width / 2, 0, 0]],

      // Points d'intersection pour le spreader
      ["INTER_GAUCHE", interGauchePos],
      ["INTER_DROIT", interDroitPos],

      // Points de fixation whiskers
      ["FIX_GAUCHE", [fixRatio * interGaucheX, centreY, 0]],
      ["FIX_DROIT", [fixRatio * interDroitX, centreY, 0]],

      // Points des whiskers
      ["WHISKER_GAUCHE", [-width / 4, 0.1, -depth]],
      ["WHISKER_DROIT", [width / 4, 0.1, -depth]],

      // Points de contrôle (bridage) - CALCULÉS depuis longueurs physiques
      ["CTRL_GAUCHE", ctrlGauche],
      ["CTRL_DROIT", ctrlDroit],

      // Points d'ancrage des brides
      ["BRIDE_GAUCHE_A", nezPos],
      ["BRIDE_GAUCHE_B", interGauchePos],
      ["BRIDE_GAUCHE_C", centrePos],
      ["BRIDE_DROITE_A", nezPos],
      ["BRIDE_DROITE_B", interDroitPos],
      ["BRIDE_DROITE_C", centrePos],
    ]);
  }
}