/**
 * DebugComponent.ts - Données de visualisation du debug
 *
 * Stocke les vecteurs et flèches pour l'affichage du debug.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';
import { DebugConfig } from '../config/Config';

export class DebugComponent extends Component {
  readonly type = 'debug';
  
  /** Flèches de visualisation des forces */
  forceArrows: THREE.ArrowHelper[] = [];
  
  /** Labels textuels pour identifier les faces (sprites) */
  faceLabels: THREE.Sprite[] = [];
  
  /** Labels meshes persistants pour les faces (créés une seule fois) */
  faceLabelMeshes: THREE.Mesh[] = [];
  
  /** Flag pour savoir si les labels de faces ont été créés */
  labelsCreated = false;
  
  /** Groupe contenant tous les éléments de debug */
  debugGroup: THREE.Group;
  
  constructor() {
    super();
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'debug-group';
  }
  
  /**
   * Nettoie les flèches précédentes
   */
  clearArrows(): void {
    this.forceArrows.forEach(arrow => {
      // Nettoyer les géométries et matériaux
      if (arrow.line) {
        const lineObject = arrow.line as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
        if (lineObject.geometry) {
          lineObject.geometry.dispose();
        }
        if (lineObject.material) {
          const mat = lineObject.material;
          if (Array.isArray(mat)) {
            mat.forEach((m: THREE.Material) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      }
      if (arrow.cone) {
        const coneObject = arrow.cone as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
        if (coneObject.geometry) {
          coneObject.geometry.dispose();
        }
        if (coneObject.material) {
          const mat = coneObject.material;
          if (Array.isArray(mat)) {
            mat.forEach((m: THREE.Material) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      }
      // Retirer du groupe
      this.debugGroup.remove(arrow);
    });
    this.forceArrows = [];
    
    // Nettoyer aussi les labels sprites (temporaires)
    this.faceLabels.forEach(label => {
      if (label.material) {
        if (label.material.map) {
          label.material.map.dispose();
        }
        label.material.dispose();
      }
      this.debugGroup.remove(label);
    });
    this.faceLabels = [];
    
    // ⚠️ NE PAS détruire les faceLabelMeshes ici!
    // Ils sont persistants et gérés séparément
  }
  
  /**
   * Nettoie TOUT y compris les labels persistants (appelé quand debug se désactive)
   */
  clearAll(): void {
    this.clearArrows();
    
    // Nettoyer les meshes de labels persistants
    this.faceLabelMeshes.forEach(mesh => {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (mat.map) {
          mat.map.dispose();
        }
        mat.dispose();
      }
      this.debugGroup.remove(mesh);
    });
    this.faceLabelMeshes = [];
    this.labelsCreated = false;
  }
  
  /**
   * Ajoute une flèche de force
   */
  addForceArrow(origin: THREE.Vector3, direction: THREE.Vector3, color: number, name: string): void {
    // Créer une flèche (helper Three.js)
    const length = direction.length();
    if (length < DebugConfig.MIN_FORCE_ARROW_DISPLAY) return; // Ignorer les forces très petites
    
    const arrow = new THREE.ArrowHelper(
      direction.clone().normalize(),
      origin.clone(),
      Math.min(length, DebugConfig.MAX_FORCE_ARROW_LENGTH), // Limiter la longueur pour la visibilité
      color
    );
    
    arrow.name = name;
    this.forceArrows.push(arrow);
    this.debugGroup.add(arrow);
  }
  
  /**
   * Ajoute un label textuel à une position donnée
   */
  addTextLabel(text: string, position: THREE.Vector3, color = '#ffffff', size = 0.5): void {
    // Créer un canvas pour dessiner le texte
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Taille du canvas
    canvas.width = DebugConfig.CANVAS_SMALL_SIZE;
    canvas.height = DebugConfig.CANVAS_SMALL_SIZE;
    
    // Style du texte
    context.fillStyle = color;
    context.font = 'Bold 80px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Dessiner le texte
    context.fillText(text, DebugConfig.CANVAS_SMALL_CENTER, DebugConfig.CANVAS_SMALL_CENTER);
    
    // Créer une texture depuis le canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Créer un matériau sprite
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false, // Toujours visible au-dessus
      depthWrite: false
    });
    
    // Créer le sprite
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(size, size, 1);
    
    this.faceLabels.push(sprite);
    this.debugGroup.add(sprite);
  }
  
  /**
   * Ajoute un label "collé" à une surface (mesh plat aligné avec la face)
   * Version optimisée: crée le mesh une seule fois, puis réutilise
   * @param text Texte à afficher
   * @param position Position du centre du label (centroïde de la face)
   * @param normal Normale de la surface pour alignement
   * @param color Couleur du texte
   * @param size Taille du label (en mètres)
   */
  addSurfaceLabel(text: string, position: THREE.Vector3, normal: THREE.Vector3, color = '#FFFF00', size = 0.5): void {
    // Créer un canvas pour dessiner le texte
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Taille du canvas (haute résolution pour meilleure qualité)
    canvas.width = DebugConfig.CANVAS_LARGE_SIZE;
    canvas.height = DebugConfig.CANVAS_LARGE_SIZE;
    
    // Pas de fond - transparent uniquement
    context.clearRect(0, 0, DebugConfig.CANVAS_LARGE_SIZE, DebugConfig.CANVAS_LARGE_SIZE);
    
    // Style du texte
    context.fillStyle = color;
    context.font = 'Bold 320px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Dessiner le texte
    context.fillText(text, DebugConfig.CANVAS_LARGE_CENTER, DebugConfig.CANVAS_LARGE_CENTER);
    
    // Créer une texture depuis le canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Créer un matériau avec la texture
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide, // Visible des deux côtés
      depthTest: true,
      depthWrite: false
    });
    
    // Créer une géométrie plane
    const geometry = new THREE.PlaneGeometry(size, size);
    
    // Créer le mesh
    const mesh = new THREE.Mesh(geometry, material);
    
    // Positionner le mesh au centre exact de la face
    mesh.position.copy(position);
    
    // Orienter le mesh parallèle à la face (aligné avec la normale)
    // Créer un quaternion qui aligne le vecteur Z local avec la normale
    const up = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, normal.clone().normalize());
    mesh.quaternion.copy(quaternion);
    
    // Légèrement décalé le long de la normale pour éviter z-fighting avec la face
    mesh.position.add(normal.clone().normalize().multiplyScalar(DebugConfig.MIN_FORCE_ARROW_DISPLAY));
    
    // Stocker dans le tableau des meshes persistants
    this.faceLabelMeshes.push(mesh);
    this.debugGroup.add(mesh);
  }
  
  /**
   * Met à jour la position d'un label existant (sans le recréer)
   * @param index Index du label dans faceLabelMeshes
   * @param position Nouvelle position
   * @param normal Nouvelle normale
   */
  updateSurfaceLabel(index: number, position: THREE.Vector3, normal: THREE.Vector3): void {
    if (index >= this.faceLabelMeshes.length) return;
    
    const mesh = this.faceLabelMeshes[index];
    
    // Mettre à jour la position
    mesh.position.copy(position);
    
    // Mettre à jour l'orientation
    const up = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, normal.clone().normalize());
    mesh.quaternion.copy(quaternion);
    
    // Décalage pour éviter z-fighting
    mesh.position.add(normal.clone().normalize().multiplyScalar(DebugConfig.MIN_FORCE_ARROW_DISPLAY));
  }
}

