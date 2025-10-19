/**
 * PilotFeedbackSystem.ts - Système ECS pur pour le feedback haptique du pilote
 *
 * ✅ PHASE 2.3 : Feedback Pilote avec Filtrage Inertiel
 *
 * Rôle :
 *   - Lit les tensions des lignes depuis LineSystem
 *   - Applique filtrage inertiel (lerp dt*5.0) pour feedback fluide
 *   - Détecte l'asymétrie et le côté dominant
 *   - Met à jour PilotFeedbackComponent pour consommation UI/haptic
 *
 * Architecture ECS :
 *   - Hérite de BaseSimulationSystem
 *   - Query l'entité pilote avec PilotFeedbackComponent
 *   - Lit LineSystem.getTensions() pour données brutes
 *   - Écrit vers PilotFeedbackComponent (données filtrées)
 *
 * Physique du filtrage :
 *   - Filtrage inertiel : newValue = lerp(oldValue, targetValue, dt * filterRate)
 *   - filterRate = 5.0 → constante de temps τ = 1/5 = 0.2s
 *   - À 60fps (dt=0.0167s) : blending ≈ 8% → très lisse
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { Entity } from '@base/Entity';
import { EntityManager } from '@entities/EntityManager';
import { PilotFeedbackComponent } from '@components/PilotFeedbackComponent';
import { Logger } from '@utils/Logging';

import { PureLineSystem } from '@/ecs/systems/LineSystem';

/**
 * Système ECS pur pour le feedback haptique du pilote
 */
export class PilotFeedbackSystem extends BaseSimulationSystem {
  private entityManager: EntityManager;
  private lineSystem: PureLineSystem | null = null;
  private pilotEntity: Entity | null = null;
  private pilotFeedback: PilotFeedbackComponent | null = null;
  private logger = Logger.getInstance();

  // Constantes de filtrage
  private readonly FILTER_RATE = 5.0; // Constante de temps τ = 1/5 = 0.2s
  private readonly ASYMMETRY_THRESHOLD = 10; // % - Seuil minimum pour détecter asymétrie
  private readonly POWER_THRESHOLD = 20; // N - Seuil pour détecter "powered" vs "idle"

  constructor(entityManager: EntityManager) {
    super('PilotFeedbackSystem', 65); // Priorité 65 (après tensions, avant UI)
    this.entityManager = entityManager;
  }

  /**
   * Initialise le système
   */
  initialize(): void {
    // Trouver l'entité pilote (ou kite, qui contient le feedback)
    const allEntities = this.entityManager.getAllEntities();
    this.pilotEntity = allEntities.find(e => e.id === 'pilot') || null;

    if (this.pilotEntity) {
      const feedback = this.pilotEntity.getComponent<PilotFeedbackComponent>('pilotFeedback');
      if (feedback) {
        this.pilotFeedback = feedback;
      }
    }

    if (!this.pilotEntity || !this.pilotFeedback) {
      this.logger.warn(
        'Pilot entity or PilotFeedbackComponent not found - creating default',
        'PilotFeedbackSystem'
      );
      // Créer une entité pilot par défaut
      this.pilotEntity = new Entity('pilot');
      this.pilotFeedback = new PilotFeedbackComponent();
      this.pilotEntity.addComponent(this.pilotFeedback);
    }
  }

  /**
   * Configure le système de lignes pour accès aux tensions brutes
   */
  setLineSystem(lineSystem: PureLineSystem): void {
    this.lineSystem = lineSystem;
  }

  /**
   * ✅ PHASE 2.3 : Met à jour le système avec filtrage inertiel
   */
  update(context: SimulationContext): void {
    if (!this.enabled || !this.pilotFeedback || !this.lineSystem) {
      return;
    }

    // Lire les tensions brutes depuis LineSystem
    const lineTensions = this.lineSystem.getTensions();
    
    // Mettre à jour les tensions brutes du feedback
    this.pilotFeedback.leftHandRawTension = lineTensions.left;
    this.pilotFeedback.rightHandRawTension = lineTensions.right;

    // ✅ PHASE 2.3 : Appliquer filtrage inertiel aux tensions
    const dt = context.deltaTime;
    const blendFactor = Math.min(dt * this.FILTER_RATE, 1.0); // Clamp [0,1]

    // Lerp des tensions filtrées (simule élasticité du système)
    this.pilotFeedback.leftHandFilteredTension = this.lerp(
      this.pilotFeedback.leftHandFilteredTension,
      lineTensions.left,
      blendFactor
    );

    this.pilotFeedback.rightHandFilteredTension = this.lerp(
      this.pilotFeedback.rightHandFilteredTension,
      lineTensions.right,
      blendFactor
    );

    // Calculer asymétrie des tensions
    const asymmetry = this.calculateAsymmetry(
      this.pilotFeedback.leftHandFilteredTension,
      this.pilotFeedback.rightHandFilteredTension
    );
    this.pilotFeedback.asymmetry = asymmetry;

    // Détecter côté dominant
    const dominantSide = this.detectDominantSide(
      this.pilotFeedback.leftHandFilteredTension,
      this.pilotFeedback.rightHandFilteredTension,
      asymmetry
    );
    this.pilotFeedback.dominantSide = dominantSide;

    // Calculer magnitude totale du feedback
    this.pilotFeedback.totalFeedbackMagnitude =
      (this.pilotFeedback.leftHandFilteredTension + this.pilotFeedback.rightHandFilteredTension) / 2;

    // Calculer taux de changement des tensions (pour détection accélération)
    const now = Date.now();
    const dt_s = (now - this.pilotFeedback.lastUpdateTime) / 1000; // Convertir en secondes
    
    if (dt_s > 0) {
      this.pilotFeedback.leftHandTensionDelta =
        (lineTensions.left - this.pilotFeedback.leftHandRawTension) / dt_s;
      this.pilotFeedback.rightHandTensionDelta =
        (lineTensions.right - this.pilotFeedback.rightHandRawTension) / dt_s;
    }

    this.pilotFeedback.lastUpdateTime = now;

    // Déterminer l'état global
    this.pilotFeedback.state = this.detectState(
      this.pilotFeedback.totalFeedbackMagnitude,
      asymmetry,
      dominantSide
    );
  }

  /**
   * Lerp simple (interpolation linéaire)
   */
  private lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }

  /**
   * Calcule l'asymétrie des tensions (%)
   */
  private calculateAsymmetry(left: number, right: number): number {
    const total = Math.max(left + right, 0.001);
    const diff = Math.abs(left - right);
    return (diff / total) * 100;
  }

  /**
   * Détecte le côté dominant basé sur l'asymétrie
   */
  private detectDominantSide(
    left: number,
    right: number,
    asymmetry: number
  ): 'left' | 'right' | 'neutral' {
    if (asymmetry < this.ASYMMETRY_THRESHOLD) {
      return 'neutral';
    }

    return left > right ? 'left' : 'right';
  }

  /**
   * Détecte l'état global du kite basé sur les tensions
   */
  private detectState(
    totalMagnitude: number,
    asymmetry: number,
    dominantSide: 'left' | 'right' | 'neutral'
  ): 'idle' | 'powered' | 'turning_left' | 'turning_right' | 'stall' {
    // État idle : tensions très basses
    if (totalMagnitude < 5) {
      return 'idle';
    }

    // État stall : très basse tension malgré tentative (signe de crash imminente)
    if (totalMagnitude < 10 && asymmetry > 30) {
      return 'stall';
    }

    // État powered : tensions normales et équilibrées
    if (totalMagnitude >= this.POWER_THRESHOLD && asymmetry < this.ASYMMETRY_THRESHOLD) {
      return 'powered';
    }

    // État turning : puissance avec asymétrie détectée
    if (dominantSide === 'left') {
      return 'turning_left';
    } else if (dominantSide === 'right') {
      return 'turning_right';
    }

    return 'powered';
  }

  /**
   * Réinitialise le système
   */
  reset(): void {
    if (this.pilotFeedback) {
      this.pilotFeedback.reset();
    }
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.lineSystem = null;
    this.pilotEntity = null;
    this.pilotFeedback = null;
  }
}
