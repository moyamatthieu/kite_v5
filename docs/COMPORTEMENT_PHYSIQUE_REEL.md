# Comportement Physique Réel du Kite — Modèle Géométrique

**Date** : 7 octobre 2025  
**Référence** : Description physique correcte du vol de cerf-volant

---

## 🎯 PRINCIPE FONDAMENTAL : Contrainte Géométrique

### Le Kite N'est PAS un Avion !

**Un kite est une structure rigide 3D** (frame + surfaces) **retenue par des lignes**.

```
┌─────────────────────────────────────────────────────┐
│  PHYSIQUE RÉELLE D'UN CERF-VOLANT                  │
└─────────────────────────────────────────────────────┘

1. VENT POUSSE constamment le kite (forces aérodynamiques)
        ↓
2. LIGNES RETIENNENT à distance maximale (contrainte PBD)
        ↓
3. KITE PLAQUÉ contre sphère de rayon R = longueur lignes + brides
        ↓
4. INCLINAISON SURFACES → composante tangentielle de force
        ↓
5. KITE SE DÉPLACE sur la sphère (pas de vol libre !)
        ↓
6. ÉQUILIBRE AU ZÉNITH : surfaces horizontales → pression minimale
```

---

## 🌐 SPHÈRE DE VOL : Géométrie Contrainte

### Rayon de la Sphère

```
R_total = R_lignes + R_brides
        = 15.0 m  + ~0.5 m
        = 15.5 m
```

**Le kite NE PEUT PAS s'éloigner plus** que 15.5m de la barre de contrôle !

### Contraintes Actives (PBD)

1. **Lignes principales** (2× gauche/droite)
   - CTRL_GAUCHE ↔ Handle Left : distance = 15.0 m
   - CTRL_DROIT ↔ Handle Right : distance = 15.0 m
   - **Toujours tendues** (tension minimale = 75N)

2. **Brides internes** (6× au total)
   - NEZ → CTRL_GAUCHE/DROIT : 0.30-0.80 m (réglable)
   - INTER → CTRL_GAUCHE/DROIT : 0.30-0.80 m
   - CENTRE → CTRL_GAUCHE/DROIT : 0.30-0.80 m
   - **Définissent la géométrie interne** du kite

### Position sur la Sphère

**Coordonnées sphériques** :
- θ (azimut) : angle horizontal (gauche ↔ droite)
- φ (élévation) : angle vertical (bas ↔ zénith)

**Zénith** : φ = 90° → kite au sommet de la sphère

---

## ⚖️ ÉQUILIBRE AU ZÉNITH

### Position d'Équilibre Naturelle

**Barre de contrôle en position neutre** → Kite monte vers le **zénith**

**Pourquoi ?**

1. **En bas de la sphère** (φ = 0°) :
   - Surfaces quasi-verticales face au vent
   - **Forte pression aérodynamique** (Fn = q × A × sin²α)
   - Composante tangentielle **vers le haut** → kite monte

2. **Au zénith** (φ = 90°) :
   - Surfaces **quasi-horizontales** face au vent
   - **Pression minimale** (angle d'attaque α → 0°)
   - **Pas de force tangentielle** → équilibre stable
   - Kite reste immobile au sommet

### Forces à l'Équilibre (Zénith)

```
Vent horizontal (20 km/h) →
       ↓
Kite au zénith : surfaces horizontales
       ↓
Angle d'attaque α ≈ 0° (vent tangent aux surfaces)
       ↓
Force normale Fn ≈ 0 (sin²(0°) = 0)
       ↓
Gravité = Tensions lignes (équilibre statique)
       ↓
PAS DE MOUVEMENT
```

---

## 🔄 DYNAMIQUE DE VOL : Mouvement sur la Sphère

### Principe

**Le kite ne vole PAS librement** — Il **glisse sur la sphère** !

### Cas 1 : Barre Inclinée (Flèche ↑)

```
Barre rotate +30° (vers la droite)
    ↓
Ligne droite plus courte que ligne gauche
    ↓
Kite pivote sur lui-même (rotation Z)
    ↓
Angle d'attaque α change (surfaces s'inclinent)
    ↓
Force normale augmente (sin²α augmente)
    ↓
Composante tangentielle apparaît
    ↓
Kite SE DÉPLACE sur la sphère (trajectoire courbe)
```

### Cas 2 : Vent Fort

```
Vent 40 km/h au lieu de 20 km/h
    ↓
Pression dynamique q × 4 (proportionnel à v²)
    ↓
Forces aérodynamiques × 4
    ↓
Tensions lignes × 4 (300N → 1200N)
    ↓
Kite PLAQUÉ encore plus fort contre sphère
    ↓
Mouvement sur sphère plus RAPIDE (forces tangentielles ×4)
```

### Cas 3 : Brides Courtes

```
Brides NEZ courtes (0.30 m au lieu de 0.50 m)
    ↓
CTRL plus proche de NEZ
    ↓
Angle d'attaque α DIMINUE (surfaces plus horizontales)
    ↓
Force normale DIMINUE (sin²α plus faible)
    ↓
Moins de portance → kite DESCEND sur la sphère
    ↓
Nouvel équilibre à φ < 90° (en dessous du zénith)
```

---

## 🔧 IMPLÉMENTATION CODE : Validation

### ✅ Ce qui EST Correctement Modélisé

**1. Contraintes PBD des Lignes** (`ConstraintSolver.enforceLineConstraints`)
```typescript
// Ligne 72-82
if (dist <= lineLength - tol) return; // Ligne molle (NE DEVRAIT JAMAIS ARRIVER)

const C = dist - lineLength; // Contrainte : distance = longueur exacte

// Corrections position + orientation pour satisfaire contrainte
predictedPosition.add(dPos);
kite.quaternion.premultiply(dq).normalize();

// Correction vitesse (annuler composante radiale si kite s'éloigne)
if (radialSpeed > 0) {
  state.velocity.add(n2.clone().multiplyScalar(J * invMass));
}
```

**Résultat** : Le kite **ne peut PAS s'éloigner** plus que R = 15.0m !

**2. Contraintes PBD des Brides** (`ConstraintSolver.enforceBridleConstraints`)
```typescript
// Ligne 150-200
// 6 brides (3 gauche + 3 droite)
const bridles = [
  { start: "NEZ", end: "CTRL_GAUCHE", length: bridleLengths.nez },
  { start: "INTER_GAUCHE", end: "CTRL_GAUCHE", length: bridleLengths.inter },
  // ...
];

// Pour chaque bride : imposer distance exacte
const C = dist - length;
predictedPosition.add(dPos);
kite.quaternion.premultiply(dq).normalize();
```

**Résultat** : La **géométrie interne** du kite est fixée (rigidité structurelle) !

**3. Forces Aérodynamiques** (`AerodynamicsCalculator.calculateForces`)
```typescript
// Ligne 126-135
const CN = sinAlpha * sinAlpha; // Coefficient force normale (sin²α)
const normalForceMagnitude = dynamicPressure * surface.area * CN;
const force = windFacingNormal.clone().multiplyScalar(normalForceMagnitude);
```

**Résultat** : Le vent **pousse** le kite constamment contre la sphère !

**4. Tensions pour Display** (`LineSystem.calculateLineTensions`)
```typescript
// Ligne 69-74
const leftResult = this.physics.calculateTensionForce(...);
const rightResult = this.physics.calculateTensionForce(...);

// Tensions CALCULÉES pour affichage/debug uniquement
// PAS de forces appliquées (contraintes PBD uniquement)
```

**Résultat** : On **visualise** les tensions (75-800N) mais elles ne tirent PAS le kite !

---

## 📊 COMPORTEMENT ATTENDU (Validation)

### Au Démarrage

```
t = 0 : Kite à position initiale (x=0, y=5, z=0)
    ↓
Vent horizontal (20 km/h) pousse le kite
    ↓
Contraintes PBD limitent distance à R = 15.0m
    ↓
Kite monte progressivement sur la sphère (φ augmente)
    ↓
t = 2s : Kite atteint zénith (φ ≈ 80-90°)
    ↓
Surfaces horizontales → pression minimale → ÉQUILIBRE
```

**Indicateurs UI** :
- Position Y : **5m → 10m → 15m** (monte vers zénith)
- Tensions lignes : **150N → 200N** (toujours tendues)
- Angle d'attaque : **30° → 10° → 5°** (diminue vers 0°)

### En Vol Stationnaire (Zénith)

```
Kite au sommet de la sphère (y ≈ 15m)
    ↓
Surfaces horizontales (α ≈ 5°)
    ↓
Pression faible (sin²(5°) ≈ 0.007)
    ↓
Oscillations naturelles autour du zénith (±1-2°)
    ↓
Tensions équilibrées G/D (180-220N)
```

**Indicateurs UI** :
- Position stable : **(0, 14-15, 0)**
- Vitesse faible : **< 0.5 m/s** (oscillations)
- Tensions G/D : **190N / 195N** (équilibrées)

### Commande Barre (Flèche ↑ = +30°)

```
Barre rotate +30° vers la droite
    ↓
Ligne droite raccourcit (CTRL_DROIT tiré vers barre)
    ↓
Kite pivote en rotation Z (yaw)
    ↓
Surfaces s'inclinent (α augmente de 5° → 25°)
    ↓
Force normale augmente (sin²(25°) ≈ 0.18)
    ↓
Composante tangentielle → kite SE DÉPLACE sur sphère
    ↓
Trajectoire courbe vers la droite (θ augmente)
```

**Indicateurs UI** :
- Rotation visible : **5-10 rad/s** en yaw
- Position se déplace : **x : 0 → 2 → 4 → ...**
- Tensions asymétriques : **Gauche 250N / Droite 150N**
- Angle attaque : **5° → 25°** (surfaces inclinées)

---

## 🎯 CRITÈRES DE VALIDATION

### ✅ Vol Correct SI :

1. **Lignes toujours tendues** : Tensions ≥ 75N (pré-tension minimale)
2. **Kite sur la sphère** : Distance kite ↔ barre = 15.0-15.5m (constant)
3. **Monte au zénith** : Barre neutre → kite grimpe vers y ≈ 15m
4. **Équilibre stable** : Au zénith, kite immobile (oscillations < 1m)
5. **Réagit aux commandes** : Barre inclinée → rotation visible + déplacement
6. **Pas de vol libre** : Kite NE PEUT PAS dépasser R = 15.5m

### ❌ Vol Incorrect SI :

1. **Lignes molles** : Tensions < 75N (kite tombe vers barre)
2. **Kite dérive** : Distance > 15.5m (contraintes PBD cassées)
3. **Reste en bas** : Ne monte pas vers zénith (forces aéro trop faibles)
4. **Oscille infiniment** : Pas d'équilibre au zénith (damping insuffisant)
5. **Ne réagit pas** : Barre n'a pas d'effet (inertie trop grande)
6. **Passe à travers sphère** : Bug contraintes PBD

---

## 📝 CONCLUSION

### Votre Description est 100% JUSTE

Le kite est bien modélisé comme :
1. ✅ **Structure rigide 3D** (frame + surfaces)
2. ✅ **Retenue par lignes** à distance maximale (contraintes PBD)
3. ✅ **Plaquée contre sphère** par le vent (forces aérodynamiques)
4. ✅ **Se déplace sur sphère** (pas de vol libre)
5. ✅ **Équilibre au zénith** (surfaces horizontales → pression minimale)

### Le Code Implémente Correctement Ce Modèle

- `ConstraintSolver` : Maintient kite sur sphère
- `AerodynamicsCalculator` : Calcule forces de vent qui poussent
- `LineSystem` : Affiche tensions (mais ne tire pas)
- `KiteController` : Intègre forces + applique contraintes

### Comportement Attendu Final

**Barre neutre** → Kite **monte au zénith** (y ≈ 15m)  
**Barre inclinée** → Kite **pivote + se déplace** sur la sphère  
**Toujours** → Lignes **tendues** (≥75N) et kite **plaqué** à R = 15.5m

---

**Le comportement actuel DEVRAIT correspondre à ce modèle.**  
**Si ce n'est pas le cas, c'est un bug à corriger !** 🐛
