/**
 * ControlBarFactory.ts - Factory pour créer la barre de contrôle
 * 
 * La barre contient les deux handles (points d'attache des lignes).
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import { TransformComponent, GeometryComponent, VisualComponent, PhysicsComponent } from '../components';
import { EnvironmentConfig } from '../config/Config';

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
    // ⚠️ INVERSÉ : Pour correspondre à la vue caméra (depuis la droite regardant vers gauche)
    // La caméra crée un effet miroir, donc on inverse les X pour que les noms correspondent à l'écran
    const handleSpacing = 0.65;
    geometry.setPoint('leftHandle', new THREE.Vector3(handleSpacing / 2, 0, 0));   // X = +0.325 (apparaît à GAUCHE à l'écran)
    geometry.setPoint('rightHandle', new THREE.Vector3(-handleSpacing / 2, 0, 0)); // X = -0.325 (apparaît à DROITE à l'écran)

    // Point pivot au centre de la barre (pour rotation et référence)
    geometry.setPoint('pivot', new THREE.Vector3(0, 0, 0));

    // Connexion entre les handles (la barre elle-même)
    geometry.addConnection('leftHandle', 'rightHandle');

    entity.addComponent(geometry);

    // === PHYSICS ===
    // La barre est maintenue par le pilote mais peut bouger légèrement
    // Masse réaliste d'une barre de contrôle : ~0.5kg
    // TEMPORAIRE: Cinématique pour tester les contraintes
    entity.addComponent(new PhysicsComponent({
      mass: 0.5,
      isKinematic: true, // ← FIXE pour tester (pilote tient fermement)
      linearDamping: EnvironmentConfig.LINEAR_DAMPING,
      angularDamping: EnvironmentConfig.ANGULAR_DAMPING
    }));

    // === VISUAL ===
    entity.addComponent(new VisualComponent({
      color: 0x8B4513, // Marron (SaddleBrown)
      opacity: 1.0
    }));

    return entity;
  }
}
