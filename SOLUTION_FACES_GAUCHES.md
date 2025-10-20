# Résolution du problème des faces gauches qui génèrent zéro portance

## Problème identifié

Les surfaces du côté gauche du cerf-volant (faces 1 et 2) générait zéro portance car leurs normales pointaient dans la mauvaise direction.

### Symptômes
- Les faces gauches avaient des normales pointant en Z+ (vers l'avant)
- Les faces droites avaient des normales pointant correctement en Z- (vers l'arrière)
- Les faces gauches ne contribuaient pas aux forces aérodynamiques

### Investigation

#### Étape 1: Vérification de la géométrie locale
Un script de debug (`debug-surfaces.ts`) a confirmé que:
- Les normales locales étaient correctes (Z-)
- L'ordre des vertices dans `KiteFactory.addGeometryComponent()` était correct

```typescript
// Dans addGeometryComponent():
geometry.addSurface(['NEZ', 'WHISKER_GAUCHE', 'BORD_GAUCHE']); // Face 1
geometry.addSurface(['NEZ', 'SPINE_BAS', 'WHISKER_GAUCHE']);  // Face 2
```

#### Étape 2: Vérification de la transformation vers le monde
Un script de debug (`debug-transformation.ts`) a confirmé que:
- La transformation quaternionienne était correcte
- Les normales restaient correctes après transformation (Z-)
- La symétrie gauche/droite était correcte

#### Étape 3: Vérification dans AeroSystem
Un test (`test-surfaces-aero.ts`) a révélé le problème réel:

**AVANT (BUGUÉ):**
```
Points: NEZ, BORD_GAUCHE, WHISKER_GAUCHE      ← Ordre inversé!
Normale monde: (0.398, -0.570, 0.719)         ← Z+ (MAUVAIS)
```

**L'ordre dans `addAerodynamicsComponent()` était INVERSÉ:**
```typescript
// Dans addAerodynamicsComponent() - MAUVAIS:
{ name: 'leftUpper', points: ['NEZ', 'BORD_GAUCHE', 'WHISKER_GAUCHE'] },
{ name: 'leftLower', points: ['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS'] },

// Vs géométrie:
geometry.addSurface(['NEZ', 'WHISKER_GAUCHE', 'BORD_GAUCHE']);
geometry.addSurface(['NEZ', 'SPINE_BAS', 'WHISKER_GAUCHE']);
```

## Root Cause

L'ordre des vertices n'était pas synchronisé entre:
- **`KiteFactory.addGeometryComponent()`** - définit les surfaces pour le rendu
- **`KiteFactory.addAerodynamicsComponent()`** - définit les surfaces pour les calculs aéro

Cet ordre est **critique** car il détermine la direction de la normale via la règle de la main droite:
```
Normal = (P2 - P1) × (P3 - P1)
```

Les faces gauches avaient l'ordre des deux derniers points inversé, ce qui inversait la normale.

Les faces droites avaient le bon ordre (par chance, peut-être une copie-colle asymétrique).

## Solution

Synchroniser l'ordre des vertices entre les deux méthodes:

```typescript
// Dans addAerodynamicsComponent() - CORRIGÉ:
const aeroSurfaces = [
  // Face 1 (leftUpper) - MÊME ordre que geometry
  { name: 'leftUpper', points: ['NEZ', 'WHISKER_GAUCHE', 'BORD_GAUCHE'] },
  
  // Face 2 (leftLower) - MÊME ordre que geometry
  { name: 'leftLower', points: ['NEZ', 'SPINE_BAS', 'WHISKER_GAUCHE'] },
  
  // Face 3 (rightUpper) - déjà correct
  { name: 'rightUpper', points: ['NEZ', 'BORD_DROIT', 'WHISKER_DROIT'] },
  
  // Face 4 (rightLower) - déjà correct
  { name: 'rightLower', points: ['NEZ', 'WHISKER_DROIT', 'SPINE_BAS'] }
];
```

### Résultat APRÈS la correction:
```
Face leftUpper:
  Points: NEZ, WHISKER_GAUCHE, BORD_GAUCHE  ← Ordre correct!
  Normale monde: (-0.398, 0.570, -0.719)    ← Z- (BON!)

Face leftLower:
  Points: NEZ, SPINE_BAS, WHISKER_GAUCHE    ← Ordre correct!
  Normale monde: (0.342, 0.082, -0.936)     ← Z- (BON!)
```

## Fichiers modifiés

- **`src/ecs/entities/KiteFactory.ts`**: Correction de l'ordre des vertices dans `addAerodynamicsComponent()`

## Enseignements

1. **La géométrie locale était correcte** - le problème n'était pas dans la définition des points
2. **La transformation monde était correcte** - le problème n'était pas dans le calcul des normales
3. **Le problème était de la duplication de données** - les surfaces étaient définies deux fois avec un ordre différent
4. **L'ordre des vertices est critique** - en ECS comme en géométrie 3D, l'ordre détermine la direction de la normale

### Bonnes pratiques à retenir
- Éviter la duplication de données géométriques
- Si les surfaces sont définies dans plusieurs endroits, utiliser une seule source de vérité
- Ajouter des tests/assertions pour vérifier la cohérence des normales
- Logger les normales monde pour le debug (cela a été clé pour identifier ce problème!)

## Tests effectués

1. ✅ `debug-surfaces.ts` - Confirme que les normales locales sont correctes
2. ✅ `debug-transformation.ts` - Confirme que la transformation quaternionienne est correcte
3. ✅ `test-surfaces-aero.ts` - Identifie l'inversion d'ordre dans AeroSystem
4. ✅ Simulation en direct - Vérifie que le correctif fonctionne
