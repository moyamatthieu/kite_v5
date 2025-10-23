/**
 * ConstraintSystem.ts - Simple Tether Line Constraint System
 *
 * SIMPLE PHYSICS MODEL:
 * - Lines connect two points (A and B) with maximum length
 * - Completely flexible when slack (distance < maxLength)
 * - Rigid constraint when taut (distance >= maxLength)
 * - Only traction forces (no compression/pushing)
 * - Bidirectional pulling capability
 *
 * PHYSICS PRINCIPLES:
 * 1. If distance < maxLength: No force applied
 * 2. If distance > maxLength: Apply force to bring distance back to maxLength
 * 3. Force direction: Always toward the other point (pulling)
 * 4. Force magnitude: Proportional to distance excess
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
import { CONFIG, PhysicsConstants, ConstraintConfig } from '../config/Config';

const PRIORITY = 40;

export class ConstraintSystem extends System {
  // Debug logging
  private debugForces = true; // Activer pour logger les forces aux CTRL
  private debugFrameCounter = 0;
  private readonly DEBUG_LOG_INTERVAL = 60; // Log toutes les 60 frames (1 fois/seconde à 60fps)

  constructor() {
    super('ConstraintSystem', PRIORITY);
  }

  update(context: SimulationContext): void {
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

    // Get attachment points
    const ctrlGauche = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlDroit = kiteGeometry.getPointWorld('CTRL_DROIT', kite);
    const leftHandle = barGeometry.getPointWorld('leftHandle', controlBar);
    const rightHandle = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!ctrlGauche || !ctrlDroit || !leftHandle || !rightHandle) {
      return;
    }

    // Apply constraints for each line - USING MAKANI VERSION
    this.solvePBDConstraint(leftHandle, ctrlGauche, leftLineComp, kiteTransform, kitePhysics, deltaTime);
    this.solvePBDConstraint(rightHandle, ctrlDroit, rightLineComp, kiteTransform, kitePhysics, deltaTime);

    // Ground collision
    this.handleGroundCollision(kiteTransform, kitePhysics);

    // Increment debug frame counter
    this.debugFrameCounter++;
  }

  /**
   * Apply simple line constraint between two points
   * Only applies force when line is stretched beyond maximum length
   */
  private applyLineConstraint(
    pointA: THREE.Vector3,      // Handle (control bar)
    pointB: THREE.Vector3,      // Control point (kite)
    lineComp: LineComponent,
    kitePhysics: PhysicsComponent
  ): void {
    // Calculate current distance and direction
    const direction = pointB.clone().sub(pointA); // From A to B
    const distance = direction.length();

    // Update line state
    lineComp.currentLength = distance;

    // Check if line is slack or taut
    if (distance <= lineComp.restLength) {
      // SLACK: No force, line is flexible
      lineComp.state.isTaut = false;
      lineComp.state.elongation = 0;
      lineComp.state.strainRatio = 0;
      lineComp.currentTension = 0;
      return;
    }

    // TAUT: Apply constraint force
    lineComp.state.isTaut = true;
    const excess = distance - lineComp.restLength;
    lineComp.state.elongation = excess;
    lineComp.state.strainRatio = excess / lineComp.restLength;

    // Normalize direction (from A to B)
    direction.normalize();

    // Calculate constraint force magnitude
    // Simple proportional control: stronger pull for larger excess
    const stiffness = 1000; // N/m - simple stiffness for constraint
    const forceMagnitude = Math.min(excess * stiffness, 200); // Cap at 200N

    // Force direction: pull B toward A (kite toward handle)
    const constraintForce = direction.clone().multiplyScalar(-forceMagnitude);

    // Apply force to kite physics
    kitePhysics.forces.add(constraintForce);

    // Update tension for visualization
    lineComp.currentTension = forceMagnitude;

    // Generate torque around kite center of mass
    const kiteCenter = new THREE.Vector3(0, 0, 0); // Assume kite center at origin for now
    const r = pointB.clone().sub(kiteCenter);
    const torque = new THREE.Vector3().crossVectors(r, constraintForce);
    kitePhysics.torques.add(torque);
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
   * 
   * ⚠️ IMPORTANT: ctrlPos n'est PAS mis à jour entre les itérations!
   * C'est intentionnel : on travaille avec la position au début du frame.
   * Les corrections de position sont appliquées mais ctrlPos reste constant
   * pendant toutes les itérations pour assurer la convergence stable.
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
   * Tether line constraint solver (Makani-inspired)
   * 
   * Physical model:
   * ───────────────
   * The kite is a RIGID BODY connected to handles via elastic tether lines.
   * Each line behaves as a spring-damper with NO compression forces.
   * 
   * Reference: Makani tether.cc CalcLongSpringForceSeg() lines 652-703
   * 
   * Algorithm:
   * ──────────
   * 1. SLACK detection (distance < restLength)
   *    → No force, kite is free (drag pushes it back until lines taut)
   * 
   * 2. TAUT state (distance ≥ restLength)
   *    → Spring force: F_spring = EA × strain (Hooke's law)
   *      where: strain = (distance - restLength) / restLength
   *             EA = LINE_STIFFNESS (tensile stiffness, N)
   * 
   *    → Damping force: F_damp = -c × v_radial (longitudinal damping)
   *      where: c = damping coefficient
   *             v_radial = velocity component along line direction
   * 
   * 3. Force application to rigid body
   *    → Total force: F_total = F_spring + F_damp
   *    → Applied at CTRL attachment point
   *    → Generates torque: τ = r × F where r = CTRL_pos - kite_center
   * 
   * 4. Optional velocity correction for numerical stability
   *    → Clamps excessive radial velocity to prevent constraint violation
   * 
   * Architecture integration:
   * ─────────────────────────
   * ✓ Forces accumulated in PhysicsComponent
   * ✓ PhysicsSystem integrates all forces (aero + lines + gravity)
   * ✓ No direct position modification (respects ECS architecture)
   * ✓ CTRL points are geometric (calculated by BridleConstraintSystem)
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

    lineComp.currentLength = distance;

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: SLACK vs TAUT DETECTION WITH HYSTERESIS
    // ═══════════════════════════════════════════════════════════════════════
    // 
    // Physical behavior (Makani reference):
    // • SLACK (distance < restLength): Line has no tension
    //   - Kite is free to move
    //   - Aerodynamic drag pushes kite backward (Z-)
    //   - Kite continues until line becomes taut
    //   - NO forces transmitted by line
    // 
    // • TAUT (distance ≥ restLength + hysteresis): Line under tension
    //   - Line acts as spring-damper
    //   - Transmits traction force to kite
    //   - Prevents further separation
    // 
    // Hysteresis prevents oscillations around the boundary
    const slackThreshold = lineComp.restLength;
    const tautThreshold = lineComp.restLength + 0.01; // 1cm hysteresis
    
    if (lineComp.state.isTaut) {
      // Currently taut: stay taut until significantly slack
      if (distance < slackThreshold - 0.05) { // 5cm hysteresis for stability
        lineComp.state.isTaut = false;
        lineComp.state.elongation = 0;
        lineComp.state.strainRatio = 0;
        lineComp.currentTension = 0;
        return;
      }
    } else {
      // Currently slack: become taut only when clearly stretched
      if (distance < tautThreshold) {
        lineComp.state.isTaut = false;
        lineComp.state.elongation = 0;
        lineComp.state.strainRatio = 0;
        lineComp.currentTension = 0;
        return;
      }
      // Transition to taut state
      lineComp.state.isTaut = true;
    }
    const excess = distance - lineComp.restLength;
    lineComp.state.elongation = excess;
    lineComp.state.strainRatio = excess / lineComp.restLength;

    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: SPRING FORCE (Hooke's Law) WITH SAFETY LIMITS
    // ─────────────────────────────────────────────────────────────────────
    // 
    // Makani reference: tether.cc line 703
    //   F_spring = EA × strain
    //   where: EA = tensile_stiffness (N)
    //          strain = (L_seg - L_seg_0) / L_seg_0
    // 
    // Our implementation with safety limits:
    //   1. Limit maximum elongation to prevent numerical explosion
    //   2. Apply Hooke's law: F_spring = LINE_STIFFNESS × clamped_excess
    //   3. Clamp final force to maximum safe value
    // 
    
    // Safety: Limit maximum elongation to prevent infinite forces
    const maxExcess = lineComp.restLength * ConstraintConfig.MAX_ELONGATION_RATIO;
    const clampedExcess = Math.min(excess, maxExcess);
    
    // Hooke's law with clamped elongation
    const rawSpringForce = ConstraintConfig.LINE_STIFFNESS * clampedExcess;
    
    // Safety: Clamp spring force to prevent numerical explosion
    const springForce = Math.min(rawSpringForce, ConstraintConfig.MAX_CONSTRAINT_FORCE);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: DAMPING FORCE (Longitudinal) WITH SAFETY
    // ─────────────────────────────────────────────────────────────────────
    // 
    // Makani reference: tether.cc line 745
    //   F_damp = -c_damp × v_radial
    //   where: c_damp = damping_ratio × sqrt(2 × EA × linear_density)
    // 
    // Radial velocity component (negative = separating, positive = approaching)
    const v_radial = -kitePhysics.velocity.dot(direction); // Negative because direction points toward handle
    
    // Damping force opposes radial velocity
    // PBD_DAMPING is a dimensionless coefficient scaled by stiffness
    const rawDampingForce = ConstraintConfig.PBD_DAMPING * (-v_radial) * ConstraintConfig.LINE_STIFFNESS;
    
    // Safety: Clamp damping force to reasonable bounds (±50% of max constraint force)
    const maxDampingForce = ConstraintConfig.MAX_CONSTRAINT_FORCE * 0.5;
    const dampingForce = Math.max(-maxDampingForce, Math.min(rawDampingForce, maxDampingForce));

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: TOTAL FORCE APPLICATION - PHYSICS CORRECT
    // ─────────────────────────────────────────────────────────────────────
    //
    // PHYSICS PRINCIPLE: Lines only pull, they don't push!
    // - If kite is moving away (v_radial < 0): apply restraining force
    // - If kite is moving toward or stationary (v_radial >= 0): no force
    //
    // This prevents the kite from being "launched forward" when hitting line limits
    //

    let totalForce = 0;

    // Only apply force if kite is trying to move away from the handle
    if (v_radial < 0) {
      // Kite is separating: apply spring + damping forces
      const springComponent = springForce;
      const dampingComponent = dampingForce;

      // Total restraining force (always positive, pulls kite back)
      totalForce = Math.max(ConstraintConfig.MIN_TAUT_FORCE, springComponent + dampingComponent);
    } else {
      // Kite is approaching or stationary: minimal force to maintain tension
      totalForce = ConstraintConfig.MIN_TAUT_FORCE;
    }

    // Final safety clamp on total force
    const clampedTotalForce = Math.min(totalForce, ConstraintConfig.MAX_CONSTRAINT_FORCE);

    const constraintForce = direction.clone().multiplyScalar(clampedTotalForce);
    
    // ✅ ADD TO FORCE ACCUMULATOR
    // This force will be integrated by PhysicsSystem along with:
    // - Aerodynamic forces (AeroSystemNASA)
    // - Gravity (PhysicsSystem)
    // - Other external forces
    kitePhysics.forces.add(constraintForce);
    
    // Update tension for visualization/telemetry
    lineComp.currentTension = totalForce;

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: VELOCITY CORRECTION (soft, conditional)
    // ─────────────────────────────────────────────────────────────────────
    //
    // Only apply velocity correction if kite is actively separating
    // Prevents the kite from exceeding the maximum separation speed
    //
    const velocityThreshold = -1.0; // m/s (allow moderate separation)
    if (v_radial < velocityThreshold) {
      // Gently reduce excessive separation velocity component
      const excessVelocity = v_radial - velocityThreshold;
      const correctionFactor = 0.2; // 20% correction per frame (softer)
      const velocityCorrection = direction.clone().multiplyScalar(excessVelocity * correctionFactor);
      kitePhysics.velocity.add(velocityCorrection);
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: TORQUE GENERATION
    // ─────────────────────────────────────────────────────────────────────
    // 
    // The line pulls on the CTRL attachment point, creating a torque
    // around the kite's center of mass.
    // 
    // Torque formula: τ = r × F
    //   where: r = lever arm (from kite center to CTRL point)
    //          F = constraint force
    // 
    // This torque causes the kite to rotate, affecting its orientation
    // and angle of attack.
    // 
    const r = ctrlPos.clone().sub(kiteTransform.position);
    const torque = new THREE.Vector3().crossVectors(r, constraintForce);
    kitePhysics.torques.add(torque);

    // ─────────────────────────────────────────────────────────────────────
    // DEBUG LOGGING
    // ─────────────────────────────────────────────────────────────────────
    if (this.debugForces && this.debugFrameCounter % this.DEBUG_LOG_INTERVAL === 0) {
      const lineName = handlePos.x < 0 ? 'LEFT' : 'RIGHT';
      console.log(`\n🔗 [ConstraintSystem] ${lineName} LINE at CTRL:`);
      console.log(`   📏 Distance: ${distance.toFixed(3)}m (rest: ${lineComp.restLength.toFixed(1)}m)`);
      console.log(`   ↔️  Elongation: ${excess.toFixed(3)}m (${(lineComp.state.strainRatio * 100).toFixed(1)}%)`);
      console.log(`   💨 Velocity radial: ${v_radial.toFixed(2)} m/s ${v_radial < 0 ? '(separating ⬅️)' : '(approaching ➡️)'}`);
      console.log(`   🔧 Forces:`);
      console.log(`      - Spring: ${springForce.toFixed(1)} N`);
      console.log(`      - Damping: ${dampingForce.toFixed(1)} N`);
      console.log(`      - Total: ${clampedTotalForce.toFixed(1)} N`);
      console.log(`   ⚡ Force vector: (${constraintForce.x.toFixed(1)}, ${constraintForce.y.toFixed(1)}, ${constraintForce.z.toFixed(1)}) N`);
      console.log(`   🔄 Torque: (${torque.x.toFixed(2)}, ${torque.y.toFixed(2)}, ${torque.z.toFixed(2)}) N·m`);
      console.log(`   📊 Tension (for viz): ${lineComp.currentTension.toFixed(1)} N`);
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
