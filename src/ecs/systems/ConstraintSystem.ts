/**
 * ConstraintSystem.ts - Gestion des contraintes passives (lignes de vol, sol)
 *
 * Utilise Position-Based Dynamics (PBD) COMPLET pour les contraintes de longueur des lignes.
 * PBD résout les contraintes géométriques directement en corrigeant les positions ET rotations,
 * plutôt que d'appliquer des forces ressort qui peuvent être instables.
 *
 * Avantages PBD :
 * - Contraintes rigides stables (pas d'explosions)
 * - Pas de tuning stiffness/damping
 * - Convergence garantie avec itérations suffisantes
 * - Plus réaliste pour lignes de cerf-volant (quasi-inextensibles)
 *
 * PBD COMPLET (position + rotation) :
 * 1. Calcul violation contrainte : C = |distance - restLength|
 * 2. Correction position : Δp = -C × direction × (inverse masse)
 * 3. Correction rotation : Δθ = -I^(-1) × λ × (r × n)  [CRITIQUE pour les lignes hors centre de masse]
 * 4. Amortissement linéaire + angulaire pour stabilité
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
import { CONFIG } from '../config/Config';

// Constantes de contraintes
const GROUND_Y = 0;
const EPSILON = 0.001;
const PRIORITY = 40; // AVANT PhysicsSystem (50), pour correction des positions dans la même frame

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

    // === PBD: Résolution itérative des contraintes de longueur ===
    // Contrairement aux forces ressort, PBD corrige directement les positions
    // pour satisfaire les contraintes géométriques
    
    const iterations = CONFIG.lines.pbdIterations;
    
    for (let iter = 0; iter < iterations; iter++) {
      // Contraintes pour chaque ligne
      if (leftLine) {
        const leftLineComp = leftLine.getComponent<LineComponent>('line');
        if (leftLineComp) {
          this.applyPBDConstraint({
            lineComponent: leftLineComp,
            barEntity: controlBar,
            kiteEntity: kite,
            barPoint: 'leftHandle',
            kitePoint: 'CTRL_GAUCHE',
            kiteTransform,
            kitePhysics,
            deltaTime
          });
        }
      }

      if (rightLine) {
        const rightLineComp = rightLine.getComponent<LineComponent>('line');
        if (rightLineComp) {
          this.applyPBDConstraint({
            lineComponent: rightLineComp,
            barEntity: controlBar,
            kiteEntity: kite,
            barPoint: 'rightHandle',
            kitePoint: 'CTRL_DROIT',
            kiteTransform,
            kitePhysics,
            deltaTime
          });
        }
      }
    }

    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  /**
   * Applique une contrainte PBD (Position-Based Dynamics) pour maintenir la longueur de ligne.
   * 
   * Algorithme PBD:
   * 1. Calculer la violation de contrainte: C = |distance - restLength|
   * 2. Si C > 0 (ligne tendue), calculer la correction: Δx = -C × direction × compliance
   * 3. Appliquer correction aux positions (répartie selon masses inverses)
   * 4. Mettre à jour vitesses implicitement via changement de position
   */
  private applyPBDConstraint(params: {
    lineComponent: LineComponent;
    barEntity: Entity;
    kiteEntity: Entity;
    barPoint: string;
    kitePoint: string;
    kiteTransform: TransformComponent;
    kitePhysics: PhysicsComponent;
    deltaTime: number;
  }): void {
    const {
      lineComponent,
      barEntity,
      kiteEntity,
      barPoint,
      kitePoint,
      kiteTransform,
      kitePhysics,
      deltaTime
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

    // === 1. CALCUL DE LA CONTRAINTE ===
    const toBar = barPointWorld.clone().sub(kitePointWorld);
    const distance = toBar.length();

    // Protection NaN: Vérifier que la distance est valide
    if (!isFinite(distance) || distance < EPSILON) {
      console.warn('[ConstraintSystem] Distance invalide détectée:', distance);
      return;
    }

    lineComponent.currentLength = distance;
    lineComponent.state.currentLength = distance;

    // Contrainte unilatérale: pas de poussée (seulement tension)
    if (distance <= lineComponent.restLength) {
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.state.strainRatio = 0;
      lineComponent.currentTension = 0;
      return;
    }

    const direction = toBar.clone().normalize();
    
    // Protection NaN: Vérifier que la direction est valide
    if (!isFinite(direction.x) || !isFinite(direction.y) || !isFinite(direction.z)) {
      console.warn('[ConstraintSystem] Direction invalide détectée');
      return;
    }
    
    const extension = distance - lineComponent.restLength;

    lineComponent.state.isTaut = true;
    lineComponent.state.elongation = extension;
    lineComponent.state.strainRatio = lineComponent.restLength > EPSILON
      ? extension / lineComponent.restLength
      : 0;

    // === 2. CALCUL DE LA CORRECTION PBD ===
    // C(x) = distance - restLength (violation de contrainte)
    // Correction: Δx = -C × ∇C / (|∇C|² × (w1 + w2) + α/Δt²)
    // où: w = inverse de masse, α = compliance, ∇C = gradient = direction normalisée
    
    // Protection deltaTime invalide
    if (deltaTime < EPSILON) {
      console.warn('[ConstraintSystem] deltaTime trop petit:', deltaTime);
      return;
    }
    
    const compliance = CONFIG.lines.pbdCompliance; // α (souplesse)
    const w1 = 1.0 / kitePhysics.mass; // Inverse masse kite
    const w2 = 1.0 / barPhysics.mass; // Inverse masse barre
    
    // Protection: Vérifier que les masses sont valides
    if (!isFinite(w1) || !isFinite(w2)) {
      console.warn('[ConstraintSystem] Masses invalides détectées');
      return;
    }
    
    // Régularisation avec compliance (évite divisions par zéro)
    const alpha = compliance / (deltaTime * deltaTime);
    const denominator = w1 + w2 + alpha;
    
    if (denominator < EPSILON || !isFinite(denominator)) {
      console.warn('[ConstraintSystem] Dénominateur invalide:', denominator);
      return;
    }
    
    // Magnitude de la correction
    const lambda = -extension / denominator;
    
    // Protection: Vérifier que lambda est valide
    if (!isFinite(lambda)) {
      console.warn('[ConstraintSystem] Lambda invalide:', lambda);
      return;
    }
    
    // Correction de position pour chaque objet (proportionnelle à masse inverse)
    const correctionKite = direction.clone().multiplyScalar(lambda * w1);
    const correctionBar = direction.clone().multiplyScalar(-lambda * w2);
    
    // LIMITE LA MAGNITUDE DE CORRECTION (évite sauts énormes)
    const maxCorrection = CONFIG.lines.pbdMaxCorrection;
    if (correctionKite.length() > maxCorrection) {
      correctionKite.setLength(maxCorrection);
    }
    if (correctionBar.length() > maxCorrection) {
      correctionBar.setLength(maxCorrection);
    }
    
    // Protection: Vérifier que les corrections sont valides
    if (!isFinite(correctionKite.x) || !isFinite(correctionKite.y) || !isFinite(correctionKite.z)) {
      console.warn('[ConstraintSystem] Correction kite invalide');
      return;
    }
    if (!isFinite(correctionBar.x) || !isFinite(correctionBar.y) || !isFinite(correctionBar.z)) {
      console.warn('[ConstraintSystem] Correction bar invalide');
      return;
    }
    
    // === 3. APPLICATION DES CORRECTIONS ===
    // PBD COMPLET : Correction position + rotation

    // 3a. Corriger la position du kite
    kiteTransform.position.add(correctionKite);
    barTransform.position.add(correctionBar);

    // 3b. Corriger la rotation du kite (couple généré par le bras de levier)
    // Bras de levier : r = point_attache_world - centre_masse
    const kiteAttachmentOffset = kitePointWorld.clone().sub(kiteTransform.position);

    // Moment angulaire : α = r × direction
    const torqueAxis = new THREE.Vector3().crossVectors(kiteAttachmentOffset, direction);

    // Magnitude du couple proportionnelle à lambda et à l'inverse de l'inertie
    // En PBD, la correction angulaire est : Δθ = -I^(-1) * λ * (r × n)
    // On utilise une inertie scalaire simplifiée (moyenne des composantes)
    const I_avg = (kitePhysics.inertia.elements[0] + kitePhysics.inertia.elements[4] + kitePhysics.inertia.elements[8]) / 3;
    const invInertia = I_avg > EPSILON ? 1.0 / I_avg : 0;

    // Correction angulaire
    const deltaTheta = torqueAxis.clone().multiplyScalar(-invInertia * lambda);
    const angle = deltaTheta.length();

    if (angle > EPSILON && isFinite(angle)) {
      const axis = deltaTheta.normalize();
      const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      kiteTransform.quaternion.premultiply(deltaQuat).normalize();
    }

    // Vérification finale des positions et quaternions
    if (!isFinite(kiteTransform.position.x) || !isFinite(kiteTransform.position.y) || !isFinite(kiteTransform.position.z)) {
      console.error('[ConstraintSystem] Position kite corrompue! Réinitialisation...');
      kiteTransform.position.set(0, 10, -15);
      return;
    }

    if (!isFinite(kiteTransform.quaternion.x) || !isFinite(kiteTransform.quaternion.y) ||
        !isFinite(kiteTransform.quaternion.z) || !isFinite(kiteTransform.quaternion.w)) {
      console.error('[ConstraintSystem] Quaternion kite corrompu! Réinitialisation...');
      kiteTransform.quaternion.set(0, 0, 0, 1);
      return;
    }
    
    // === 4. AMORTISSEMENT DES VITESSES (linéaire + angulaire) ===
    // Amortir la vitesse radiale ET la vitesse angulaire pour stabiliser la contrainte

    // 4a. Amortissement linéaire (comme avant)
    const LINE_DAMPING = 0.5; // Facteur d'amortissement
    const radialVelKite = kitePhysics.velocity.dot(direction);
    if (radialVelKite > 0) {
      // Le kite s'éloigne → freiner cette composante
      const dampingImpulse = direction.clone().multiplyScalar(-LINE_DAMPING * radialVelKite);
      kitePhysics.velocity.add(dampingImpulse);
    }

    const radialVelBar = barPhysics.velocity.dot(direction);
    if (radialVelBar < 0) {
      // La barre s'approche du kite (direction opposée) → freiner
      const dampingImpulse = direction.clone().multiplyScalar(-LINE_DAMPING * radialVelBar);
      barPhysics.velocity.add(dampingImpulse);
    }

    // 4b. Amortissement angulaire (nouveau, critique pour stabilité!)
    // Si le kite tourne, l'amortissement angulaire évite les oscillations
    if (radialVelKite > 0 && invInertia > 0) {
      const angularDampingImpulse = torqueAxis.clone().multiplyScalar(-LINE_DAMPING * radialVelKite * invInertia);
      kitePhysics.angularVelocity.add(angularDampingImpulse);
    }

    // Protection: Vérifier que les vitesses restent valides
    if (!isFinite(kitePhysics.velocity.x) || !isFinite(kitePhysics.velocity.y) || !isFinite(kitePhysics.velocity.z)) {
      console.error('[ConstraintSystem] Vitesse kite corrompue! Réinitialisation...');
      kitePhysics.velocity.set(0, 0, 0);
    }

    if (!isFinite(kitePhysics.angularVelocity.x) || !isFinite(kitePhysics.angularVelocity.y) || !isFinite(kitePhysics.angularVelocity.z)) {
      console.error('[ConstraintSystem] Vitesse angulaire kite corrompue! Réinitialisation...');
      kitePhysics.angularVelocity.set(0, 0, 0);
    }
    
    // === 5. ESTIMATION DE LA TENSION (pour debug/visualisation) ===
    // En PBD, la tension n'est pas calculée directement, mais peut être estimée
    // à partir de la force de correction: F ≈ λ / Δt²
    const estimatedTension = Math.abs(lambda) / (deltaTime * deltaTime);
    lineComponent.currentTension = isFinite(estimatedTension) ? estimatedTension : 0;
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
