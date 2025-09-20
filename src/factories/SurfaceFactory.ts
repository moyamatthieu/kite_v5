/**
 * SurfaceFactory.ts - Factory pour créer des surfaces et toiles
 *
 * Pattern actuel KISS : Points → Triangles pour surfaces
 * Compatible avec buildSurfaces() de StructuredObject
 */

import { BaseFactory, FactoryParams } from "../base/BaseFactory";
import { StructuredObject } from "../core/StructuredObject";
import { ICreatable } from "../types/index";
import * as THREE from "three";
import { TextureLoader } from "three";

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
 * TODO: Questions pour évolution future
 * - [ ] Implémenter subdivision de surfaces pour plus de détail ? non
 * - [ ] Ajouter simulation de tension/déformation ? non
 * - [ ] Supporter surfaces courbes (NURBS simplifiées) ? non
 * - [ ] Calculer automatiquement la triangulation optimale ? non
 * - [ ] Ajouter textures procédurales (tissage, ripstop) ? non
 * - [ ] Gérer les plis et déformations ? non
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

    const loader = new TextureLoader();
    const texture = loader.load("/textures/kite-fabric.jpg"); // Assumer asset, ou générer procedural
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: mergedParams.material?.color || 0xffddaa,
      opacity: mergedParams.material?.opacity || 0.9,
      transparent: true,
      side: THREE.DoubleSide,
    });

    // const geometry = new THREE.PlaneGeometry(...); // Basé sur points
    // const mesh = new THREE.Mesh(geometry, material);
    // mesh.castShadow = true; // Projette ombres
    // mesh.receiveShadow = true;

    return surface;
  }
}
