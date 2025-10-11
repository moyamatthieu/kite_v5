# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kite Simulator V8** - A physics-based kite simulation using Entity-Component-System (ECS) architecture. This is a TypeScript/Three.js project simulating a delta kite with realistic aerodynamics, bridle systems, control lines, and wind physics.

## Development Commands

### Essential Commands
- **`npm run type-check`** - Verify TypeScript types (use this frequently)
- **`npm run lint`** - Check code style
- **`npm run lint:fix`** - Auto-fix linting issues
- **`npm run build`** - Build for production
- **`npm run preview`** - Preview production build

### ⚠️ CRITICAL: Do NOT Run Dev Server
**NEVER run `npm run dev`** - The user always has a Vite dev server running in the background. The browser auto-reloads on file changes.

### Testing Commands
- `npm run test-ecs` - Test ECS integration
- `npm run validate-migration` - Validate architecture migration

## Architecture

### Pure ECS Architecture

The project follows a strict Entity-Component-System pattern currently undergoing migration to pure ECS:

**Core Concepts:**
- **Entities** (`src/simulation/entities/`): Containers with unique IDs holding components (no logic)
- **Components** (`src/simulation/components/`): Pure data structures (TransformComponent, PhysicsComponent, MeshComponent)
- **Systems** (`src/simulation/systems/`): Logic processors that operate on entities with specific components
- **EntityManager**: Central registry for creating, querying, and managing entities

**Key Systems:**
- `KitePhysicsSystem` - Complete kite physics (aerodynamics, constraints, bridle system, wind simulation)
- `InputSystem` - User input with smoothing
- `ControlBarSystem` - Control bar rotation and handle positions (ECS)
- `RenderSystem` - Three.js rendering orchestration
- `LinesRenderSystem` - Renders control lines with catenary curves
- `PilotSystem` - Manages pilot entity

**IMPORTANT - Removed Systems (2025-10-11 cleanup):**
- ~~`PhysicsSystem`~~ - **REMOVED** (was unused, all physics handled by KitePhysicsSystem)
- ~~`WindSystem`~~ - **REMOVED** (was unused, wind handled by WindSimulator in KitePhysicsSystem)
- See `ARCHITECTURE_CLEANUP_SUMMARY.md` for details

**System Lifecycle:**
1. `initialize()` - Setup (called once)
2. `update(context)` - Per-frame logic with SimulationContext (deltaTime, totalTime, isPaused, debugMode)
3. `reset()` - Return to initial state
4. `dispose()` - Cleanup resources

### Physics Architecture - Emergent Behavior

The simulator uses a **physics-first, emergent behavior** approach:

**Key Physics Modules** (`src/simulation/physics/`):
- `PhysicsEngine` - Orchestrates all physics calculations
- `AerodynamicsCalculator` - Lift, drag, and torque from wind
- `LineSystem` - Control line tensions (constraints, not forces)
- `BridleSystem` - Internal kite bridle tensions (constraints)
- `ConstraintSolver` - Position-Based Dynamics (PBD) for geometric constraints
- `WindSimulator` - Wind field with turbulence
- `VelocityCalculator` - Apparent wind calculations

**Critical Physics Principles:**
1. **Lines are constraints, not forces** - Lines constrain distance but don't "push" or "pull"
2. **Distributed forces** - Aerodynamics and gravity calculated per surface, creating emergent torque
3. **Emergent orientation** - Kite orientation emerges from force distribution + constraints, not scripted behavior
4. **Position-Based Dynamics** - Constraints solved geometrically after physics integration

**Physics Flow (60 FPS):**
```
Input → ControlBar rotation → Handle positions →
Apparent wind (wind - kite velocity) →
Aerodynamic forces (lift, drag, torque) + Gravity →
Physics integration (F=ma, τ=Iα) →
Constraint solving (lines, bridles) →
Render
```

### Kite Object Architecture

**Kite structure** (`src/objects/Kite.ts`):
- Extends `StructuredObject` from `src/core/`
- Uses Factory pattern for geometry creation:
  - `PointFactory` - Anatomical points (NEZ, CTRL_GAUCHE, CTRL_DROIT, etc.)
  - `FrameFactory` - Carbon frame structure
  - `SurfaceFactory` - Sail panels
- Central `pointsMap` stores all anatomical positions
- Bridle system with 6 lines (3 per side: nez, inter, centre)

**Key Kite Methods:**
- `setBridleLengths(lengths)` - Adjust physical bridle lengths, rebuilds geometry
- `toWorldCoordinates(localPos)` - Transform local points to world space
- `updateBridleVisualization(tensions)` - Color-code bridles by tension (green→yellow→red)

### Configuration System

**Centralized config** (`src/simulation/config/SimulationConfig.ts`):
- `CONFIG` object - Single source of truth for all simulation parameters
- `KiteGeometry.ts` - Geometry calculations (mass, inertia, area)
- `PhysicsConstants.ts` - Physical limits and tolerances

**Key config sections:**
- `CONFIG.physics` - Gravity, air density, damping
- `CONFIG.aero` - Lift/drag scales
- `CONFIG.kite` - Mass, inertia (auto-calculated), area
- `CONFIG.bridle` - Default bridle lengths
- `CONFIG.lines` - Line stiffness, tension limits
- `CONFIG.wind` - Wind parameters
- `CONFIG.controlBar` - Bar dimensions and position
- `CONFIG.input` - Input smoothing, rotation limits

### Path Aliases

**Always use path aliases** (never deep relative paths):
```typescript
import { Kite } from '@/objects/Kite'
import { BaseSimulationSystem } from '@core/BaseSimulationSystem'
import { FrameFactory } from '@factories/FrameFactory'
import { WindConfig } from '@types'
```

**Available aliases:**
- `@/*` → `src/*`
- `@core/*` → `src/core/*`
- `@base/*` → `src/base/*`
- `@objects/*` → `src/objects/*`
- `@factories/*` → `src/factories/*`
- `@types` → `src/types/index`

## Code Style & Patterns

### Critical Rules from .github/copilot-instructions.md

**Refactoring:**
- **Progressive, incremental refactoring only** - Small atomic changes, validate each step
- After each change: run `type-check`, `lint`, test manually in browser
- NEVER massive refactors - minimize regression risk

**Clean Code:**
- Short functions with early returns (avoid `else`)
- Avoid magic numbers - use `CONFIG` constants
- One indentation level per function when possible
- Explicit naming (`applyConstraint`, `apparentWind`, not `process`, `calc`)
- Comment complex sections concisely

**ECS Principles:**
- Keep architecture clean
- Respect SOLID principles
- Validate every change with automated tools

**Specific to Kite Simulator:**
- Lines/bridles are constraints, never apply forces directly
- Adjust geometry or constraints, not direct forces
- Use `DebugRenderer` or `RenderSystem.createHelper*` for debug visualization (don't access Three.js scene directly)

### Import Order
1. External libraries (`import * as THREE from 'three'`)
2. Core/base classes (`@core`, `@base`)
3. Types (`@types`)
4. Utilities (`@/utils`)
5. Components, systems, entities
6. Local files

## Project Structure

```
src/
├── base/           - Base classes (BaseSimulationSystem, BaseComponent, BaseFactory)
├── core/           - Core framework (StructuredObject, Primitive)
├── factories/      - Factory pattern for object creation
│   └── presets/    - Physical presets
├── objects/        - 3D objects (Kite extends StructuredObject)
├── simulation/     - Main simulation code
│   ├── components/ - ECS components (TransformComponent, PhysicsComponent, MeshComponent)
│   ├── config/     - Configuration (SimulationConfig, KiteGeometry, PhysicsConstants)
│   ├── controllers/- Legacy controllers being migrated (KiteController, ControlBarManager, InputHandler)
│   ├── entities/   - ECS entities (Entity, EntityManager, LineEntity, PilotEntity)
│   ├── physics/    - Physics modules (AerodynamicsCalculator, LineSystem, WindSimulator, etc.)
│   ├── rendering/  - Rendering (RenderManager, DebugRenderer)
│   ├── systems/    - ECS systems (KitePhysicsSystem, InputSystem, RenderSystem, etc.)
│   ├── types/      - TypeScript types
│   └── ui/         - UI (UIManager)
├── types/          - Shared TypeScript types
└── utils/          - Utilities (MathUtils, Logging, GeometryUtils)
```

## Migration Context

**Current Branch:** `refactor/pure-ecs-architecture`

The project is migrating from hybrid architecture to pure ECS. Recent changes:
- ControlBar migrated to ECS (ControlBarSystem + Entity)
- InputSystem smoothing moved to ControlBarSystem
- LinesRenderSystem created for line rendering
- PilotSystem and PilotEntity added

**Migration Pattern:**
1. Create entity class if needed (extends Entity)
2. Create/reuse components (Transform, Mesh, Physics)
3. Create system (extends BaseSimulationSystem)
4. Register entity in EntityManager
5. Initialize system in SimulationApp
6. Remove legacy code

**Legacy components still in use:**
- `Kite` object (StructuredObject) - not yet migrated to pure ECS
- `KiteController` - physics state management
- Physics modules are standalone (not yet ECS systems)

## Common Tasks

### Adding a new ECS System
1. Create `src/simulation/systems/NewSystem.ts` extending `BaseSimulationSystem`
2. Implement: `initialize()`, `update(context)`, `reset()`, `dispose()`
3. Register in `SimulationApp.createSystems()`
4. Initialize in `SimulationApp.initializeSystems()`
5. Call `update()` in `SimulationApp.updateLoop()`

### Modifying Physics
1. Check `CONFIG` in `SimulationConfig.ts` first
2. Physics logic goes in `src/simulation/physics/` modules
3. Forces are calculated, constraints are solved geometrically
4. Test with `npm run type-check` after changes

### Adding Debug Visualization
- Use `DebugRenderer` (passed to systems that need it)
- Create helpers: `RenderSystem.createHelperArrow()`, etc.
- Never access `scene` directly - use system abstractions

### Adjusting Kite Behavior
- **Aerodynamics:** Modify `AerodynamicsCalculator.ts` or `CONFIG.aero`
- **Bridle lengths:** Use `kite.setBridleLengths()` - rebuilds geometry
- **Line behavior:** Modify `LineSystem.ts` or `CONFIG.lines`
- **Wind:** Modify `WindSimulator.ts` or `CONFIG.wind`

## Tips

- **Physics debugging:** Check console logs every 1 second with full state
- **Type safety:** Run `npm run type-check` frequently
- **Hot reload:** Browser auto-refreshes, no need to restart dev server
- **Bridle visualization:** Bridles color-code by tension (green=slack, yellow=medium, red=high)
- **Coordinate systems:** Use `kite.toWorldCoordinates()` to transform local → world
- **Emergent behavior:** Trust the physics - don't script behaviors, let them emerge from forces + constraints
