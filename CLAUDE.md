# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kite Simulator is an autonomous kite physics simulation built with TypeScript and Three.js. It simulates realistic kite flight dynamics with wind physics and provides 3D visualization. This is a standalone version extracted from a larger project, designed to be lightweight and self-contained.

**Key facts:**
- Language: TypeScript (ES modules)
- Framework: Three.js v0.160.0 (pinned version - API changes may break code)
- Build tool: Vite (dev server on http://localhost:3001)
- ~30 source files with modular architecture
- French/English comments throughout (preserve French where present)

## Development Commands

Always run `npm install` before any build or dev command.

```bash
# Install dependencies (ALWAYS run first)
npm install

# Start development server (primary dev command)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Quick test script
./test.sh
```

**Notes:**
- Dev server uses port 3001 (see vite.config.ts)
- Bundle size warnings (>500KB) are expected due to Three.js
- Check port availability with `curl http://localhost:3001` before starting

## Architecture

### Path Aliases (MUST use)

Configured in both `vite.config.ts` and `tsconfig.json`. Always prefer aliases in imports:

- `@/` → `src/` (root source)
- `@core/` → `src/core/` (foundational classes)
- `@base/` → `src/base/` (base factories)
- `@objects/` → `src/objects/` (3D objects)
- `@factories/` → `src/factories/` (object creation)
- `@types` → `src/types/index` (TypeScript definitions)

**Breaking these aliases will break most imports.**

### Modular Structure

**Core Classes** (`src/core/`):
- `Node3D`: Godot-compatible abstraction layer over THREE.Group
- `StructuredObject`: Base class for all 3D objects with named anatomical points
- `Primitive`: Fundamental 3D building blocks

**Simulation System** (`src/simulation/`):
- `SimulationApp.ts`: Main orchestrator (CRITICAL - changes affect whole app)
- `simulation.ts`: Compatibility entry point that re-exports SimulationApp
- Modular subsystems:
  - `physics/`: PhysicsEngine, WindSimulator, LineSystem, ConstraintSolver, AerodynamicsCalculator
  - `controllers/`: KiteController, ControlBarManager, InputHandler
  - `rendering/`: RenderManager, DebugRenderer
  - `config/`: SimulationConfig, PhysicsConstants, KiteGeometry
  - `ui/`: UIManager
  - `types/`: WindTypes, PhysicsTypes

**Objects** (`src/objects/organic/`):
- `Kite.ts`: Main kite 3D model (example of StructuredObject pattern)

**Factories** (`src/factories/`):
- `FrameFactory`: Creates structural frames
- `SurfaceFactory`: Creates surfaces and materials
- `BaseFactory`: Base creation patterns

**Types** (`src/types/index.ts`):
- Centralized TypeScript definitions (changes are wide-reaching)

### Design Patterns

**StructuredObject Pattern:**
- All 3D objects inherit from `StructuredObject` and implement `ICreatable` interface
- Must implement: `create()`, `getName()`, etc.
- Define named anatomical points (e.g., "tip", "center", "left_wing") for precise positioning
- Example: `src/objects/organic/Kite.ts`

**Factory Pattern:**
- Use `FrameFactory` and `SurfaceFactory` for geometry/materials
- Preserves naming conventions and consistent object creation

**Modular Physics:**
- `SimulationApp.ts` wires together independent, interacting systems
- Each system handles specific concerns (wind, lines, controls, rendering)

## Critical Development Rules

**Physics-Based Behavior (MANDATORY):**
- **Pas de comportements scriptés**: No hard-coded or animated "tricks"
- Everything must emerge from the physics system: collisions, wind forces, force differences, constraints, and local interactions
- Favor physical rules and solvers (constraint, dynamics, aerodynamics) over procedural scripts

**Clean Code Standards:**
1. One level of indentation per function where feasible - prefer early returns
2. Avoid `else` when a guard clause suffices
3. Wrap domain primitives in small classes/types (exception: Three.js math/coords)
4. Use descriptive names, avoid abbreviations (except common Three.js short names)
5. Prefer small micro-classes with single responsibility

**Sequential Thinking (REQUIRED for non-trivial tasks):**
- Decompose tasks, form hypotheses, verify, iterate
- Document reasoning briefly in PR/commit messages (2-5 lines)
- Provide at least 1 test/validation or build verification (`npm run build`) before considering tasks complete

## Dependencies

**Critical dependencies:**
- `three@0.160.0`: Pinned version - API changes across versions may break code
- `three-bvh-csg@0.0.17`: Used for advanced geometry operations

## Validation Before Submitting Changes

1. `npm install`
2. `npm run build` - must complete without TypeScript errors
3. `npm run dev` - verify server on http://localhost:3001
4. Smoke test UI controls (arrow keys, mouse orbit, R key reset)
5. Verify path aliases resolve (no relative paths replacing aliases)
6. Keep French in comments where present

## Controls

- **↑↓ Arrow Keys**: Rotate control bar
- **Mouse**: Orbit camera around scene
- **R**: Reset simulation

## Search Guidance

Trust instructions here first. Search the codebase only when:
- Instructions are incomplete for a task
- You encounter an error not covered here
- You work on files not listed above

**Common inspection points:**
- [src/simulation/SimulationApp.ts](src/simulation/SimulationApp.ts) (main logic)
- [src/types/index.ts](src/types/index.ts) (types)
- [src/objects/organic/Kite.ts](src/objects/organic/Kite.ts) (3D object pattern)
- [src/factories/FrameFactory.ts](src/factories/FrameFactory.ts) (factory examples)
- [src/core/StructuredObject.ts](src/core/StructuredObject.ts) (core abstraction)

---

Update this file if you modify architecture, conventions, or major workflows.