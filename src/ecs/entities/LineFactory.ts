/**
 * LineFactory.ts - Factory pour créer les entités lignes
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import { LineComponent, GeometryComponent, VisualComponent, TransformComponent } from '../components';
import { CONFIG } from '../config/Config';

export class LineFactory {
  /**
   * Crée une entité ligne (gauche ou droite)
   */
  static create(side: 'left' | 'right'): Entity {
    const entity = new Entity(`${side}Line`);
    
    // === TRANSFORM (requis pour RenderSystem) ===
    // Position neutre car les lignes suivent leurs points start/end
    entity.addComponent(new TransformComponent({
      position: new THREE.Vector3(0, 0, 0)
    }));
    
    // === LINE COMPONENT ===
    // Les paramètres physiques (stiffness, damping) sont dans ConstraintConfig
    // et utilisés directement par LineSystem, pas stockés dans le composant
    entity.addComponent(new LineComponent({
      length: CONFIG.lines.length,
      maxTension: CONFIG.lines.maxTension
    }));
    
    // === GEOMETRY ===
    // Points seront mis à jour dynamiquement par un système
    const geometry = new GeometryComponent();
    geometry.setPoint('start', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('end', new THREE.Vector3(0, 0, 0));
    geometry.addConnection('start', 'end');
    entity.addComponent(geometry);
    
    // === VISUAL ===
    entity.addComponent(new VisualComponent({
      color: side === 'left' ? 0xff0000 : 0x00ff00, // Rouge gauche, vert droite
      opacity: 1.0
    }));
    
    return entity;
  }
}

