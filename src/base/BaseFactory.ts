/**
 * BaseFactory.ts - Factory abstraite pour tous les objets 3D
 * 
 * Pattern Factory Method avec support des paramètres configurables
 */

import { StructuredObject } from '../core/StructuredObject';
import { ICreatable } from '../types/index';

export type FactoryParams = Record<string, unknown>;

export interface ObjectMetadata {
  category: string;
  name: string;
  description: string;
  tags: string[];
  complexity: 'simple' | 'medium' | 'complex';
}

/**
 * Factory abstraite pour la création d'objets 3D
 */
export abstract class BaseFactory<T extends StructuredObject & ICreatable> {
  protected abstract metadata: ObjectMetadata;

  /**
   * Créer un objet avec des paramètres optionnels
   */
  abstract createObject(params?: FactoryParams): T | Promise<T>;

  /**
   * Obtenir les métadonnées de l'objet
   */
  getMetadata(): ObjectMetadata {
    return { ...this.metadata };
  }

  /**
   * Obtenir la catégorie de l'objet
   */
  getCategory(): string {
    return this.metadata.category;
  }

  /**
   * Obtenir le nom de l'objet
   */
  getName(): string {
    return this.metadata.name;
  }

  /**
   * Valider les paramètres avant création
   */
  protected validateParams(params?: FactoryParams): void {
    // Validation de base - à surcharger dans les classes dérivées
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          throw new Error(`Paramètre '${key}' ne peut pas être null ou undefined`);
        }
      });
    }
  }

  /**
   * Paramètres par défaut - à surcharger dans les classes dérivées
   */
  protected getDefaultParams(): FactoryParams {
    return {};
  }

  /**
   * Fusionner les paramètres par défaut avec les paramètres fournis
   */
  protected mergeParams(params?: FactoryParams): FactoryParams {
    return {
      ...this.getDefaultParams(),
      ...params
    };
  }

  /**
   * Nettoyer les ressources de la factory
   */
  dispose(): void {
    // À surcharger dans les classes dérivées si nécessaire
  }
}
