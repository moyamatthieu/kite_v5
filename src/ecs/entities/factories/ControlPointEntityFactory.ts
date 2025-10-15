/**
 * ControlPointEntityFactory.ts - Factory pour créer les entités de points de contrôle
 *
 * Les points CTRL_GAUCHE et CTRL_DROIT sont des particules libres, pas des points du kite.
 */
import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { TransformComponent } from '@components/TransformComponent';
import { PhysicsComponent } from '@components/PhysicsComponent';
import { ControlPointComponent, BridleAttachments } from '@components/ControlPointComponent';

export class ControlPointEntityFactory {
  /**
   * Crée une entité de point de contrôle (CTRL)
   * 
   * @param side - 'left' ou 'right'
   * @param initialPosition - Position initiale calculée par trilatération
   * @param attachments - Points d'attache des brides sur le kite
   * @returns Entity avec ControlPointComponent, TransformComponent, PhysicsComponent
   */
  static create(
    side: 'left' | 'right',
    initialPosition: THREE.Vector3,
    attachments: BridleAttachments
  ): Entity {
    const entityId = side === 'left' ? 'ctrl-left' : 'ctrl-right';
    const entity = new Entity(entityId);

    // Masse négligeable pour les points de contrôle (quasi-massless)
    const mass = 0.001; // kg - suffisant pour la simulation sans affecter la dynamique

    // ControlPointComponent : données spécifiques au point de contrôle
    entity.addComponent(new ControlPointComponent(
      {
        side,
        attachments,
        mass
      },
      initialPosition
    ));

    // TransformComponent : position dans l'espace monde
    entity.addComponent(new TransformComponent({
      position: initialPosition.clone(),
      quaternion: new THREE.Quaternion(), // Pas de rotation, c'est un point
      scale: new THREE.Vector3(1, 1, 1)
    }));

    // PhysicsComponent : vélocité et forces
    entity.addComponent(new PhysicsComponent({
      mass,
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3()
    }));

    return entity;
  }

  /**
   * Crée les deux entités de points de contrôle (gauche et droit)
   * 
   * @param ctrlLeftPosition - Position initiale CTRL_GAUCHE
   * @param ctrlRightPosition - Position initiale CTRL_DROIT
   * @returns { left: Entity, right: Entity }
   */
  static createPair(
    ctrlLeftPosition: THREE.Vector3,
    ctrlRightPosition: THREE.Vector3
  ): { left: Entity; right: Entity } {
    const attachmentsLeft: BridleAttachments = {
      nez: 'NEZ',
      inter: 'INTER_GAUCHE',
      centre: 'CENTRE'
    };

    const attachmentsRight: BridleAttachments = {
      nez: 'NEZ',
      inter: 'INTER_DROIT',
      centre: 'CENTRE'
    };

    return {
      left: this.create('left', ctrlLeftPosition, attachmentsLeft),
      right: this.create('right', ctrlRightPosition, attachmentsRight)
    };
  }
}
