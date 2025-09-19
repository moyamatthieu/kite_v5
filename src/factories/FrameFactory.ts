/**
 * FrameFactory.ts - Factory pour créer des structures filaires (frames)
 * 
 * Pattern actuel KISS : Points → Cylindres entre points
 * Compatible avec buildStructure() de StructuredObject
 */

import { BaseFactory, FactoryParams } from '../base/BaseFactory';
import { StructuredObject } from '../core/StructuredObject';
import { ICreatable } from '../types/index';

export interface FrameParams extends FactoryParams {
  diameter?: number;     // Diamètre des tubes
  material?: string;     // Couleur/matériau
  points?: Array<[string, number[]]>;  // Points nommés
  connections?: Array<[string, string]>; // Connexions entre points
}

/**
 * Factory pour créer des structures filaires
 * 
 * TODO: Questions pour évolution future
 * - [ ] Supporter différents profils (carré, rond, I-beam) ? uniquemet rond
 * - [ ] Ajouter des jonctions/connecteurs aux intersections ?  non 
 * - [ ] Calculer automatiquement les connexions optimales ? non
 * - [ ] Supporter des courbes (splines) entre points ? non
 * - [ ] Ajouter contraintes mécaniques (résistance, poids) ? plus tard
  */
export class FrameFactory extends BaseFactory<StructuredObject & ICreatable> {
  protected metadata = {
    category: 'structure',
    name: 'Frame',
    description: 'Structure filaire paramétrique',
    tags: ['frame', 'structure', 'squelette'],
    complexity: 'simple' as const
  };

  protected getDefaultParams(): FrameParams {
    return {
      diameter: 0.01,
      material: '#333333',
      points: [],
      connections: []
    };
  }

  createObject(params?: FrameParams): StructuredObject & ICreatable {
    const mergedParams = this.mergeParams(params) as FrameParams;
    
    class FrameObject extends StructuredObject implements ICreatable {
      constructor() {
        super("Frame", false);
      }
      
      protected definePoints(): void {
        // Ajouter les points fournis
        if (mergedParams.points) {
          mergedParams.points.forEach(([name, position]) => {
            this.setPoint(name, position as [number, number, number]);
          });
        }
      }
      
      protected buildStructure(): void {
        // Créer les cylindres entre les points connectés
        if (mergedParams.connections) {
          mergedParams.connections.forEach(([point1, point2]) => {
            this.addCylinderBetweenPoints(
              point1, 
              point2, 
              mergedParams.diameter || 0.01,
              mergedParams.material || '#333333'
            );
          });
        }
      }
      
      protected buildSurfaces(): void {
        // Pas de surfaces pour un frame
      }
      
      // Implémentation ICreatable
      create(): this { return this; }
      getName(): string { return 'Frame'; }
      getDescription(): string { return 'Structure filaire'; }
      getPrimitiveCount(): number { return (mergedParams.connections || []).length; }
    }
    
    const frame = new FrameObject();
    frame.init();
    return frame;
  }
}
