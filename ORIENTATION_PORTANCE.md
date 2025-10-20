# Correction de l'orientation de la portance

## 🎯 Objectif
Corriger le calcul de l'orientation de la portance (lift) pour qu'elle respecte la physique d'un cerf-volant à surface plane : **la portance est normale à la face**.

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
2. Le double produit vectoriel force la portance à être perpendiculaire au vent (physique d'aile d'avion)
3. Pour un cerf-volant à surface plane, la force principale est **normale à la surface**, pas perpendiculaire au vent

## 📐 Physique correcte d'un cerf-volant

### Différence aile d'avion vs surface plane

**Aile d'avion (profil aérodynamique):**
- Lift ⊥ vent (perpendiculaire au vent)
- Drag ∥ vent (parallèle au vent)

**Cerf-volant (surface plane):**
- Lift = normale à la surface (orientée face au vent)
- Drag = parallèle au vent
- La force aérodynamique principale pousse perpendiculairement à la surface

## ✅ Solution implémentée

### Nouvelle méthode `calculateLiftDirection()` - Version finale

```typescript
private calculateLiftDirection(surfaceNormal: THREE.Vector3, windDir: THREE.Vector3): THREE.Vector3 {
  // S'assurer que la normale pointe face au vent
  const dotNW = surfaceNormal.dot(windDir);
  return dotNW < 0 ? surfaceNormal.clone().negate() : surfaceNormal.clone();
}
```

**C'est tout !** La portance est simplement la normale de la face, orientée face au vent.

## 📐 Fondements physiques

### Pour une surface plane (cerf-volant)

La force aérodynamique totale est perpendiculaire à la surface. Cette force se décompose en:

```
Force_totale = Lift + Drag

Où:
- Lift = CL × q × A × normale_face
- Drag = CD × q × A × vent_dir
```

Les coefficients CL et CD (qui dépendent de l'angle d'attaque) dosent l'intensité de chaque composante.

### Orientation de la normale

Pour garantir que la normale pointe face au vent:
```
if (normale · vent < 0):
  normale_orientée = -normale
else:
  normale_orientée = normale
```

Simple et physiquement correct !

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
✅ **Physique correcte** : Lift = normale pour surface plane  
✅ **Simplicité** : Code court et clair  
✅ **Robustesse** : Fonctionne pour toutes orientations  
✅ **Réalisme** : Force perpendiculaire à la surface du kite  
✅ **Architecture ECS** : Logique dans System uniquement  

### Comportement
- La portance pousse perpendiculairement à la surface du cerf-volant
- La traînée tire dans la direction du vent
- Les coefficients CL et CD dosent chaque force selon l'angle d'attaque
- Comportement naturel et réaliste émergent

## 📝 Commits

### Branche `fix-lift-orientation`

1. **Initial** (d5ba132): État avant travail
2. **Tentative 1** (0f38782): Calcul avec projection perpendiculaire au vent (INCORRECT pour surface plane)
3. **Fix final** (dc06991): Portance = normale de la face (CORRECT)
   - Simplification radicale de `calculateLiftDirection()`
   - Suppression projection perpendiculaire
   - Physique correcte pour cerf-volant

## 🧪 Tests à effectuer

1. **Cerf-volant face au vent** : La portance doit pousser vers le haut et l'extérieur
2. **Cerf-volant en virage** : Les forces doivent générer un couple naturel
3. **Angles extrêmes** : Pas d'explosion des forces
4. **Vent faible** : Comportement stable
5. **Orientation arbitraire** : Physique cohérente

## 📚 Références

- Architecture ECS pure du projet
- Physique des surfaces planes (vs profils aérodynamiques)
- Différence aile d'avion / cerf-volant

---

**Date**: 20 octobre 2025  
**Branche**: `fix-lift-orientation`  
**Auteur**: Agent IA (GitHub Copilot)  
**Version finale**: Lift = normale de la face (surface plane)
