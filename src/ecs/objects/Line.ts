/**
 * Line.ts - Classe représentant une ligne physique de cerf-volant
 *
 * Objet métier pour les calculs physiques des lignes.
 */

import * as THREE from 'three';
import { LineConfig, LineAttachments, LineState } from '../components/LineComponent';

export class Line {
  public readonly id: string;
  public readonly config: LineConfig;
  public readonly attachments: LineAttachments;
  public state: LineState;

  // Géométrie pour les calculs
  public segments: THREE.Vector3[] = [];

  constructor(config: LineConfig, attachments: LineAttachments, id?: string) {
    this.id = id || `line_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
   * Met à jour l'état de la ligne
   */
  update(deltaTime: number): void {
    // Calculs physiques de la ligne
    // TODO: Implémenter la physique des lignes
  }

  /**
   * Applique une force à la ligne
   */
  applyForce(force: THREE.Vector3): void {
    this.state.appliedForce.copy(force);
  }

  /**
   * Calcule la tension actuelle
   */
  getTension(): number {
    return this.state.currentTension;
  }
}