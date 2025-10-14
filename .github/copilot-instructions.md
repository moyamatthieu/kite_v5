# GitHub Copilot Instructions

Ce fichier fournit des directives pour travailler avec ce dépôt.

MANDATORY   - NON NEGOCIABLE  : on fait un code propre sans rustine  !

## Vue d'ensemble du projet

**Kite Simulator V8** - Simulateur de cerf-volant basé sur la physique utilisant une architecture Entity-Component-System (ECS). Projet TypeScript/Three.js simulant un kite delta avec aérodynamique réaliste, système de bridage, lignes de contrôle et physique du vent.

## Commandes de développement

### ⚠️ CRITIQUE : Ne PAS lancer le serveur de développement
**NE JAMAIS exécuter `npm run dev`** - L'utilisateur a toujours un serveur Vite en cours d'exécution en arrière-plan. Le navigateur se recharge automatiquement lors des changements de fichiers.

## Architecture

### Architecture ECS Pure

Le projet suit un pattern Entity-Component-System strict :
- **Entités** : Représentent des objets uniques dans la simulation (e.g., `LineEntity`, `PilotEntity`).
- **Composants** : Contiennent des données spécifiques (e.g., `TransformComponent`, `PhysicsComponent`).
- **Systèmes** : Contiennent la logique qui agit sur les entités et leurs composants (e.g., `KitePhysicsSystem`, `RenderSystem`).

Tous les fichiers ECS sont organisés dans le dossier `src/ecs` :
- `src/ecs/components` : Composants ECS.
- `src/ecs/entities` : Entités ECS.
- `src/ecs/systems` : Systèmes ECS.
- `src/ecs/ui` : Interface utilisateur et gestion de l'UI.
- `src/ecs/types` : Types centralisés pour les objets ECS.
- `src/ecs/utils` : Utilitaires généraux pour l'ECS.

### Directives de Migration ECS

Lors de la migration vers l'architecture ECS :
- **Analyser et classer les fichiers existants** : Identifier les entités, composants et systèmes dans le code actuel.
- **Réorganiser les fichiers** : Placer chaque fichier dans le dossier correspondant (`components`, `entities`, `systems`, etc.).
- **Refactoriser le code** : Adapter les fichiers pour respecter les principes ECS stricts.
- **Supprimer les éléments obsolètes** : Nettoyer les fichiers inutilisés ou redondants.

### Alias de Chemins

**Toujours utiliser les alias de chemins** (jamais de chemins relatifs profonds) :
- `@ecs` pour `src/ecs`
- `@components` pour `src/ecs/components`
- `@systems` pour `src/ecs/systems`
- `@entities` pour `src/ecs/entities`
- `@ui` pour `src/ecs/ui`
- `@types` pour `src/ecs/types`
- `@utils` pour `src/ecs/utils`

## Style de Code & Patterns

### Règles Critiques

**Code Propre :**
- Fonctions courtes avec retours anticipés (éviter `else`)
- Éviter les magic numbers - utiliser les constantes `CONFIG`
- Un niveau d'indentation par fonction quand possible
- Nommage explicite (`applyConstraint`, `apparentWind`, pas `process`, `calc`)
- Commenter les sections complexes de manière concise

**Principes ECS :**
- Maintenir une architecture propre
- Respecter les principes SOLID

Non négociable :--- Toujours mettre à jour ce fichier si besoin  ---