# 📖 Config.ts - Constantes Centralisées (Référence)

## 📊 Vue Complète des Namespaces

### 🌍 PhysicsConstants
```typescript
export const GRAVITY = 9.81;              // m/s² (gravité)
export const AIR_DENSITY = 1.225;         // kg/m³ (densité air)
export const PBD_ITERATIONS = 4;          // Itérations position-based dynamics
export const PBD_COMPLIANCE = 0.00001;    // Compliance PBD
export const PBD_MAX_CORRECTION = 2.0;    // Correction max par frame
```

### 🪁 KiteSpecs
```typescript
// Masses & Dimensions
export const MASS_KG = 0.12;              // Masse kite
export const WINGSPAN_M = 1.65;           // Envergure
export const CHORD_M = 0.65;              // Corde (hauteur)
export const SURFACE_AREA_M2 = 0.54;      // Surface alaire

// Inertie (tenseur)
export const INERTIA_XX = 0.0315;         // kg⋅m² (roulis)
export const INERTIA_YY = 0.0042;         // kg⋅m² (tangage)
export const INERTIA_ZZ = 0.0110;         // kg⋅m² (lacet)

// Rendu 3D
export const COLOR = 0xff3333;            // Couleur (rouge)

// === RATIOS GÉOMÉTRIQUES (Nouvelles) ===
export const CENTER_HEIGHT_RATIO = 0.25;  // 25% de hauteur pour centre
export const INTERPOLATION_RATIO = 0.75;  // 75% vers le bas
export const FIX_POINT_RATIO = 2 / 3;     // 66.67% pour fix points
export const WHISKER_HEIGHT_RATIO = 0.6;  // 60% du centre
export const WHISKER_DEPTH_M = 0.15;      // 15cm profondeur whiskers
```

### 🪢 BridleConfig & LineSpecs & ConstraintConfig
```typescript
// Bridles
export const LENGTH_NEZ_M = 0.65;         // Longueur bridle nez
export const LENGTH_INTER_M = 0.65;       // Longueur bridle inter
export const LENGTH_CENTRE_M = 0.65;      // Longueur bridle centre
export const COLOR = 0xff0000;            // Couleur bridles

// Lignes
export const LENGTH_M = 15;               // Longueur lignes de vol
export const MAX_TENSION_N = 10;          // Tension maximale
export const COLOR = 0x0000ff;            // Couleur lignes

// Contraintes (spring-force)
export const CONSTRAINT_MODE = 'spring-force';
export const STIFFNESS_N_PER_M = 50;     // Raideur ressort
export const DAMPING_N_S_PER_M = 5;      // Amortissement
export const DAMPING_RATIO = 0.7;        // Ratio amortissement
export const MAX_FORCE_N = 10;           // Force max
```

### 🌪️ AeroConfig **(Nouveau)**
```typescript
export const DYNAMIC_PRESSURE_COEFF = 0.5;  // q = 0.5 * ρ * V²
export const OSWALD_EFFICIENCY = 0.8;      // Facteur efficacité d'Oswald
export const CL0 = 0.0;                    // Coeff portance α=0
export const CL_ALPHA_PER_DEG = 0.105;    // dCl/dα
export const ALPHA_ZERO_DEG = -2;         // Angle zero portance
export const ALPHA_OPTIMAL_DEG = 12;      // Angle optimal
export const CD0 = 0.08;                  // Coeff traînée parasitaire
export const CM = -0.05;                  // Coeff moment
export const LIFT_SCALE_DEFAULT = 1.0;   // Échelle portance UI
export const DRAG_SCALE_DEFAULT = 1.0;   // Échelle traînée UI
export const FORCE_SMOOTHING = 0.05;     // Lissage forces
```

### 🌍 EnvironmentConfig
```typescript
export const WIND_SPEED_M_S = 12;        // Vitesse vent initial
export const WIND_DIRECTION_DEG = 270;   // Direction vent initial (Nord)
export const WIND_TURBULENCE_PERCENT = 0; // Turbulence initiale
export const LINEAR_DAMPING = 0.8;       // Amortissement linéaire
export const ANGULAR_DAMPING = 0.5;      // Amortissement angulaire
export const MASS_KG = 75;               // Masse pilote
```

### 🎬 InitConfig & SimulationConfig
```typescript
// Initialisation
export const CONTROL_BAR_POSITION_Y_M = 0;    // Position Y barre contrôle
export const CONTROL_BAR_POSITION_Z_M = -5;   // Position Z barre contrôle
export const KITE_ALTITUDE_M = 20;            // Altitude initiale
export const KITE_DISTANCE_M = 30;            // Distance initiale
export const ORIENTATION_PITCH_DEG = 0;       // Tangage initial
export const ORIENTATION_YAW_DEG = 0;         // Lacet initial
export const ORIENTATION_ROLL_DEG = 0;        // Roulis initial

// Simulation
export const TARGET_FPS = 60;            // FPS cible
export const MAX_FRAME_TIME_S = 0.016;   // Frame time max (16ms)
export const TIME_SCALE = 1.0;           // Accélération temps
export const AUTO_START = false;         // Démarrage auto
```

### 🖥️ RenderConfig **(Enrichi)**
```typescript
export const CAMERA_DISTANCE_M = 15;     // Distance caméra
export const CAMERA_HEIGHT_M = 10;       // Hauteur caméra
export const CAMERA_TARGET_X = 0;        // Cible caméra X
export const CAMERA_TARGET_Y = 0;        // Cible caméra Y
export const CAMERA_TARGET_Z = 0;        // Cible caméra Z
export const MESH_SUBDIVISION_LEVEL = 2; // Niveau subdivision mesh

// === POSITIONS CAMÉRA EXPLICITES (Nouveau) ===
export const CAMERA_POSITION_X = 13.37;  // Position caméra X
export const CAMERA_POSITION_Y = 11.96;  // Position caméra Y
export const CAMERA_POSITION_Z = 0.45;   // Position caméra Z
export const CAMERA_LOOKAT_X = -3.92;    // LookAt caméra X
export const CAMERA_LOOKAT_Y = 0;        // LookAt caméra Y
export const CAMERA_LOOKAT_Z = -12.33;   // LookAt caméra Z
```

### 🐛 DebugConfig **(Massif enrichissement)**
```typescript
// Activation
export const ENABLED = true;             // Debug mode actif
export const SHOW_FORCE_VECTORS = true; // Afficher forces
export const SHOW_PHYSICS_INFO = false;  // Afficher infos physique
export const LOG_LEVEL = 'info' as const; // Niveau log

// === VISUALISATION DEBUG (Nouveau) ===
export const FRAME_LOG_INTERVAL = 60;    // Tous les 60 frames (1/sec @ 60 FPS)
export const FORCE_VECTOR_SCALE = 0.5;   // Échelle vecteur force
export const FORCE_THRESHOLD = 0.001;    // Seuil minimum force affichage (N)
export const LIFT_THRESHOLD = 0.0001;    // Seuil minimum lift affichage (N)
export const WIND_VECTOR_SCALE = 0.05;   // Échelle vecteur vent (5%)
export const NORMAL_DISPLAY_LENGTH = 2.0; // Longueur normales 3D (m)
export const TEXT_LABEL_SIZE = 0.2;      // Taille labels texte (m)

// === FORCE ARROW DISPLAY (Bonus) ===
export const MIN_FORCE_ARROW_DISPLAY = 0.01; // Seuil min flèche force (N)
export const MAX_FORCE_ARROW_LENGTH = 30;    // Longueur max flèche (m)

// === CANVAS TEXTURES (Nouveau) ===
export const CANVAS_SMALL_SIZE = 128;    // Taille petit canvas (pixels)
export const CANVAS_LARGE_SIZE = 512;    // Taille grand canvas (pixels)
export const CANVAS_SMALL_CENTER = 64;   // Centre petit canvas (128/2)
export const CANVAS_LARGE_CENTER = 256;  // Centre grand canvas (512/2)
```

### 🖥️ UIConfig **(NOUVEAU NAMESPACE)**
```typescript
// Système UI
export const PRIORITY = 90;              // Priorité ECS du système UI

// === AFFICHAGE NOMBRES ===
export const DECIMAL_PRECISION_VELOCITY = 2;   // Précision vitesse (km/h)
export const DECIMAL_PRECISION_POSITION = 2;   // Précision position (m)
export const DECIMAL_PRECISION_ANGLE = 2;      // Précision angles (°)

// === CONVERSIONS ===
export const MS_TO_KMH = 3.6;           // Facteur m/s → km/h

// === SEUILS ===
export const MIN_WIND_SPEED = 0.01;     // Vitesse vent minimale (m/s)

// === GÉOMÉTRIE MAILLES ===
export const TRIANGLES_BASE = 4;        // Base calcul fractale (4^(level+1))
```

### 💨 WindConfig **(NOUVEAU NAMESPACE)**
```typescript
// Système Vent
export const PRIORITY = 20;              // Priorité ECS (avant Aéro=30)

// === SYNCHRONISATION UI ===
export const UPDATE_INTERVAL = 100;      // Intervalle mise à jour (ms)

// === SEUILS DE CHANGEMENT ===
export const SPEED_CHANGE_THRESHOLD = 0.01;       // Seuil vitesse (m/s)
export const DIRECTION_CHANGE_THRESHOLD = 0.1;    // Seuil direction (°)
export const TURBULENCE_CHANGE_THRESHOLD = 0.1;   // Seuil turbulence (%)

// === TURBULENCE ===
export const VERTICAL_TURBULENCE_FACTOR = 0.3;    // Réduction turbulence verticale
export const MINIMUM_WIND_SPEED = 0.01;           // Vitesse min calcul direction (m/s)

// === DÉFAUTS ===
export const DEFAULT_WIND_SPEED_MS = 5.56;        // Vitesse vent défaut (~20 km/h)
export const DEFAULT_WIND_DIRECTION = 0;          // Direction vent défaut (Est)
export const DEFAULT_TURBULENCE = 10;             // Turbulence défaut (%)
```

---

## 🔄 Utilisation Pattern

### Standard (Recommended)
```typescript
import { ConfigNamespace } from '../config/Config';

// ✅ Utilisation directe
const value = ConfigNamespace.CONSTANT_NAME;

// ✅ Exemple réel
import { PhysicsConstants, AeroConfig } from '../config/Config';
const gravity = new THREE.Vector3(0, -PhysicsConstants.GRAVITY, 0);
const q = AeroConfig.DYNAMIC_PRESSURE_COEFF * aero.airDensity;
```

### Alternative (CONFIG Object)
```typescript
import { CONFIG } from '../config/Config';

// ✅ Alternative via object
const value = CONFIG.simulation.targetFPS;
```

---

## 📊 Statistiques

- **Total Namespaces** : 13
- **Total Constantes** : ~160
- **Namespaces Créés (Phase 2)** : UIConfig, WindConfig
- **Constantes Centralisées** : ~70 (Phase 1 + 2)
- **Constantes Bonus** : MIN_FORCE_ARROW_DISPLAY, MAX_FORCE_ARROW_LENGTH
- **Fichiers Modifiés** : 8
- **Validation** : ✅ 0 TypeScript errors

---

## 🎯 Access Pattern Guide

| Domaine | Namespace | Exemple |
|---------|-----------|---------|
| **Physique** | `PhysicsConstants` | `GRAVITY`, `AIR_DENSITY` |
| **Géométrie Kite** | `KiteSpecs` | `WINGSPAN_M`, `CENTER_HEIGHT_RATIO` |
| **Aérodynamique** | `AeroConfig` | `DYNAMIC_PRESSURE_COEFF`, `OSWALD_EFFICIENCY` |
| **Rendu 3D** | `RenderConfig` | `CAMERA_POSITION_X`, `CAMERA_LOOKAT_X` |
| **Debug Visual** | `DebugConfig` | `FORCE_VECTOR_SCALE`, `CANVAS_SMALL_SIZE` |
| **Interface UI** | `UIConfig` | `PRIORITY`, `MIN_WIND_SPEED`, `TRIANGLES_BASE` |
| **Système Vent** | `WindConfig` | `UPDATE_INTERVAL`, `VERTICAL_TURBULENCE_FACTOR` |
| **Environnement** | `EnvironmentConfig` | `WIND_SPEED_M_S`, `WIND_TURBULENCE_PERCENT` |
| **Contraintes** | `LineSpecs`, `BridleConfig` | `LENGTH_M`, `LENGTH_NEZ_M` |

---

**Config.ts = Single Source of Truth for ALL Constants ✅**
