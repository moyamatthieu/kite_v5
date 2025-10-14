/**
 * FactoryRegistry.ts - Registre centralisé des factories
 *
 * Permet la création dynamique d'objets depuis un nom ou un type
 * Pattern : Factory Registry + Plugin Architecture
 */

export interface FactoryMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  supportedTypes: string[];
  dependencies: string[];
}

export interface BaseFactory {
  createObject(type: string, config: any): any;
  getSupportedTypes(): string[];
  getMetadata(): FactoryMetadata;
  dispose(): void;
}

type FactoryConstructor = new () => BaseFactory;

export interface FactoryParams {
  [key: string]: any;
}

export class FactoryRegistry {
  private static factories = new Map<string, FactoryConstructor>();
  private static instances = new Map<string, BaseFactory>();

  /**
   * Enregistre une factory dans le registre
   */
  static register(name: string, factoryClass: FactoryConstructor): void {
    if (this.factories.has(name)) {
      console.warn(`Factory "${name}" is already registered. Overwriting.`);
    }
    this.factories.set(name, factoryClass);
  }

  /**
   * Désenregistre une factory
   */
  static unregister(name: string): void {
    if (this.factories.has(name)) {
      // Nettoyer l'instance si elle existe
      if (this.instances.has(name)) {
        const instance = this.instances.get(name)!;
        instance.dispose();
        this.instances.delete(name);
      }
      this.factories.delete(name);
    }
  }

  /**
   * Crée un objet en utilisant la factory enregistrée
   */
  static createObject(name: string, params?: FactoryParams): any {
    const factoryClass = this.factories.get(name);
    if (!factoryClass) {
      throw new Error(`Factory "${name}" not found. Available factories: ${Array.from(this.factories.keys()).join(', ')}`);
    }

    // Obtenir ou créer l'instance de factory
    let factory = this.instances.get(name);
    if (!factory) {
      factory = new factoryClass();
      this.instances.set(name, factory);
    }

    // Créer l'objet
    return factory.createObject('default', params);
  }

  /**
   * Vérifie si une factory est enregistrée
   */
  static hasFactory(name: string): boolean {
    return this.factories.has(name);
  }

  /**
   * Obtient la liste des factories enregistrées
   */
  static getRegisteredFactories(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Obtient les métadonnées d'une factory
   */
  static getFactoryMetadata(name: string): { name: string; description?: string } | null {
    const factory = this.instances.get(name);
    if (factory) {
      return factory.getMetadata();
    }
    return null;
  }

  /**
   * Nettoie toutes les factories et instances
   */
  static clear(): void {
    // Nettoyer toutes les instances
    for (const [name, instance] of this.instances) {
      try {
        instance.dispose();
      } catch (error) {
        console.error(`Error disposing factory "${name}":`, error);
      }
    }

    this.instances.clear();
    this.factories.clear();
  }

  /**
   * Recharge une factory (utile pour le développement)
   */
  static reloadFactory(name: string): void {
    if (this.instances.has(name)) {
      const instance = this.instances.get(name)!;
      instance.dispose();
      this.instances.delete(name);
    }
    // La prochaine création recréera l'instance
  }
}