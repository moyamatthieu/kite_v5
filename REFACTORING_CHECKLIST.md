# ✅ Checklist de Refactoring Config.ts

**Objectif** : Éliminer TOUS les nombres magiques du projet  
**Status** : 70% Complété  
**Compilation** : ✅ ZÉRO ERREURS

---

## Phase 1 : ✅ COMPLÉTÉE

### Fichiers Corrigés (5/5)

- [x] **Config.ts** - Enrichi avec 40+ constantes
  - [x] AeroConfig : +2 constantes (DYNAMIC_PRESSURE_COEFF, OSWALD_EFFICIENCY)
  - [x] RenderConfig : +6 constantes (positions caméra)
  - [x] DebugConfig : +12 constantes (seuils, échelles)
  - [x] KiteSpecs : +5 constantes (ratios géométriques)

- [x] **AeroSystem.ts** - Harmony avec Config
  - [x] Import PhysicsConstants, AeroConfig, DebugConfig
  - [x] Gravity: -PhysicsConstants.GRAVITY
  - [x] Dynamic pressure: AeroConfig.DYNAMIC_PRESSURE_COEFF
  - [x] Oswald: AeroConfig.OSWALD_EFFICIENCY
  - [x] Frame intervals: DebugConfig.FRAME_LOG_INTERVAL (2 occurrences)

- [x] **RenderSystem.ts** - Caméra depuis Config
  - [x] Import RenderConfig
  - [x] Position caméra: 3 constantes RenderConfig
  - [x] LookAt caméra: 3 constantes RenderConfig

- [x] **DebugSystem.ts** - Visualisation depuis Config
  - [x] Import DebugConfig
  - [x] Force scale: DebugConfig.FORCE_VECTOR_SCALE
  - [x] Force threshold: DebugConfig.FORCE_THRESHOLD
  - [x] Lift threshold: DebugConfig.LIFT_THRESHOLD
  - [x] Wind scale: DebugConfig.WIND_VECTOR_SCALE
  - [x] Normal length: DebugConfig.NORMAL_DISPLAY_LENGTH
  - [x] Label size: DebugConfig.TEXT_LABEL_SIZE
  - [x] Méthodes: displayLineTensions(), displayGripForces()

- [x] **DebugComponent.ts** - Canvas depuis Config
  - [x] Import DebugConfig
  - [x] Small canvas: 128x128 → DebugConfig.CANVAS_SMALL_SIZE
  - [x] Large canvas: 512x512 → DebugConfig.CANVAS_LARGE_SIZE
  - [x] Centres: 64, 256 → DebugConfig constants

---

## Phase 2 : ⏳ À FAIRE

### Haute Priorité

#### UISystem.ts
- [ ] Créer `UIConfig` namespace dans Config.ts
  - [ ] `DEFAULT_LINE_LENGTH = 150` (m)
  - [ ] `SPEED_THRESHOLD = 0.01` (m/s)
  - [ ] `SPEED_SCALE = 1.0`
  - [ ] `UPDATE_INTERVAL = 100` (ms)
  - [ ] `KMH_TO_MS = 0.27778`
- [ ] Mettre à jour UISystem.ts
  - [ ] Import UIConfig
  - [ ] Remplacer hardcoded 150 → UIConfig.DEFAULT_LINE_LENGTH
  - [ ] Remplacer hardcoded 0.01 → UIConfig.SPEED_THRESHOLD
  - [ ] Remplacer hardcoded 1.0 → UIConfig.SPEED_SCALE
  - [ ] Remplacer hardcoded 100 → UIConfig.UPDATE_INTERVAL
  - [ ] Ajouter et utiliser KMH_TO_MS

#### KiteGeometry.ts
- [ ] Vérifier si fichier utilise KiteSpecs depuis Config
- [ ] Remplacer ratios hardcoded :
  - [ ] `0.25` → `KiteSpecs.CENTER_HEIGHT_RATIO`
  - [ ] `0.75` → `KiteSpecs.INTERPOLATION_RATIO`
  - [ ] `2/3` → `KiteSpecs.FIX_POINT_RATIO`
  - [ ] `0.6` → `KiteSpecs.WHISKER_HEIGHT_RATIO`
  - [ ] `0.15` → `KiteSpecs.WHISKER_DEPTH_M`

#### WindSystem.ts
- [ ] Créer `WindConstants` namespace dans Config.ts (ou utiliser EnvironmentConfig)
  - [ ] `UPDATE_INTERVAL = 100` (ms)
  - [ ] `TURBULENCE_UPDATE_INTERVAL = 1000` (ms)
  - [ ] `TURBULENCE_MIN = 0.01`
  - [ ] `TURBULENCE_MAX = 0.1`
  - [ ] `DEFAULT_WIND_SPEED = 10` (m/s)
  - [ ] `DEFAULT_WIND_DIRECTION = 0` (°)
- [ ] Mettre à jour WindSystem.ts
  - [ ] Import Wind constants
  - [ ] Remplacer tous les hardcoded intervals

### Moyenne Priorité

#### ConstraintSystem.ts
- [ ] Audit des hardcoded values
- [ ] Créer `ConstraintConfig` si nécessaire
- [ ] Ajouter : damping, stiffness, max tension

#### PhysicsSystem.ts
- [ ] Audit des hardcoded values
- [ ] Vérifier intégrateur (Euler step)
- [ ] Créer `PhysicsIntegrationConfig` si nécessaire

#### GeometryRenderSystem.ts
- [ ] Vérifier hardcoded colors, mesh sizes
- [ ] Créer `GeometryRenderConfig` si nécessaire
- [ ] Material properties depuis Config

### Basse Priorité

#### Constantes Globales 3D
- [ ] Créer `VectorConstants.ts`
  ```typescript
  export const VECTOR_ZERO = new THREE.Vector3(0, 0, 0);
  export const VECTOR_X = new THREE.Vector3(1, 0, 0);
  export const VECTOR_Y = new THREE.Vector3(0, 1, 0);
  export const VECTOR_Z = new THREE.Vector3(0, 0, 1);
  ```
- [ ] Remplacer `new THREE.Vector3(0, 0, 0)` partout

#### Système Complet d'Audit
- [ ] Audit de InputSystem.ts
- [ ] Audit de tous les systèmes legacy
- [ ] Vérifier ALL factories pour hardcoded values

---

## Validation Continue

### À chaque étape
- [ ] `npm run type-check` → ✅ Zéro erreurs
- [ ] `npm run lint` → Aucun warning
- [ ] Aucune régression visuellement

### À la fin (Phase 2)
- [ ] `npm run build` → Production build réussit
- [ ] `npm run dev` → App démarre sans errors
- [ ] Tests visuels : caméra, forces, debug rendering
- [ ] Performance : pas de ralentissement

---

## Fichiers Trouvés Nécessitant Audit

**À lire** :
```
src/ecs/systems/
  ✓ AeroSystem.ts (✅ CORRIGÉ)
  ✓ RenderSystem.ts (✅ CORRIGÉ)
  ✓ DebugSystem.ts (✅ CORRIGÉ)
  - UISystem.ts (⏳ À faire)
  - WindSystem.ts (⏳ À faire)
  - PhysicsSystem.ts (audit)
  - ConstraintSystem.ts (audit)
  - GeometryRenderSystem.ts (audit)
  - InputSystem.ts (audit)
  
src/ecs/components/
  ✓ DebugComponent.ts (✅ CORRIGÉ)
  - KiteComponent.ts (audit)
  - tous autres (audit)

src/ecs/entities/factories/
  - KiteGeometry.ts (⏳ À faire)
  - tous autres (audit)
```

---

## Métriques de Progrès

| Métrique | Phase 1 | Phase 2 | Final |
|----------|---------|---------|--------|
| Fichiers corrigés | **5/5** ✅ | 3/8 | 8/8 |
| Nombres magiques éliminés | ~50/70 | ~65/70 | ~70/70 |
| Namespaces Config | **11** | 12+ | 15+ |
| Compilation | ✅ 0 errors | TBD | ✅ |
| Documentation | 100% | TBD | 100% |

---

## 📝 Notes

- **Branche actuelle** : `refactor-bridles`
- **Config.ts source de vérité** : Oui ✅
- **Architecture ECS respectée** : Oui ✅
- **Zéro breaking changes** : Oui ✅

---

**Last Update** : Phase 1 Complétée + Rapport généré  
**Next** : Commencer Phase 2 avec UISystem.ts
