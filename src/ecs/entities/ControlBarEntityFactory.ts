/**
 * ControlBarEntityFactory.ts - Factory pour créer l'entité ECS ControlBar
 *
 * Responsabilité unique : Construction de l'entité ControlBar avec sa géométrie Three.js
 * Réutilisable, testable, isolée de SimulationApp
 *
 * Pattern : Factory Method
 * Utilisation : Appelée depuis SimulationApp.createControlBarEntity()
 */

import * as THREE from 'three';

import { Entity } from '../Entity';
import { CONFIG } from '../config/SimulationConfig';

import { EntityBuilder } from './EntityBuilder';

/**
 * Paramètres pour créer une entité ControlBar
 */
export interface ControlBarFactoryParams {
  /** Position de la barre (par défaut : relative au pilote) */
  position?: THREE.Vector3;
  
  /** Objet parent pour attachement (généralement le pilote) */
  parentObject?: THREE.Object3D;
  
  /** Nom de l'entité (par défaut : 'controlBar') */
  name?: string;
}

/**
 * Factory pour créer l'entité ECS ControlBar avec géométrie complète
 *
 * @example
 * ```typescript
 * // Création simple
 * const controlBar = ControlBarEntityFactory.create();
 *
 * // Avec attachement au pilote
 * const controlBar = ControlBarEntityFactory.create({
 *   parentObject: pilotMesh.object3D
 * });
 * ```
 */
export class ControlBarEntityFactory {
  /**
   * Crée une entité ControlBar complète avec géométrie Three.js
   *
   * @param params - Paramètres de configuration
   * @returns Entité ECS ControlBar prête à l'emploi
   */
  static create(params: ControlBarFactoryParams = {}): Entity {
    // Créer la géométrie Three.js
    const controlBarGroup = this.createGeometry();
    
    // Position (par défaut : relative au pilote)
    const position = params.position || new THREE.Vector3(
      0, // Même X que le pilote
      CONFIG.controlBar.offsetY, // Au-dessus du pilote
      CONFIG.controlBar.offsetZ  // Devant le pilote
    );
    controlBarGroup.position.copy(position);
    
    // Attacher au parent si fourni
    if (params.parentObject) {
      params.parentObject.add(controlBarGroup);
    }
    
    // Créer l'entité avec Transform + Mesh (via EntityBuilder)
    return EntityBuilder.createWithMesh(
      params.name || 'controlBar',
      controlBarGroup,
      position
    );
  }
  
  /**
   * Crée la géométrie Three.js de la barre de contrôle
   * Isolée, testable, réutilisable
   *
   * @returns THREE.Group contenant la barre et les poignées
   */
  private static createGeometry(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'ControlBar';
    
    // Barre principale
    const bar = this.createBar();
    group.add(bar);
    
    // Poignées gauche et droite
    const { left, right } = this.createHandles();
    group.add(left, right);
    
    return group;
  }
  
  /**
   * Crée la barre principale (cylindre horizontal)
   *
   * @returns Mesh de la barre
   */
  private static createBar(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      CONFIG.controlBar.barRadius,
      CONFIG.controlBar.barRadius,
      CONFIG.controlBar.width
    );
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x333333, // Gris foncé
      metalness: 0.7,
      roughness: 0.3
    });
    
    const bar = new THREE.Mesh(geometry, material);
    
    // Rotation de 90° sur l'axe Z pour rendre le cylindre horizontal
    // Cette rotation est locale au mesh et ne sera pas affectée par les rotations du groupe
    bar.rotation.z = Math.PI / 2;
    bar.castShadow = true;
    
    return bar;
  }
  
  /**
   * Crée les poignées gauche et droite
   *
   * @returns Objet contenant les deux poignées
   */
  private static createHandles(): { left: THREE.Mesh; right: THREE.Mesh } {
    const geometry = new THREE.CylinderGeometry(
      CONFIG.controlBar.handleRadius,
      CONFIG.controlBar.handleRadius,
      CONFIG.controlBar.handleLength
    );
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Marron (bois)
      roughness: 0.6
    });
    
    const halfWidth = CONFIG.controlBar.width / 2;
    
    // Poignée gauche
    const left = new THREE.Mesh(geometry, material);
    left.position.set(-halfWidth, 0, 0);
    left.rotation.z = Math.PI / 2; // Même orientation que la barre (horizontal)
    left.castShadow = true;
    
    // Poignée droite
    const right = new THREE.Mesh(geometry, material);
    right.position.set(halfWidth, 0, 0);
    right.rotation.z = Math.PI / 2; // Même orientation que la barre (horizontal)
    right.castShadow = true;
    
    return { left, right };
  }
}
