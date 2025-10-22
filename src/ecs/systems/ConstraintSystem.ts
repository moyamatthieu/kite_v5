/**
 * ConstraintSystem.ts - Dual-Mode Line Constraint Resolution
 *
 * This system implements two different constraint solving strategies for kite lines:
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    DUAL MODE ARCHITECTURE                        │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                   │
 * │  1. PBD MODE (Position-Based Dynamics)                          │
 * │     ─────────────────────────────────────────                   │
 * │     Strategy: Direct position constraint + force-based torque   │
 * │                                                                   │
 * │     Algorithm:                                                   │
 * │     ┌─ Step 1: Calculate line elongation                        │
 * │     │  delta = distance - restLength                            │
 * │     │                                                             │
 * │     ├─ Step 2: Apply line forces (creates torque)               │
 * │     │  F = k × delta  (spring force magnitude)                  │
 * │     │  τ = r × F      (torque = lever × force)                  │
 * │     │  forces += F, torques += τ                                │
 * │     │                                                             │
 * │     └─ Step 3: Project position (hard constraint)               │
 * 
 * │        if distance > restLength:                                │
 * │          project kite closer by distance excess                 │
 * │                                                                   │
 * │     Properties: Rigid, stable, high-speed, ball-joint pivots    │
 * │                                                                   │
 * │  2. SPRING-FORCE MODE (Classic Spring Physics)                 │
 * │     ──────────────────────────────────────────                  │
 * │     Strategy: Pure spring-damper forces on CTRL points          │
 * │                                                                   │
 * │     Algorithm:                                                   │
 * │     ┌─ Calculate extension: delta = distance - restLength       │
 * │     ├─ Spring force: F_spring = k × delta                       │
 * │     ├─ Damping force: F_damp = -c × v_radial                   │
 * │     ├─ Apply force to CTRL point                                │
 * │     │  forces += (F_spring + F_damp) × direction                │
 * │     └─ Torque: τ = r × F (automatic from PhysicsSystem)        │
 * │                                                                   │
 * │     Properties: Soft, responsive, intuitive, adjustable         │
 * │                                                                   │
 * │  Mode Selection: InputComponent.constraintMode                  │
 * │  System Priority: 40 (after AeroSystem 30, before Physics 50)  │
 * │                                                                   │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ARCHITECTURE COMPLIANCE:
 * ✓ Pure ECS: No logic in components, all state in PhysicsComponent
 * ✓ Separation of concerns: Constraints (geometry) + Physics (dynamics)
 * ✓ System ordering: AeroSystem → ConstraintSystem → PhysicsSystem
 * ✓ Stateless: Frame-independent, no accumulated state
 *
 * @class ConstraintSystem
 * @extends System
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { LineComponent } from '../components/LineComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { InputComponent } from '../components/InputComponent';
import { CONFIG, PhysicsConstants, ConstraintConfig } from '../config/Config';

const PRIORITY = 40;

export class ConstraintSystem extends System {
  constructor() {
    super('ConstraintSystem', PRIORITY);
  }

  update(context: SimulationContext): void {
    // Récupérer le mode de contrainte depuis InputComponent
    const inputEntities = context.entityManager.query(['Input']);
    const inputComponent = inputEntities[0]?.getComponent<InputComponent>('Input');

    const mode = inputComponent?.constraintMode ?? CONFIG.lines.constraintMode;

    // Basculer entre les deux modes
    if (mode === 'pbd') {
      this.updatePBD(context);
    } else {
      this.updateSpringForce(context);
    }
  }

  /**
   * MODE PBD AMÉLIORÉ: Position-Based Dynamics avec amortissement et Baumgarte
   * 
   * Algorithme:
   * 1. Boucle d'itérations (2-4 fois):
   *    a. Calculer elongation (distance - restLength)
   *    b. Appliquer force ressort + damping
   *    c. Appliquer Baumgarte stabilization
   *    d. Projeter position (hard constraint si slack)
   * 2. Générer torques pour l'orientation du kite
   * 3. Collision sol
   */
  private updatePBD(context: SimulationContext): void {
    const { entityManager, deltaTime } = context;

    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) {
      return;
    }

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');

    if (!kiteTransform || !kitePhysics || kitePhysics.isKinematic) {
      return;
    }

    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');
    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!kiteGeometry || !barGeometry) return;

    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');
    if (!leftLineComp || !rightLineComp) return;

    // Points de contrôle du kite
    const ctrlGauche = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlDroit = kiteGeometry.getPointWorld('CTRL_DROIT', kite);
    const leftHandle = barGeometry.getPointWorld('leftHandle', controlBar);
    const rightHandle = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!ctrlGauche || !ctrlDroit || !leftHandle || !rightHandle) {
      return;
    }

    // Résoudre les contraintes PBD itérativement
    this.solvePBDConstraintsIteratively(
      leftHandle, ctrlGauche, leftLineComp, kiteTransform, kitePhysics, deltaTime
    );
    this.solvePBDConstraintsIteratively(
      rightHandle, ctrlDroit, rightLineComp, kiteTransform, kitePhysics, deltaTime
    );

    // Collision sol
    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  /**
   * Résout itérativement les contraintes PBD pour une ligne.
   */
  private solvePBDConstraintsIteratively(
    handlePos: THREE.Vector3,
    ctrlPos: THREE.Vector3,
    lineComp: LineComponent,
    kiteTransform: TransformComponent,
    kitePhysics: PhysicsComponent,
    deltaTime: number
  ): void {
    // Chaque itération améliore la convergence
    for (let iter = 0; iter < ConstraintConfig.PBD_ITERATIONS; iter++) {
      this.solvePBDConstraint(
        handlePos, ctrlPos, lineComp, kiteTransform, kitePhysics, deltaTime
      );
    }
  }

  /**
   * Solveur PBD pour UNE contrainte (ligne)
   * Applique ressort + damping + Baumgarte
   */
  private solvePBDConstraint(
    handlePos: THREE.Vector3,
    ctrlPos: THREE.Vector3,
    lineComp: LineComponent,
    kiteTransform: TransformComponent,
    kitePhysics: PhysicsComponent,
    deltaTime: number
  ): void {
    const direction = handlePos.clone().sub(ctrlPos);
    const distance = direction.length();

    if (distance < PhysicsConstants.EPSILON) return;

    direction.normalize(); // direction: du ctrl vers le handle

    const elongation = Math.max(0, distance - lineComp.restLength);

    // === SLACK LINE : si pas en tension, pas de force ===
    if (elongation < PhysicsConstants.EPSILON) {
      lineComp.state.isTaut = false;
      lineComp.state.elongation = 0;
      lineComp.state.strainRatio = 0;
      lineComp.currentTension = 0;
      lineComp.currentLength = distance;
      return;
    }

    lineComp.state.isTaut = true;
    lineComp.state.elongation = elongation;
    lineComp.state.strainRatio = elongation / lineComp.restLength;
    lineComp.currentLength = distance;

    // === CALCUL DES FORCES ===

    // 1. Force du ressort (Loi de Hooke: F = k * x)
    const F_spring = ConstraintConfig.LINE_STIFFNESS * elongation;

    // 2. Force d'amortissement (basée sur vitesse relative)
    const velocityHandle = new THREE.Vector3(0, 0, 0); // La barre est statique
    const velocityCtrl = kitePhysics.velocity.clone(); // Vitesse du kite

    // Vitesse relative et composante radiale
    const v_relative = velocityHandle.clone().sub(velocityCtrl);
    const v_radial = v_relative.dot(direction); // Composante le long de la ligne

    // Damping force = -c * v_radial
    const F_damping = -ConstraintConfig.PBD_DAMPING * v_radial;

    // 3. Baumgarte stabilization (corrige les erreurs accumulées)
    // Ajoute une force proportionnelle à l'erreur de contrainte
    const F_baumgarte = ConstraintConfig.BAUMGARTE_COEF * elongation;

    // Force totale (clamped pour éviter les valeurs négatives)
    const totalForce = Math.max(0, F_spring + F_damping + F_baumgarte);

    // === APPLICATION DE LA FORCE ===
    // Force appliquée au point de contrôle du kite
    const force = direction.clone().multiplyScalar(totalForce);
    kitePhysics.forces.add(force);

    // Mise à jour de la tension (approximation)
    lineComp.currentTension = totalForce;

    // === GÉNÉRATION DU TORQUE ===
    // Crucial pour l'orientation du kite!
    // τ = r × F (r = vecteur du centre du kite au point de contrôle)
    const r = ctrlPos.clone().sub(kiteTransform.position);
    const torque = new THREE.Vector3().crossVectors(r, force);
    kitePhysics.torques.add(torque);

    // === PROJECTION DE POSITION (hard constraint) ===
    // Si la distance dépasse encore la limite après les forces, corriger directement
    const currentDist = handlePos.distanceTo(ctrlPos);
    if (currentDist > lineComp.restLength) {
      const excess = currentDist - lineComp.restLength;
      const correction = direction.clone().multiplyScalar(excess * ConstraintConfig.PBD_PROJECTION_FACTOR);
      kiteTransform.position.add(correction);
    }
  }

  /**
   * MODE SPRING-FORCE : Forces ressort classiques
   */
  private updateSpringForce(context: SimulationContext): void {
    const { entityManager } = context;

    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) {
      return;
    }

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');

    if (!kiteTransform || !kitePhysics || !kiteGeometry) {
      return;
    }

    if (kitePhysics.isKinematic) {
      return;
    }

    // Points de contrôle du kite
    const ctrlGaucheWorld = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlDroitWorld = kiteGeometry.getPointWorld('CTRL_DROIT', kite);

    if (!ctrlGaucheWorld || !ctrlDroitWorld) {
      console.warn('[ConstraintSystem] Points CTRL manquants');
      return;
    }

    // Handles de la barre
    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!barGeometry) return;

    const leftHandleWorld = barGeometry.getPointWorld('leftHandle', controlBar);
    const rightHandleWorld = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!leftHandleWorld || !rightHandleWorld) {
      return;
    }

    // Composants des lignes
    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');

    if (!leftLineComp || !rightLineComp) {
      return;
    }

    // === LIGNE GAUCHE ===
    this.applySpringForce({
      ctrlWorld: ctrlGaucheWorld,
      handleWorld: leftHandleWorld,
      restLength: leftLineComp.restLength,
      kiteTransform,
      kitePhysics,
      lineComponent: leftLineComp
    });

    // === LIGNE DROITE ===
    this.applySpringForce({
      ctrlWorld: ctrlDroitWorld,
      handleWorld: rightHandleWorld,
      restLength: rightLineComp.restLength,
      kiteTransform,
      kitePhysics,
      lineComponent: rightLineComp
    });

    // Collision sol
    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  // ============================================================================
  // MÉTHODES PBD
  // ============================================================================

  /**
   * Résout une contrainte de ligne individuelle (PBD)
   * Modifie correctedPosition et correctedQuaternion par référence
   */
  // ============================================================================
  // MÉTHODES SPRING-FORCE
  // ============================================================================

  /**
   * Applique une force ressort à une ligne (Spring-Force mode)
   */
  private applySpringForce(params: {
    ctrlWorld: THREE.Vector3;
    handleWorld: THREE.Vector3;
    restLength: number;
    kiteTransform: TransformComponent;
    kitePhysics: PhysicsComponent;
    lineComponent: LineComponent;
  }): void {
    const {
      ctrlWorld,
      handleWorld,
      restLength,
      kiteTransform,
      kitePhysics,
      lineComponent
    } = params;

    // === 1. CALCUL EXTENSION ===
    const diff = handleWorld.clone().sub(ctrlWorld);
    const distance = diff.length();

    if (distance < PhysicsConstants.EPSILON) {
      return;
    }

    const direction = diff.normalize();
    const extension = distance - restLength;

    // Mettre à jour état ligne
    lineComponent.currentLength = distance;


    // Contrainte unilatérale : seulement tension
    if (extension <= 0) {
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.currentTension = 0;
      return;
    }

    lineComponent.state.isTaut = true;
    lineComponent.state.elongation = extension;
    lineComponent.state.strainRatio = extension / restLength;

    // === 2. CALCUL FORCE RESSORT ===
    const stiffness = CONFIG.lines.springForce.stiffness;
    const damping = CONFIG.lines.springForce.damping;
    const maxForce = CONFIG.lines.springForce.maxForce;

    // Force élastique : F = k × extension
    let springForce = stiffness * extension;

    // Amortissement : calculer vitesse relative au point d'attache
    const r = ctrlWorld.clone().sub(kiteTransform.position);
    const angularContribution = new THREE.Vector3()
      .crossVectors(kitePhysics.angularVelocity, r);
    const pointVelocity = kitePhysics.velocity.clone().add(angularContribution);

    // Composante radiale de la vitesse (le long de la ligne)
    const radialVelocity = pointVelocity.dot(direction);

    // Force d'amortissement : F_damp = -c × v_radial (NÉGATIF pour s'opposer au mouvement)
    const dampingForce = -damping * radialVelocity;

    // Force totale
    let totalForce = springForce + dampingForce;

    // Limiter la force (en valeur absolue pour gérer compression et tension)
    if (Math.abs(totalForce) > maxForce) {
      totalForce = Math.sign(totalForce) * maxForce;
    }
    
    // Contrainte unilatérale : ne garder que les forces de tension (positives)
    if (totalForce < 0) {
      totalForce = 0;
    }

    // Stocker la tension
    lineComponent.currentTension = totalForce;

    // === 3. APPLIQUER FORCE ET TORQUE ===
    const forceVector = direction.clone().multiplyScalar(totalForce);

    // Force linéaire
    kitePhysics.forces.add(forceVector);

    // Torque (r × F)
    const torque = new THREE.Vector3().crossVectors(r, forceVector);
    kitePhysics.torques.add(torque);
  }

  // ============================================================================
  // MÉTHODES COMMUNES
  // ============================================================================

  /**
   * Gère les vitesses après corrections PBD
   * 
   * En PBD, les corrections de position doivent être "absorbées" par la vitesse
   * pour éviter que PhysicsSystem ne réintègre un mouvement supplémentaire.
   * 
   * Approche simple et stable : réduire la vitesse pour qu'elle correspondent 
   * à la correction appliquée, sans l'annuler complètement.
   */
  private dampVelocities(
    physics: PhysicsComponent,
    deltaPosition: THREE.Vector3,
    _deltaQuaternion: THREE.Quaternion,
    deltaTime: number
  ): void {
    if (deltaTime < PhysicsConstants.EPSILON) return;

    // Appliquer un amortissement adaptatif basé sur la correction
    // Plus la correction est grande, plus on amortit
    const correctionMagnitude = deltaPosition.length();
    const dampingFactor = Math.max(0.5, 1.0 - correctionMagnitude * 0.1);
    
    physics.velocity.multiplyScalar(dampingFactor);
    physics.angularVelocity.multiplyScalar(dampingFactor);
  }

  /**
   * Gère la collision avec le sol
   */
  private handleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < PhysicsConstants.GROUND_Y) {
      transform.position.y = PhysicsConstants.GROUND_Y;

      if (physics.velocity.y < 0) {
        physics.velocity.y = 0;
      }
    }
  }
}
