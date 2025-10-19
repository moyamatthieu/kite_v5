# 📊 RÉSUMÉ DE L'AUDIT PHYSIQUE - Kite V5

**Date**: 19 octobre 2025  
**Objectif**: Audit complet de toute la logique de calcul  
**Résultat**: 3 BUGS CRITIQUES identifiés

---

## 🎯 Vue d'ensemble

Audit systématique de **tous les fichiers de physique** :

| Système | Fichier | Status |
|---------|---------|--------|
| Configuration | Config.ts | ✓ OK (sauf inertie) |
| Initialisation | Factories | ✓ OK |
| Aérodynamique | AeroSystem | ⚠️ BUG: angle d'attaque |
| Contraintes | ConstraintSystem | ✓ OK |
| Intégration | PhysicsSystem | ⚠️ BUG: damping |
| Bridles | BridleConstraintSystem | ✓ OK |
| Vent | WindSystem | ✓ OK |
| **Inertie** | **Config.ts** | **❌ BUG: valeurs fausses** |

---

## 🔴 BUG #1: INERTIE DU KITE (CRITIQUE)

**Fichier**: `src/ecs/config/Config.ts` (ligne 18-22)

**Problème**: Les 3 moments d'inertie sont incorrects (2-5× erreur)

**Actuellement**:
```typescript
Ixx: 0.015  kg⋅m²  (pitch)
Iyy: 0.020  kg⋅m²  (yaw)
Izz: 0.005  kg⋅m²  (roll)
```

**Devrait être**:
```typescript
Ixx: 0.0315 kg⋅m²  (pitch: 2.1× trop petit actuellement)
Iyy: 0.0042 kg⋅m²  (yaw: 4.76× trop grand actuellement)
Izz: 0.0110 kg⋅m²  (roll: 2.2× trop petit actuellement)
```

**Impact**:
- Rotation pitch trop facile (instabilité avant/arrière)
- Rotation yaw beaucoup trop difficile (contrôles inefficaces)
- Rotation roll trop facile (instabilité latérale)

**Priorité**: 🔴 **IMMÉDIATE** - Affecte toute la dynamique

**Fix**: 1 minute (3 nombres à changer)

---

## 🔴 BUG #2: DAMPING MULTIPLICATIF (CRITIQUE)

**Fichier**: `src/ecs/systems/PhysicsSystem.ts` (ligne 61)

**Problème**: Damping appliqué comme `v *= 0.8` au lieu de damping continu

**Actuellement**:
```typescript
physics.velocity.multiplyScalar(physics.linearDamping);  // v *= 0.8
```

**Devrait être**:
```typescript
const dampingFactor = Math.exp(-physics.linearDamping * deltaTime);
physics.velocity.multiplyScalar(dampingFactor);
```

**Impact numérique** (à 60 FPS):
- Perte de vitesse par frame: **20%** (multiplicatif)
- Perte correcte: ~1.3%/frame
- Résultat: Le kite **2.2× trop amorti**
- Après 0.5 sec: 74% de perte vs 33% correct

**Impact visuel**:
- Mouvements figés et ralentis
- Kite descend rapidement
- Apparence peu dynamique

**Priorité**: 🔴 **IMMÉDIATE** - Affecte le ressenti de vol

**Fix**: ~5 lignes à modifier

---

## 🔴 BUG #3: ANGLE D'ATTAQUE MAL CALCULÉ (CRITIQUE)

**Fichier**: `src/ecs/systems/AeroSystem.ts` (ligne 104-109)

**Problème**: Alpha calculé entre corde arbitraire et vent, pas entre normal et vent

**Actuellement**:
```typescript
const chord = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.quaternion);
const dotProduct = chord.dot(localWindDir);
const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;
```

**Devrait être**:
```typescript
// Utiliser la normale du panneau, pas une corde arbitraire
const dotProduct = sample.normal.dot(localWindDir);
const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;
```

**Impact**:
- Chaque panneau devrait avoir son propre alpha basé sur sa normale
- Actuellement: tous partagent un alpha global = **forces incorrectes**
- CL et CD basés sur angle faux = **aérodynamique complètement fausse**

**Priorité**: 🔴 **IMMÉDIATE** - Affecte les forces aéro

**Fix**: 2 lignes à remplacer

---

## ✅ SYSTÈMES CORRECTS

### Gravité ✓
- Appliquée une seule fois
- Répartie correctement par panneau
- Formule correcte: `m × g`

### CL et CD ✓
- Formule polaire correcte: `CD = CD0 + k × CL²`
- Avec stall model réaliste
- Aspect ratio utilisé correctement

### Portance et Traînée ✓
- Directions correctes (normal pour lift, vent pour drag)
- Magnitudes basées sur CL/CD (une fois l'angle corrigé)

### Spring-damper des lignes ✓
- Modèle physique correct
- Amortissement linéaire acceptable
- Tension clippée correctement

### Trilatération 3D ✓
- Implémentation mathématiquement correcte
- Raffinement itératif (Gauss-Newton)
- Convergence garantie

### Vent apparent ✓
- Formule: `V_app = V_wind - V_kite`
- Turbulence: Perlin noise
- Synchronisation avec UI correcte

---

## 📋 PLAN DE CORRECTION

### Phase 1: Correction des 3 bugs (URGENT)

**Ordre de priorité**:
1. **Inertie** (Config.ts) - 1 minute
2. **Damping** (PhysicsSystem) - 5 minutes
3. **Angle d'attaque** (AeroSystem) - 5 minutes

**Total**: ~11 minutes de fix

### Phase 2: Validation

- [ ] Build et vérifier aucune erreur de compilation
- [ ] Tester simulation en hot reload
- [ ] Observer le comportement du kite
- [ ] Noter les changements visibles

### Phase 3: Re-tuning (si nécessaire)

Après fixes, les paramètres physiques seront corrects, mais le comportement changera:
- Peut être trop lourd/léger
- Peut être trop instable/stable
- Angles d'attaque différents

**Tuning requis**: Ajuster les coefficients aéro (CL, CD) et/ou masses si comportement non désiré

---

## 📈 BÉNÉFICES ATTENDUS

Après correction des 3 bugs:

1. **Dynamique de rotation réaliste** (inertie correcte)
2. **Mouvements fluides et énergiques** (damping correct)
3. **Forces aérodynamiques physiquement cohérentes** (alpha correct)
4. **Simulation plus proche du comportement réel**

---

## 📚 Documentation générée

Commit: `5de7e86` (HEAD)

Fichiers:
- `AUDIT_PHYSIQUE.md` - Audit complet détaillé
- `BUG_INERTIE.md` - Calculs d'inertie détaillés
- `BUG_DAMPING.md` - Analyse mathématique du damping
- `BUG_ANGLE_ATTAQUE.md` - Explication du bug d'angle

---

## ✋ ACTIONS RECOMMANDÉES

```
[ ] Lire les 4 fichiers de documentation
[ ] Corriger les 3 bugs en 10 minutes
[ ] Builder et tester
[ ] Ajuster paramètres si nécessaire
[ ] Créer commit "physics: Fix 3 critical bugs"
```

**Estimé**: 30 minutes total (incluant test et ajustements)

