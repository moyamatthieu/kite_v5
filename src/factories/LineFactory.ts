/**
 * LineFactory.ts - Factory pour créer des lignes de cerf-volant (OOP pattern)
 *
 * Rôle :
 *   - Créer des objets Line selon le pattern Factory du projet
 *   - Valider les paramètres avant création
 *   - Fournir des presets pour configurations typiques
 *
 * Responsabilité :
 *   - Instanciation cohérente des objets Line
 *   - Application des valeurs par défaut
 *   - Validation des paramètres physiques
 *
 * Pattern :
 *   - Ne suit PAS BaseFactory<StructuredObject> car Line n'est pas un objet 3D
 *   - Factory simple avec méthodes statiques pour configurations communes
 *   - Séparation claire : Line (métier) vs LineVisual (3D)
 *
 * Relation avec les autres modules :
 *   - Crée des objets Line
 *   - Utilisé par LineSystem pour instancier les lignes
 *   - Indépendant de Three.js (pure TypeScript)
 *
 * Philosophie :
 *   - "Make invalid states unrepresentable" : Validation stricte
 *   - Presets pour cas d'usage communs
 *   - Immutabilité : Les lignes créées sont immutables (config readonly)
 *
 * Voir aussi :
 *   - src/objects/mechanical/Line.ts
 *   - src/base/BaseFactory.ts (pattern de référence)
 */

import { Line, LineConfig, LineAttachments } from '@objects/mechanical/Line';
import { CONFIG } from '@/simulation/config/SimulationConfig';

/**
 * Paramètres pour créer une ligne via factory
 */
export interface LineFactoryParams {
  /** Longueur au repos (m) - Défaut: CONFIG.lines.defaultLength */
  length?: number;

  /** Point d'attache sur le kite (ex: "CTRL_GAUCHE") */
  kitePoint: string;

  /** Point d'attache sur la barre (ex: "HANDLE_LEFT") */
  barPoint: string;

  /** Rigidité personnalisée (N/m) - Défaut: CONFIG.lines.stiffness */
  stiffness?: number;

  /** Pré-tension personnalisée (N) - Défaut: CONFIG.lines.preTension */
  preTension?: number;

  /** Tension max personnalisée (N) - Défaut: CONFIG.lines.maxTension */
  maxTension?: number;

  /** Damping personnalisé - Défaut: CONFIG.lines.dampingCoeff */
  dampingCoeff?: number;

  /** Masse linéique personnalisée (kg/m) - Défaut: CONFIG.lines.linearMassDensity */
  linearMassDensity?: number;

  /** Identifiant personnalisé (optionnel) */
  id?: string;
}

/**
 * Erreur de validation lors de la création d'une ligne
 */
export class LineValidationError extends Error {
  constructor(message: string, public field: string) {
    super(`LineFactory validation error [${field}]: ${message}`);
    this.name = 'LineValidationError';
  }
}

/**
 * Factory pour créer des lignes de cerf-volant
 *
 * @example
 * ```typescript
 * // Ligne standard avec paramètres par défaut
 * const leftLine = LineFactory.createLine({
 *   kitePoint: "CTRL_GAUCHE",
 *   barPoint: "HANDLE_LEFT"
 * });
 *
 * // Ligne personnalisée
 * const customLine = LineFactory.createLine({
 *   length: 20,
 *   stiffness: 1800,
 *   kitePoint: "CTRL_GAUCHE",
 *   barPoint: "HANDLE_LEFT"
 * });
 *
 * // Preset débutant
 * const beginnerLine = LineFactory.createBeginnerLine("CTRL_GAUCHE", "HANDLE_LEFT");
 * ```
 */
export class LineFactory {
  /**
   * Crée une ligne avec paramètres personnalisés
   *
   * @param params - Paramètres de configuration
   * @returns Instance de Line configurée
   * @throws LineValidationError si paramètres invalides
   */
  static createLine(params: LineFactoryParams): Line {
    // Valider les paramètres
    this.validateParams(params);

    // Configuration avec valeurs par défaut depuis SimulationConfig
    const config: LineConfig = {
      length: params.length ?? CONFIG.lines.defaultLength,
      stiffness: params.stiffness ?? CONFIG.lines.stiffness,
      preTension: params.preTension ?? CONFIG.lines.preTension,
      maxTension: params.maxTension ?? CONFIG.lines.maxTension,
      dampingCoeff: params.dampingCoeff ?? CONFIG.lines.dampingCoeff,
      linearMassDensity: params.linearMassDensity ?? CONFIG.lines.linearMassDensity
    };

    // Points d'attache
    const attachments: LineAttachments = {
      kitePoint: params.kitePoint,
      barPoint: params.barPoint
    };

    // Créer et retourner la ligne
    return new Line(config, attachments, params.id);
  }

  /**
   * Crée une paire de lignes gauche/droite standard
   *
   * @param length - Longueur commune (m)
   * @returns Tuple [ligne gauche, ligne droite]
   */
  static createLinePair(length?: number): [Line, Line] {
    const leftLine = this.createLine({
      length,
      kitePoint: "CTRL_GAUCHE",
      barPoint: "HANDLE_LEFT",
      id: "line_left"
    });

    const rightLine = this.createLine({
      length,
      kitePoint: "CTRL_DROIT",
      barPoint: "HANDLE_RIGHT",
      id: "line_right"
    });

    return [leftLine, rightLine];
  }

  /**
   * Preset : Ligne pour débutant
   * - Plus courte (12m)
   * - Moins rigide (1800 N/m)
   * - Pré-tension plus faible (50N)
   *
   * @param kitePoint - Point d'attache kite
   * @param barPoint - Point d'attache barre
   * @returns Ligne configurée pour débutant
   */
  static createBeginnerLine(kitePoint: string, barPoint: string): Line {
    return this.createLine({
      length: 12,
      stiffness: 1800,
      preTension: 50,
      maxTension: 600,
      dampingCoeff: 0.08, // Plus de damping = plus stable
      kitePoint,
      barPoint
    });
  }

  /**
   * Preset : Ligne pour expert
   * - Plus longue (20m)
   * - Rigidité standard (2200 N/m)
   * - Haute tension max (1000N)
   *
   * @param kitePoint - Point d'attache kite
   * @param barPoint - Point d'attache barre
   * @returns Ligne configurée pour expert
   */
  static createExpertLine(kitePoint: string, barPoint: string): Line {
    return this.createLine({
      length: 20,
      stiffness: 2200,
      preTension: 100,
      maxTension: 1000,
      dampingCoeff: 0.03, // Moins de damping = plus réactif
      kitePoint,
      barPoint
    });
  }

  /**
   * Preset : Ligne de sécurité (ultra-résistante)
   * - Tension max très élevée (1500N)
   * - Rigidité renforcée (3000 N/m)
   *
   * @param kitePoint - Point d'attache kite
   * @param barPoint - Point d'attache barre
   * @returns Ligne de sécurité
   */
  static createSafetyLine(kitePoint: string, barPoint: string): Line {
    return this.createLine({
      length: 15,
      stiffness: 3000,
      preTension: 150,
      maxTension: 1500,
      dampingCoeff: 0.05,
      linearMassDensity: 0.001, // Plus lourde
      kitePoint,
      barPoint
    });
  }

  /**
   * Crée une ligne depuis JSON (désérialisation)
   *
   * @param json - Données JSON (depuis Line.toJSON())
   * @returns Instance de Line recréée
   */
  static fromJSON(json: any): Line {
    return Line.fromJSON(json);
  }

  /**
   * Valide les paramètres avant création
   *
   * @param params - Paramètres à valider
   * @throws LineValidationError si invalide
   */
  private static validateParams(params: LineFactoryParams): void {
    // Points d'attache obligatoires
    if (!params.kitePoint || params.kitePoint.trim() === '') {
      throw new LineValidationError('Kite attachment point is required', 'kitePoint');
    }

    if (!params.barPoint || params.barPoint.trim() === '') {
      throw new LineValidationError('Bar attachment point is required', 'barPoint');
    }

    // Longueur positive
    if (params.length !== undefined && params.length <= 0) {
      throw new LineValidationError('Length must be positive', 'length');
    }

    // Rigidité positive
    if (params.stiffness !== undefined && params.stiffness <= 0) {
      throw new LineValidationError('Stiffness must be positive', 'stiffness');
    }

    // Pré-tension non-négative
    if (params.preTension !== undefined && params.preTension < 0) {
      throw new LineValidationError('PreTension cannot be negative', 'preTension');
    }

    // Tension max > pré-tension
    if (params.maxTension !== undefined && params.preTension !== undefined) {
      if (params.maxTension <= params.preTension) {
        throw new LineValidationError(
          'MaxTension must be greater than preTension',
          'maxTension'
        );
      }
    }

    // Damping dans [0, 1]
    if (params.dampingCoeff !== undefined) {
      if (params.dampingCoeff < 0 || params.dampingCoeff > 1) {
        throw new LineValidationError(
          'DampingCoeff must be between 0 and 1',
          'dampingCoeff'
        );
      }
    }

    // Masse linéique positive
    if (params.linearMassDensity !== undefined && params.linearMassDensity <= 0) {
      throw new LineValidationError(
        'LinearMassDensity must be positive',
        'linearMassDensity'
      );
    }
  }

  /**
   * Obtient les valeurs par défaut utilisées par la factory
   *
   * @returns Configuration par défaut
   */
  static getDefaultConfig(): LineConfig {
    return {
      length: CONFIG.lines.defaultLength,
      stiffness: CONFIG.lines.stiffness,
      preTension: CONFIG.lines.preTension,
      maxTension: CONFIG.lines.maxTension,
      dampingCoeff: CONFIG.lines.dampingCoeff,
      linearMassDensity: CONFIG.lines.linearMassDensity
    };
  }

  /**
   * Vérifie si deux lignes ont la même configuration physique
   *
   * @param line1 - Première ligne
   * @param line2 - Deuxième ligne
   * @returns true si configurations identiques
   */
  static areConfigsEqual(line1: Line, line2: Line): boolean {
    const c1 = line1.config;
    const c2 = line2.config;

    return (
      c1.length === c2.length &&
      c1.stiffness === c2.stiffness &&
      c1.preTension === c2.preTension &&
      c1.maxTension === c2.maxTension &&
      c1.dampingCoeff === c2.dampingCoeff &&
      c1.linearMassDensity === c2.linearMassDensity
    );
  }
}
