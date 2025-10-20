/**
 * PilotSystem.ts - Système de calcul du retour haptique pour le pilote
 * 
 * Responsabilités :
 * - Lit les tensions des lignes depuis les LineComponent
 * - Calcule les tensions filtrées pour un feedback lisse
 * - Détecte l'asymétrie et le côté dominant
 * - Calcule les deltas de tension
 * - Détermine l'état du vol
 * 
 * Architecture ECS :
 * - Opère sur l'entité pilote avec PilotComponent
 * - Lit les données des lignes (LineComponent)
 * - S'exécute après ConstraintSystem (qui calcule les tensions)
 * 
 * Référence Makani :
 * - Les tensions sont calculées par ConstraintSystem
 * - Ce système se concentre sur le traitement du feedback
 */

import * as THREE from 'three';

import { System } from '../core/System';
import type { EntityManager } from '../core/EntityManager';
import type { SimulationContext } from '../core/System';
import { PilotComponent } from '../components/PilotComponent';
import { LineComponent } from '../components/LineComponent';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { InputComponent } from '../components/InputComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { CONFIG } from '../config/Config';

export class PilotSystem extends System {
  private barRotationAngle: number = 0; // Angle de rotation actuel (degrés)

  // Configuration de la rotation de la barre
  private readonly MAX_ROTATION_ANGLE = 30; // degrés max de chaque côté
  private readonly ROTATION_SPEED = 60; // degrés/seconde

  constructor() {
    // S'exécute après ConstraintSystem (priorité 50)
    super('PilotSystem', 55);
  }
  
  async initialize(_entityManager: EntityManager): Promise<void> {
    // Pas d'initialisation spécifique nécessaire
  }
  
  update(context: SimulationContext): void {
    const { entityManager, deltaTime } = context;

    const pilotComp = this.getPilotComponent(entityManager);
    if (!pilotComp) return;

    const lineComponents = this.getLineComponents(entityManager);
    if (!lineComponents) return;

    this.updateRawTensions(pilotComp, lineComponents);
    this.applyTensionFiltering(pilotComp);
    this.calculateAsymmetry(pilotComp);
    this.detectDominantSide(pilotComp);
    this.calculateTensionDeltas(pilotComp, deltaTime);
    this.updateFlightState(pilotComp);

    // Gérer la rotation de la barre depuis les inputs clavier
    this.updateBarRotation(entityManager, deltaTime);

    // Le pilote maintient la barre de contrôle
    this.applyPilotGrip(entityManager);

    pilotComp.lastUpdateTime = performance.now();
  }

  /**
   * Récupère le composant pilote
   */
  private getPilotComponent(entityManager: EntityManager): PilotComponent | null {
    const pilot = entityManager.getEntity('pilot');
    return pilot?.getComponent<PilotComponent>('pilot') ?? null;
  }

  /**
   * Récupère les composants de ligne
   */
  private getLineComponents(entityManager: EntityManager): { left: LineComponent; right: LineComponent } | null {
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');
    
    if (!leftLine || !rightLine) return null;
    
    const left = leftLine.getComponent<LineComponent>('line');
    const right = rightLine.getComponent<LineComponent>('line');
    
    if (!left || !right) return null;
    
    return { left, right };
  }

  /**
   * Met à jour les tensions brutes depuis les lignes
   */
  private updateRawTensions(
    pilotComp: PilotComponent, 
    lines: { left: LineComponent; right: LineComponent }
  ): void {
    pilotComp.leftHandRawTension = lines.left.currentTension;
    pilotComp.rightHandRawTension = lines.right.currentTension;
  }

  /**
   * Applique un filtre passe-bas exponentiel aux tensions
   */
  private applyTensionFiltering(pilotComp: PilotComponent): void {
    const alpha = pilotComp.filteringFactor;
    
    pilotComp.leftHandFilteredTension += alpha * (
      pilotComp.leftHandRawTension - pilotComp.leftHandFilteredTension
    );
    pilotComp.rightHandFilteredTension += alpha * (
      pilotComp.rightHandRawTension - pilotComp.rightHandFilteredTension
    );
  }

  /**
   * Calcule l'asymétrie de tension entre les deux mains
   */
  private calculateAsymmetry(pilotComp: PilotComponent): void {
    const totalTension = pilotComp.leftHandFilteredTension + pilotComp.rightHandFilteredTension;
    const MIN_TENSION_THRESHOLD = 0.1;
    
    if (totalTension > MIN_TENSION_THRESHOLD) {
      const diff = Math.abs(pilotComp.leftHandFilteredTension - pilotComp.rightHandFilteredTension);
      pilotComp.asymmetry = (diff / totalTension) * 100;
    } else {
      pilotComp.asymmetry = 0;
    }
    
    pilotComp.totalFeedbackMagnitude = totalTension / 2;
  }

  /**
   * Détecte le côté dominant basé sur la différence de tension
   */
  private detectDominantSide(pilotComp: PilotComponent): void {
    const tensionDiff = pilotComp.leftHandFilteredTension - pilotComp.rightHandFilteredTension;
    const DOMINANCE_THRESHOLD = 5; // 5N
    
    if (Math.abs(tensionDiff) < DOMINANCE_THRESHOLD) {
      pilotComp.dominantSide = 'neutral';
    } else if (tensionDiff > 0) {
      pilotComp.dominantSide = 'left';
    } else {
      pilotComp.dominantSide = 'right';
    }
  }

  /**
   * Calcule les variations de tension (dérivée)
   */
  private calculateTensionDeltas(pilotComp: PilotComponent, deltaTime: number): void {
    if (deltaTime <= 0) return;

    const prevLeftRaw = pilotComp.leftHandRawTension;
    const prevRightRaw = pilotComp.rightHandRawTension;

    pilotComp.leftHandTensionDelta = (pilotComp.leftHandRawTension - prevLeftRaw) / deltaTime;
    pilotComp.rightHandTensionDelta = (pilotComp.rightHandRawTension - prevRightRaw) / deltaTime;
  }

  /**
   * Met à jour la rotation de la barre de contrôle depuis les inputs clavier
   * Rotation autour d'un axe perpendiculaire au vecteur (pivot → milieu_CTRL)
   */
  private updateBarRotation(entityManager: EntityManager, deltaTime: number): void {
    // Récupérer l'input de rotation depuis InputComponent
    const uiEntity = entityManager.query(['Input'])[0];
    if (!uiEntity) return;

    const inputComp = uiEntity.getComponent<InputComponent>('Input');
    if (!inputComp) return;

    // Récupérer la barre de contrôle
    const controlBar = entityManager.getEntity('controlBar');
    if (!controlBar) return;

    const barTransform = controlBar.getComponent<TransformComponent>('transform');
    if (!barTransform) return;

    // Récupérer le kite et sa géométrie
    const kite = entityManager.getEntity('kite');
    if (!kite) return;

    const kiteGeom = kite.getComponent<GeometryComponent>('geometry');
    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    if (!kiteGeom || !kiteTransform) return;

    // Mettre à jour l'angle de rotation selon l'input (-1, 0, ou 1)
    const rotationInput = inputComp.barRotationInput;
    if (rotationInput !== 0) {
      // Appliquer la rotation progressive
      const rotationDelta = rotationInput * this.ROTATION_SPEED * deltaTime;
      this.barRotationAngle = Math.max(
        -this.MAX_ROTATION_ANGLE,
        Math.min(this.MAX_ROTATION_ANGLE, this.barRotationAngle + rotationDelta)
      );
    } else {
      // Retour progressif au centre quand aucun input
      const RETURN_SPEED_FACTOR = 2.0;
      const returnSpeed = this.ROTATION_SPEED * RETURN_SPEED_FACTOR * deltaTime;
      if (Math.abs(this.barRotationAngle) < returnSpeed) {
        this.barRotationAngle = 0;
      } else {
        this.barRotationAngle -= Math.sign(this.barRotationAngle) * returnSpeed;
      }
    }

    // Calculer les positions mondiales des points CTRL
    const ctrlLeftLocal = kiteGeom.getPoint('CTRL_LEFT');
    const ctrlRightLocal = kiteGeom.getPoint('CTRL_RIGHT');
    
    if (!ctrlLeftLocal || !ctrlRightLocal) {
      // Fallback : rotation autour de l'axe Y si CTRL non trouvés
      const rotationRad = this.barRotationAngle * Math.PI / 180;
      const yAxis = new THREE.Vector3(0, 1, 0);
      barTransform.quaternion.setFromAxisAngle(yAxis, rotationRad);
      return;
    }

    // Convertir les points CTRL en coordonnées monde
    const ctrlLeftWorld = ctrlLeftLocal.clone()
      .applyQuaternion(kiteTransform.quaternion)
      .add(kiteTransform.position);
    const ctrlRightWorld = ctrlRightLocal.clone()
      .applyQuaternion(kiteTransform.quaternion)
      .add(kiteTransform.position);

    // Calculer le milieu des points CTRL
    const ctrlMidpoint = ctrlLeftWorld.clone()
      .add(ctrlRightWorld)
      .multiplyScalar(0.5);

    // Vecteur du pivot de la barre vers le milieu des CTRL
    const toKite = ctrlMidpoint.clone().sub(barTransform.position);
    
    // Si le vecteur est trop court, utiliser l'axe Y par défaut
    if (toKite.lengthSq() < 1e-6) {
      const rotationRad = this.barRotationAngle * Math.PI / 180;
      const yAxis = new THREE.Vector3(0, 1, 0);
      barTransform.quaternion.setFromAxisAngle(yAxis, rotationRad);
      return;
    }
    
    toKite.normalize();

    // Calculer l'axe de rotation perpendiculaire à toKite
    // rotationAxis = up × toKite (produit vectoriel)
    const up = new THREE.Vector3(0, 1, 0);
    const rotationAxis = up.clone().cross(toKite);
    
    // Si toKite est colinéaire à Y (vertical pur), utiliser l'axe X
    if (rotationAxis.lengthSq() < 1e-6) {
      rotationAxis.set(1, 0, 0);
    } else {
      rotationAxis.normalize();
    }

    // Appliquer la rotation autour de l'axe calculé
    const rotationRad = this.barRotationAngle * Math.PI / 180;
    barTransform.quaternion.setFromAxisAngle(rotationAxis, rotationRad);
  }

  /**
   * Applique la force du pilote qui maintient la barre de contrôle
   * Le pilote agit comme un ressort-amortisseur pour garder la barre en position
   */
  private applyPilotGrip(entityManager: EntityManager): void {
    const controlBar = entityManager.getEntity('controlBar');
    if (!controlBar) return;

    const barTransform = controlBar.getComponent<TransformComponent>('transform');
    const barPhysics = controlBar.getComponent<PhysicsComponent>('physics');

    if (!barTransform || !barPhysics || barPhysics.isKinematic) return;

    // Position cible de la barre (depuis CONFIG)
    const targetPosition = CONFIG.initialization.controlBarPosition.clone();

    // Force de rappel : F = -k × (x - x0) - c × v
    // Le pilote résiste au déplacement de la barre
    const displacement = barTransform.position.clone().sub(targetPosition);
    const PILOT_STIFFNESS = 300; // N/m - Résistance du bras du pilote
    const PILOT_DAMPING = 40; // Ns/m - Amortissement du mouvement

    const springForce = displacement.multiplyScalar(-PILOT_STIFFNESS);
    const dampingForce = barPhysics.velocity.clone().multiplyScalar(-PILOT_DAMPING);

    barPhysics.forces.add(springForce);
    barPhysics.forces.add(dampingForce);
  }

  /**
   * Détermine l'état du vol basé sur les tensions et l'asymétrie
   */
  private updateFlightState(pilotComp: PilotComponent): void {
    const avgTension = pilotComp.totalFeedbackMagnitude;
    const asymmetry = pilotComp.asymmetry;
    
    // Seuils (à calibrer selon le modèle physique)
    const idleThreshold = 10; // N
    const poweredThreshold = 30; // N
    const turningAsymmetryThreshold = 20; // %
    const stallThreshold = 5; // N
    
    if (avgTension < stallThreshold) {
      pilotComp.state = 'stall';
    } else if (avgTension < idleThreshold) {
      pilotComp.state = 'idle';
    } else if (asymmetry > turningAsymmetryThreshold) {
      // En virage
      pilotComp.state = pilotComp.dominantSide === 'left' ? 'turning_left' : 'turning_right';
    } else if (avgTension > poweredThreshold) {
      pilotComp.state = 'powered';
    } else {
      pilotComp.state = 'idle';
    }
  }
  
  reset(): void {
    // Rien à réinitialiser au niveau du système
  }
  
  dispose(): void {
    // Rien à disposer
  }
}
