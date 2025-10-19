# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Simulateur de cerf-volant delta avec physique réaliste utilisant une **architecture Entity-Component-System (ECS) pure**. Le projet utilise TypeScript, Three.js pour le rendu 3D et Vite comme environnement de développement.

**URL de développement** : http://localhost:3001

## Essential Commands

```bash
npm run dev              # Démarre le serveur Vite (port 3001) avec hot reload
npm run build            # Build de production (génère dist/)
npm run type-check       # Vérification TypeScript sans compilation
npm run lint             # Analyse statique ESLint
npm run lint:fix         # Correction automatique des problèmes ESLint
```

## Architecture ECS Pure - Règles Strictes

Le projet suit une architecture **Entity-Component-System** pure avec séparation stricte des responsabilités :

### 1. Components (`src/ecs/components/`)
- **Données pures uniquement** - Aucune logique métier
- Ce sont des conteneurs de données sérialisables (POJO)
- Chaque composant étend `Component` et déclare un `type` unique
- **INTERDIT** : Ajouter des méthodes de calcul ou de logique dans les composants

Exemple :
```typescript
export class PhysicsComponent extends Component {
  readonly type = 'physics';
  velocity: THREE.Vector3;
  mass: number;
  // Données uniquement, pas de méthodes métier
}
```

### 2. Systems (`src/ecs/systems/`)
- **Contiennent toute la logique métier**
- Opèrent sur des entités ayant des composants spécifiques via `entityManager.query(['component1', 'component2'])`
- Chaque système a une **priorité d'exécution** définie dans son constructeur (plus bas = plus tôt)
- L'ordre d'exécution est **critique** et défini dans `SimulationApp.ts`

**Ordre d'exécution actuel des systèmes** :
```
Priority 1  : EnvironmentSystem, CameraControlsSystem
Priority 10 : InputSystem (gestion des inputs utilisateur)
Priority 20 : WindSystem (calcul du vent apparent)
Priority 30 : AeroSystem (forces aéro : lift, drag, gravité)
Priority 50 : PhysicsSystem (intégration des forces → vitesse → position)
Priority 55 : ConstraintSystem (contraintes lignes), PilotSystem, LineRenderSystem
Priority 60 : GeometryRenderSystem
Priority 70 : RenderSystem (rendu Three.js final)
Priority 80 : LoggingSystem
Priority 88 : DebugSystem
Priority 90 : UISystem
```

**IMPORTANT** : Lors de l'ajout d'un nouveau système, insérez-le au bon endroit dans le pipeline. Par exemple, un système qui dépend de PhysicsSystem doit avoir une priorité > 50.

### 3. Entities (`src/ecs/entities/`)
- Identifiants uniques + collection de composants
- Assemblées via des **factories** (pattern Factory)
- Chaque type d'entité (kite, pilote, ligne) a sa factory dédiée

Exemple :
```typescript
export class KiteFactory {
  static create(position: THREE.Vector3): Entity {
    const entity = new Entity('kite');
    entity.addComponent(new TransformComponent({position}));
    entity.addComponent(new PhysicsComponent({mass: 0.12}));
    // ... autres composants
    return entity;
  }
}
```

### 4. Core (`src/ecs/core/`)
- Moteur ECS de base : `Entity`, `Component`, `System`, `EntityManager`, `SystemManager`
- **Ne pas modifier** sauf pour améliorer le moteur ECS lui-même

## Physique et Configuration

### Configuration centralisée (`src/ecs/config/Config.ts`)
Toutes les constantes physiques sont dans `CONFIG` :
- `CONFIG.kite` : masse, envergure, surface
- `CONFIG.lines` : longueur, raideur, amortissement
- `CONFIG.aero` : coefficients aérodynamiques (CL, CD, CM)
- `CONFIG.wind` : vitesse (km/h), direction (degrés)
- `CONFIG.initialization` : positions initiales

**IMPORTANT** : La longueur des lignes (`CONFIG.lines.length`) doit être inférieure à la distance initiale kite-barre pour que les lignes soient tendues au démarrage et retiennent le kite.

### Géométrie du kite (`src/ecs/config/KiteGeometry.ts`)
Définit tous les points structurels en coordonnées locales :
- Points principaux : NEZ, SPINE_BAS, BORD_GAUCHE/DROIT
- Points de contrôle : **CTRL_GAUCHE**, **CTRL_DROIT** (où s'attachent les lignes)
- Points intermédiaires : CENTRE, INTER_GAUCHE/DROIT, FIX_GAUCHE/DROIT
- Whiskers : WHISKER_GAUCHE/DROIT (stabilisateurs arrière)

### Système de coordonnées Three.js
- **X** : droite/gauche
- **Y** : haut/bas (vertical)
- **Z** : avant/arrière (négatif = vers l'arrière)

### Vent (WindSystem)
Direction en degrés :
- 0° = +X (Est)
- 90° = +Z (Sud)
- 180° = -X (Ouest)
- 270° = -Z (Nord)

Formule du vent apparent :
```
Vent_apparent = Vent_ambiant - Vitesse_kite + Turbulence
```

Le vent est synchronisé avec `InputComponent` pour les contrôles UI.

## Référence Makani

Le modèle physique s'inspire du projet open-source **Google Makani** (`external/makani-master/`). Avant de modifier la physique (`AeroSystem.ts`, `ConstraintSystem.ts`), consulter ce code de référence pour comprendre les algorithmes de calcul des forces aérodynamiques et des contraintes.

## Systèmes Clés - Responsabilités

| Système | Priorité | Rôle |
|---------|----------|------|
| **WindSystem** | 20 | Calcule le vent apparent pour chaque entité, stocke dans `context.windCache` |
| **AeroSystem** | 30 | Calcule forces aéro (lift, drag) + gravité, accumule dans `physics.forces` |
| **PhysicsSystem** | 50 | Intègre forces → vitesse → position (Euler semi-implicite) |
| **ConstraintSystem** | 55 | Applique contraintes lignes (tension ressort + amortissement), collision sol |
| **RenderSystem** | 70 | Synchronise Three.js avec TransformComponent, rend la scène |

## Flux de données inter-systèmes

Les systèmes communiquent via `SimulationContext` :
```typescript
export interface SimulationContext {
  deltaTime: number;        // Temps écoulé depuis dernière frame
  totalTime: number;        // Temps total simulation
  entityManager: EntityManager;
  windCache?: Map<string, WindState>; // WindSystem → AeroSystem
}
```

Exemple : `WindSystem` calcule le vent apparent et le stocke dans `context.windCache`, puis `AeroSystem` le récupère pour calculer les forces.

## Points d'Attention Critiques

1. **Ordre d'exécution des systèmes** : L'ordre dans `SimulationApp.createSystems()` est fondamental. Si un système B dépend des calculs du système A, A doit s'exécuter avant (priorité inférieure).

2. **Accumulation des forces** : Les systèmes qui appliquent des forces (`AeroSystem`, `ConstraintSystem`) les **accumulent** dans `physics.forces` et `physics.torques`. Le `PhysicsSystem` les intègre puis les **réinitialise à zéro**.

3. **Clone des vecteurs** : Toujours cloner les `THREE.Vector3` lors de l'initialisation des composants pour éviter les références partagées :
   ```typescript
   position: initialPos.clone() // ✅ Bon
   position: initialPos          // ❌ Référence partagée !
   ```

4. **Synchronisation Transform → Mesh** : Le `RenderSystem` synchronise automatiquement `mesh.object3D.position` avec `transform.position`. Ne pas modifier directement les positions Three.js dans d'autres systèmes.

5. **Lignes tendues au départ** : La distance initiale kite-barre doit être **supérieure** à `CONFIG.lines.length` pour que les lignes retiennent le kite. Sinon, le kite tombe en chute libre sous la gravité.

## Développement et Qualité

### Principes de code
- **ECS pur** : Respecter la séparation données (Components) / logique (Systems)
- **TypeScript strict** : Typage explicite, éviter `any`
- **Code propre** : Pas de "rustines", refactorer pour maintenir la qualité
- **Nommage explicite** : Variables et fonctions auto-documentées

### Alias d'imports (tsconfig.json)
Utiliser les alias configurés :
```typescript
import { Entity } from '@ecs/core';          // ✅
import { Entity } from '../core/Entity';     // ❌
```

### Documentation
- **INTERDICTION absolue** : Ne JAMAIS créer de fichiers Markdown (.md) pour la documentation
- Utiliser les commentaires JSDoc/TSDoc dans le code
- Mettre à jour ce fichier CLAUDE.md pour les changements architecturaux

## Débogage

### Mode Debug
Activer le debug dans `CONFIG.debug` :
```typescript
debug: {
  enabled: true,              // Mode debug général
  showForceVectors: true,     // Vecteurs de force 3D
  showPhysicsInfo: false,     // Infos physiques dans la console
  logLevel: 'info'            // 'debug', 'info', 'warn', 'error'
}
```

### Logs de simulation
Le `LoggingSystem` affiche périodiquement :
- Position du kite (X, Y, Z)
- Vitesse (magnitude en m/s)
- Altitude (Y)

### Vérifications communes
- **Kite tombe au sol** → Vérifier que `CONFIG.lines.length` < distance initiale
- **NaN dans les calculs** → Vérifier l'inversion de matrice d'inertie dans `PhysicsComponent`
- **Comportement erratique** → Vérifier l'ordre d'exécution des systèmes
- **Lignes détendues** → Vérifier les points d'attache CTRL_GAUCHE/DROIT dans `KiteGeometry`

## Migration et Héritage

- **Architecture actuelle** : ECS pure (stable)
- **Ancienne architecture** : Archivée dans `legacy/ecs/` (ne pas utiliser)
- Le projet a complètement migré vers l'ECS pure en octobre 2025

## Stack Technique

- **TypeScript 5.3+** : Langage principal
- **Three.js 0.160** : Moteur de rendu 3D
- **Vite 5.4+** : Build tool et dev server
- **ESLint** : Analyse statique

---

**Langue** : Code et commentaires en anglais, communication en français
**Dernière mise à jour** : 18 octobre 2025
