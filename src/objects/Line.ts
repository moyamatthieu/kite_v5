/**
 * Line.ts - Entité métier représentant une ligne de cerf-volant
 *
 * Rôle :
 *   - Encapsule les propriétés physiques d'une ligne (Dyneema/Spectra)
 *   - Représente une ligne individuelle du système de pilotage
 *   - Pure data object, pas de logique de calcul
 *
 * Responsabilité :
 *   - Stocker les paramètres physiques (longueur, rigidité, tension)
 *   - Gérer les points d'attache (nom des points anatomiques)
 *   - Fournir un état cohérent pour les calculs physiques
 *
 * Relation avec les autres modules :
 *   - Utilisé par LinePhysics pour les calculs de force
 *   - Créé par LineFactory
 *   - Consommé par LineSystem (orchestration)
 *
 * Philosophie :
 *   - "Tell, don't ask" : La ligne expose son état, ne fait pas de calculs
 *   - Immutabilité partielle : Les paramètres physiques sont readonly
 *   - Single Responsibility : Représentation métier uniquement
 *
 * Voir aussi :
 *   - src/simulation/physics/LinePhysics.ts (calculs)
 *   - src/factories/LineFactory.ts (création)
 *   - src/objects/mechanical/LineVisual.ts (rendu)
 */


/**
 * Configuration physique d'une ligne de cerf-volant
 */
export interface LineConfig {
  /** Longueur au repos (mètres) */
  length: number;

  /** Rigidité axiale EA/L (N/m) - Typique Dyneema : 2200 N/m pour 15m */
  stiffness: number;

  /** Pré-tension minimale (N) - Toujours présente, même ligne molle */
  preTension: number;

  /** Tension maximale avant rupture (N) */
  maxTension: number;

  /** Coefficient d'amortissement interne (sans dimension, 0-1) */
  dampingCoeff: number;

  /** Masse linéique (kg/m) - Pour calcul caténaire */
  linearMassDensity: number;
}

/**
 * Points d'attache d'une ligne
 */
export interface LineAttachments {
  /** Nom du point d'attache sur le kite (ex: "CTRL_GAUCHE") */
  kitePoint: string;

  /** Nom du point d'attache sur la barre (ex: "HANDLE_LEFT") */
  barPoint: string;
}

/**
 * Entité représentant une ligne de cerf-volant
 *
 * @example
 * ```typescript
 * const leftLine = new Line({
 *   length: 15,
 *   stiffness: 2200,
 *   preTension: 75,
 *   maxTension: 800,
 *   dampingCoeff: 0.05,
 *   linearMassDensity: 0.0005
 * }, {
 *   kitePoint: "CTRL_GAUCHE",
 *   barPoint: "HANDLE_LEFT"
 * });
 * ```
 */
export class Line {
  /** Identifiant unique de la ligne */
  public readonly id: string;

  /** Configuration physique (immuable) */
  public readonly config: Readonly<LineConfig>;

  /** Points d'attache (immuables) */
  public readonly attachments: Readonly<LineAttachments>;

  /** État actuel de la ligne */
  private currentLength: number;
  private currentTension: number;

  /** Timestamp dernière mise à jour */
  private lastUpdateTime: number;

  constructor(
    config: LineConfig,
    attachments: LineAttachments,
    id?: string
  ) {
    this.id = id || `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.config = Object.freeze({ ...config });
    this.attachments = Object.freeze({ ...attachments });

    // État initial
    this.currentLength = config.length;
    this.currentTension = config.preTension;
    this.lastUpdateTime = 0;
  }

  /**
   * Met à jour l'état actuel de la ligne
   * (Appelé par LinePhysics après calcul)
   */
  updateState(length: number, tension: number, timestamp: number): void {
    this.currentLength = length;
    this.currentTension = tension;
    this.lastUpdateTime = timestamp;
  }

  /**
   * Obtient la longueur actuelle (étirée)
   */
  getCurrentLength(): number {
    return this.currentLength;
  }

  /**
   * Obtient la tension actuelle
   */
  getCurrentTension(): number {
    return this.currentTension;
  }

  /**
   * Calcule l'extension actuelle (Δx = L_current - L_rest)
   */
  getExtension(): number {
    return Math.max(0, this.currentLength - this.config.length);
  }

  /**
   * Vérifie si la ligne est tendue
   */
  isTaut(): boolean {
    return this.currentLength > this.config.length;
  }

  /**
   * Vérifie si la ligne est proche de la rupture
   */
  isNearBreaking(threshold: number = 0.9): boolean {
    return this.currentTension >= this.config.maxTension * threshold;
  }

  /**
   * Obtient le timestamp de dernière mise à jour
   */
  getLastUpdateTime(): number {
    return this.lastUpdateTime;
  }

  /**
   * Clone cette ligne avec une nouvelle configuration
   */
  clone(newConfig?: Partial<LineConfig>): Line {
    return new Line(
      { ...this.config, ...newConfig },
      { ...this.attachments }
    );
  }

  /**
   * Représentation textuelle pour debug
   */
  toString(): string {
    return `Line[${this.id}](${this.attachments.kitePoint} → ${this.attachments.barPoint}) ` +
           `L=${this.currentLength.toFixed(3)}m T=${this.currentTension.toFixed(1)}N`;
  }

  /**
   * Export JSON pour sérialisation
   */
  toJSON(): object {
    return {
      id: this.id,
      config: this.config,
      attachments: this.attachments,
      state: {
        currentLength: this.currentLength,
        currentTension: this.currentTension,
        lastUpdateTime: this.lastUpdateTime
      }
    };
  }

  /**
   * Crée une ligne depuis JSON
   */
  static fromJSON(data: any): Line {
    const line = new Line(data.config, data.attachments, data.id);
    if (data.state) {
      line.updateState(
        data.state.currentLength,
        data.state.currentTension,
        data.state.lastUpdateTime
      );
    }
    return line;
  }
}
