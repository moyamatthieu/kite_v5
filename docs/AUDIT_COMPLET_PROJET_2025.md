# AUDIT COMPLET PROJET KITE — 7 Octobre 2025

## 🚨 PROBLÈME CRITIQUE IDENTIFIÉ

### Symptôme Principal
**Le kite ne vole PAS correctement** malgré les corrections Phases 1-3.

### Diagnostic Immédiat
**Ratio Lift/Weight = 1.43 au lieu de 9.9 attendu !**

```
À 20 km/h, angle d'attaque 30° :
- Gravité : 3.04 N ⬇️
- Lift calculé : 4.35 N ⬆️ (avec liftScale=2.0)
- Ratio L/W : 1.43 (CRITIQUE : devrait être ~10)
```

**Conséquence** : Le kite **tombe** au lieu de voler car lift < 2× gravity !

---

## 🔍 ANALYSE ROOT CAUSE

### BUG MAJEUR : Décomposition Lift/Drag Incorrecte

**Fichier** : `src/simulation/physics/AerodynamicsCalculator.ts`  
**Lignes** : 160-162

```typescript
// ACTUEL (FAUX) :
const dragMagnitude = force.dot(windDir); // Projection sur direction vent
const drag = windDir.clone().multiplyScalar(dragMagnitude);
const lift = force.clone().sub(drag); // Lift = force - drag
```

**Problème** : Cette décomposition est **géométriquement incorrecte** !

#### Analyse Mathématique

Pour une **plaque plane** avec force normale `F_n = q × A × sin²(α)` :

**Formules CORRECTES** (Hoerner, "Fluid Dynamic Drag") :
```
C_L = sin(α) × cos(α)     → Lift coefficient
C_D = sin²(α)              → Drag coefficient

F_L = q × A × sin(α) × cos(α)
F_D = q × A × sin²(α)
```

**Décomposition vectorielle actuelle** (FAUSSE) :
```
F_n = q × A × sin²(α) × normale
drag = F_n · windDir = q × A × sin²(α) × |cos(α)| = q × A × sin²(α) × cos(α)
lift = F_n - drag (résidu vectoriel)
```

**Erreur** : `drag = sin²(α) × cos(α)` au lieu de `sin²(α)` !

#### Validation Numérique

À α = 30° :
```
SIN²(30°) = 0.25
COS(30°) = 0.866

ATTENDU (formules correctes) :
  C_L = sin(30°)×cos(30°) = 0.5 × 0.866 = 0.433
  C_D = sin²(30°) = 0.25
  F_L = 18.93 × 0.53 × 0.433 = 4.34 N
  F_D = 18.93 × 0.53 × 0.25 = 2.51 N

ACTUEL (décomposition vectorielle) :
  F_n = 18.93 × 0.53 × 0.25 = 2.51 N (force normale totale)
  drag = 2.51 × 0.866 = 2.17 N (composante // vent)
  lift = sqrt(2.51² - 2.17²) = 1.25 N (composante ⊥ vent)
  
ÉCART :
  Lift: 1.25 N au lieu de 4.34 N → ÷3.5 !
  Drag: 2.17 N au lieu de 2.51 N → correct par hasard
```

**Conséquence** : Le lift est **3.5× trop faible** !

---

## 📊 CALCULS PHYSIQUES ATTENDUS VS RÉELS

### Paramètres Actuels

| Paramètre | Valeur | Unité |
|-----------|--------|-------|
| Masse | 0.31 | kg |
| Aire totale | 0.53 | m² |
| Inertie effective | 0.127 | kg·m² |
| Vent | 20 | km/h (5.56 m/s) |
| Pression dynamique (q) | 18.93 | Pa |
| Gravité | 3.04 | N |

### Forces Aérodynamiques (α = 30°)

| Méthode | Lift (N) | Drag (N) | L/W | Vol Possible? |
|---------|----------|----------|-----|---------------|
| **ATTENDU** (Hoerner) | **4.34** | **2.51** | **1.43** | ❌ NON |
| **+ liftScale=2.0** | **8.68** | **2.51** | **2.85** | ⚠️ Limite |
| **ACTUEL** (décompo vecto) | **1.25** | **2.17** | **0.41** | ❌ NON |
| **+ liftScale=2.0** | **2.50** | **3.26** | **0.82** | ❌ NON |

**Conclusion** : Même avec liftScale=2.0, le lift actuel est **INSUFFISANT** !

### Ratio L/W Requis pour Vol

Pour qu'un kite **monte** au zénith :
```
Lift > Gravité  (condition minimale)
Lift ≈ 2-3 × Gravité  (vol stable)
Lift ≈ 10 × Gravité  (performance typique)
```

**Actuellement** : L/W = 0.82 → **Kite tombe immédiatement**

---

## 🐛 LISTE COMPLÈTE DES BUGS

### BUG #4 : Décomposition Lift/Drag Fausse (CRITIQUE)

**Fichier** : `AerodynamicsCalculator.ts` lignes 160-162  
**Impact** : Lift ÷3.5 trop faible  
**Priorité** : 🔴 **CRITIQUE** (empêche le vol)

**Code actuel** :
```typescript
const dragMagnitude = force.dot(windDir);
const drag = windDir.clone().multiplyScalar(dragMagnitude);
const lift = force.clone().sub(drag);
```

**Correction requise** :
```typescript
// Utiliser coefficients de plaque plane directement
const CL = sinAlpha * cosAlpha;  // Coefficient lift
const CD = sinAlpha * sinAlpha;   // Coefficient drag

// Directions
const liftDir = windFacingNormal.clone().projectOnPlane(windDir).normalize();
const dragDir = windDir.clone();

// Forces (AVANT scaling)
const liftMagnitude = dynamicPressure * surface.area * CL;
const dragMagnitude = dynamicPressure * surface.area * CD;

const lift = liftDir.multiplyScalar(liftMagnitude);
const drag = dragDir.multiplyScalar(dragMagnitude);
```

### BUG #5 : Accumulation Lift/Drag Locale Fausse

**Fichier** : `AerodynamicsCalculator.ts` lignes 160-165  
**Impact** : Les lift/drag locaux (par surface) sont faux mais inutilisés  
**Priorité** : ⚠️ Mineur (n'affecte pas physique, juste debug)

Les variables `lift` et `drag` locales (lignes 160-162) sont calculées mais **ne sont PAS utilisées** ! Elles sont ajoutées au `surfaceForces` pour debug uniquement.

### BUG #6 : liftScale/dragScale Insuffisants

**Fichier** : `SimulationConfig.ts` lignes 46-47  
**Impact** : Même après scaling, forces trop faibles  
**Priorité** : 🔴 CRITIQUE

**Valeurs actuelles** :
```typescript
liftScale: 2.0,
dragScale: 1.5,
```

**Problème** : Avec la décomposition fausse, même `liftScale=10` ne suffirait pas !

**Solution** : Corriger d'abord Bug #4, puis ajuster scales

---

## 🔧 PLAN DE CORRECTION

### Phase 4 : Corriger Aérodynamique (URGENT)

#### Correction 4.1 : Implémenter Coefficients Plaque Plane

**Objectif** : Calculer lift/drag avec formules physiques correctes

**Étapes** :

1. **Calculer coefficients** à partir de l'angle d'attaque :
```typescript
// Pour chaque surface
const sinAlpha = cosTheta;  // Déjà calculé
const cosAlpha = Math.sqrt(1 - sinAlpha * sinAlpha);

const CL = sinAlpha * cosAlpha;  // Coefficient lift
const CD = sinAlpha * sinAlpha;   // Coefficient drag = CN
```

2. **Déterminer directions lift/drag** :
```typescript
// Drag : direction du vent
const dragDir = windDir.clone();

// Lift : perpendiculaire au vent, dans le plan (vent, normale)
const liftDir = new THREE.Vector3()
  .crossVectors(windDir, new THREE.Vector3().crossVectors(windFacingNormal, windDir))
  .normalize();
  
// Vérifier validité
if (liftDir.lengthSq() < 0.01) {
  liftDir.copy(windFacingNormal);  // Fallback
}
```

3. **Calculer forces** :
```typescript
const liftMagnitude = dynamicPressure * surface.area * CL;
const dragMagnitude = dynamicPressure * surface.area * CD;

const liftForce = liftDir.clone().multiplyScalar(liftMagnitude);
const dragForce = dragDir.clone().multiplyScalar(dragMagnitude);

// Force normale = lift + drag (vectoriel)
const force = liftForce.clone().add(dragForce);
```

4. **Accumuler séparément** :
```typescript
// Accumuler par TYPE de force (pas par surface)
totalLift.add(liftForce);
totalDrag.add(dragForce);
aeroForce.add(force);  // Pour calcul couple
```

#### Correction 4.2 : Décomposition Globale Correcte

**Remplacer** lignes 238-243 :
```typescript
// ANCIEN (FAUX)
const globalDragComponent = aeroForce.dot(windDir);
const globalDrag = windDir.clone().multiplyScalar(globalDragComponent);
const globalLift = aeroForce.clone().sub(globalDrag);

// NOUVEAU (CORRECT)
// Les lift/drag sont déjà calculés correctement par surface
// Pas besoin de décomposition globale !
const lift = totalLift.multiplyScalar(CONFIG.aero.liftScale);
const drag = totalDrag.multiplyScalar(CONFIG.aero.dragScale);
```

#### Correction 4.3 : Ajuster Scaling Factors

Après correction Bug #4, recalculer scales nécessaires :

```
FORMULES CORRECTES :
  Lift brut (α=30°) = 4.34 N
  Drag brut (α=30°) = 2.51 N
  
Pour L/W = 10 :
  Lift requis = 3.04 × 10 = 30.4 N
  liftScale requis = 30.4 / 4.34 = 7.0
  
Pour vol stable (L/W ≈ 3-5) :
  liftScale ≈ 3.0 - 5.0
```

**Recommandation** :
```typescript
liftScale: 4.0,  // Au lieu de 2.0
dragScale: 1.5,  // Inchangé
```

---

## 📈 VALIDATION ATTENDUE

### Après Correction Bug #4

**À α = 30°, vent 20 km/h** :

| Paramètre | Avant | Après | Objectif |
|-----------|-------|-------|----------|
| Lift brut | 1.25 N | **4.34 N** | 4-5 N ✅ |
| Drag brut | 2.17 N | **2.51 N** | 2-3 N ✅ |
| Lift scalé (×4.0) | 2.50 N | **17.4 N** | 15-20 N ✅ |
| Ratio L/W | 0.82 | **5.7** | 5-10 ✅ |

### Comportement Attendu

✅ **Kite monte** progressivement vers zénith (y: 5m → 15m)  
✅ **Se stabilise** au sommet (angle d'attaque → 0°, lift → 0)  
✅ **Lignes tendues** (≥ 75N) en permanence  
✅ **Réagit aux commandes** (rotation + déplacement sur sphère)

---

## 🎯 AUTRES PROBLÈMES IDENTIFIÉS

### Problème Secondaire #1 : Force Smoothing Trop Faible

**Fichier** : `KiteController.ts` ligne 55  
**Valeur actuelle** : `forceSmoothingRate = 0.1`

**Impact** : Quasi aucun lissage → forces peuvent être brutales

**Recommandation** : Après correction Bug #4, tester avec `rate = 1.0 - 5.0`

### Problème Secondaire #2 : Inertie Factor 0.3

**Fichier** : `KiteGeometry.ts` ligne 407  
**Valeur actuelle** : `return physicalInertia * 0.3`

**Impact** : Inertie artificiellement réduite → rotation trop rapide possible

**Recommandation** : Après validation vol, tester `factor = 0.4 - 0.5`

### Problème Secondaire #3 : Masses Surfaces Déséquilibrées?

**Fichier** : `KiteGeometry.ts` lignes 280-350

**À vérifier** : Distribution masse frame est-elle cohérente?

```typescript
// Surface 0 (haute gauche) : doit avoir leading edge + strut
// Surface 3 (basse droite) : seulement strut
// → Masse surface 0 > masse surface 3 (attendu)
```

**Action** : Ajouter console.log pour vérifier masses par surface

---

## 📝 RÉCAPITULATIF PRIORITÉS

### 🔴 CRITIQUE (Bloque Vol)

1. **BUG #4** : Décomposition lift/drag fausse → Corriger immédiatement
2. **BUG #6** : liftScale insuffisant → Ajuster à 4.0 après Bug #4

### ⚠️ IMPORTANT (Affine Vol)

3. **Force smoothing** : Réactiver progressivement (0.1 → 1.0 → 5.0)
4. **Inertia factor** : Augmenter légèrement (0.3 → 0.4)

### 🟢 NICE-TO-HAVE (Optimisations)

5. **BUG #5** : Lift/drag locaux debug (corriger pour cohérence)
6. **Vérifier masses** : Ajouter logs distribution masses surfaces

---

## 🚀 PROCHAINES ÉTAPES

### Étape 1 : Corriger Bug #4 (1-2h)
- Implémenter coefficients CL/CD
- Calculer liftDir/dragDir correctement
- Accumuler totalLift/totalDrag
- Tester calculs avec console.log

### Étape 2 : Ajuster Scaling (30min)
- liftScale = 4.0
- Tester vol → vérifier montée au zénith

### Étape 3 : Affiner Paramètres (1h)
- forceSmoothingRate = 1.0 - 5.0
- inertiaFactor = 0.4 - 0.5
- Valider comportement stable

### Étape 4 : Validation Complète (30min)
- Checklist comportement attendu
- Mesures métriques UI
- Documentation résultats

---

## 📚 DOCUMENTATION CRÉÉE

- `docs/AUDIT_COMPARATIF_MAIN_VS_FIX.md` — Analyse comparative
- `docs/CORRECTIONS_RESTAURATION_VOL.md` — Corrections Phases 1-3
- `docs/COMPORTEMENT_PHYSIQUE_REEL.md` — Modèle physique
- `docs/AUDIT_COMPLET_PROJET_2025.md` — **CE FICHIER** (diagnostic complet)

---

## ✅ CONCLUSION

### Cause Principale

**Décomposition lift/drag vectorielle FAUSSE** → Lift ÷3.5 trop faible

### Solution

**Utiliser coefficients plaque plane** (CL = sin×cos, CD = sin²)

### Impact Attendu

**Ratio L/W : 0.82 → 5.7** → Kite volera correctement ! 🪁
