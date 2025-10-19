/**
 * BridleRenderSystem.ts - Rend les brides de manière dynamique
 *
 * Crée et met à jour dynamiquement les lignes visuelles des brides
 * basées sur les longueurs des brides et les positions actuelles du kite.
 *
 * Les brides sont des entités distinctes avec GeometryComponent.
 * Leurs positions sont mises à jour à chaque frame en coordonnées MONDE.
 *
 * Priorité 56 (APRÈS LineRenderSystem 55, AVANT GeometryRenderSystem 60)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { GeometryComponent } from '../components/GeometryComponent';
import { BridleComponent } from '../components/BridleComponent';
import { TransformComponent } from '../components/TransformComponent';

const PRIORITY = 56; // APRÈS LineRenderSystem, AVANT GeometryRenderSystem

/**
 * Gère l'affichage dynamique des brides
 * 
 * Les brides relient les points anatomiques du kite aux points de contrôle.
 * Longueurs configurées en bridles.nez, bridles.inter, bridles.centre.
 * 
 * Les positions sont converties de LOCAL en MONDE pour être indépendantes
 * des transformations du kite.
 */
export class BridleRenderSystem extends System {
  constructor() {
    super('BridleRenderSystem', PRIORITY);
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    const kite = entityManager.getEntity('kite');
    if (!kite) return;

    const geometry = kite.getComponent<GeometryComponent>('geometry');
    const bridle = kite.getComponent<BridleComponent>('bridle');
    const transform = kite.getComponent<TransformComponent>('transform');

    if (!geometry || !bridle || !transform) {
      return;
    }

    // Mettre à jour les brides
    this.updateBridles(entityManager, geometry, bridle, transform);
  }

  /**
   * Met à jour les lignes visuelles des brides
   */
  private updateBridles(
    entityManager: EntityManager,
    geometry: GeometryComponent,
    bridle: BridleComponent,
    transform: TransformComponent
  ): void {
    // Définition des 6 brides avec leurs points
    const bridleConnections = [
      { id: 'bridle-ctrl-gauche-nez', from: 'CTRL_GAUCHE', to: 'NEZ' },
      { id: 'bridle-ctrl-gauche-inter', from: 'CTRL_GAUCHE', to: 'INTER_GAUCHE' },
      { id: 'bridle-ctrl-gauche-centre', from: 'CTRL_GAUCHE', to: 'CENTRE' },
      { id: 'bridle-ctrl-droit-nez', from: 'CTRL_DROIT', to: 'NEZ' },
      { id: 'bridle-ctrl-droit-inter', from: 'CTRL_DROIT', to: 'INTER_DROIT' },
      { id: 'bridle-ctrl-droit-centre', from: 'CTRL_DROIT', to: 'CENTRE' }
    ];

    // Matrice de transformation LOCAL → MONDE
    const transformMatrix = new THREE.Matrix4();
    transformMatrix.compose(transform.position, transform.quaternion, transform.scale);

    bridleConnections.forEach(conn => {
      const bridleEntity = entityManager.getEntity(conn.id);
      if (!bridleEntity) return;

      const bridleGeometry = bridleEntity.getComponent<GeometryComponent>('geometry');
      if (!bridleGeometry) return;

      const p1Local = geometry.getPoint(conn.from);
      const p2Local = geometry.getPoint(conn.to);

      if (p1Local && p2Local) {
        // Convertir les positions locales en positions MONDE
        const p1World = p1Local.clone().applyMatrix4(transformMatrix);
        const p2World = p2Local.clone().applyMatrix4(transformMatrix);

        // Mettre à jour les points de la bridle
        bridleGeometry.setPoint('start', p1World);
        bridleGeometry.setPoint('end', p2World);
      }
    });
  }
}
