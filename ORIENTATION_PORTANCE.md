# Correction de l'orientation de la portance

## 🎯 Objectif
Corriger le calcul de l'orientation de la portance (lift) pour qu'elle respecte la physique pure, sans correction artificielle.

## 🔍 Problème identifié

### Code original (lignes 118-134 de AeroSystem.ts)
```typescript
// Méthode incorrecte utilisant double produit vectoriel
const windCrossNormal = new THREE.Vector3().crossVectors(localWindDir, surfaceNormal);
const liftDir = new THREE.Vector3().crossVectors(windCrossNormal, localWindDir).normalize();

// Correction artificielle - INCORRECT
if (liftDir.y < 0) {
  liftDir.negate();
}
```

**Problèmes:**
1. La correction `if (liftDir.y < 0)` est artificielle et ne respecte pas la physique
2. Le double produit vectoriel ne garantit pas l'orientation correcte par rapport à la face
3. L'approche ne fonctionne pas pour toutes les orientations du cerf-volant

## ✅ Solution implémentée

### Nouvelle méthode `calculateLiftDirection()`

```typescript
private calculateLiftDirection(surfaceNormal: THREE.Vector3, windDir: THREE.Vector3): THREE.Vector3 | null {
  // 1. S'assurer que la normale pointe face au vent
  const dotNW = surfaceNormal.dot(windDir);
  const windFacingNormal = dotNW < 0 ? surfaceNormal.clone().negate() : surfaceNormal.clone();
  
  // 2. Projeter la normale dans le plan perpendiculaire au vent
  // Formule: L = n - (n·w)w
  const dotProjection = windFacingNormal.dot(windDir);
  const liftDir = windFacingNormal.clone().sub(windDir.clone().multiplyScalar(dotProjection));
  
  // 3. Vérifier si le vent est parallèle à la surface
  const liftMagnitude = liftDir.length();
  if (liftMagnitude < 0.01) {
    return null; // Pas de portance
  }
  
  return liftDir.normalize();
}
```

## 📐 Fondements mathématiques

### Preuve que L ⊥ w

Soit:
- `n` = normale de surface (unitaire)
- `w` = direction du vent (unitaire)
- `L = n - (n·w)w` = direction de la portance

**Preuve:**
```
L·w = [n - (n·w)w]·w
    = n·w - (n·w)(w·w)
    = n·w - n·w
    = 0 ✓
```

La portance est mathématiquement perpendiculaire au vent!

### Cas limites

1. **Vent perpendiculaire à la surface** (`n ⊥ w`):
   - `n·w = 0`
   - `L = n - 0×w = n`
   - Portance maximale dans la direction de la normale

2. **Vent parallèle à la surface** (`n ∥ w`):
   - `|n·w| = 1`
   - `L = n - w` ou `L = n + w`
   - `|L| ≈ 0`
   - Pas de portance (physiquement correct)

## 🏗️ Architecture ECS respectée

### Séparation des responsabilités
- **Components** : Données pures uniquement
  - `AerodynamicsComponent` : coefficients, surfaces
  - `PhysicsComponent` : forces, vélocités
  
- **Systems** : Toute la logique
  - `AeroSystem` : calcul des forces aérodynamiques
  - Nouvelle méthode privée `calculateLiftDirection()`

### Ordre d'exécution préservé
1. `WindSystem` (priorité 20) → calcule vent apparent
2. `AeroSystem` (priorité 30) → calcule forces aéro ✨ MODIFIÉ
3. `ConstraintSystem` (priorité 40) → contraintes lignes
4. `PhysicsSystem` (priorité 50) → intégration forces

Pas d'impact sur les autres systèmes ✓

## 🎯 Résultats attendus

### Avantages
✅ **Physique pure** : Pas de correction artificielle  
✅ **Orientation naturelle** : Émerge de la géométrie  
✅ **Robustesse** : Fonctionne pour toutes orientations  
✅ **Gestion cas limites** : Vent parallèle géré correctement  
✅ **Architecture ECS** : Logique dans System uniquement  

### Comportement
- La portance suit naturellement l'orientation de la face
- Plus besoin de forcer `liftDir.y > 0`
- Le cerf-volant réagit de manière cohérente au vent
- Les forces émergent de la géométrie pure

## 📝 Commits

### Branche `fix-lift-orientation`

1. **Initial** (d5ba132): État avant travail
2. **Fix** (0f38782): Calcul correct de l'orientation de la portance
   - Ajout de `calculateLiftDirection()`
   - Suppression correction artificielle
   - Gestion vent parallèle
   - Documentation complète

## 🧪 Tests à effectuer

1. **Cerf-volant face au vent** : La portance doit pousser vers le haut et l'extérieur
2. **Cerf-volant en virage** : Les forces doivent générer un couple naturel
3. **Angles extrêmes** : Pas d'explosion des forces
4. **Vent faible** : Comportement stable
5. **Orientation arbitraire** : Physique cohérente

## 📚 Références

- Architecture ECS pure du projet
- Principes aérodynamiques standards
- Algèbre vectorielle (projection orthogonale)

---

**Date**: 20 octobre 2025  
**Branche**: `fix-lift-orientation`  
**Auteur**: Agent IA (GitHub Copilot)
