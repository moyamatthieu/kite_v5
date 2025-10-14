/**
 * GeometryRenderSystem.ts - Système de rendu de géométrie ECS pur
 *
 * Responsabilité : Créer la géométrie Three.js depuis les composants ECS purs
 * - Lit GeometryComponent (points, connexions, surfaces)
 * - Lit VisualComponent (couleurs, matériaux)
 * - Crée/met à jour le MeshComponent avec la géométrie Three.js
 *
 * Architecture ECS pure : séparation totale données/rendu
 */

import * as THREE from 'three';
import { Entity } from '../Entity';
import { GeometryComponent } from '../components/GeometryComponent';
import { VisualComponent } from '../components/VisualComponent';
import { BridleComponent } from '../components/BridleComponent';
import { MeshComponent } from '../components/MeshComponent';
import { TransformComponent } from '../components/TransformComponent';

/**
 * Système qui construit la géométrie Three.js depuis les composants
 */
export class GeometryRenderSystem {
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Initialise le rendu d'une entité (crée la géométrie Three.js)
   */
  initializeEntity(entity: Entity): void {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    const visual = entity.getComponent<VisualComponent>('visual');

    if (!geometry || !visual) {
      console.warn('Entity nécessite GeometryComponent et VisualComponent');
      return;
    }

    // Créer le group Three.js principal
    const group = new THREE.Group();
    group.name = entity.id;

    // 1. Créer les frames (connexions)
    this.createFrames(group, geometry, visual);

    // 2. Créer les surfaces
    this.createSurfaces(group, geometry, visual);

    // 3. Créer les brides (si présent)
    const bridle = entity.getComponent<BridleComponent>('bridle');
    if (bridle) {
      this.createBridles(group, geometry, bridle, visual);
    }

    // 4. Créer les marqueurs de debug (si activé)
    if (visual.showDebugMarkers) {
      this.createDebugMarkers(group, geometry, visual);
    }

    // 5. Créer ou mettre à jour le MeshComponent
    let meshComp = entity.getComponent<MeshComponent>('mesh');
    if (meshComp) {
      // Remplacer l'ancien objet
      if (meshComp.object3D.parent) {
        meshComp.object3D.parent.remove(meshComp.object3D);
      }
      meshComp.object3D = group;
    } else {
      meshComp = new MeshComponent(group);
      entity.addComponent(meshComp);
    }

    // 6. Synchroniser position/rotation depuis Transform
    const transform = entity.getComponent<TransformComponent>('transform');
    if (transform) {
      meshComp.syncToObject3D({
        position: transform.position,
        quaternion: transform.quaternion,
        scale: transform.scale
      });
    }

    // 7. Ajouter à la scène
    this.scene.add(group);
  }

  /**
   * Crée les frames (cylindres entre connexions)
   */
  private createFrames(
    group: THREE.Group,
    geometry: GeometryComponent,
    visual: VisualComponent
  ): void {
    const mainFrameMaterial = new THREE.MeshStandardMaterial({
      color: visual.frameMaterial.color
    });

    geometry.connections.forEach(conn => {
      const p1 = geometry.getPoint(conn.from);
      const p2 = geometry.getPoint(conn.to);

      if (!p1 || !p2) return;

      // Déterminer si c'est un whisker ou un frame principal
      const isWhisker = conn.from.includes('WHISKER') || conn.to.includes('WHISKER');
      const material = isWhisker && visual.whiskerMaterial
        ? new THREE.MeshStandardMaterial({ color: visual.whiskerMaterial.color })
        : mainFrameMaterial;

      const diameter = isWhisker && visual.whiskerMaterial
        ? visual.whiskerMaterial.diameter
        : visual.frameMaterial.diameter;

      const cylinder = this.createCylinder(p1, p2, diameter, material);
      cylinder.name = `frame_${conn.from}_${conn.to}`;
      group.add(cylinder);
    });
  }

  /**
   * Crée un cylindre entre deux points
   */
  private createCylinder(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    diameter: number,
    material: THREE.Material
  ): THREE.Mesh {
    const distance = p1.distanceTo(p2);
    const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    const geometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, distance, 8);
    const cylinder = new THREE.Mesh(geometry, material);

    // Orienter le cylindre
    const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction
    );

    cylinder.position.copy(midpoint);
    cylinder.quaternion.copy(quaternion);

    return cylinder;
  }

  /**
   * Crée les surfaces
   */
  private createSurfaces(
    group: THREE.Group,
    geometry: GeometryComponent,
    visual: VisualComponent
  ): void {
    const material = new THREE.MeshStandardMaterial({
      color: visual.surfaceMaterial.color,
      transparent: visual.surfaceMaterial.transparent,
      opacity: visual.surfaceMaterial.opacity,
      side: visual.surfaceMaterial.doubleSided ? THREE.DoubleSide : THREE.FrontSide
    });

    geometry.surfaces.forEach((surface, index) => {
      const points: THREE.Vector3[] = [];

      for (const pointName of surface.points) {
        const point = geometry.getPoint(pointName);
        if (point) points.push(point);
      }

      if (points.length < 3) return;

      // Créer géométrie triangulaire
      const surfaceGeom = new THREE.BufferGeometry();
      const vertices: number[] = [];

      // Triangle (ou quad divisé en 2 triangles)
      if (points.length === 3) {
        vertices.push(
          points[0].x, points[0].y, points[0].z,
          points[1].x, points[1].y, points[1].z,
          points[2].x, points[2].y, points[2].z
        );
      } else if (points.length === 4) {
        // Premier triangle
        vertices.push(
          points[0].x, points[0].y, points[0].z,
          points[1].x, points[1].y, points[1].z,
          points[2].x, points[2].y, points[2].z
        );
        // Second triangle
        vertices.push(
          points[0].x, points[0].y, points[0].z,
          points[2].x, points[2].y, points[2].z,
          points[3].x, points[3].y, points[3].z
        );
      }

      surfaceGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      surfaceGeom.computeVertexNormals();

      const mesh = new THREE.Mesh(surfaceGeom, material);
      mesh.name = `surface_${index}`;
      group.add(mesh);
    });
  }

  /**
   * Crée les lignes de bridage
   */
  private createBridles(
    group: THREE.Group,
    geometry: GeometryComponent,
    bridle: BridleComponent,
    visual: VisualComponent
  ): void {
    if (!visual.bridleMaterial) return;

    const material = new THREE.LineBasicMaterial({
      color: visual.bridleMaterial.color,
      opacity: visual.bridleMaterial.opacity,
      transparent: true,
      linewidth: visual.bridleMaterial.linewidth
    });

    const bridleGroup = new THREE.Group();
    bridleGroup.name = 'bridles';

    bridle.connections.forEach(conn => {
      const p1 = geometry.getPoint(conn.from);
      const p2 = geometry.getPoint(conn.to);

      if (!p1 || !p2) return;

      const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(lineGeom, material);
      line.name = `bridle_${conn.from}_${conn.to}`;
      line.userData.connection = conn;

      bridleGroup.add(line);
    });

    group.add(bridleGroup);
  }

  /**
   * Crée les marqueurs de debug
   */
  private createDebugMarkers(
    group: THREE.Group,
    geometry: GeometryComponent,
    visual: VisualComponent
  ): void {
    visual.debugMarkerColors.forEach((color, pointName) => {
      const point = geometry.getPoint(pointName);
      if (!point) return;

      const markerGeom = new THREE.SphereGeometry(0.025, 8, 8);
      const markerMat = new THREE.MeshBasicMaterial({ color });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.copy(point);
      marker.name = `marker_${pointName}`;

      group.add(marker);
    });
  }

  /**
   * Met à jour la visualisation des brides selon leurs tensions
   */
  updateBridleTensions(entity: Entity): void {
    const meshComp = entity.getComponent<MeshComponent>('mesh');
    const bridle = entity.getComponent<BridleComponent>('bridle');

    if (!meshComp || !bridle) return;

    const bridleGroup = meshComp.object3D.getObjectByName('bridles') as THREE.Group;
    if (!bridleGroup) return;

    bridleGroup.children.forEach(child => {
      if (!(child instanceof THREE.Line)) return;

      const conn = child.userData.connection;
      if (!conn) return;

      // Récupérer la tension correspondante
      let tension = 0;
      if (conn.side === 'left') {
        if (conn.from === 'NEZ') tension = bridle.tensions.leftNez;
        else if (conn.from === 'INTER_GAUCHE') tension = bridle.tensions.leftInter;
        else if (conn.from === 'CENTRE') tension = bridle.tensions.leftCentre;
      } else {
        if (conn.from === 'NEZ') tension = bridle.tensions.rightNez;
        else if (conn.from === 'INTER_DROIT') tension = bridle.tensions.rightInter;
        else if (conn.from === 'CENTRE') tension = bridle.tensions.rightCentre;
      }

      // Appliquer couleur selon tension
      const material = child.material as THREE.LineBasicMaterial;
      if (tension < 50) {
        material.color.setHex(0x00ff00); // Vert
        material.opacity = 0.5;
      } else if (tension < 150) {
        const t = (tension - 50) / 100;
        const r = Math.floor(t * 255);
        material.color.setRGB(r / 255, 1, 0); // Vert -> Jaune
        material.opacity = 0.6 + t * 0.2;
      } else {
        const t = Math.min((tension - 150) / 100, 1);
        const g = Math.floor((1 - t) * 255);
        material.color.setRGB(1, g / 255, 0); // Jaune -> Rouge
        material.opacity = 0.8 + t * 0.2;
      }
    });
  }

  /**
   * Met à jour la géométrie (si les points changent)
   */
  updateGeometry(entity: Entity): void {
    // Pour l'instant, on recrée tout
    // TODO: optimiser pour ne mettre à jour que ce qui a changé
    this.initializeEntity(entity);
  }
}
