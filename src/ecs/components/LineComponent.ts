/**
 * LineComponent.ts - Composant ECS pour les lignes de cerf-volant
 *
 * Contient les données physiques et géométriques d'une ligne.
 * Remplace l'objet Line dans l'architecture ECS pure.
 */

import * as THREE from 'three';
import { Component } from '@base/Component';

/**
 * Configuration physique d'une ligne
 */
export interface LineConfig {
  /** Longueur au repos (mètres) */
  length: number;
  /** Rigidité axiale EA/L (N/m) */
  stiffness: number;
  /** Pré-tension minimale (N) */
  preTension: number;
  /** Tension maximale avant rupture (N) */
  maxTension: number;
  /** Coefficient d'amortissement interne (sans dimension, 0-1) */
  dampingCoeff: number;
  /** Masse linéique (kg/m) */
  linearMass: number;
}

/**
 * Points d'attache d'une ligne
 */
export interface LineAttachments {
  /** Point d'attache au kite */
  kitePoint: string;
  /** Point d'attache au pilote/barre */
  pilotPoint: string;
}

/**
 * État dynamique d'une ligne
 */
export interface LineState {
  /** Tension actuelle (N) */
  currentTension: number;
  /** Élongation relative (dimensionless) */
  strain: number;
  /** Force appliquée (N) */
  appliedForce: THREE.Vector3;
  /** Vitesse d'élongation (m/s) */
  strainRate: number;
}

/**
 * Composant contenant les données d'une ligne de cerf-volant
 */
export class LineComponent implements Component {
  readonly type = 'line';

  // Configuration physique (modifiable pour ajustements dynamiques)
  public config: LineConfig;

  // Points d'attache
  public attachments: LineAttachments;

  // État dynamique
  public state: LineState;

  // Géométrie (pour rendu et calculs)
  public segments: THREE.Vector3[] = [];

  constructor(config: LineConfig, attachments: LineAttachments) {
    this.config = { ...config };
    this.attachments = { ...attachments };
    this.state = {
      currentTension: config.preTension,
      strain: 0,
      appliedForce: new THREE.Vector3(),
      strainRate: 0
    };
  }

  /**
   * Met à jour l'état dynamique de la ligne
   */
  updateState(tension: number, strain: number, force: THREE.Vector3, strainRate: number): void {
    this.state.currentTension = tension;
    this.state.strain = strain;
    this.state.appliedForce.copy(force);
    this.state.strainRate = strainRate;
  }

  /**
   * Vérifie si la ligne est rompue
   */
  isBroken(): boolean {
    return this.state.currentTension > this.config.maxTension;
  }

  /**
   * Calcule la longueur actuelle de la ligne
   */
  getCurrentLength(): number {
    return this.config.length * (1 + this.state.strain);
  }
}