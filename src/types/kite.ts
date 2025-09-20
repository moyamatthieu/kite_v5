/**
 * Types pour le système de cerf-volant
 */
import * as THREE from 'three';

export interface KiteState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  orientation: THREE.Quaternion;
}

export interface HandlePositions {
  left: THREE.Vector3;
  right: THREE.Vector3;
}