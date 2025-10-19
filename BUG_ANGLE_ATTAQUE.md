# 🐛 BUG REPORT: Angle d'attaque incorrect en AeroSystem

## Problème

Dans `AeroSystem.ts` lignes 104-109, l'angle d'attaque est calculé comme:
```typescript
const chord = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.quaternion);
const dotProduct = chord.dot(localWindDir);
const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;
```

## Pourquoi c'est faux

1. **Vecteur corde arbitraire**: `(1, 0, 0)` n'a pas de sens pour un cerf-volant delta
2. **Pas lié à la normal de surface**: Le calcul de CL/CD utilise cet alpha MAIS la portance s'applique dans la direction de `sample.normal` (ligne 134)
3. **Incohérence**: alpha calculé avec un vecteur arbitraire, mais forces appliquées avec la normale du panneau

## Conséquence

- Les coefficients CL et CD sont basés sur un mauvais angle d'attaque
- Chaque panneau devrait avoir son propre angle d'attaque basé sur sa normale!
- Actuellement: Tous les panneaux partagent le même alpha (basé sur corde globale)

## Correction proposée

L'angle d'attaque DOIT être calculé entre la **normale du panneau** et le **vent local**:

```typescript
// CORRECT: alpha entre normal et vent
const panelNormal = sample.normal.clone();
const dotProduct = panelNormal.dot(localWindDir);
const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;
```

Cela assure:
1. Chaque panneau a son angle d'attaque réel
2. Angle cohérent avec la normale utilisée pour la force
3. Physiquement correct pour un cerf-volant

## Impact de la correction

- **Forces aérodynamiques plus réalistes** 
- **Comportement du kite changera** (peut devenir plus stable ou moins)
- Nécessite test après correction

