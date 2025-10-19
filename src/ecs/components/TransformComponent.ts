/**
 * TransformComponent.ts - Position, rotation, échelle
 * 
 * Composant fondamental pour tout objet dans l'espace 3D.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';

export class TransformComponent extends Component {
  readonly type = 'transform';
  
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  
  constructor(options: {
    position?: THREE.Vector3;
    quaternion?: THREE.Quaternion;
    scale?: THREE.Vector3;
  } = {}) {
    super();
    this.position = options.position?.clone() || new THREE.Vector3(0, 0, 0);
    this.quaternion = options.quaternion?.clone() || new THREE.Quaternion();
    this.scale = options.scale?.clone() || new THREE.Vector3(1, 1, 1);
  }
  
  /**
   * Clone le composant
   */
  clone(): TransformComponent {
    return new TransformComponent({
      position: this.position.clone(),
      quaternion: this.quaternion.clone(),
      scale: this.scale.clone()
    });
  }
}
