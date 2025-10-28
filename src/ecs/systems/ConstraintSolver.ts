/**
 * ConstraintSolver.pure.ts - Solveur de contraintes ECS pur
 *
 * Version ECS pure sans dépendances OO :
 *   - Utilise Entity au lieu de class Kite
 *   - Travaille avec GeometryComponent, TransformComponent, BridleComponent
 *   - Implémente Position-Based Dynamics (PBD) pour contraintes géométriques
 *
 * Rôle :
 *   - Applique les contraintes de distance sur les lignes
 *   - Garantit la stabilité géométrique et respect des longueurs
 *   - Gère la sphère de vol et le point d'équilibre zénith
 */
import * as THREE from "three";
import { Entity } from "@base/Entity";
import { GeometryComponent } from "@components/GeometryComponent";
import { TransformComponent } from "@components/TransformComponent";
import { LineComponent } from "@components/LineComponent";
import { PhysicsComponent } from "@components/PhysicsComponent";
import { HandlePositions } from "@mytypes/PhysicsTypes";
import { Logger } from "@utils/Logging";

import { BridleLengths } from "../types/BridleTypes";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { CONFIG } from "../config/SimulationConfig";

/**
 * Interface décrivant la sphère de vol du kite
 *
 * PRINCIPE FONDAMENTAL :
 * Le kite évolue sur une sphère de rayon R = L_lignes + L_brides
 * Cette sphère définit la "fenêtre de vol" (wind window)
 */
/**
 * Interface de configuration pour les contraintes
 */
export interface ConstraintConfig {
  iterations: number;
  dampingFactor: number;
  adaptiveClampingEnabled: boolean;
}

/**
 * ✅ Phase 1.1 : Métrics de convergence PBD pour diagnostic
 * Permet de suivre la qualité de convergence du solveur
 */
export interface ConvergenceMetrics {
  maxError: number;
  averageError: number;
  iteration: number;
  converged: boolean;
}

/**
 * Solveur de contraintes ECS pur
 */
export class PureConstraintSolver {
  // Nombre d'itérations internes PBD pour convergence du système couplé kite-CTRL
  private static readonly INTERNAL_PBD_ITERATIONS = 4;

  /**
   * ✅ REFACTORISATION COMPLÈTE : Résolution itérative Gauss-Seidel
   * 
   * PRINCIPE PHYSIQUE CORRECT :
   * Le système kite-CTRL est COUPLÉ : bouger le kite invalide les CTRL et vice-versa.
   * On doit itérer jusqu'à convergence :
   * 
   * BOUCLE PBD INTERNE :
   *   1. Trilatérer CTRL depuis position actuelle du kite (contraintes brides)
   *   2. Appliquer forces PBD sur kite depuis CTRL → kite bouge
   *   3. Les CTRL sont invalides → recommencer (convergence itérative)
   * 
   * APRÈS convergence :
   *   4. Projeter CTRL sur sphère ligne (contrainte ligne, appliquée UNE FOIS à la fin)
   *   5. Collision sol kite
   */
  static solveConstraintsGlobal(
    kiteEntity: Entity,
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity,
    handles: HandlePositions,
    bridleLengths: BridleLengths,
    newKitePosition: THREE.Vector3,
    kiteState: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    leftLineEntity?: Entity | null,
    rightLineEntity?: Entity | null
  ): void {
    // Lire longueur de ligne
    let lineLength = CONFIG.lines.defaultLength;
    if (leftLineEntity) {
      const lineComponent = leftLineEntity.getComponent<LineComponent>('line');
      if (lineComponent) lineLength = lineComponent.config.length;
    }

    // ✅ BOUCLE PBD ITÉRATIVE : Convergence du système couplé kite-CTRL
    for (let iter = 0; iter < this.INTERNAL_PBD_ITERATIONS; iter++) {
      // ÉTAPE 1 : Trilatération CTRL (contraintes brides) SANS projection ligne
      this.trilaterateCtrl(
        ctrlLeftEntity,
        kiteEntity,
        bridleLengths,
        { nez: "NEZ", inter: "INTER_GAUCHE", centre: "CENTRE" }
      );

      this.trilaterateCtrl(
        ctrlRightEntity,
        kiteEntity,
        bridleLengths,
        { nez: "NEZ", inter: "INTER_DROIT", centre: "CENTRE" }
      );

      // ÉTAPE 2 : Appliquer forces PBD sur kite depuis CTRL → kite bouge
      this.enforceBridleConstraints(
        kiteEntity,
        ctrlLeftEntity,
        ctrlRightEntity,
        newKitePosition,
        kiteState,
        bridleLengths
      );

      // Log convergence (throttled pour éviter spam)
      if (iter === 0 || iter === this.INTERNAL_PBD_ITERATIONS - 1) {
        this.logConstraintState(
          iter,
          kiteEntity,
          ctrlLeftEntity,
          ctrlRightEntity,
          handles,
          bridleLengths,
          lineLength
        );
      }
    }

    // ÉTAPE 3 : Projection finale sur sphère ligne (contrainte ligne)
    // Appliquée UNE FOIS à la fin pour ne pas casser les contraintes de brides
    this.projectCtrlOnLineSphere(ctrlLeftEntity, handles.left, lineLength);
    this.projectCtrlOnLineSphere(ctrlRightEntity, handles.right, lineLength);

    // ÉTAPE 4 : Collision sol
    this.handleGroundCollision(kiteEntity, newKitePosition, kiteState.velocity);
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Trilatération CTRL pure (contraintes brides uniquement)
   * 
   * Calcule la position du CTRL qui satisfait les 3 contraintes de brides :
   * - |CTRL - NEZ| = bridleLength.nez
   * - |CTRL - INTER| = bridleLength.inter
   * - |CTRL - CENTRE| = bridleLength.centre
   * 
   * SANS projection ligne → celle-ci sera appliquée après convergence PBD
   */
  private static trilaterateCtrl(
    ctrlEntity: Entity,
    kiteEntity: Entity,
    bridleLengths: BridleLengths,
    attachments: { nez: string; inter: string; centre: string }
  ): void {
    const ctrlTransform = ctrlEntity.getComponent<TransformComponent>('transform');
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const kiteTransform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!ctrlTransform || !geometry || !kiteTransform) {
      Logger.getInstance().warn('Missing components for CTRL trilateration', 'ConstraintSolver');
      return;
    }

    // Convertir points locaux kite en coordonnées monde
    const toWorldCoordinates = (localPoint: THREE.Vector3): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(kiteTransform.quaternion).add(kiteTransform.position);
    };

    const nezLocal = geometry.getPoint(attachments.nez);
    const interLocal = geometry.getPoint(attachments.inter);
    const centreLocal = geometry.getPoint(attachments.centre);

    if (!nezLocal || !interLocal || !centreLocal) {
      Logger.getInstance().warn(
        `Missing attachment points: ${attachments.nez}=${!!nezLocal}, ${attachments.inter}=${!!interLocal}, ${attachments.centre}=${!!centreLocal}`,
        'ConstraintSolver'
      );
      return;
    }

    const nezWorld = toWorldCoordinates(nezLocal);
    const interWorld = toWorldCoordinates(interLocal);
    const centreWorld = toWorldCoordinates(centreLocal);

    // Trilatération 3D sur les 3 points de bride
    const newCtrlPos = this.trilaterate3D(
      nezWorld, bridleLengths.nez,
      interWorld, bridleLengths.inter,
      centreWorld, bridleLengths.centre
    );

    // Appliquer la nouvelle position (SANS projection ligne ici)
    ctrlTransform.position.copy(newCtrlPos);
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Projection CTRL sur sphère ligne
   * 
   * Appliquée UNE FOIS après convergence PBD pour ne pas casser les contraintes de brides.
   * Si |CTRL - HANDLE| > lineLength, ramène CTRL à exactement lineLength.
   */
  private static projectCtrlOnLineSphere(
    ctrlEntity: Entity,
    handle: THREE.Vector3,
    lineLength: number
  ): void {
    const ctrlTransform = ctrlEntity.getComponent<TransformComponent>('transform');
    if (!ctrlTransform) {
      Logger.getInstance().warn('Missing transform for CTRL line projection', 'ConstraintSolver');
      return;
    }

    const distToHandle = ctrlTransform.position.distanceTo(handle);
    
    if (distToHandle > lineLength) {
      // Projeter sur sphère de ligne
      const direction = ctrlTransform.position.clone().sub(handle).normalize();
      ctrlTransform.position.copy(handle.clone().add(direction.multiplyScalar(lineLength)));
      
      // Log violations significatives (> 10cm)
      if (distToHandle > lineLength + 0.1) {
        Logger.getInstance().debugThrottled(
          `CTRL line constraint enforced: ${distToHandle.toFixed(3)}m -> ${lineLength.toFixed(3)}m`,
          'ConstraintSolver'
        );
      }
    }
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Log détaillé de l'état des contraintes
   * 
   * Affiche les distances réelles vs cibles pour debug et validation.
   */
  private static logConstraintState(
    iteration: number,
    kiteEntity: Entity,
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity,
    handles: HandlePositions,
    bridleLengths: BridleLengths,
    lineLength: number
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const kiteTransform = kiteEntity.getComponent<TransformComponent>('transform');
    const ctrlLeftTransform = ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = ctrlRightEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !kiteTransform || !ctrlLeftTransform || !ctrlRightTransform) return;

    // Helper pour convertir local → monde
    const toWorld = (local: THREE.Vector3) =>
      local.clone().applyQuaternion(kiteTransform.quaternion).add(kiteTransform.position);

    // Calculer distances CTRL-left
    const nezWorld = toWorld(geometry.getPoint("NEZ")!);
    const interLeftWorld = toWorld(geometry.getPoint("INTER_GAUCHE")!);
    const centreWorld = toWorld(geometry.getPoint("CENTRE")!);

    const distNezLeft = ctrlLeftTransform.position.distanceTo(nezWorld);
    const distInterLeft = ctrlLeftTransform.position.distanceTo(interLeftWorld);
    const distCentreLeft = ctrlLeftTransform.position.distanceTo(centreWorld);
    const distLineLeft = ctrlLeftTransform.position.distanceTo(handles.left);

    // Erreur max
    const errorNez = Math.abs(distNezLeft - bridleLengths.nez);
    const errorInter = Math.abs(distInterLeft - bridleLengths.inter);
    const errorCentre = Math.abs(distCentreLeft - bridleLengths.centre);
    const maxError = Math.max(errorNez, errorInter, errorCentre);

    Logger.getInstance().debugThrottled(
      `PBD Iter ${iteration}/${this.INTERNAL_PBD_ITERATIONS} | ` +
      `CTRL-L: brides[${distNezLeft.toFixed(3)}, ${distInterLeft.toFixed(3)}, ${distCentreLeft.toFixed(3)}]m ` +
      `(target=${bridleLengths.nez.toFixed(2)}m) | ` +
      `line=${distLineLeft.toFixed(2)}m/${lineLength.toFixed(2)}m | ` +
      `maxError=${(maxError * 1000).toFixed(1)}mm`,
      'ConstraintSolver'
    );
  }

  /**
   * Résout la position d'un CTRL libre en 3D sous contraintes multiples
   * 
   * ⚠️ DEPRECATED : Utilisée temporairement pour compatibilité, sera supprimée
   * Utiliser trilaterateCtrl + projectCtrlOnLineSphere à la place
   */
  static solveFreePointConstraints(
    ctrlEntity: Entity,
    handle: THREE.Vector3,
    kiteEntity: Entity,
    bridleLengths: BridleLengths,
    attachments: { nez: string; inter: string; centre: string },
    lineEntity?: Entity | null
  ): void {
    Logger.getInstance().debugThrottled(`Solving constraints for CTRL with attachments: ${attachments.nez}, ${attachments.inter}, ${attachments.centre}`, 'ConstraintSolver');
    
    const ctrlTransform = ctrlEntity.getComponent<TransformComponent>('transform');
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const kiteTransform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!ctrlTransform || !geometry || !kiteTransform) {
      Logger.getInstance().warn('Missing components for CTRL constraint solving', 'ConstraintSolver');
      return;
    }

    // Lire longueur de ligne
    let lineLength = CONFIG.lines.defaultLength;
    if (lineEntity) {
      const lineComponent = lineEntity.getComponent<LineComponent>('line');
      if (lineComponent) {
        lineLength = lineComponent.config.length;
      }
    }

    // Positions des points d'attache sur le kite (monde)
    const toWorldCoordinates = (localPoint: THREE.Vector3): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(kiteTransform.quaternion).add(kiteTransform.position);
    };

    const nezLocal = geometry.getPoint(attachments.nez);
    const interLocal = geometry.getPoint(attachments.inter);
    const centreLocal = geometry.getPoint(attachments.centre);

    if (!nezLocal || !interLocal || !centreLocal) {
      Logger.getInstance().warn(`Missing attachment points for CTRL constraints: nez=${!!nezLocal}, inter=${!!interLocal}, centre=${!!centreLocal}`, 'ConstraintSolver');
      Logger.getInstance().warn(`Requested points: ${attachments.nez}, ${attachments.inter}, ${attachments.centre}`, 'ConstraintSolver');
      return;
    }

    const nezWorld = toWorldCoordinates(nezLocal);
    const interWorld = toWorldCoordinates(interLocal);
    const centreWorld = toWorldCoordinates(centreLocal);

    // ÉTAPE 1 : Trilatération sur les 3 brides (position idéale sans contrainte ligne)
    let candidatePos = this.trilaterate3D(
      nezWorld, bridleLengths.nez,
      interWorld, bridleLengths.inter,
      centreWorld, bridleLengths.centre
    );

    // ÉTAPE 2 : Vérifier contrainte de ligne
    const distToHandle = candidatePos.distanceTo(handle);
    
    if (distToHandle > lineLength) {
      // Contrainte de ligne violée → projeter sur sphère de ligne
      const direction = candidatePos.clone().sub(handle).normalize();
      candidatePos = handle.clone().add(direction.multiplyScalar(lineLength));
      
      // Log only significant violations (> 10cm) to avoid flood
      if (distToHandle > lineLength + 0.1) {
        Logger.getInstance().debugThrottled(`CTRL line constraint enforced: ${distToHandle.toFixed(3)}m -> ${lineLength.toFixed(3)}m`, 'ConstraintSolver');
      }
    }

    // ÉTAPE 3 : Appliquer la position finale
    ctrlTransform.position.copy(candidatePos);
  }


  /**
   * Applique les contraintes des lignes - Limite la distance max CTRL-HANDLE
   * 
   * ARCHITECTURE PHYSIQUE BIDIRECTIONNELLE :
   * - Les CTRL peuvent bouger (tirés par le kite via les brides)
   * - Les LIGNES limitent la distance max : |CTRL - HANDLE| ≤ L_ligne
   * - Si CTRL trop loin → ramené à exactement L_ligne
   * - Si CTRL plus proche → ligne molle, pas de contrainte
   * 
   * @param ctrlLeftEntity - Entité ctrl-left avec TransformComponent
   * @param ctrlRightEntity - Entité ctrl-right avec TransformComponent
   * @param handles - Positions des poignées du pilote
   * @param leftLineEntity - Entité de la ligne gauche (pour lire la longueur réelle)
   * @param rightLineEntity - Entité de la ligne droite (pour lire la longueur réelle)
   */
  static enforceLineConstraints(
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity,
    handles: HandlePositions,
    leftLineEntity?: Entity | null,
    rightLineEntity?: Entity | null
  ): void {
    // Vérification des entités nulles avant appel getComponent
    if (!ctrlLeftEntity || !ctrlRightEntity) {
      Logger.getInstance().warn('CTRL entities are null', 'ConstraintSolver');
      return;
    }

    const ctrlLeftTransform = ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = ctrlRightEntity.getComponent<TransformComponent>('transform');

    if (!ctrlLeftTransform || !ctrlRightTransform) {
      Logger.getInstance().warn('CTRL entities missing required components', 'ConstraintSolver');
      return;
    }

    // Validation NaN : empêcher la propagation de NaN dans le système
    const hasNaN = (v: THREE.Vector3) => isNaN(v.x) || isNaN(v.y) || isNaN(v.z);
    if (hasNaN(ctrlLeftTransform.position) || hasNaN(ctrlRightTransform.position)) {
      Logger.getInstance().error('NaN detected in CTRL positions, skipping line constraints', 'ConstraintSolver');
      return;
    }

    // Lire la longueur depuis LineComponent si disponible, sinon fallback sur CONFIG
    let lineLength = CONFIG.lines.defaultLength;
    
    // Essayer de lire depuis leftLineEntity (les deux lignes ont la même longueur)
    if (leftLineEntity) {
      const lineComponent = leftLineEntity.getComponent<LineComponent>('line');
      if (lineComponent) {
        lineLength = lineComponent.config.length;
      }
    }

    // ✅ Contrainte INÉGALITÉ : |CTRL - HANDLE| ≤ lineLength
    // Les lignes LIMITENT la distance max, mais permettent ligne molle
    const limitToMaxDistance = (
      ctrlTransform: TransformComponent,
      handle: THREE.Vector3
    ) => {
      const diff = ctrlTransform.position.clone().sub(handle);
      const dist = diff.length();

      // Protection NaN : position par défaut si distance nulle
      if (dist < PhysicsConstants.EPSILON) {
        ctrlTransform.position.copy(handle).add(new THREE.Vector3(0, lineLength, 0));
        return;
      }

      // ✅ CONTRAINTE INÉGALITÉ : Corriger SEULEMENT si dist > lineLength
      // Si dist ≤ lineLength → ligne molle, pas de correction
      if (dist > lineLength) {
        // Projeter sur sphère de rayon lineLength
        const direction = diff.clone().normalize();
        const newPos = handle.clone().add(direction.multiplyScalar(lineLength));
        ctrlTransform.position.copy(newPos);
        
        // Debug : log la correction
        const correction = dist - lineLength;
        if (correction > 0.01) {
          Logger.getInstance().debugThrottled(`CTRL line constraint corrected: ${correction.toFixed(3)}m over limit`, 'ConstraintSolver');
        }
      }
      // Sinon : ne rien faire, le CTRL peut être plus proche (ligne molle)

      // Vérifier que la position finale reste dans des limites raisonnables
      const pos = ctrlTransform.position;
      if (Math.abs(pos.x) > 1000 || Math.abs(pos.y) > 1000 || Math.abs(pos.z) > 1000) {
        Logger.getInstance().error(`CTRL position out of bounds: ${pos.toArray()}, resetting`, 'ConstraintSolver');
        // Réinitialiser à une position stable : handle + extension maximale de ligne vers le haut
        ctrlTransform.position.copy(handle).add(new THREE.Vector3(0, lineLength, 0));
        return;
      }
    };

    // Appliquer les contraintes (limite max, pas projection forcée)
    limitToMaxDistance(ctrlLeftTransform, handles.left);
    limitToMaxDistance(ctrlRightTransform, handles.right);
  }

  /**
   * ✅ PBD BIDIRECTIONNEL : Applique les contraintes des brides selon PHYSICS_MODEL.md Section 8
   * 
   * ARCHITECTURE CORRECTE (PHYSICS_MODEL.md) :
   * - Les contraintes PBD corrigent LES DEUX extrémités selon leurs masses inverses
   * - KITE : masse = 0.31 kg → bouge peu (invMass = 3.2)
   * - CTRL : masse = 0.01 kg → bouge beaucoup (invMass = 100)
   * - Correction répartie : delta_A = -n × (λ / masse_A), delta_B = +n × (λ / masse_B)
   * 
   * FLUX BIDIRECTIONNEL :
   * 1. Forces aéro (kite) → tensions brides → forces sur CTRL
   * 2. Forces sur CTRL → tensions lignes → traction handles (pilote ressent)
   * 3. PBD équilibre les positions pour satisfaire contraintes de distance
   * 
   * @param kiteEntity - Entité kite avec masse ~0.31 kg
   * @param ctrlLeftEntity - Point CTRL avec petite masse ~0.01 kg
   * @param ctrlRightEntity - Point CTRL avec petite masse ~0.01 kg
   * @param predictedKitePosition - Position prédite du kite (modifiée par PBD)
   * @param kiteState - État physique du kite (velocity, angularVelocity)
   * @param bridleLengths - Longueurs cibles des brides
   */
  static enforceBridleConstraints(
    kiteEntity: Entity,
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity,
    predictedKitePosition: THREE.Vector3,
    kiteState: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    bridleLengths: BridleLengths
  ): void {
    // Vérification des entités nulles avant appel getComponent
    if (!kiteEntity || !ctrlLeftEntity || !ctrlRightEntity) {
      Logger.getInstance().warn('Entities are null in enforceBridleConstraints', 'ConstraintSolver');
      return;
    }

    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    const physics = kiteEntity.getComponent<PhysicsComponent>('physics');
    const ctrlLeftTransform = ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = ctrlRightEntity.getComponent<TransformComponent>('transform');

    // Lire masses des CTRL depuis ControlPointComponent
    const ctrlLeftComp = ctrlLeftEntity.getComponent<import('@components/ControlPointComponent').ControlPointComponent>('controlPoint');
    const ctrlRightComp = ctrlRightEntity.getComponent<import('@components/ControlPointComponent').ControlPointComponent>('controlPoint');

    if (!geometry || !transform || !physics || !ctrlLeftTransform || !ctrlRightTransform || !ctrlLeftComp || !ctrlRightComp) {
      Logger.getInstance().warn('Missing components for bridle constraints', 'ConstraintSolver');
      return;
    }

    // Validation NaN : empêcher la propagation de NaN dans le système
    const hasNaN = (v: THREE.Vector3) => isNaN(v.x) || isNaN(v.y) || isNaN(v.z);
    if (hasNaN(predictedKitePosition) || hasNaN(ctrlLeftTransform.position) || hasNaN(ctrlRightTransform.position)) {
      Logger.getInstance().error('NaN detected in bridle constraint inputs, skipping bridle constraints', 'ConstraintSolver');
      return;
    }

    // ✅ PBD BIDIRECTIONNEL : Masses inverses pour les deux extrémités
    const invMassKite = physics.invMass;
    const invInertiaKite = physics.invInertia;
    const invMassCtrlLeft = 1.0 / ctrlLeftComp.config.mass;  // ~100 (masse 0.01 kg)
    const invMassCtrlRight = 1.0 / ctrlRightComp.config.mass;

    // Helper : convertir point local du kite en coordonnées monde
    const toWorldCoordinates = (localPoint: THREE.Vector3, position: THREE.Vector3, quaternion: THREE.Quaternion): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(quaternion).add(position);
    };

    // Définition des 6 brides (3 gauche + 3 droite)
    const bridlesLeft = [
      { kitePoint: "NEZ", ctrlEntity: ctrlLeftEntity, length: bridleLengths.nez },
      { kitePoint: "INTER_GAUCHE", ctrlEntity: ctrlLeftEntity, length: bridleLengths.inter },
      { kitePoint: "CENTRE", ctrlEntity: ctrlLeftEntity, length: bridleLengths.centre },
    ];

    const bridlesRight = [
      { kitePoint: "NEZ", ctrlEntity: ctrlRightEntity, length: bridleLengths.nez },
      { kitePoint: "INTER_DROIT", ctrlEntity: ctrlRightEntity, length: bridleLengths.inter },
      { kitePoint: "CENTRE", ctrlEntity: ctrlRightEntity, length: bridleLengths.centre },
    ];

    const allBridles = [...bridlesLeft, ...bridlesRight];

    // Résolution PBD bidirectionnelle pour chaque bride
    // ✅ PBD BIDIRECTIONNEL : Correction des deux extrémités selon masses inverses
    const solveBridle = (
      kitePointName: string,
      ctrlEntity: Entity,
      bridleLength: number
    ) => {
      const kitePointLocal = geometry.getPoint(kitePointName);
      const ctrlTransform = ctrlEntity.getComponent<TransformComponent>('transform');
      const ctrlComp = ctrlEntity.getComponent<import('@components/ControlPointComponent').ControlPointComponent>('controlPoint');

      if (!kitePointLocal || !ctrlTransform || !ctrlComp) {
        Logger.getInstance().warn(`Points bride introuvables: ${kitePointName}`, 'ConstraintSolver');
        return;
      }

      // Convertir point du kite en coordonnées monde
      const kitePointWorld = toWorldCoordinates(kitePointLocal, predictedKitePosition, transform.quaternion);
      const ctrlPositionWorld = ctrlTransform.position;

      // Distance actuelle
      const diff = ctrlPositionWorld.clone().sub(kitePointWorld);
      const dist = diff.length();

      // Si bride molle ou distance nulle (protection NaN), pas de contrainte
      if (dist <= bridleLength || dist < PhysicsConstants.EPSILON) return;

      // Direction de contrainte (du point kite vers CTRL)
      const n = diff.clone().normalize();

      // Violation de contrainte
      const C = dist - bridleLength;

      // Bras de levier pour le kite
      const rKite = kitePointWorld.clone().sub(predictedKitePosition);

      // Moments angulaires
      const alphaKite = new THREE.Vector3().crossVectors(rKite, n);

      // ✅ PBD BIDIRECTIONNEL : Masses inverses des deux extrémités
      const invMassKite = physics.invMass;
      const invInertiaKite = physics.invInertia;
      const invMassCtrl = 1.0 / ctrlComp.config.mass;

      // Dénominateur PBD bidirectionnel : w_A + w_B (masses inverses)
      const denom = invMassKite + invMassCtrl + alphaKite.lengthSq() * invInertiaKite;
      const lambda = C / Math.max(denom, PhysicsConstants.EPSILON);

      // ✅ CORRECTION BIDIRECTIONNELLE (PHYSICS_MODEL.md Section 8.2)
      // Kite : delta_A = -n × (invMass_A × λ)
      const dPosKite = n.clone().multiplyScalar(-invMassKite * lambda);
      
      // CTRL : delta_B = +n × (invMass_B × λ)
      const dPosCtrl = n.clone().multiplyScalar(invMassCtrl * lambda);

      // Clamping conservateur pour stabilité
      const maxCorrectionKite = bridleLength * 0.3;
      const maxCorrectionCtrl = bridleLength * 0.3;
      
      if (dPosKite.length() > maxCorrectionKite) {
        dPosKite.normalize().multiplyScalar(maxCorrectionKite);
      }
      if (dPosCtrl.length() > maxCorrectionCtrl) {
        dPosCtrl.normalize().multiplyScalar(maxCorrectionCtrl);
      }

      // Application des corrections
      predictedKitePosition.add(dPosKite);
      ctrlTransform.position.add(dPosCtrl);  // ✅ CTRL bouge maintenant !

      // Correction de rotation du kite
      const dThetaKite = alphaKite.clone().multiplyScalar(-invInertiaKite * lambda);
      const angle = dThetaKite.length();
      if (angle > PhysicsConstants.EPSILON) {
        const axis = dThetaKite.normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        transform.quaternion.premultiply(dq).normalize();
      }

      // ✅ Correction de vitesse bidirectionnelle
      const kitePointWorld2 = toWorldCoordinates(kitePointLocal, predictedKitePosition, transform.quaternion);
      const diff2 = ctrlTransform.position.clone().sub(kitePointWorld2);
      const dist2 = diff2.length();

      // Protection NaN : ne normaliser que si distance non-nulle
      if (dist2 < PhysicsConstants.EPSILON) return;

      const n2 = diff2.normalize();
      const rKite2 = kitePointWorld2.clone().sub(predictedKitePosition);

      const velKitePoint = kiteState.velocity
        .clone()
        .add(new THREE.Vector3().crossVectors(kiteState.angularVelocity, rKite2));
      
      // Vitesse CTRL depuis ControlPointComponent
      const velCtrl = ctrlComp.velocity.clone();

      const relVel = velCtrl.clone().sub(velKitePoint);
      const radialSpeed = relVel.dot(n2);

      if (radialSpeed > 0) {
        // ✅ PBD BIDIRECTIONNEL : Correction de vitesse des deux extrémités
        const rxnKite = new THREE.Vector3().crossVectors(rKite2, n2);
        const eff = invMassKite + invMassCtrl + rxnKite.lengthSq() * invInertiaKite;
        const J = -radialSpeed / Math.max(eff, PhysicsConstants.EPSILON);

        // Correction vitesse KITE
        kiteState.velocity.add(n2.clone().multiplyScalar(J * invMassKite));

        const angImpulseKite = new THREE.Vector3().crossVectors(
          rKite2,
          n2.clone().multiplyScalar(J)
        );
        kiteState.angularVelocity.add(angImpulseKite.multiplyScalar(invInertiaKite));

        // ✅ Correction vitesse CTRL (bidirectionnel)
        ctrlComp.velocity.add(n2.clone().multiplyScalar(-J * invMassCtrl));

        // Clamp velocities to prevent explosion
        const kiteVelMag = kiteState.velocity.length();
        if (kiteVelMag > PhysicsConstants.MAX_VELOCITY) {
          kiteState.velocity.multiplyScalar(PhysicsConstants.MAX_VELOCITY / kiteVelMag);
        }

        const angVelMag = kiteState.angularVelocity.length();
        if (angVelMag > PhysicsConstants.MAX_ANGULAR_VELOCITY) {
          kiteState.angularVelocity.multiplyScalar(PhysicsConstants.MAX_ANGULAR_VELOCITY / angVelMag);
        }
        
        const ctrlVelMag = ctrlComp.velocity.length();
        if (ctrlVelMag > PhysicsConstants.MAX_VELOCITY) {
          ctrlComp.velocity.multiplyScalar(PhysicsConstants.MAX_VELOCITY / ctrlVelMag);
        }
      }
    };

    // Résoudre toutes les brides
    allBridles.forEach(({ kitePoint, ctrlEntity, length }) => {
      solveBridle(kitePoint, ctrlEntity, length);
    });

    // ✅ CRITIQUE : Recalculer positions CTRL par trilatération après toutes les corrections du kite
    // PUIS les projeter sur la sphère ligne pour respecter les 2 contraintes !
    // Sans cette projection, les CTRL dérivent et le kite s'envole.
    
    // Note: On ne peut pas recalculer ici car on n'a pas accès aux handles
    // La trilatération est faite, mais les CTRL doivent être projetés dans enforceLineConstraints
    // qui est appelé APRÈS dans la boucle PBD de KiteController
    
    // DONC : On ne fait PAS de trilatération ici finalement !
    // Les CTRL sont mis à jour uniquement par enforceLineConstraints (projection sur sphère)
    // Les brides corrigent le kite, et le kite "tire" les CTRL via les brides.
  }



  /**
   * Gère la collision avec le sol
   * Version ECS pure
   */
  /**
   * Gère la collision avec le sol - Applique une contrainte de position
   * Version ECS pure avec détection multi-points et marge de sécurité
   */
  static handleGroundCollision(
    kiteEntity: Entity,
    newPosition: THREE.Vector3,
    velocity: THREE.Vector3
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) {
      Logger.getInstance().warn('Kite entity missing geometry or transform component', 'ConstraintSolver');
      return;
    }

    const groundY = CONFIG.kite.minHeight;

    // Helper : convertir point local en coordonnées monde
    const toWorldCoordinates = (localPoint: THREE.Vector3, position: THREE.Vector3, quaternion: THREE.Quaternion): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(quaternion).add(position);
    };

    // Trouver le point le plus bas du kite
    let minY = Infinity;
    
    geometry.points.forEach((point) => {
      const world = toWorldCoordinates(point, newPosition, transform.quaternion);
      if (world.y < minY) {
        minY = world.y;
      }
    });

    // Si collision avec le sol (avec marge de sécurité)
    if (minY < groundY) {
      const penetrationDepth = groundY - minY;
      
      // Correction de position : remonter le kite pour que le point le plus bas soit au niveau du sol
      newPosition.y += penetrationDepth;

      // Correction de vitesse : annuler la composante verticale descendante
      if (velocity.y < 0) {
        velocity.y = 0;
      }

      // Application de friction horizontale (réaliste pour sol)
      velocity.x *= PhysicsConstants.GROUND_FRICTION;
      velocity.z *= PhysicsConstants.GROUND_FRICTION;

      // Si vitesse horizontale devient trop faible, l'annuler complètement (éviter micro-glissements)
      if (velocity.lengthSq() < PhysicsConstants.EPSILON) {
        velocity.set(0, 0, 0);
      }
    }
  }

  /**
   * Résout la position d'un point de contrôle (CTRL) par Position-Based Dynamics
   * 
   * PRINCIPE PHYSIQUE CORRECT :
   * Le point CTRL est contraint par 4 distances rigides (inextensibles) :
   * - 3 brides depuis le kite (NEZ, INTER, CENTRE)
   * - 1 ligne depuis la poignée
   * 
   * Cette méthode utilise une approximation analytique (trilatération 3D sur les 3 brides,
   * puis projection sur la sphère de la ligne). C'est suffisant car les contraintes
   * seront re-appliquées globalement dans enforceLineConstraints/enforceBridleConstraints.
   * 
   * IMPORTANT : Cette position est une ESTIMATION qui sera raffinée par les solveurs PBD.
   * Ne PAS utiliser cette position pour calculer des forces !
   */
  static solveControlPointPosition(
    kiteEntity: Entity,
    handlePosition: THREE.Vector3,
    bridleLengths: { nez: number; inter: number; centre: number },
    lineLength: number,
    attachments: { nez: string; inter: string; centre: string }
  ): THREE.Vector3 {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) {
      Logger.getInstance().warn('Kite entity missing geometry or transform', 'ConstraintSolver');
      return handlePosition.clone().add(new THREE.Vector3(0, lineLength, 0));
    }

    // Helper : convertir point local en coordonnées monde
    const toWorldCoordinates = (
      localPoint: THREE.Vector3,
      position: THREE.Vector3,
      quaternion: THREE.Quaternion
    ): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(quaternion).add(position);
    };

    // Récupérer les 3 points d'attache sur le kite (coordonnées monde)
    const nezLocal = geometry.getPoint(attachments.nez);
    const interLocal = geometry.getPoint(attachments.inter);
    const centreLocal = geometry.getPoint(attachments.centre);

    if (!nezLocal || !interLocal || !centreLocal) {
      Logger.getInstance().warn('Attachment points not found', 'ConstraintSolver', attachments);
      return handlePosition.clone().add(new THREE.Vector3(0, lineLength, 0));
    }

    const nezWorld = toWorldCoordinates(nezLocal, transform.position, transform.quaternion);
    const interWorld = toWorldCoordinates(interLocal, transform.position, transform.quaternion);
    const centreWorld = toWorldCoordinates(centreLocal, transform.position, transform.quaternion);

    // ÉTAPE 1 : Trilatération 3D sur les 3 brides
    // Donne une approximation de la position CTRL basée uniquement sur les brides
    let ctrlPosition = this.trilaterate3D(
      nezWorld,
      bridleLengths.nez,
      interWorld,
      bridleLengths.inter,
      centreWorld,
      bridleLengths.centre
    );

    // ÉTAPE 2 : Projeter sur la sphère de la ligne (contrainte rigide)
    // Le point CTRL DOIT être à exactement lineLength de la poignée
    const toHandle = ctrlPosition.clone().sub(handlePosition);
    const distToHandle = toHandle.length();

    if (distToHandle > PhysicsConstants.EPSILON) {
      // Projeter exactement sur la sphère
      const direction = toHandle.normalize();
      ctrlPosition = handlePosition.clone().add(direction.multiplyScalar(lineLength));
    } else {
      // Cas dégénéré : placer sous la poignée
      ctrlPosition = handlePosition.clone().add(new THREE.Vector3(0, -lineLength, 0));
    }

    // NOTE : Cette position ne satisfait probablement PAS exactement les 3 contraintes de bride
    // (car on a sacrifié la trilatération pour respecter la contrainte de ligne).
    // Les contraintes de bride seront re-appliquées dans enforceBridleConstraints().
    
    return ctrlPosition;
  }

  /**
   * Trilatération 3D : trouve le point d'intersection de 3 sphères
   * 
   * Méthode analytique basée sur géométrie vectorielle
   * Référence : https://en.wikipedia.org/wiki/Trilateration
   * 
   * @param p1 - Centre sphère 1
   * @param r1 - Rayon sphère 1
   * @param p2 - Centre sphère 2
   * @param r2 - Rayon sphère 2
   * @param p3 - Centre sphère 3
   * @param r3 - Rayon sphère 3
   * @returns Point d'intersection (ou approximation si pas de solution exacte)
   */
  public static trilaterate3D(
    p1: THREE.Vector3,
    r1: number,
    p2: THREE.Vector3,
    r2: number,
    p3: THREE.Vector3,
    r3: number
  ): THREE.Vector3 {
    // Créer repère local avec p1 comme origine
    const exVec = p2.clone().sub(p1);
    const d = exVec.length();

    // Protection NaN : si p1 et p2 coïncident, retourner position par défaut
    if (d < PhysicsConstants.EPSILON) {
      Logger.getInstance().warn('Trilaterate3D: p1 and p2 are coincident, returning fallback position', 'ConstraintSolver');
      return p1.clone().add(new THREE.Vector3(0, 0, -r1));
    }

    const ex = exVec.normalize();

    // Vecteur p1->p3 dans le repère local
    const p3ToP1 = p3.clone().sub(p1);
    const i = ex.dot(p3ToP1);

    // Deuxième axe (perpendiculaire à ex, dans le plan p1-p2-p3)
    const eyTemp = p3ToP1.clone().addScaledVector(ex, -i);
    const eyLen = eyTemp.length();

    // Protection NaN : si eyTemp est nul (p3 colinéaire avec p1-p2), créer axe arbitraire
    const ey = eyLen > PhysicsConstants.EPSILON
      ? eyTemp.normalize()
      : new THREE.Vector3(0, 1, 0).cross(ex).normalize();

    // Troisième axe (perpendiculaire aux deux premiers)
    const ez = new THREE.Vector3().crossVectors(ex, ey);

    const j = ey.dot(p3ToP1);

    // Protection division par zéro
    if (Math.abs(d) < PhysicsConstants.EPSILON || Math.abs(j) < PhysicsConstants.EPSILON) {
      Logger.getInstance().warn('Trilaterate3D: degenerate configuration, returning fallback position', 'ConstraintSolver');
      return p1.clone().add(new THREE.Vector3(0, 0, -r1));
    }

    // Résolution du système d'équations
    // x² + y² + z² = r1²
    // (x-d)² + y² + z² = r2²
    // (x-i)² + (y-j)² + z² = r3²

    const x = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x;

    // Calcul de z (deux solutions possibles, choisir celle vers le pilote)
    const zSquared = r1 * r1 - x * x - y * y;
    let z = 0;
    
    if (zSquared <= 0) {
      Logger.getInstance().warn('Trilaterate3D: no valid z solution, using z=0', 'ConstraintSolver');
      z = 0;
    } else {
      // Deux solutions : +sqrt et -sqrt
      const zPos = Math.sqrt(zSquared);
      const zNeg = -zPos;
      
      // Pour un cerf-volant, choisir la solution qui place le CTRL vers l'avant du pilote
      // Le pilote est à l'origine (0,0,0), le kite est devant (z négatif typiquement)
      // Donc les CTRL doivent être entre le pilote et le kite (z négatif mais moins que le kite)
      
      // Calcul des deux positions candidates
      const candidatePos = p1.clone()
        .add(ex.clone().multiplyScalar(x))
        .add(ey.clone().multiplyScalar(y));
      
      const posCandidate = candidatePos.clone().add(ez.clone().multiplyScalar(zPos));
      const negCandidate = candidatePos.clone().add(ez.clone().multiplyScalar(zNeg));
      
      // Choisir celle qui est la plus proche du pilote (origine)
      const distPos = posCandidate.length();
      const distNeg = negCandidate.length();
      
      z = distPos < distNeg ? zPos : zNeg;
    }

    // Retour dans le repère monde
    const result = p1.clone();
    result.add(ex.clone().multiplyScalar(x));
    result.add(ey.clone().multiplyScalar(y));
    result.add(ez.clone().multiplyScalar(z));

    return result;
  }

  /**
   * Calcule les tensions dans les lignes de contrôle
   * 
   * PHYSIQUE :
   * La tension de ligne provient des forces aérodynamiques du kite
   * transmises via les brides jusqu'aux points CTRL.
   * 
   * Tension ≈ |Force aéro| × facteur_géométrique
   * 
   * Pour une approximation simple :
   * - Si ligne tendue (dist = lineLength) → tension proportionnelle à la force aéro
   * - Si ligne molle (dist < lineLength) → tension = 0
   * 
   * @param kiteEntity - Entité du kite avec forces aéro
   * @param ctrlLeftEntity - Entité CTRL gauche
   * @param ctrlRightEntity - Entité CTRL droit
   * @param handles - Positions des handles
   * @param aeroForce - Force aérodynamique totale sur le kite (lift + drag)
   * @returns Tensions {left, right} en Newtons
   */
  static calculateLineTensions(
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity,
    handles: HandlePositions,
    aeroForce: THREE.Vector3,
    lineLength: number,
    logger?: Logger
  ): { left: number; right: number } {
    // Vérification des entités nulles avant appel getComponent
    if (!ctrlLeftEntity || !ctrlRightEntity) {
      logger?.warn('⚠️ calculateLineTensions: CTRL entities are null', 'ConstraintSolver');
      return { left: 0, right: 0 };
    }

    const ctrlLeftTransform = ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = ctrlRightEntity.getComponent<TransformComponent>('transform');

    if (!ctrlLeftTransform || !ctrlRightTransform) {
      logger?.warn('⚠️ calculateLineTensions: CTRL entities missing transform', 'ConstraintSolver');
      return { left: 0, right: 0 };
    }

    // Distance actuelle des CTRL aux handles
    const distLeft = ctrlLeftTransform.position.distanceTo(handles.left);
    const distRight = ctrlRightTransform.position.distanceTo(handles.right);

    // Si ligne molle → pas de tension
    const isLeftTaut = distLeft >= lineLength * 0.99; // Tendue si >= 99% de longueur max
    const isRightTaut = distRight >= lineLength * 0.99;

    // Direction des lignes (handle → CTRL)
    const dirLeft = ctrlLeftTransform.position.clone().sub(handles.left).normalize();
    const dirRight = ctrlRightTransform.position.clone().sub(handles.right).normalize();

    // Projection de la force aéro sur la direction de chaque ligne
    // (Approximation : on suppose que la force se répartit équitablement)
    const halfAeroForce = aeroForce.clone().multiplyScalar(0.5);
    
    const tensionLeft = isLeftTaut 
      ? Math.max(0, halfAeroForce.dot(dirLeft))
      : 0;
    
    const tensionRight = isRightTaut
      ? Math.max(0, halfAeroForce.dot(dirRight))
      : 0;

    return { left: tensionLeft, right: tensionRight };
  }

  /**
   * Calcule la tension d'une ligne selon la loi de Hooke
   * 
   * F = k × Δx où Δx = longueur_actuelle - longueur_cible
   * Tension = max(0, F) pour éviter compression
   * 
   * @param ctrlPosition - Position du point de contrôle
   * @param handlePosition - Position de la poignée
   * @param lineLength - Longueur cible de la ligne (m)
   * @param lineStiffness - Raideur de la ligne (N/m), défaut 500 N/m
   * @returns Tension en Newtons (N)
   */
  static calculateLineTension(
    ctrlPosition: THREE.Vector3,
    handlePosition: THREE.Vector3,
    lineLength: number,
    lineStiffness: number = CONFIG.lines.stiffness
  ): number {
    const currentLength = ctrlPosition.distanceTo(handlePosition);
    const delta = currentLength - lineLength;
    
    // Tension proportionnelle à l'étirement (loi de Hooke simplifiée)
    // F = k × Δx
    const tension = Math.max(0, delta * lineStiffness);
    
    return Math.min(tension, CONFIG.lines.maxTension); // Limite sécurité
  }

  /**
   * 
   * Cette méthode est PHYSIQUEMENT INCORRECTE car elle traite les brides comme des ressorts.
  }

  /**
  /**
   * 
   * Cette méthode est PHYSIQUEMENT INCORRECTE car elle traite les brides comme des ressorts.
   * Les brides Dyneema sont inextensibles (contraintes rigides), pas des ressorts.
   * 
   * La vraie physique doit utiliser Position-Based Dynamics (PBD) via enforceConstraintsGlobal().
   * 
   * @deprecated Utiliser enforceConstraintsGlobal() à la place
   */
  static applyBridleForces(
    kiteEntity: Entity,
    ctrlPosition: THREE.Vector3,
    bridleLengths: { nez: number; inter: number; centre: number },
    attachments: { nez: string; inter: string; centre: string },
    bridleStiffness: number = 5000
  ): void {
    // MÉTHODE DÉPRÉCIÉE - Ne fait plus rien
    // Les contraintes sont gérées par enforceConstraintsGlobal()
    Logger.getInstance().warn('applyBridleForces() is deprecated. Use enforceConstraintsGlobal() instead.', 'ConstraintSolver');
  }
}
