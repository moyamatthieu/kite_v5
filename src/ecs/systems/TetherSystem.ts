/**
 * TetherSystem.ts - Système de lignes inextensibles ultra-simplifié
 *
 * PHYSIQUE ULTRA-SIMPLE D'UNE LIGNE DE KITE:
 * ═══════════════════════════════════════════
 *
 * 1. DEUX POINTS A et B avec longueur maximale L
 * 2. COMPLÈTEMENT FLEXIBLE quand distance < L (aucune force)
 * 3. DROITE/INEXTENSIBLE quand distance >= L
 * 4. TRANSFERT TRACTION BIDIRECTIONNEL (tire mais ne pousse pas)
 *
 * ALGORITHME ULTRA-SIMPLE:
 * ────────────────────────
 * Pour chaque ligne (A ↔ B):
 *
 *   if distance < maxLength:
 *       return; // Complètement flexible, aucune force
 *
 *   // distance >= maxLength → ligne tendue
 *   direction = normalize(B - A)
 *
 *   // Vérifier si le kite s'éloigne (pour éviter de pousser)
 *   v_radial = velocity_B · direction
 *   if v_radial < 0: // Kite s'éloigne
 *       force = K × (distance - maxLength) × direction
 *       appliquer force au point B (vers A)
 *
 * C'EST TOUT ! Pas de ressort, pas de damping complexe.
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { LineComponent } from '../components/LineComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { PhysicsConstants, ConstraintConfig } from '../config/Config';
import { MathUtils } from '../utils/MathUtils';

const PRIORITY = 40;

export class TetherSystem extends System {
  constructor() {
    super('TetherSystem', PRIORITY);
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    // Récupérer les entités
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

    if (!kiteTransform || !kitePhysics || !kiteGeometry || kitePhysics.isKinematic) {
      return;
    }

    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!barGeometry) return;

    // Points d'attache du kite (CTRL_GAUCHE et CTRL_DROIT)
    const ctrlLeft = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlRight = kiteGeometry.getPointWorld('CTRL_DROIT', kite);

    // Points d'attache de la barre (poignets)
    const poignetGauche = barGeometry.getPointWorld('poignet_gauche', controlBar);
    const poignetDroit = barGeometry.getPointWorld('poignet_droit', controlBar);

    if (!ctrlLeft || !ctrlRight || !poignetGauche || !poignetDroit) {
      return;
    }

    // Composants des lignes
    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');

    if (!leftLineComp || !rightLineComp) {
      return;
    }

    // === LIGNE GAUCHE ===
    this.solveSimpleTether({
      pointA: poignetGauche,      // Poignet gauche (X<0)
      pointB: ctrlLeft,        // CTRL gauche sur kite (X<0)
      maxLength: leftLineComp.restLength,
      kiteTransform,
      kitePhysics,
      lineComponent: leftLineComp
    });

    // === LIGNE DROITE ===
    this.solveSimpleTether({
      pointA: poignetDroit,     // Poignet droit (X>0)
      pointB: ctrlRight,       // CTRL droit sur kite (X>0)
      maxLength: rightLineComp.restLength,
      kiteTransform,
      kitePhysics,
      lineComponent: rightLineComp
    });

    // === COLLISION SOL ===
    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  /**
   * Résout une contrainte de ligne ultra-simple
   *
   * ALGORITHME ULTRA-SIMPLE:
   * 1. Si distance < maxLength → aucune force (complètement flexible)
   * 2. Si distance >= maxLength ET kite s'éloigne → force de rappel douce
   */
  private solveSimpleTether(params: {
    pointA: THREE.Vector3;
    pointB: THREE.Vector3;
    maxLength: number;
    kiteTransform: TransformComponent;
    kitePhysics: PhysicsComponent;
    lineComponent: LineComponent;
  }): void {
    const { pointA, pointB, maxLength, kiteTransform, kitePhysics, lineComponent } = params;

    // Calculer distance et direction
    const diff = pointB.clone().sub(pointA); // De A vers B
    const distance = diff.length();

    if (distance < PhysicsConstants.EPSILON) {
      return;
    }

    // Mettre à jour la longueur actuelle
    lineComponent.currentLength = distance;

    // ═══════════════════════════════════════════════════════════════════════
    // LOGIQUE ULTRA-SIMPLE
    // ═══════════════════════════════════════════════════════════════════════

    // 1. COMPLÈTEMENT FLEXIBLE si distance < maxLength
    if (distance < maxLength) {
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.state.strainRatio = 0;
      lineComponent.currentTension = 0;
      return; // ✅ AUCUNE FORCE
    }

    // 2. DROITE/INEXTENSIBLE si distance >= maxLength
    lineComponent.state.isTaut = true;
    const excess = distance - maxLength;
    
    lineComponent.state.elongation = excess;
    lineComponent.state.strainRatio = excess / maxLength;

    // Direction normalisée de B vers A (pour tirer B vers A)
    const direction = diff.clone().normalize();

    // ═══════════════════════════════════════════════════════════════════════
    // MODÈLE PHYSIQUE: RESSORT-AMORTISSEUR DOUX
    // ═══════════════════════════════════════════════════════════════════════

    // Calculer la vitesse du point B (sur le kite)
    const r = pointB.clone().sub(kiteTransform.position); // Bras de levier
    const angularContribution = new THREE.Vector3()
      .crossVectors(kitePhysics.angularVelocity, r);
    const pointVelocity = kitePhysics.velocity.clone().add(angularContribution);

    // Vitesse radiale : composante le long de la ligne (positive si s'éloigne de A)
    const v_radial = pointVelocity.dot(direction);

    // === FORCE RESSORT (Loi de Hooke) - Utilise élongation RÉELLE ===
    // LINE_STIFFNESS = 50 N/m (très doux)
    // À 1m excès → 50N, à 5m excès → 250N (progressif et stable)
    const springForce = ConstraintConfig.LINE_STIFFNESS * excess;

    // === FORCE DAMPING (Amortissement ABSOLU) ===
    // ABSOLUTE_DAMPING = 2 N·s/m (indépendant de la rigidité)
    // À 1 m/s → 2N, à 10 m/s → 20N (pas d'explosion comme avant!)
    // Ne s'applique QUE si le kite s'éloigne (v_radial > 0)
    const dampingForce = v_radial > 0 
      ? ConstraintConfig.ABSOLUTE_DAMPING * v_radial
      : 0;

    // === FORCE TOTALE ===
    const totalForce = springForce + dampingForce;

    // Les lignes ne poussent pas, seulement tirent (contrainte unilatérale)
    if (totalForce > 0) {
      // Limiter la force pour éviter les explosions numériques
      const clampedTension = Math.min(totalForce, ConstraintConfig.MAX_CONSTRAINT_FORCE);

      // Appliquer force au point B (vers A, pour rapprocher)
      const force = direction.clone().multiplyScalar(-clampedTension);

      // Appliquer au kite (point B)
      kitePhysics.forces.add(force);

      // Générer torque (utilise fonction centralisée MathUtils)
      const torque = MathUtils.computeTorque(pointB, kiteTransform.position, force);
      kitePhysics.torques.add(torque);

      // Mettre à jour tension pour visualisation
      lineComponent.currentTension = clampedTension;
    } else {
      // Pas de force (ne devrait jamais arriver car springForce > 0 si excess > 0)
      lineComponent.currentTension = 0;
    }
  }

  /**
   * Gère la collision avec le sol (Y = 0)
   */
  private handleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < PhysicsConstants.GROUND_Y) {
      transform.position.y = PhysicsConstants.GROUND_Y;

      // Annuler la vitesse verticale descendante
      if (physics.velocity.y < 0) {
        physics.velocity.y = 0;
      }
    }
  }
}
