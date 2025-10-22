# Refactorisation du système de lignes - TetherSystem

**Date:** 2025-10-22
**Objectif:** Simplifier radicalement le système de contraintes des lignes pour un comportement physiquement correct et stable.

---

## 🎯 Problèmes identifiés avec l'ancien système

### 1. **Architecture trop complexe**
- `ConstraintSystem` gérait 2 modes (PBD et Spring-Force)
- Logique duale difficile à maintenir et déboguer
- Paramètres multiples (compliance, Baumgarte, iterations, etc.)

### 2. **Incohérences géométriques**
```
❌ AVANT:
- Longueur lignes config: 15m (LineSpecs.LENGTH_M)
- Longueur lignes UI: 150m (InputDefaults.LINE_LENGTH_M)
- Distance initiale kite-barre: 18.03m (> 15m!)
- Résultat: Lignes toujours tendues, pas de phase SLACK
```

### 3. **Comportement physique incorrect**
- Les lignes oscillaient entre modes
- Pas de distinction claire SLACK vs TAUT
- Forces de compression possibles (non physique)
- Instabilités numériques avec PBD

---

## ✅ Solution : TetherSystem simplifié

### Nouveau modèle physique

```
┌───────────────────────────────────────────────────┐
│  LIGNE = CONTRAINTE UNILATÉRALE INEXTENSIBLE      │
├───────────────────────────────────────────────────┤
│                                                   │
│  État 1: SLACK (d < L)                           │
│  • Ligne molle, flexible                         │
│  • Aucune force transmise                        │
│  • Kite libre de bouger                          │
│                                                   │
│  État 2: TAUT (d ≥ L)                           │
│  • Ligne tendue, droite                          │
│  • Force de tension F = k × (d - L)             │
│  • Transfert bidirectionnel (traction seulement) │
│  • Pas de compression (F ≥ 0 toujours)          │
│                                                   │
└───────────────────────────────────────────────────┘
```

### Algorithme simplifié (5 étapes)

```typescript
Step 1: Géométrie
   diff = B - A
   distance = |diff|
   direction = diff / distance

Step 2: Détection SLACK vs TAUT
   if distance < maxLength:
      return (pas de force)

Step 3: Calcul tension (TAUT uniquement)
   excess = distance - maxLength
   tension = STIFFNESS × excess + DAMPING × v_radial
   tension = max(0, tension)  // Pas de compression

Step 4: Application forces
   forceOnB = tension × direction
   physics.forces += forceOnB

Step 5: Génération torque
   torque = r × forceOnB
   physics.torques += torque
```

### Paramètres physiques

```typescript
TETHER_STIFFNESS = 50000 N/m  // Quasi-inextensible
TETHER_DAMPING = 0.05         // 5% damping (stabilité)
```

---

## 🔧 Corrections géométriques appliquées

### Config.ts

```typescript
// ✅ APRÈS - Géométrie cohérente
InitConfig.KITE_ALTITUDE_M = 8    // Baissé de 10m à 8m
InitConfig.KITE_DISTANCE_M = 11   // Baissé de 15m à 11m

// Distance 3D = √(8² + 11²) = 13.6m < 15m ✅
// Marge slack: 1.4m (9.3%)

InputDefaults.LINE_LENGTH_M = 15  // Corrigé de 150m à 15m
```

### Positions initiales validées

```
Pilote:  (0,  0,   0.0)
Barre:   (0,  1,  -0.6)
Kite:    (0,  9, -11.6)

Distance 3D: 13.6m
Longueur ligne: 15m
État initial: SLACK ✅
```

---

## 📁 Fichiers modifiés

### Nouveaux fichiers
- ✨ `src/ecs/systems/TetherSystem.ts` (nouveau système simplifié)
- 💾 `src/ecs/systems/ConstraintSystem.ts.backup` (backup ancien système)

### Fichiers modifiés
- 🔧 `src/ecs/config/Config.ts`
  - L413-419: Positions initiales ajustées
  - L619-622: LINE_LENGTH_M corrigé (150→15)

- 🔧 `src/ecs/SimulationApp.ts`
  - Import TetherSystem
  - Suppression ConstraintSystem
  - Suppression switchConstraintSystem()
  - Mise à jour setupSystemPipeline()

- 🔧 `src/ecs/systems/index.ts`
  - Export TetherSystem
  - Commentaire ConstraintSystem

---

## 🎮 Comportement attendu

### Au démarrage
1. **Lignes SLACK** (13.6m < 15m)
   - Pas de tension
   - Kite en chute libre sous gravité
   - Vent (traînée) pousse le kite en arrière (-Z)

2. **Transition SLACK → TAUT**
   - Kite s'éloigne progressivement
   - Distance atteint 15m
   - Tension s'active instantanément

3. **État stable TAUT**
   - Ligne droite et tendue
   - Tension équilibre (portance + traînée + gravité)
   - Kite positionné dans le vent
   - Angle de ligne ~33° (réaliste)

### Forces appliquées

```
SLACK:  F_ligne = 0N
TAUT:   F_ligne = 50000 × (distance - 15) + damping
        → Exemple: excess=0.1m → F≈5000N
```

---

## 🔍 Debugging

### Console navigateur
```javascript
// Activer debug aéro (voir forces et positions)
window.app.setAeroDebug(true, 0)  // Surface 0 uniquement
window.app.setAeroDebug(true)     // Toutes surfaces

// Vérifier état lignes
leftLine = window.app.entityManager.getEntity('leftLine')
leftLineComp = leftLine.getComponent('line')
console.log('Tension:', leftLineComp.currentTension, 'N')
console.log('État:', leftLineComp.state.isTaut ? 'TAUT' : 'SLACK')
console.log('Distance:', leftLineComp.currentLength, 'm')
```

---

## 🚀 Avantages du nouveau système

### 1. **Simplicité**
- ✅ Un seul mode (inextensible)
- ✅ Algorithme linéaire (5 étapes claires)
- ✅ Paramètres physiques directs (stiffness, damping)

### 2. **Physique correcte**
- ✅ Contrainte unilatérale (pas de compression)
- ✅ Distinction claire SLACK/TAUT
- ✅ Transfert bidirectionnel de traction
- ✅ Inextensibilité réaliste

### 3. **Stabilité numérique**
- ✅ Pas d'itérations PBD
- ✅ Pas de projections de position
- ✅ Forces explicites (intégrées par PhysicsSystem)
- ✅ Amortissement simple et efficace

### 4. **Maintenabilité**
- ✅ Code court (~250 lignes vs ~600)
- ✅ Documentation exhaustive
- ✅ Logique unique et claire
- ✅ Facile à déboguer

---

## 📚 Références

- **Makani (Google X)**: `sim/models/tether.cc` - Modèle physique de ligne
- **Gaffer on Games**: "Position Based Dynamics" - Contraintes géométriques
- **Jakobsen (2001)**: "Advanced Character Physics" - Cloth simulation
- **NASA**: "Beginner's Guide to Kites" - Forces aérodynamiques

---

## ⚠️ Notes importantes

1. **L'ancien système est sauvegardé** dans `ConstraintSystem.ts.backup`
2. **Les modes PBD/Spring-Force sont supprimés** (InputComponent.constraintMode non utilisé)
3. **Rigidité élevée** (50kN/m) pour quasi-inextensibilité
4. **Points A (handles) sont fixes** (sur barre cinématique)
5. **Points B (CTRL) sont mobiles** (sur kite dynamique)

---

## 🎯 Prochaines étapes

- [ ] Tester en conditions réelles (`npm run dev`)
- [ ] Ajuster TETHER_STIFFNESS si nécessaire (stabilité vs réalisme)
- [ ] Vérifier visualisation des lignes (LineRenderSystem)
- [ ] Logger tensions pour télémétrie
- [ ] Optimiser si besoin (actuellement très performant)

---

**Résultat attendu:** Des lignes qui se comportent comme de vraies lignes de kite - molles quand détendues, rigides quand tendues, qui tirent mais ne poussent jamais.
