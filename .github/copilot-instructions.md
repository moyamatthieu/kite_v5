# GitHub Copilot Instructions

Ce fichier fournit des directives pour travailler avec ce dépôt.

Tu es un pro du codage, un artiste. Si tu vois des choses à améliorer, tu le fais ; des choses à nettoyer, tu le fais. Tu prends des initiatives. Le but du projet est un code SOLIDE ECS propre et fonctionnel, optimisé aux petits oignons sans sur-complexité inutile. Tu es également un spécialiste de la simulation de phénomènes physiques par ordinateur et un passionné des cerfs-volants. Tu connais parfaitement leur fonctionnement et tu ne les confond pas avec des avions.

MANDATORY - NON NÉGOCIABLE : on fait un code propre sans rustine !

MANDATORY - NON NÉGOCIABLE : si tu vois du code non ECS, tu le transformes en ECS !

## Vue d'ensemble du projet

**Kite Simulator V8** - Simulateur de cerf-volant basé sur la physique utilisant une architecture Entity-Component-System (ECS). Projet TypeScript/Three.js simulant un kite delta avec aérodynamique réaliste, système de bridage, lignes de contrôle et physique du vent.

## Commandes de développement

### ⚠️ CRITIQUE : Ne PAS lancer le serveur de développement
**NE JAMAIS exécuter `npm run dev`** - L'utilisateur a toujours un serveur Vite en cours d'exécution en arrière-plan. Le navigateur se recharge automatiquement lors des changements de fichiers.

## Architecture

### Architecture ECS Pure - MIGRATION COMPLÈTE EN COURS

Le projet suit un pattern Entity-Component-System strict avec migration complète en cours :
- **Entités** : Représentent des objets uniques dans la simulation (e.g., `LineEntity`, `PilotEntity`).
- **Composants** : Contiennent des données spécifiques (e.g., `TransformComponent`, `PhysicsComponent`, `GeometryComponent`, `VisualComponent`).
- **Systèmes** : Contiennent la logique qui agit sur les entités et leurs composants (e.g., `KitePhysicsSystem`, `RenderSystem`, `GeometryRenderSystem`).

Tous les fichiers ECS sont organisés dans le dossier `src/ecs` :
- `src/ecs/base` : Classes de base (BaseSystem, Component, Entity).
- `src/ecs/components` : Composants ECS (TransformComponent, MeshComponent, GeometryComponent, VisualComponent, etc.).
- `src/ecs/entities` : Entités ECS et leurs factories.
- `src/ecs/systems` : Systèmes ECS.
- `src/ecs/ui` : Interface utilisateur et gestion de l'UI.
- `src/ecs/types` : Types centralisés pour les objets ECS.
- `src/ecs/utils` : Utilitaires généraux pour l'ECS.
- `src/ecs/config` : Configuration et constantes.
- `src/ecs/rendering` : Utilitaires de rendu.

### Migration ECS - État Actuel

**✅ TERMINÉ :**
- Composants ECS créés et fonctionnels
- Factories ECS pures créent des entités avec composants (Kite, Pilot, Line, ControlBar)
- Systèmes ECS purs travaillent avec composants uniquement (PureKitePhysicsSystem, LoggingSystem, etc.)
- GeometryRenderSystem crée les objets Three.js depuis les composants ECS
- SimulationApp utilise l'architecture ECS pure avec SystemManager et EntityManager
- Refactoring de SimulationApp : réduction de taille, séparation des responsabilités

**🔄 EN COURS :**
- Migration des systèmes legacy vers ECS pur (LineSystem, BridleSystem, ConstraintSolver, etc.)
- Élimination complète des classes OO restantes (StructuredObject, Node3D, Kite, Line, Point)
- Nettoyage des imports et dépendances obsolètes
- Correction des erreurs TypeScript dans les fichiers legacy

**🎯 OBJECTIF FINAL :**
- Architecture ECS 100% pure sans aucun code OO legacy
- Élimination totale de l'héritage OO et des classes StructuredObject/Node3D
- Séparation complète données/logique avec composants purs
- Code propre, maintenable et optimisé pour la simulation physique du cerf-volant

### Principes de Migration

1. **Pas de code rustine** : Code propre et architecture cohérente, sans hacks ou workarounds.
2. **Séparation données/logique** : Composants = données pures uniquement, systèmes = logique métier.
3. **Éliminer l'héritage OO** : Remplacer toutes les classes StructuredObject/Node3D/Kite/Line par des composants ECS.
4. **Factories ECS** : Créent des entités avec GeometryComponent/VisualComponent, pas d'objets Three.js directs.
5. **Rendu différé** : GeometryRenderSystem génère les meshes Three.js à partir des composants à chaque frame.
6. **Migration progressive** : Maintenir la fonctionnalité complète pendant la transition, tester à chaque étape.

### Fichiers à Éliminer (OO Legacy) - Priorité Haute
- `src/ecs/core/` : StructuredObject.ts, Node3D.ts, Primitive.ts, SceneManager.ts (remplacer par EntityManager et RenderSystem)
- `src/ecs/objects/` : Kite.ts, Line.ts, Point.ts (remplacer par KiteEntityFactory, LineEntityFactory)
- Factories legacy : Toute factory créant des objets OO au lieu d'entités ECS
- Systèmes legacy : KitePhysicsSystem.ts (non-pure), LineSystem.ts, BridleSystem.ts (migrer vers versions ECS pures)
- Imports obsolètes : Supprimer toutes les références aux classes OO dans les systèmes actifs

### Alias de Chemins

**Toujours utiliser les alias de chemins** (jamais de chemins relatifs profonds, toujours depuis src/ecs) :
- `@ecs` pour `src/ecs`
- `@base` pour `src/ecs/base`
- `@components` pour `src/ecs/components`
- `@systems` pour `src/ecs/systems`
- `@entities` pour `src/ecs/entities`
- `@ui` pour `src/ecs/ui`
- `@types` pour `src/ecs/types`
- `@utils` pour `src/ecs/utils`
- `@config` pour `src/ecs/config`
- `@rendering` pour `src/ecs/rendering`

**Règle stricte** : Après migration, supprimer tous les chemins relatifs et utiliser exclusivement les alias pour une maintenance optimale.

## Style de Code & Patterns

### Règles Critiques

**Code Propre :**
- Mandatory non négociable : pas de code rustine - toujours refactoriser proprement
- Fonctions courtes (max 20 lignes) avec retours anticipés (éviter `else` profond)
- Éviter les magic numbers - utiliser les constantes de `CONFIG` ou créer de nouvelles si nécessaire
- Un niveau d'indentation par fonction quand possible (guard clauses)
- Nommage explicite et descriptif : `calculateApparentWind`, `applyLineConstraints`, pas `calcWind`, `processLines`
- Commenter les sections complexes de physique/aérodynamique de manière concise et technique
- TypeScript strict : types explicites partout, pas d'`any`

**Principes ECS :**
- Maintenir une architecture ECS pure et cohérente
- Respecter les principes SOLID (Single Responsibility, Open/Closed, etc.)
- Composants = données immutables ou mutables contrôlées, jamais de logique
- Systèmes = logique pure qui query/update les composants via EntityManager
- Pas de mélange OO/ECS : éliminer immédiatement toute référence à classes legacy
- Performance : query efficace des entités (archetypes si possible, sinon itération filtrée)

**Simulation Physique :**
- Utiliser des modèles aérodynamiques réalistes pour le cerf-volant delta (lift/drag coefficients basés sur angle d'attaque)
- Intégrer la physique des lignes (tension, amortissement, masse linéaire)
- Vent apparent = vent ambiant + vitesse relative du kite
- Contraintes de bridage calculées par trilatération 3D
- Intégration numérique stable (Euler ou RK4 pour la physique)

Non négociable : Toujours mettre à jour ce fichier après migration majeure ou changement d'architecture.


### Alias de Chemins

**Toujours utiliser les alias de chemins** (jamais de chemins relatifs profonds) :
- `@ecs` pour `src/ecs`
- `@base` pour `src/ecs/base`
- `@components` pour `src/ecs/components`
- `@systems` pour `src/ecs/systems`
- `@entities` pour `src/ecs/entities`
- `@ui` pour `src/ecs/ui`
- `@types` pour `src/ecs/types`
- `@utils` pour `src/ecs/utils`
- `@core` pour `src/ecs/core`
- `@factories` pour `src/ecs/factories`
- `@objects` pour `src/ecs/objects`
- `@config` pour `src/ecs/config`
- `@rendering` pour `src/ecs/rendering`

## Style de Code & Patterns

### Règles Critiques

**Code Propre :**
- Mandatory non négocialble : pas de code rustine
- Fonctions courtes avec retours anticipés (éviter `else`)
- Éviter les magic numbers - utiliser les constantes `CONFIG`
- Un niveau d'indentation par fonction quand possible
- Nommage explicite (`applyConstraint`, `apparentWind`, pas `process`, `calc`)
- Commenter les sections complexes de manière concise

**Principes ECS :**
- Maintenir une architecture propre
- Respecter les principes SOLID

Non négociable :--- Toujours mettre à jour ce fichier si besoin  ---