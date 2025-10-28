/**
 * ControlPointEntityFactory.ts - Factory pour créer les entités de points de contrôle
 *
 * ARCHITECTURE PHYSIQUE CORRECTE :
 * Les points CTRL sont des NŒUDS GÉOMÉTRIQUES VIRTUELS (jonctions lignes/brides).
 * Dans la réalité, ils n'ont PAS de masse propre - ce sont simplement des points où
 * les forces se transmettent entre lignes et brides.
 * 
 * Position calculée géométriquement par trilatération (3 brides) + projection (ligne).
 * PAS de PhysicsComponent → invMass = 0 dans le solveur PBD (masse infinie).
 */
import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { TransformComponent } from '@components/TransformComponent';
import { ControlPointComponent, BridleAttachments } from '@components/ControlPointComponent';
import { BridleComponent } from '@components/BridleComponent';

import { PureConstraintSolver } from '@/ecs/systems/ConstraintSolver';

export class ControlPointEntityFactory {
  /**
   * Crée une entité de point de contrôle (CTRL) - POINT VIRTUEL SANS MASSE
   * 
   * @param side - 'left' ou 'right'
   * @param initialPosition - Position initiale calculée par trilatération
   * @param attachments - Points d'attache des brides sur le kite
   * @returns Entity avec ControlPointComponent + TransformComponent UNIQUEMENT
   * 
   * NOTE: PAS de PhysicsComponent ! Les CTRL sont des points géométriques virtuels.
   * Leur position est calculée par trilatération + projection, pas par dynamique.
   */
  static create(
    side: 'left' | 'right',
    initialPosition: THREE.Vector3,
    attachments: BridleAttachments
  ): Entity {
    const entityId = side === 'left' ? 'ctrl-left' : 'ctrl-right';
    const entity = new Entity(entityId);

    // ControlPointComponent : données spécifiques au point de contrôle
    entity.addComponent(new ControlPointComponent(
      {
        side,
        attachments,
        mass: 0.01 // ✅ PHASE 1.2 : Masse non-nulle pour bidirectionnalité (10g)
        // Permet au kite de "tirer" les CTRL via les brides et créer équilibre dynamique
        // Voir PLAN_STABILISATION_SIMULATION.md Phase 1.2
      },
      initialPosition
    ));

    // TransformComponent : position dans l'espace monde
    // C'est le SEUL composant physique nécessaire (position géométrique)
    entity.addComponent(new TransformComponent({
      position: initialPosition.clone(),
      quaternion: new THREE.Quaternion(), // Pas de rotation, c'est un point
      scale: new THREE.Vector3(1, 1, 1)
    }));

    // ✅ PAS de PhysicsComponent !
    // Les CTRL n'ont pas de vélocité/forces propres.
    // Leur position est déterminée UNIQUEMENT par géométrie (trilatération).

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

  /**
   * Calcule les positions initiales des points de contrôle à partir de la géométrie du kite
   * Utilise PureConstraintSolver.solveControlPointPosition qui respecte TOUTES les contraintes:
   * - 3 contraintes de bride (trilatération)
   * - 1 contrainte de ligne (projection sur sphère)
   *
   * @param kiteEntity - Entité kite avec GeometryComponent et BridleComponent
   * @param leftHandlePos - Position de la poignée gauche
   * @param rightHandlePos - Position de la poignée droite
   * @param lineLength - Longueur des lignes
   * @returns { left: Vector3, right: Vector3 } positions initiales des CTRL
   */
  static calculateInitialPositions(
    kiteEntity: Entity,
    leftHandlePos: THREE.Vector3,
    rightHandlePos: THREE.Vector3,
    lineLength: number
  ): { left: THREE.Vector3; right: THREE.Vector3 } {
    const bridle = kiteEntity.getComponent<BridleComponent>('bridle');

    if (!bridle) {
      throw new Error('Kite entity missing BridleComponent');
    }

    // Calculer CTRL_GAUCHE (respecte bridles + ligne)
    const ctrlGauche = PureConstraintSolver.solveControlPointPosition(
      kiteEntity,
      leftHandlePos,
      bridle.lengths,
      lineLength,
      {
        nez: 'NEZ',
        inter: 'INTER_GAUCHE',
        centre: 'CENTRE'
      }
    );

    // Calculer CTRL_DROIT (respecte bridles + ligne)
    const ctrlDroit = PureConstraintSolver.solveControlPointPosition(
      kiteEntity,
      rightHandlePos,
      bridle.lengths,
      lineLength,
      {
        nez: 'NEZ',
        inter: 'INTER_DROIT',
        centre: 'CENTRE'
      }
    );

    // Validation des positions calculées
    const distLeft = leftHandlePos.distanceTo(ctrlGauche);
    const distRight = rightHandlePos.distanceTo(ctrlDroit);
    const maxError = 0.1; // 10cm d'erreur max acceptable

    // Debug logs removed for cleaner production code - can be re-enabled if needed

    // Vérifier que les positions ne sont pas NaN ou infinies
    const isValid = (v: THREE.Vector3) =>
      !isNaN(v.x) && !isNaN(v.y) && !isNaN(v.z) &&
      isFinite(v.x) && isFinite(v.y) && isFinite(v.z);

    if (!isValid(ctrlGauche) || !isValid(ctrlDroit)) {
      throw new Error('Control point positions contain NaN or Infinity');
    }

    // Vérifier que les distances sont correctes (validation silencieuse)
    if (Math.abs(distLeft - lineLength) > maxError || Math.abs(distRight - lineLength) > maxError) {
      throw new Error(`Control point distance validation failed: left=${distLeft.toFixed(3)}m, right=${distRight.toFixed(3)}m, target=${lineLength}m`);
    }

    return {
      left: ctrlGauche,
      right: ctrlDroit
    };
  }
}
