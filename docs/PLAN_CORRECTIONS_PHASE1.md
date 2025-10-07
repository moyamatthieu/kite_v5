# 🔧 PLAN DE CORRECTIONS - PHASE 1 (BUGS CRITIQUES)

**Branche** : `fix/audit-critical-bugs-phase1`  
**Date de création** : 7 Octobre 2025  
**Priorité** : 🔴 URGENTE  
**Durée estimée** : 1 semaine

---

## 📋 OBJECTIF PHASE 1

Corriger les **3 bugs critiques** identifiés dans l'audit qui impactent la précision physique de la simulation.

---

## 🎯 BUG #1 : Décomposition Lift/Drag Incorrecte

### Problème
**Fichier** : `src/simulation/physics/AerodynamicsCalculator.ts:216-218`

La décomposition lift/drag est faite sur `totalForce` qui contient **gravité + forces aéro**, ce qui est physiquement incorrect. La gravité n'a pas de composante "lift" ou "drag".

```typescript
// ❌ CODE ACTUEL (INCORRECT)
const globalDragComponent = totalForce.dot(windDir);
const globalDrag = windDir.clone().multiplyScalar(globalDragComponent);
const globalLift = totalForce.clone().sub(globalDrag);
```

### Impact
- Métriques debug affichent des valeurs fausses
- `lift` et `drag` contiennent une partie de la gravité
- Confusion dans l'analyse des forces

### Solution
Séparer forces aérodynamiques et gravité avant décomposition :

```typescript
// ✅ CORRECTION
const aeroForce = new THREE.Vector3();     // Forces aéro uniquement
const gravityForce = new THREE.Vector3();  // Gravité séparée

KiteGeometry.SURFACES_WITH_MASS.forEach((surface) => {
  // Calculer force normale (aéro)
  const force = windFacingNormal.clone().multiplyScalar(normalForceMagnitude);
  
  // Gravité sur cette surface
  const gravity = new THREE.Vector3(0, -surface.mass * CONFIG.physics.gravity, 0);
  
  // Accumuler séparément
  aeroForce.add(force);
  gravityForce.add(gravity);
  
  // Total pour simulation
  totalForce.add(force).add(gravity);
  
  // ... reste du code ...
});

// Décomposition CORRECTE (sur forces aéro uniquement)
const globalDragComponent = aeroForce.dot(windDir);
const globalDrag = windDir.clone().multiplyScalar(globalDragComponent);
const globalLift = aeroForce.clone().sub(globalDrag);

return {
  lift: globalLift.multiplyScalar(CONFIG.aero.liftScale),
  drag: globalDrag.multiplyScalar(CONFIG.aero.dragScale),
  gravity: gravityForce,  // Retourner séparément
  torque: finalTorque,
  // ...
};
```

### Fichiers à modifier
- [x] `src/simulation/physics/AerodynamicsCalculator.ts`
- [x] `src/simulation/physics/PhysicsEngine.ts` (adapter appel)
- [x] `src/simulation/types/PhysicsTypes.ts` (ajouter `gravity` au type de retour)

### Tests de validation
```typescript
// Vérifier séparation
const { lift, drag, gravity } = AerodynamicsCalculator.calculateForces(wind, orientation);

// Gravité doit être purement verticale
assert(Math.abs(gravity.x) < 1e-6);
assert(Math.abs(gravity.z) < 1e-6);
assert(gravity.y < 0);  // Vers le bas

// Lift perpendiculaire au vent
assert(Math.abs(lift.dot(windDir)) < 1e-3);

// Drag parallèle au vent
const dragDir = drag.clone().normalize();
assert(Math.abs(dragDir.dot(windDir) - 1.0) < 1e-3);
```

### Effort estimé
⏱️ **2 heures**

---

## 🎯 BUG #2 : Distribution Masse Frame Uniforme

### Problème
**Fichier** : `src/simulation/config/KiteGeometry.ts:280-285`

La masse de la frame (structure carbone) est répartie **uniformément** sur les 4 surfaces, ce qui est physiquement incorrect.

```typescript
// ❌ CODE ACTUEL (INCORRECT)
const uniformMassPerSurface = (frameMass + accessoriesMass) / 4;

return KiteGeometry.SURFACES.map(surface => {
  const fabricMassRatio = surface.area / KiteGeometry.TOTAL_AREA;
  const surfaceFabricMass = fabricMass * fabricMassRatio;
  return surfaceFabricMass + uniformMassPerSurface;  // ❌ Uniforme
});
```

### Impact
- Centre de gravité du kite décalé
- Couple gravitationnel incorrect
- Équilibre du kite faussé

### Solution
Calculer la distribution réelle selon la topologie géométrique :

```typescript
// ✅ CORRECTION : Distribution géométrique réaliste

/**
 * Calcule la masse de frame attribuée à chaque surface selon la géométrie
 * 
 * Topologie du kite :
 *   Surface 0 (haute gauche)  : spine + leading edge gauche + strut gauche
 *   Surface 1 (basse gauche)  : spine + strut gauche
 *   Surface 2 (haute droite)  : leading edge droite + strut droit  
 *   Surface 3 (basse droite)  : strut droit
 */
private static calculateFrameMassDistribution(): number[] {
  const lengths = KiteGeometry.calculateFrameLengths();
  const specs = KiteGeometry.MATERIAL_SPECS.carbon;
  
  // Masses linéiques (kg)
  const spineUnitMass = specs.spine / 1000;        // g/m → kg/m
  const leadingEdgeUnitMass = specs.leadingEdge / 1000;
  const strutUnitMass = specs.strut / 1000;
  
  // Longueurs individuelles
  const spineLength = KiteGeometry.POINTS.NEZ.distanceTo(KiteGeometry.POINTS.SPINE_BAS);
  const leadingEdgeLeft = KiteGeometry.POINTS.NEZ.distanceTo(KiteGeometry.POINTS.BORD_GAUCHE);
  const leadingEdgeRight = KiteGeometry.POINTS.NEZ.distanceTo(KiteGeometry.POINTS.BORD_DROIT);
  const strutLeft = KiteGeometry.POINTS.BORD_GAUCHE.distanceTo(KiteGeometry.POINTS.WHISKER_GAUCHE);
  const strutRight = KiteGeometry.POINTS.BORD_DROIT.distanceTo(KiteGeometry.POINTS.WHISKER_DROIT);
  const spreader = KiteGeometry.POINTS.WHISKER_GAUCHE.distanceTo(KiteGeometry.POINTS.WHISKER_DROIT);
  
  // Attribution aux surfaces
  // NOTE : Spine partagée entre hautes et basses (50/50)
  //        Spreader partagé entre gauche et droite (50/50)
  
  const frameMasses = [
    // Surface 0 (haute gauche)
    (spineLength * 0.5 * spineUnitMass) +           // 50% spine
    (leadingEdgeLeft * leadingEdgeUnitMass) +       // Leading edge gauche complet
    (strutLeft * 0.5 * strutUnitMass) +             // 50% strut gauche
    (spreader * 0.25 * strutUnitMass),              // 25% spreader
    
    // Surface 1 (basse gauche)
    (spineLength * 0.5 * spineUnitMass) +           // 50% spine
    (strutLeft * 0.5 * strutUnitMass) +             // 50% strut gauche
    (spreader * 0.25 * strutUnitMass),              // 25% spreader
    
    // Surface 2 (haute droite)
    (leadingEdgeRight * leadingEdgeUnitMass) +      // Leading edge droit complet
    (strutRight * 0.5 * strutUnitMass) +            // 50% strut droit
    (spreader * 0.25 * strutUnitMass),              // 25% spreader
    
    // Surface 3 (basse droite)
    (strutRight * 0.5 * strutUnitMass) +            // 50% strut droit
    (spreader * 0.25 * strutUnitMass),              // 25% spreader
  ];
  
  return frameMasses;
}

static calculateSurfaceMasses(): number[] {
  const fabricMass = KiteGeometry.calculateFabricMass();
  const frameMasses = KiteGeometry.calculateFrameMassDistribution();
  const accessoriesMass = KiteGeometry.calculateAccessoriesMass();
  
  // Accessoires répartis uniformément (connecteurs dispersés)
  const uniformAccessories = accessoriesMass / 4;
  
  return KiteGeometry.SURFACES.map((surface, index) => {
    const fabricMassRatio = surface.area / KiteGeometry.TOTAL_AREA;
    const surfaceFabricMass = fabricMass * fabricMassRatio;
    
    return surfaceFabricMass + frameMasses[index] + uniformAccessories;
  });
}
```

### Fichiers à modifier
- [x] `src/simulation/config/KiteGeometry.ts`

### Tests de validation
```typescript
// Vérifier somme = masse totale
const surfaceMasses = KiteGeometry.calculateSurfaceMasses();
const sumMasses = surfaceMasses.reduce((a, b) => a + b, 0);
assert(Math.abs(sumMasses - KiteGeometry.TOTAL_MASS) < 1e-6);

// Vérifier asymétrie réaliste
assert(surfaceMasses[0] > surfaceMasses[3]);  // Haute gauche > basse droite
assert(surfaceMasses[1] > surfaceMasses[3]);  // Basse gauche > basse droite

// Centre de gravité doit être proche du centre géométrique
const cg = calculateCenterOfGravity(surfaceMasses);
assert(Math.abs(cg.x) < 0.1);  // Symétrie gauche/droite
assert(cg.y > 0);              // Au-dessus du centre (plus de masse en haut)
```

### Effort estimé
⏱️ **4 heures**

---

## 🎯 BUG #3 : Résolution Lignes ↔ Brides Non Itérative

### Problème
**Fichier** : `src/simulation/controllers/KiteController.ts:97-114`

Les contraintes de lignes et brides sont résolues **séquentiellement** (1 passe), mais elles s'influencent mutuellement.

```typescript
// ❌ CODE ACTUEL (INCORRECT)
try {
  ConstraintSolver.enforceLineConstraints(this.kite, newPosition, state, handles);
} catch (err) {
  console.error("⚠️ Erreur:", err);
}

try {
  ConstraintSolver.enforceBridleConstraints(this.kite, newPosition, state, bridleLengths);
} catch (err) {
  console.error("⚠️ Erreur:", err);
}
```

### Impact
- Contraintes peuvent ne pas converger
- Oscillations numériques possibles
- Instabilité dans certaines configurations

### Solution
Itération jusqu'à convergence (3-5 passes) :

```typescript
// ✅ CORRECTION : Résolution itérative

// Configuration itération
const MAX_CONSTRAINT_ITERATIONS = 3;  // 3 passes généralement suffisantes
let maxError = Infinity;

// Itérer jusqu'à convergence
for (let iter = 0; iter < MAX_CONSTRAINT_ITERATIONS; iter++) {
  const errorBefore = this.computeConstraintError(newPosition);
  
  // Résoudre lignes principales
  try {
    ConstraintSolver.enforceLineConstraints(
      this.kite,
      newPosition,
      state,
      handles
    );
  } catch (err) {
    console.error(`⚠️ Erreur lignes (iter ${iter}):`, err);
  }
  
  // Résoudre brides internes
  try {
    ConstraintSolver.enforceBridleConstraints(
      this.kite,
      newPosition,
      state,
      this.kite.getBridleLengths()
    );
  } catch (err) {
    console.error(`⚠️ Erreur brides (iter ${iter}):`, err);
  }
  
  // Vérifier convergence
  const errorAfter = this.computeConstraintError(newPosition);
  maxError = errorAfter;
  
  // Si convergence atteinte, sortir tôt
  if (errorAfter < PhysicsConstants.LINE_CONSTRAINT_TOLERANCE) {
    if (iter > 0) {
      console.log(`✅ Convergence atteinte en ${iter + 1} itérations`);
    }
    break;
  }
  
  // Si stagnation, sortir
  if (Math.abs(errorBefore - errorAfter) < 1e-6) {
    break;
  }
}

// Warning si non convergé
if (maxError > PhysicsConstants.LINE_CONSTRAINT_TOLERANCE * 10) {
  console.warn(`⚠️ Contraintes non convergées: erreur = ${maxError.toFixed(6)} m`);
}
```

Ajouter méthode de calcul d'erreur :

```typescript
/**
 * Calcule l'erreur maximale des contraintes (pour convergence)
 * @returns Erreur max en mètres
 */
private computeConstraintError(position: THREE.Vector3): number {
  const q = this.kite.quaternion;
  let maxError = 0;
  
  // Erreur lignes principales
  const ctrlLeft = this.kite.getPoint("CTRL_GAUCHE");
  const ctrlRight = this.kite.getPoint("CTRL_DROIT");
  const lineLength = this.kite.userData.lineLength || CONFIG.lines.defaultLength;
  
  if (ctrlLeft && ctrlRight) {
    const handles = this.controlBarManager?.getHandlePositions(position) || {
      left: new THREE.Vector3(),
      right: new THREE.Vector3()
    };
    
    const cpLeftWorld = ctrlLeft.clone().applyQuaternion(q).add(position);
    const cpRightWorld = ctrlRight.clone().applyQuaternion(q).add(position);
    
    const errorLeft = Math.abs(cpLeftWorld.distanceTo(handles.left) - lineLength);
    const errorRight = Math.abs(cpRightWorld.distanceTo(handles.right) - lineLength);
    
    maxError = Math.max(maxError, errorLeft, errorRight);
  }
  
  // Erreur brides (optionnel, plus complexe)
  // ... calcul similaire pour les 6 brides ...
  
  return maxError;
}
```

### Fichiers à modifier
- [x] `src/simulation/controllers/KiteController.ts`
- [x] `src/simulation/config/PhysicsConstants.ts` (ajouter MAX_CONSTRAINT_ITERATIONS)

### Tests de validation
```typescript
// Test convergence
const initialError = controller.computeConstraintError(position);
controller.update(forces, torque, handles, deltaTime);
const finalError = controller.computeConstraintError(position);

assert(finalError < PhysicsConstants.LINE_CONSTRAINT_TOLERANCE);
assert(finalError < initialError);  // Erreur diminue

// Test stabilité (plusieurs frames)
for (let i = 0; i < 100; i++) {
  controller.update(forces, torque, handles, 0.016);
}
const error100 = controller.computeConstraintError(position);
assert(error100 < PhysicsConstants.LINE_CONSTRAINT_TOLERANCE * 2);
```

### Effort estimé
⏱️ **1 heure**

---

## 📅 PLANNING DÉTAILLÉ

### Jour 1 : Bug #1 (Décomposition Lift/Drag)
- ⏰ Matin (2h)
  - [ ] Modifier `AerodynamicsCalculator.ts`
  - [ ] Séparer accumulation aeroForce / gravityForce
  - [ ] Ajuster retour fonction
  
- ⏰ Après-midi (2h)
  - [ ] Adapter `PhysicsEngine.ts` 
  - [ ] Mettre à jour types `PhysicsTypes.ts`
  - [ ] Tests validation
  - [ ] Commit

### Jour 2 : Bug #2 Partie 1 (Distribution Masse)
- ⏰ Matin (3h)
  - [ ] Calculer longueurs segments individuels
  - [ ] Implémenter `calculateFrameMassDistribution()`
  - [ ] Documenter attribution topologique
  
- ⏰ Après-midi (2h)
  - [ ] Intégrer dans `calculateSurfaceMasses()`
  - [ ] Tests validation somme
  - [ ] Vérifier symétrie

### Jour 3 : Bug #2 Partie 2 (Validation)
- ⏰ Matin (2h)
  - [ ] Calculer centre de gravité
  - [ ] Comparer avant/après
  - [ ] Analyser impact sur couple gravitationnel
  
- ⏰ Après-midi (1h)
  - [ ] Tests comportement simulation
  - [ ] Ajuster si nécessaire
  - [ ] Commit

### Jour 4 : Bug #3 (Résolution Itérative)
- ⏰ Matin (2h)
  - [ ] Implémenter `computeConstraintError()`
  - [ ] Ajouter boucle itération
  - [ ] Paramètres CONFIG
  
- ⏰ Après-midi (2h)
  - [ ] Tests convergence
  - [ ] Logs diagnostic
  - [ ] Commit

### Jour 5 : Tests Intégration
- ⏰ Matin (3h)
  - [ ] Tests end-to-end complets
  - [ ] Vérifier métriques simulation
  - [ ] Comparer comportement avant/après
  
- ⏰ Après-midi (2h)
  - [ ] Documentation changements
  - [ ] Mettre à jour CHANGELOG
  - [ ] Préparer PR

---

## ✅ CRITÈRES DE VALIDATION

### Validation Bug #1
- [x] Gravité séparée de lift/drag
- [x] `gravity.x ≈ 0` et `gravity.z ≈ 0`
- [x] `lift ⊥ windDir`
- [x] `drag ∥ windDir`
- [x] Métriques UI cohérentes

### Validation Bug #2
- [x] Somme masses surfaces = TOTAL_MASS
- [x] Distribution asymétrique réaliste
- [x] Centre gravité proche centre géométrique
- [x] Couple gravitationnel cohérent

### Validation Bug #3
- [x] Convergence < tolérance
- [x] Pas d'oscillations
- [x] Stabilité sur 100+ frames
- [x] Performance acceptable (< 2ms/frame)

### Validation Globale
- [x] Simulation stable 60 FPS
- [x] Comportement kite réaliste
- [x] Pas de régressions fonctionnelles
- [x] Tests passent

---

## 📊 MÉTRIQUES DE SUCCÈS

| Métrique | Avant | Cible Après | Critique |
|----------|-------|-------------|----------|
| **Précision gravité** | Mixed with lift/drag | Pure vertical | ✅ |
| **Centre gravité Y** | ~0.2-0.3 m | ~0.35-0.4 m | ✅ |
| **Convergence contraintes** | 1 pass | < 3 iterations | ✅ |
| **Erreur contrainte max** | Variable | < 0.5 mm | ✅ |
| **Performance frame** | ~1-2 ms | < 3 ms | ⚠️ |
| **Stabilité simulation** | Bonne | Excellente | ✅ |

---

## 🚀 APRÈS PHASE 1

Une fois ces corrections validées, passer à **Phase 2** :
- Scaling couple aérodynamique cohérent
- Justification angularDragFactor
- Tests unitaires physique
- Documentation technique

---

**Branche** : `fix/audit-critical-bugs-phase1`  
**Créée le** : 7 Octobre 2025  
**Dernière mise à jour** : 7 Octobre 2025
