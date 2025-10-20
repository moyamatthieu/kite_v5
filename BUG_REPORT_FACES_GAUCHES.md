# 🐛 Bug Fix: Les faces gauches du kite généraient zéro portance

## Commit
```
f7fddd8 - fix: Corriger l'orientation des normales des faces gauches du kite
```

## Résumé du problème

Les deux surfaces du **côté gauche** du cerf-volant (faces 1 et 2, `leftUpper` et `leftLower`) généraient **zéro portance** parce que leurs **normales pointaient dans la mauvaise direction** (Z+ au lieu de Z-).

### Symptômes observés
- ❌ Faces gauches: normales pointant en Z+ (vers l'avant)
- ✅ Faces droites: normales pointant en Z- (vers l'arrière)
- ❌ Résultat: Forces aérodynamiques nulles sur faces gauches

## Méthodologie d'investigation

### Étape 1️⃣: Vérifier la géométrie locale
Script: `debug-surfaces.ts`

**Résultat**: Les normales locales étaient correctes (Z-) !
```
Face 1 (leftUpper)  - Normale locale: (-0.3979, 0.5050, -0.7659)  ✅ Z-
Face 2 (leftLower)  - Normale locale: (0.3417, 0.0000, -0.9398)   ✅ Z-
```

Donc le problème n'était **pas** dans la géométrie locale.

### Étape 2️⃣: Vérifier la transformation vers le monde
Script: `debug-transformation.ts`

**Résultat**: La transformation quaternionienne était correcte (Z-) !
```
Face 1 (leftUpper)  - Normale monde: (-0.398, 0.570, -0.719)  ✅ Z-
Face 2 (leftLower)  - Normale monde: (0.342, 0.082, -0.936)   ✅ Z-
```

Donc le problème n'était **pas** dans la transformation.

### Étape 3️⃣: Vérifier ce que AeroSystem reçoit réellement
Script: `test-surfaces-aero.ts`

**BINGO! Problème trouvé:**
```
AVANT (BUGUÉ):
  Face 1 (leftUpper)
    Points: NEZ, BORD_GAUCHE, WHISKER_GAUCHE      ← ⚠️ Ordre inversé!
    Normale monde: (0.398, -0.570, 0.719)         ← ❌ Z+ (MAUVAIS!)

  Face 3 (rightUpper)
    Points: NEZ, BORD_DROIT, WHISKER_DROIT        ← ✅ Ordre correct
    Normale monde: (0.398, 0.570, -0.719)         ← ✅ Z- (BON!)
```

## Root Cause: Duplication de données avec ordre différent

Le problème venait d'une **duplication de données géométriques** qui n'était pas synchronisée.

### Deux sources de surface définissaient le même kite:

1. **`addGeometryComponent()`** - Pour le rendu
```typescript
geometry.addSurface(['NEZ', 'WHISKER_GAUCHE', 'BORD_GAUCHE']);   // Face 1
geometry.addSurface(['NEZ', 'SPINE_BAS', 'WHISKER_GAUCHE']);     // Face 2
```

2. **`addAerodynamicsComponent()`** - Pour les calculs aéro
```typescript
// ❌ MAUVAIS - Ordre inversé pour faces gauches!
{ name: 'leftUpper', points: ['NEZ', 'BORD_GAUCHE', 'WHISKER_GAUCHE'] },
{ name: 'leftLower', points: ['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS'] },
```

### Pourquoi c'est critique?

La formule du calcul de normale (règle de la main droite) dépend **totalement de l'ordre des vertices**:

```
Normal = (P2 - P1) × (P3 - P1)
```

**Inverser l'ordre** des 2 derniers points change la direction de la normale:
- Si P1=A, P2=B, P3=C → Normal = (B-A) × (C-A) = **N**
- Si P1=A, P2=C, P3=B → Normal = (C-A) × (B-A) = **-N** (inversé!)

## La solution

Synchroniser l'ordre des vertices:

```typescript
// ✅ CORRIGÉ - Même ordre que addGeometryComponent()
const aeroSurfaces = [
  { name: 'leftUpper',  points: ['NEZ', 'WHISKER_GAUCHE', 'BORD_GAUCHE'] },
  { name: 'leftLower',  points: ['NEZ', 'SPINE_BAS', 'WHISKER_GAUCHE'] },
  { name: 'rightUpper', points: ['NEZ', 'BORD_DROIT', 'WHISKER_DROIT'] },
  { name: 'rightLower', points: ['NEZ', 'WHISKER_DROIT', 'SPINE_BAS'] }
];
```

### Résultat APRÈS correction:
```
APRÈS (CORRIGÉ):
  Face 1 (leftUpper)
    Points: NEZ, WHISKER_GAUCHE, BORD_GAUCHE      ← ✅ Ordre correct!
    Normale monde: (-0.398, 0.570, -0.719)        ← ✅ Z- (BON!)

  Face 2 (leftLower)
    Points: NEZ, SPINE_BAS, WHISKER_GAUCHE        ← ✅ Ordre correct!
    Normale monde: (0.342, 0.082, -0.936)         ← ✅ Z- (BON!)
```

## Leçons apprises

### ✅ Ce qui a aidé à trouver le bug:

1. **Approche layered** - Tester chaque couche séparément:
   - Géométrie locale ✓
   - Transformation ✓
   - Système d'utilisation ← **Bug trouvé ici**

2. **Logging du debug** - Afficher les normales monde dans AeroSystem a révélé l'ordre inversé

3. **Comparaison symétrique** - Comparer faces gauches vs droites pour voir l'asymétrie

### ⚠️ Erreurs à éviter:

1. **Ne pas dupliquer les données géométriques** - Une seule source de vérité
2. **L'ordre des vertices est critique** - En ECS comme en géométrie
3. **Tester la symétrie** - Les faces gauches/droites doivent être symétriques

## Fichiers modifiés

- **`src/ecs/entities/KiteFactory.ts`**
  - Corrigé `addAerodynamicsComponent()` pour utiliser le même ordre que `addGeometryComponent()`

## Scripts de debug créés

- `debug-surfaces.ts` - Analyse les normales locales des surfaces
- `debug-transformation.ts` - Teste la transformation quaternionienne
- `test-surfaces-aero.ts` - Vérifie ce qu'AeroSystem reçoit réellement

Ces scripts peuvent être utilisés pour détecter des problèmes similaires à l'avenir.
