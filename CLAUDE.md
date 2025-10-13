# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kite Simulator V8** - A physics-based kite simulation using TypeScript, Three.js, and Vite. The project simulates a delta kite with realistic aerodynamics, bridling system, control lines, and wind physics using an Entity-Component-System (ECS) architecture.

**Current Version**: V8 (migrating to pure ECS architecture)
**Active Branch**: `clean-code-refactor-autonomous`
**Language**: French comments/documentation, English code/variables

## Development Commands

### Essential Commands
```bash
npm install                    # Install dependencies
npm run dev:debug             # Start development server with logging
npm run type-check            # TypeScript type checking (run frequently)
npm run lint                  # Code style checking
npm run lint:fix              # Fix linting issues automatically
npm run build                 # Production build
npm run preview               # Preview production build
```

### Critical Development Setup
- **NEVER run `npm run dev`** - Always use `npm run dev:debug`
- The `dev:debug` script handles Chrome browser opening and logging via Playwright
- Server runs on port 3003 (configured in vite.config.ts)
- Vite config has `open: false` to prevent multiple browser instances
- The dev server auto-reloads on file changes

### Testing Commands
```bash
npm run test-ecs              # Test ECS integration
npm run validate-migration    # Validate architecture migration
```

## Architecture

### ECS (Entity-Component-System) Pattern
The project follows strict ECS architecture:

**Core ECS Concepts:**
- **Entities** (`src/simulation/entities/`): ID containers with components (no logic)
- **Components** (`src/simulation/components/`): Pure data structures (Transform, Physics, Mesh, Kite)
- **Systems** (`src/simulation/systems/`): Logic processors operating on entities with specific components
- **EntityManager**: Central registry for entity creation, querying, and management
- **Entity Factories** (`src/simulation/factories/`): Factory pattern for complex entity creation

**Key Systems (execution order):**
1. `InputSystem` - Keyboard/mouse input capture
2. `ControlBarSystem` - Control bar rotation and handle positions
3. `KitePhysicsSystem` - Complete physics simulation (aerodynamics, constraints, wind)
4. `PilotSystem` - Pilot entity management
5. `LinesRenderSystem` - Catenary line rendering
6. `RenderSystem` - Final scene rendering

**Physics Architecture (src/simulation/physics/):**
- `AerodynamicsCalculator` - Lift, drag, and torque from wind (distributed surface forces)
- `LineSystem` - Control line tensions (constraints, not forces)
- `BridleSystem` - Bridle line tensions (constraints, not forces)
- `ConstraintSolver` - Position-Based Dynamics (PBD) for geometric constraints
- `WindSimulator` - Wind field with turbulence
- `VelocityCalculator` - Apparent wind calculations

### Path Aliases (CRITICAL - ALWAYS USE THESE)
```typescript
import { SimulationApp } from '@/simulation'
import { BaseSimulationSystem } from '@core/BaseSimulationSystem'
import { FrameFactory } from '@factories/FrameFactory'
import { WindConfig } from '@types'
```

**Available aliases (configured in vite.config.ts & tsconfig.json):**
- `@/*` → `src/*`
- `@core/*` → `src/core/*`
- `@base/*` → `src/base/*`
- `@objects/*` → `src/objects/*`
- `@factories/*` → `src/factories/*`
- `@types` → `src/types/index`

### Physics-First Principles (NON-NEGOTIABLE)
- **All behavior must emerge from physics** - No scripted animations or hard-coded tricks
- **Lines/bridles are constraints, not forces** - They constrain distance but don't push/pull directly
- **Distributed forces** - Aerodynamics and gravity calculated per surface, creating emergent torques
- **Emergent orientation** - Kite orientation emerges from force distribution + constraints
- **Flight sphere constraint** - Kite moves on virtual sphere of radius = line length + bridle length

**Physics flow (60 FPS):**
```
Input → ControlBar rotation → Handle positions →
Apparent wind (wind - kite velocity) →
Aerodynamic forces (lift, drag, torques) + Gravity →
Physics integration (F=ma, τ=Iα) →
Constraint resolution (lines, bridles) via PBD →
Rendering
```

### Code Quality Standards
- **One indentation level per function** - Use early returns and guard clauses
- **No else after return** - Prefer guard clauses over else blocks
- **Descriptive naming** - No abbreviations except Three.js conventions
- **Single responsibility** - Each class/function does one thing well
- **Clean imports** - Always use path aliases, never deep relative paths

## Key Files and Structure

### Critical System Files
- `src/main.ts` - Application entry point
- `src/simulation/SimulationApp.ts` - Main ECS orchestrator
- `src/simulation/config/SimulationConfig.ts` - Central configuration
- `src/types/index.ts` - Type definitions
- `vite.config.ts` & `tsconfig.json` - Build and path configuration

### Core Abstractions (src/core/)
- `StructuredObject` - Base class for 3D objects with named anatomical points
- `Node3D` - Godot-inspired abstraction over THREE.Group
- `BaseSimulationSystem` - Base class for all ECS systems

### Directory Structure
```
src/
├── base/           # Base classes and abstractions
├── core/           # Core 3D and system abstractions
├── factories/      # Factory pattern implementations
├── objects/        # 3D objects (legacy, being migrated to ECS)
├── simulation/     # Main simulation code
│   ├── components/ # ECS components (data)
│   ├── entities/   # ECS entities and EntityManager
│   ├── systems/    # ECS systems (logic)
│   ├── physics/    # Physics modules
│   ├── config/     # Configuration files
│   └── factories/  # Entity factories
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Common Development Tasks

### Adding a New ECS System
1. Create `src/simulation/systems/NewSystem.ts` extending `BaseSimulationSystem`
2. Implement: `initialize()`, `update(context)`, `reset()`, `dispose()`
3. Register in `SimulationApp.createSystems()`
4. Initialize in `SimulationApp.initializeSystems()`
5. Add to update loop in `SimulationApp.updateLoop()`

### Modifying Physics Behavior
1. Check `CONFIG` in `SimulationConfig.ts` first
2. Physics logic goes in modules under `src/simulation/physics/`
3. Forces are calculated, constraints resolved geometrically
4. Always run `npm run type-check` after changes

### Adding Debug Visualization
- Use `DebugRenderer` (passed to systems that need it)
- Create helpers via `RenderSystem.createHelperArrow()`, etc.
- Never access Three.js scene directly - use system abstractions

## Important Notes

### Critical Bug (Identified 2025-10-12)
- **Location**: `ConstraintSolver.ts` lines 288 and 405
- **Issue**: PBD tolerance too strict (`dist <= lineLength - 0.0005`) blocks kite at 14.9995m instead of 15m
- **Impact**: Movement margin reduced to 30cm, kite physically blocked
- **Solution**: Replace with `dist <= lineLength` (no tolerance)

### Migration Context
- **Current Branch**: `clean-code-refactor-autonomous`
- Migrating from hybrid architecture to pure ECS
- ControlBar, Lines, and Pilot systems already migrated to ECS
- Kite object still uses legacy StructuredObject pattern

### Development Best Practices
- Run `npm run type-check` frequently
- Use French comments where already present (bilingual codebase)
- Preserve existing architectural patterns
- Never skip validation steps
- Trust physics over scripted behaviors

## Quality Checklist

Before completing any task:
- [ ] All imports use path aliases
- [ ] `npm run type-check` passes with zero errors
- [ ] Code follows one-indentation-level rule
- [ ] No scripted behaviors, only physics
- [ ] French comments preserved where present
- [ ] Manual testing in browser completed