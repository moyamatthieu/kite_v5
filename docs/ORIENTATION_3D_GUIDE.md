# 🔄 GUIDE DÉTAILLÉ - ORIENTATION 3D DU CERF-VOLANT

**Date** : 7 Octobre 2025  
**Branche** : `fix/physics-critical-corrections`  
**Document** : Guide technique sur le système d'orientation du kite

---

## 📋 TABLE DES MATIÈRES

1. [Introduction aux Quaternions](#1-introduction-aux-quaternions)
2. [Système de Coordonnées 3D](#2-système-de-coordonnées-3d)
3. [Comment le Kite S'Oriente](#3-comment-le-kite-soriente)
4. [Dynamique Rotationnelle](#4-dynamique-rotationnelle)
5. [Exemples Concrets](#5-exemples-concrets)
6. [Debugging et Visualisation](#6-debugging-et-visualisation)

---

## 1. INTRODUCTION AUX QUATERNIONS

### 1.1 Pourquoi des Quaternions ?

Les quaternions sont utilisés au lieu des angles d'Euler (roll, pitch, yaw) pour plusieurs raisons :

**Problème des angles d'Euler** :
- **Gimbal lock** : Perte d'un degré de liberté dans certaines orientations
- **Discontinuités** : Passage brutal 359° → 0°
- **Ordre dépendant** : XYZ ≠ ZYX
- **Interpolation non linéaire** : Slerp complexe

**Avantages des Quaternions** :
- ✅ Pas de gimbal lock
- ✅ Interpolation fluide (slerp natif)
- ✅ Composition simple : `q3 = q2 × q1`
- ✅ Normalisation facile : `q / |q|`
- ✅ Compact : 4 valeurs au lieu de 3×3 matrice

### 1.2 Représentation Mathématique

Un quaternion est un nombre complexe à 4 dimensions :
```
q = w + xi + yj + zk
```

Où :
- `w` = partie scalaire (cosinus de l'angle/2)
- `(x, y, z)` = partie vectorielle (axe de rotation × sin(angle/2))

**Exemple** : Rotation de 90° autour de l'axe Y
```javascript
angle = 90° = π/2 rad
axis = (0, 1, 0)

w = cos(π/4) ≈ 0.707
x = 0 × sin(π/4) = 0
y = 1 × sin(π/4) ≈ 0.707
z = 0 × sin(π/4) = 0

q = (0.707, 0, 0.707, 0)  // (w, x, y, z)
```

### 1.3 Implémentation Three.js

```typescript
// Dans le code du kite :
this.kite.quaternion = new THREE.Quaternion(x, y, z, w);

// Créer depuis axe-angle
const axis = new THREE.Vector3(0, 1, 0);  // Axe Y
const angle = Math.PI / 2;  // 90°
this.kite.quaternion.setFromAxisAngle(axis, angle);

// Composer rotations
const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, deltaAngle);
this.kite.quaternion.multiply(deltaQ);  // Rotation relative

// Normaliser (éviter drift)
this.kite.quaternion.normalize();
```

---

## 2. SYSTÈME DE COORDONNÉES 3D

### 2.1 Convention Three.js (Main Droite)

```
        Y (↑ Haut)
        |
        |
        |______ X (→ Droite)
       /
      /
     Z (⊙ Vers l'observateur)
```

**Repère du kite** (vue de dessus) :
```
       NEZ (0, 0.65, 0)
         ▲
         |
         |
    ◄────┼────► X (Envergure)
         |
         |
    SPINE_BAS
    (0, 0, 0)

Z = 0 : Plan du kite
Z > 0 : Points de contrôle (CTRL) en arrière
```

### 2.2 Axes de Rotation

Pour un cerf-volant en vol, les 3 axes de rotation sont :

| Axe | Nom Aéronautique | Mouvement | Direction Vecteur |
|-----|------------------|-----------|-------------------|
| **X** | **PITCH** (Tangage) | Nez haut/bas | Gauche → Droite |
| **Y** | **YAW** (Lacet) | Rotation horizontale | Bas → Haut |
| **Z** | **ROLL** (Roulis) | Inclinaison latérale | Arrière → Avant |

**Visualisation** :

```
PITCH (Rotation autour X) :
    NEZ ↑               NEZ ↓
       ╲                   ╱
        ╲                 ╱
         ● ────►         ● ────►
          ╲               ╲
           ↓               ↑
      (Nez monte)     (Nez plonge)

YAW (Rotation autour Y) :
       NEZ               ↗ NEZ
        ▲               ╱
        |              ╱
    ────●────►    ────●────►
                        
      (Face)        (Tournant droite)

ROLL (Rotation autour Z) :
    \   ▲   /         \       
     \  |  /           \      ▲
      \ | /             \    /
       \|/               \  /
        ●                 ●
      (Plat)          (Incliné)
```

### 2.3 Convention de Signes

**Règle de la main droite** :
- Pouce = axe de rotation
- Doigts courbés = sens de rotation positif

```
Rotation +X (PITCH positif) :
  → Nez monte, queue descend
  → Couple τ_x > 0

Rotation +Y (YAW positif) :
  → Kite tourne vers la gauche (vu de dessus)
  → Couple τ_y > 0

Rotation +Z (ROLL positif) :
  → Aile gauche monte, aile droite descend
  → Couple τ_z > 0
```

---

## 3. COMMENT LE KITE S'ORIENTE

### 3.1 Sources de Couple (Torque)

Le kite tourne sous l'effet de **3 couples physiques** :

#### 3.1.1 Couple Aérodynamique

**Origine** : Différence de forces entre surfaces

```typescript
// Dans AerodynamicsCalculator.ts
KiteGeometry.SURFACES_WITH_MASS.forEach((surface) => {
  const force = windFacingNormal × normalForceMagnitude;
  const centre = (v0 + v1 + v2) / 3;  // Centre triangle
  
  // Couple = bras de levier × force
  const centreWorld = centre.applyQuaternion(kiteOrientation);
  const aeroTorque = centreWorld.cross(force);  // τ = r × F
  
  totalAeroTorque.add(aeroTorque);
});
```

**Physique émergente** :
```
Si force_gauche > force_droite :
  → Couple autour Y (yaw)
  → Kite tourne vers la droite

Si force_avant > force_arrière :
  → Couple autour X (pitch)
  → Nez monte ou descend
```

**Exemple concret** :
```
Vent 20 km/h, angle d'attaque 30°
Surface haute gauche : F = 3 N, r = (-0.4, 0.3, 0) m
Surface haute droite : F = 2 N, r = (+0.4, 0.3, 0) m

τ_gauche = (-0.4, 0.3, 0) × (0, 0, -3) = (-0.9, -1.2, 0) N·m
τ_droite = (+0.4, 0.3, 0) × (0, 0, -2) = (+0.6, -0.8, 0) N·m

τ_total = (-0.3, -2.0, 0) N·m
         ⮑ Rotation autour Y (yaw gauche)
```

#### 3.1.2 Couple Gravitationnel

**Origine** : Distribution de masse

```typescript
// Gravité appliquée au centre géométrique de chaque surface
const gravityForce = new THREE.Vector3(0, -surface.mass × g, 0);
const gravityTorque = centreWorld.cross(gravityForce);  // τ = r × F_g

totalGravityTorque.add(gravityTorque);
```

**Effet** :
- Centre de gravité ≠ centre géométrique → couple gravitationnel
- Tend à orienter le kite "nez vers le haut" (stable)

#### 3.1.3 Couple d'Amortissement (Drag Angulaire)

**Origine** : Résistance aérodynamique à la rotation

```typescript
// Dans KiteController.ts
const dampTorque = this.state.angularVelocity
  .clone()
  .multiplyScalar(-CONFIG.kite.inertia × CONFIG.physics.angularDragFactor);

const effectiveTorque = torque.clone().add(dampTorque);
```

**Formule physique** :
```
τ_drag = -I × k_drag × ω

Unités : kg·m² × (1/s) × (rad/s) = N·m ✅
```

**Effet** :
- Freine toutes les rotations
- Stabilise le kite (évite toupie)
- Proportionnel à la vitesse angulaire

### 3.2 Intégration de la Rotation

**Fichier** : `KiteController.ts`, méthode `updateOrientation()`

#### Étape 1 : Calculer l'accélération angulaire

```typescript
// Loi de Newton pour la rotation : τ = I × α
// Donc : α = τ / I

const angularAcceleration = effectiveTorque.clone().divideScalar(CONFIG.kite.inertia);

// Limiter pour stabilité numérique
if (angularAcceleration.length() > MAX_ANGULAR_ACCELERATION) {
  angularAcceleration.normalize().multiplyScalar(MAX_ANGULAR_ACCELERATION);
}
```

**Exemple numérique** :
```
Couple total : τ = (0, -2.0, 0) N·m
Inertie : I = 0.422 kg·m²

α = τ / I = (0, -4.74, 0) rad/s²
```

#### Étape 2 : Intégrer la vitesse angulaire

```typescript
// Intégration d'Euler : ω(t+dt) = ω(t) + α·dt

this.state.angularVelocity.add(
  angularAcceleration.clone().multiplyScalar(deltaTime)
);

// Limiter pour éviter explosions
if (this.state.angularVelocity.length() > MAX_ANGULAR_VELOCITY) {
  this.state.angularVelocity.normalize().multiplyScalar(MAX_ANGULAR_VELOCITY);
}
```

**Exemple numérique** :
```
Vitesse initiale : ω₀ = (0, 0, 0) rad/s
Accélération : α = (0, -4.74, 0) rad/s²
Pas de temps : dt = 0.016 s (60 FPS)

ω₁ = ω₀ + α·dt = (0, -0.076, 0) rad/s
```

#### Étape 3 : Convertir en quaternion delta

```typescript
// Convertir vitesse angulaire (vecteur) → rotation (quaternion)

if (this.state.angularVelocity.length() > EPSILON) {
  const axis = this.state.angularVelocity.clone().normalize();
  const angle = this.state.angularVelocity.length() * deltaTime;
  
  // Créer quaternion de rotation infinitésimale
  const deltaRotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  
  // Appliquer rotation
  this.kite.quaternion.multiply(deltaRotation);
  this.kite.quaternion.normalize();  // Éviter drift numérique
}
```

**Exemple numérique** :
```
Vitesse angulaire : ω = (0, -0.076, 0) rad/s
Pas de temps : dt = 0.016 s

Angle rotation : θ = ω·dt = 0.00122 rad ≈ 0.07°
Axe rotation : (0, -1, 0) = -Y (yaw droite)

Quaternion : q_delta = (0.99999, 0, -0.00061, 0)
```

#### Étape 4 : Composition des rotations

```typescript
// Rotation composée : q_new = q_old × q_delta
this.kite.quaternion.multiply(deltaRotation);

// IMPORTANT : Ordre compte !
// q_old × q_delta = rotation LOCALE (repère kite)
// q_delta × q_old = rotation GLOBALE (repère monde)
```

**Visualisation** :
```
Frame 0 : q₀ = identité (kite face au vent)
Frame 1 : q₁ = q₀ × Δq₁ (rotation 0.07° droite)
Frame 2 : q₂ = q₁ × Δq₂ (rotation 0.07° droite)
...
Frame 60 : q₆₀ (rotation cumulative ≈ 4.2° droite)
```

---

## 4. DYNAMIQUE ROTATIONNELLE

### 4.1 Analogie Linéaire vs Angulaire

| Concept | Linéaire | Angulaire | Unité |
|---------|----------|-----------|-------|
| **Position** | `x` | `θ` (orientation) | m / rad |
| **Vitesse** | `v = dx/dt` | `ω = dθ/dt` | m/s / rad/s |
| **Accélération** | `a = dv/dt` | `α = dω/dt` | m/s² / rad/s² |
| **Masse** | `m` | `I` (inertie) | kg / kg·m² |
| **Force** | `F` | `τ` (couple) | N / N·m |
| **Loi fondamentale** | `F = m·a` | `τ = I·α` | - |
| **Quantité mouvement** | `p = m·v` | `L = I·ω` | kg·m/s / kg·m²/s |

### 4.2 Moment d'Inertie

**Définition** : Résistance d'un objet à la rotation

```typescript
// Calcul pour le kite (simplifié)
I = m × r²

où :
  m = masse totale = 0.31 kg
  r = rayon de giration = wingspan / √2 ≈ 1.167 m

I ≈ 0.422 kg·m²
```

**Interprétation physique** :
- I petit → facile à faire tourner (toupie)
- I grand → difficile à faire tourner (roue de vélo)

**Pour le kite** :
```
I_kite = 0.422 kg·m²
I_roue_vélo ≈ 0.15 kg·m² (plus difficile à tourner)
I_toupie ≈ 0.001 kg·m² (très facile)

→ Le kite a une inertie moyenne
```

### 4.3 Équations de Mouvement

**Équation complète** :
```
τ_total = τ_aéro + τ_gravité + τ_drag

τ_drag = -I × k × ω  (amortissement)

τ_net = τ_aéro + τ_gravité - I × k × ω

α = τ_net / I

ω(t+dt) = ω(t) + α·dt

θ(t+dt) = θ(t) + ω·dt  (ou q(t+dt) = q(t) × Δq pour quaternions)
```

### 4.4 Stabilité Rotationnelle

**Critère de stabilité** : Le kite retourne-t-il à l'équilibre après perturbation ?

```typescript
// Condition de stabilité angulaire :
damping_ratio = k_drag / (2 × √(k_spring × I))

Si damping_ratio > 1 : Sur-amorti (lent, pas d'oscillation)
Si damping_ratio = 1 : Critique (optimal)
Si damping_ratio < 1 : Sous-amorti (oscillations)
```

**Pour le kite** :
```
k_drag = angularDragFactor = 2.0 /s
I = 0.422 kg·m²
k_spring ≈ couple_restitution / angle (dépend des brides)

→ Système généralement sous-amorti (oscillations naturelles)
```

---

## 5. EXEMPLES CONCRETS

### 5.1 Scénario : Tirer la Ligne Gauche

**Action** : Pilote tire sur la ligne gauche (barre tourne, handle gauche recule)

```
1. GÉOMÉTRIE MODIFIÉE
   handle_gauche : y = 1.2 m → y = 1.0 m (recule de 20 cm)
   handle_droit : y = 1.2 m (inchangé)
   
2. CONTRAINTES PBD
   Ligne gauche tendue → tire CTRL_GAUCHE vers le bas
   Ligne droite molle → pas de contrainte
   
   → Kite bascule (rotation autour Z = roll)

3. FORCES AÉRODYNAMIQUES MODIFIÉES
   Surface haute gauche : angle d'attaque diminue
   Surface haute droite : angle d'attaque augmente
   
   Force_gauche < Force_droite
   
   → Couple autour Y (yaw) vers la gauche

4. ROTATION RÉSULTANTE
   Couple total = τ_roll + τ_yaw
   
   τ_roll ≈ (+2 N·m, 0, 0)  → Aile gauche monte
   τ_yaw ≈ (0, -3 N·m, 0)   → Kite tourne gauche
   
   → Virage coordonné vers la gauche ✅
```

**Timeline** (60 FPS) :
```
t = 0.00s : Pilote tire (input)
t = 0.02s : Contrainte ligne appliquée (PBD)
t = 0.05s : Forces aéro modifiées détectées
t = 0.10s : Rotation visible (≈5° roll + 3° yaw)
t = 0.50s : Virage stabilisé (≈30° heading)
```

### 5.2 Scénario : Rafale de Vent

**Événement** : Vent passe de 20 km/h à 30 km/h pendant 1s

```
1. VENT APPARENT MODIFIÉ
   v_wind : 5.56 m/s → 8.33 m/s (+50%)
   
2. PRESSION DYNAMIQUE
   q = 0.5 × ρ × v²
   
   q_avant = 18.9 Pa
   q_après = 42.5 Pa (+125% !)
   
3. FORCES AÉRODYNAMIQUES
   F ∝ q × A × sin²(α)
   
   F_avant ≈ 2.5 N
   F_après ≈ 5.6 N (+124%)
   
4. ACCÉLÉRATION LINÉAIRE
   a = F / m = 5.6 / 0.31 ≈ 18 m/s²
   
   → Kite accélère vers l'avant (tension lignes augmente)

5. COUPLE AÉRODYNAMIQUE
   Si asymétrie gauche/droite :
   
   τ_avant ≈ 1.0 N·m
   τ_après ≈ 2.2 N·m
   
   α = τ / I = 2.2 / 0.422 ≈ 5.2 rad/s²
   
   → Rotation rapide (≈15°/s après 1s)

6. STABILISATION
   Amortissement : τ_drag = -I × k × ω
   
   À ω = 15°/s ≈ 0.26 rad/s :
   τ_drag = -0.422 × 2.0 × 0.26 ≈ -0.22 N·m
   
   → Ralentit la rotation progressivement
```

### 5.3 Scénario : Décrochage (Stall)

**Condition** : Angle d'attaque trop élevé (>45°)

```
1. ANGLE D'ATTAQUE ÉLEVÉ
   α = 50° → sin²(50°) = 0.586
   
2. FORCE NORMALE ÉLEVÉE
   F_n = q × A × 0.586 (force max !)
   
3. MAIS : Force parallèle au vent faible
   Composante lift : F_lift = F_n × cos(50°) ≈ 0.64 × F_n
   Composante drag : F_drag = F_n × sin(50°) ≈ 0.77 × F_n
   
   → Beaucoup de traînée, peu de portance
   
4. CONSÉQUENCE
   - Kite ralentit (drag élevé)
   - Vent apparent diminue
   - Forces diminuent
   - Kite tombe (gravité > lift)
   
5. RÉCUPÉRATION
   - Chute augmente vitesse verticale
   - Angle d'attaque diminue
   - Portance réapparaît
   - Kite se stabilise
```

---

## 6. DEBUGGING ET VISUALISATION

### 6.1 Affichage Debug Quaternion

```typescript
// Convertir quaternion → angles Euler pour debug
function quaternionToEuler(q: THREE.Quaternion): {
  roll: number;
  pitch: number;
  yaw: number;
} {
  const euler = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  
  return {
    roll: euler.z * 180 / Math.PI,   // Rotation autour Z
    pitch: euler.x * 180 / Math.PI,  // Rotation autour X
    yaw: euler.y * 180 / Math.PI,    // Rotation autour Y
  };
}

// Utilisation
const angles = quaternionToEuler(kite.quaternion);
console.log(`Roll: ${angles.roll.toFixed(1)}°`);
console.log(`Pitch: ${angles.pitch.toFixed(1)}°`);
console.log(`Yaw: ${angles.yaw.toFixed(1)}°`);
```

### 6.2 Visualisation des Couples

```typescript
// Dans DebugRenderer.ts
renderTorqueVectors(kite: Kite, torque: THREE.Vector3) {
  // Couple total (rouge)
  const torqueArrow = new THREE.ArrowHelper(
    torque.clone().normalize(),
    kite.position,
    torque.length() * 0.5,  // Scale pour visibilité
    0xff0000
  );
  
  // Décomposition
  const torqueX = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    kite.position,
    Math.abs(torque.x) * 0.5,
    0xff8800  // Orange = pitch
  );
  
  const torqueY = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    kite.position,
    Math.abs(torque.y) * 0.5,
    0x00ff00  // Vert = yaw
  );
  
  const torqueZ = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    kite.position,
    Math.abs(torque.z) * 0.5,
    0x0088ff  // Bleu = roll
  );
  
  this.scene.add(torqueArrow, torqueX, torqueY, torqueZ);
}
```

### 6.3 Logs de Diagnostic

```typescript
// Diagnostic complet rotation
function logRotationState(controller: KiteController) {
  const state = controller.getState();
  const kite = controller.getKite();
  
  console.group('🔄 État Rotation');
  
  // Orientation actuelle
  const angles = quaternionToEuler(kite.quaternion);
  console.log(`Orientation: R=${angles.roll.toFixed(1)}° P=${angles.pitch.toFixed(1)}° Y=${angles.yaw.toFixed(1)}°`);
  
  // Vitesse angulaire
  const omega = state.angularVelocity;
  console.log(`Vitesse angulaire: ω=(${omega.x.toFixed(2)}, ${omega.y.toFixed(2)}, ${omega.z.toFixed(2)}) rad/s`);
  console.log(`  → Magnitude: ${omega.length().toFixed(2)} rad/s (${(omega.length() * 180 / Math.PI).toFixed(1)}°/s)`);
  
  // Taux de rotation (degrés par seconde)
  console.log(`Taux rotation:`);
  console.log(`  Pitch: ${(omega.x * 180 / Math.PI).toFixed(1)}°/s`);
  console.log(`  Yaw: ${(omega.y * 180 / Math.PI).toFixed(1)}°/s`);
  console.log(`  Roll: ${(omega.z * 180 / Math.PI).toFixed(1)}°/s`);
  
  console.groupEnd();
}
```

### 6.4 Vérifications de Cohérence

```typescript
// Vérifier normalisation quaternion
function checkQuaternionNormalization(q: THREE.Quaternion): boolean {
  const norm = Math.sqrt(q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w);
  const error = Math.abs(1.0 - norm);
  
  if (error > 1e-3) {
    console.warn(`⚠️ Quaternion dénormalisé: ||q|| = ${norm.toFixed(6)} (erreur ${error.toFixed(6)})`);
    return false;
  }
  
  return true;
}

// Vérifier orthogonalité axes
function checkOrthogonality(q: THREE.Quaternion): boolean {
  // Extraire axes du repère local
  const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const yAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  
  // Vérifier orthogonalité (produits scalaires doivent être ~0)
  const xy = Math.abs(xAxis.dot(yAxis));
  const xz = Math.abs(xAxis.dot(zAxis));
  const yz = Math.abs(yAxis.dot(zAxis));
  
  if (xy > 1e-3 || xz > 1e-3 || yz > 1e-3) {
    console.warn(`⚠️ Axes non orthogonaux: xy=${xy.toFixed(4)}, xz=${xz.toFixed(4)}, yz=${yz.toFixed(4)}`);
    return false;
  }
  
  return true;
}
```

---

## 📚 RÉFÉRENCES

### Documentation Three.js
- [Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
- [Euler](https://threejs.org/docs/#api/en/math/Euler)
- [Vector3](https://threejs.org/docs/#api/en/math/Vector3)

### Littérature Physique
- Müller et al. (2007) - "Position Based Dynamics"
- Hoerner (1965) - "Fluid Dynamic Drag"
- Goldstein (1980) - "Classical Mechanics" (Chapitre rotation corps rigide)

### Code Source Pertinent
- `/src/simulation/controllers/KiteController.ts` - Intégration rotation
- `/src/simulation/physics/AerodynamicsCalculator.ts` - Calcul couples
- `/src/simulation/physics/ConstraintSolver.ts` - Contraintes orientation

---

**Document généré le** : 7 octobre 2025  
**Version** : 1.0  
**Auteur** : GitHub Copilot
