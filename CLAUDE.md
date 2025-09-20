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

## Architecture Overview

This is a 3D kite simulation built with Three.js and TypeScript, using a Godot-inspired architecture pattern.

### Core Architecture Pattern

The project uses a **Godot-compatible Node3D system** with Three.js as the rendering backend:

- **Node3D** (`src/core/Node3D.ts`): Base class that extends THREE.Group with Godot-like lifecycle methods (`_ready()`, `_process()`, `_physics_process()`) and signal system
- **StructuredObject** (`src/core/StructuredObject.ts`): Abstract base class for all 3D objects, providing named anatomical points and factory-based construction
- **Primitive** (`src/core/Primitive.ts`): Utility class for creating basic 3D shapes (spheres, cylinders, surfaces)

### Key Design Patterns

1. **Named Anatomical Points**: All objects define named 3D points (e.g., "wing_tip_left", "center") stored in a Map, enabling structured object construction
2. **Factory Pattern**: Separate factories for different object aspects:
   - `FrameFactory`: Creates structural frames and skeletons
   - `SurfaceFactory`: Creates surfaces and visual elements
   - `BaseFactory`: Base factory functionality
3. **Godot-Style Lifecycle**: Objects have `_ready()`, `_process()`, and `_physics_process()` methods for initialization and updates

### Directory Structure

```
src/
├── core/           # Core architecture classes
├── objects/        # 3D objects (e.g., Kite class)
├── factories/      # Object construction factories
├── types/          # TypeScript type definitions
├── ui/             # User interface components
├── main.ts         # Application entry point
└── simulation.ts   # Main simulation class
```

### Path Aliases

The project uses TypeScript path aliases:
- `@/*` → `src/*`
- `@core/*` → `src/core/*`
- `@base/*` → `src/base/*`
- `@objects/*` → `src/objects/*`
- `@factories/*` → `src/factories/*`
- `@types` → `src/types/index`

### Implementation Guidelines

1. **All 3D objects must**:
   - Extend `StructuredObject`
   - Implement `ICreatable` interface
   - Define anatomical points in `definePoints()`
   - Build structure in `buildStructure()`
   - Build surfaces in `buildSurfaces()`

2. **Use the factory pattern** for object construction rather than direct Three.js mesh creation

3. **Named points system**: Reference object parts by semantic names rather than hardcoded coordinates

4. **Godot lifecycle**: Override `_ready()`, `_process()`, and `_physics_process()` for object behavior

### Main Simulation

The `Simulation` class (`src/simulation.ts`) orchestrates the entire 3D scene, physics, and rendering loop. The `Kite` class demonstrates the full architecture pattern with anatomical points, factory-based construction, and structured object hierarchy.

### Controls

- Arrow keys ↑↓: Rotate control bar
- Mouse: Orbit camera around scene
- R key: Reset simulation