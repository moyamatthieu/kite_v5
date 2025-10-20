/**
 * PhysicsComponent.ts - Dynamique (vélocité, forces, masse, inertie)
 * 
 * Contient toutes les données physiques d'un corps rigide.
 * Architecture ECS pure : données uniquement, pas de méthodes de manipulation.
 * Les opérations sur les forces sont dans PhysicsSystem.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';

export class PhysicsComponent extends Component {
  readonly type = 'physics';
  
  // Dynamique linéaire
  velocity: THREE.Vector3;
  mass: number;
  invMass: number; // 1 / mass (optimisation calculs)
  
  // Dynamique angulaire
  angularVelocity: THREE.Vector3;
  inertia: THREE.Matrix3;
  invInertia: THREE.Matrix3; // Inverse (optimisation calculs)
  
  // Accumulateurs de forces (réinitialisés chaque frame)
  forces: THREE.Vector3;
  torques: THREE.Vector3;
  
  // Forces par face (pour debug et application distribuée)
  faceForces: Array<{
    name: string;           // Nom de la face (ex: "leftUpper", "rightLower")
    centroid: THREE.Vector3;
    lift: THREE.Vector3;
    drag: THREE.Vector3;
    gravity: THREE.Vector3;
    apparentWind: THREE.Vector3;
    normal: THREE.Vector3;  // Normale de la face (pour debug visuel)
  }>;
  
  // Damping (friction)
  linearDamping: number;
  angularDamping: number;
  
  // Kinematic flag (si true, la physique ne s'applique pas)
  isKinematic: boolean;
  
  constructor(options: {
    mass?: number;
    velocity?: THREE.Vector3;
    angularVelocity?: THREE.Vector3;
    inertia?: THREE.Matrix3;
    linearDamping?: number;
    angularDamping?: number;
    isKinematic?: boolean;
  } = {}) {
    super();
    
    const DEFAULT_MASS = 1.0;
    const DEFAULT_INERTIA_SPHERE = 0.4;
    const DEFAULT_LINEAR_DAMPING = 0.99;
    const DEFAULT_ANGULAR_DAMPING = 0.98;
    
    this.mass = options.mass ?? DEFAULT_MASS;
    this.invMass = this.mass > 0 ? 1 / this.mass : 0;
    
    this.velocity = options.velocity?.clone() || new THREE.Vector3(0, 0, 0);
    this.angularVelocity = options.angularVelocity?.clone() || new THREE.Vector3(0, 0, 0);
    
    // Inertie par défaut (sphère de masse 1 et rayon 1)
    this.inertia = options.inertia?.clone() || new THREE.Matrix3().identity().multiplyScalar(DEFAULT_INERTIA_SPHERE);
    
    // Calculer l'inverse de l'inertie avec validation
    try {
      this.invInertia = this.inertia.clone().invert();
      // Vérifier si l'inversion a produit des NaN
      const e = this.invInertia.elements;
      if (e.some(v => !Number.isFinite(v))) {
        console.warn('[PhysicsComponent] Invalid invInertia, using identity');
        this.invInertia = new THREE.Matrix3().identity();
      }
    } catch (error) {
      console.warn('[PhysicsComponent] Failed to invert inertia matrix, using identity', error);
      this.invInertia = new THREE.Matrix3().identity();
    }
    
    this.forces = new THREE.Vector3(0, 0, 0);
    this.torques = new THREE.Vector3(0, 0, 0);
    
    // Initialiser les forces par face (pour le debug et application distribuée)
    this.faceForces = [];
    
    this.linearDamping = options.linearDamping ?? DEFAULT_LINEAR_DAMPING;
    this.angularDamping = options.angularDamping ?? DEFAULT_ANGULAR_DAMPING;
    
    // Objet cinématique (fixe) par défaut à false
    this.isKinematic = options.isKinematic ?? false;
  }
}
