# Vérification du mécanisme de contrôle - 2025-10-01

## Question de validation

**Les deux lignes ont des distances identiques, c'est la position des poignées qui se déplace dans l'espace.**

## Vérification du code

### 1. Configuration des lignes (longueurs identiques)

**Fichier** : `src/simulation/config/SimulationConfig.ts`

```typescript
lines: {
  defaultLength: 15.0,  // ✅ Longueur fixe pour les deux lignes
  // ...
}
```

**Verdict** : ✅ Les deux lignes ont la même longueur (15m)

---

### 2. Calcul des positions des poignées (déplacement dans l'espace)

**Fichier** : `src/simulation/controllers/ControlBarManager.ts`

#### Étape 2.1 : Définition des positions locales
```typescript
const halfWidth = CONFIG.controlBar.width / 2;  // 0.5m
const handleLeftLocal = new THREE.Vector3(-halfWidth, 0, 0);   // (-0.5, 0, 0)
const handleRightLocal = new THREE.Vector3(halfWidth, 0, 0);   // (+0.5, 0, 0)
```

#### Étape 2.2 : Rotation des positions locales
```typescript
const rotationQuaternion = this.computeRotationQuaternion(toKiteVector);
handleLeftLocal.applyQuaternion(rotationQuaternion);   // ✅ Rotation appliquée
handleRightLocal.applyQuaternion(rotationQuaternion);  // ✅ Rotation appliquée
```

Quand `this.rotation = +30°`, les vecteurs locaux sont tournés de 30° autour de l'axe perpendiculaire au plan barre-kite.

#### Étape 2.3 : Translation vers position pilote
```typescript
return {
  left: handleLeftLocal.clone().add(this.position),   // ✅ Position 3D absolue
  right: handleRightLocal.clone().add(this.position),  // ✅ Position 3D absolue
};
```

**Verdict** : ✅ Les poignées se déplacent dans l'espace 3D selon la rotation de la barre

---

### 3. Application des contraintes (deux distances identiques)

**Fichier** : `src/simulation/physics/ConstraintSolver.ts`

```typescript
static enforceLineConstraints(
  kite: Kite,
  predictedPosition: THREE.Vector3,
  state: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
  handles: HandlePositions  // ✅ Reçoit les positions 3D des poignées
): void {
  const lineLength = kite.userData.lineLength || CONFIG.lines.defaultLength;  // ✅ Même longueur
  
  // Résolution pour ligne gauche
  const solveLine = (ctrlLocal: THREE.Vector3, handle: THREE.Vector3) => {
    const cpWorld = ctrlLocal.clone().applyQuaternion(q).add(predictedPosition);
    const diff = cpWorld.clone().sub(handle);  // ✅ Vecteur kite → poignée
    const dist = diff.length();                // ✅ Distance euclidienne 3D
    
    if (dist <= lineLength - tol) return;      // Ligne molle, pas de contrainte
    
    const C = dist - lineLength;               // ✅ Contrainte : distance - longueur
    // ... correction PBD ...
  };
  
  // Deux passes pour mieux satisfaire les contraintes
  for (let i = 0; i < 2; i++) {
    solveLine(ctrlLeft, handles.left);   // ✅ Contrainte ligne gauche
    solveLine(ctrlRight, handles.right); // ✅ Contrainte ligne droite
  }
}
```

**Verdict** : ✅ Deux contraintes avec la même longueur (15m), mais des positions de poignées différentes

---

### 4. Flux complet (intégration)

```
1. InputHandler : User presse flèche gauche
   ↓
2. SimulationApp : targetBarRotation = -0.5
   ↓
3. PhysicsEngine.update(deltaTime, targetBarRotation)
   ↓
4. ControlBarManager.setRotation(-0.5)  // ✅ Rotation de la barre
   ↓
5. ControlBarManager.getHandlePositions(kitePosition)
   │  → handleLeft = rotate(-0.5m, 0, 0) + pilotPos   // ✅ Déplacement dans l'espace
   │  → handleRight = rotate(+0.5m, 0, 0) + pilotPos  // ✅ Déplacement dans l'espace
   ↓
6. KiteController.update(forces, torque, handles)
   ↓
7. ConstraintSolver.enforceLineConstraints(kite, newPos, state, handles)
   │  → Contrainte 1 : ||kite.CTRL_GAUCHE - handles.left|| ≤ 15m   // ✅ Longueur fixe
   │  → Contrainte 2 : ||kite.CTRL_DROIT - handles.right|| ≤ 15m   // ✅ Longueur fixe
   ↓
8. Résultat : Le kite pivote pour satisfaire les deux contraintes simultanément
```

---

## Validation géométrique

### Cas 1 : Barre neutre (rotation = 0)

```
Pilote en (0, 0, 0), kite en (0, 10, 15)

handleLeft  = (-0.5, 0, 0) + (0, 0, 0) = (-0.5, 0, 0)
handleRight = (+0.5, 0, 0) + (0, 0, 0) = (+0.5, 0, 0)

Distance gauche = ||kite.ctrlGauche - handleLeft||
Distance droite = ||kite.ctrlDroit - handleRight||

→ Distances symétriques → Kite droit
```

### Cas 2 : Barre tournée à gauche (rotation = -30°)

```
Pilote en (0, 0, 0), kite en (0, 10, 15)

Rotation de -30° autour de l'axe Y (par exemple) :
handleLeft  = rotate(-30°, (-0.5, 0, 0)) + (0, 0, 0) ≈ (-0.43, 0, 0.25)
handleRight = rotate(-30°, (+0.5, 0, 0)) + (0, 0, 0) ≈ (+0.43, 0, -0.25)

Distance gauche = ||kite.ctrlGauche - (-0.43, 0, 0.25)||  // Poignée déplacée vers l'avant
Distance droite = ||kite.ctrlDroit - (+0.43, 0, -0.25)||  // Poignée déplacée vers l'arrière

→ Distances asymétriques → Contraintes différentes → Kite pivote à gauche
```

**Point clé** : Les longueurs de ligne (15m) restent identiques, mais les **cibles géométriques** changent.

---

## Conclusion

### ✅ Le code implémente EXACTEMENT la logique correcte

1. **Longueurs de lignes** : Identiques (15m pour les deux)
2. **Rotation de la barre** : Déplace les poignées dans l'espace 3D
3. **Contraintes** : Deux contraintes indépendantes avec la même longueur mais des cibles différentes
4. **Résultat** : Le kite trouve la position/orientation qui satisfait les deux contraintes → Rotation émergente

### Points validés

| Aspect | Implémentation | Statut |
|--------|----------------|--------|
| Longueurs identiques | `lineLength` constante (15m) | ✅ |
| Poignées déplacées | `applyQuaternion()` + `add(position)` | ✅ |
| Positions 3D absolues | `Vector3` dans l'espace monde | ✅ |
| Deux contraintes indépendantes | `solveLine()` appelée 2× | ✅ |
| Rotation émergente | Pas de couple appliqué directement | ✅ |

### Différence avec modèle incorrect

| Modèle incorrect (ancien) | Modèle correct (actuel) |
|---------------------------|-------------------------|
| Forces élastiques appliquées | Contraintes géométriques |
| Couple calculé directement | Rotation émerge de la géométrie |
| "Lignes de longueurs différentes" | Poignées à positions différentes |

---

**Date** : 2025-10-01  
**Validation** : Code conforme à la physique réelle  
**Branche** : feature/line-physics-refactor
