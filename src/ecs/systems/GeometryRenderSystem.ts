/**
 * GeometryRenderSystem.ts - Crée les meshes Three.js depuis GeometryComponent
 * 
 * Convertit les données géométriques pures en objets Three.js pour le rendu.
 * Priorité 60 (avant RenderSystem).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { Entity } from '../core/Entity';
import { GeometryComponent } from '../components/GeometryComponent';
import { VisualComponent } from '../components/VisualComponent';
import { MeshComponent } from '../components/MeshComponent';
import { KiteComponent } from '../components/KiteComponent';

// Constantes visuelles
const LINE_GEOMETRY_UPDATE_THRESHOLD = 0.01; // 1cm - seuil de recréation de géométrie
const LINE_TUBE_RADIUS = 0.003; // 3mm - rayon des lignes
const LINE_TUBE_SEGMENTS = 8; // segments radiaux du tube
const COLOR_GREEN = 0x00ff00; // Vert pour poignée droite
const COLOR_RED = 0xff0000; // Rouge pour poignée gauche

export class GeometryRenderSystem extends System {
  constructor() {
    super('GeometryRenderSystem', 60);
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;
    
    // Pour toutes les entités avec géométrie
    const entities = entityManager.query(['geometry', 'visual']);
    
    entities.forEach(entity => {
      const meshComp = entity.getComponent<MeshComponent>('mesh');
      const geometry = entity.getComponent('geometry') as GeometryComponent | undefined;
      
      if (!meshComp) {
        // Créer le mesh initial
        const mesh = this.createMesh(entity);
        if (mesh) {
          entity.addComponent(new MeshComponent(mesh));
        }
      } else if (geometry) {
        // Mettre à jour les lignes dynamiques (start/end)
        this.updateLineMesh(meshComp.object3D, geometry);
      }
    });
  }
  
  /**
   * Met à jour les positions d'une ligne dynamique (tube cylindrique)
   * Optimisé: modifie la transformation au lieu de recréer la géométrie
   */
  private updateLineMesh(mesh: THREE.Object3D, geometry: GeometryComponent): void {
    // Vérifier si c'est une ligne simple (start -> end)
    const start = geometry.getPoint('start');
    const end = geometry.getPoint('end');
    
    if (!start || !end) return;
    
    // Parcourir les enfants pour trouver le tube cylindrique
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.CylinderGeometry) {
        // Recalculer direction et longueur
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        
        // Protection contre longueurs invalides (NaN ou trop petites)
        if (!Number.isFinite(length) || length < 0.001) {
          console.warn(`⚠️ [GeometryRenderSystem] Invalid length: ${length}, skipping update`);
          return;
        }
        
        // Si la longueur a changé significativement, recréer la géométrie
        const cylinderGeometry = child.geometry as THREE.CylinderGeometry;
        const currentHeight = cylinderGeometry.parameters.height;
        if (Math.abs(length - currentHeight) > LINE_GEOMETRY_UPDATE_THRESHOLD) {
          child.geometry.dispose();
          child.geometry = new THREE.CylinderGeometry(
            LINE_TUBE_RADIUS, 
            LINE_TUBE_RADIUS, 
            length, 
            LINE_TUBE_SEGMENTS
          );
        }
        
        // Repositionner au centre (toujours nécessaire)
        const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        child.position.copy(center);
        
        // Réorienter vers la nouvelle direction (toujours nécessaire)
        child.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.normalize()
        );
      }
    });
  }
  
  /**
   * Crée un mesh Three.js depuis GeometryComponent
   */
  private createMesh(entity: Entity): THREE.Object3D | null {
    const geometry = entity.getComponent('geometry') as GeometryComponent | undefined;
    const visual = entity.getComponent('visual') as VisualComponent | undefined;
    const kite = entity.getComponent('kite') as KiteComponent | undefined;
    
    if (!geometry || !visual) return null;
    
    // Si c'est un kite, créer géométrie delta
    if (kite) {
      return this.createKiteMesh(geometry, visual);
    }
    
    // Si c'est la barre de contrôle (identifiée par ses handles)
    if (geometry.hasPoint('leftHandle') && geometry.hasPoint('rightHandle')) {
      return this.createControlBarMesh(geometry, visual);
    }
    
    // Sinon, mesh simple avec wireframe
    return this.createWireframeMesh(geometry, visual);
  }
  
  /**
   * Crée le mesh du kite delta (style main branch)
   */
  private createKiteMesh(geometry: GeometryComponent, visual: VisualComponent): THREE.Object3D {
    const group = new THREE.Group();
    group.name = 'KiteGroup';
    
    // === 1. TOILE (4 panneaux triangulaires) ===
    this.createKiteSail(group, geometry, visual);
    
    // === 2. FRAME (armature noire) ===
    this.createKiteFrame(group, geometry);
    
    // === 3. BRIDES ===
    // DÉSACTIVÉ: Les brides sont maintenant gérées par BridleRenderSystem
    // qui les affiche dynamiquement en coordonnées MONDE
    // this.createKiteBridles(group, geometry);
    
    // === 4. MARQUEURS DES POINTS DE CONTRÔLE ===
    // DÉSACTIVÉ: Les points CTRL sont visualisés via les brides dynamiques
    // Pour debug, vous pouvez réactiver cette ligne
    // this.createControlPointMarkers(group, geometry);
    
    return group;
  }
  
  /**
   * Crée le mesh de la barre de contrôle
   * - Tube cylindrique marron entre les deux handles
   * - Poignée gauche rouge
   * - Poignée droite verte
   */
  private createControlBarMesh(geometry: GeometryComponent, visual: VisualComponent): THREE.Object3D {
    const group = new THREE.Group();
    group.name = 'ControlBarGroup';
    
    const leftHandle = geometry.getPoint('leftHandle');
    const rightHandle = geometry.getPoint('rightHandle');
    
    if (!leftHandle || !rightHandle) return group;
    
    // === 1. BARRE (tube cylindrique marron) ===
    const barLength = leftHandle.distanceTo(rightHandle);
    const barGeometry = new THREE.CylinderGeometry(0.015, 0.015, barLength, 16); // 3cm de diamètre
    const barMaterial = new THREE.MeshStandardMaterial({
      color: visual.color, // Marron défini dans ControlBarFactory
      roughness: 0.6,
      metalness: 0.1
    });
    const bar = new THREE.Mesh(barGeometry, barMaterial);
    
    // Positionner et orienter le tube horizontalement
    const center = new THREE.Vector3().addVectors(leftHandle, rightHandle).multiplyScalar(0.5);
    bar.position.copy(center);
    bar.rotation.z = Math.PI / 2; // Tourner de 90° pour être horizontal
    
    group.add(bar);
    
    // === 2. POIGNÉE GAUCHE (rouge) ===
    const leftHandleGeometry = new THREE.SphereGeometry(0.035, 16, 16); // 7cm de diamètre
    const leftHandleMaterial = new THREE.MeshStandardMaterial({
      color: COLOR_RED,
      roughness: 0.4,
      metalness: 0.2
    });
    const leftHandleMesh = new THREE.Mesh(leftHandleGeometry, leftHandleMaterial);
    leftHandleMesh.position.copy(leftHandle);
    leftHandleMesh.name = 'LeftHandle';
    group.add(leftHandleMesh);
    
    // === 3. POIGNÉE DROITE (verte) ===
    const rightHandleGeometry = new THREE.SphereGeometry(0.035, 16, 16); // 7cm de diamètre
    const rightHandleMaterial = new THREE.MeshStandardMaterial({
      color: COLOR_GREEN,
      roughness: 0.4,
      metalness: 0.2
    });
    const rightHandleMesh = new THREE.Mesh(rightHandleGeometry, rightHandleMaterial);
    rightHandleMesh.position.copy(rightHandle);
    rightHandleMesh.name = 'RightHandle';
    group.add(rightHandleMesh);
    
    return group;
  }
  
  /**
   * Crée la toile du kite (4 panneaux triangulaires)
   */
  private createKiteSail(group: THREE.Group, geometry: GeometryComponent, visual: VisualComponent): void {
    // Récupérer les points nécessaires
    const nez = geometry.getPoint('NEZ');
    const bordLeft = geometry.getPoint('BORD_GAUCHE');
    const bordRight = geometry.getPoint('BORD_DROIT');
    const spineBas = geometry.getPoint('SPINE_BAS');
    const whiskerLeft = geometry.getPoint('WHISKER_GAUCHE');
    const whiskerRight = geometry.getPoint('WHISKER_DROIT');
    
    if (!nez || !bordLeft || !bordRight || !spineBas || !whiskerLeft || !whiskerRight) return;
    
    // 4 panneaux triangulaires (comme dans main)
    const panels = [
      // Toile gauche haut
      [nez, bordLeft, whiskerLeft],
      // Toile gauche bas
      [nez, whiskerLeft, spineBas],
      // Toile droite haut
      [nez, bordRight, whiskerRight],
      // Toile droite bas
      [nez, whiskerRight, spineBas]
    ];
    
    panels.forEach((panel, index) => {
      const [v1, v2, v3] = panel;
      const vertices = new Float32Array([
        v1.x, v1.y, v1.z,
        v2.x, v2.y, v2.z,
        v3.x, v3.y, v3.z
      ]);
      
      const bufferGeometry = new THREE.BufferGeometry();
      bufferGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      bufferGeometry.computeVertexNormals();
      
      const material = new THREE.MeshStandardMaterial({
        color: visual.color,
        opacity: visual.opacity,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.1
      });
      
      const mesh = new THREE.Mesh(bufferGeometry, material);
      mesh.name = `Sail_Panel_${index}`;
      group.add(mesh);
    });
  }
  
  /**
   * Crée l'armature du kite (frame noir)
   */
  private createKiteFrame(group: THREE.Group, geometry: GeometryComponent): void {
    // Connexions du frame principal
    const frameConnections = [
      ['NEZ', 'SPINE_BAS'],           // Épine centrale
      ['NEZ', 'BORD_GAUCHE'],         // Bord d'attaque gauche
      ['NEZ', 'BORD_DROIT'],          // Bord d'attaque droit
      ['INTER_GAUCHE', 'INTER_DROIT'] // Spreader (barre transversale)
    ];
    
    const frameMaterial = new THREE.LineBasicMaterial({ 
      color: 0x2a2a2a, 
      linewidth: 2 
    });
    
    frameConnections.forEach(([from, to]) => {
      const p1 = geometry.getPoint(from);
      const p2 = geometry.getPoint(to);
      if (p1 && p2) {
        const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(lineGeom, frameMaterial);
        line.name = `Frame_${from}_${to}`;
        group.add(line);
      }
    });
    
    // Whiskers (plus fins, gris foncé)
    const whiskerConnections = [
      ['WHISKER_GAUCHE', 'FIX_GAUCHE'],
      ['WHISKER_DROIT', 'FIX_DROIT']
    ];
    
    const whiskerMaterial = new THREE.LineBasicMaterial({ 
      color: 0x444444, 
      linewidth: 1 
    });
    
    whiskerConnections.forEach(([from, to]) => {
      const p1 = geometry.getPoint(from);
      const p2 = geometry.getPoint(to);
      if (p1 && p2) {
        const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(lineGeom, whiskerMaterial);
        line.name = `Whisker_${from}_${to}`;
        group.add(line);
      }
    });
  }
  

  
  /**
   * Crée un mesh wireframe simple (utilisé pour les lignes de vol)
   */
  private createWireframeMesh(geometry: GeometryComponent, visual: VisualComponent): THREE.Object3D {
    const group = new THREE.Group();
    
    // Ajouter les connexions comme tubes cylindriques (plus visibles que LineBasicMaterial)
    geometry.connections.forEach(conn => {
      const p1 = geometry.getPoint(conn.from);
      const p2 = geometry.getPoint(conn.to);
      
      if (p1 && p2) {
        // Créer un tube cylindrique entre les deux points
        const direction = new THREE.Vector3().subVectors(p2, p1);
        const length = direction.length();
        
        // Protection contre longueurs invalides
        if (!Number.isFinite(length) || length < 0.001) {
          console.warn(`⚠️ [GeometryRenderSystem] Invalid line length: ${length}, skipping`);
          return;
        }
        
        // Géométrie cylindrique
        const tubeGeometry = new THREE.CylinderGeometry(0.003, 0.003, length, 8); // 6mm de diamètre
        const tubeMaterial = new THREE.MeshStandardMaterial({
          color: visual.color,
          roughness: 0.8,
          metalness: 0.1
        });
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        
        // Positionner au centre
        const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        tube.position.copy(center);
        
        // Orienter le cylindre vers p2
        tube.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0), // Axe Y (direction par défaut du cylindre)
          direction.normalize()
        );
        
        tube.name = `Line_${conn.from}_${conn.to}`;
        group.add(tube);
      }
    });
    
    return group;
  }
}
