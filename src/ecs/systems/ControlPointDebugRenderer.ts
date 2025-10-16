/**
 * ControlPointDebugRenderer.ts - Rendu debug des points de contrôle
 * 
 * Affiche des sphères de debug pour visualiser:
 * - Les handles (poignées de barre)
 * - Les points CTRL (où les lignes se connectent au kite)
 * - Les brides (lignes reliant kite aux CTRL)
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { Entity } from '@base/Entity';
import { TransformComponent } from '@components/TransformComponent';
import { GeometryComponent } from '@components/GeometryComponent';
import { BridleComponent } from '@components/BridleComponent';
import { Logger } from '@utils/Logging';

export class ControlPointDebugRenderer extends BaseSimulationSystem {
  private scene: THREE.Scene | null = null;
  private handleSpheres: { left: THREE.Mesh | null; right: THREE.Mesh | null } = { left: null, right: null };
  private ctrlSpheres: { left: THREE.Mesh | null; right: THREE.Mesh | null } = { left: null, right: null };
  private bridleLines: THREE.LineSegments | null = null;
  
  private ctrlLeftEntity: Entity | null = null;
  private ctrlRightEntity: Entity | null = null;
  private kiteEntity: Entity | null = null;
  private handlePositionsProvider: (() => { left: THREE.Vector3; right: THREE.Vector3 } | null) | null = null;
  
  private logger = Logger.getInstance();
  private debugEnabled = true;

  constructor() {
    super('ControlPointDebugRenderer', 96); // Après LinesRenderSystem
  }

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
    this.createDebugObjects();
  }

  setControlPointEntities(ctrlLeft: Entity, ctrlRight: Entity): void {
    this.ctrlLeftEntity = ctrlLeft;
    this.ctrlRightEntity = ctrlRight;
  }

  setKiteEntity(kite: Entity): void {
    this.kiteEntity = kite;
  }

  setHandlePositionsProvider(provider: () => { left: THREE.Vector3; right: THREE.Vector3 } | null): void {
    this.handlePositionsProvider = provider;
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    if (this.handleSpheres.left) this.handleSpheres.left.visible = enabled;
    if (this.handleSpheres.right) this.handleSpheres.right.visible = enabled;
    if (this.ctrlSpheres.left) this.ctrlSpheres.left.visible = enabled;
    if (this.ctrlSpheres.right) this.ctrlSpheres.right.visible = enabled;
    if (this.bridleLines) this.bridleLines.visible = enabled;
  }

  private createDebugObjects(): void {
    if (!this.scene) return;

    // Sphères pour les handles (magenta)
    const handleGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const handleMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.8 });
    
    this.handleSpheres.left = new THREE.Mesh(handleGeometry, handleMaterial);
    this.handleSpheres.right = new THREE.Mesh(handleGeometry, handleMaterial.clone());
    
    this.scene.add(this.handleSpheres.left);
    this.scene.add(this.handleSpheres.right);

    // Sphères pour les points CTRL (jaune)
    const ctrlGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const ctrlMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.9 });
    
    this.ctrlSpheres.left = new THREE.Mesh(ctrlGeometry, ctrlMaterial);
    this.ctrlSpheres.right = new THREE.Mesh(ctrlGeometry, ctrlMaterial.clone());
    
    this.scene.add(this.ctrlSpheres.left);
    this.scene.add(this.ctrlSpheres.right);

    this.logger.info('Control point debug renderer created', 'ControlPointDebugRenderer');
  }

  initialize(): void {
    this.logger.info('ControlPointDebugRenderer initialized', 'ControlPointDebugRenderer');
  }

  update(context: SimulationContext): void {
    if (!this.debugEnabled || !this.scene) return;

    // Mettre à jour positions des handles
    const handles = this.handlePositionsProvider?.();
    if (handles && this.handleSpheres.left && this.handleSpheres.right) {
      this.handleSpheres.left.position.copy(handles.left);
      this.handleSpheres.right.position.copy(handles.right);
    }

    // Mettre à jour positions des CTRL
    if (this.ctrlLeftEntity && this.ctrlSpheres.left) {
      const ctrlLeftTransform = this.ctrlLeftEntity.getComponent<TransformComponent>('transform');
      if (ctrlLeftTransform) {
        this.ctrlSpheres.left.position.copy(ctrlLeftTransform.position);
      }
    }

    if (this.ctrlRightEntity && this.ctrlSpheres.right) {
      const ctrlRightTransform = this.ctrlRightEntity.getComponent<TransformComponent>('transform');
      if (ctrlRightTransform) {
        this.ctrlSpheres.right.position.copy(ctrlRightTransform.position);
      }
    }

    // Mettre à jour les brides
    this.updateBridleLines();
  }

  private updateBridleLines(): void {
    if (!this.kiteEntity || !this.ctrlLeftEntity || !this.ctrlRightEntity) return;

    const geometry = this.kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');
    const bridle = this.kiteEntity.getComponent<BridleComponent>('bridle');

    if (!geometry || !transform || !bridle) return;

    const ctrlLeftTransform = this.ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = this.ctrlRightEntity.getComponent<TransformComponent>('transform');

    if (!ctrlLeftTransform || !ctrlRightTransform) return;

    // Points d'attache sur le kite (monde)
    const toWorld = (localPos: THREE.Vector3) => 
      localPos.clone().applyQuaternion(transform.quaternion).add(transform.position);

    const nezWorld = toWorld(geometry.getPoint('NEZ')!);
    const interLeftWorld = toWorld(geometry.getPoint('INTER_GAUCHE')!);
    const interRightWorld = toWorld(geometry.getPoint('INTER_DROIT')!);
    const centreWorld = toWorld(geometry.getPoint('CENTRE')!);

    // Positions CTRL
    const ctrlLeftWorld = ctrlLeftTransform.position;
    const ctrlRightWorld = ctrlRightTransform.position;

    // Créer géométrie des brides
    const points: THREE.Vector3[] = [
      // Brides gauches
      nezWorld, ctrlLeftWorld,
      interLeftWorld, ctrlLeftWorld,
      centreWorld, ctrlLeftWorld,
      // Brides droites
      nezWorld, ctrlRightWorld,
      interRightWorld, ctrlRightWorld,
      centreWorld, ctrlRightWorld,
    ];

    const bridleGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const bridleMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.6 });

    // Supprimer anciennes lignes
    if (this.bridleLines) {
      this.scene!.remove(this.bridleLines);
      this.bridleLines.geometry.dispose();
    }

    // Ajouter nouvelles lignes
    this.bridleLines = new THREE.LineSegments(bridleGeometry, bridleMaterial);
    this.scene!.add(this.bridleLines);
  }

  reset(): void {
    this.debugEnabled = true;
  }

  dispose(): void {
    if (!this.scene) return;

    if (this.handleSpheres.left) this.scene.remove(this.handleSpheres.left);
    if (this.handleSpheres.right) this.scene.remove(this.handleSpheres.right);
    if (this.ctrlSpheres.left) this.scene.remove(this.ctrlSpheres.left);
    if (this.ctrlSpheres.right) this.scene.remove(this.ctrlSpheres.right);
    if (this.bridleLines) this.scene.remove(this.bridleLines);

    this.logger.info('ControlPointDebugRenderer disposed', 'ControlPointDebugRenderer');
  }
}
