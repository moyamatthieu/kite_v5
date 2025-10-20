/**
 * ConstraintSystem.ts - Gestion des contraintes de lignes (PBD + Spring-Force)
 *
 * DUAL MODE CONSTRAINT SYSTEM :
 *
 * 1. PBD (Position-Based Dynamics) - Architecture inspirée du legacy :
 *    - Sauvegarder l'état initial (position, quaternion)
 *    - Calculer positions monde CTRL avec état initial
 *    - Itérer pour résoudre les 2 contraintes ensemble (Gauss-Seidel)
 *    - Appliquer les corrections finales une seule fois
 *    - Avantages : Rigide, stable, pas d'oscillations
 *
 * 2. Spring-Force (Forces ressort classiques) :
 *    - Calculer extension de chaque ligne
 *    - Appliquer force F = -k × extension - c × vitesse
 *    - Distribuer force/torque selon point d'attache
 *    - Avantages : Physique intuitive, tuneable
 *
 * Le mode est sélectionné via InputComponent.constraintMode
 *
 * Priorité 40 (AVANT PhysicsSystem 50, APRÈS AeroSystem 30)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { LineComponent } from '../components/LineComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { InputComponent } from '../components/InputComponent';
import { CONFIG } from '../config/Config';

const GROUND_Y = 0;
const EPSILON = 0.001;
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
   * MODE PBD : Position-Based Dynamics avec architecture legacy
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
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');

    if (!kiteTransform || !kitePhysics || !kiteGeometry) {
      return;
    }

    if (kitePhysics.isKinematic) {
      return;
    }

    // === ARCHITECTURE LEGACY : Sauvegarder état initial ===
    const initialPosition = kiteTransform.position.clone();
    const initialQuaternion = kiteTransform.quaternion.clone();

    // Calculer positions monde CTRL avec état initial (UNE FOIS)
    const ctrlGaucheLocal = kiteGeometry.getPoint('CTRL_GAUCHE');
    const ctrlDroitLocal = kiteGeometry.getPoint('CTRL_DROIT');

    if (!ctrlGaucheLocal || !ctrlDroitLocal) {
      console.warn('[ConstraintSystem] Points CTRL manquants');
      return;
    }

    // === Positions des handles (barre) ===
    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    const barTransform = controlBar.getComponent<TransformComponent>('transform');

    if (!barGeometry || !barTransform) {
      return;
    }

    const leftHandleWorld = barGeometry.getPointWorld('leftHandle', controlBar);
    const rightHandleWorld = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!leftHandleWorld || !rightHandleWorld) {
      return;
    }

    // === RÉSOLUTION PBD : Itérations Gauss-Seidel ===
    // On modifie des variables temporaires, pas les transforms
    let correctedPosition = initialPosition.clone();
    let correctedQuaternion = initialQuaternion.clone();

    const iterations = CONFIG.lines.pbd.iterations;
    const compliance = CONFIG.lines.pbd.compliance;
    const invMass = 1.0 / kitePhysics.mass;

    // Inertie moyenne (simplifié)
    const I_avg = (kitePhysics.inertia.elements[0] +
                   kitePhysics.inertia.elements[4] +
                   kitePhysics.inertia.elements[8]) / 3;
    const invInertia = I_avg > EPSILON ? 1.0 / I_avg : 0;

    if (deltaTime < EPSILON) {
      return; // Éviter division par zéro
    }

    const alpha = compliance / (deltaTime * deltaTime);

    // Composants des lignes
    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');

    if (!leftLineComp || !rightLineComp) {
      return;
    }

    // === ITÉRATIONS PBD ===
    for (let iter = 0; iter < iterations; iter++) {
      // Recalculer positions CTRL avec état corrigé
      const ctrlLeftCurrent = ctrlGaucheLocal.clone()
        .applyQuaternion(correctedQuaternion)
        .add(correctedPosition);

      const ctrlRightCurrent = ctrlDroitLocal.clone()
        .applyQuaternion(correctedQuaternion)
        .add(correctedPosition);

      // === CONTRAINTE LIGNE GAUCHE ===
      this.solveLineConstraintPBD({
        ctrlWorld: ctrlLeftCurrent,
        handleWorld: leftHandleWorld,
        restLength: leftLineComp.restLength,
        correctedPosition,
        correctedQuaternion,
        invMass,
        invInertia,
        alpha,
        lineComponent: leftLineComp,
        deltaTime
      });

      // === CONTRAINTE LIGNE DROITE ===
      this.solveLineConstraintPBD({
        ctrlWorld: ctrlRightCurrent,
        handleWorld: rightHandleWorld,
        restLength: rightLineComp.restLength,
        correctedPosition,
        correctedQuaternion,
        invMass,
        invInertia,
        alpha,
        lineComponent: rightLineComp,
        deltaTime
      });
    }

    // === APPLICATION DES CORRECTIONS FINALES ===
    // Calculer les deltas
    const deltaPosition = correctedPosition.clone().sub(initialPosition);
    const deltaQuaternion = correctedQuaternion.clone().multiply(initialQuaternion.clone().invert());

    // Appliquer au kite
    kiteTransform.position.copy(correctedPosition);
    kiteTransform.quaternion.copy(correctedQuaternion);

    // ✅ ARCHITECTURE ECS PURE : Les points CTRL locaux restent INCHANGÉS
    // Seuls position/quaternion du kite changent. Les positions WORLD des CTRL
    // seront automatiquement correctes via getPointWorld() qui applique le transform.
    // Les points CTRL locaux ne sont modifiés QUE par BridleConstraintSystem
    // lors des changements de longueurs de brides.

    // Amortir les vitesses (projection)
    this.dampVelocities(kitePhysics, deltaPosition, deltaQuaternion, deltaTime);

    // Collision sol
    this.handleGroundCollision(kiteTransform, kitePhysics);
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
  private solveLineConstraintPBD(params: {
    ctrlWorld: THREE.Vector3;
    handleWorld: THREE.Vector3;
    restLength: number;
    correctedPosition: THREE.Vector3;
    correctedQuaternion: THREE.Quaternion;
    invMass: number;
    invInertia: number;
    alpha: number;
    lineComponent: LineComponent;
    deltaTime: number;
  }): void {
    const {
      ctrlWorld,
      handleWorld,
      restLength,
      correctedPosition,
      correctedQuaternion,
      invMass,
      invInertia,
      alpha,
      lineComponent,
      deltaTime
    } = params;

    // === 1. CALCUL VIOLATION ===
    const diff = handleWorld.clone().sub(ctrlWorld);
    const distance = diff.length();

    if (distance < EPSILON) {
      return;
    }

    const direction = diff.normalize();
    const extension = distance - restLength;

    // Mettre à jour état ligne
    lineComponent.currentLength = distance;
    lineComponent.state.currentLength = distance;

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

    // === 2. CALCUL LAMBDA PBD ===
    // Bras de levier
    const r = ctrlWorld.clone().sub(correctedPosition);
    const rCrossN = new THREE.Vector3().crossVectors(r, direction);
    let denominator = invMass + rCrossN.lengthSq() * invInertia + alpha;

    if (denominator < EPSILON) {
      return;
    }

    // ✨ Assurer une stabilité minimale : limiter le lambda maximum ✨
    const minDenominator = Math.max(EPSILON, 0.1); // Minimum raisonnable pour éviter lambdas énormes
    denominator = Math.max(denominator, minDenominator);

    const lambda = -extension / denominator;

    // ✨ PROTECTIONS POUR STABILITÉ ✨
    // Limiter lambda de façon STRICTE pour convergence stable
    const maxLambda = CONFIG.lines.pbd.maxLambda; // Limite stricte = 100
    const clampedLambda = Math.max(Math.min(lambda, maxLambda), -maxLambda);

    // Si lambda s'écarte trop, cela indique une instabilité
    if (!isFinite(clampedLambda)) {
      return;
    }

    // === 3. CORRECTIONS (appliquées aux variables temporaires) ===
    // Position
    const deltaP = direction.clone().multiplyScalar(clampedLambda * invMass);

    // Limiter magnitude
    const maxCorrection = CONFIG.lines.pbd.maxCorrection;
    if (deltaP.length() > maxCorrection) {
      deltaP.setLength(maxCorrection);
    }

    correctedPosition.add(deltaP);

    // Rotation
    const deltaTheta = rCrossN.clone().multiplyScalar(-clampedLambda * invInertia);
    const angle = deltaTheta.length();

    if (angle > EPSILON && isFinite(angle)) {
      const axis = deltaTheta.normalize();
      const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      correctedQuaternion.premultiply(deltaQuat).normalize();
    }

    // Estimation tension
    const estimatedTension = Math.abs(clampedLambda) / (deltaTime * deltaTime);
    lineComponent.currentTension = isFinite(estimatedTension) ? estimatedTension : 0;
  }

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

    if (distance < EPSILON) {
      return;
    }

    const direction = diff.normalize();
    const extension = distance - restLength;

    // Mettre à jour état ligne
    lineComponent.currentLength = distance;
    lineComponent.state.currentLength = distance;

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
   * Met à jour les vitesses basées sur les corrections PBD appliquées
   * 
   * CRITIQUE : En PBD, on modifie directement la position. Il faut mettre à jour
   * la vitesse pour refléter ce changement, sinon PhysicsSystem (priorité 50)
   * va intégrer l'ancienne vitesse et annuler la correction PBD.
   * 
   * Solution : velocity = deltaPosition / deltaTime
   * Cela synchronise la vitesse avec le mouvement imposé par les contraintes.
   */
  private dampVelocities(
    physics: PhysicsComponent,
    deltaPosition: THREE.Vector3,
    deltaQuaternion: THREE.Quaternion,
    deltaTime: number
  ): void {
    if (deltaTime < EPSILON) return;

    // === VITESSE LINÉAIRE ===
    // La vitesse doit refléter le déplacement imposé par PBD
    const correctionVelocity = deltaPosition.clone().multiplyScalar(1.0 / deltaTime);
    
    // METTRE À JOUR la vitesse (ne pas juste amortir)
    // On remplace la composante de vitesse dans la direction de la correction
    physics.velocity.copy(correctionVelocity);

    // === VITESSE ANGULAIRE ===
    // Extraire l'angle de rotation depuis le quaternion de correction
    // deltaQuaternion représente la rotation appliquée
    const angle = 2 * Math.acos(Math.min(1, Math.abs(deltaQuaternion.w)));
    
    if (angle > EPSILON) {
      // Axe de rotation (normalisé)
      const sinHalfAngle = Math.sqrt(1 - deltaQuaternion.w * deltaQuaternion.w);
      if (sinHalfAngle > EPSILON) {
        const axis = new THREE.Vector3(
          deltaQuaternion.x / sinHalfAngle,
          deltaQuaternion.y / sinHalfAngle,
          deltaQuaternion.z / sinHalfAngle
        );
        
        // Vitesse angulaire = angle / deltaTime × axe
        const angularSpeed = angle / deltaTime;
        physics.angularVelocity.copy(axis.multiplyScalar(angularSpeed));
      }
    } else {
      // Pas de rotation significative, mettre vitesse angulaire à zéro
      physics.angularVelocity.set(0, 0, 0);
    }
  }

  /**
   * Gère la collision avec le sol
   */
  private handleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < GROUND_Y) {
      transform.position.y = GROUND_Y;

      if (physics.velocity.y < 0) {
        physics.velocity.y = 0;
      }
    }
  }
}
