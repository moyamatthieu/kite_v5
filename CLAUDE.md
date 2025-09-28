# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server on http://localhost:3001
- `npm run build` - Build the project for production
- `npm run preview` - Preview the production build

### Dependencies
- Install: `npm install`
- Three.js, TypeScript, and Vite are the main dependencies
- Additional: Chart.js for UI graphs, nipplejs for mobile controls, three-bvh-csg for geometry operations

### Testing and Linting
- No testing framework is currently configured
- No linting tools (ESLint/Prettier) are currently configured
- TypeScript compilation provides basic type checking via `npm run build`

## Architecture Overview

This is a 3D kite simulation built with Three.js and TypeScript, using a **modular architecture inspired by Godot Engine**. The project features real-time physics simulation, wind modeling, and comprehensive UI controls.

### Core Modular Architecture

The project follows a **component-based architecture** with clear separation of concerns:

- **SimulationApp** (`src/app/SimulationApp.ts`): Main orchestrator that coordinates all components and manages the animation loop
- **PhysicsEngine** (`src/physics/PhysicsEngine.ts`): Handles aerodynamic calculations, line constraints, and kite physics
- **RenderManager** (`src/rendering/RenderManager.ts`): Manages Three.js scene, camera controls, and 3D rendering
- **InputHandler** (`src/input/InputHandler.ts`): Processes keyboard and mouse inputs for controls
- **SimulationUI** (`src/ui/SimulationUI.ts`): Manages the user interface panels and real-time data display

### Core Architecture Pattern - Node3D System

The project uses a **Godot-compatible Node3D system** with Three.js as the rendering backend:

- **Node3D** (`src/core/Node3D.ts`): Base class that extends THREE.Group with Godot-like lifecycle methods (`_ready()`, `_process()`, `_physics_process()`) and signal system
- **StructuredObject** (`src/core/StructuredObject.ts`): Abstract base class for all 3D objects, providing named anatomical points and factory-based construction
- **Primitive** (`src/core/Primitive.ts`): Utility class for creating basic 3D shapes (spheres, cylinders, surfaces)

### Key Design Patterns

1. **Named Anatomical Points**: All objects define named 3D points (e.g., "CTRL_GAUCHE", "WHISKER_DROIT") stored in a Map, enabling structured object construction
2. **Factory Pattern**: Separate factories for different object aspects:
   - `FrameFactory`: Creates structural frames and skeletons
   - `SurfaceFactory`: Creates surfaces and visual elements
   - `PointFactory`: Creates markers and debug points
3. **Godot-Style Lifecycle**: Objects have `_ready()`, `_process()`, and `_physics_process()` methods for initialization and updates
4. **Configuration System**: Centralized configuration in `src/config/GlobalConfig.ts` that aggregates all subsystem configs

### Updated Directory Structure

```
src/
├── app/                # SimulationApp - main orchestrator
├── base/               # Base classes and utilities
├── config/             # Centralized configuration (GlobalConfig.ts, WindConfig.ts, etc.)
├── controllers/        # Business controllers (KiteController.ts)
├── controls/           # Control bar management (ControlBarManager.ts)
├── core/               # Base architecture classes (Node3D.ts, StructuredObject.ts)
├── factories/          # Object construction factories
├── geometry/           # Geometry utilities (KiteGeometry.ts)
├── input/              # Input handling (InputHandler.ts, commands/)
├── objects/            # 3D objects (organic/Kite.ts, environment/)
├── physics/            # Physics engine and calculations
├── rendering/          # Rendering management (RenderManager.ts)
├── simulation/         # Specialized simulators (WindSimulator.ts)
├── types/              # TypeScript type definitions
├── ui/                 # User interface (SimulationUI.ts, UIManager.ts)
├── utils/              # Utility functions and helpers
├── main.ts             # Application entry point
└── simulation.ts       # Re-exports SimulationApp for compatibility
```

### Path Aliases

The project uses TypeScript path aliases:
- `@/*` → `src/*`
- `@core/*` → `src/core/*`
- `@base/*` → `src/base/*`
- `@objects/*` → `src/objects/*`
- `@factories/*` → `src/factories/*`
- `@types` → `src/types/index`

### Critical Implementation Guidelines

1. **All 3D objects MUST**:
   - Extend `StructuredObject` and implement `ICreatable`
   - Define anatomical points in `definePoints()` using semantic names
   - Build structure in `buildStructure()` using FrameFactory
   - Build surfaces in `buildSurfaces()` using SurfaceFactory
   - Call `this.init()` in constructor

2. **Factory Pattern is MANDATORY**: Never create Three.js meshes directly - always use factories

3. **Named Points System**: Use semantic names like "NEZ", "BORD_GAUCHE" rather than hardcoded coordinates

4. **Configuration**: All constants should be centralized in `src/config/GlobalConfig.ts`

### Communication Flow

Data flows through the system as: InputHandler → SimulationApp → PhysicsEngine → RenderManager → UI updates. The SimulationApp orchestrates all components and maintains the main animation loop with fixed timestep physics.

### Controls and Testing

- **↑↓ Arrows**: Rotate control bar (pulls kite lines)
- **ZQSD/WASD**: Camera movement (Tab to focus)
- **Mouse**: Orbit camera around scene
- **R**: Reset simulation
- **Space**: Pause/resume
- **F1**: Toggle debug mode

### Performance Requirements

- Target 60 FPS with fixed timestep physics (16.67ms)
- Adaptive deltaTime handling for low FPS scenarios
- Wind simulation must maintain stable flight at 20km/h
- UI panels auto-organize to avoid overlaps