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

    // Points d'attache de la barre (handles)
    const handleLeft = barGeometry.getPointWorld('leftHandle', controlBar);
    const handleRight = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!ctrlLeft || !ctrlRight || !handleLeft || !handleRight) {
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
      pointA: handleLeft,      // Handle (fixe)
      pointB: ctrlLeft,        // CTRL sur kite (mobile)
      maxLength: leftLineComp.restLength,
      kiteTransform,
      kitePhysics,
      lineComponent: leftLineComp
    });

    // === LIGNE DROITE ===
    this.solveSimpleTether({
      pointA: handleRight,     // Handle (fixe)
      pointB: ctrlRight,       // CTRL sur kite (mobile)
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
    
    // Clamper l'élongation pour éviter les forces absurdes
    // MAX_ELONGATION_RATIO = 2% (30cm sur 15m) après corrections
    const maxExcess = maxLength * ConstraintConfig.MAX_ELONGATION_RATIO;
    const clampedExcess = Math.min(excess, maxExcess);
    
    lineComponent.state.elongation = excess;
    lineComponent.state.strainRatio = excess / maxLength;

    // 🐛 DEBUG: Log des valeurs de calcul (uniquement frame 1-3)
    console.log(`\n🐛 [TetherSystem] Line calculation:`);
    console.log(`  distance=${distance.toFixed(3)}m, maxLength=${maxLength.toFixed(3)}m`);
    console.log(`  excess=${excess.toFixed(3)}m, maxExcess=${maxExcess.toFixed(3)}m, clampedExcess=${clampedExcess.toFixed(3)}m`);
    console.log(`  LINE_STIFFNESS=${ConstraintConfig.LINE_STIFFNESS} N/m`);
    console.log(`  MAX_CONSTRAINT_FORCE=${ConstraintConfig.MAX_CONSTRAINT_FORCE} N`);

    // Direction normalisée de B vers A (pour tirer B vers A)
    const direction = diff.clone().normalize();

    // ═══════════════════════════════════════════════════════════════════════
    // TRANSFERT TRACTION BIDIRECTIONNEL (mais pas pousser)
    // ═══════════════════════════════════════════════════════════════════════

    // Calculer la vitesse du point B (sur le kite)
    const r = pointB.clone().sub(kiteTransform.position); // Bras de levier
    const angularContribution = new THREE.Vector3()
      .crossVectors(kitePhysics.angularVelocity, r);
    const pointVelocity = kitePhysics.velocity.clone().add(angularContribution);

    // Vitesse radiale : composante le long de la ligne (positive si s'éloigne de A)
    const v_radial = pointVelocity.dot(direction);

    // === FORCE RESSORT (Loi de Hooke) - TOUJOURS appliquée si étiré ===
    // Utilise LINE_STIFFNESS du ConstraintConfig (2000 N/m après corrections)
    // Utilise clampedExcess pour éviter forces absurdes (max 30cm élongation)
    const springForce = ConstraintConfig.LINE_STIFFNESS * clampedExcess;

    // === FORCE DAMPING (Amortissement longitudinal) ===
    // Oppose la vitesse radiale pour stabiliser les oscillations
    // Ne s'applique QUE si le kite s'éloigne (v_radial > 0)
    // Si v_radial < 0 (rapprochement), pas de damping (on veut qu'il revienne vite)
    const dampingForce = v_radial > 0 
      ? ConstraintConfig.PBD_DAMPING * v_radial * ConstraintConfig.LINE_STIFFNESS 
      : 0;

    // === FORCE TOTALE ===
    const totalForce = springForce + dampingForce;

    // 🐛 DEBUG: Log des forces
    console.log(`  v_radial=${v_radial.toFixed(3)} m/s`);
    console.log(`  springForce=${springForce.toFixed(2)} N, dampingForce=${dampingForce.toFixed(2)} N`);
    console.log(`  totalForce=${totalForce.toFixed(2)} N`);

    // Les lignes ne poussent pas, seulement tirent (contrainte unilatérale)
    if (totalForce > 0) {
      // Limiter la force pour éviter les explosions
      // Utilise MAX_CONSTRAINT_FORCE du ConstraintConfig (500 N)
      const clampedTension = Math.min(totalForce, ConstraintConfig.MAX_CONSTRAINT_FORCE);

      // 🐛 DEBUG: Log de la tension finale
      console.log(`  clampedTension=${clampedTension.toFixed(2)} N (stored in lineComponent.currentTension)\n`);

      // Appliquer force au point B (vers A, pour rapprocher)
      const force = direction.clone().multiplyScalar(-clampedTension);

      // Appliquer au kite (point B)
      kitePhysics.forces.add(force);

      // Générer torque
      const torque = new THREE.Vector3().crossVectors(r, force);
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
