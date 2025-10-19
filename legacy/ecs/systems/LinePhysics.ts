/**
 * LinePhysics.ts - Calculs simplifiés pour les lignes
 *
 * APPROCHE SIMPLIFIÉE :
 *   - Lignes = segments droits rigides (longueur fixe)
 *   - Calcul simple de tension pour feedback visuel
 *   - Pas d'élasticité complexe, pas de caténaire, pas de damping
 */
import { Vector3 } from 'three';
import { LineConfig } from '@components/LineComponent';
import { CONFIG } from '@config/SimulationConfig';

export class LinePhysics {
  private static readonly EPSILON = 1e-6;

  calculateTension(lineConfig: LineConfig, startPos: Vector3, endPos: Vector3): number {
    const currentLength = startPos.distanceTo(endPos);
    if (currentLength < LinePhysics.EPSILON) return 0;
    const restLength = lineConfig.length;
    if (currentLength > restLength) {
      const extension = currentLength - restLength;
      const tension = lineConfig.stiffness * extension;
      return Math.min(tension, lineConfig.maxTension);
    }
    return 0;
  }

  calculateTensionForce(lineConfig: LineConfig, startPos: Vector3, endPos: Vector3): Vector3 {
    const lineVector = new Vector3().subVectors(endPos, startPos);
    const currentLength = lineVector.length();
    if (currentLength < LinePhysics.EPSILON) return new Vector3();
    const direction = lineVector.normalize();
    const tension = this.calculateTension(lineConfig, startPos, endPos);
    return direction.multiplyScalar(tension);
  }

  isLineTaut(lineConfig: LineConfig, startPos: Vector3, endPos: Vector3): boolean {
    const currentLength = startPos.distanceTo(endPos);
    return currentLength >= lineConfig.length * 0.99;
  }

  calculateLinePoints(startPos: Vector3, endPos: Vector3): Vector3[] {
    return [startPos.clone(), endPos.clone()];
  }

  validateLine(lineConfig: LineConfig): boolean {
    return lineConfig.length > 0 && lineConfig.stiffness > 0 && lineConfig.maxTension > 0;
  }
}