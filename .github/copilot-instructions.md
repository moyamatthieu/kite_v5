
# Kite Simulator - AI Agent Instructions

## Repository Overview

**Kite Simulator** is an autonomous web-based kite physics simulation built with TypeScript and Three.js. It simulates realistic kite flight dynamics using emergent physics-based behavior—no scripted animations. 
Modélisation du Comportement Aérodynamique et Cinématique d'une Aile de Kite
L'objet de cette analyse est de décrire le comportement cinématique et aérodynamique d'une aile de kite (ou voile de traction) modélisée comme une structure tridimensionnelle rigide.

Structure et Déplacements Contraints
L'aile de kite est conceptualisée comme une entité non déformable, composée d'une ossature (les frames ou lattes) et de surfaces porteuses rigides. Sous l'effet des forces aérodynamiques générées par le vent, cette structure est mise en mouvement jusqu'à ce qu'elle atteigne les limites imposées par la géométrie du système de liaison avec le pilote.

Ces limites sont strictement définies par la longueur totale des lignes de vol et des brides (les lignes de connexion entre les lignes de vol et l'aile elle-même). Une fois cet allongement maximal atteint, le système de lignes et de brides est entièrement tendu, définissant la frontière de l'espace de vol accessible à l'aile.

La Sphère de Vol et le Mouvement Latéral
L'aile est alors constamment plaquée contre cette frontière par la pression continue du vent. Géométriquement, l'espace de vol est donc une calotte sphérique dont le rayon R est égal à la somme de la longueur des lignes de vol et de celle des brides. L'aile évolue ainsi sur la surface de cette sphère de vol de rayon :

R=Longueur des Lignes+Longueur des Brides
L'effet aérodynamique fondamental est généré par l'inclinaison des surfaces de l'aile (son angle d'attaque et l'angle de site par rapport au vent). Cette inclinaison, conjuguée à la contrainte de distance maximale imposée par les lignes, génère une force latérale (composante propulsive ou de portance) qui ne peut se traduire que par un déplacement tangentiel sur la sphère de vol. L'aile se déplace ainsi dans son propre plan "vers l'avant" (perpendiculairement à la direction des lignes vers le pilote), décrivant un arc sur la surface de la sphère.

Point d'Équilibre (Zénith)
Lorsque la barre de contrôle est relâchée ou maintenue en position neutre, le kite tend à trouver un point d'équilibre dynamique. Ce point correspond généralement au zénith de la sphère de vol (le point le plus haut par rapport au pilote, idéalement au-dessus de sa tête).

À ce point d'équilibre supérieur, l'inclinaison des surfaces portantes de l'aile par rapport au vent relatif (qui est alors plus horizontal) devient minimale, se rapprochant de l'horizontale (ou d'un angle d'attaque très faible). Par conséquent, la force aérodynamique totale et la pression du vent exercée sur ces surfaces diminuent drastiquement, permettant au kite de se stabiliser avec une traction minimale. C'est la position de "repos" ou de sécurité relative.

Mécanisme de Direction par la Barre de Contrôle
L'action du pilote sur la barre n'est pas simplement une déviation, mais une modification asymétrique de la géométrie de l'aile.

1. Déclenchement des virage
Lorsque le pilote tire ou pousse sur un côté de la barre de contrôle (une action appelée "barre à droite" ou "barre à gauche"), il provoque une variation différentielle de la longueur des lignes arrière (lignes de direction) connectées aux extrémités (ou aux tips) de l'aile.

Ligne deplacé en arriere : La ligne tire et deplace le Ctrl correspondant en arriere.

Ligne deplacé en avant : Simultanément, la ligne du côté opposé se deplace et deplace en avant le Ctrl.

2. Modification de l'Angle d'Attaque (Twist)
Cette asymétrie de tension a pour effet de deplacer la structure dans l'espace 3d, provoquant une modification des force sur les faces ce qui change l'equilibre et entraine une rotation.



3. Création d'un Couple Aérodynamique
L'augmentation de l'angle d'attaque sur le côté tiré entraîne une augmentation significative des forces aérodynamiques générées sur cette demi-aile (principalement la force de portance).

L'aile génère plus de traction (portance et traînée induite) sur le côté où l'AOA est accru.

Cette dissymétrie de force entre les deux moitiés de l'aile crée un couple de rotation (ou moment de lacet) autour de son centre de gravité, forçant l'aile à pivoter sur la sphère de vol dans la direction du côté tiré.

4. Conséquence Cinématique
La rotation de l'aile réoriente son axe de vol. L'aile commence alors à se déplacer selon une trajectoire courbe sur la sphère de vol, obéissant à la nouvelle direction induite par l'asymétrie de portance. La vitesse et l'amplitude de ce virage dépendent directement de l'intensité de l'action sur la barre et de l'efficacité aérodynamique de l'aile.

**Key facts:**
- Language: TypeScript (ES modules), French/English comments coexist
- Framework: Three.js v0.160.0 (pinned—API changes may break code)
- Build: Vite dev server on http://localhost:3001
- Size: ~30 source files, modular architecture
- Physics: Position-Based Dynamics (PBD), emergent behavior only

## Essential Commands

**ALWAYS run `npm install` before any build or dev command.**

```bash
npm install          # Install dependencies (ALWAYS first)
npm run dev # Le serveur de développement est **déjà actif** en arrière-plan sur le port 3001. **NE PAS relancer** cette commande.
npm run build        # Build production bundle
npm run preview      # Preview production build

```

**Notes:**
- Dev server uses port 3001 (see `vite.config.ts`)
- Check availability: `curl http://localhost:3001` before starting second instance
- Bundle size warnings (>500KB) are expected due to Three.js

## Path Aliases (MANDATORY)

Configured in **both** `vite.config.ts` and `tsconfig.json`. **Breaking these will break most imports.**

```typescript
@/*          → src/*
@core/*      → src/core/*
@base/*      → src/base/*
@objects/*   → src/objects/*
@factories/* → src/factories/*
@types       → src/types/index  // Note: no trailing /*
```

Always use aliases in imports—never use relative paths like `../../types`.

## Architecture Overview

### Data Flow (60 FPS simulation loop)

```
main.ts
  └─> Simulation (SimulationApp.ts) — central orchestrator
       ├─> PhysicsEngine.update(deltaTime, barRotation)
       │    ├─> ControlBarManager.setRotation() — smooth bar rotation
       │    ├─> WindSimulator.getApparentWind() — wind + turbulence - kite velocity
       │    ├─> AerodynamicsCalculator.calculateForces() — lift/drag/torque by surface
       │    ├─> LineSystem.calculateLineTensions() — tension values (display only)
       │    ├─> BridleSystem.calculateBridleTensions() — bridle tensions (display only)
       │    ├─> kite.updateBridleVisualization() — color bridles by tension
       │    ├─> KiteController.update() — integrate forces → velocity → position
       │    │    ├─> integratePhysics() — F=ma, T=Iα (Newton's laws)
       │    │    └─> ConstraintSolver.enforceLineConstraints() — PBD line length
       │    │    └─> ConstraintSolver.enforceBridleConstraints() — PBD bridle length
       │    │    └─> ConstraintSolver.enforceGroundConstraint() — prevent ground penetration
       │    └─> state.velocity modified by constraints (PBD feedback)
       ├─> updateControlLines() — visual line updates
       ├─> RenderManager.render() — Three.js rendering
       └─> UIManager.update() — HUD updates (position, velocity, tensions)
```

**Critical insights:** 
- `PhysicsEngine.update()` orchestrates all physics, called 60 times/second
- **Tensions are for display only** — lines/bridles are PBD constraints, not force generators
- Forces come from: aerodynamics + gravity (lines/bridles only constrain geometry)
- ConstraintSolver runs AFTER force integration to enforce distance constraints

### Core Abstractions

**StructuredObject pattern** (see `src/core/StructuredObject.ts`):
- All 3D objects extend `StructuredObject` (which extends `Node3D`)
- Must implement: `definePoints()`, `buildStructure()`, `buildSurfaces()`
- Use **named anatomical points** (e.g., "tip", "center", "left_wing") for positioning
- Points stored in `Map<string, THREE.Vector3>`, accessible via `getPoint(name)`
- Example: `src/objects/organic/Kite.ts` defines 12 anatomical points

**Node3D** (`src/core/Node3D.ts`):
- Godot-compatible abstraction over `THREE.Group`
- Provides tree structure and lifecycle hooks

**Factory pattern**:
- `FrameFactory`: Creates structural frames (cylinders between named points)
- `SurfaceFactory`: Creates materials and meshes
- `LineFactory`: Creates physical line instances (used by LineSystem)
- `BridleFactory`: Creates 6 bridle line instances (3 left + 3 right)
- `PointFactory`: Calculates all kite anatomical points including bridle attachment points
- Factories preserve naming conventions and consistent object creation

### Module Structure

```
src/
├── main.ts                    # App entry point
├── simulation.ts              # Compatibility shim → SimulationApp
├── core/                      # Foundation classes (Node3D, StructuredObject, Primitive)
├── base/                      # BaseFactory patterns
├── factories/                 # Object creation (Frame, Surface, Line, Point, Bridle)
├── objects/
│   ├── organic/Kite.ts        # Main kite 3D model (StructuredObject example)
│   └── mechanical/Line.ts     # Line entity (pure data, no logic)
├── simulation/
│   ├── SimulationApp.ts       # Main orchestrator (CRITICAL FILE)
│   ├── physics/               # PhysicsEngine, WindSimulator, LineSystem, BridleSystem,
│   │                          # LinePhysics, AerodynamicsCalculator, ConstraintSolver
│   ├── controllers/           # KiteController, ControlBarManager, InputHandler
│   ├── rendering/             # RenderManager, DebugRenderer
│   ├── config/                # SimulationConfig, PhysicsConstants, KiteGeometry
│   ├── ui/                    # UIManager
│   └── types/                 # WindTypes, PhysicsTypes, BridleTypes
└── types/index.ts             # CENTRALIZED TYPES (changes are wide-reaching)
```

## Critical Development Rules

### 1. Clean Code Standards (As Applied Here)

1. **One level of indentation** per function where feasible—prefer early returns
2. **Avoid `else`** when a guard clause suffices
3. **Wrap domain primitives** in small classes/types (exception: Three.js math/coords)
4. **Descriptive names**, avoid abbreviations (except common Three.js short names like `pos`, `rot`)
5. **Small micro-classes** with single responsibility (see `Line.ts` as pure data object)

### 2. Sequential Thinking for Non-Trivial Tasks (REQUIRED)

- Decompose tasks, form hypotheses, verify, iterate

## Critical Files & Dependencies

**Files requiring special attention:**
- `src/simulation/SimulationApp.ts` — changes affect whole app (central orchestrator)
- `src/simulation/physics/PhysicsEngine.ts` — physics loop heart, all subsystems wired here
- `src/types/index.ts` — global type changes are wide-reaching
- `vite.config.ts` & `tsconfig.json` — keep path aliases synchronized
- `src/core/StructuredObject.ts` — base class for all 3D objects

## Controls

- **↑↓ Arrow Keys**: Rotate control bar (smooth interpolation)
- **Mouse**: Orbit camera around scene
- **R**: Reset simulation to initial state
- **UI Sliders**: Adjust bridle lengths in real-time (NEZ: 0.30-0.80m, INTER/CENTRE: 0.30-0.80m)

## Recent Work & Technical Context

**Current branch:** `feature/tension-forces-physics` (bridle physics implementation)
**Latest merged:** Bridles implemented as 6 physical lines (PBD constraints)
- See `docs/BRIDLES_AS_LINES_DESIGN.md`
- New: `BridleSystem.ts`, `BridleTypes.ts` in `src/simulation/physics/`
- Each bridle is a `Line` instance with its own tension calculation
- **BridleFactory** creates bridles with proper physics parameters (length, stiffness, damping)
- **ConstraintSolver.enforceBridleConstraints()** enforces 6 bridle distance constraints
- Bridle tensions calculated for visualization only (colored by tension)

**Recent fix:** Surface area calculation corrected (Oct 2025)
- Previous: hardcoded values (0.68 m² total, 47% error on upper triangles)
- Current: `KiteGeometry.calculateTriangleArea()` computes exact areas from vertices
- New total: 0.5288 m² (22% reduction from incorrect values)
- Impact: Aerodynamic forces now physically accurate
- See `CHANGELOG_surfaces.md` for validation details
current development tasks and testing checklist


**Role of bridles**: They are an **angle adjustment system**, NOT load-bearing elements!

Like cables that adjust the angle of a boat sail: they don't carry the load, they **orient** the surface to receive the wind correctly.

**Changing bridle lengths**:
```
Shorter bridles → CTRL closer to NEZ → Lower angle of attack → Less lift
Longer bridles → CTRL farther from NEZ → Higher angle of attack → More lift
```

**Critical**: Bridles DON'T pull, they RETAIN at maximum distance. Equilibrium depends on the **geometry imposed** by bridles (which determines angle of attack), not on internal forces.


**Update this file** if you modify architecture, conventions, or major workflows.



