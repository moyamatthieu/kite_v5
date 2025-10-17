/**
 * PBDDiagnostics.ts - Diagnostic et logging avancé pour Position-Based Dynamics
 *
 * Rôle :
 *   - Calculer et logger les métriques de convergence PBD
 *   - Suivre les erreurs de contraintes (moyennes, max, par type)
 *   - Détecter les anomalies (divergence, NaN, drift)
 *   - Fournir données pour validation physique
 *
 * Utilisation :
 *   PBDDiagnostics.logIterationMetrics(iter, constraintErrors);
 *   PBDDiagnostics.logFinalState(kitePos, pilotPos, flightSphere);
 */

import * as THREE from 'three';
import { Logger } from '@utils/Logging';


/**
 * Interface décrivant les erreurs d'une contrainte PBD
 */
export interface ConstraintError {
  name: string;
  error: number; // Distance absolue (m)
  targetLength: number; // Longueur cible (m)
  relativeError: number; // Erreur relative (sans unité, 0-1)
}

/**
 * Métriques d'une itération PBD
 */
export interface IterationMetrics {
  iteration: number;
  maxError: number; // m
  avgError: number; // m
  maxRelativeError: number; // %
  avgRelativeError: number; // %
  constraintCount: number;
  hasConverged: boolean; // true si maxError < TOLERANCE
}

/**
 * Historique de convergence PBD
 */
export interface ConvergenceHistory {
  iterations: IterationMetrics[];
  finalMaxError: number;
  finalAvgError: number;
  converged: boolean;
  diverged: boolean; // true si erreur augmente au lieu de diminuer
}

export class PBDDiagnostics {
  private static readonly CONVERGENCE_TOLERANCE = 0.01; // m - Tolérance cible (<1cm)
  private static readonly RELATIVE_ERROR_CRITICAL = 0.001; // 0.1% - Seuil critique
  private static readonly LOG_INTERVAL = 1.0; // s - Intervalle de logging INFO
  private static lastLogTime = 0;

  /**
   * Calcule les métriques d'une itération PBD
   */
  static calculateIterationMetrics(
    iteration: number,
    constraintErrors: ConstraintError[]
  ): IterationMetrics {
    if (constraintErrors.length === 0) {
      return {
        iteration,
        maxError: 0,
        avgError: 0,
        maxRelativeError: 0,
        avgRelativeError: 0,
        constraintCount: 0,
        hasConverged: true
      };
    }

    const maxError = Math.max(...constraintErrors.map(c => c.error));
    const avgError = constraintErrors.reduce((sum, c) => sum + c.error, 0) / constraintErrors.length;
    const maxRelativeError = Math.max(...constraintErrors.map(c => c.relativeError)) * 100;
    const avgRelativeError = (constraintErrors.reduce((sum, c) => sum + c.relativeError, 0) / constraintErrors.length) * 100;

    return {
      iteration,
      maxError,
      avgError,
      maxRelativeError,
      avgRelativeError,
      constraintCount: constraintErrors.length,
      hasConverged: maxError < this.CONVERGENCE_TOLERANCE
    };
  }

  /**
   * Log détaillé d'une itération PBD (mode DEBUG)
   */
  static logIterationMetrics(
    iteration: number,
    constraintErrors: ConstraintError[]
  ): void {
    const metrics = this.calculateIterationMetrics(iteration, constraintErrors);

    Logger.getInstance().debug(
      `PBD iter=${iteration}: max=${metrics.maxError.toFixed(4)}m (${metrics.maxRelativeError.toFixed(2)}%), ` +
      `avg=${metrics.avgError.toFixed(4)}m (${metrics.avgRelativeError.toFixed(2)}%), ` +
      `converged=${metrics.hasConverged}`,
      'PBDDiagnostics'
    );

    // Log détaillé par contrainte si erreur critique
    if (metrics.maxRelativeError > this.RELATIVE_ERROR_CRITICAL * 100) {
      constraintErrors.forEach(c => {
        if (c.relativeError > this.RELATIVE_ERROR_CRITICAL) {
          Logger.getInstance().warn(
            `  ${c.name}: error=${c.error.toFixed(4)}m (${(c.relativeError * 100).toFixed(2)}%), target=${c.targetLength.toFixed(2)}m`,
            'PBDDiagnostics'
          );
        }
      });
    }
  }

  /**
   * Analyse l'historique de convergence et détecte la divergence
   */
  static analyzeConvergence(history: IterationMetrics[]): ConvergenceHistory {
    if (history.length === 0) {
      return {
        iterations: [],
        finalMaxError: 0,
        finalAvgError: 0,
        converged: false,
        diverged: false
      };
    }

    const finalMetrics = history[history.length - 1];

    // Détection de divergence : erreur augmente sur les 3 dernières itérations
    let diverged = false;
    if (history.length >= 3) {
      const last3 = history.slice(-3);
      const isIncreasing = last3[1].maxError > last3[0].maxError &&
                          last3[2].maxError > last3[1].maxError;
      diverged = isIncreasing;
    }

    return {
      iterations: history,
      finalMaxError: finalMetrics.maxError,
      finalAvgError: finalMetrics.avgError,
      converged: finalMetrics.hasConverged,
      diverged
    };
  }

  /**
   * Log état final après toutes les itérations (mode INFO, throttlé)
   */
  static logFinalState(
    currentTime: number,
    kitePosition: THREE.Vector3,
    pilotPosition: THREE.Vector3,
    sphereRadius: number,
    convergence: ConvergenceHistory
  ): void {
    // Throttling : log seulement toutes les LOG_INTERVAL secondes
    if (currentTime - this.lastLogTime < this.LOG_INTERVAL) {
      return;
    }
    this.lastLogTime = currentTime;

    const distance = kitePosition.distanceTo(pilotPosition);
    const distanceError = Math.abs(distance - sphereRadius);

    Logger.getInstance().info(
      `PBD final: dist=${distance.toFixed(2)}m (target=${sphereRadius.toFixed(1)}m, err=${distanceError.toFixed(3)}m), ` +
      `maxErr=${convergence.finalMaxError.toFixed(4)}m, avgErr=${convergence.finalAvgError.toFixed(4)}m, ` +
      `converged=${convergence.converged}, diverged=${convergence.diverged}`,
      'PBDDiagnostics'
    );

    // Log position kite simplifiée
    Logger.getInstance().info(
      `Kite pos: x=${kitePosition.x.toFixed(2)}m, y=${kitePosition.y.toFixed(2)}m, z=${kitePosition.z.toFixed(2)}m`,
      'PBDDiagnostics'
    );

    // Alerte si divergence ou non-convergence critique
    if (convergence.diverged) {
      Logger.getInstance().error(
        `⚠️ PBD DIVERGENCE detected! Final error=${convergence.finalMaxError.toFixed(4)}m increasing over iterations`,
        'PBDDiagnostics'
      );
    } else if (!convergence.converged && convergence.finalMaxError > 0.1) {
      Logger.getInstance().warn(
        `⚠️ PBD convergence incomplete: error=${convergence.finalMaxError.toFixed(4)}m > tolerance=${this.CONVERGENCE_TOLERANCE}m`,
        'PBDDiagnostics'
      );
    }

    // Alerte si kite s'échappe de la sphère de vol
    if (distance > sphereRadius + 0.5) {
      Logger.getInstance().error(
        `⚠️ KITE ESCAPING flight sphere! Distance=${distance.toFixed(2)}m > radius=${sphereRadius.toFixed(1)}m`,
        'PBDDiagnostics'
      );
    }
  }

  /**
   * Crée une erreur de contrainte depuis des positions et longueur cible
   */
  static createConstraintError(
    name: string,
    pos1: THREE.Vector3,
    pos2: THREE.Vector3,
    targetLength: number
  ): ConstraintError {
    const currentLength = pos1.distanceTo(pos2);
    const error = Math.abs(currentLength - targetLength);
    const relativeError = error / Math.max(targetLength, 0.001); // Éviter division par zéro

    return {
      name,
      error,
      targetLength,
      relativeError
    };
  }

  /**
   * Reset du timer de logging (appelé lors de reset simulation)
   */
  static reset(): void {
    this.lastLogTime = 0;
  }
}
