# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **kite flight simulator** built with TypeScript, Three.js, and a pure Entity-Component-System (ECS) architecture. The simulator models the physics of a kite connected to a control bar via lines and bridles, including aerodynamic forces (lift/drag), wind effects, line tension constraints, and 3D visualization.

The physics model is inspired by **Google's Makani project** (open-source kite energy systems).

## Core Commands

### Development
- `npm run dev` - Start Vite dev server on `http://localhost:3001` with hot reload
  - **IMPORTANT**: Never run this automatically. User must start it manually to avoid port conflicts and maintain control over the dev server lifecycle.
- `npm run type-check` - Run TypeScript type checking without emitting files
- `npm run lint` - Run ESLint static analysis on `src/**/*.ts`
- `npm run lint:fix` - Auto-fix ESLint issues

### Build & Test
- `npm run build` - Build production bundle to `dist/` directory
- `npm run preview` - Preview production build locally

## Architecture: Pure ECS

This project uses a **strict Entity-Component-System architecture**. Understanding this pattern is critical:

### Components (`src/ecs/components/`)
- **Pure data containers only** - No methods, no logic
- Must be Plain Old JavaScript Objects (POJOs) - serializable
- Examples: `PhysicsComponent`, `TransformComponent`, `AerodynamicsComponent`
- **Rule**: Never add methods or business logic to components

### Systems (`src/ecs/systems/`)
- **All simulation logic lives here**
- Each system operates on entities with specific component combinations
- Systems run in a **critical execution order** defined in `SimulationApp.ts`

#### System Execution Order (Priority)
1. **Input & Setup (1-10)**
   - `EnvironmentSystem` - 3D scene setup (lights, ground, axes)
   - `CameraControlsSystem` - Camera/OrbitControls
   - `InputSyncSystem` - Sync UI inputs to wind system
   - `BridleConstraintSystem` - Calculate control points via trilateration
   - `InputSystem` - Capture keyboard/mouse

2. **Simulation (20-50)**
   - `WindSystem` - Calculate apparent wind (ambient - kite_velocity + turbulence)
   - `AeroSystem` - Aerodynamic forces (lift/drag using NASA formulas)
   - `LineSystem` - Line constraints (SLACK/TAUT states, tension forces)
   - `PilotSystem` - Pilot input (bar movement)
   - `PhysicsSystem` - Euler integration (forces → velocity → position)

3. **Rendering (50-100)**
   - `GeometryRenderSystem` - Create Three.js meshes
   - `LineRenderSystem` - Visualize lines (color by tension)
   - `BridleRenderSystem` - Visualize bridle system
   - `DebugSystem` - Debug vectors (F5 toggle)
   - `RenderSystem` - Final Three.js render
   - `UISystem` - dat.GUI interface
   - `SimulationLogger` - Periodic logging

**When adding a new system**, insert it at the correct priority in `SimulationApp.ts:setupSystemPipeline()`.

### Entities (`src/ecs/entities/`)
- Simple identifiers with attached components
- Created via **Factory pattern** (e.g., `KiteFactory`, `LineFactory`)
- **Rule**: Never instantiate entities directly in systems - always use factories

## Physics & Aerodynamics

### Coordinate System
- **X**: Left/Right (positive = right)
- **Y**: Altitude (positive = up)
- **Z**: Depth (positive = backward, negative = forward)

### Wind System
- Formula: `Wind_apparent = Wind_ambient - Velocity_kite + Turbulence`
- Wind direction convention:
  - 0° = +X (East)
  - 90° = +Z (South)
  - 180° = -X (West)
  - 270° = -Z (North)
- Y-axis has no horizontal wind component (vertical only via turbulence)

### Aerodynamics (`AeroSystem.ts`)
- Uses **NASA flat plate aerodynamics formulas**
- Calculates lift/drag forces based on angle of attack
- Key parameters in `Config.ts:NASAAeroConfig`:
  - `CL_ALPHA_PER_DEG` - Lift coefficient slope
  - `CD0` - Parasitic drag
  - `STALL_ANGLE_DEGREES` - Stall angle (15°)

### Line Constraints (`LineSystem.ts`)
- Implements **Makani-inspired spring-damper model**
- Two states:
  - **SLACK** (distance < restLength): No force
  - **TAUT** (distance ≥ restLength): Spring force + damping
- Force calculation:
  - Spring: `F_spring = LINE_STIFFNESS × elongation`
  - Damping: `F_damp = ABSOLUTE_DAMPING × v_radial`
  - Total force applied to kite body + generates torque: `τ = r × F`

### Configuration (`src/ecs/config/Config.ts`)
- **All physical constants and magic numbers must be defined here**
- Organized into namespaces:
  - `PhysicsConstants` - Gravity, air density, epsilon
  - `KiteSpecs` - Mass, wingspan, inertia tensor
  - `LineSpecs` - Length, stiffness, damping
  - `AeroConfig` - Lift/drag coefficients
  - `EnvironmentConfig` - Wind defaults
  - `DebugConfig` - Logging, visualization

## Path Aliases (tsconfig.json & vite.config.ts)

Import paths are aliased for cleaner code:
```typescript
import { PhysicsComponent } from '@components/PhysicsComponent'
import { WindSystem } from '@systems/WindSystem'
import { CONFIG } from '@config/Config'
import { MathUtils } from '@utils/MathUtils'
```

Available aliases: `@/`, `@ecs/`, `@components/`, `@systems/`, `@entities/`, `@config/`, `@utils/`, `@mytypes/`, `@ui/`, `@rendering/`, `@core/`

## Critical Development Rules

### 1. NEVER Run `npm run dev` Automatically
- The dev server must be managed manually by the user
- Running it automatically causes port conflicts and disrupts debugging
- **Action**: Inform user to run `npm run dev` themselves

### 2. NEVER Create Markdown Documentation Files
- No `.md` files except this one and README.md
- Reason: Creates technical debt, becomes obsolete, pollutes git history
- **Alternatives**:
  - Use JSDoc/TSDoc comments in code
  - Add to this CLAUDE.md file
  - Use detailed commit messages
  - Temporary console.log() during debug (then remove)

### 3. NEVER Duplicate Code - Always Improve Existing Code
**Before adding any new function or system, search the codebase first:**
1. Use Grep/Glob to find similar implementations
2. Check `src/ecs/utils/MathUtils.ts` for math functions
3. Review existing systems for similar logic
4. Check git history (`git log`) for removed features

**Priority order:**
1. Reuse existing code as-is
2. Refactor/generalize existing code to cover more cases
3. Extend existing functions with optional parameters
4. Extract common code into shared utilities
5. Fix/improve existing implementations rather than work around bugs
6. Only create new code if absolutely necessary

**Examples**:
- ❌ Add distance calculation to `AeroSystem.ts` without checking `MathUtils.ts`
- ❌ Create new vector normalization when one exists
- ✅ Search for "normalize" before implementing normalization
- ✅ Check `MathUtils.ts` before adding math operations
- ✅ Extend existing function with optional parameter instead of duplicating

## Key Files to Understand

### Orchestration
- `src/ecs/SimulationApp.ts` - Main app, system pipeline, update loop
- `src/ecs/main.ts` - Entry point, initializes SimulationApp

### Core ECS
- `src/ecs/core/EntityManager.ts` - Entity lifecycle, queries
- `src/ecs/core/SystemManager.ts` - System registration, update loop
- `src/ecs/core/System.ts` - Base System class
- `src/ecs/core/Component.ts` - Base Component class
- `src/ecs/core/Entity.ts` - Entity class

### Physics Systems
- `src/ecs/systems/PhysicsSystem.ts` - Euler integrator (forces → motion)
- `src/ecs/systems/WindSystem.ts` - Apparent wind calculation
- `src/ecs/systems/AeroSystem.ts` - Aerodynamic forces (NASA model)
- `src/ecs/systems/LineSystem.ts` - Line tension constraints
- `src/ecs/systems/BridleConstraintSystem.ts` - Trilateration for control points

### Rendering
- `src/ecs/systems/RenderSystem.ts` - Three.js scene/camera/renderer
- `src/ecs/systems/GeometryRenderSystem.ts` - Create meshes
- `src/ecs/systems/LineRenderSystem.ts` - Line visualization
- `src/ecs/systems/DebugSystem.ts` - Debug vectors (toggle with F5)

### Configuration
- `src/ecs/config/Config.ts` - **Central configuration** (all constants here)
- `src/ecs/config/KiteGeometry.ts` - Kite shape geometry
- `src/ecs/config/KiteSurfaceDefinition.ts` - Surface mesh definition

### Utilities
- `src/ecs/utils/MathUtils.ts` - Math helpers (vectors, angles, etc.)
- `src/ecs/utils/PhysicsIntegrator.ts` - Physics integration utilities
- `src/ecs/utils/Logging.ts` - Logging system

## Development Workflow

### Adding a New Feature
1. **Plan**: Identify which systems/components are affected
2. **Search**: Check if similar functionality exists (use Grep/Glob)
3. **Design**: Respect ECS separation (data in Components, logic in Systems)
4. **Configure**: Add constants to `Config.ts` (no magic numbers in code)
5. **Implement**:
   - Create/modify components (data only)
   - Create/modify systems (logic only)
   - Add system to pipeline in correct order
6. **Test**: Use `npm run type-check` and `npm run lint`

### Debugging
- Press F5 in browser to toggle debug visualization
- Use `SimulationLogger` for periodic console output
- Check `DebugConfig` in `Config.ts` for debug settings
- Temporary `console.log()` is acceptable during debugging (remove after)

### Modifying Physics
1. Understand current model (check `Config.ts` for parameters)
2. Reference Makani implementation philosophy (force-based, explicit)
3. Update physics constants in `Config.ts` namespaces
4. Test stability with `npm run dev` (manual start)
5. Document physics changes in code comments (JSDoc)

## Common Patterns

### Querying Entities
```typescript
// In a System's update() method
const kites = context.entityManager.query(['Kite', 'Physics', 'Transform']);
for (const entity of kites) {
  const physics = entity.getComponent<PhysicsComponent>('Physics');
  const transform = entity.getComponent<TransformComponent>('Transform');
  // ... operate on components
}
```

### Accessing Configuration
```typescript
import { CONFIG, PhysicsConstants } from '@config/Config';

const gravity = PhysicsConstants.GRAVITY;
const kiteMass = CONFIG.kite.mass;
```

### Creating Entities
```typescript
// In a Factory
import { Entity } from '@core/Entity';
import { KiteComponent } from '@components/KiteComponent';
import { PhysicsComponent } from '@components/PhysicsComponent';

export class KiteFactory {
  static create(position: Vector3): Entity {
    const entity = new Entity('kite');
    entity.addComponent(new KiteComponent());
    entity.addComponent(new PhysicsComponent(mass, inertia));
    // ... more components
    return entity;
  }
}
```

## Important Notes

- **No Makani source code in repository**: The physics model is *inspired by* Makani, but does not include their actual code. Reference their approach (force-based constraints, explicit spring-damper models) when implementing physics.

- **Type Safety**: TypeScript strict mode is enabled. Use proper types, avoid `any`.

- **Performance**: Simulation runs at 60 FPS. Keep system `update()` methods efficient.

- **Three.js**: Uses v0.160.0. Coordinate system matches Three.js conventions.

- **Vite**: Module bundler with HMR. Path aliases defined in `vite.config.ts` must match `tsconfig.json`.

## Project Conventions

- **File naming**: PascalCase for classes (e.g., `PhysicsSystem.ts`), camelCase for utilities
- **Component suffix**: All component classes end with `Component`
- **System suffix**: All system classes end with `System`
- **Factory suffix**: All factory classes end with `Factory`
- **Imports**: Use path aliases, keep imports organized (external → internal → local)
- **Comments**: Use JSDoc for public APIs, inline comments for complex logic
- **Constants**: UPPER_SNAKE_CASE for constants in `Config.ts`

## Testing & Quality

- Type checking: `npm run type-check` (no `--noEmit` warnings/errors)
- Linting: `npm run lint` (ESLint rules for TypeScript)
- Build: `npm run build` (must succeed without errors)

## Language
The codebase uses a mix of English and French:
- **Code**: English (variables, functions, classes)
- **Comments**: Primarily French
- **UI**: French
- **This file**: English

When adding code, prefer English for identifiers and JSDoc. French inline comments are acceptable for consistency with existing code.
