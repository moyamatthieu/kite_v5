/**
 * SurfaceFactory.ts - Factory pour créer des surfaces et toiles
 *
 * Pattern actuel KISS : Points → Triangles pour surfaces
 * Compatible avec buildSurfaces() de StructuredObject
 */

import * as THREE from "three";

import { BaseFactory, FactoryParams } from "../base/BaseFactory";
import { StructuredObject } from "../core/StructuredObject";
import { ICreatable } from "../types/index";

export interface SurfaceParams extends FactoryParams {
  points?: Array<[string, number[]]>; // Points nommés pour la surface
  panels?: Array<string[]>; // Groupes de 3-4 points formant des panneaux
  material?: {
    color?: string;
    opacity?: number;
    transparent?: boolean;
    doubleSided?: boolean; // true = visible des deux côtés (défaut), false = une face
    side?: THREE.Side;
  };
  tension?: number; // Tension de la toile (future feature)
}

/**
 * Factory pour créer des surfaces tendues
 *
 
 *
 */
export class SurfaceFactory extends BaseFactory<StructuredObject & ICreatable> {
  protected metadata = {
    category: "surface",
    name: "Surface",
    description: "Surface tendue paramétrique",
    tags: ["surface", "toile", "membrane"],
    complexity: "simple" as const,
  };

  protected getDefaultParams(): SurfaceParams {
    return {
      points: [],
      panels: [],
      material: {
        color: "#ff0000",
        opacity: 0.9,
        transparent: true,
        doubleSided: true, // Par défaut, visible des deux côtés
      },
      tension: 1.0,
    };
  }

  /**
   * Modèle physique :
   * - La masse du kite est distribuée sur chaque surface proportionnellement à son aire (voir PHYSICS_MODEL.md §1.2).
   * - Cette logique doit être appliquée lors de la création des surfaces (buildSurfaces).
   * - Permet l'émergence naturelle des couples gravitationnels et aérodynamiques.
   */
  createObject(params?: SurfaceParams): StructuredObject & ICreatable {
    const mergedParams = this.mergeParams(params) as SurfaceParams;

    class SurfaceObject extends StructuredObject implements ICreatable {
      constructor() {
        super("Surface", false);
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
        // Pas de structure pour une surface pure
      }

      protected buildSurfaces(): void {
        // Créer les panneaux de surface
        if (mergedParams.panels) {
          mergedParams.panels.forEach((panel) => {
            // Convertir doubleSided en THREE.Side
            const mat = mergedParams.material || {};
            const side =
              mat.doubleSided !== false ? THREE.DoubleSide : THREE.FrontSide;

            // Chaque panneau est un triangle (3 points) ou quad (4 points)
            this.addSurfaceBetweenPoints(panel, {
              color: mat.color || "#ff0000",
              opacity: mat.opacity !== undefined ? mat.opacity : 0.9,
              transparent: mat.transparent !== false,
              side: mat.side || side,
            });
          });
        }
      }

      // Implémentation ICreatable
      create(): this {
        return this;
      }
      getName(): string {
        return "Surface";
      }
      getDescription(): string {
        return "Surface tendue";
      }
      getPrimitiveCount(): number {
        return (mergedParams.panels || []).length;
      }
    }

    const surface = new SurfaceObject();
    surface.init();
    return surface;
  }
}
