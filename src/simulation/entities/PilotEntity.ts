/**
 * PilotEntity.ts - Entité ECS pour le pilote
 *
 * Représente le pilote dans la simulation ECS.
 * Contient les composants Transform et Mesh pour le rendu 3D.
 */

import * as THREE from 'three';

import { CONFIG } from '../config/SimulationConfig';
import { TransformComponent } from '../components/TransformComponent';
import { MeshComponent } from '../components/MeshComponent';

import { Entity } from './Entity';

export class PilotEntity extends Entity {
  constructor() {
    super('pilot');

    // Créer la géométrie du pilote
    const pilotGeometry = new THREE.BoxGeometry(
      CONFIG.pilot.width,
      CONFIG.pilot.height,
      CONFIG.pilot.depth
    );
    const pilotMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.8
    });

    const pilotMesh = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilotMesh.name = 'Pilot';
    pilotMesh.castShadow = true;

    // Ajouter le composant Transform
    // Position initiale à (0, 0, 0) - sera mise à jour par PilotSystem
    const transform = new TransformComponent({
      position: new THREE.Vector3(0, 0, 0),
      rotation: 0,
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1)
    });
    this.addComponent(transform);

    // Ajouter le composant Mesh
    const mesh = new MeshComponent(pilotMesh, {
      visible: true,
      castShadow: true,
      receiveShadow: false
    });
    this.addComponent(mesh);
  }

  /**
   * Met à jour la position du pilote (toujours à l'origine du système de coordonnées)
   */
  updatePosition(): void {
    const transform = this.getComponent<TransformComponent>('transform');
    if (transform) {
      // Pilote à l'origine du système de coordonnées
      transform.position.copy(CONFIG.pilot.position);
    }
  }
}