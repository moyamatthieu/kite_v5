
# Kite Simulator - AI Agent Instructions

## Repository Overview

**Kite Simulator** is an autonomous web-based kite physics simulation built with TypeScript and Three.js. It simulates realistic kite flight dynamics using emergent physics-based behavior—no scripted animations. This is a standalone version extracted from a larger project, designed to be lightweight and self-contained.

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
npm run dev          # Start dev server (primary dev command)
npm run build        # Build production bundle
npm run preview      # Preview production build
./test.sh            # Quick test script with usage info
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

### 1. Physics-Based Behavior ONLY (MANDATORY)

**Pas de comportements scriptés:** Never implement hard-coded or animated "tricks". Everything must emerge from the physics system:
- Collisions, wind forces, force differences, constraints, local interactions
- Favor physical rules and solvers (constraint, dynamics, aerodynamics) over procedural scripts
- Example: Kite rotation emerges from differential tensions in left/right lines, not scripted animation

**Understanding PBD (Position-Based Dynamics):**
- Lines and bridles are **constraints**, not force generators
- They enforce maximum distance between attachment points
- `ConstraintSolver` applies geometric corrections AFTER force integration
- Tension values are calculated for display/debug only (they don't apply forces)
- Actual forces come from: aerodynamics (lift/drag) + gravity only

### 2. Clean Code Standards (As Applied Here)

1. **One level of indentation** per function where feasible—prefer early returns
2. **Avoid `else`** when a guard clause suffices
3. **Wrap domain primitives** in small classes/types (exception: Three.js math/coords)
4. **Descriptive names**, avoid abbreviations (except common Three.js short names like `pos`, `rot`)
5. **Small micro-classes** with single responsibility (see `Line.ts` as pure data object)

### 3. Sequential Thinking for Non-Trivial Tasks (REQUIRED)

- Decompose tasks, form hypotheses, verify, iterate
- Document reasoning briefly in PR/commit messages (2-5 lines)
- Provide at least **1 test/validation** or `npm run build` verification before considering tasks complete

## Critical Files & Dependencies

**Files requiring special attention:**
- `src/simulation/SimulationApp.ts` — changes affect whole app (central orchestrator)
- `src/simulation/physics/PhysicsEngine.ts` — physics loop heart, all subsystems wired here
- `src/types/index.ts` — global type changes are wide-reaching
- `vite.config.ts` & `tsconfig.json` — keep path aliases synchronized
- `src/core/StructuredObject.ts` — base class for all 3D objects

**Dependencies:**
- `three@0.160.0` — **pinned version**, API changes across versions may break code
- `three-bvh-csg@0.0.17` — advanced geometry operations

## Validation Before Submitting Changes

1. `npm install`
2. `npm run build` — must complete without TypeScript errors
3. `npm run dev` — verify server starts on http://localhost:3001
4. **Smoke test controls:** ↑↓ arrow keys (rotate bar), mouse orbit, R key (reset)
5. Verify path aliases resolve (no relative paths replacing aliases)
6. **Keep French in comments where present**

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

**Available documentation** (check before major physics changes):
- `docs/LINE_PHYSICS_AUDIT_2025-10-01.md` — line physics analysis
- `docs/DAMPING_AUDIT_2025-10-01.md` — damping system analysis  
- `docs/OOP_LINE_ARCHITECTURE.md` — line system architecture
- `docs/AUTO_MASS_CALCULATION.md` — mass distribution
- `docs/BRIDLES_CONFIGURATION.md` — **guide de configuration des brides** (NEW)
- `docs/TENSION_FORCES_DESIGN.md` — **mécanisme de plaquage et physique PBD** (NEW)
- `CHANGELOG_surfaces.md` — surface area correction details
- `TODO_TENSION_FORCES.md` — current development tasks and testing checklist

## Critical Concept: Plaquage (Pressing Against Constraints)

**FUNDAMENTAL UNDERSTANDING** for bridles and lines physics:

The kite behaves as a **rigid object pressed against a geometric cage**:

```
1. Rigid structure (Kite.ts) → FIXED geometry defined by anatomical points
2. Wind applies aerodynamic forces → PUSHES the rigid structure in all directions
3. PBD constraints define a GEOMETRIC CAGE
   ├─> Main lines: EXACT distance (= lineLength)
   └─> Bridles: MAXIMUM distance (<= bridleLength)
        ├─> Bridle NEZ: CTRL at max 0.68m from NEZ
        ├─> Bridle INTER: CTRL at max 0.50m from INTER
        └─> Bridle CENTRE: CTRL at max 0.50m from CENTRE
        → Intersection of 3 spheres = UNIQUE position of CTRL
4. Kite PRESSES against these limits
   └─> Equilibrium = position where wind cannot push kite beyond limits
       (all geometric constraints are saturated)
```

**Analogy**: Inflated balloon in a rigid cage
- Balloon (wind) pushes in all directions
- Cage (bridles + lines) defines geometric limits
- Balloon presses against bars
- Final shape = intersection between push and constraints

**Role of bridles**: They are an **angle adjustment system**, NOT load-bearing elements!

Like cables that adjust the angle of a boat sail: they don't carry the load, they **orient** the surface to receive the wind correctly.

**Changing bridle lengths**:
```
Shorter bridles → CTRL closer to NEZ → Lower angle of attack → Less lift
Longer bridles → CTRL farther from NEZ → Higher angle of attack → More lift
```

**Critical**: Bridles DON'T pull, they RETAIN at maximum distance. Equilibrium depends on the **geometry imposed** by bridles (which determines angle of attack), not on internal forces.

## When to Search the Codebase

**Trust these instructions first.** Search only when:
- Instructions are incomplete for your specific task
- You encounter an error not covered here
- You need to understand a specific pattern not documented above

**Common inspection points:**
- `src/simulation/SimulationApp.ts` (main orchestration)
- `src/simulation/physics/PhysicsEngine.ts` (physics loop)
- `src/core/StructuredObject.ts` (3D object base pattern)
- `src/objects/organic/Kite.ts` (StructuredObject example)
- `src/objects/mechanical/Line.ts` (pure data entity pattern)

---

**Update this file** if you modify architecture, conventions, or major workflows.



