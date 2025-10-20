# Audit des Valeurs Magiques et Incohérences - Kite Simulator V8

**Date** : 20 octobre 2025  
**Status** : 🔴 **PROBLÈMES IDENTIFIÉS**

---

## 📊 Résumé Exécutif

| Catégorie | Occurrences | Sévérité | Notes |
|-----------|-------------|---------|-------|
| **Nombres magiques dupliqués** | 12+ | 🔴 Critique | Même valeur définie à plusieurs endroits |
| **Incohérences de type/unité** | 8+ | 🟡 Moyenne | Même paramètre avec valeurs différentes |
| **Hardcoding dans les systèmes** | 15+ | 🟡 Moyenne | Constantes non centralisées |
| **Vecteurs 3D hardcoded** | 25+ | 🟠 Mineur | Initialisations dispersées |
| **Facteurs magiques non documentés** | 7+ | 🟡 Moyenne | 0.6, 0.75, 2/3, etc. |

**Total estimé** : ~70 problèmes à corriger

---

## 🔴 PROBLÈMES CRITIQUES

### 1. **Duplication : GRAVITY_ACCELERATION**

**Localisation** :
- `AeroSystem.ts:24` → `-9.81` (hardcoded local)
- `Config.ts:26` → `PhysicsConstants.GRAVITY = 9.81` (centralisé)
- `WindSystem.ts` : utilise le vent, pas direct

**Impact** : Maintenant deux sources de vérité pour la gravité

```typescript
// ❌ MAUVAIS - AeroSystem.ts:24
const GRAVITY_ACCELERATION = -9.81; // Dupliqué !

// ✅ BON - Config.ts:26
export const GRAVITY = 9.81; // Source unique
```

**Corriger par** :
```typescript
// AeroSystem.ts
import { PhysicsConstants } from '../config/Config';
private readonly gravity = new THREE.Vector3(0, -PhysicsConstants.GRAVITY, 0);
```

---

### 2. **Duplication : Debug Frame Counter (60)**

**Localisation** :
- `AeroSystem.ts:95` → `debugFrameCounter % 60 === 0`
- `DebugSystem.ts:172` → `debugFrameCounter % 60 === 0`
- `WindSystem.ts:112` → `WIND_UPDATE_INTERVAL = 100` (différent !)
- `UISystem.ts:519` → `lineLength ?? 150`

**Impact** : Fréquence de logging inconsistante

```typescript
// ❌ MAUVAIS
if (this.debugFrameCounter % 60 === 0) { // Magic number 60
  console.log('...');
}

// ✅ BON
export const DEBUG_FRAME_INTERVAL = 60; // À 60 FPS = 1 fois/seconde
if (this.debugFrameCounter % DEBUG_FRAME_INTERVAL === 0) {
  console.log('...');
}
```

---

### 3. **Duplication : Densité de l'air (1.225)**

**Localisation** :
- `Config.ts:29` → `AIR_DENSITY = 1.225`
- `AeroSystem.ts` : utilise implicitement via formules
- `WindSystem.ts` : pas utilisé explicitement

**État** : ✅ Bien (centralisé dans Config)  
**Mais** : Non importé dans AeroSystem, valeur hardcoded ailleurs possiblement

---

## 🟡 PROBLÈMES D'INCOHÉRENCE

### 4. **Incohérence : Tensions et forces (10 N vs 500 N)**

**Localisation** :
- `Config.ts:107` → `MAX_TENSION_N = 10` (lignes)
- `Config.ts:131` → `MAX_FORCE_N = 10` (forces)
- `legacy/Config.ts` → `maxTension: 200, MAX_FORCE: 500`

**Problème** : Valeurs différentes entre Config actuel et legacy

```typescript
// Config.ts - ACTUEL
export const MAX_TENSION_N = 10;  // ~8× poids du kite (0.12 kg)
export const MAX_FORCE_N = 10;    // ~83× poids du kite

// legacy/ - ANCIEN  
maxTension: 200,  // Ancien standard ?
MAX_FORCE: 500    // Ancien standard ?

// Ratio : 200/10 = 20× différence ! ⚠️
```

**Corriger par** : Documenter quelle valeur est correcte après validation physique

---

### 5. **Incohérence : Masses du pilote**

**Localisation** :
- `Config.ts:207` → `PilotSpecs.MASS_KG = 75`
- `Config.ts:210-219` → Dimensions du pilote (1.6m de haut)

**État** : Cohérent (75 kg = adulte standard)  
**Mais** : À valider avec la simulation réelle

---

### 6. **Incohérence : Positions caméra hardcoded**

**Localisation** :
- `RenderSystem.ts:38` → `camera.position.set(13.37, 11.96, 0.45)`
- `RenderSystem.ts:41` → `camera.lookAt(-3.92, 0, -12.33)`

**Impact** : Position caméra non configurable, difficile à reproduire

```typescript
// ❌ MAUVAIS - RenderSystem.ts:38
this.camera.position.set(13.37, 11.96, 0.45);
this.camera.lookAt(-3.92, 0, -12.33);

// ✅ BON - Config.ts (déjà existant)
export const CAMERA_DISTANCE_M = 25;
export const CAMERA_HEIGHT_M = 10;
export const CAMERA_TARGET_X = 0;
export const CAMERA_TARGET_Y = 5;
```

**Corriger par** : Utiliser Config plutôt que hardcoded

---

## 🟠 PROBLÈMES MINEURS - Nombres Magiques Non Centralisés

### 7. **KiteGeometry.ts - Ratios géométriques**

**Localisation** :
```typescript
// KiteGeometry.ts:35
const centreY = height * 0.25;  // 25% de la hauteur

// KiteGeometry.ts:40
const t = (height - centreY) / height;  // = 0.75

// KiteGeometry.ts:46
const fixRatio = 2 / 3;  // 66.67%

// KiteGeometry.ts:52
points.set('WHISKER_GAUCHE', new THREE.Vector3(-interX * fixRatio, centreY * 0.6, -depth));
//                                                                              ^^^ Magic 0.6
```

**Problème** : Facteurs 0.25, 0.75, 2/3, 0.6 non nommés

```typescript
// ✅ À créer
namespace KiteGeometryFactors {
  /** Point de fixation centre (25% de la hauteur du nez) */
  export const CENTER_HEIGHT_RATIO = 0.25;
  
  /** Position interpolée (75% vers le bas du triangle) */
  export const INTERPOLATION_RATIO = 0.75; // = 1 - CENTER_HEIGHT_RATIO
  
  /** Ratio des points de fixation (2/3 vers l'intérieur) */
  export const FIX_POINT_RATIO = 2 / 3;
  
  /** Hauteur des whiskers (60% du centre) */
  export const WHISKER_HEIGHT_RATIO = 0.6;
}
```

---

### 8. **AeroSystem.ts - Coefficients aérodynamiques**

**Localisation** :
```typescript
// AeroSystem.ts:25
const DYNAMIC_PRESSURE_COEFF = 0.5;  // Coefficient pression dynamique

// AeroSystem.ts:26
const OSWALD_EFFICIENCY = 0.8;  // Efficacité profil delta

// AeroSystem.ts:146
const CN = 2.0 * sinAlpha * cosAlpha;  // Formule Rayleigh (hardcoded 2.0)
```

**État** : ✅ Documenté avec commentaires  
**Mais** : Devrait être dans `AeroConfig` du Config.ts

---

### 9. **DebugSystem.ts - Seuils de visualisation**

**Localisation** :
```typescript
// DebugSystem.ts:132
const scale = 0.5;  // Facteur d'échelle pour la visibilité

// DebugSystem.ts:133
const minForceThreshold = 0.001;  // Seuil réduit pour debug

// DebugSystem.ts:143
if (faceForce.lift.length() > 0.0001) {  // Seuil ultra-bas

// DebugSystem.ts:178
faceForce.apparentWind.clone().multiplyScalar(0.05)  // Échelle 5%

// DebugSystem.ts:188
faceForce.normal.clone().multiplyScalar(2.0)  // Longueur fixe 2m

// DebugSystem.ts:206
0.2  // Taille label (20cm)
```

**Problème** : 5 valeurs différentes, pas centralisées

```typescript
// ✅ À créer
namespace DebugConfig.Visualization {
  export const FORCE_VECTOR_SCALE = 0.5;
  export const FORCE_THRESHOLD = 0.001;
  export const LIFT_THRESHOLD = 0.0001;
  export const WIND_SCALE_FACTOR = 0.05;  // 5% de la magnitude
  export const NORMAL_DISPLAY_LENGTH = 2.0;  // m
  export const LABEL_SIZE = 0.2;  // m
}
```

---

### 10. **UISystem.ts - Facteurs de conversion et seuils**

**Localisation** :
```typescript
// UISystem.ts:17
const KMH_TO_MS = 3.6;

// UISystem.ts:160
const TRIANGLES_BASE = 4;

// UISystem.ts:378
if (windSpeed < 0.01) {  // Seuil

// UISystem.ts:387
const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;
//                      ^^^                     ^^^                 ^^^
//                      Magic -1, 1, 180

// UISystem.ts:519
const expectedDistance = this.inputComponent?.lineLength ?? 150;
//                                                              ^^^ Magic 150

// UISystem.ts:535
if (Math.abs(leftDiff) > 1) {  // Seuil 1 meter

// UISystem.ts:568
if (Math.abs(rightDiff) > 1) {  // Seuil 1 meter
```

**État** : Mélange de nombres magiques et valeurs Config

---

### 11. **DebugComponent.ts - Canvas dimensions**

**Localisation** :
```typescript
// DebugComponent.ts:138-139
canvas.width = 128;
canvas.height = 128;

// DebugComponent.ts:187-188
canvas.width = 512;
canvas.height = 512;

// DebugComponent.ts:191
context.clearRect(0, 0, 512, 512);

// DebugComponent.ts:148, 200
context.fillText(text, 64, 64);    // Position centrée (128/2)
context.fillText(text, 256, 256);  // Position centrée (512/2)
```

**Problème** : Dimensions canvas et positions hardcoded

```typescript
// ✅ À créer
namespace DebugConfig.TextLabel {
  export const SMALL_CANVAS_SIZE = 128;
  export const LARGE_CANVAS_SIZE = 512;
  export const SMALL_CENTER = SMALL_CANVAS_SIZE / 2;
  export const LARGE_CENTER = LARGE_CANVAS_SIZE / 2;
}
```

---

## 📋 Vecteurs 3D Hardcoded (Mineur mais nombreux)

### Vecteurs initialisés partout

**Localisation** :
```typescript
// PhysicsComponent.ts:87-88
this.forces = new THREE.Vector3(0, 0, 0);
this.torques = new THREE.Vector3(0, 0, 0);

// DebugComponent.ts:226, 254
const up = new THREE.Vector3(0, 0, 1);  // Dupliqué 2× dans le même fichier

// KiteGeometry.ts:29-70
new THREE.Vector3(0, 0, 0)  // Zéro dupliqué ~12×

// WindSystem.ts:167
new THREE.Vector3(1, 0, 0)  // Vecteur par défaut hardcoded
```

**Recommendation** : Créer un fichier `VectorConstants.ts`

```typescript
// VectorConstants.ts
export const VECTOR_ZERO = new THREE.Vector3(0, 0, 0);
export const VECTOR_FORWARD = new THREE.Vector3(1, 0, 0);
export const VECTOR_UP = new THREE.Vector3(0, 1, 0);
export const VECTOR_RIGHT = new THREE.Vector3(0, 0, 1);
```

---

## 📌 Facteurs Multiplicateurs Non Documentés

| Valeur | Fichier | Ligne | Utilisation | Ratio/Base |
|--------|---------|-------|-------------|-----------|
| **0.25** | KiteGeometry | 35 | Centre bridle Y | 25% de hauteur |
| **0.75** | KiteGeometry | 40 | Position inter | 75% vers bas |
| **0.6** | KiteGeometry | 52 | Whisker Y | 60% du centre |
| **2/3** | KiteGeometry | 46 | Fix ratio | 66.67% inward |
| **0.5** | DebugSystem | 132 | Force scale | Visual factor |
| **0.05** | DebugSystem | 178 | Wind scale | 5% |
| **0.3** | DebugComponent | ? | ? | À chercher |

---

## 🔧 Plan d'Action - Priorité

### Phase 1 : Critique 🔴 (Faire immédiatement)

- [ ] **Centraliser GRAVITY** → AeroSystem doit importer `PhysicsConstants.GRAVITY`
- [ ] **Documenter tensions** → Valider si 10N ou 200N est correct
- [ ] **Unifier caméra** → RenderSystem doit utiliser Config.ts

### Phase 2 : Haute priorité 🟡 (Cette semaine)

- [ ] Créer `namespace DebugConfig.Visualization` avec seuils
- [ ] Centraliser ratios géométriques dans KiteGeometry
- [ ] Unifier conversion KMH_TO_MS (déjà en Config ?)
- [ ] Documenter tous les facteurs 0.5, 0.6, 0.75, 2/3

### Phase 3 : Moyenne priorité 🟠 (Prochaines semaines)

- [ ] Créer `VectorConstants.ts` pour réduire duplication
- [ ] Centraliser seuils UISystem (0.01, 1.0, 150)
- [ ] Canvas dimensions dans Config

### Phase 4 : Optionnel (Refactoring long terme)

- [ ] Audit des formules physiques (Coefficients aérodynamiques)
- [ ] Validation physique réelle de toutes les valeurs

---

## 📊 Statistiques par Fichier

| Fichier | Magics | Sévérité | Status |
|---------|--------|----------|--------|
| `AeroSystem.ts` | 4 | 🔴 | Gravity dupliquée |
| `DebugSystem.ts` | 2 | 🟠 | Frame counter (60) |
| `DebugComponent.ts` | 5 | 🟠 | Canvas dims |
| `UISystem.ts` | 8 | 🟡 | Seuils mixtes |
| `RenderSystem.ts` | 3 | 🔴 | Pos caméra hardcoded |
| `KiteGeometry.ts` | 6 | 🟡 | Ratios non nommés |
| `WindSystem.ts` | 2 | 🟠 | Defaults hardcoded |
| **Config.ts** | 0 | ✅ | Parfait ! |
| **TOTAL** | **30+** | Mixed | Action requise |

---

## ✅ Résolution Proposée

### Créer dans Config.ts

```typescript
// À ajouter dans namespace DebugConfig
export namespace DebugVisualization {
  export const FORCE_VECTOR_SCALE = 0.5;
  export const FORCE_THRESHOLD = 0.001;
  export const LIFT_THRESHOLD = 0.0001;
  export const WIND_VECTOR_SCALE = 0.05;
  export const NORMAL_DISPLAY_LENGTH = 2.0;
  export const LABEL_SIZE = 0.2;
  export const FRAME_LOG_INTERVAL = 60; // À 60 FPS = 1/sec
}

// À ajouter dans namespace RenderConfig
export namespace RenderCamera {
  export const DEFAULT_POSITION_X = 13.37;
  export const DEFAULT_POSITION_Y = 11.96;
  export const DEFAULT_POSITION_Z = 0.45;
  export const DEFAULT_LOOKAT_X = -3.92;
  export const DEFAULT_LOOKAT_Y = 0;
  export const DEFAULT_LOOKAT_Z = -12.33;
}
```

### Centraliser dans AeroSystem

```typescript
// ✅ À corriger AeroSystem.ts:24-26
import { PhysicsConstants, AeroConfig } from '../config/Config';

const DYNAMIC_PRESSURE_COEFF = AeroConfig.DYNAMIC_PRESSURE_COEFF;
const OSWALD_EFFICIENCY = AeroConfig.OSWALD_EFFICIENCY;
private readonly gravity = new THREE.Vector3(0, -PhysicsConstants.GRAVITY, 0);
```

---

## 📎 Fichiers à Consulter pour Audit Complet

- `src/ecs/config/Config.ts` - Source de vérité
- `src/ecs/systems/AeroSystem.ts` - Constantes dupliquées
- `src/ecs/systems/DebugSystem.ts` - Debug hardcoded
- `src/ecs/systems/UISystem.ts` - Seuils mixtes
- `src/ecs/config/KiteGeometry.ts` - Ratios à documenter
- `legacy/` - Comparaison anciennes valeurs

---

**Fin du rapport**
