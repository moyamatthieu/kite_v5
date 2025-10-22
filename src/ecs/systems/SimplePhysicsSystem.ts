/**
 * SimplePhysicsSystem.ts - Système de physique unifié ultra-simple
 *
 * PHYSIQUE ULTRA-SIMPLE POUR ÉLIMINER LES TOURBILLONS:
 * ════════════════════════════════════════════════════════
 *
 * 1. UN SEUL SYSTÈME gère TOUTES les forces (pas de conflits)
 * 2. Aérodynamique simplifiée (portance + traînée)
 * 3. Contraintes de lignes ultra-simples (slack/taut)
 * 4. Intégration Euler explicite stable
 * 5. Pas de brides, pas de complexité
 */

import * as THREE from 'three';
import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { LineComponent } from '../components/LineComponent';
import { PhysicsConstants } from '../config/Config';

const PRIORITY = 30;

/**
 * Paramètres de physique simplifiés
 */
const PHYSICS = {
  // Aérodynamique simplifiée
  LIFT_COEFFICIENT: 0.8,      // Coefficient de portance (réduit pour stabilité)
  DRAG_COEFFICIENT: 0.1,      // Coefficient de traînée
  AIR_DENSITY: 1.225,         // kg/m³

  // Géométrie simplifiée
  KITE_AREA: 8.0,             // m² (surface alaire)
  KITE_SPAN: 4.0,             // m (envergure)

  // Contraintes de lignes
  LINE_MAX_LENGTH: 15.0,      // m (longueur maximale des lignes)
  TETHER_STIFFNESS: 2000,     // N/m (raideur douce pour stabilité)
  MAX_TENSION: 500,           // N (tension maximale pour éviter explosions)

  // Intégration
  MAX_VELOCITY: 50,           // m/s (limite de vitesse)
  MAX_ANGULAR_VELOCITY: 5,    // rad/s (limite de vitesse angulaire)
  DAMPING: 0.98,              // Amortissement global
};

export class SimplePhysicsSystem extends System {
  constructor() {
    super('SimplePhysicsSystem', PRIORITY);
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    // Récupérer les entités principales
    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) {
      return;
    }

    // Récupérer les composants
    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');
    const wind = entityManager.getEntity('wind')?.getComponent('wind');

    if (!kiteTransform || !kitePhysics || !kiteGeometry || kitePhysics.isKinematic) {
      return;
    }

    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!barGeometry) return;

    // Points d'attache
    const ctrlLeft = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlRight = kiteGeometry.getPointWorld('CTRL_DROIT', kite);
    const handleLeft = barGeometry.getPointWorld('leftHandle', controlBar);
    const handleRight = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!ctrlLeft || !ctrlRight || !handleLeft || !handleRight) {
      return;
    }

    // === RESET DES FORCES ===
    kitePhysics.forces.set(0, 0, 0);
    kitePhysics.torques.set(0, 0, 0);

    // === FORCE GRAVITATIONNELLE ===
    kitePhysics.forces.add(new THREE.Vector3(0, -PhysicsConstants.GRAVITY * kitePhysics.mass, 0));

    // === FORCES AÉRODYNAMIQUES SIMPLIFIÉES ===
    this.applyAerodynamicForces(kiteTransform, kitePhysics, wind);

    // === CONTRAINTES DE LIGNES ULTRA-SIMPLES ===
    this.applyTetherConstraints(
      kiteTransform, kitePhysics,
      ctrlLeft, ctrlRight,
      handleLeft, handleRight,
      leftLine.getComponent<LineComponent>('line'),
      rightLine.getComponent<LineComponent>('line')
    );

    // === INTÉGRATION EULER STABLE ===
    this.integrateEuler(kiteTransform, kitePhysics, context.deltaTime);

    // === COLLISION SOL ===
    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  /**
   * Applique les forces aérodynamiques simplifiées
   */
  private applyAerodynamicForces(
    transform: TransformComponent,
    physics: PhysicsComponent,
    wind?: any
  ): void {
    // Vent apparent simplifié
    const windVelocity = wind?.velocity || new THREE.Vector3(0, 0, 0);
    const apparentWind = windVelocity.clone().sub(physics.velocity);

    const airspeed = apparentWind.length();
    if (airspeed < 0.1) return; // Pas de vent, pas de forces

    // Direction simplifiée (kite orienté vers l'avant)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(transform.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(transform.quaternion);

    // Angle d'attaque simplifié (basé sur l'orientation verticale)
    const angleOfAttack = Math.acos(up.dot(new THREE.Vector3(0, 1, 0))) - Math.PI/2;
    const aoaDegrees = THREE.MathUtils.radToDeg(angleOfAttack);

    // Portance simplifiée (proportionnelle à l'angle d'attaque)
    const liftCoeff = PHYSICS.LIFT_COEFFICIENT * Math.sin(angleOfAttack);
    const lift = 0.5 * PHYSICS.AIR_DENSITY * airspeed * airspeed * PHYSICS.KITE_AREA * liftCoeff;
    const liftForce = up.clone().multiplyScalar(lift);

    // Traînée simplifiée
    const dragCoeff = PHYSICS.DRAG_COEFFICIENT;
    const drag = 0.5 * PHYSICS.AIR_DENSITY * airspeed * airspeed * PHYSICS.KITE_AREA * dragCoeff;
    const dragForce = apparentWind.clone().normalize().multiplyScalar(-drag);

    // Appliquer les forces
    physics.forces.add(liftForce);
    physics.forces.add(dragForce);

    // Torque de portance (stabilisation)
    const torqueArm = PHYSICS.KITE_SPAN / 2;
    const liftTorque = right.clone().multiplyScalar(-lift * torqueArm * 0.1);
    physics.torques.add(liftTorque);
  }

  /**
   * Applique les contraintes de lignes ultra-simples
   */
  private applyTetherConstraints(
    kiteTransform: TransformComponent,
    kitePhysics: PhysicsComponent,
    ctrlLeft: THREE.Vector3,
    ctrlRight: THREE.Vector3,
    handleLeft: THREE.Vector3,
    handleRight: THREE.Vector3,
    leftLineComp?: LineComponent,
    rightLineComp?: LineComponent
  ): void {
    // Ligne gauche
    this.applySingleTether(
      kiteTransform, kitePhysics, ctrlLeft, handleLeft,
      leftLineComp, 'left'
    );

    // Ligne droite
    this.applySingleTether(
      kiteTransform, kitePhysics, ctrlRight, handleRight,
      rightLineComp, 'right'
    );
  }

  /**
   * Applique une contrainte de ligne individuelle
   */
  private applySingleTether(
    kiteTransform: TransformComponent,
    kitePhysics: PhysicsComponent,
    ctrlPoint: THREE.Vector3,
    handlePoint: THREE.Vector3,
    lineComp?: LineComponent,
    side: 'left' | 'right' = 'left'
  ): void {
    const diff = ctrlPoint.clone().sub(handlePoint);
    const distance = diff.length();

    if (lineComp) {
      lineComp.currentLength = distance;
    }

    // Distance maximale
    const maxLength = PHYSICS.LINE_MAX_LENGTH;

    if (distance <= maxLength) {
      // SLACK : complètement flexible, aucune force
      if (lineComp) {
        lineComp.state.isTaut = false;
        lineComp.state.elongation = 0;
        lineComp.currentTension = 0;
      }
      return;
    }

    // TAUT : appliquer une force de rappel douce
    if (lineComp) {
      lineComp.state.isTaut = true;
      lineComp.state.elongation = distance - maxLength;
    }

    // Direction normalisée (du CTRL vers le handle)
    const direction = diff.clone().normalize();

    // Calculer la vitesse du point d'attache sur le kite
    const r = ctrlPoint.clone().sub(kiteTransform.position);
    const angularVel = kitePhysics.angularVelocity;
    const pointVelocity = kitePhysics.velocity.clone().add(
      new THREE.Vector3().crossVectors(angularVel, r)
    );

    // Vitesse radiale (positive si le kite s'éloigne du handle)
    const v_radial = pointVelocity.dot(direction);

    // SEULEMENT tirer si le kite s'éloigne (éviter de pousser)
    if (v_radial > 0) {
      // Force de tension douce
      const excess = distance - maxLength;
      const tension = Math.min(PHYSICS.TETHER_STIFFNESS * excess, PHYSICS.MAX_TENSION);

      // Force appliquée au point CTRL (vers le handle)
      const force = direction.clone().multiplyScalar(-tension);

      // Appliquer au kite
      kitePhysics.forces.add(force);

      // Générer torque
      const torque = new THREE.Vector3().crossVectors(r, force);
      kitePhysics.torques.add(torque);

      // Mettre à jour la télémétrie
      if (lineComp) {
        lineComp.currentTension = tension;
      }
    } else {
      // Kite se rapproche : pas de force
      if (lineComp) {
        lineComp.currentTension = 0;
      }
    }
  }

  /**
   * Intégration Euler stable avec limites de vitesse
   */
  private integrateEuler(
    transform: TransformComponent,
    physics: PhysicsComponent,
    deltaTime: number
  ): void {
    // Limiter le deltaTime pour la stabilité
    const dt = Math.min(deltaTime, 1/30); // Max 30 FPS

    // Calculer accélération
    const acceleration = physics.forces.clone().divideScalar(physics.mass);

    // Intégrer vitesse
    physics.velocity.add(acceleration.clone().multiplyScalar(dt));

    // Limiter la vitesse
    const speed = physics.velocity.length();
    if (speed > PHYSICS.MAX_VELOCITY) {
      physics.velocity.multiplyScalar(PHYSICS.MAX_VELOCITY / speed);
    }

    // Amortissement global
    physics.velocity.multiplyScalar(PHYSICS.DAMPING);

    // Intégrer position
    transform.position.add(physics.velocity.clone().multiplyScalar(dt));

    // Calculer accélération angulaire (simplifiée avec inertie scalaire)
    const inertiaScalar = 10; // kg·m² - valeur simplifiée
    const angularAcceleration = physics.torques.clone().divideScalar(inertiaScalar);

    // Intégrer vitesse angulaire
    physics.angularVelocity.add(angularAcceleration.clone().multiplyScalar(dt));

    // Limiter la vitesse angulaire
    const angularSpeed = physics.angularVelocity.length();
    if (angularSpeed > PHYSICS.MAX_ANGULAR_VELOCITY) {
      physics.angularVelocity.multiplyScalar(PHYSICS.MAX_ANGULAR_VELOCITY / angularSpeed);
    }

    // Amortissement angulaire
    physics.angularVelocity.multiplyScalar(PHYSICS.DAMPING);

    // Intégrer rotation (quaternion)
    const deltaRotation = new THREE.Quaternion()
      .setFromAxisAngle(physics.angularVelocity.clone().normalize(), angularSpeed * dt);
    transform.quaternion.multiply(deltaRotation);
    transform.quaternion.normalize();
  }

  /**
   * Gère la collision avec le sol
   */
  private handleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < PhysicsConstants.GROUND_Y) {
      transform.position.y = PhysicsConstants.GROUND_Y;

      // Annuler la composante verticale descendante
      if (physics.velocity.y < 0) {
        physics.velocity.y = 0;
      }

      // Amortissement horizontal au contact du sol
      physics.velocity.x *= 0.8;
      physics.velocity.z *= 0.8;
    }
  }
}