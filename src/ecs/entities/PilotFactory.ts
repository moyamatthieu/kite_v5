/**
 * PilotFactory.ts - Factory pour créer le pilote
 * 
 * Crée un cube solide à l'origine (0, 0, 0) représentant le pilote.
 * Utilise un mesh Three.js pour un rendu simple et visible.
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import { TransformComponent, MeshComponent, PilotComponent } from '../components';

export class PilotFactory {
  /**
   * Crée l'entité pilote (cube solide à l'origine)
   */
  static create(): Entity {
    const entity = new Entity('pilot');
    
    // === DIMENSIONS ===
    const width = 0.5;   // Largeur (épaules)
    const height = 1.6;  // Hauteur (taille humaine)
    const depth = 0.3;   // Profondeur
    
    // === TRANSFORM ===
    // Positionné à l'origine avec les pieds au sol
    entity.addComponent(new TransformComponent({
      position: new THREE.Vector3(0, height / 2, 0), // Centre du cube à 0.8m du sol
      scale: new THREE.Vector3(1, 1, 1)
    }));
    
    // === MESH ===
    // Cube solide gris foncé représentant le pilote (1.6m de haut)
    const pilotGeometry = new THREE.BoxGeometry(width, height, depth);
    const pilotMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x4a4a4a, // Gris foncé
      roughness: 0.8,
      metalness: 0.2
    });
    const pilotMesh = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilotMesh.name = 'Pilot';
    pilotMesh.castShadow = true;
    pilotMesh.receiveShadow = false;
    
    entity.addComponent(new MeshComponent(pilotMesh));
    
    // === PILOT ===
    // Composant pour le retour haptique
    entity.addComponent(new PilotComponent());
    
    return entity;
  }
}
