/**
 * Component.ts - Interface de base pour les composants ECS
 *
 * Dans l'architecture ECS, les composants sont de simples conteneurs de données.
 * Ils n'ont PAS de logique - celle-ci réside dans les Systems.
 */

/**
 * Interface de base pour tous les composants ECS
 */
export interface Component {
  /** Type unique identifiant ce composant */
  readonly type: string;

  /** Méthode optionnelle pour mettre à jour l'état interne du composant */
  update?(deltaTime: number): void;
}
