/**
 * PilotEntity.ts - Entité ECS pour le pilote
 *
 * Représente le pilote dans la simulation ECS.
 * Contient les composants Transform et Mesh pour le rendu 3D.
 */

import * as THREE from 'three';
import { CONFIG } from '@config/SimulationConfig';
import { Entity } from '@base/Entity';

import { TransformComponent } from '@components/TransformComponent';
import { MeshComponent } from '@components/MeshComponent';


export class PilotEntity extends Entity {
  constructor() {
    super('pilot');

    // Créer la géométrie du pilote
    const pilotGeometry = new THREE.BoxGeometry(
      CONFIG.pilot.width,
      CONFIG.pilot.height,
      CONFIG.pilot.depth
    );
    
    // Translater la géométrie vers le haut pour que l'origine soit aux pieds
    // Par défaut BoxGeometry est centrée, on la monte de height/2
    pilotGeometry.translate(0, CONFIG.pilot.height / 2, 0);
    
    const pilotMaterial = new THREE.MeshStandardMaterial({
      color: 0x2196F3, // Bleu (plus visible que le gris foncé)
      roughness: 0.7,
      metalness: 0.1
    });

    const pilotMesh = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilotMesh.name = 'Pilot';
    pilotMesh.castShadow = true;
    pilotMesh.receiveShadow = true;
    // Note: La position sera synchronisée depuis TransformComponent par PilotSystem

    // Position initiale : pieds au sol (Y=0)
    // Grâce à la translation de la géométrie, le mesh positionné à (0,0,0) aura ses pieds au sol
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

  hasComponent(componentName: string): boolean {
    return this.getComponent(componentName) !== undefined;
  }
}