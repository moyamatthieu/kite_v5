# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) lors du travail sur ce dépôt.

## Vue d'Ensemble du Projet

**Kite Simulator V8** est une simulation de vol de cerf-volant basée sur la physique, construite avec TypeScript et Three.js. La simulation utilise la Dynamique Basée sur les Positions (PBD) pour un comportement émergent réaliste—aucune animation scriptée. Le cerf-volant vole sur une contrainte sphérique définie par les longueurs de lignes et de brides, avec des forces aérodynamiques créant le mouvement basé sur l'entrée de la barre de contrôle.

**Principe Fondamental** : Architecture axée sur la physique où le comportement émerge des calculs de forces et des contraintes géométriques, pas de mouvements scriptés.

## Commandes Essentielles

**TOUJOURS exécuter `npm install` avant toute commande de build ou dev.**

```bash
npm install          # Installer les dépendances (REQUIS en premier)
npm run dev          # Démarrer le serveur dev Vite sur http://localhost:3001
npm run build        # Builder le bundle de production
npm run preview      # Prévisualiser le build de production
npm run type-check   # Vérification des types TypeScript sans émission
npm run lint         # Linter les fichiers TypeScript
npm run lint:fix     # Auto-corriger les problèmes de linting
```

**Notes sur le serveur dev :**
- Fonctionne sur le port 3001 (configuré dans vite.config.ts)
- Vérifier la disponibilité : `curl http://localhost:3001`
- Les avertissements de taille de bundle (>500KB) sont attendus à cause de Three.js

## Alias de Chemins (OBLIGATOIRE)

Configurés dans **à la fois** `vite.config.ts` et `tsconfig.json`. Les casser cassera les imports.

```typescript
@/*          → src/*
@core/*      → src/core/*
@base/*      → src/base/*
@objects/*   → src/objects/*
@factories/* → src/factories/*
@types       → src/types/index  // Note: pas de /* final
```

**Toujours utiliser les alias de chemins dans les imports—jamais de chemins relatifs comme `../../types`.**

## Architecture Physique

### La Boucle de Simulation à 60 FPS

```
main.ts
  └─> SimulationApp.ts (orchestrateur central)
       ├─> PhysicsEngine.update(deltaTime, barRotation)
       │    ├─> ControlBarManager.setRotation() — rotation douce de la barre
       │    ├─> WindSimulator.getApparentWind() — vent + turbulence - vitesse du kite
       │    ├─> AerodynamicsCalculator.calculateForces() — portance/traînée/couple par surface
       │    ├─> LineSystem.calculateLineTensions() — affichage seulement
       │    ├─> BridleSystem.calculateBridleTensions() — affichage seulement
       │    ├─> kite.updateBridleVisualization() — colorer les brides par tension
       │    ├─> KiteController.update() — intégrer forces → vitesse → position
       │    │    ├─> integratePhysics() — F=ma, T=Iα (lois de Newton)
       │    │    ├─> ConstraintSolver.enforceLineConstraints() — PBD
       │    │    ├─> ConstraintSolver.enforceBridleConstraints() — PBD
       │    │    └─> ConstraintSolver.enforceGroundConstraint() — empêcher pénétration du sol
       │    └─> state.velocity modifiée par les contraintes (retour PBD)
       ├─> updateControlLines() — mises à jour visuelles des lignes
       ├─> RenderManager.render() — rendu Three.js
       └─> UIManager.update() — mises à jour du HUD
```

**Points critiques :**
- **Les lignes et brides sont des contraintes PBD, PAS des générateurs de force**
- Les tensions sont calculées uniquement pour la visualisation
- Les forces proviennent de : aérodynamique + gravité
- ConstraintSolver s'exécute APRÈS l'intégration des forces pour appliquer les contraintes de distance

### Abstractions Fondamentales

**Pattern StructuredObject** (`src/core/StructuredObject.ts`) :
- Tous les objets 3D étendent `StructuredObject` (qui étend `Node3D`)
- Doivent implémenter : `definePoints()`, `buildStructure()`, `buildSurfaces()`
- Utilise des **points anatomiques nommés** (ex: "NEZ", "CTRL_GAUCHE", "tip", "center")
- Points stockés dans `Map<string, THREE.Vector3>`, accessibles via `getPoint(name)`

**Pattern Factory** :
- `FrameFactory` : Crée les structures rigides (cylindres entre points nommés)
- `SurfaceFactory` : Crée les matériaux et maillages
- `LineFactory` : Crée les instances de lignes physiques
- `BridleFactory` : Crée 6 instances de lignes de bride (3 gauches + 3 droites)
- `PointFactory` : Calcule les points anatomiques du kite incluant les attaches de brides

## Structure des Modules

```
src/
├── main.ts                    # Point d'entrée de l'application
├── simulation.ts              # Shim de compatibilité → SimulationApp
├── core/                      # Classes fondamentales (Node3D, StructuredObject, Primitive)
├── base/                      # Patterns BaseFactory
├── factories/                 # Création d'objets (Frame, Surface, Line, Point, Bridle)
├── objects/
│   ├── organic/Kite.ts        # Modèle 3D principal du kite
│   └── mechanical/Line.ts     # Entité ligne (données pures, pas de logique)
├── simulation/
│   ├── SimulationApp.ts       # Orchestrateur principal (FICHIER CRITIQUE)
│   ├── physics/               # PhysicsEngine, WindSimulator, LineSystem, BridleSystem,
│   │                          # AerodynamicsCalculator, ConstraintSolver
│   ├── controllers/           # KiteController, ControlBarManager, InputHandler
│   ├── rendering/             # RenderManager, DebugRenderer
│   ├── config/                # SimulationConfig, PhysicsConstants, KiteGeometry
│   ├── ui/                    # UIManager
│   └── types/                 # WindTypes, PhysicsTypes, BridleTypes
└── types/index.ts             # TYPES CENTRALISÉS (les changements ont un impact large)
```

## Règles Critiques de Développement

### 1. Standards de Code Propre

1. **Un seul niveau d'indentation** par fonction dans la mesure du possible—préférer les retours anticipés
2. **Éviter `else`** quand une clause de garde suffit
3. **Encapsuler les primitives du domaine** dans de petites classes/types (exception : math/coords Three.js)
4. **Noms descriptifs**, éviter les abréviations (sauf Three.js courants : `pos`, `rot`)
5. **Petites micro-classes** avec responsabilité unique

### 2. Principes Physiques

**Les brides sont un système d'ajustement d'angle, PAS des éléments porteurs.**

Comme des câbles qui ajustent l'angle d'une voile de bateau : elles orientent la surface, ne portent pas la charge.

```
Brides plus courtes → CTRL plus proche de NEZ → Angle d'attaque plus faible → Moins de portance
Brides plus longues → CTRL plus loin de NEZ → Angle d'attaque plus élevé → Plus de portance
```

**Critique** : Les brides ne TIRENT PAS, elles CONTRAIGNENT à une distance maximale. L'équilibre dépend de la **géométrie imposée** par les brides (qui détermine l'angle d'attaque), pas des forces internes.

### 3. Modèle de Vol du Kite

Le kite vole sur la surface d'une sphère définie par :
```
R = Longueur Ligne + Longueur Bride
```

Quand la barre de contrôle est tournée :
1. Une ligne se raccourcit, l'autre s'allonge (contrôle différentiel)
2. Ceci déplace asymétriquement les points CTRL dans l'espace 3D
3. Ceci change la géométrie et l'angle d'attaque de chaque moitié du kite
4. Le côté avec un AOA plus élevé génère plus de portance
5. Cette force asymétrique crée un moment de rotation
6. Le kite tourne et se déplace tangentiellement sur la sphère de vol

En position neutre de la barre, le kite recherche le zénith (haut de la sphère) où l'AOA se minimise et la tension chute.

## Fichiers Critiques

**Les changements sur ces fichiers affectent toute l'application :**
- `src/simulation/SimulationApp.ts` — orchestrateur central, tous les systèmes y sont connectés
- `src/simulation/physics/PhysicsEngine.ts` — cœur de la boucle physique
- `src/types/index.ts` — les changements de types globaux ont un impact large
- `vite.config.ts` & `tsconfig.json` — les alias de chemins doivent rester synchronisés
- `src/core/StructuredObject.ts` — classe de base pour tous les objets 3D
- `src/objects/organic/Kite.ts` — géométrie du kite et points anatomiques

## Contrôles

- **Touches ↑↓** : Tourner la barre de contrôle
- **Souris** : Orbiter autour de la caméra
- **R** : Réinitialiser la simulation
- **Curseurs UI** : Ajuster les longueurs de brides en temps réel (0.30-0.80m)

## Contexte Technique Récent

**Branche actuelle :** `feature/nouvelle-approche-damping`
**Branche principale :** `main`

Travaux récents incluent :
- Brides implémentées comme 6 contraintes PBD physiques (BridleSystem.ts)
- Calcul de surface corrigé (KiteGeometry.calculateTriangleArea)
- Surface totale : 0.5288 m² (réduction de 22% par rapport aux valeurs codées en dur précédentes)
- Les forces aérodynamiques utilisent maintenant les surfaces géométriques exactes des sommets

**Mettre à jour ce fichier** si vous modifiez l'architecture, les conventions ou les workflows majeurs.
