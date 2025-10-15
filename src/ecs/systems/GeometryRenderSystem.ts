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
import { Entity } from '@base/Entity';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { EntityManager } from '@entities/EntityManager';

import { GeometryComponent } from '../components/GeometryComponent';
import { VisualComponent } from '../components/VisualComponent';
import { BridleComponent, type BridleTensions } from '../components/BridleComponent';
import { MeshComponent } from '../components/MeshComponent';
import { TransformComponent } from '../components/TransformComponent';
import { Logger } from '@utils/Logging';

import { RenderSystem } from './RenderSystem';

/**
 * Système qui construit la géométrie Three.js depuis les composants
 */
export class GeometryRenderSystem extends BaseSimulationSystem {
  private entityManager: EntityManager;
  private renderSystem: RenderSystem;
  private logger = Logger.getInstance();
  private initializedEntities = new Set<string>();

  constructor(entityManager: EntityManager, renderSystem: RenderSystem) {
    super('GeometryRenderSystem', 4); // Exécuté après la physique, avant le rendu
    this.entityManager = entityManager;
    this.renderSystem = renderSystem;
  }

  initialize(): Promise<void> {
    this.logger.info('GeometryRenderSystem initialized', 'GeometryRenderSystem');
    return Promise.resolve();
  }

  reset(): void {
    this.initializedEntities.clear();
  }

  dispose(): void {
    this.reset();
  }

  update(_context: SimulationContext): void {
    const entities = this.entityManager.getAllEntities();
    for (const entity of entities) {
      if (!this.initializedEntities.has(entity.id)) {
        this.initializeEntity(entity);
      } else {
        // Mettre à jour les entités déjà initialisées
        this.updateEntity(entity);
      }
    }
  }

  /**
   * Met à jour une entité existante (géométrie dynamique)
   */
  private updateEntity(entity: Entity): void {
    const bridle = entity.getComponent<BridleComponent>('bridle');
    
    // Mettre à jour les brides (positions et tensions)
    if (bridle) {
      // D'abord calculer et stocker les tensions dans le BridleComponent
      const tensions = this.calculateBridleTensionsFromGeometry(entity);
      if (tensions) {
        bridle.tensions = tensions;
      }
      
      // Puis mettre à jour la géométrie et les couleurs
      this.updateBridleGeometry(entity);
      this.updateBridleTensions(entity);
    }
  }

  /**
   * Calcule les tensions des brides à partir de la géométrie
   */
  private calculateBridleTensionsFromGeometry(entity: Entity): BridleTensions | null {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    const transform = entity.getComponent<TransformComponent>('transform');
    const bridle = entity.getComponent<BridleComponent>('bridle');

    if (!geometry || !transform || !bridle) return null;

    // Helper : convertir point local en coordonnées monde
    const toWorldCoordinates = (localPoint: THREE.Vector3): THREE.Vector3 => {
      return localPoint.clone()
        .applyQuaternion(transform.quaternion)
        .add(transform.position);
    };

    // Calculer tension pour une bride
    const calculateTension = (startName: string, endName: string, targetLength: number): number => {
      const startLocal = geometry.getPoint(startName);
      const endLocal = geometry.getPoint(endName);

      if (!startLocal || !endLocal) return 0;

      const startWorld = toWorldCoordinates(startLocal);
      const endWorld = toWorldCoordinates(endLocal);
      const currentLength = startWorld.distanceTo(endWorld);

      // Tension proportionnelle à l'élongation
      const strain = (currentLength - targetLength) / targetLength;
      return Math.max(0, strain * 100); // Facteur pour visualisation
    };

    return {
      leftNez: calculateTension('NEZ', 'CTRL_GAUCHE', bridle.lengths.nez),
      leftInter: calculateTension('INTER_GAUCHE', 'CTRL_GAUCHE', bridle.lengths.inter),
      leftCentre: calculateTension('CENTRE', 'CTRL_GAUCHE', bridle.lengths.centre),
      rightNez: calculateTension('NEZ', 'CTRL_DROIT', bridle.lengths.nez),
      rightInter: calculateTension('INTER_DROIT', 'CTRL_DROIT', bridle.lengths.inter),
      rightCentre: calculateTension('CENTRE', 'CTRL_DROIT', bridle.lengths.centre)
    };
  }

  /**
   * Initialise le rendu d'une entité (crée la géométrie Three.js)
   */
  initializeEntity(entity: Entity): void {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    const visual = entity.getComponent<VisualComponent>('visual');

    if (!geometry || !visual) {
      return;
    }

    // Ignorer les entités de lignes - elles sont gérées par LinesRenderSystem
    if (entity.id.includes('Line')) {
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

    // Ajouter le groupe à un MeshComponent
    entity.addComponent(new MeshComponent(group));

    // Ajouter l'objet à la scène
    this.renderSystem.addToScene(group);

    // Marquer comme initialisé
    this.initializedEntities.add(entity.id);
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

      // Déterminer si c'est un whisker/handle vertical (poignée) ou un frame principal
      // Les poignées sont détectées par la présence de _TOP et _BOTTOM dans le même lien
      const isWhiskerOrHandle = 
        conn.from.includes('WHISKER') || conn.to.includes('WHISKER') ||
        (conn.from.includes('_TOP') && conn.to.includes('_BOTTOM')) ||
        (conn.from.includes('_BOTTOM') && conn.to.includes('_TOP'));
        
      const material = isWhiskerOrHandle && visual.whiskerMaterial
        ? new THREE.MeshStandardMaterial({ color: visual.whiskerMaterial.color })
        : mainFrameMaterial;

      const diameter = isWhiskerOrHandle && visual.whiskerMaterial
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
   * Met à jour la géométrie des brides (positions)
   */
  private updateBridleGeometry(entity: Entity): void {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    const meshComp = entity.getComponent<MeshComponent>('mesh');
    const bridle = entity.getComponent<BridleComponent>('bridle');

    if (!geometry || !meshComp || !bridle) return;

    const bridleGroup = meshComp.object3D.getObjectByName('bridles') as THREE.Group;
    if (!bridleGroup) return;

    // Mettre à jour la position de chaque ligne de bride
    bridleGroup.children.forEach(child => {
      if (!(child instanceof THREE.Line)) return;

      const conn = child.userData.connection;
      if (!conn) return;

      const p1 = geometry.getPoint(conn.from);
      const p2 = geometry.getPoint(conn.to);

      if (!p1 || !p2) return;

      // Mettre à jour la géométrie de la ligne
      const positions = new Float32Array([
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z
      ]);
      child.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      child.geometry.attributes.position.needsUpdate = true;
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
