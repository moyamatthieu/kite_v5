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
import { GeometryComponent } from '@components/GeometryComponent';
import { VisualComponent } from '@components/VisualComponent';
import { BridleComponent, type BridleTensions } from '@components/BridleComponent';
import { MeshComponent } from '@components/MeshComponent';
import { TransformComponent } from '@components/TransformComponent';
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
    super('GeometryRenderSystem', 90); // Ordre 90 - après KitePhysicsSystem (60), avant LinesRenderSystem (95)
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
    // TODO: Adapter le rendu des brides pour utiliser les entités CTRL libres
    // TEMPORAIREMENT DÉSACTIVÉ car utilise anciennes positions CTRL depuis GeometryComponent
    // Ce qui crée un décalage visuel avec les lignes qui utilisent les entités CTRL
    
    /* DÉSACTIVÉ - à réimplémenter avec entités CTRL
    const bridle = entity.getComponent<BridleComponent>('bridle');
    if (bridle) {
      const tensions = this.calculateBridleTensionsFromGeometry(entity);
      if (tensions) {
        bridle.tensions = tensions;
      }
      this.updateBridleGeometry(entity);
      this.updateBridleTensions(entity);
    }
    */
      // Correction : Utiliser la position dynamique du ControlPointComponent (CTRL_GAUCHE)
      const geometry = entity.getComponent<GeometryComponent>('geometry');
      const bridle = entity.getComponent<BridleComponent>('bridle');
      const controlPointLeftEntity = this.entityManager.getAllEntities().find(e => {
        const ctrl = e.getComponent<import('@components/ControlPointComponent').ControlPointComponent>('controlPoint');
        return ctrl && ctrl.config.side === 'left';
      });
      if (geometry && bridle && controlPointLeftEntity) {
        const ctrlLeft = controlPointLeftEntity.getComponent<import('@components/ControlPointComponent').ControlPointComponent>('controlPoint');
        if (ctrlLeft) {
          // Met à jour la bride gauche en utilisant la position dynamique du contrôle gauche
          // NEZ, INTER_GAUCHE, CENTRE -> CTRL_GAUCHE
          const nez = geometry.getPoint('NEZ');
          const interGauche = geometry.getPoint('INTER_GAUCHE');
          const centre = geometry.getPoint('CENTRE');
          const ctrlGauche = ctrlLeft.position;
          // Ici, on peut mettre à jour la visualisation des brides gauche
          // (ex: via un DebugRenderer ou MeshComponent)
          // ... code de rendu pour la bride NEZ-CTRL_GAUCHE ...
          // ... code de rendu pour la bride INTER_GAUCHE-CTRL_GAUCHE ...
          // ... code de rendu pour la bride CENTRE-CTRL_GAUCHE ...
          // (Utiliser ctrlGauche pour la position du contrôle gauche)
        }
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

    // Les brides sont maintenant gérées par ControlPointDebugRenderer

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
   * Met à jour la géométrie (si les points changent)
   */
  updateGeometry(entity: Entity): void {
    // Pour l'instant, on recrée tout
    // TODO: optimiser pour ne mettre à jour que ce qui a changé
    this.initializeEntity(entity);
  }
}
