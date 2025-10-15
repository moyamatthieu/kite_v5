/**
 * LineDynamicsSystem.ts - Système ECS pur pour mettre à jour la géométrie des lignes
 * 
 * Positionne dynamiquement les lignes entre le kite et la barre de contrôle.
 * Architecture 100% ECS : travaille uniquement avec des composants.
 */

import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import type { EntityManager } from '@entities/EntityManager';
import { GeometryComponent } from '@components/GeometryComponent';
import { TransformComponent } from '@components/TransformComponent';
import { KiteComponent } from '@components/KiteComponent';
import type { Entity } from '@base/Entity';
import * as THREE from 'three';

/**
 * Système qui met à jour les endpoints des lignes chaque frame
 */
export class LineDynamicsSystem extends BaseSimulationSystem {
  private entityManager: EntityManager;

  constructor(entityManager: EntityManager) {
    super('LineDynamicsSystem');
    this.entityManager = entityManager;
  }

  initialize(): void {
    // Rien à initialiser
  }

  reset(): void {
    // Rien à réinitialiser
  }

  dispose(): void {
    // Rien à nettoyer
  }

  /**
   * Met à jour les positions des lignes chaque frame
   */
  update(_context: SimulationContext): void {
    // Récupérer les entités nécessaires
    const kiteEntity = this.entityManager.getEntity('kite');
    const controlBarEntity = this.entityManager.getEntity('controlBar');
    const leftLineEntity = this.entityManager.getEntity('leftLine');
    const rightLineEntity = this.entityManager.getEntity('rightLine');

    if (!kiteEntity || !controlBarEntity || !leftLineEntity || !rightLineEntity) {
      return; // Pas toutes les entités présentes
    }

    // Récupérer les composants du kite
    const kiteTransform = kiteEntity.getComponent<TransformComponent>('transform');
    const kiteGeometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const kiteComponent = kiteEntity.getComponent<KiteComponent>('kite');

    // Récupérer le transform de la barre de contrôle
    const controlBarTransform = controlBarEntity.getComponent<TransformComponent>('transform');
    const controlBarGeometry = controlBarEntity.getComponent<GeometryComponent>('geometry');

    if (!kiteTransform || !kiteGeometry || !controlBarTransform || !controlBarGeometry || !kiteComponent) {
      return;
    }

    // Calculer les positions absolues des points d'attache du kite
    const kiteLeftAttach = this.getWorldPosition(kiteTransform, kiteGeometry, 'CTRL_GAUCHE');
    const kiteRightAttach = this.getWorldPosition(kiteTransform, kiteGeometry, 'CTRL_DROIT');

    // Calculer les positions absolues des poignées de la barre
    const barLeftHandle = this.getWorldPosition(controlBarTransform, controlBarGeometry, 'LEFT_HANDLE');
    const barRightHandle = this.getWorldPosition(controlBarTransform, controlBarGeometry, 'RIGHT_HANDLE');

    if (!kiteLeftAttach || !kiteRightAttach || !barLeftHandle || !barRightHandle) {
      console.warn('⚠️ LineDynamicsSystem: points d\'attache manquants');
      return;
    }

    // Mettre à jour la géométrie de la ligne gauche
    this.updateLineGeometry(leftLineEntity, kiteLeftAttach, barLeftHandle);

    // Mettre à jour la géométrie de la ligne droite
    this.updateLineGeometry(rightLineEntity, kiteRightAttach, barRightHandle);
  }

  /**
   * Calcule la position mondiale d'un point depuis geometry + transform
   */
  private getWorldPosition(
    transform: TransformComponent,
    geometry: GeometryComponent,
    pointName: string
  ): THREE.Vector3 | null {
    const localPos = geometry.getPoint(pointName);
    if (!localPos) {
      return null;
    }

    // Appliquer la transformation (position + rotation)
    const worldPos = localPos.clone();
    
    // TransformComponent.rotation est un nombre (angle), pas un Quaternion
    // Pour l'instant, on ignore la rotation (à implémenter si nécessaire)
    worldPos.add(transform.position);

    return worldPos;
  }

  /**
   * Met à jour la géométrie d'une ligne entre deux points
   */
  private updateLineGeometry(lineEntity: Entity, start: THREE.Vector3, end: THREE.Vector3): void {
    const geometry = lineEntity.getComponent<GeometryComponent>('geometry');
    const transform = lineEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) {
      return;
    }

    // Mettre à jour les points de la géométrie
    // On garde tout en world space pour simplifier
    transform.position.set(0, 0, 0); // Pas de transform global
    geometry.setPoint('start', start);
    geometry.setPoint('end', end);
  }
}
