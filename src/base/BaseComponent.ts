/**
 * BaseComponent.ts - Système de composants pour les objets 3D
 *
 * Pattern : Component Pattern (similaire à Unity/ECS)
 * Permet d'ajouter des fonctionnalités optionnelles aux Node3D
 * sans hériter de classes lourdes.
 */

import { Node3D } from '../core/Node3D';

export interface ComponentContext {
  deltaTime: number;
  totalTime: number;
  parent: Node3D;
}

export abstract class BaseComponent {
  protected name: string;
  protected enabled: boolean = true;
  protected parent?: Node3D;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Attache le composant à un parent
   */
  attachTo(parent: Node3D): void {
    this.parent = parent;
    this.onAttach();
  }

  /**
   * Détache le composant de son parent
   */
  detach(): void {
    this.onDetach();
    this.parent = undefined;
  }

  /**
   * Appelé quand le composant est attaché
   */
  protected onAttach(): void {
    // Override dans les sous-classes
  }

  /**
   * Appelé quand le composant est détaché
   */
  protected onDetach(): void {
    // Override dans les sous-classes
  }

  /**
   * Met à jour le composant
   */
  abstract update(context: ComponentContext): void;

  /**
   * Active/désactive le composant
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getName(): string {
    return this.name;
  }

  getParent(): Node3D | undefined {
    return this.parent;
  }
}

/**
 * Composant de debug visuel
 */
export class DebugComponent extends BaseComponent {
  update(context: ComponentContext): void {
    // Logique de debug visuel
  }
}

/**
 * Composant de physique
 */
export class PhysicsComponent extends BaseComponent {
  update(context: ComponentContext): void {
    // Logique de physique
  }
}