/**
 * KiteComponent.ts - Propriétés spécifiques au cerf-volant delta
 * 
 * Données géométriques et aérodynamiques du kite.
 */

import { Component } from '../core/Component';

export class KiteComponent extends Component {
  readonly type = 'kite';
  
  /** Envergure (largeur) en mètres */
  wingspan: number;
  
  /** Corde (profondeur) en mètres */
  chord: number;
  
  /** Surface alaire en m² */
  surfaceArea: number;
  
  /** Allongement (aspect ratio) = wingspan² / surfaceArea */
  aspectRatio: number;
  
  constructor(options: {
    wingspan: number;
    chord: number;
    surfaceArea?: number;
  }) {
    super();
    this.wingspan = options.wingspan;
    this.chord = options.chord;
    
    // Calcul automatique de la surface si non fournie
    this.surfaceArea = options.surfaceArea ?? (this.wingspan * this.chord * 0.5);
    
    // Calcul allongement
    this.aspectRatio = (this.wingspan * this.wingspan) / this.surfaceArea;
  }
}
