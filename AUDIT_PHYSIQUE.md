# 🔍 Audit Complet de la Physique - Kite V5

**Date**: 19 octobre 2025  
**Objectif**: Vérifier toutes les formules, constantes et logique de calcul pour détecter bugs et erreurs

---

## 📋 TABLE DES MATIÈRES

1. [Configuration (Config.ts)](#configuration)
2. [Initialisation (Factories)](#initialisation)
3. [Aérodynamique (AeroSystem)](#aérodynamique)
4. [Physique des Lignes (ConstraintSystem)](#contraintes)
5. [Intégration Numérique (PhysicsSystem)](#physique)
6. [Bridles (BridleConstraintSystem)](#bridles)
7. [Vent (WindSystem)](#vent)
8. [Résumé des Bugs](#résumé-des-bugs)

---

## Configuration

### ✅ Config.ts - Valeurs initiales

**Kite (masse = 0.12 kg)**
```
mass: 0.12 kg ✓
wingspan: 1.65 m ✓
chord: 0.65 m ✓
surfaceArea: 0.54 m² 
  → Calcul: 1.65 × 0.65 × 0.5 = 0.536 m² ✓ (arrondi acceptable)
```

**Inertie (delta wing approximation)**
```
Ixx: 0.015 kg⋅m² (rotation x, pitch)
Iyy: 0.020 kg⋅m² (rotation y, yaw)
Izz: 0.005 kg⋅m² (rotation z, roll)
```

⚠️ **ERREUR À VÉRIFIER**: Ces valeurs d'inertie sont-elles correctes ?
- Pour une plaque rectangulaire: I = (1/12) × m × (a² + b²)
- Pour un delta: approximativement I ≈ (1/12) × m × surface × (wingspan²)
- Ixx = (1/12) × 0.12 × (1.65²) ≈ 0.027 m² (NOTRE: 0.015 = trop petit !)
- Iyy = (1/12) × 0.12 × (0.65²) ≈ 0.004 m² (NOTRE: 0.020 = trop grand !)
- Izz = (1/12) × 0.12 × ((0.65² + 1.65²)/2) ≈ 0.040 m² (NOTRE: 0.005 = BEAUCOUP trop petit !)

**ACTION**: Recalculer l'inertie correctement !

**Lignes**
```
stiffness: 4 N/m
damping: 0.5 N·s/m
maxTension: 10 N
```
✓ Ces valeurs semblent raisonnables après tuning.

**Aérodynamique**
```
airDensity: 1.225 kg/m³ ✓
CL0: 0.0 ✓
CLAlpha: 0.105 /deg
  → Pour un angle 10°: CL = 0.105 × 10 = 1.05 ✓ (réaliste pour kite)
CD0: 0.08 ✓
alphaOptimal: 12° ✓
```

⚠️ **QUESTION**: CL et CD sont-ils appliqués correctement ? Voir AeroSystem.

---

## Initialisation

### KiteFactory.ts

**Position initiale du kite**
```typescript
Position: (controlBar.x, controlBar.y + kiteAltitude, controlBar.z + kiteDistance)
        = (0, 1 + 10, -0.6 + 15)
        = (0, 11, 14.4) ✓
```

**Orientation initiale**
```
pitch: 5°  → Angle d'attaque faible (bon pour stabilité)
yaw: 0°    → Face au vent
roll: 0°   → Plat
```

✓ Semble bon.

**Vitesse initiale**
```typescript
velocity: new THREE.Vector3(0, 0, 0) ✓
```

⚠️ **QUESTION**: Le kite start avec v=0 mais le vent souffle. Est-ce réaliste ?

**Forces initiales**
```typescript
forces: new THREE.Vector3(0, 0, 0) ✓
```

✓ Normal.

---

## Aérodynamique (AeroSystem)

### ❌ BUGS TROUVÉS

#### Bug 1: Angle d'attaque mal calculé
**Ligne ~107-109**
```typescript
const dotProduct = chord.dot(localWindDir);
const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;
```

⚠️ **PROBLÈME**: 
- `chord = (1, 0, 0)` dans les coordonnées locales du kite
- L'angle d'attaque devrait être calculé entre la **normale de la surface** et le vent
- NOT entre la corde et le vent !

**CORRECTION PROPOSÉE**:
```typescript
// alpha = angle entre normal et vent
const dotProduct = sample.normal.dot(localWindDir);
const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;
```

#### Bug 2: CL n'est pas utilisé dans le calcul de lift
**Ligne ~137-139**
```typescript
const panelLift = liftDir.clone().multiplyScalar(CL * q * sample.area * liftScale);
```

⚠️ **PROBLÈME**: 
- Formule correcte pour portance: `L = 0.5 × ρ × V² × S × CL`
- Mais `q = 0.5 × ρ × V²` (déjà défini ligne 125)
- Donc c'est: `L = q × S × CL` ✓ (OK!)
- MAIS: Quelle est la formule pour CL ? Voir calculateCL.

#### Bug 3: Gravité appliquée deux fois potentiellement ?
**Ligne ~143-145**
```typescript
const gravityPerFace = this.gravity.clone().multiplyScalar((physics.mass * sample.area) / kiteComp.surfaceArea);
```

⚠️ **VÉRIFICATION NÉCESSAIRE**:
- La gravité est appliquée par face ici
- Y a-t-il une autre application de gravité ailleurs ?
- Voir PhysicsSystem.

#### Bug 4: `chord` mal orienté pour l'angle d'attaque
**Ligne ~105-106**
```typescript
const chord = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.quaternion);
```

⚠️ **PROBLÈME**: 
- `(1, 0, 0)` est le vecteur X du kite en local
- Pour l'angle d'attaque d'un cerf-volant, on devrait utiliser la **normale de la surface**
- Pas la "corde" (qui n'existe pas pour un cerf-volant delta carré)

### ✅ Formules correctes

**CL (portance)**
```
CL = CL0 + CLAlpha × (alpha - alpha0)
```

**CD (traînée)**
```
CD = CD0 + (CL - CL0)² / (π × e × AR)
où e = efficacité Oswald, AR = aspect ratio
```

**Portance**
```
L = q × S × CL
```

**Traînée**
```
D = q × S × CD
```

---

## Contraintes (ConstraintSystem)

### ✅ Formule ressort-amortisseur

**Tension = ressort + amortissement**
```typescript
const springForce = lineComponent.stiffness * extension;
const dampingForce = lineComponent.damping * radialVelocity;
const tensionMagnitude = springForce + dampingForce;
```

✓ **CORRECT**: Modèle standard.

### ⚠️ Amortissement linéaire ?

**Question**: Pourquoi amortissement linéaire (v) et pas quadratique (v²) ?
- Pour les câbles en air: généralement linéaire en régime laminaire ✓
- Pour haute vitesse: quadratique recommandé
- Actuellement: OK pour le kite

---

## Intégration Numérique (PhysicsSystem)

### ✅ Intégration semi-implicite d'Euler

**Linéaire**
```typescript
const acceleration = physics.forces.clone().multiplyScalar(physics.invMass);
physics.velocity.add(acceleration.multiplyScalar(deltaTime));
physics.velocity.multiplyScalar(physics.linearDamping);  // ← Damping appliqué !
const deltaPos = physics.velocity.clone().multiplyScalar(deltaTime);
transform.position.add(deltaPos);
```

✓ **CORRECT**: C'est de l'intégration semi-implicite (v→v', puis p→p').

### ⚠️ Damping appliqué POST-intégration ?

**Question**:
```typescript
// Ligne 61
physics.velocity.multiplyScalar(physics.linearDamping);
```

⚠️ **PROBLÈME**: 
- Le damping EST appliqué APRÈS l'accumulation des forces
- Mais linearDamping = 0.8 signifie `v_new = 0.8 × v_old`
- Cela réduit la vélocité de 20% par frame !
- À 60 FPS, après 0.1 sec (6 frames): v = 0.8^6 ≈ 0.26 × v_0 (perte de 74% !)

⚠️ **ERREUR**: Le damping devrait être continu `dv/dt = -c × v`, pas multiplicatif !

**CORRECTION PROPOSÉE**:
```typescript
// Damping continu: v_new = v × exp(-c × dt)
// Approximation linéaire: v_new = v / (1 + c × dt)
physics.velocity.multiplyScalar(1 / (1 + physics.linearDamping * deltaTime));
```

OR (meilleur):
```typescript
const dampingFactor = Math.exp(-physics.linearDamping * deltaTime);
physics.velocity.multiplyScalar(dampingFactor);
```

### ⚠️ Ordre des opérations

**Actuellement**:
1. AeroSystem (30): Ajoute forces aéro + gravité
2. ConstraintSystem (40): Ajoute forces de lignes
3. PhysicsSystem (50): Intègre v puis p, puis nettoie forces

✓ **CORRECT**: L'ordre est bon.

### ❌ Gravité appliquée DEUX FOIS !

**AeroSystem ligne ~143**: Gravité par face
```typescript
const gravityPerFace = this.gravity.clone().multiplyScalar((physics.mass * sample.area) / kiteComp.surfaceArea);
this.addForce(physics, gravityPerFace);
```

**MAIS**: Y a-t-il une autre gravité ?

⚠️ **ACTION**: Chercher la deuxième application de gravité !

---

## Bridles (BridleConstraintSystem)

### ✅ Trilatération 3D

La trilatération semble mathématiquement correcte avec raffinement itératif.

✓ Formules OK (voir code lignes ~150+).

---

## Vent (WindSystem)

### ✅ Calcul du vent apparent

```
Vent_apparent = Vent_ambiant - Vitesse_kite
```

✓ **CORRECT**: Formule standard.

### ✅ Turbulence

Utilise Perlin noise, OK.

---

## 📊 RÉSUMÉ DES BUGS

### 🔴 CRITIQUES

1. **Inertie du kite INCORRECTE** (Config.ts)
   - Ixx = 0.015 devrait être ~0.027 kg⋅m²
   - Iyy = 0.020 devrait être ~0.004 kg⋅m²
   - Izz = 0.005 devrait être ~0.040 kg⋅m²
   - Impact: **Rotation du kite instable ou avec acceleration incorrecte**
   - **URGENCE**: Recalculer avec formule exacte

2. **Angle d'attaque mal calculé** (AeroSystem ligne ~107-109)
   - Utilise corde (1,0,0) au lieu de normale de surface
   - Impact: **Forces aérodynamiques incorrectes pour chaque panneau**
   - CL et CD basés sur mauvais alpha → forces fausses

3. **Damping multiplicatif au lieu de continu** (PhysicsSystem ligne 61)
   - Actuellement: `v *= 0.8` par frame
   - Correct: `v *= exp(-damping × dt)` ou `v /= (1 + damping × dt)`
   - Impact: **Perte exponentielle d'énergie, mouvements "congelés"**
   - À 60 FPS après 0.1 sec: perte 74% d'énergie!

4. **Gravité BIEN appliquée (OK)** ✓
   - Pas de double application
   - Répartie proportionnellement par panneau
   - OK!

### 🟡 IMPORTANTS

5. **Aspect ratio pas utilisé correctement** (AeroSystem)
   - AR = wingspan² / surfaceArea = 1.65² / 0.54 ≈ 5.04
   - Utilisé dans CD via k = 1/(π × AR × e)
   - ✓ EN FAIT: C'est utilisé correctement via `calculateCD`!

6. **CD appliqué correctement** ✓
   - Formule polaire: CD = CD0 + k × CL²
   - k = 1 / (π × AR × e), e = 0.8
   - ✓ C'EST BON!

7. **CL avec décrochage** ✓
   - Modèle linéaire jusqu'à alphaOptimal = 12°
   - Puis atténuation progressive jusqu'à stallLimit = 27°
   - Puis CL = 0 (décrochage)
   - ✓ PHYSIQUEMENT CORRECT!

### 🟢 MINEURS

8. Conversion d'unités: degrés ↔ radians (à vérifier)
9. Lissage temporel des forces optionnel (OK)

### 🔧 POINTS À VÉRIFIER

- [ ] AeroSystem: Utilise-t-on `sample.normal` ou une corde arbitraire pour l'angle ?
- [ ] KiteComponent.aspectRatio: Est-il initialisé correctement ?
- [ ] Formule de CL0: CLAlpha donne-t-il CL0 += CL0 constant ?



