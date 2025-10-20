# Legacy Code Audit & Consolidation Report

**Date**: 20 October 2025  
**Phase**: Code Consolidation After PBD Fix  
**Status**: Active Cleanup

## 📊 Summary

The legacy `/ecs` folder contains old implementations that have been superseded by new architecture:

### ✅ Current Architecture (NEW)
- **Location**: `src/ecs/systems/`
- **ConstraintSystem.ts**: Dual-mode constraints (PBD + Spring-Force)
- **Status**: PRODUCTION READY

### ⚠️ Legacy Code (OLD)
- **Location**: `legacy/ecs/systems/`
- **Status**: SUPERSEDED - Can be archived

---

## 📋 Legacy Files Categorization

### 1. **COMPLETELY SUPERSEDED** (Safe to Delete)

| File | Reason | Replacement |
|------|--------|-------------|
| `ConstraintSolverPBD.ts` | Complex PBD algorithm replaced by ultra-simple version | `src/ecs/systems/ConstraintSystem.ts` (PBD mode) |
| `ConstraintSolver.ts` | Old constraint resolver | `src/ecs/systems/ConstraintSystem.ts` |
| `LineSystem.ts` | Old line physics | `src/ecs/systems/ConstraintSystem.ts` |
| `ControlPointSystem.ts` | Old CTRL point management | Integrated in BridleConstraintSystem |
| `LinePhysics.ts` | Old line physics calculations | `src/ecs/systems/ConstraintSystem.ts` |

**Impact**: LOW - These are NOT imported anywhere in current codebase

### 2. **PARTIALLY USED** (Audit Required)

| File | Current Usage | Decision |
|------|---------------|----------|
| `KiteController.ts` | Still referenced in imports | Check if actually instantiated |
| `KitePhysicsSystem.ts` | Duplicate of logic in PhysicsSystem | Remove if not used |
| `LineSystem.ts` | References ConstraintSolverPBD | Will be unused once ConstraintSolverPBD is deleted |

### 3. **RENDERING/DEBUG** (Can Archive Separately)

| File | Purpose | Status |
|------|---------|--------|
| `RenderSystem.ts` | Old Three.js rendering | Replaced by new RenderSystem |
| `GeometryRenderSystem.ts` | Old geometry rendering | Replaced by new GeometryRenderSystem |
| `AeroVectorsDebugSystem.ts` | Debug vectors | Replaced by DebugSystem |
| `ControlPointDebugRenderer.ts` | Debug visualization | Replaced by DebugSystem |
| `LinesRenderSystem.ts` | Line rendering | Replaced by new rendering |

**Impact**: LOW - All replaced by new implementations in `src/ecs/systems/`

### 4. **CONFIG/BASE** (Archive Only)

| File | Purpose |
|------|---------|
| `config/SimulationConfig.ts` | Old config (superseded by `src/ecs/config/Config.ts`) |
| `base/Entity.ts` | Old Entity class (replaced by `src/ecs/core/Entity.ts`) |
| `base/System.ts` | Old System class (replaced by `src/ecs/core/System.ts`) |
| `types/` | Old type definitions (migrated to new structure) |

---

## 🗂️ Directory Structure Analysis

```
legacy/ecs/                     ← OLD ARCHITECTURE
├── systems/                    ← Complex implementations
│   ├── ConstraintSolverPBD.ts  ✗ DELETE (replaced by ultra-simple PBD)
│   ├── ConstraintSolver.ts     ✗ DELETE (unused)
│   ├── LineSystem.ts           ✗ DELETE (unused)
│   ├── KiteController.ts       ? REVIEW (check usage)
│   ├── KitePhysicsSystem.ts    ? REVIEW (check usage)
│   └── [rendering]             → Archive separately
├── components/                 ✗ OLD format
├── entities/                   ✗ OLD format
├── config/                     ✗ OLD config
└── ...

src/ecs/                        ← NEW ARCHITECTURE  
├── systems/
│   ├── ConstraintSystem.ts     ✓ NEW dual-mode
│   ├── PhysicsSystem.ts        ✓ NEW
│   ├── RenderSystem.ts         ✓ NEW
│   └── ...
├── components/                 ✓ NEW ECS-pure format
├── config/Config.ts            ✓ NEW unified config
└── ...
```

---

## 🎯 Action Plan

### Phase 1: Safe Deletions (NO DEPENDENCIES)
- [ ] Delete: `legacy/ecs/systems/ConstraintSolverPBD.ts`
- [ ] Delete: `legacy/ecs/systems/ConstraintSolver.ts`
- [ ] Delete: `legacy/ecs/systems/LinePhysics.ts`
- [ ] Delete: `legacy/ecs/systems/ControlPointSystem.ts`

### Phase 2: Conditional Deletions (Check First)
- [ ] Audit: `KiteController.ts` - confirm not instantiated
- [ ] Audit: `KitePhysicsSystem.ts` - confirm not instantiated
- [ ] Delete: `LineSystem.ts` once ConstraintSolverPBD is gone

### Phase 3: Archive Rendering/Debug
- [ ] Archive: All old rendering systems
- [ ] Archive: Debug visualization systems
- [ ] Keep: Any that might be referenced externally

### Phase 4: Archive Config/Base
- [ ] Archive: Old config files
- [ ] Archive: Old base classes
- [ ] Archive: Old type definitions

---

## ✅ Migration Checklist

- [x] New ConstraintSystem implements both PBD and Spring-Force
- [x] New PhysicsSystem handles all dynamics
- [x] New Config system is unified
- [x] All rendering moved to new systems
- [x] BridleConstraintSystem handles bridle physics
- [ ] Legacy systems can be safely deleted
- [ ] Documentation updated
- [ ] All tests passing

---

## 📝 Notes

**Why Keep Legacy at All?**
1. Historical reference for complex algorithms
2. Potential fallback if new implementation has issues
3. Documentation of old design patterns

**When to Delete?**
- After 2-3 months of stable production use
- Once all tests pass consistently
- After thorough code review

**Current Recommendation**: ARCHIVE (not delete yet)
- Move to `archived/legacy-ecs-v7/`
- Keep for reference
- Tag commit clearly

---

## 🔗 Related Files

- **PBD Implementation**: `src/ecs/systems/ConstraintSystem.ts` (lines 56-210)
- **Spring-Force Implementation**: `src/ecs/systems/ConstraintSystem.ts` (lines 213-380)
- **Config**: `src/ecs/config/Config.ts`
- **Physics Integration**: `src/ecs/systems/PhysicsSystem.ts`

