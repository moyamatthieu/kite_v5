# Orientation Kite dans Fenêtre de Vol
**Date :** 2025-10-06  
**Problème :** Kite devrait changer inclinaison selon position (sol→zénith)  
**Cause :** Couple gravitationnel manquant

---

## 1. COMPORTEMENT ATTENDU

### Fenêtre de Vol (vue latérale)

```
                    ZÉNITH (90°)
                         ●
                        /│\   Kite quasi-horizontal
                       / │ \  α ≈ 10-20°
                      /  │  \
                     /   │   \
                    /    │    \
                   /     │     \
         45°      ●      │      ●  45°
        /        /│\     │     /│\        \
       /        / │ \    │    / │ \        \
      /        /  │  \   │   /  │  \        \
     /        /   │   \  │  /   │   \        \
    /        /    │    \ │ /    │    \        \
   /        /     │     \│/     │     \        \
  /        /      │      ●      │      \        \
 /        /       │     /│\     │       \        \
SOL     ●─────────┼────┼─┼─────┼────────●     SOL
        │         │   /  │  \   │        │
        │         │  /   │   \  │        │
        │         │ /    │    \ │        │
      PILOTE      │/     │     \│      PILOTE
                  ●──────┼──────●
                       LIGNES
                       
Position    Angle α   Orientation
──────────  ────────  ───────────────────────
Sol         ~90°      Perpendiculaire au vent
45°         ~45°      Intermédiaire
Zénith      ~15°      Quasi-horizontal
```

### Physique Responsable

**Deux effets combinés :**

1. **Gravité + Centre de Gravité (CG)**
   - Force mg appliquée au CG
   - Crée un couple τ_g si CG ≠ point d'attache

2. **Tension Lignes + Point d'Attache**
   - Force tension au bridle point
   - Oppose la gravité + traînée

**Équilibre :**
```
τ_total = τ_aéro + τ_gravité + τ_damping = 0

Résultat : Kite s'oriente pour minimiser couple résultant
→ Angle d'attaque varie selon position dans fenêtre
```

---

## 2. ANALYSE ACTUELLE DU CODE

### Forces Appliquées (PhysicsEngine.ts)

```typescript
// ✅ Forces aérodynamiques
const { lift, drag, torque: aeroTorque } = AerodynamicsCalculator.calculateForces(...)

// ✅ Gravité (force)
const gravity = new THREE.Vector3(0, -mass × g, 0)

// ✅ Force totale
const totalForce = lift + drag + gravity

// ❌ PROBLÈME : Couple gravitationnel manquant !
const totalTorque = aeroTorque.clone()  // SEULEMENT aéro !
```

### Pourquoi le Couple Gravitationnel est Manquant ?

**Raison :** La gravité est appliquée au **centre de masse** (position du kite), mais :
- Le **centre de pression aéro** est différent (plus avant)
- Le **bridle point** (attache lignes) est différent (plus arrière)

**Conséquence :** Déséquilibre des moments crée un couple !

---

## 3. PHYSIQUE DU COUPLE GRAVITATIONNEL

### Diagramme des Points Clés

```
     NEZ (avant)
        ●
        │ \
        │  \  Centre de pression aéro
        │   ● (CP)
        │    \
        │     \
        ●      \  Centre de gravité
       CG       \ (masse distribuée)
         \       \
          \       \
           \       ● Bridle Point (BP)
            \     /│  Attache lignes
             \   / │
              \ /  │
               ●───┴─── CTRL_GAUCHE/DROIT
              Ligne
```

### Calcul du Couple Gravitationnel

**Principe :** τ = r × F

```typescript
// Position du centre de gravité (CG) relatif au kite
const CG = kite.position  // Centre du corps rigide

// Position du bridle point (BP) en coordonnées monde
const BP_local = kite.getPoint("BRIDLE_POINT") // ou moyenne CTRL_GAUCHE/DROIT
const BP_world = BP_local.rotate(kite.quaternion) + CG

// Bras de levier gravité
const r_gravity = CG - BP_world  // Du point d'attache vers CG

// Force gravitationnelle
const F_gravity = (0, -mg, 0)

// Couple gravitationnel
τ_gravity = r_gravity × F_gravity
```

**Effet physique :**
- Si CG **en avant** de BP → Couple fait piquer le nez vers le bas
- Si CG **en arrière** de BP → Couple fait cabrer le nez vers le haut
- Équilibre avec couple aéro → Angle d'attaque stable

---

## 4. VALIDATION THÉORIQUE

### Cas 1 : Kite Proche du Sol (Position Basse)

```
Vent horizontal →
                        
    ●───────●  Kite perpendiculaire
    │       │  α ≈ 90°
    │   CG  │
    │   ●   │
    │  /│   │
    │ / │   │
    │/  │   │
    ● BP│   │
     \  │   │
      \ │   │
       \│   │
        ●───┘ Ligne tendue vers pilote (bas)

Tension ligne : Forte composante verticale
Gravité : Vers le bas
→ Couple gravitationnel : Tend à maintenir kite vertical
→ Angle d'attaque : Fort (~90°)
```

### Cas 2 : Kite au Zénith (Position Haute)

```
Vent horizontal →
                        
    ●───────●  Kite quasi-horizontal
    │       │  α ≈ 15°
    │       │
    │   ●CG │
    │   │\  │
    │   │ \ │
    │   │  \│
    │   │   ● BP
    │   │  /
    │   │ /
    │   │/
    └───●  Ligne tendue vers pilote (bas)

Tension ligne : Forte composante horizontale
Gravité : Vers le bas
→ Couple gravitationnel : Tend à incliner kite horizontal
→ Angle d'attaque : Faible (~15°)
```

### Équations d'Équilibre

**Couple total nul à l'équilibre :**

```
τ_total = τ_aéro + τ_gravity + τ_damping = 0

Avec :
  τ_aéro = Σ(r_CP × F_aéro)  // Couples surfaces aéro
  τ_gravity = r_CG×BP × F_gravity  // Couple pendulaire
  τ_damping = -I × k × ω  // Amortissement rotation

Résultat :
  Position basse → τ_gravity favorise α grand
  Position haute → τ_gravity favorise α petit
  → Transition naturelle dans fenêtre de vol ✅
```

---

## 5. IMPLÉMENTATION PROPOSÉE

### Modifications Nécessaires

#### A. Définir Centre de Gravité

**Fichier :** `src/objects/organic/Kite.ts`

```typescript
// Ajouter point anatomique pour CG
static readonly POINTS = {
  // ... points existants
  CENTER_OF_GRAVITY: new THREE.Vector3(0, 0.2, 0.1), // Légèrement en arrière
  BRIDLE_POINT: new THREE.Vector3(0, 0.25, 0.35), // Moyenne des CTRL
}
```

**Justification positions :**
- CG légèrement **en arrière** du centre géométrique (tissu + frame)
- BP au niveau des **points d'attache** brides principales

#### B. Calculer Couple Gravitationnel

**Fichier :** `src/simulation/physics/PhysicsEngine.ts`

```typescript
// Après calcul forces aérodynamiques :

// NOUVEAU : Couple gravitationnel (stabilisation pendulaire)
const CG = kite.position // Centre du corps rigide
const BP_local = kite.getPoint("BRIDLE_POINT") || 
                 kite.getPoint("CTRL_GAUCHE").lerp(kite.getPoint("CTRL_DROIT"), 0.5)
const BP_world = BP_local.clone().applyQuaternion(kite.quaternion).add(CG)

// Bras de levier : du bridle point vers centre de gravité
const r_pendulum = CG.clone().sub(BP_world)

// Couple gravitationnel : τ = r × F
const gravityTorque = new THREE.Vector3().crossVectors(r_pendulum, gravity)

// Couple total (aéro + gravité)
const totalTorque = aeroTorque.clone().add(gravityTorque)
```

#### C. Couple de Tension (Optionnel mais Recommandé)

**Concept :** Les lignes tendues créent aussi un couple qui stabilise

```typescript
// Couple dû aux tensions de ligne (effet stabilisant)
const lineTensions = this.lineSystem.getLineTensions() // Récupérer tensions calculées

// Pour chaque ligne :
const ctrlLeft_world = kite.getPoint("CTRL_GAUCHE")
  .clone().applyQuaternion(kite.quaternion).add(CG)
  
const lineDir_left = handles.left.clone().sub(ctrlLeft_world).normalize()
const tensionForce_left = lineDir_left.multiplyScalar(lineTensions.left)

// Couple de tension
const tensionTorque_left = new THREE.Vector3()
  .crossVectors(ctrlLeft_world.sub(CG), tensionForce_left)

// Idem pour ligne droite, puis sommer
```

---

## 6. VALIDATION NUMÉRIQUE ATTENDUE

### Test 1 : Kite à 5m d'altitude (Bas)

```
Position : (0, 5, 10) m
Pilote : (0, 1, 0) m
Angle lignes : ~20° (presque horizontal)

Couples attendus :
  τ_aéro : (0, ?, 0) N·m  (selon asymétrie G/D)
  τ_gravity : (?, 0, 0) N·m  (pitch vers vertical)
  → Équilibre α ≈ 70-80°
```

### Test 2 : Kite à 12m d'altitude (Haut)

```
Position : (0, 12, 8) m
Pilote : (0, 1, 0) m
Angle lignes : ~60° (vers le haut)

Couples attendus :
  τ_aéro : (0, ?, 0) N·m  (selon asymétrie G/D)
  τ_gravity : (?, 0, 0) N·m  (pitch vers horizontal)
  → Équilibre α ≈ 15-25°
```

### Test 3 : Transition Dynamique

```
Scénario : Kite monte du sol vers zénith

Temps  Altitude  Angle α  τ_gravity  Comportement
─────  ────────  ───────  ─────────  ────────────
0s     5m        80°      +0.5 N·m   Stable vertical
5s     8m        60°      +0.2 N·m   Transition
10s    11m       30°      -0.1 N·m   Transition
15s    13m       20°      -0.3 N·m   Stable horizontal

→ Variation continue et fluide ✅
```

---

## 7. ALTERNATIVES CONSIDÉRÉES

### Option A : Couple Gravitationnel Seul (RECOMMANDÉ)

**Avantages :**
- Simple à implémenter
- Physiquement correct
- Effet principal

**Inconvénients :**
- Ne capture pas effet stabilisant des lignes tendues

### Option B : Couple Gravité + Tension Lignes (COMPLET)

**Avantages :**
- Physique complète
- Captures tous effets stabilisants
- Plus réaliste

**Inconvénients :**
- Plus complexe
- Nécessite calcul tensions (déjà fait pour affichage)

### Option C : Couple Empirique Position-Dépendant (DÉCONSEILLÉ)

**Exemple :**
```typescript
// ❌ NE PAS FAIRE (non physique)
const altitudeRatio = kite.position.y / maxAltitude
const empiricalTorque = someFunction(altitudeRatio)
```

**Problème :** Pas physique, ne généralise pas

---

## 8. PLAN D'IMPLÉMENTATION

### Phase 1 : Couple Gravitationnel Simple ✅ RECOMMANDÉ

1. Définir CG et BP dans `Kite.ts`
2. Calculer couple gravitationnel dans `PhysicsEngine.ts`
3. Ajouter au `totalTorque`
4. Tester et valider

### Phase 2 : Ajustements (Si Nécessaire)

1. Ajuster position CG si comportement pas optimal
2. Vérifier ordres de grandeur couples
3. Équilibrer avec damping angulaire

### Phase 3 : Couple Tension Lignes (Optionnel)

1. Récupérer tensions calculées
2. Calculer couples tension
3. Ajouter au total
4. Comparer avec/sans

---

## 9. RÉFÉRENCES

### Physique des Pendules

- **Pendule simple :** τ = mgL × sin(θ)
- **Notre cas :** τ = r × F où r = vecteur CG→BP

### Littérature Kite

- Loyd, M.L. "Crosswind Kite Power" (1980)
  - Section sur stabilité pendulaire
  
- Fagiano, L. et al. "Airborne Wind Energy" (2013)
  - Chapitre 3 : Flight dynamics

---

## 10. CHECKLIST VALIDATION

Après implémentation :

- [ ] Kite proche sol → angle α > 60°
- [ ] Kite au zénith → angle α < 30°
- [ ] Transition fluide entre positions
- [ ] Pas d'oscillations excessive
- [ ] Couple gravitationnel cohérent (ordre 0.1-1.0 N·m)
- [ ] Pas d'impact négatif sur stabilité globale

---

**Conclusion :**

L'ajout du couple gravitationnel est **essentiel** pour reproduire le comportement naturel d'un cerf-volant dans sa fenêtre de vol. C'est un effet physique réel, pas un artifice de simulation.

**Recommandation :** Implémenter Phase 1 (couple gravitationnel simple) immédiatement.
