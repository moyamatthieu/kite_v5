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
import { CONFIG } from '@config/SimulationConfig';

export class ControlPointDebugRenderer extends BaseSimulationSystem {
  private scene: THREE.Scene | null = null;
  private handleSpheres: { left: THREE.Mesh | null; right: THREE.Mesh | null } = { left: null, right: null };
  private ctrlSpheres: { left: THREE.Mesh | null; right: THREE.Mesh | null } = { left: null, right: null };
  private bridleLines: THREE.LineSegments | null = null;
  
  // Auto-queried entities (résolution dans initialize())
  private kiteEntity: Entity | null = null;
  private controlBarEntity: Entity | null = null;
  
  private logger = Logger.getInstance();
  private debugEnabled = true;

  constructor() {
    super('ControlPointDebugRenderer', 96); // Après LinesRenderSystem
  }

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
    this.createDebugObjects();
  }

  /** @deprecated Auto-queried in initialize() - kept for compatibility */
  setKiteEntity(kite: Entity): void {
    // No-op, déjà géré par initialize()
  }

  /** @deprecated Auto-computed in update() - kept for compatibility */
  setHandlePositionsProvider(provider: () => { left: THREE.Vector3; right: THREE.Vector3 } | null): void {
    // No-op, calcul direct maintenant
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
    // Auto-query deprecated - configuration via SystemConfigurator/SimulationApp
    this.logger.info('ControlPointDebugRenderer initialized', 'ControlPointDebugRenderer');
  }

  update(context: SimulationContext): void {
    if (!this.debugEnabled || !this.scene) {
      return;
    }

    // Mettre à jour positions des handles (calculées depuis controlBar transform)
    if (this.controlBarEntity && this.handleSpheres.left && this.handleSpheres.right) {
      const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
      if (transform) {
        // Calculer positions handles (comme dans ControlBarSystem.getHandlePositions)
        const halfWidth = CONFIG.controlBar.width / 2;
        const handleLeftLocal = new THREE.Vector3(-halfWidth, 0, 0);
        const handleRightLocal = new THREE.Vector3(halfWidth, 0, 0);
        
        handleLeftLocal.applyQuaternion(transform.quaternion);
        handleRightLocal.applyQuaternion(transform.quaternion);
        handleLeftLocal.add(transform.position);
        handleRightLocal.add(transform.position);
        
        this.handleSpheres.left.position.copy(handleLeftLocal);
        this.handleSpheres.right.position.copy(handleRightLocal);
      }
    }

    // Mettre à jour positions des CTRL
    if (this.kiteEntity && this.ctrlSpheres.left && this.ctrlSpheres.right) {
      const geometry = this.kiteEntity.getComponent<GeometryComponent>('geometry');
      if (geometry) {
        const ctrlLeftWorld = geometry.getPointWorld('CTRL_GAUCHE', this.kiteEntity);
        const ctrlRightWorld = geometry.getPointWorld('CTRL_DROIT', this.kiteEntity);
        
        if (ctrlLeftWorld) {
          this.ctrlSpheres.left.position.copy(ctrlLeftWorld);
        }
        if (ctrlRightWorld) {
          this.ctrlSpheres.right.position.copy(ctrlRightWorld);
        }
      }
    }

    // Mettre à jour les brides
    this.updateBridleLines();
    this.logger.debug(`🎯 ControlPointDebugRenderer.update() completed`, 'ControlPointDebugRenderer');
  }

  private updateBridleLines(): void {
    if (!this.kiteEntity) return;

    const geometry = this.kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');
    const bridle = this.kiteEntity.getComponent<BridleComponent>('bridle');

    if (!geometry || !transform || !bridle) return;

    // Points d'attache sur le kite (monde)
    const toWorld = (localPos: THREE.Vector3) => 
      localPos.clone().applyQuaternion(transform.quaternion).add(transform.position);

    const nezWorld = toWorld(geometry.getPoint('NEZ')!);
    const interLeftWorld = toWorld(geometry.getPoint('INTER_GAUCHE')!);
    const interRightWorld = toWorld(geometry.getPoint('INTER_DROIT')!);
    const centreWorld = toWorld(geometry.getPoint('CENTRE')!);

    // Positions CTRL (via getPointWorld)
    const ctrlLeftWorld = geometry.getPointWorld('CTRL_GAUCHE', this.kiteEntity);
    const ctrlRightWorld = geometry.getPointWorld('CTRL_DROIT', this.kiteEntity);

    if (!ctrlLeftWorld || !ctrlRightWorld) return;

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
