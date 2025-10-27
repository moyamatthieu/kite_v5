/**
 * LineRenderSystem.ts - Met à jour les positions des lignes de vol
 * 
 * Ce système connecte visuellement :
 * - leftLine : poignet_gauche de la barre -> CTRL_GAUCHE du kite
 * - rightLine : poignet_droit de la barre -> CTRL_DROIT du kite
 * 
 * Priorité 55 (AVANT GeometryRenderSystem 60 pour que les positions soient correctes)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { Entity } from '../core/Entity';
import { GeometryComponent } from '../components/GeometryComponent';
import { TransformComponent } from '../components/TransformComponent';

/**
 * Paramètres pour la mise à jour d'une ligne
 */
interface LineUpdateParams {
  lineEntity: Entity;
  startGeometry: GeometryComponent;
  startTransform: TransformComponent;
  startPointName: string;
  endGeometry: GeometryComponent;
  endTransform: TransformComponent;
  endPointName: string;
}

export class LineRenderSystem extends System {
  constructor() {
    super('LineRenderSystem', 55); // AVANT GeometryRenderSystem (60)
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;
    
   
    
    // Récupérer la barre de contrôle
    const controlBar = entityManager.getEntity('controlBar');
    if (!controlBar) return;
    
    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    const barTransform = controlBar.getComponent<TransformComponent>('transform');
    if (!barGeometry || !barTransform) return;
    
    // Récupérer le kite
    const kite = entityManager.getEntity('kite');
    if (!kite) return;
    
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');
    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    if (!kiteGeometry || !kiteTransform) return;
    
    // === LIGNE GAUCHE ===
    const leftLine = entityManager.getEntity('leftLine');
    if (leftLine) {
      this.updateLine({
        lineEntity: leftLine,
        startGeometry: barGeometry,
        startTransform: barTransform,
        startPointName: 'poignet_gauche',
        endGeometry: kiteGeometry,
        endTransform: kiteTransform,
        endPointName: 'CTRL_GAUCHE'
      });
    }
    
    // === LIGNE DROITE ===
    const rightLine = entityManager.getEntity('rightLine');
    if (rightLine) {
      this.updateLine({
        lineEntity: rightLine,
        startGeometry: barGeometry,
        startTransform: barTransform,
        startPointName: 'poignet_droit',
        endGeometry: kiteGeometry,
        endTransform: kiteTransform,
        endPointName: 'CTRL_DROIT'
      });
    }
    
  
  }
  
  /**
   * Met à jour une ligne entre deux points
   * Les points sont stockés en coordonnées monde absolues
   * (le TransformComponent de la ligne reste à 0,0,0)
   */
  private updateLine(params: LineUpdateParams): void {
    const {
      lineEntity,
      startGeometry,
      startTransform,
      startPointName,
      endGeometry,
      endTransform,
      endPointName
    } = params;

    const lineGeometry = lineEntity.getComponent('geometry') as GeometryComponent | undefined;
    if (!lineGeometry) return;
    
    // Point de départ (poignet de la barre) en coordonnées locales
    const startLocal = startGeometry.getPoint(startPointName);
    if (!startLocal) return;
    
    // Point d'arrivée (CTRL du kite) en coordonnées locales
    const endLocal = endGeometry.getPoint(endPointName);
    if (!endLocal) return;
    
    // Convertir en coordonnées monde avec transformation complète
    const startMatrix = new THREE.Matrix4();
    startMatrix.compose(startTransform.position, startTransform.quaternion, startTransform.scale);
    const startWorld = startLocal.clone().applyMatrix4(startMatrix);
    
    const endMatrix = new THREE.Matrix4();
    endMatrix.compose(endTransform.position, endTransform.quaternion, endTransform.scale);
    const endWorld = endLocal.clone().applyMatrix4(endMatrix);
    
    // Debug NaN
    if (isNaN(startWorld.x) || isNaN(endWorld.x)) {
      console.error('NaN detected in LineRenderSystem:');
      console.error('  startLocal:', startLocal);
      console.error('  endLocal:', endLocal);
      console.error('  startTransform:', startTransform.position, startTransform.quaternion);
      console.error('  endTransform:', endTransform.position, endTransform.quaternion);
      console.error('  startWorld:', startWorld);
      console.error('  endWorld:', endWorld);
      return; // Ne pas mettre à jour avec des NaN
    }
    
    // Les points sont stockés en coordonnées monde
    // car le TransformComponent de la ligne est à (0,0,0)
    lineGeometry.setPoint('start', startWorld);
    lineGeometry.setPoint('end', endWorld);
    
    // Les propriétés physiques (longueur, tension) sont mises à jour par ConstraintSystem
  }
}
