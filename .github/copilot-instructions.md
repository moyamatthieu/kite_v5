
## Repository Overview

This is **Kite Simulator**, an autonomous web-based kite physics simulation built with TypeScript and Three.js. The application simulates realistic kite flight dynamics, wind physics, and provides 3D visualization with user controls. It's a standalone version extracted from a larger project, designed to be lightweight and self-contained.

Key facts (anglais/français mix allowed in comments):

- Language: TypeScript (ES modules)
- Framework: Three.js (v0.160.0)
- Build tool: Vite (dev server on http://localhost:3001)
- Size: ~30 source files
- Architecture: Modular, factory patterns, structured 3D objects

## Important — Always run before anything

ALWAYS run `npm install` before any build or dev command.

## Essential Commands

These are validated in the project environment:

```bash
# Install dependencies
npm install

# Start dev server (primary dev command)
npm run dev

# Build production bundle
npm run build

# Preview production build locally
npm run preview

# Quick test script
./test.sh
```

Notes:
- Dev server uses port 3001 (see `vite.config.ts`). Check with `curl http://localhost:3001` before starting a second instance.
- Bundle size warnings (>500KB) are expected because of Three.js.

## Project layout (critical files)

src/
- `main.ts` — application entry
- `simulation.ts` — orchestrateur principal (CRITICAL)
- `base/BaseFactory.ts` — patterns de création
- `core/Node3D.ts`, `core/Primitive.ts`, `core/StructuredObject.ts` — abstractions 3D
- `factories/FrameFactory.ts`, `factories/SurfaceFactory.ts`
- `objects/organic/Kite.ts` — modèle de cerf-volant (exemple d'objet structuré)
- `simulation/` — physics, controllers, rendering, config
- `types/index.ts` — types centralisés
- `ui/SimulationUI.ts`, `ui/UIManager.ts`

Root:
- `vite.config.ts`, `tsconfig.json` (path aliases), `package.json`, `index.html`

## Path aliases (MUST use)

Configured in `vite.config.ts` and `tsconfig.json`. Always prefer aliases in imports:

```
@/*       -> src/*
@core/*   -> src/core/*
@base/*   -> src/base/*
@objects/*-> src/objects/*
@factories/* -> src/factories/*
@types    -> src/types/index
```

Breaking these aliases will break most imports.

## Architecture & Patterns (what to follow)

- StructuredObject: all 3D objects extend `StructuredObject` and implement `ICreatable` (`create()`, `getName()`, etc.). Use named anatomical points (e.g., "tip", "center"). Example: `src/objects/organic/Kite.ts`.
- Factory pattern: use `FrameFactory`, `SurfaceFactory` to create geometry/materials and preserve naming conventions.
- Modular simulation: `simulation.ts` wires KiteController, WindSimulator, LineSystem, ControlBarManager, RenderManager, InputHandler.

## Project-specific mandatory rules

 - **Pas de comportements scriptés :** Ne pas implémenter des comportements codés en dur ou des "tours de passe-passe" animés. Tout doit émerger du système physique : collisions, forces du vent, différences de force, contraintes et interactions locales. Favoriser des règles physiques et des solveurs (contrainte, dynamique, aérodynamique) plutôt que des scripts procéduraux.

## Clean code rules (as applied in this repo)

1. One level of indentation per function where feasible — prefer early returns.
2. Avoid `else` when a guard clause suffices.
3. Wrap domain primitives in small classes/types; exceptions: Three.js math/coords.
4. Use descriptive names, avoid abbreviations (except common Three.js short names).
5. Prefer small micro-classes with single responsibility.

## Dependencies requiring attention

- `three-bvh-csg` is used for advanced geometry operations.
- Three.js version pinned to 0.160.0 — API changes across versions may break the code.

## Files requiring special attention

- `src/simulation.ts` — central orchestrator; changes here affect the whole app.
- `src/types/index.ts` — global type changes are wide-reaching.
- `vite.config.ts` & `tsconfig.json` — keep path aliases synchronized.

## Validation steps (before submitting changes)

1. `npm install`
2. `npm run build` — must complete without TypeScript errors
3. `npm run dev` — verify server on http://localhost:3001
4. Smoke test UI controls (arrow keys, mouse orbit)
5. Verify path aliases resolve (no relative paths replacing aliases)
6. Keep French in comments where present

## Search guidance

Trust instructions here first. Search the codebase only when necessary:
- If instructions are incomplete for a task
- If you encounter an error not covered ici
- If you work on files not listed above

Common file locations to inspect:
- `src/simulation.ts` (main logic)
- `src/types/index.ts` (types)
- `src/objects/organic/Kite.ts` (3D object pattern)
- `src/factories/FrameFactory.ts` (factory examples)
- `src/core/StructuredObject.ts` (core abstraction)

## Méthodologie pour agents IA — SEQUENTIAL THINKING (OBLIGATOIRE)

- Les agents doivent systématiquement utiliser le **sequential thinking** (découper, hypothèses, vérification, itération) pour toutes les tâches non triviales.
- Documenter brièvement la chaîne de pensée dans le message d'accompagnement des PRs ou des commits importants (2–5 lignes résumant les étapes et hypothèses).
- Pour les modifications de code : fournir au moins 1 test/validation manuelle ou une vérification de build (ex: `npm run build`) avant de considérer la tâche comme complète.

---

Mettez à jour ce fichier si vous modifiez l'architecture, les conventions ou les workflows majeurs.



