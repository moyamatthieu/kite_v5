# Fix des contraintes de lignes - 2025-01-XX

## Problème identifié

Les lignes du cerf-volant implémentaient un modèle physique **incorrect** :

- **Comportement observé** : Les lignes tiraient (pull) le kite vers le pilote comme des ressorts élastiques
- **Force appliquée** : `F = F₀ + k×Δx - c×v_radial` (force élastique avec pré-tension)
- **Résultat** : Le kite était attiré vers la barre de contrôle au lieu d'être simplement retenu

## Solution implémentée

Les lignes sont maintenant des **contraintes géométriques pures** :

- **Comportement correct** : Les lignes retiennent (retain) le kite à une distance maximale
- **Modèle physique** : Position-Based Dynamics (PBD) via `ConstraintSolver`
- **Résultat** : Le kite est poussé par le vent contre la limite de distance des lignes

## Changements de code

### 1. LineSystem.ts

**Avant** :
```typescript
return {
  leftForce: leftResult.force,   // Force élastique appliquée
  rightForce: rightResult.force, // Force élastique appliquée
  torque: totalTorque,
};
```

**Après** :
```typescript
// Calculer tensions pour info/debug uniquement (pas de force appliquée)
const leftResult = this.physics.calculateTensionForce(...);
const rightResult = this.physics.calculateTensionForce(...);

// ⚠️ IMPORTANT : PAS DE FORCES NI DE COUPLE APPLIQUÉS
// Les lignes sont des contraintes géométriques (ConstraintSolver)
// Le kite est retenu à distance max, pas tiré vers le pilote
return {
  leftForce: new THREE.Vector3(), // Force nulle
  rightForce: new THREE.Vector3(), // Force nulle
  torque: new THREE.Vector3(), // Couple nul
};
```

### 2. PhysicsEngine.ts

**Avant** :
```typescript
const totalForce = new THREE.Vector3()
  .add(lift)
  .add(drag)
  .add(gravity)
  .add(leftForce)  // ❌ Force élastique incorrecte
  .add(rightForce); // ❌ Force élastique incorrecte

const totalTorque = aeroTorque.clone().add(lineTorque); // ❌ Couple incorrect
```

**Après** :
```typescript
// CALCUL DES TENSIONS (pour affichage/debug uniquement)
this.lineSystem.calculateLineTensions(kite, newRotation, pilotPosition);

const totalForce = new THREE.Vector3()
  .add(lift)
  .add(drag)
  .add(gravity);
  // PAS de forces de lignes - elles sont des contraintes géométriques

const totalTorque = aeroTorque.clone();
// Les lignes n'appliquent PAS de couple - elles contraignent la position
```

### 3. KiteController.ts

**Inchangé** - Le contrôleur appelait déjà correctement `ConstraintSolver.enforceLineConstraints()` :

```typescript
// Appliquer les contraintes de lignes (Position-Based Dynamics)
ConstraintSolver.enforceLineConstraints(
  this.kite,
  newPosition,
  { velocity: this.state.velocity, angularVelocity: this.state.angularVelocity },
  handles
);
```

## Architecture finale

```
PhysicsEngine.update()
    │
    ├─> WindSimulator.getApparentWind()          // Calcule vent apparent
    ├─> AerodynamicsCalculator.calculateForces() // Calcule lift/drag/torque aéro
    ├─> LineSystem.calculateLineTensions()       // Calcule tensions (debug uniquement)
    │
    └─> KiteController.update(forces, torque)
            │
            ├─> integratePhysics()                    // F=ma, prédiction position
            ├─> ConstraintSolver.enforceLineConstraints() // ✅ Applique contrainte distance
            ├─> ConstraintSolver.handleGroundCollision()  // Collision sol
            └─> Applique position/orientation finale
```

## Modèle physique correct

### Contrainte de distance (PBD)

Le `ConstraintSolver` implémente l'algorithme **Position-Based Dynamics** :

1. **Contrainte** : `C = ||P_kite - P_pilote|| - L_max ≤ 0`
   - Si `C ≤ 0` : ligne molle, pas de contrainte
   - Si `C > 0` : ligne tendue, corriger la position

2. **Correction de position** :
   ```
   n = (P_kite - P_pilote) / dist    // Direction ligne
   λ = C / (1/m + r²/I)              // Facteur de correction (masse + inertie)
   ΔP = -λ × n / m                   // Correction translation
   Δθ = -λ × (r × n) / I             // Correction rotation
   ```

3. **Correction de vitesse** :
   - Si vitesse radiale `v_r > 0` (kite s'éloigne), annuler composante radiale
   - Conserve vitesse tangentielle (permet rotation autour du pilote)

### Différence avec modèle élastique

| Aspect | Modèle élastique (incorrect) | Contrainte PBD (correct) |
|--------|------------------------------|-------------------------|
| **Nature** | Force continue | Correction géométrique |
| **Application** | Toujours (même ligne molle) | Uniquement si ligne tendue |
| **Effet** | Attire kite vers pilote | Empêche distance > L_max |
| **Réalisme** | Ligne = ressort | Ligne = corde inextensible |

## Tests de validation

### Comportement attendu

1. **Ligne molle** (distance < longueur) :
   - Aucune force ni correction
   - Kite bouge librement

2. **Ligne tendue** (distance ≥ longueur) :
   - Position corrigée pour respecter `distance ≤ longueur`
   - Vitesse radiale annulée (kite ne s'éloigne pas)
   - Vitesse tangentielle conservée (rotation libre)

3. **Contrôle par rotation de la barre** :
   - Barre tournée → **Les poignées se déplacent dans l'espace 3D**
   - Les deux lignes gardent leur longueur identique (ex: 15m chacune)
   - Contraintes simultanées : `distance(kite, poignée_gauche) ≤ 15m` ET `distance(kite, poignée_droite) ≤ 15m`
   - Le kite doit satisfaire les deux contraintes → **Rotation émerge de la géométrie**
   - Pas de "ligne plus courte", seulement des positions de poignées différentes

## Références

- **ConstraintSolver.ts** : Implémentation PBD complète
- **LINE_PHYSICS_REFACTOR_ANALYSIS.md** : Analyse architecture
- **OOP_LINE_ARCHITECTURE.md** : Documentation OOP (Line, LinePhysics, LineFactory)

## Notes techniques

- Les tensions calculées par `LinePhysics` sont conservées pour **affichage/debug** uniquement
- La méthode `calculateTensionForce()` pourrait être renommée `calculateTensionInfo()` pour clarifier
- Le modèle PBD est plus stable numériquement que les forces élastiques
- Les lignes ne contribuent plus au couple - le contrôle émerge de la contrainte asymétrique

---

**Date** : 2025-01-XX  
**Auteur** : GitHub Copilot  
**Branche** : feature/line-physics-refactor  
**Issue** : Fix #N/A - Lignes tiraient kite au lieu de le retenir
