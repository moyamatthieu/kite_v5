/**
 * ControlPointComponent.ts - Composant pour les points de contrôle du bridage
 *
 * Les points de contrôle (CTRL_GAUCHE, CTRL_DROIT) sont des particules libres
 * dans l'espace dont la position est déterminée UNIQUEMENT par :
 *   1. Les 3 brides depuis le kite (NEZ, INTER, CENTRE)
 *   2. La ligne de contrôle vers la poignée
 *
 * Ces points NE FONT PAS partie de la structure rigide du kite.
 * Leur position est résolue par quadrilatération (intersection de 4 sphères).
 */
import * as THREE from 'three';
import { Component } from '@base/Component';

/**
 * Référence vers les points d'attache des brides sur le kite
 */
export interface BridleAttachments {
  /** Point NEZ sur le kite */
  nez: string;
  /** Point INTER (INTER_GAUCHE ou INTER_DROIT) */
  inter: string;
  /** Point CENTRE sur le kite */
  centre: string;
}

/**
 * Configuration d'un point de contrôle
 */
export interface ControlPointConfig {
  /** Nom du côté (gauche ou droit) */
  side: 'left' | 'right';
  /** Points d'attache des brides sur le kite */
  attachments: BridleAttachments;
  /** Masse du point de contrôle (négligeable, typiquement ~0.001 kg) */
  mass: number;
}

/**
 * Composant pour un point de contrôle de bridage
 * 
 * Principe physique :
 * - Le point CTRL est une particule libre dans l'espace 3D
 * - Sa position est contrainte par 3 brides (distances fixes depuis le kite)
 * - Et par 1 ligne de contrôle (distance fixe vers la poignée)
 * - L'équilibre des tensions détermine sa position finale
 */
export class ControlPointComponent implements Component {
  readonly type = 'controlPoint';
  
  /** Configuration du point de contrôle */
  config: ControlPointConfig;
  
  /** Position actuelle dans l'espace monde (indépendante du kite) */
  position: THREE.Vector3;
  
  /** Vélocité actuelle */
  velocity: THREE.Vector3;
  
  /** Dernière position résolue (pour calcul de déplacement) */
  previousPosition: THREE.Vector3;

  constructor(config: ControlPointConfig, initialPosition?: THREE.Vector3) {
    this.config = config;
    this.position = initialPosition ? initialPosition.clone() : new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.previousPosition = this.position.clone();
  }

  /**
   * Met à jour la position depuis le résultat du solver
   */
  updatePosition(newPosition: THREE.Vector3): void {
    this.previousPosition.copy(this.position);
    this.position.copy(newPosition);
  }

  /**
   * Calcule la vélocité depuis le déplacement
   */
  updateVelocity(deltaTime: number): void {
    if (deltaTime > 0) {
      this.velocity.copy(this.position)
        .sub(this.previousPosition)
        .divideScalar(deltaTime);
    }
  }

  /**
   * Réinitialise le point de contrôle
   */
  reset(position?: THREE.Vector3): void {
    if (position) {
      this.position.copy(position);
      this.previousPosition.copy(position);
    }
    this.velocity.set(0, 0, 0);
  }
}
