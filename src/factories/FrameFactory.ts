/**
 * FrameFactory.ts - Factory pour créer des structures filaires (frames)
 */

import { StructuredObject } from '../core/StructuredObject';
import { ICreatable } from '../types/index';

import { BaseFactory, FactoryMetadata } from './FactoryRegistry';

export interface FrameParams {
  diameter?: number;
  material?: string;
  points?: Array<[string, number[]]>;
  connections?: Array<[string, string]>;
}

/**
 * Factory pour créer des structures filaires
 */
export class FrameFactory implements BaseFactory {
  getSupportedTypes(): string[] {
    return ['frame', 'structure'];
  }

  getMetadata(): FactoryMetadata {
    return {
      id: 'frame_factory',
      name: 'Frame Factory',
      version: '1.0.0',
      description: 'Creates wireframe structures from connected points',
      supportedTypes: this.getSupportedTypes(),
      dependencies: []
    };
  }

  createObject(type: string, config: FrameParams = {}): StructuredObject & ICreatable {
    const params = {
      diameter: 0.01,
      material: '#333333',
      points: [],
      connections: [],
      ...config
    };

    class FrameObject extends StructuredObject implements ICreatable {
      constructor() {
        super("Frame", false);
      }

      protected definePoints(): void {
        if (params.points) {
          params.points.forEach(([name, position]) => {
            this.setPoint(name, position as [number, number, number]);
          });
        }
      }

      protected buildStructure(): void {
        if (params.connections) {
          params.connections.forEach(([point1, point2]) => {
            this.addCylinderBetweenPoints(
              point1,
              point2,
              params.diameter || 0.01,
              params.material || '#333333'
            );
          });
        }
      }

      protected buildSurfaces(): void {
        // Pas de surfaces pour un frame
      }

      create(): this { return this; }
      getName(): string { return 'Frame'; }
      getDescription(): string { return 'Structure filaire'; }
      getPrimitiveCount(): number { return params.connections?.length || 0; }
    }

    const frame = new FrameObject();
    frame.init();
    return frame;
  }

  dispose(): void {
    // Cleanup if needed
  }
}