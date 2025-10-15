// Classe de base pour les systèmes dans l'architecture ECS
import { Entity } from './Entity';

export abstract class BaseSystem {
  constructor(public readonly name: string, public readonly priority: number) {}

  // Méthode pour initialiser le système
  initialize?(): void {}

  // Méthode pour nettoyer le système
  cleanup?(): void {}

  // Méthode abstraite pour mettre à jour les entités
  abstract update(entities: Entity[], deltaTime: number): void;
}