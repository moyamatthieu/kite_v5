/**
 * BridleComponent.ts - Composant de configuration du bridage
 *
 * Contient la définition du système de bridage d'un cerf-volant :
 * - Longueurs des brides (nez, inter, centre)
 * - Connexions entre points
 * - Données pour le calcul de contraintes
 *
 * Architecture ECS pure : données séparées de la physique.
 */

import { Component } from '@base/Component';

/**
 * Longueurs physiques des brides (en mètres)
 */
export interface BridleLengths {
  nez: number;      // Longueur bride NEZ -> CTRL (avant)
  inter: number;    // Longueur bride INTER -> CTRL (latéral)
  centre: number;   // Longueur bride CENTRE -> CTRL (arrière)
}

/**
 * Connexion de bride reliant deux points
 */
export interface BridleConnection {
  from: string;     // Point de départ (ex: 'NEZ')
  to: string;       // Point d'arrivée (ex: 'CTRL_GAUCHE')
  length: number;   // Longueur de repos en mètres
  side: 'left' | 'right';  // Côté du kite
}

/**
 * Tensions des brides (pour visualisation)
 */
export interface BridleTensions {
  leftNez: number;
  leftInter: number;
  leftCentre: number;
  rightNez: number;
  rightInter: number;
  rightCentre: number;
}

/**
 * Composant de bridage
 */
export class BridleComponent implements Component {
  readonly type = 'bridle';

  /**
   * Longueurs des 3 types de brides
   */
  public lengths: BridleLengths;

  /**
   * Liste des 6 connexions de brides (3 gauche + 3 droite)
   */
  public connections: BridleConnection[];

  /**
   * Tensions actuelles (calculées par physique, utilisées pour rendu)
   */
  public tensions: BridleTensions;

  /**
   * Facteur de longueur virtuelle (pour ajustement dynamique)
   * 1.0 = normal, <1 = plus court (plus de tension), >1 = plus long
   */
  public lengthFactor: number;

  constructor(data: {
    lengths?: Partial<BridleLengths>;
    lengthFactor?: number;
  } = {}) {
    // Longueurs par défaut (CONFIG.bridle.defaultLengths)
    this.lengths = {
      nez: data.lengths?.nez ?? 0.65,
      inter: data.lengths?.inter ?? 0.65,
      centre: data.lengths?.centre ?? 0.65
    };

    this.lengthFactor = data.lengthFactor ?? 1.0;

    // Construire les 6 connexions
    this.connections = [
      // Brides gauches
      { from: 'NEZ', to: 'CTRL_GAUCHE', length: this.lengths.nez, side: 'left' },
      { from: 'INTER_GAUCHE', to: 'CTRL_GAUCHE', length: this.lengths.inter, side: 'left' },
      { from: 'CENTRE', to: 'CTRL_GAUCHE', length: this.lengths.centre, side: 'left' },
      // Brides droites
      { from: 'NEZ', to: 'CTRL_DROIT', length: this.lengths.nez, side: 'right' },
      { from: 'INTER_DROIT', to: 'CTRL_DROIT', length: this.lengths.inter, side: 'right' },
      { from: 'CENTRE', to: 'CTRL_DROIT', length: this.lengths.centre, side: 'right' }
    ];

    // Tensions initiales nulles
    this.tensions = {
      leftNez: 0,
      leftInter: 0,
      leftCentre: 0,
      rightNez: 0,
      rightInter: 0,
      rightCentre: 0
    };
  }

  /**
   * Met à jour les longueurs des brides
   */
  setBridleLengths(lengths: Partial<BridleLengths>): void {
    this.lengths = { ...this.lengths, ...lengths };

    // Mettre à jour les connexions
    this.connections.forEach(conn => {
      if (conn.from === 'NEZ') conn.length = this.lengths.nez;
      else if (conn.from === 'INTER_GAUCHE' || conn.from === 'INTER_DROIT') conn.length = this.lengths.inter;
      else if (conn.from === 'CENTRE') conn.length = this.lengths.centre;
    });
  }

  /**
   * Met à jour les tensions des brides (appelé par système physique)
   */
  setTensions(tensions: Partial<BridleTensions>): void {
    this.tensions = { ...this.tensions, ...tensions };
  }

  /**
   * Clone le composant
   */
  clone(): BridleComponent {
    const comp = new BridleComponent({
      lengths: { ...this.lengths },
      lengthFactor: this.lengthFactor
    });
    comp.tensions = { ...this.tensions };
    return comp;
  }
}
