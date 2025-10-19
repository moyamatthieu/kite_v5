/**
 * LineComponent.ts - Propriétés d'une ligne de cerf-volant
 * 
 * Ligne = segment droit rigide avec élasticité simple (loi de Hooke).
 * Pas de caténaire, pas de masse linéaire, pas de damping complexe.
 */

import { Component } from '../core/Component';

export class LineComponent extends Component {
  readonly type = 'line';
  
  /** Longueur maximale (et de repos) de la ligne (mètres) */
  restLength: number;

  /** Longueur instantanée mesurée (mètres) */
  currentLength: number;
  
  /** Rigidité (N/m) - loi de Hooke : F = k × Δx */
  stiffness: number;

  /** Amortissement visqueux (N·s/m) */
  damping: number;
  
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
    stiffness?: number;
    damping?: number;
    maxTension?: number;
  }) {
    super();
    this.restLength = options.length;
    this.currentLength = options.length;
    this.stiffness = options.stiffness ?? 500; // 500 N/m par défaut
    this.damping = options.damping ?? 25; // Amortissement standard
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
