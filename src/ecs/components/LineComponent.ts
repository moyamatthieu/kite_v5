/**
 * LineComponent.ts - Propriétés d'une ligne de cerf-volant
 * 
 * Stocke uniquement l'ÉTAT de la ligne (longueurs, tension).
 * Les paramètres physiques (stiffness, damping) sont dans ConstraintConfig
 * et utilisés directement par LineSystem.
 */

import { Component } from '../core/Component';

export class LineComponent extends Component {
  readonly type = 'line';
  
  /** Longueur maximale (et de repos) de la ligne (mètres) */
  restLength: number;

  /** Longueur instantanée mesurée (mètres) */
  currentLength: number;
  
  /** Tension maximale admissible (N) */
  maxTension: number;
  
  /** Tension actuelle (N) - calculée par LineSystem */
  currentTension: number;
  
  /** État de la ligne */
  state: {
    isTaut: boolean;      // Ligne tendue ou molle ?
    elongation: number;   // Élongation actuelle (m)
    strainRatio: number;  // Ratio élongation/longueur
    currentLength: number; // Longueur instantanée (m)
  };
  
  constructor(options: {
    length: number;
    maxTension?: number;
  }) {
    super();
    this.restLength = options.length;
    this.currentLength = options.length;
    this.maxTension = options.maxTension ?? 200; // 200 N max
    this.currentTension = 0;
    
    this.state = {
      isTaut: false,
      elongation: 0,
      strainRatio: 0,
      currentLength: options.length
    };
  }
}
