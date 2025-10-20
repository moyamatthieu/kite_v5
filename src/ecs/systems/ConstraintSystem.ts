/**
 * ConstraintSystem.ts - Gestion des contraintes de lignes (PBD complet)
 *
 * ARCHITECTURE INSPIRÉE DU LEGACY (ConstraintSolverPBD.ts) :
 *
 * Le problème des approches précédentes :
 * - Modifier transform.position/quaternion pendant les itérations
 * - Les points CTRL bougent à chaque itération (coordonnées locales)
 * - Les 2 lignes se battent entre elles
 *
 * Solution legacy :
 * 1. Sauvegarder l'état initial (position, quaternion)
 * 2. Calculer positions monde CTRL avec état initial
 * 3. Itérer pour résoudre les 2 contraintes ensemble
 * 4. Appliquer les corrections finales une seule fois
 *
 * Priorité 40 (AVANT PhysicsSystem 50, APRÈS AeroSystem 30)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { LineComponent } from '../components/LineComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { CONFIG } from '../config/Config';

const GROUND_Y = 0;
const EPSILON = 0.001;
const PRIORITY = 40;

export class ConstraintSystem extends System {
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
      this.solveLineConstraint({
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
      this.solveLineConstraint({
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

    // Amortir les vitesses (projection)
    this.dampVelocities(kitePhysics, deltaPosition, deltaQuaternion, deltaTime);

    // Collision sol
    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  /**
   * Résout une contrainte de ligne individuelle
   * Modifie correctedPosition et correctedQuaternion par référence
   */
  private solveLineConstraint(params: {
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
    const denominator = invMass + rCrossN.lengthSq() * invInertia + alpha;

    if (denominator < EPSILON) {
      return;
    }

    const lambda = -extension / denominator;

    // === 3. CORRECTIONS (appliquées aux variables temporaires) ===
    // Position
    const deltaP = direction.clone().multiplyScalar(lambda * invMass);

    // Limiter magnitude
    const maxCorrection = CONFIG.lines.pbd.maxCorrection;
    if (deltaP.length() > maxCorrection) {
      deltaP.setLength(maxCorrection);
    }

    correctedPosition.add(deltaP);

    // Rotation
    const deltaTheta = rCrossN.clone().multiplyScalar(-lambda * invInertia);
    const angle = deltaTheta.length();

    if (angle > EPSILON && isFinite(angle)) {
      const axis = deltaTheta.normalize();
      const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      correctedQuaternion.premultiply(deltaQuat).normalize();
    }

    // Estimation tension
    const estimatedTension = Math.abs(lambda) / (deltaTime * deltaTime);
    lineComponent.currentTension = isFinite(estimatedTension) ? estimatedTension : 0;
  }

  /**
   * Amortit les vitesses basées sur les corrections appliquées
   */
  private dampVelocities(
    physics: PhysicsComponent,
    deltaPosition: THREE.Vector3,
    _deltaQuaternion: THREE.Quaternion,
    deltaTime: number
  ): void {
    if (deltaTime < EPSILON) return;

    // Amortissement basé sur le mouvement
    const dampingFactor = 0.5;

    // Vitesse linéaire induite par correction
    const correctionVelocity = deltaPosition.clone().multiplyScalar(1.0 / deltaTime);

    // Projeter et amortir
    const radialComponent = physics.velocity.dot(correctionVelocity.normalize());
    if (radialComponent > 0) {
      physics.velocity.sub(
        correctionVelocity.normalize().multiplyScalar(dampingFactor * radialComponent)
      );
    }

    // Amortissement angulaire (simplifié)
    // L'angle de rotation induit un changement de vitesse angulaire
    physics.angularVelocity.multiplyScalar(0.95);
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
