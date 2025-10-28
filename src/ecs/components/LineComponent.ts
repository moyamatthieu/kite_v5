/**
 * LineComponent.ts - Propriétés d'une ligne de cerf-volant
 * 
 * MODÈLE PHYSIQUE : Position-Based Dynamics (PBD)
 * Les lignes sont des contraintes géométriques strictes qui maintiennent
 * une longueur constante (restLength). Pas de ressort, pas d'élasticité.
 */

import { Component } from '../core/Component';

export class LineComponent extends Component {
  readonly type = 'line';
  
  /** Longueur au repos de la ligne (mètres) - contrainte PBD */
  restLength: number;

  /** Longueur instantanée mesurée (mètres) */
  currentLength: number;
  
  /** Tension maximale admissible (N) */
  maxTension: number;
  
  /** Tension actuelle (N) - calculée par ConstraintSystem */
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
