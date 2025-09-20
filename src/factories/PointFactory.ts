/**
 * PointFactory.ts - Factory pour créer des ensembles de points anatomiques
 *
 * Pattern pour définir des collections de points nommés réutilisables
 * Permet de standardiser les points anatomiques pour différents types d'objets
 */

import { BaseFactory, FactoryParams } from "../base/BaseFactory";
import { StructuredObject } from "../core/StructuredObject";
import { ICreatable } from "../types/index";
import { Position3D, NamedPoint } from "../types/index";

export interface PointFactoryParams extends FactoryParams {
  scale?: number; // Facteur d'échelle pour tous les points
  offset?: Position3D; // Décalage appliqué à tous les points
  rotation?: [number, number, number]; // Rotation appliquée [x, y, z] en radians
  mirror?: boolean; // Créer des points symétriques (gauche/droite)
}

/**
 * Interface pour définir un ensemble de points
 */
export interface PointSet {
  name: string;
  description: string;
  points: Array<[string, Position3D]>;
  category: "organic" | "geometric" | "structural" | "custom";
}

/**
 * Factory pour créer des ensembles de points anatomiques
 */
export class PointFactory extends BaseFactory<StructuredObject & ICreatable> {
  protected metadata = {
    category: "points",
    name: "PointFactory",
    description: "Factory pour ensembles de points anatomiques",
    tags: ["points", "anatomy", "factory"],
    complexity: "simple" as const,
  };

  /**
   * Ensembles de points prédéfinis
   */
  private static readonly POINT_SETS: Record<string, PointSet> = {
    // Ensemble pour cerf-volant delta
    kite_delta: {
      name: "Cerf-volant Delta",
      description: "Points anatomiques pour cerf-volant delta classique",
      category: "organic",
      points: [
        // Points structurels principaux
        ["SPINE_BAS", [0, 0, 0]],
        ["CENTRE", [0, 0.25, 0]],
        ["NEZ", [0, 1, 0]],

        // Points des bords d'attaque
        ["BORD_GAUCHE", [-0.825, 0, 0]],
        ["BORD_DROIT", [0.825, 0, 0]],

        // Points d'intersection pour le spreader
        ["INTER_GAUCHE", [-0.55, 0.25, 0]],
        ["INTER_DROIT", [0.55, 0.25, 0]],

        // Points de fixation whiskers
        ["FIX_GAUCHE", [-0.385, 0.25, 0]],
        ["FIX_DROIT", [0.385, 0.25, 0]],

        // Points des whiskers
        ["WHISKER_GAUCHE", [-0.25, 0.01, -0.075]],
        ["WHISKER_DROIT", [0.25, 0.01, -0.075]],

        // Points de contrôle (bridage)
        ["CTRL_GAUCHE", [-0.225, 0.5, 0.5]],
        ["CTRL_DROIT", [0.225, 0.5, 0.5]],
      ],
    },

    // Ensemble pour aile delta simple
    wing_delta: {
      name: "Aile Delta Simple",
      description: "Points pour aile delta basique",
      category: "organic",
      points: [
        ["RACINE", [0, 0, 0]],
        ["POINTE", [0, 1, 0]],
        ["BORD_ATTAQUE_GAUCHE", [-0.5, 0, 0]],
        ["BORD_ATTAQUE_DROIT", [0.5, 0, 0]],
        ["BORD_FUYANT_GAUCHE", [-0.3, 0.7, 0]],
        ["BORD_FUYANT_DROIT", [0.3, 0.7, 0]],
      ],
    },

    // Ensemble géométrique - cube
    cube: {
      name: "Cube Géométrique",
      description: "8 points d'un cube unité",
      category: "geometric",
      points: [
        ["FACE_AVANT_BAS_GAUCHE", [-0.5, -0.5, 0.5]],
        ["FACE_AVANT_BAS_DROIT", [0.5, -0.5, 0.5]],
        ["FACE_AVANT_HAUT_GAUCHE", [-0.5, 0.5, 0.5]],
        ["FACE_AVANT_HAUT_DROIT", [0.5, 0.5, 0.5]],
        ["FACE_ARRIERE_BAS_GAUCHE", [-0.5, -0.5, -0.5]],
        ["FACE_ARRIERE_BAS_DROIT", [0.5, -0.5, -0.5]],
        ["FACE_ARRIERE_HAUT_GAUCHE", [-0.5, 0.5, -0.5]],
        ["FACE_ARRIERE_HAUT_DROIT", [0.5, 0.5, -0.5]],
      ],
    },

    // Ensemble structural - frame triangulaire
    frame_triangle: {
      name: "Frame Triangulaire",
      description: "Points pour structure triangulaire",
      category: "structural",
      points: [
        ["SOMMET_A", [0, 1, 0]],
        ["SOMMET_B", [-0.866, -0.5, 0]],
        ["SOMMET_C", [0.866, -0.5, 0]],
        ["CENTRE", [0, 0, 0]],
      ],
    },
  };

  protected getDefaultParams(): PointFactoryParams {
    return {
      scale: 1.0,
      offset: [0, 0, 0],
      rotation: [0, 0, 0],
      mirror: false,
    };
  }

  /**
   * Créer un objet avec un ensemble de points prédéfini
   */
  createObject(params?: PointFactoryParams): StructuredObject & ICreatable {
    const mergedParams = this.mergeParams(params) as PointFactoryParams;

    class PointObject extends StructuredObject implements ICreatable {
      private pointSetName: string = "";
      private pointSetParams: PointFactoryParams = {};

      constructor(setName?: string, setParams?: PointFactoryParams) {
        super("PointObject", false);
        if (setName) {
          this.pointSetName = setName;
          this.pointSetParams = setParams || {};
        }
        this.init();
      }

      protected definePoints(): void {
        if (this.pointSetName) {
          this.applyPointSet(this.pointSetName, this.pointSetParams);
        }
      }

      /**
       * Appliquer un ensemble de points à cet objet
       */
      private applyPointSet(setName: string, params: PointFactoryParams): void {
        const pointSet = PointFactory.POINT_SETS[setName];
        if (!pointSet) {
          console.warn(`Ensemble de points '${setName}' non trouvé`);
          return;
        }

        // Appliquer les transformations aux points
        const transformedPoints = this.transformPoints(pointSet.points, params);

        // Ajouter les points à cet objet
        transformedPoints.forEach(([name, position]) => {
          this.setPoint(name, position);
        });

        // Créer les points symétriques si demandé
        if (params.mirror) {
          this.createMirroredPoints(transformedPoints);
        }
      }

      /**
       * Transformer les points selon les paramètres
       */
      private transformPoints(
        points: Array<[string, Position3D]>,
        params: PointFactoryParams
      ): Array<[string, Position3D]> {
        return points.map(([name, position]) => {
          let [x, y, z] = position;

          // Appliquer l'échelle
          if (params.scale && params.scale !== 1.0) {
            x *= params.scale;
            y *= params.scale;
            z *= params.scale;
          }

          // Appliquer le décalage
          if (params.offset) {
            x += params.offset[0];
            y += params.offset[1];
            z += params.offset[2];
          }

          // Appliquer la rotation (simplifiée - rotation autour des axes)
          if (params.rotation) {
            [x, y, z] = this.applyRotation([x, y, z], params.rotation);
          }

          return [name, [x, y, z]];
        });
      }

      /**
       * Appliquer une rotation simple aux coordonnées
       */
      private applyRotation(
        point: Position3D,
        rotation: [number, number, number]
      ): Position3D {
        let [x, y, z] = point;
        const [rx, ry, rz] = rotation;

        // Rotation autour de X
        if (rx !== 0) {
          const cos = Math.cos(rx);
          const sin = Math.sin(rx);
          const newY = y * cos - z * sin;
          const newZ = y * sin + z * cos;
          y = newY;
          z = newZ;
        }

        // Rotation autour de Y
        if (ry !== 0) {
          const cos = Math.cos(ry);
          const sin = Math.sin(ry);
          const newX = x * cos + z * sin;
          const newZ = -x * sin + z * cos;
          x = newX;
          z = newZ;
        }

        // Rotation autour de Z
        if (rz !== 0) {
          const cos = Math.cos(rz);
          const sin = Math.sin(rz);
          const newX = x * cos - y * sin;
          const newY = x * sin + y * cos;
          x = newX;
          y = newY;
        }

        return [x, y, z];
      }

      /**
       * Créer des points symétriques (gauche/droite)
       */
      private createMirroredPoints(points: Array<[string, Position3D]>): void {
        points.forEach(([name, position]) => {
          const [x, y, z] = position;

          // Créer le point symétrique en inversant X
          const mirroredPosition: Position3D = [-x, y, z];
          let mirroredName = name;

          // Adapter le nom pour la symétrie
          if (name.includes("_GAUCHE")) {
            mirroredName = name.replace("_GAUCHE", "_DROIT");
          } else if (name.includes("_DROITE")) {
            mirroredName = name.replace("_DROITE", "_GAUCHE");
          } else if (name.includes("_LEFT")) {
            mirroredName = name.replace("_LEFT", "_RIGHT");
          } else if (name.includes("_RIGHT")) {
            mirroredName = name.replace("_RIGHT", "_LEFT");
          } else {
            // Ajouter un suffixe si pas de convention claire
            mirroredName = `${name}_MIRRORED`;
          }

          this.setPoint(mirroredName, mirroredPosition);
        });
      }

      protected buildStructure(): void {
        // Pas de structure par défaut pour les points seuls
      }

      protected buildSurfaces(): void {
        // Pas de surfaces par défaut pour les points seuls
      }

      create(): this {
        return this;
      }

      getName(): string {
        return "PointObject";
      }

      getDescription(): string {
        return "Objet contenant des points anatomiques";
      }

      getPrimitiveCount(): number {
        return 0; // Les points ne sont pas des primitives Three.js
      }
    }

    return new PointObject();
  }

  /**
   * Créer un objet avec un ensemble de points spécifique
   */
  createObjectWithPointSet(
    setName: string,
    params?: PointFactoryParams
  ): StructuredObject & ICreatable {
    const mergedParams = this.mergeParams(params) as PointFactoryParams;

    class PointSetObject extends StructuredObject implements ICreatable {
      constructor() {
        super(`PointSet_${setName}`, false);
        this.init();
      }

      protected definePoints(): void {
        this.applyPointSet(setName, mergedParams);
      }

      /**
       * Appliquer un ensemble de points à cet objet
       */
      private applyPointSet(setName: string, params: PointFactoryParams): void {
        const pointSet = PointFactory.POINT_SETS[setName];
        if (!pointSet) {
          console.warn(`Ensemble de points '${setName}' non trouvé`);
          return;
        }

        // Appliquer les transformations aux points
        const transformedPoints = this.transformPoints(pointSet.points, params);

        // Ajouter les points à cet objet
        transformedPoints.forEach(([name, position]) => {
          this.setPoint(name, position);
        });

        // Créer les points symétriques si demandé
        if (params.mirror) {
          this.createMirroredPoints(transformedPoints);
        }
      }

      /**
       * Transformer les points selon les paramètres
       */
      private transformPoints(
        points: Array<[string, Position3D]>,
        params: PointFactoryParams
      ): Array<[string, Position3D]> {
        return points.map(([name, position]) => {
          let [x, y, z] = position;

          // Appliquer l'échelle
          if (params.scale && params.scale !== 1.0) {
            x *= params.scale;
            y *= params.scale;
            z *= params.scale;
          }

          // Appliquer le décalage
          if (params.offset) {
            x += params.offset[0];
            y += params.offset[1];
            z += params.offset[2];
          }

          // Appliquer la rotation (simplifiée - rotation autour des axes)
          if (params.rotation) {
            [x, y, z] = this.applyRotation([x, y, z], params.rotation);
          }

          return [name, [x, y, z]];
        });
      }

      /**
       * Appliquer une rotation simple aux coordonnées
       */
      private applyRotation(
        point: Position3D,
        rotation: [number, number, number]
      ): Position3D {
        let [x, y, z] = point;
        const [rx, ry, rz] = rotation;

        // Rotation autour de X
        if (rx !== 0) {
          const cos = Math.cos(rx);
          const sin = Math.sin(rx);
          const newY = y * cos - z * sin;
          const newZ = y * sin + z * cos;
          y = newY;
          z = newZ;
        }

        // Rotation autour de Y
        if (ry !== 0) {
          const cos = Math.cos(ry);
          const sin = Math.sin(ry);
          const newX = x * cos + z * sin;
          const newZ = -x * sin + z * cos;
          x = newX;
          z = newZ;
        }

        // Rotation autour de Z
        if (rz !== 0) {
          const cos = Math.cos(rz);
          const sin = Math.sin(rz);
          const newX = x * cos - y * sin;
          const newY = x * sin + y * cos;
          x = newX;
          y = newY;
        }

        return [x, y, z];
      }

      /**
       * Créer des points symétriques (gauche/droite)
       */
      private createMirroredPoints(points: Array<[string, Position3D]>): void {
        points.forEach(([name, position]) => {
          const [x, y, z] = position;

          // Créer le point symétrique en inversant X
          const mirroredPosition: Position3D = [-x, y, z];
          let mirroredName = name;

          // Adapter le nom pour la symétrie
          if (name.includes("_GAUCHE")) {
            mirroredName = name.replace("_GAUCHE", "_DROIT");
          } else if (name.includes("_DROITE")) {
            mirroredName = name.replace("_DROITE", "_GAUCHE");
          } else if (name.includes("_LEFT")) {
            mirroredName = name.replace("_LEFT", "_RIGHT");
          } else if (name.includes("_RIGHT")) {
            mirroredName = name.replace("_RIGHT", "_LEFT");
          } else {
            // Ajouter un suffixe si pas de convention claire
            mirroredName = `${name}_MIRRORED`;
          }

          this.setPoint(mirroredName, mirroredPosition);
        });
      }

      protected buildStructure(): void {
        // Pas de structure par défaut
      }

      protected buildSurfaces(): void {
        // Pas de surfaces par défaut
      }

      create(): this {
        return this;
      }

      getName(): string {
        return `PointSet_${setName}`;
      }

      getDescription(): string {
        const set = PointFactory.POINT_SETS[setName];
        return set ? set.description : "Ensemble de points personnalisé";
      }

      getPrimitiveCount(): number {
        return 0;
      }
    }

    return new PointSetObject();
  }

  /**
   * Transformer les points selon les paramètres
   */
  private transformPoints(
    points: Array<[string, Position3D]>,
    params: PointFactoryParams
  ): Array<[string, Position3D]> {
    return points.map(([name, position]) => {
      let [x, y, z] = position;

      // Appliquer l'échelle
      if (params.scale && params.scale !== 1.0) {
        x *= params.scale;
        y *= params.scale;
        z *= params.scale;
      }

      // Appliquer le décalage
      if (params.offset) {
        x += params.offset[0];
        y += params.offset[1];
        z += params.offset[2];
      }

      // Appliquer la rotation (simplifiée - rotation autour des axes)
      if (params.rotation) {
        [x, y, z] = this.applyRotation([x, y, z], params.rotation);
      }

      return [name, [x, y, z]];
    });
  }

  /**
   * Appliquer une rotation simple aux coordonnées
   */
  private applyRotation(
    point: Position3D,
    rotation: [number, number, number]
  ): Position3D {
    let [x, y, z] = point;
    const [rx, ry, rz] = rotation;

    // Rotation autour de X
    if (rx !== 0) {
      const cos = Math.cos(rx);
      const sin = Math.sin(rx);
      const newY = y * cos - z * sin;
      const newZ = y * sin + z * cos;
      y = newY;
      z = newZ;
    }

    // Rotation autour de Y
    if (ry !== 0) {
      const cos = Math.cos(ry);
      const sin = Math.sin(ry);
      const newX = x * cos + z * sin;
      const newZ = -x * sin + z * cos;
      x = newX;
      z = newZ;
    }

    // Rotation autour de Z
    if (rz !== 0) {
      const cos = Math.cos(rz);
      const sin = Math.sin(rz);
      const newX = x * cos - y * sin;
      const newY = x * sin + y * cos;
      x = newX;
      y = newY;
    }

    return [x, y, z];
  }

  /**
   * Obtenir la liste des ensembles de points disponibles
   */
  getAvailablePointSets(): string[] {
    return Object.keys(PointFactory.POINT_SETS);
  }

  /**
   * Obtenir les détails d'un ensemble de points
   */
  getPointSetDetails(setName: string): PointSet | null {
    return PointFactory.POINT_SETS[setName] || null;
  }

  /**
   * Créer un nouvel ensemble de points personnalisé
   */
  createCustomPointSet(
    name: string,
    description: string,
    points: Array<[string, Position3D]>,
    category: "organic" | "geometric" | "structural" | "custom" = "custom"
  ): void {
    PointFactory.POINT_SETS[name] = {
      name,
      description,
      points,
      category,
    };
  }
}
