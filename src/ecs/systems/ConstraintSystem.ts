/**
 * ConstraintSystem.ts - Gestion des contraintes passives (lignes de vol, sol)
 *
 * Modélise chaque ligne comme une liaison unilatérale :
 * - Pas de poussée (aucune force lorsque la ligne est détendue)
 * - Tension de type ressort + amortissement visqueux lorsque la longueur dépasse la longueur de repos
 * - Application de la force au point d'attache du kite (génère un couple via bras de levier)
 *
 * Une correction simple évite la pénétration du sol (y >= 0).
 * Priorité 40 (AVANT PhysicsSystem 50, APRÈS AeroSystem 30).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { LineComponent } from '../components/LineComponent';
import type { Entity } from '../core/Entity';
import { GeometryComponent } from '../components/GeometryComponent';

// Constantes de contraintes
const GROUND_Y = 0;
const EPSILON = 0.001;
const PRIORITY = 40; // AVANT PhysicsSystem (50), pour calcul des forces dans la même frame
const MAX_EXTENSION_RATIO = 1.5; // Lignes peuvent s'étirer max à 150% de longueur repos

export class ConstraintSystem extends System {
  constructor() {
    super('ConstraintSystem', PRIORITY);
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;

    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar) {
      return;
    }

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');

    if (!kiteTransform || !kitePhysics) {
      return;
    }

    if (kitePhysics.isKinematic) {
      return;
    }

    if (leftLine) {
      const leftLineComp = leftLine.getComponent<LineComponent>('line');
      if (leftLineComp) {
        this.applyLineConstraint({
          lineComponent: leftLineComp,
          barEntity: controlBar,
          kiteEntity: kite,
          barPoint: 'leftHandle',
          kitePoint: 'CTRL_GAUCHE',
          kiteTransform,
          kitePhysics
        });
      }
    }

    if (rightLine) {
      const rightLineComp = rightLine.getComponent<LineComponent>('line');
      if (rightLineComp) {
        this.applyLineConstraint({
          lineComponent: rightLineComp,
          barEntity: controlBar,
          kiteEntity: kite,
          barPoint: 'rightHandle',
          kitePoint: 'CTRL_DROIT',
          kiteTransform,
          kitePhysics
        });
      }
    }

    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  private applyLineConstraint(params: {
    lineComponent: LineComponent;
    barEntity: Entity;
    kiteEntity: Entity;
    barPoint: string;
    kitePoint: string;
    kiteTransform: TransformComponent;
    kitePhysics: PhysicsComponent;
  }): void {
    const {
      lineComponent,
      barEntity,
      kiteEntity,
      barPoint,
      kitePoint,
      kiteTransform,
      kitePhysics
    } = params;

    const barGeometry = barEntity.getComponent<GeometryComponent>('geometry');
    const kiteGeometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const barTransform = barEntity.getComponent<TransformComponent>('transform');
    const barPhysics = barEntity.getComponent<PhysicsComponent>('physics');

    if (!barGeometry || !kiteGeometry || !barTransform || !barPhysics) {
      return;
    }

    const barPointWorld = barGeometry.getPointWorld(barPoint, barEntity);
    const kitePointWorld = kiteGeometry.getPointWorld(kitePoint, kiteEntity);

    if (!barPointWorld || !kitePointWorld) {
      return;
    }

    const toBar = barPointWorld.clone().sub(kitePointWorld);
    let distance = toBar.length();

    // === LIMITER LA DISTANCE PHYSIQUE ===
    // Empêcher les lignes de s'étirer au-delà d'une limite maximale
    // (150% de la longueur de repos)
    const maxDistance = lineComponent.restLength * MAX_EXTENSION_RATIO;
    
    if (distance > maxDistance) {
      // Ramener le kite à la distance maximale
      const excessDistance = distance - maxDistance;
      const direction = toBar.normalize();
      const correction = direction.multiplyScalar(excessDistance);
      
      // Appliquer la correction au kite (direction de la barre)
      kiteTransform.position.add(correction);
      
      // Réappliquer la vélocité en projetant seulement la composante perpendiculaire
      const radialComponent = kitePhysics.velocity.dot(direction);
      if (radialComponent > 0) {
        kitePhysics.velocity.sub(direction.multiplyScalar(radialComponent));
      }
      
      distance = maxDistance;
      console.warn(`🔗 Ligne clippée à distance max: ${distance.toFixed(3)}m (longueur repos: ${lineComponent.restLength}m)`);
    }

    lineComponent.currentLength = distance;

    if (distance <= lineComponent.restLength) {
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.state.strainRatio = 0;
      lineComponent.currentTension = 0;
      return;
    }

    const direction = distance > EPSILON ? toBar.multiplyScalar(1 / distance) : new THREE.Vector3();
    const extension = distance - lineComponent.restLength;

    lineComponent.state.isTaut = true;
    lineComponent.state.elongation = extension;
    lineComponent.state.strainRatio = lineComponent.restLength > EPSILON
      ? extension / lineComponent.restLength
      : 0;

    // === FORCES BIDIRECTIONNELLES (3ème loi de Newton) ===
    // La ligne tire le kite vers la barre ET la barre vers le kite

    // Vitesse relative au point d'attache du kite
    const kiteAttachmentOffset = kitePointWorld.clone().sub(kiteTransform.position);
    const kiteVelocityAtAttachment = kitePhysics.velocity.clone().add(
      kitePhysics.angularVelocity.clone().cross(kiteAttachmentOffset)
    );

    // Vitesse relative au point d'attache de la barre
    const barAttachmentOffset = barPointWorld.clone().sub(barTransform.position);
    const barVelocityAtAttachment = barPhysics.velocity.clone().add(
      barPhysics.angularVelocity.clone().cross(barAttachmentOffset)
    );

    // Vitesse relative (kite par rapport à la barre)
    const relativeVelocity = kiteVelocityAtAttachment.clone().sub(barVelocityAtAttachment);
    const radialVelocity = relativeVelocity.dot(direction);

    // Force de rappel : F = k × extension + damping × velocity³
    // Amortissement au cube pour meilleure dissipation des oscillations
    // Le cube augmente dramatiquement la dissipation aux vitesses élevées
    // tout en restant faible aux vitesses faibles
    const springForce = lineComponent.stiffness * extension;
    const dampingForce = lineComponent.damping * Math.pow(Math.abs(radialVelocity), 3) * Math.sign(radialVelocity);
    let tensionMagnitude = springForce + dampingForce;

    // === CLIPPING DE LA TENSION MAXIMALE ===
    // Limiter la tension pour éviter instabilités numériques
    // et simuler la rupture/comportement réaliste de la ligne
    if (tensionMagnitude > lineComponent.maxTension) {
      console.warn(`⚠️ Tension ligne > max (${tensionMagnitude.toFixed(2)} > ${lineComponent.maxTension}N)`);
      tensionMagnitude = lineComponent.maxTension;
    }

    // === CLIPPING DE L'EXTENSION MAXIMALE ===
    // Les lignes ne peuvent pas s'étirer au-delà d'une limite raisonnable
    // Multiplicateur max d'extension (ex: 1.5 = 150% de la longueur de repos)
    const maxExtension = lineComponent.restLength * MAX_EXTENSION_RATIO;
    if (extension > maxExtension) {
      console.warn(`⚠️ Extension ligne > max (${extension.toFixed(3)} > ${maxExtension.toFixed(3)}m)`);
      // Appliquer la force maximale seulement
      tensionMagnitude = lineComponent.stiffness * maxExtension + dampingForce;
      // Limiter à nouveau si nécessaire
      tensionMagnitude = Math.min(tensionMagnitude, lineComponent.maxTension);
    }

    // Stocker la tension pour debug
    lineComponent.currentTension = Math.max(0, tensionMagnitude);

    if (tensionMagnitude > 0) {
      // Force sur le kite : vers la barre (direction positive)
      const forceOnKite = direction.clone().multiplyScalar(tensionMagnitude);
      kitePhysics.forces.add(forceOnKite);

      // Force sur la barre : vers le kite (réaction, direction opposée) - 3ème loi de Newton
      const forceOnBar = direction.clone().multiplyScalar(-tensionMagnitude);
      barPhysics.forces.add(forceOnBar);

      // Couple sur le kite (bras de levier depuis centre de masse)
      const kiteTorque = kiteAttachmentOffset.clone().cross(forceOnKite);
      kitePhysics.torques.add(kiteTorque);

      // Couple sur la barre (bras de levier depuis centre de masse)
      const barTorque = barAttachmentOffset.clone().cross(forceOnBar);
      barPhysics.torques.add(barTorque);
    }
  }
  
  /**
   * Gère la collision avec le sol
   * Si le kite touche le sol (y < 0), le replacer à y = 0 et annuler vélocité verticale
   */
  private handleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < GROUND_Y) {
      transform.position.y = GROUND_Y;
      
      // Annuler composante verticale de la vélocité
      if (physics.velocity.y < 0) {
        physics.velocity.y = 0;
      }
    }
  }
}
