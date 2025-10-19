/**
 * Component.ts - Interface de base pour tous les composants ECS
 * 
 * Un composant est un conteneur de données pures sans logique métier.
 * La logique est dans les systèmes qui manipulent ces composants.
 */

export abstract class Component {
  /** Type du composant (utilisé pour les queries) */
  abstract readonly type: string;
}

/**
 * Type helper pour extraire le type d'un composant
 */
export type ComponentType<T extends Component> = T['type'];
