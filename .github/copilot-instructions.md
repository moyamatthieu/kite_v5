# Kite Simulator V8 - Copilot Instructions

## Repository Overview

This is **Kite Simulator**, an autonomous web-based kite physics simulation built with TypeScript and Three.js. The application simulates realistic kite flight dynamics, wind physics, and provides 3D visualization with user controls. It's a standalone version extracted from the larger Kite-simulator-v3 project, designed to be lightweight and self-contained.

**Key Facts:**
- **Language:** TypeScript with ES modules
- **Framework:** Three.js for 3D rendering and physics
- **Build Tool:** Vite
- **Runtime:** Web browser (localhost:3001)
- **Size:** ~30 source files, medium complexity
- **Architecture:** Modular with factory patterns and structured objects

## Build and Development Commands

**ALWAYS run `npm install` before any build or development commands.**

### Essential Commands (Validated)
```bash
# Install dependencies (REQUIRED first step)
npm install

# Start development server (primary development command)
npm run dev
# ✅ Starts on http://localhost:3001, takes ~200ms to start
# ✅ Hot reload enabled, TypeScript compilation included
# ⚠️  NOTE: Development server is typically already running in background - check before starting

# Build for production
npm run build
# ✅ Creates dist/ folder, takes ~3s, outputs ~530KB bundle
# ⚠️  Warns about large chunks (normal behavior, not an error)

# Preview production build
npm run preview
# ✅ Serves dist/ folder for testing production build

# Quick test with info display
./test.sh
# ✅ Shows controls info then runs npm run dev
```

### Build Validation
- **Clean build test:** Always works from fresh `git clone`
- **Dependencies:** All specified in package.json, no hidden system requirements
- **Port:** Always uses 3001 (configured in vite.config.ts)
- **TypeScript:** Strict mode enabled, no `noEmit` for builds
- **Development server:** Usually already running in background - verify with `curl http://localhost:3001` before starting new instance

### Known Build Behaviors
- Bundle size warning (>500KB) is **expected** due to Three.js - not an error
- No test suite currently configured
- No linting configured (relies on TypeScript compiler)

## Project Architecture & Layout

### Directory Structure
```
src/
├── main.ts                    # Application entry point
├── simulation.ts              # Main simulation orchestrator (CRITICAL FILE)
├── base/
│   └── BaseFactory.ts         # Base factory patterns
├── core/                      # Foundational classes
│   ├── Node3D.ts             # Godot-compatible THREE.Group wrapper
│   ├── Primitive.ts          # Basic 3D building blocks
│   └── StructuredObject.ts   # Base class for all 3D objects
├── factories/                 # Object creation patterns
│   ├── FrameFactory.ts       # Structural frame creation
│   └── SurfaceFactory.ts     # Surface and material creation
├── objects/
│   └── organic/
│       └── Kite.ts           # Main kite 3D model
├── types/
│   └── index.ts              # Centralized TypeScript definitions
└── ui/                       # User interface
    ├── SimulationUI.ts       # Main UI components
    └── UIManager.ts          # UI management

# Root configuration files
├── vite.config.ts            # Build configuration with path aliases
├── tsconfig.json             # TypeScript configuration with path aliases
├── package.json              # Dependencies and scripts
└── index.html                # Web application entry point
```

### Key Architectural Patterns

**1. StructuredObject Pattern:**
- All 3D objects extend `StructuredObject` class
- Implements `ICreatable` interface with `create()`, `getName()`, `getDescription()`, `getPrimitiveCount()`
- Uses named anatomical points system (e.g., "tip", "center", "root")

**2. Path Aliases (Critical for imports):**
```typescript
// Configured in both vite.config.ts and tsconfig.json
"@/*": ["src/*"]           // Root source
"@core/*": ["src/core/*"]  // Core classes
"@base/*": ["src/base/*"]  // Base factories
"@objects/*": ["src/objects/*"]  // 3D objects
"@factories/*": ["src/factories/*"]  // Creation patterns
"@types": ["src/types/index"]  // Type definitions
```

**3. Modular Simulation Components:**
The `simulation.ts` file orchestrates these independent systems:
- KiteController: Kite physics and behavior
- WindSimulator: Environmental wind dynamics
- LineSystem: Kite line physics
- ControlBarManager: User input handling
- RenderManager: Three.js rendering
- InputHandler: Keyboard/mouse controls

### Critical Implementation Notes

**Must-Know Dependencies:**
- Uses `three-bvh-csg` for advanced geometry operations
- Three.js version 0.160.0 (specific version matters for API compatibility)
- ES modules only (no CommonJS)

**Code Patterns to Follow:**
- French comments and documentation throughout codebase
- All 3D objects must implement `ICreatable` interface
- Use factory pattern for object creation
- Named points system for precise 3D positioning
- Always use path aliases in imports (e.g., `@core/Node3D` not `../core/Node3D`)

**Clean Code Rules (PREFERRED):**
Apply these rules whenever possible, but pragmatic exceptions are acceptable when they would create unnecessary code complexity:

1. **Un seul niveau d'indentation** - Maximum one level of indentation per method/function
   ```typescript
   // ✅ Bon : Early return pattern
   private validateForces(forces: THREE.Vector3): THREE.Vector3 {
     if (!forces || forces.length() > PhysicsConstants.MAX_FORCE) {
       return new THREE.Vector3();
     }
     
     return forces;
   }
   ```

2. **Pas de "else"** - Avoid else statements, use early returns and guard clauses instead
   ```typescript
   // ✅ Bon : Guard clauses
   getPoint(name: string): THREE.Vector3 | undefined {
     if (!this.points.has(name)) return undefined;
     
     return this.points.get(name);
   }
   ```

3. **Pas de primitives** - Wrap primitives in meaningful classes/types (no raw strings, numbers)
   *Exception: Three.js coordinates, colors, and math values can remain as primitives*
   ```typescript
   // ✅ Bon : Constantes typées
   class PhysicsConstants {
     static readonly MAX_VELOCITY = 30; // m/s
     static readonly EPSILON = 1e-4;
   }
   ```

4. **Des collections VIP** - Use specialized collection classes instead of generic arrays/objects
   *Exception: Three.js arrays for vertices, indices, UV coordinates should stay as native arrays*
   ```typescript
   // ✅ Bon : Maps typées pour les points anatomiques
   private pointsMap: Map<string, [number, number, number]> = new Map();
   ```

5. **Ne pas utiliser d'abréviation** - Use full, descriptive names (no abbreviations like `btn`, `msg`)
   *Exception: Standard Three.js abbreviations (pos, rot, mat, geo, cam) are acceptable*
   ```typescript
   // ✅ Bon : Noms complets et expressifs
   calculateApparentWind() // pas calcAppWind()
   windSimulator // pas windSim
   ```

6. **Créer des micro-classes** - Prefer small, focused classes with single responsibility
   ```typescript
   // ✅ Bon : Séparation des responsabilités
   class WindSimulator { /* gestion du vent uniquement */ }
   class LineSystem { /* gestion des lignes uniquement */ }
   class KiteController { /* contrôle du kite uniquement */ }
   ```

7. **Pas plus de 2 dépendances** - Maximum 2 constructor parameters/dependencies per class
   *Exception: Three.js constructors often require multiple parameters (geometry, material, etc.)*
   ```typescript
   // ✅ Bon : Injection simple
   constructor(kite: Kite) { /* une seule dépendance */ }
   // ✅ Acceptable : Configuration via objet
   constructor(params: ConfigObject) { /* paramètres groupés */ }
   ```

**Project-Specific Patterns (MANDATORY):**
- **French documentation:** All comments and console.log messages in French
- **Factory pattern:** Use FrameFactory, SurfaceFactory for object creation
- **Structured objects:** All 3D objects extend StructuredObject with named points
- **Physics constants:** Use PhysicsConstants class for all physical limits
- **Modular components:** Separate concerns (WindSimulator, LineSystem, etc.)

**Exception Guidelines:** Skip a rule only when following it would:
- Add significant complexity without clear benefit
- Conflict with established Three.js or library patterns
- Create performance issues in critical simulation code
- Break existing architectural conventions in the codebase

### User Controls (For UI Testing)
- **Arrow Keys (↑↓):** Rotate control bar
- **Mouse:** Orbit camera around scene  
- **R:** Reset simulation

### Files Requiring Special Attention

**simulation.ts:** Contains extensive physics comments and is the orchestration center. Changes here affect entire simulation.

**types/index.ts:** Centralized type definitions. Changes here ripple through entire codebase.

**vite.config.ts & tsconfig.json:** Path aliases must stay synchronized. Breaking these breaks all imports.

## Validation Steps

Before submitting any changes:

1. **Always test build:** `npm run build` should complete without TypeScript errors
2. **Test dev server:** `npm run dev` should start and be accessible at localhost:3001
3. **Test basic controls:** Arrow keys and mouse should work in browser
4. **Check imports:** All path aliases should resolve correctly
5. **Verify French comments:** Maintain existing French documentation style

## Search Optimization

**Trust these instructions first.** Only search/explore if:
- Instructions are incomplete for your specific task
- You encounter errors not covered here
- Working with files not mentioned in the architecture section

**Common file locations:**
- Main logic: `src/simulation.ts`
- Type definitions: `src/types/index.ts`
- 3D object examples: `src/objects/organic/Kite.ts`
- Factory patterns: `src/factories/FrameFactory.ts`
- Core abstractions: `src/core/StructuredObject.ts`

This repository has excellent modularity - most changes will be isolated to specific components without affecting the overall simulation architecture.

## Règle Copilot : Utilisation systématique du Sequential Thinking

**TOUJOURS utiliser le mode "sequential thinking" pour toute analyse, planification, conception ou résolution de problème dans ce dépôt.**

Cela inclut :
- La décomposition des tâches complexes
- La planification des modifications
- L'analyse des bugs ou comportements inattendus
- La conception de nouvelles fonctionnalités
- Toute réflexion ou justification technique

Le mode sequential thinking doit être utilisé avant toute modification de code, et pour toute réponse nécessitant une analyse ou une explication. Il est interdit de sauter cette étape, même pour des tâches simples.

**Exemple :**
Avant d'éditer un fichier ou de proposer une solution, générer au moins une séquence de pensées (Chain of Thought) pour justifier la démarche et garantir la traçabilité des décisions.