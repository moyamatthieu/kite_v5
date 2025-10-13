# GitHub Copilot Instructions

Ce fichier fournit des directives pour travailler avec ce dépôt.

MANDATORY   - NON NEGOCIABLE  : on fait un code propre sans rustine  ! On reflechie ! on investigue !

## Vue d'ensemble du projet

**Kite Simulator V8** - Simulateur de cerf-volant basé sur la physique utilisant une architecture Entity-Component-System (ECS). Projet TypeScript/Three.js simulant un kite delta avec aérodynamique réaliste, système de bridage, lignes de contrôle et physique du vent.

**Version actuelle** : V8 (migration vers ECS pur en cours)
**Branch** : `clean-code-refactor`
**Date dernière révision** : 12 octobre 2025

## Commandes de développement

### Commandes essentielles
- **`npm run type-check`** - Vérifier les types TypeScript (à utiliser fréquemment)
- **`npm run lint`** - Vérifier le style de code
- **`npm run lint:fix`** - Corriger automatiquement les problèmes de linting
- **`npm run build`** - Build pour production (sortie: dist/)
- **`npm run preview`** - Prévisualiser le build de production

### ⚠️ CRITIQUE : Configuration du serveur de développement
**NE JAMAIS exécuter `npm run dev`** 



### Commandes de test
- `npm run test-ecs` - Tester l'intégration ECS (via tsx)
- `npm run validate-migration` - Valider la migration d'architecture (via tsx)

### Commandes automatiques
- Toutes les commandes nécessaires, comme `npm run dev:debug`, doivent être exécutées automatiquement par l'assistant sans demander confirmation à l'utilisateur.
- **Relancer le serveur automatiquement** : Si une tâche nécessite de redémarrer le serveur, l'assistant doit exécuter la commande correspondante sans intervention de l'utilisateur.

### Dépendances
- **Runtime** : `three@0.160.0`, `three-bvh-csg@0.0.17`
- **Dev** : `vite@5.4.19`, `typescript@5.3.3`, `eslint@9.37.0`, `tsx@4.20.6`
- **Types** : `@types/three@0.160.0`

## Architecture

### Architecture ECS Pure

Le projet suit un pattern Entity-Component-System strict, actuellement en migration vers ECS pur :

**Concepts fondamentaux :**
- **Entities** (`src/simulation/entities/`) : Conteneurs avec ID uniques contenant des composants (pas de logique)
- **Components** (`src/simulation/components/`) : Structures de données pures (TransformComponent, PhysicsComponent, MeshComponent, KiteComponent)
- **Systems** (`src/simulation/systems/`) : Processeurs de logique opérant sur des entités avec composants spécifiques
- **EntityManager** : Registre central pour créer, requêter et gérer les entités
- **Entity Factories** (`src/simulation/factories/`) : Pattern Factory pour créer des entités complexes avec leurs composants

**Systèmes clés :**
- `KitePhysicsSystem` - Physique complète du kite (aérodynamique, contraintes, système de bridage, simulation du vent)
- `InputSystem` - Entrées utilisateur avec lissage
- `ControlBarSystem` - Rotation de la barre de contrôle et positions des poignées (ECS)
- `RenderSystem` - Orchestration du rendu Three.js (caméra, scène, lumières, helpers de debug)
- `LinesRenderSystem` - Rendu des lignes de contrôle avec courbes caténaires
- `PilotSystem` - Gestion de l'entité pilote (position, rendu)

**IMPORTANT - Systèmes supprimés (nettoyage 2025-10-11) :**
- ~~`PhysicsSystem`~~ - **SUPPRIMÉ** (inutilisé, toute la physique gérée par KitePhysicsSystem)
- ~~`WindSystem`~~ - **SUPPRIMÉ** (inutilisé, vent géré par WindSimulator dans KitePhysicsSystem)

**Cycle de vie des systèmes :**
1. `initialize()` - Configuration (appelé une fois)
2. `update(context)` - Logique par frame avec SimulationContext (deltaTime, totalTime, isPaused, debugMode)
3. `reset()` - Retour à l'état initial
4. `dispose()` - Nettoyage des ressources

**Ordre d'exécution (SimulationApp.updateLoop) :**
```
1. InputSystem          → Capture clavier/souris
2. ControlBarSystem     → Calcule rotation barre + positions poignées
3. KitePhysicsSystem    → Physique complète (forces → intégration → contraintes)
4. PilotSystem          → Met à jour pilote
5. LinesRenderSystem    → Rendu des lignes avec caténaires
6. RenderSystem         → Rendu final de la scène
```

### Architecture Physique - Comportement Émergent

Le simulateur utilise une approche **physique d'abord, comportement émergent** :

**Modules physiques clés** (`src/simulation/physics/`) :
- `AerodynamicsCalculator` - Portance, traînée et couples dus au vent (forces distribuées par surface)
- `LineSystem` - Tensions des lignes de contrôle (contraintes, pas forces)
- `BridleSystem` - Tensions du bridage interne (contraintes, pas forces)
- `ConstraintSolver` - Position-Based Dynamics (PBD) pour contraintes géométriques
- `WindSimulator` - Champ de vent avec turbulence
- `VelocityCalculator` - Calculs de vent apparent
- `LinePhysics` - Physique des lignes (catenary, tensions)
- `PhysicsModelValidator` - Validation du modèle physique

**Principes physiques critiques :**
1. **Les lignes sont des contraintes, pas des forces** - Les lignes contraignent la distance mais ne "poussent" ou "tirent" pas directement
2. **Forces distribuées** - Aérodynamique et gravité calculées par surface, créant des couples émergents
3. **Orientation émergente** - L'orientation du kite émerge de la distribution des forces + contraintes, pas de comportement scripté
4. **Position-Based Dynamics** - Contraintes résolues géométriquement après intégration physique
5. **Sphère de vol** - Le kite évolue sur une sphère virtuelle de rayon = longueur lignes + longueur brides

**Flux physique (60 FPS) :**
```
Input → Rotation ControlBar → Positions des poignées →
Vent apparent (vent - vitesse kite) →
Forces aérodynamiques (portance, traînée, couples) + Gravité →
Intégration physique (F=ma, τ=Iα) →
Résolution contraintes (lignes, brides) via PBD →
Rendu
```

**⚠️ BUG CONNU (CRITIQUE)** - Identifié le 2025-10-12 :
- **Localisation** : `ConstraintSolver.ts` lignes 288 et 405
- **Problème** : Tolérance PBD trop stricte (`dist <= lineLength - 0.0005`) bloque le kite à 14.9995m au lieu de 15m
- **Impact** : Marge de mouvement réduite à 30cm → kite physiquement bloqué
- **Solution** : Remplacer par `dist <= lineLength` (sans tolérance)
- **Référence** : Voir `QUICK_FIX_GUIDE.md` et `AUDIT_COMPLET_2025-10-12.md`

### Alias de Chemins

**Toujours utiliser les alias de chemins** (jamais de chemins relatifs profonds) :
```typescript
import { Kite } from '@/objects/Kite'
import { BaseSimulationSystem } from '@core/BaseSimulationSystem'
import { FrameFactory } from '@factories/FrameFactory'
import { WindConfig } from '@types'
```

**Alias disponibles** (configurés dans `vite.config.ts` et `tsconfig.json`) :
- `@/*` → `src/*`
- `@core/*` → `src/core/*`
- `@base/*` → `src/base/*`
- `@objects/*` → `src/objects/*`
- `@factories/*` → `src/factories/*`
- `@types` → `src/types/index`

## Style de Code & Patterns

### Règles Critiques

**Refactoring :**
- **Refactoring progressif et incrémental uniquement** - Petits changements atomiques, valider à chaque étape
- Après chaque changement : exécuter `type-check`, `lint`, tester manuellement dans le navigateur
- JAMAIS de refactoring massifs - minimiser le risque de régression

**Code Propre :**
- Fonctions courtes avec retours anticipés (éviter `else`)
- Éviter les magic numbers - utiliser les constantes `CONFIG`
- Un niveau d'indentation par fonction quand possible
- Nommage explicite (`applyConstraint`, `apparentWind`, pas `process`, `calc`)
- Commenter les sections complexes de manière concise

**Principes ECS :**
- Maintenir une architecture propre
- Respecter les principes SOLID
- Valider chaque changement avec les outils automatisés

**Spécifique au Kite Simulator :**
- Les lignes/brides sont des contraintes, ne jamais appliquer de forces directement
- Ajuster la géométrie ou les contraintes, pas les forces directes
- Utiliser `DebugRenderer` ou `RenderSystem.createHelper*` pour la visualisation de debug (ne pas accéder directement à la scène Three.js)

### Ordre des Imports
1. Bibliothèques externes (`import * as THREE from 'three'`)
2. Classes core/base (`@core`, `@base`)
3. Types (`@types`)
4. Utilitaires (`@/utils`)
5. Composants, systèmes, entités
6. Fichiers locaux

## Contexte de Migration

**Branch Actuelle :** `clean-code-refactor`

Le projet migre d'une architecture hybride vers ECS pur. Changements récents :
- ControlBar migrée vers ECS (ControlBarSystem + Entity)
- Lissage de InputSystem déplacé vers ControlBarSystem
- LinesRenderSystem créé pour le rendu des lignes
- PilotSystem et PilotEntity ajoutés
- Entity Factories pattern implémenté (ControlBarEntityFactory, PilotEntityFactory, KiteEntityFactory)

**Pattern de Migration :**
1. Créer la classe d'entité si nécessaire (extends Entity)
2. Créer/réutiliser les composants (Transform, Mesh, Physics)
3. Créer le système (extends BaseSimulationSystem)
4. Enregistrer l'entité dans EntityManager
5. Initialiser le système dans SimulationApp
6. Supprimer le code legacy

**Composants legacy encore utilisés :**
- Objet `Kite` (StructuredObject) - pas encore migré vers ECS pur
- `KiteController` - gestion de l'état physique
- Modules physiques sont standalone (pas encore des systèmes ECS)

## Tâches Courantes

### Ajouter un nouveau Système ECS
1. Créer `src/simulation/systems/NewSystem.ts` extends `BaseSimulationSystem`
2. Implémenter : `initialize()`, `update(context)`, `reset()`, `dispose()`
3. Enregistrer dans `SimulationApp.createSystems()`
4. Initialiser dans `SimulationApp.initializeSystems()`
5. Appeler `update()` dans `SimulationApp.updateLoop()`

### Modifier la Physique
1. Vérifier d'abord `CONFIG` dans `SimulationConfig.ts`
2. La logique physique va dans les modules `src/simulation/physics/`
3. Les forces sont calculées, les contraintes résolues géométriquement
4. Tester avec `npm run type-check` après modifications

### Ajouter de la Visualisation de Debug
- Utiliser `DebugRenderer` (passé aux systèmes qui en ont besoin)
- Créer des helpers : `RenderSystem.createHelperArrow()`, etc.
- Ne jamais accéder à `scene` directement - utiliser les abstractions des systèmes

### Ajuster le Comportement du Kite
- **Aérodynamique :** Modifier `AerodynamicsCalculator.ts` ou `CONFIG.aero`
- **Longueurs des brides :** Utiliser `kite.setBridleLengths()` - reconstruit la géométrie
- **Comportement des lignes :** Modifier `LineSystem.ts` ou `CONFIG.lines`
- **Vent :** Modifier `WindSimulator.ts` ou `CONFIG.wind`

## Conseils

- **Debugging physique :** Logs de console toutes les 1 seconde avec état complet
- **Type safety :** Exécuter `npm run type-check` fréquemment
- **Hot reload :** Le navigateur se recharge automatiquement, pas besoin de redémarrer le serveur
- **Visualisation des brides :** Les brides changent de couleur selon la tension (vert=relâché, jaune=moyen, rouge=élevé)
- **Systèmes de coordonnées :** Utiliser `kite.toWorldCoordinates()` pour transformer local → monde
- **Comportement émergent :** Faire confiance à la physique - ne pas scripter les comportements, les laisser émerger des forces + contraintes

Non négrociable :--- Toujours mettre a jour ce fichier si besoin  ---