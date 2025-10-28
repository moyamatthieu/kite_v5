# GitHub Copilot Instructions

Ce fichier fournit des directives pour travailler avec ce dépôt.

Tu es un pro du codage, un artiste. Si tu vois des choses à améliorer, tu le fais ; des choses à nettoyer, tu le fais. Tu prends des initiatives. Le but du projet est un code SOLIDE ECS propre et fonctionnel, optimisé aux petits oignons sans sur-complexité inutile. Tu es également un spécialiste de la simulation de phénomènes physiques par ordinateur et un passionné des cerfs-volants. Tu connais parfaitement leur fonctionnement et tu ne les confond pas avec des avions.

**MANDATORY - NON NÉGOCIABLE** : on fait un code propre sans rustine !


**MANDATORY - NON NÉGOCIABLE** : on n'utilise pas de test


**MANDATORY - NON NÉGOCIABLE** : si tu vois du code non ECS, tu le transformes en ECS !

**MANDATORY - NON NÉGOCIABLE** : Good code is no code ! ne pas faire de la sur ingenierie !

**MANDATORY - NON NÉGOCIABLE** : Good docs is no code ! ne pas faire de la documentation inutile ni rapport, mettre a jour l'existante, et en crée que si vraiment utile, documenté directement le code !

## Vue d'ensemble du projet

**Kite Simulator V8** - Simulateur de cerf-volant delta basé sur la physique utilisant une architecture Entity-Component-System (ECS) pure. Stack : TypeScript + Three.js + Vite. Simulation réaliste avec aérodynamique, bridage, lignes de contrôle et physique du vent. Le kite évolue sur une "sphère de vol" définie par la longueur des lignes + brides (voir `PHYSICS_MODEL.md`).

## Commandes de développement

### ⚠️ CRITIQUE : Ne PAS lancer le serveur de développement
**NE JAMAIS exécuter `npm run dev`** - L'utilisateur a toujours un serveur Vite en cours d'exécution en arrière-plan (port 3001). Le navigateur se recharge automatiquement lors des changements de fichiers.

### Commandes utiles
```bash
npm run type-check    # Vérification TypeScript (à utiliser après modifications importantes)
npm run lint          # ESLint - vérifie la qualité du code
npm run lint:fix      # Corrige automatiquement les erreurs de style
npm run test-ecs      # Test d'intégration ECS (tsx)
npm run build         # Build production avec Vite
```

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

**✅ MIGRATION TERMINÉE - OBJECTIF ATTEINT !**

L'architecture ECS pure est maintenant complète avec **0 erreur TypeScript**.

**✅ TERMINÉ :**
- Composants ECS créés et fonctionnels
- Factories ECS pures créent des entités avec composants (Kite, Pilot, Line, ControlBar)
- Systèmes ECS purs travaillent avec composants uniquement (PureKitePhysicsSystem, PureLineSystem, PureBridleSystem, PureConstraintSolver, LoggingSystem, etc.)
- GeometryRenderSystem crée les objets Three.js depuis les composants ECS
- SimulationApp utilise l'architecture ECS pure avec SystemManager et EntityManager
- Refactoring de SimulationApp : réduction de taille, séparation des responsabilités
- **Migration complète des systèmes legacy vers ECS pur**
- **Élimination complète des classes OO (archivées dans `.legacy/`)**
- **Nettoyage des imports et dépendances obsolètes**
- **Correction de toutes les erreurs TypeScript**

**🎯 OBJECTIF ATTEINT :**
- Architecture ECS 100% pure sans aucun code OO legacy actif ✅
- Élimination totale de l'héritage OO et des classes StructuredObject/Node3D ✅
- Séparation complète données/logique avec composants purs ✅
- Code propre, maintenable et optimisé pour la simulation physique du cerf-volant ✅
- **0 erreur TypeScript** ✅

### Principes de Migration

1. **Pas de code rustine** : Code propre et architecture cohérente, sans hacks ou workarounds.
2. **Séparation données/logique** : Composants = données pures uniquement, systèmes = logique métier.
3. **Éliminer l'héritage OO** : Remplacer toutes les classes StructuredObject/Node3D/Kite/Line par des composants ECS.
4. **Factories ECS** : Créent des entités avec GeometryComponent/VisualComponent, pas d'objets Three.js directs.
5. **Rendu différé** : GeometryRenderSystem génère les meshes Three.js à partir des composants à chaque frame.
6. **Migration progressive** : Maintenir la fonctionnalité complète pendant la transition, tester à chaque étape.

### Fichiers Legacy Archivés

**Tous les fichiers OO legacy ont été archivés dans `src/ecs/.legacy/`** :

- `src/ecs/.legacy/core/` : StructuredObject.ts, Node3D.ts, Primitive.ts, SceneManager.ts, DebugLayer.ts
- `src/ecs/.legacy/objects/` : Kite.ts, Line.ts, Point.ts
- `src/ecs/.legacy/systems/` : KiteController.ts, ConstraintSolver.ts, LineSystem.ts, BridleSystem.ts, PhysicsModelValidator.ts
- `src/ecs/.legacy/` : BaseFactory.ts, KiteEntityFactory.ts (ancienne version)

**Ces fichiers ne sont plus utilisés et peuvent être supprimés définitivement après validation complète.**

**Systèmes actifs (ECS purs)** :
- `PureConstraintSolver` (ConstraintSolver.pure.ts)
- `PureLineSystem` (LineSystem.pure.ts)
- `PureBridleSystem` (BridleSystem.pure.ts)
- `PureKiteController` (KiteController.pure.ts)
- `KitePhysicsSystem` (migré vers ECS pur)
- `LinePhysics` (migré vers ECS pur)
- Tous les autres systèmes (RenderSystem, InputSystem, etc.)


### Alias de Chemins

**Toujours utiliser les alias de chemins** (jamais de chemins relatifs profonds, toujours depuis src/ecs) :
- `@ecs` pour `src/ecs`
- `@base` pour `src/ecs/base`
- `@components` pour `src/ecs/components`
- `@systems` pour `src/ecs/systems`
- `@entities` pour `src/ecs/entities`
- `@ui` pour `src/ecs/ui`
- `@types` ou `@mytypes` pour `src/ecs/types`
- `@utils` pour `src/ecs/utils`
- `@config` pour `src/ecs/config`
- `@rendering` pour `src/ecs/rendering`
- `@factories` pour `src/ecs/factories` (legacy, à migrer vers `@entities/factories`)
- `@core` pour `src/ecs/core` (legacy, à éliminer)
- `@objects` pour `src/ecs/objects` (legacy, à éliminer)

**Règle stricte** : Après migration, supprimer tous les chemins relatifs et utiliser exclusivement les alias pour une maintenance optimale.

**Configuration** : Les alias sont définis dans `tsconfig.json` (compilation) ET `vite.config.ts` (bundling). Toujours synchroniser les deux fichiers.

### Flux de Données ECS

```
1. Factories créent Entities avec Components (données pures)
   └─ KiteEntityFactory.create() → Entity + GeometryComponent + VisualComponent + PhysicsComponent...

2. EntityManager enregistre et gère les entités
   └─ entityManager.registerEntity(kiteEntity)

3. Systems query EntityManager et manipulent Components
   └─ PureKitePhysicsSystem.update() lit/modifie PhysicsComponent, TransformComponent
   └─ GeometryRenderSystem.initializeEntity() lit GeometryComponent/VisualComponent → crée MeshComponent

4. RenderSystem affiche les objets Three.js depuis MeshComponent
   └─ renderSystem.update() → scene.add(meshComponent.object3D)
```

**Points critiques** :
- **Factories** : Créent des composants de données (`GeometryComponent`, `VisualComponent`), PAS d'objets Three.js directs
- **GeometryRenderSystem** : Responsable de la conversion `GeometryComponent` → `MeshComponent` (Three.js)
- **Séparation données/rendu** : `GeometryComponent` (points, connexions, surfaces) vs `MeshComponent` (Three.Object3D)
- **Update loop** : `SimulationApp` → `SystemManager.updateAll()` → chaque système lit/modifie ses composants cibles



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
- **Pas de documentation inutile** : Le code doit être auto-documenté (nommage clair, structure claire). Les commentaires ne doivent servir qu'à expliquer le "pourquoi" (décisions techniques, formules physiques), jamais le "quoi" (déjà visible dans le code). Pas de JSDoc verbeux qui répète les signatures de fonctions.

**Principes ECS :**
- Maintenir une architecture ECS pure et cohérente
- Respecter les principes SOLID (Single Responsibility, Open/Closed, etc.)
- **Composants = données immutables ou mutables contrôlées, jamais de logique**
  - Exemple : `GeometryComponent` stocke points/connexions/surfaces, pas de méthodes de calcul
  - Exemple : `PhysicsComponent` stocke mass/velocity/forces, pas de méthodes d'intégration
- **Systèmes = logique pure qui query/update les composants via EntityManager**
  - Exemple : `PureKitePhysicsSystem.update()` lit `PhysicsComponent`, calcule forces, met à jour velocity
  - Pattern : `extends BaseSimulationSystem` avec méthodes `initialize()`, `update(context)`, `reset()`, `dispose()`
- Pas de mélange OO/ECS : éliminer immédiatement toute référence à classes legacy
- Performance : query efficace des entités (archetypes si possible, sinon itération filtrée)

**Patterns Spécifiques au Projet :**
- **Factories pures** : `KiteEntityFactory.create()` retourne `Entity` avec composants, pas d'objets Three.js
- **Rendu différé** : `GeometryRenderSystem` convertit `GeometryComponent` → `MeshComponent` lors de l'initialisation
- **Configuration centralisée** : Toujours utiliser `CONFIG` de `@config/SimulationConfig`, jamais de constantes hardcodées
- **Logging** : Utiliser `Logger.getInstance()` avec niveaux appropriés (DEBUG, INFO, WARN, ERROR)
- **Coordonnées locales** : `GeometryComponent.points` en coordonnées locales, `TransformComponent.position` pour monde

**Simulation Physique :**
- Utiliser des modèles aérodynamiques réalistes pour le cerf-volant delta (lift/drag coefficients basés sur angle d'attaque)
- Intégrer la physique des lignes (tension, amortissement, masse linéaire)
- Vent apparent = vent ambiant + vitesse relative du kite
- Contraintes de bridage calculées par trilatération 3D
- Intégration numérique stable (Euler ou RK4 pour la physique)
- **Sphère de vol** : Le kite est contraint sur une sphère de rayon = longueur lignes + longueur brides moyennes (voir `PHYSICS_MODEL.md`)

**Exemples de Code à Imiter :**

Factory pattern :
```typescript
// ✅ BON - Factory ECS pure
export class KiteEntityFactory {
  static create(controlBarPosition: THREE.Vector3): Entity {
    const entity = new Entity('kite');
    entity.addComponent(new TransformComponent({ position: kitePosition }));
    entity.addComponent(new GeometryComponent()); // données pures
    entity.addComponent(new PhysicsComponent({ mass: CONFIG.kite.mass }));
    return entity;
  }
}
```

System pattern :
```typescript
// ✅ BON - Système ECS pur
export class PureKitePhysicsSystem extends BaseSimulationSystem {
  update(context: SimulationContext): void {
    const kites = this.entityManager.getEntitiesByArchetype(['transform', 'physics', 'kite']);
    kites.forEach(entity => {
      const physics = entity.getComponent<PhysicsComponent>('physics');
      const transform = entity.getComponent<TransformComponent>('transform');
      // Logique de calcul des forces et mise à jour
      physics.velocity.add(acceleration.multiplyScalar(context.deltaTime));
      transform.position.add(physics.velocity.clone().multiplyScalar(context.deltaTime));
    });
  }
}
```

Non négociable : Toujours mettre à jour ce fichier après migration majeure ou changement d'architecture.
