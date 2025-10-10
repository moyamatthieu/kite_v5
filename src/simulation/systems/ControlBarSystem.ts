/**
 * ControlBarSystem.ts - Système ECS pour la gestion de la barre de contrôle
 *
 * Responsabilités :
 *   - Gère l'entité de la barre de contrôle (position, rotation, visuel)
 *   - Calcule l'orientation basée sur l'axe des lignes du kite
 *   - Met à jour la représentation 3D de la barre
 *
 * Architecture ECS :
 *   - Opère sur une ControlBarEntity avec TransformComponent et MeshComponent
 *   - Lecture des inputs depuis InputSystem
 *   - Lecture de la position du kite pour calculer l'orientation
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '../../base/BaseSimulationSystem';
import { Entity } from '../entities/Entity';
import { TransformComponent } from '../components/TransformComponent';
import { MeshComponent } from '../components/MeshComponent';
import { Kite } from '../../objects/Kite';
import { CONFIG } from '../config/SimulationConfig';
import { HandlePositions } from '../types';
import { Logger } from '../../utils/Logging';

export class ControlBarSystem extends BaseSimulationSystem {
  private logger: Logger;
  private controlBarEntity: Entity | null = null;
  private kite: Kite | null = null; // Référence temporaire jusqu'à migration complète du Kite en entité
  private rotation: number = 0;

  constructor() {
    super('ControlBarSystem', 5); // Priorité moyenne (après Input, avant Render)
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    this.logger.info('ControlBarSystem initialized', 'ControlBarSystem');
  }

  /**
   * Enregistre l'entité de la barre de contrôle
   */
  setControlBarEntity(entity: Entity): void {
    if (!entity.hasComponent('transform') || !entity.hasComponent('mesh')) {
      throw new Error('ControlBarEntity must have Transform and Mesh components');
    }
    this.controlBarEntity = entity;
  }

  /**
   * Définit la référence au kite (temporaire, sera remplacé par query ECS)
   */
  setKite(kite: Kite): void {
    this.kite = kite;
  }

  /**
   * Met à jour la rotation de la barre (appelé par l'input)
   */
  setRotation(rotation: number): void {
    this.rotation = rotation;
  }

  getRotation(): number {
    return this.rotation;
  }

  update(context: SimulationContext): void {
    if (!this.controlBarEntity || !this.kite) return;

    const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
    const mesh = this.controlBarEntity.getComponent<MeshComponent>('mesh');

    if (!transform || !mesh) return;

    // Calculer le quaternion de rotation basé sur l'axe du kite
    const quaternion = this.computeRotationQuaternion();
    if (quaternion) {
      transform.quaternion.copy(quaternion);

      // Synchroniser avec le mesh Three.js
      mesh.syncToObject3D({
        position: transform.position,
        quaternion: transform.quaternion,
        scale: transform.scale
      });
    }
  }

  /**
   * Calcule le quaternion de rotation de la barre basé sur l'axe des lignes
   */
  private computeRotationQuaternion(): THREE.Quaternion | null {
    if (!this.kite) return null;

    const ctrlLeft = this.kite.getPoint('CTRL_GAUCHE');
    const ctrlRight = this.kite.getPoint('CTRL_DROIT');

    if (!ctrlLeft || !ctrlRight) return null;

    const kiteLeftWorld = this.kite.toWorldCoordinates(ctrlLeft);
    const kiteRightWorld = this.kite.toWorldCoordinates(ctrlRight);

    // Axe naturel de la barre = axe entre les deux points de contrôle du kite
    const kiteAxis = new THREE.Vector3()
      .subVectors(kiteRightWorld, kiteLeftWorld)
      .normalize();

    // Direction initiale de la barre (axe X local)
    const barDirection = new THREE.Vector3(1, 0, 0);

    // Calculer la rotation nécessaire pour aligner la barre avec l'axe du kite
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      barDirection,
      kiteAxis
    );

    // Appliquer la rotation de l'input utilisateur autour de l'axe vertical (Y)
    const userRotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.rotation
    );

    // Combiner : rotation naturelle + rotation utilisateur
    return quaternion.multiply(userRotation);
  }

  /**
   * Obtient les positions des poignées (pour le rendu des lignes)
   */
  getHandlePositions(): HandlePositions | null {
    if (!this.controlBarEntity || !this.kite) return null;

    const ctrlLeft = this.kite.getPoint('CTRL_GAUCHE');
    const ctrlRight = this.kite.getPoint('CTRL_DROIT');

    if (!ctrlLeft || !ctrlRight) {
      // Fallback : orientation par défaut si points indisponibles
      const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
      if (!transform) return null;

      const halfWidth = CONFIG.controlBar.width / 2;
      return {
        left: transform.position.clone().add(new THREE.Vector3(-halfWidth, 0, 0)),
        right: transform.position.clone().add(new THREE.Vector3(halfWidth, 0, 0)),
      };
    }

    const kiteLeftWorld = this.kite.toWorldCoordinates(ctrlLeft);
    const kiteRightWorld = this.kite.toWorldCoordinates(ctrlRight);
    const rotationQuaternion = this.computeRotationQuaternion();

    if (!rotationQuaternion) return null;

    const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
    if (!transform) return null;

    const halfWidth = CONFIG.controlBar.width / 2;
    const handleLeftLocal = new THREE.Vector3(-halfWidth, 0, 0);
    const handleRightLocal = new THREE.Vector3(halfWidth, 0, 0);

    handleLeftLocal.applyQuaternion(rotationQuaternion);
    handleRightLocal.applyQuaternion(rotationQuaternion);

    return {
      left: handleLeftLocal.clone().add(transform.position),
      right: handleRightLocal.clone().add(transform.position),
    };
  }

  reset(): void {
    this.rotation = 0;

    if (this.controlBarEntity) {
      const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
      if (transform) {
        transform.position.copy(CONFIG.controlBar.position);
        transform.quaternion.identity();
      }
    }

    this.logger.info('ControlBarSystem reset', 'ControlBarSystem');
  }

  dispose(): void {
    this.controlBarEntity = null;
    this.kite = null;
    this.logger.info('ControlBarSystem disposed', 'ControlBarSystem');
  }
}
