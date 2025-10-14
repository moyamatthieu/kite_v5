
/**
 * StructuredObject.ts - Classe de base unifiée pour tous les objets 3D structurés du projet Kite
 *
 * Rôle :
 *   - Fournit une architecture orientée objet avec points anatomiques nommés
 *   - Sert de classe mère pour tous les objets 3D complexes (cerf-volant, barre, etc.)
 *   - Compatible Godot via Node3D
 *
 * Dépendances principales :
 *   - Node3D.ts : Couche d'abstraction Godot-compatible
 *   - Primitive.ts : Utilitaires pour les formes de base
 *   - Types : Position3D, NamedPoint, SurfaceOptions, MaterialConfig
 *   - Three.js : Pour la géométrie et le rendu
 *
 * Relation avec les fichiers adjacents :
 *   - Node3D.ts (dossier core) est la classe mère directe
 *   - Primitive.ts fournit les utilitaires de création
 *   - Tous les objets 3D du projet héritent de StructuredObject
 *
 * Utilisation typique :
 *   - Sert de base à la création de tous les objets 3D structurés
 *   - Permet la gestion des points, labels et debug
 *
 * Voir aussi :
 *   - src/core/Node3D.ts
 *   - src/core/Primitive.ts
 */

import * as THREE from 'three';

import { Position3D, NamedPoint, MaterialConfig } from '../types/index';
import { Point } from '../objects/Point';

import { Primitive } from './Primitive';
import { Node3D } from './Node3D';
import { DebugLayer } from './DebugLayer';

/**
 * Classe abstraite de base pour tous les objets 3D structurés
 * 🎮 Hérite de Node3D pour la compatibilité Godot
 */
export abstract class StructuredObject extends Node3D {
  /**
   * Points anatomiques nommés de l'objet
   */
  protected points: Map<string, THREE.Vector3> = new Map();

  /**
   * Points avec marqueurs visuels (debug)
   */
  protected namedPoints: NamedPoint[] = [];

  /**
   * Couche de debug séparée
   */
  protected debugLayer: DebugLayer;

  /**
   * Affichage des labels en mode debug
   */
  public showDebugPoints: boolean = false;

  /**
   * Affichage des labels de texte
   */
  public showLabels: boolean = false;

  constructor(name: string, showDebugPoints: boolean = false) {
    super(name);
    this.nodeType = 'StructuredObject';
    this.showDebugPoints = showDebugPoints;

    // Initialiser la couche de debug
    this.debugLayer = new DebugLayer(this, {
      showPoints: showDebugPoints,
      showLabels: false,
      showNormals: false,
      showAxes: false,
      pointSize: 0.02
    });

    // L'initialisation sera appelée par la classe enfant après configuration
  }

  /**
   * Initialisation automatique de l'objet
   */
  protected initialize(): void {
    // Vider le groupe au cas où
    this.clear();

    // Construire l'objet dans l'ordre
    this.definePoints();
    this.buildStructure();
    this.buildSurfaces();

    // Mettre à jour la couche de debug
    this.updateDebugLayer();
  }

  /**
   * Initialisation publique à appeler par les classes enfants
   */
  public init(): void {
    this.initialize();
  }

  /**
   * Définit tous les points anatomiques de l'objet
   * À implémenter dans chaque classe dérivée
   */
  protected abstract definePoints(): void;

  /**
   * Construit la structure rigide de l'objet (frame, squelette)
   * À implémenter dans chaque classe dérivée
   */
  protected abstract buildStructure(): void;

  /**
   * Construit les surfaces et détails visuels
   * À implémenter dans chaque classe dérivée
   */
  protected abstract buildSurfaces(): void;

  /**
   * Définit un point nommé dans l'espace
   * Accepte soit une Position3D (tuple), soit un objet Point
   */
  protected setPoint(name: string, position: Position3D | Point): void {
    let vector: THREE.Vector3;

    if (position instanceof Point) {
      vector = position.position.clone();
    } else {
      vector = new THREE.Vector3(position[0], position[1], position[2]);
    }

    this.points.set(name, vector);

    // Ajouter aux points nommés pour le debug
    this.namedPoints.push({
      name,
      position: vector.clone(),
      visible: this.showDebugPoints
    });
  }

  /**
   * Récupère un point par son nom
   */
  public getPoint(name: string): THREE.Vector3 | undefined {
    return this.points.get(name);
  }

  /**
   * Crée un cylindre entre deux points nommés
   */
  protected addCylinderBetweenPoints(
    point1Name: string,
    point2Name: string,
    radius: number,
    material: string | MaterialConfig
  ): THREE.Mesh | null {
    const p1 = this.getPoint(point1Name);
    const p2 = this.getPoint(point2Name);
    
    if (!p1 || !p2) {
      console.warn(`Points ${point1Name} ou ${point2Name} non trouvés`);
      return null;
    }

    // Calculer la distance et l'orientation
    const distance = p1.distanceTo(p2);
    const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    
    // Créer le cylindre
    const cylinder = Primitive.cylinder(radius, distance, material);
    
    // Orienter le cylindre
    const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction
    );
    cylinder.quaternion.copy(quaternion);
    cylinder.position.copy(midpoint);
    
    // Ajouter au groupe
    this.add(cylinder);
    return cylinder;
  }

  /**
   * Crée une surface entre des points nommés
   */
  protected addSurfaceBetweenPoints(
    pointNames: string[],
    material: string | MaterialConfig
  ): THREE.Mesh | null {
    if (pointNames.length < 3) {
      console.warn('Il faut au moins 3 points pour créer une surface');
      return null;
    }

    const points: THREE.Vector3[] = [];
    
    // Récupérer tous les points
    for (const name of pointNames) {
      const point = this.getPoint(name);
      if (!point) {
        console.warn(`Point ${name} non trouvé`);
        return null;
      }
      points.push(point);
    }

    // Créer la surface
    const surface = Primitive.surface(points, material);
    this.add(surface);
    return surface;
  }

  /**
   * Ajoute une primitive à une position donnée
   */
  protected addPrimitiveAt(
    primitive: THREE.Mesh,
    position: Position3D
  ): void {
    primitive.position.set(position[0], position[1], position[2]);
    this.add(primitive);
  }

  /**
   * Ajoute une primitive à la position d'un point nommé
   */
  protected addPrimitiveAtPoint(
    primitive: THREE.Mesh,
    pointName: string
  ): boolean {
    const point = this.getPoint(pointName);
    if (!point) {
      console.warn(`Point ${pointName} non trouvé`);
      return false;
    }
    
    primitive.position.copy(point);
    this.add(primitive);
    return true;
  }

  /**
   * Met à jour la couche de debug avec les points actuels
   */
  protected updateDebugLayer(): void {
    // Vider la couche de debug
    this.debugLayer.clear();

    if (this.showDebugPoints) {
      // Ajouter tous les points nommés
      for (const [name, position] of this.points.entries()) {
        this.debugLayer.addPoint(position, 0xffff00, this.showLabels ? name : undefined);
      }
    }
  }
  
  /**
   * Crée un label de texte pour un point
   */
  private createTextLabel(text: string): THREE.Sprite {
    // Créer un canvas pour le texte
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    
    // Style du texte
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'Bold 24px Arial';
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Créer une texture depuis le canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Créer un sprite avec la texture
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Ajuster la taille du sprite
    sprite.scale.set(0.3, 0.075, 1);
    
    return sprite;
  }

  /**
   * Active/désactive l'affichage des marqueurs de debug
   */
  public setShowDebugPoints(show: boolean): void {
    this.showDebugPoints = show;
    this.debugLayer.setShowPoints(show);
  }

  /**
   * Active/désactive l'affichage des labels de texte
   */
  public setShowLabels(show: boolean): void {
    this.showLabels = show;
    this.debugLayer.setShowLabels(show);
    // Si les points de debug ne sont pas activés et qu'on veut les labels, activer les deux
    if (show && !this.showDebugPoints) {
      this.setShowDebugPoints(true);
    }
  }  /**
   * Retourne tous les noms de points définis
   */
  public getPointNames(): string[] {
    return Array.from(this.points.keys());
  }

  /**
   * Retourne le nombre de points définis
   */
  public getPointCount(): number {
    return this.points.size;
  }

  /**
   * Retourne les informations sur un point
   */
  public getPointInfo(name: string): NamedPoint | undefined {
    const point = this.getPoint(name);
    if (!point) return undefined;
    
    return {
      name,
      position: point.clone(),
      visible: this.showDebugPoints
    };
  }
}