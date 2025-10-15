/**
 * PilotSystem.ts - Système ECS pour la gestion du pilote
 *
 * Responsabilités :
 *   - Gère l'entité du pilote (position, rotation, visuel)
 *   - Met à jour la position du pilote relative à la barre de contrôle
 *
 * Architecture ECS :
 *   - Opère sur une PilotEntity avec TransformComponent et MeshComponent
 *   - Met à jour la position basée sur la position de la barre de contrôle
 */

import * as THREE from "three";
import { BaseSimulationSystem, SimulationContext } from '@ecs/base/BaseSimulationSystem';
import { Entity } from '@base/Entity';
import { TransformComponent } from '@ecs/components/TransformComponent';
import { MeshComponent } from '@ecs/components/MeshComponent';
import { Logger } from '@ecs/utils/Logging';

export class PilotSystem extends BaseSimulationSystem {
  private logger: Logger;
  private pilotEntity: Entity | null = null;
  private controlBarPosition: THREE.Vector3 = new THREE.Vector3();

  constructor() {
    super('PilotSystem', 6); // Priorité après ControlBarSystem
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    this.logger.info("PilotSystem initialized", "PilotSystem");
    
    // Synchroniser la position initiale du pilote avec le mesh Three.js
    if (this.pilotEntity) {
      const transform = this.pilotEntity.getComponent<TransformComponent>('transform');
      const mesh = this.pilotEntity.getComponent<MeshComponent>('mesh');

      if (mesh && transform) {
        this.logger.debug(`  Syncing pilot position: (${transform.position.x}, ${transform.position.y}, ${transform.position.z})`, "PilotSystem");
        mesh.syncToObject3D({
          position: transform.position,
          quaternion: transform.quaternion,
          scale: transform.scale
        });
      }
    }

    this.logger.info('PilotSystem initialized', 'PilotSystem');
  }

  reset(): void {
    this.controlBarPosition.set(0, 0, 0);
    this.logger.info('PilotSystem reset', 'PilotSystem');
  }

  dispose(): void {
    this.pilotEntity = null;
    this.logger.info('PilotSystem disposed', 'PilotSystem');
  }

  /**
   * Configure l'entité pilote
   */
  setPilotEntity(entity: Entity): void {
    this.pilotEntity = entity;
  }  /**
   * Met à jour la position de référence de la barre de contrôle
   */
  setControlBarPosition(position: THREE.Vector3): void {
    this.controlBarPosition.copy(position);
  }

  update(_context: SimulationContext): void {
    if (!this.pilotEntity) return;

    // Le pilote reste à (0, 0, 0) - pas besoin de mise à jour
    // La position du pilote ne change jamais dans le système de coordonnées monde

    // Synchroniser avec le mesh Three.js (pour les autres transformations éventuelles)
    const transform = this.pilotEntity.getComponent<TransformComponent>('transform');
    const mesh = this.pilotEntity.getComponent<MeshComponent>('mesh');

    // Synchroniser avec le mesh Three.js si transform est défini
    if (transform && mesh) {
      mesh.syncToObject3D({
        position: transform.position,
        quaternion: transform.quaternion,
        scale: transform.scale
      });
    }
  }
}