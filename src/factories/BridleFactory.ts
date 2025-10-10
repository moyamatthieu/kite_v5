/**
 * BridleFactory.ts - Factory pour créer les instances Line représentant les brides
 *
 * Rôle :
 *   - Crée les 6 brides (3 gauches + 3 droites) comme instances de Line
 *   - Fournit une configuration physique spécifique aux brides (Dyneema courtes et rigides)
 *   - Centralise la création pour garantir cohérence et validation
 *
 * Architecture :
 *   - Réutilise la classe Line (même que lignes principales)
 *   - Config différente : plus rigides, plus courtes, moins élastiques
 *   - Pattern Factory comme LineFactory
 *
 * Relation avec les autres modules :
 *   - Utilise Line (src/objects/mechanical/Line.ts)
 *   - Utilisé par BridleSystem
 *   - Config basée sur BridleLengths (BridleTypes.ts)
 *
 * Voir aussi :
 *   - src/factories/LineFactory.ts (pattern similaire)
 *   - src/objects/mechanical/Line.ts
 *   - src/simulation/types/BridleTypes.ts
 */

import { BridleLengths, BridleAttachment, BridleSide, BridlePosition } from "../simulation/types/BridleTypes";

import { Line, LineConfig, LineAttachments } from "@/objects/Line";


/**
 * Factory pour créer les brides du cerf-volant
 *
 * Les brides sont des lignes courtes et rigides en Dyneema qui relient
 * les points anatomiques du kite (NEZ, INTER, CENTRE) aux points de contrôle (CTRL).
 */
export class BridleFactory {
  /**
   * Configuration physique standard pour les brides
   *
   * Les brides sont plus rigides et moins élastiques que les lignes principales :
   * - Plus courtes (0.5-0.7m vs 15m)
   * - Plus rigides (5000 N/m vs 2200 N/m)
   * - Moins d'amortissement (quasi-rigides)
   * - Très légères
   */
  private static readonly BRIDLE_CONFIG: Omit<LineConfig, 'length'> = {
    stiffness: 5000,           // N/m - Très rigides (Dyneema courte)
    preTension: 10,            // N - Pré-tension faible
    maxTension: 300,           // N - Résistance avant rupture
    dampingCoeff: 0.02,        // Sans dimension - Peu d'amortissement
    linearMassDensity: 0.0003, // kg/m - Très légères
  };

  /**
   * Mapping des positions vers les points anatomiques
   */
  private static readonly POINT_MAPPING = {
    left: {
      nez: { start: "NEZ", end: "CTRL_GAUCHE" },
      inter: { start: "INTER_GAUCHE", end: "CTRL_GAUCHE" },
      centre: { start: "CENTRE", end: "CTRL_GAUCHE" },
    },
    right: {
      nez: { start: "NEZ", end: "CTRL_DROIT" },
      inter: { start: "INTER_DROIT", end: "CTRL_DROIT" },
      centre: { start: "CENTRE", end: "CTRL_DROIT" },
    },
  } as const;

  /**
   * Crée une bride individuelle
   *
   * @param side - Côté (left/right)
   * @param position - Position (nez/inter/centre)
   * @param length - Longueur en mètres
   * @returns Instance Line configurée
   */
  static createBridle(
    side: BridleSide,
    position: BridlePosition,
    length: number
  ): Line {
    const points = this.POINT_MAPPING[side][position];
    const id = `bridle_${side}_${position}`;

    const config: LineConfig = {
      ...this.BRIDLE_CONFIG,
      length,
    };

    const attachments: LineAttachments = {
      kitePoint: points.start,
      barPoint: points.end,
    };

    return new Line(config, attachments, id);
  }

  /**
   * Crée les 3 brides du côté gauche
   *
   * @param lengths - Longueurs physiques des brides
   * @returns Tableau de 3 instances Line [nez, inter, centre]
   */
  static createLeftBridles(lengths: BridleLengths): [Line, Line, Line] {
    return [
      this.createBridle('left', 'nez', lengths.nez),
      this.createBridle('left', 'inter', lengths.inter),
      this.createBridle('left', 'centre', lengths.centre),
    ];
  }

  /**
   * Crée les 3 brides du côté droit
   *
   * @param lengths - Longueurs physiques des brides
   * @returns Tableau de 3 instances Line [nez, inter, centre]
   */
  static createRightBridles(lengths: BridleLengths): [Line, Line, Line] {
    return [
      this.createBridle('right', 'nez', lengths.nez),
      this.createBridle('right', 'inter', lengths.inter),
      this.createBridle('right', 'centre', lengths.centre),
    ];
  }

  /**
   * Crée toutes les 6 brides (gauches + droites)
   *
   * @param lengths - Longueurs physiques des brides
   * @returns Objet contenant les brides gauches et droites
   */
  static createAllBridles(lengths: BridleLengths): {
    left: [Line, Line, Line];
    right: [Line, Line, Line];
  } {
    return {
      left: this.createLeftBridles(lengths),
      right: this.createRightBridles(lengths),
    };
  }

  /**
   * Crée les métadonnées d'attache pour toutes les brides
   * (utilisé pour documentation/debug)
   *
   * @param lengths - Longueurs physiques des brides
   * @returns Tableau de 6 BridleAttachment
   */
  static createBridleAttachments(lengths: BridleLengths): BridleAttachment[] {
    const attachments: BridleAttachment[] = [];

    // Brides gauches
    Object.entries(this.POINT_MAPPING.left).forEach(([position, points]) => {
      attachments.push({
        startPoint: points.start,
        endPoint: points.end,
        length: lengths[position as BridlePosition],
        id: `bridle_left_${position}`,
      });
    });

    // Brides droites
    Object.entries(this.POINT_MAPPING.right).forEach(([position, points]) => {
      attachments.push({
        startPoint: points.start,
        endPoint: points.end,
        length: lengths[position as BridlePosition],
        id: `bridle_right_${position}`,
      });
    });

    return attachments;
  }

  /**
   * Valide les longueurs de brides
   *
   * @param lengths - Longueurs à valider
   * @throws Error si longueurs invalides
   */
  static validateBridleLengths(lengths: BridleLengths): void {
    const { nez, inter, centre } = lengths;

    // Vérifier valeurs positives
    if (nez <= 0 || inter <= 0 || centre <= 0) {
      throw new Error(
        `Longueurs de brides doivent être positives: nez=${nez}, inter=${inter}, centre=${centre}`
      );
    }

    // Vérifier plage raisonnable (0.2m à 1.5m)
    const min = 0.2;
    const max = 1.5;
    if (nez < min || nez > max || inter < min || inter > max || centre < min || centre > max) {
      throw new Error(
        `Longueurs de brides hors plage [${min}, ${max}]m: nez=${nez}, inter=${inter}, centre=${centre}`
      );
    }

    // Vérifier cohérence géométrique (bride nez généralement plus longue)
    if (nez < inter * 0.8 || nez < centre * 0.8) {
      console.warn(
        `⚠️ Bride NEZ plus courte que INTER/CENTRE peut causer instabilité: nez=${nez}, inter=${inter}, centre=${centre}`
      );
    }
  }

  /**
   * Obtient la configuration physique utilisée pour les brides
   * (utile pour debug/documentation)
   */
  static getBridleConfig(): Omit<LineConfig, 'length'> {
    return { ...this.BRIDLE_CONFIG };
  }
}
