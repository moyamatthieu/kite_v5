# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kite Simulator is an autonomous kite simulation application built with TypeScript and Three.js. It simulates realistic kite physics including wind dynamics, line control, and 3D rendering. The application runs as a web-based simulation accessible at http://localhost:3001.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Quick test script (runs dev server with info)
./test.sh
```

## Architecture

### Core Module Structure

The codebase follows a modular architecture with path aliases configured in both vite.config.ts and tsconfig.json:

- `@/` → `src/` (root source)
- `@core/` → `src/core/` (foundational classes)
- `@base/` → `src/base/` (base factories)
- `@objects/` → `src/objects/` (3D objects like kite)
- `@factories/` → `src/factories/` (object creation)
- `@types` → `src/types/index` (TypeScript definitions)

### Key Architectural Components

1. **Core Classes** (`src/core/`):
   - `Node3D`: Godot-compatible abstraction layer over THREE.Group
   - `StructuredObject`: Base class for all 3D objects with named anatomical points
   - `Primitive`: Fundamental 3D building blocks

2. **Main Simulation** (`src/simulation.ts`):
   - Physics engine orchestration
   - Modular components: KiteController, WindSimulator, LineSystem, ControlBarManager, RenderManager, InputHandler
   - Entry point for the entire simulation

3. **Objects** (`src/objects/organic/`):
   - `Kite.ts`: Main kite 3D model and physics

4. **Factories** (`src/factories/`):
   - `FrameFactory`: Creates structural frames
   - `SurfaceFactory`: Creates surfaces and materials
   - `BaseFactory`: Base creation patterns

5. **UI System** (`src/ui/`):
   - `SimulationUI`: Main interface
   - `UIManager`: Interface management

### Design Patterns

- **StructuredObject Pattern**: All 3D objects inherit from StructuredObject and implement ICreatable interface
- **Named Points System**: Objects define anatomical points (like "tip", "center") for precise positioning
- **Factory Pattern**: Consistent object creation through specialized factories
- **Modular Physics**: Simulation broken into independent, interacting systems

## Controls

- **Arrow Keys (↑↓)**: Rotate control bar
- **Mouse**: Orbit camera around scene
- **R**: Reset simulation

## Key Files

- `src/main.ts`: Application entry point
- `src/simulation.ts`: Main simulation orchestrator with detailed physics comments
- `src/types/index.ts`: Centralized TypeScript type definitions
- `src/objects/organic/Kite.ts`: Kite model implementation
- `index.html`: Web application entry point

## Development Notes

- Uses ES modules with TypeScript
- Three.js for 3D rendering and physics
- Vite for development server and building
- Port 3001 for development server
- French comments and documentation throughout codebase
- Extensive physics simulation with realistic wind dynamics