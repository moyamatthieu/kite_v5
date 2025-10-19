/**
 * ControlBarFactory.ts - Factory pour créer la barre de contrôle
 * 
 * La barre contient les deux handles (points d'attache des lignes).
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import { TransformComponent, GeometryComponent, VisualComponent, PhysicsComponent } from '../components';

export class ControlBarFactory {
  /**
   * Crée l'entité barre de contrôle
   */
  static create(position: THREE.Vector3): Entity {
    const entity = new Entity('controlBar');
    
    // === TRANSFORM ===
    entity.addComponent(new TransformComponent({
      position: position.clone()
    }));
    
    // === GEOMETRY ===
    const geometry = new GeometryComponent();
    
    // Handles espacés de 65cm
    const handleSpacing = 0.65;
    geometry.setPoint('leftHandle', new THREE.Vector3(-handleSpacing / 2, 0, 0));
    geometry.setPoint('rightHandle', new THREE.Vector3(handleSpacing / 2, 0, 0));
    
    // Connexion entre les handles (la barre elle-même)
    geometry.addConnection('leftHandle', 'rightHandle');
    
    entity.addComponent(geometry);

    // === PHYSICS ===
    // La barre est maintenue par le pilote mais peut bouger légèrement
    // Masse réaliste d'une barre de contrôle : ~0.5kg
    entity.addComponent(new PhysicsComponent({
      mass: 0.5,
      isKinematic: false, // Dynamique : subit les forces des lignes
      linearDamping: 0.98, // Amortissement fort (pilote contrôle)
      angularDamping: 0.95
    }));

    // === VISUAL ===
    entity.addComponent(new VisualComponent({
      color: 0x8B4513, // Marron (SaddleBrown)
      opacity: 1.0
    }));

    return entity;
  }
}
