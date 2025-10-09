/**
 * DebugLayer.ts - Couche de debug visuel pour les objets 3D
 *
 * Rôle : Gestion centralisée de tous les éléments de debug visuel
 * Sépare complètement la logique de debug du mesh principal
 */

import * as THREE from 'three';
import { Node3D } from './Node3D';

export interface DebugOptions {
  showPoints?: boolean;
  showLabels?: boolean;
  showAxes?: boolean;
  showNormals?: boolean;
  pointSize?: number;
  labelSize?: number;
  axisLength?: number;
}

export class DebugLayer {
  public group: THREE.Group;
  private parent: Node3D;
  private options: DebugOptions;
  private pointsGroup: THREE.Group;
  private labelsGroup: THREE.Group;
  private axesGroup: THREE.Group;
  private normalsGroup: THREE.Group;

  constructor(parent: Node3D, options: DebugOptions = {}) {
    this.parent = parent;
    this.options = {
      showPoints: false,
      showLabels: false,
      showAxes: false,
      showNormals: false,
      pointSize: 0.05,
      labelSize: 0.1,
      axisLength: 1.0,
      ...options
    };

    this.group = new THREE.Group();
    this.group.name = `${parent.name}_debug`;

    this.pointsGroup = new THREE.Group();
    this.pointsGroup.name = 'points';
    this.group.add(this.pointsGroup);

    this.labelsGroup = new THREE.Group();
    this.labelsGroup.name = 'labels';
    this.group.add(this.labelsGroup);

    this.axesGroup = new THREE.Group();
    this.axesGroup.name = 'axes';
    this.group.add(this.axesGroup);

    this.normalsGroup = new THREE.Group();
    this.normalsGroup.name = 'normals';
    this.group.add(this.normalsGroup);

    this.updateVisibility();
  }

  /**
   * Active/désactive l'affichage des points
   */
  setShowPoints(show: boolean): void {
    this.options.showPoints = show;
    this.updateVisibility();
  }

  /**
   * Active/désactive l'affichage des labels
   */
  setShowLabels(show: boolean): void {
    this.options.showLabels = show;
    this.updateVisibility();
  }

  /**
   * Active/désactive l'affichage des axes
   */
  setShowAxes(show: boolean): void {
    this.options.showAxes = show;
    this.updateVisibility();
  }

  /**
   * Active/désactive l'affichage des normales
   */
  setShowNormals(show: boolean): void {
    this.options.showNormals = show;
    this.updateVisibility();
  }

  /**
   * Ajoute un point de debug
   */
  addPoint(position: THREE.Vector3, color: number = 0xff0000, name?: string): void {
    const geometry = new THREE.SphereGeometry(this.options.pointSize, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color });
    const point = new THREE.Mesh(geometry, material);

    point.position.copy(position);
    if (name) point.name = name;

    this.pointsGroup.add(point);
  }

  /**
   * Ajoute une étiquette de debug
   */
  addLabel(position: THREE.Vector3, text: string, color: number = 0xffffff): void {
    // Note: Pour une vraie implémentation, il faudrait une bibliothèque de texte 3D
    // Pour l'instant, on utilise un point coloré avec le nom
    const geometry = new THREE.SphereGeometry(this.options.labelSize! * 0.5, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color });
    const label = new THREE.Mesh(geometry, material);

    label.position.copy(position);
    label.name = text;

    this.labelsGroup.add(label);
  }

  /**
   * Dessine les axes XYZ
   */
  drawAxes(length: number = this.options.axisLength!): void {
    this.clearAxes();

    // Axe X (rouge)
    const xAxis = this.createAxis(new THREE.Vector3(length, 0, 0), 0xff0000);
    this.axesGroup.add(xAxis);

    // Axe Y (vert)
    const yAxis = this.createAxis(new THREE.Vector3(0, length, 0), 0x00ff00);
    this.axesGroup.add(yAxis);

    // Axe Z (bleu)
    const zAxis = this.createAxis(new THREE.Vector3(0, 0, length), 0x0000ff);
    this.axesGroup.add(zAxis);
  }

  /**
   * Nettoie tous les éléments de debug
   */
  clear(): void {
    this.clearPoints();
    this.clearLabels();
    this.clearAxes();
    this.clearNormals();
  }

  /**
   * Met à jour la visibilité selon les options
   */
  private updateVisibility(): void {
    this.pointsGroup.visible = this.options.showPoints!;
    this.labelsGroup.visible = this.options.showLabels!;
    this.axesGroup.visible = this.options.showAxes!;
    this.normalsGroup.visible = this.options.showNormals!;
  }

  private createAxis(direction: THREE.Vector3, color: number): THREE.Group {
    const group = new THREE.Group();

    // Ligne de l'axe
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      direction
    ]);
    const material = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geometry, material);
    group.add(line);

    // Flèche à l'extrémité
    const arrowGeometry = new THREE.ConeGeometry(0.05, 0.2, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.copy(direction);
    arrow.lookAt(direction);
    group.add(arrow);

    return group;
  }

  private clearPoints(): void {
    while (this.pointsGroup.children.length > 0) {
      const child = this.pointsGroup.children[0];
      this.pointsGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  private clearLabels(): void {
    while (this.labelsGroup.children.length > 0) {
      const child = this.labelsGroup.children[0];
      this.labelsGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  private clearAxes(): void {
    while (this.axesGroup.children.length > 0) {
      const child = this.axesGroup.children[0];
      this.axesGroup.remove(child);
      // Nettoyer récursivement les géométries et matériaux
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        } else if (obj instanceof THREE.Line) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }
  }

  private clearNormals(): void {
    while (this.normalsGroup.children.length > 0) {
      const child = this.normalsGroup.children[0];
      this.normalsGroup.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }
}