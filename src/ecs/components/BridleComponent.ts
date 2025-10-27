/**
 * BridleComponent.ts - Système de bridage du cerf-volant
 * 
 * Le kite a 6 brides au total :
 * - 3 brides gauches : NEZ → CTRL_GAUCHE, INTER_GAUCHE → CTRL_GAUCHE, CENTRE → CTRL_GAUCHE
 * - 3 brides droites : NEZ → CTRL_DROIT, INTER_DROIT → CTRL_DROIT, CENTRE → CTRL_DROIT
 * 
 * Les brides sont des segments droits rigides (contraintes géométriques).
 * 
 * ARCHITECTURE ECS PURE:
 * - Ce composant est DATA ONLY (pas de logique)
 * - Logique de calcul → BridleConstraintSystem
 * - Calcul de longueur moyenne → MathUtils
 */

import { Component } from '../core/Component';

/**
 * Longueurs des brides (mètres)
 */
export interface BridleLengths {
  nez: number;      // Bride avant (~0.75m)
  inter: number;    // Bride intermédiaire (~0.65m)
  centre: number;   // Bride centrale (~0.55m)
}

/**
 * Tensions dans les brides (Newtons)
 * Calculées par BridleConstraintSystem pour affichage/debug
 */
export interface BridleTensions {
  leftNez: number;
  leftInter: number;
  leftCentre: number;
  rightNez: number;
  rightInter: number;
  rightCentre: number;
}

export class BridleComponent extends Component {
  readonly type = 'bridle';
  
  /** Longueurs des brides */
  lengths: BridleLengths;
  
  /** Tensions actuelles (calculées par BridleConstraintSystem) */
  tensions: BridleTensions;
  
  constructor(lengths: BridleLengths) {
    super();
    this.lengths = { ...lengths };
    this.tensions = {
      leftNez: 0,
      leftInter: 0,
      leftCentre: 0,
      rightNez: 0,
      rightInter: 0,
      rightCentre: 0
    };
  }
}

/**
 * REMARQUE: getAverageLength() a été déplacé vers MathUtils.getAverageBridleLength()
 * pour respecter l'architecture ECS pure (Components = DATA ONLY)
 */
