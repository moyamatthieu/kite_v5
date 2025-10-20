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
   * MODE PBD : Position-Based Dynamics - SIMPLE ET STABLE
   * 
   * Approche ultra-simple : contrainte de distance inélastique
   * - Mesurer la distance entre CTRL et handle
   * - Si distance > restLength, projeter le kite pour ramener à restLength
   * - Pas d'itérations complexes, pas de calculs de lambda
   */
  private updatePBD(context: SimulationContext): void {
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

    if (!kiteTransform || !kitePhysics) {
      return;
    }

    if (kitePhysics.isKinematic) {
      return;
    }

    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');
    if (!kiteGeometry) return;

    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!barGeometry) return;

    // Récupérer positions monde actuelles
    const ctrlGauche = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlDroit = kiteGeometry.getPointWorld('CTRL_DROIT', kite);
    const leftHandle = barGeometry.getPointWorld('leftHandle', controlBar);
    const rightHandle = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!ctrlGauche || !ctrlDroit || !leftHandle || !rightHandle) {
      return;
    }

    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');

    if (!leftLineComp || !rightLineComp) {
      return;
    }

    // === SIMPLE CONSTRAINT : Project onto distance sphere ===
    // Si distance > restLength, rapprocher le kite du handle
    const leftDist = leftHandle.distanceTo(ctrlGauche);
    const rightDist = rightHandle.distanceTo(ctrlDroit);

    // Mettre à jour les états des lignes
    leftLineComp.currentLength = leftDist;
    leftLineComp.state.currentLength = leftDist;
    rightLineComp.currentLength = rightDist;
    rightLineComp.state.currentLength = rightDist;

    if (leftDist > leftLineComp.restLength) {
      leftLineComp.state.isTaut = true;
      leftLineComp.state.elongation = leftDist - leftLineComp.restLength;
      leftLineComp.state.strainRatio = leftLineComp.state.elongation / leftLineComp.restLength;
      leftLineComp.currentTension = leftLineComp.state.elongation * 100; // Approximation
    } else {
      leftLineComp.state.isTaut = false;
      leftLineComp.state.elongation = 0;
      leftLineComp.state.strainRatio = 0;
      leftLineComp.currentTension = 0;
    }

    if (rightDist > rightLineComp.restLength) {
      rightLineComp.state.isTaut = true;
      rightLineComp.state.elongation = rightDist - rightLineComp.restLength;
      rightLineComp.state.strainRatio = rightLineComp.state.elongation / rightLineComp.restLength;
      rightLineComp.currentTension = rightLineComp.state.elongation * 100;
    } else {
      rightLineComp.state.isTaut = false;
      rightLineComp.state.elongation = 0;
      rightLineComp.state.strainRatio = 0;
      rightLineComp.currentTension = 0;
    }

    // === ÉTAPE 1: APPLIQUER LES FORCES DES LIGNES POUR GÉNÉRER DU TORQUE ===
    // IMPORTANT: Sans les forces, le kite ne peut pas se tourner pour générer de la portance!
    // On applique une force qui crée un torque permettant au kite de s'orienter au vent.
    
    // Ligne gauche - calcul de la force pour créer un torque
    if (leftDist > 0) {
      const direction = leftHandle.clone().sub(ctrlGauche).normalize();
      const elongation = Math.max(0, leftDist - leftLineComp.restLength);
      const k = 100; // Rigidité de la ligne
      const magnitude = k * elongation;
      
      // Force sur le CTRL point crée un torque autour du centre du kite
      const force = direction.multiplyScalar(magnitude);
      kitePhysics.forces.add(force);
      
      // Torque = r × F (r = vecteur du centre à CTRL)
      const r = ctrlGauche.clone().sub(kiteTransform.position);
      const torque = new THREE.Vector3().crossVectors(r, force);
      kitePhysics.torques.add(torque);
    }

    // Ligne droite
    if (rightDist > 0) {
      const direction = rightHandle.clone().sub(ctrlDroit).normalize();
      const elongation = Math.max(0, rightDist - rightLineComp.restLength);
      const k = 100;
      const magnitude = k * elongation;
      
      const force = direction.multiplyScalar(magnitude);
      kitePhysics.forces.add(force);
      
      const r = ctrlDroit.clone().sub(kiteTransform.position);
      const torque = new THREE.Vector3().crossVectors(r, force);
      kitePhysics.torques.add(torque);
    }

    // === ÉTAPE 2: PROJECTION DE DISTANCE - CONTRAINTE RIGIDE ===
    // Ramener le kite si les lignes dépassent la limite
    let correction = new THREE.Vector3(0, 0, 0);

    // Contrainte gauche
    if (leftDist > leftLineComp.restLength) {
      const direction = ctrlGauche.clone().sub(leftHandle).normalize();
      const delta = leftDist - leftLineComp.restLength;
      correction.add(direction.multiplyScalar(delta * 0.5)); // 50% de la correction pour chaque ligne
    }

    // Contrainte droite
    if (rightDist > rightLineComp.restLength) {
      const direction = ctrlDroit.clone().sub(rightHandle).normalize();
      const delta = rightDist - rightLineComp.restLength;
      correction.add(direction.multiplyScalar(delta * 0.5));
    }

    // Appliquer la correction (ramener le kite VERS la barre, pas le repousser)
    if (correction.length() > EPSILON) {
      correction.multiplyScalar(-1); // Inverser pour rapprocher
      kiteTransform.position.add(correction);
    }

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
    if (deltaTime < EPSILON) return;

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
    if (transform.position.y < GROUND_Y) {
      transform.position.y = GROUND_Y;

      if (physics.velocity.y < 0) {
        physics.velocity.y = 0;
      }
    }
  }
}
