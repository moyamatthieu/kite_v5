# Audit Complet des Facteurs de Damping Artificiels

**Date**: 1er octobre 2025
**Branche**: `feature/damping-improvements`
**Objectif**: Identifier et documenter tous les facteurs d'amortissement artificiels dans le code pour préparer leur suppression ou remplacement par des modèles physiques réalistes.

---

## 🎯 Résumé Exécutif

Le code contient **5 facteurs de damping**, dont **2 sont purement artificiels** et nuisent à la physique émergente. L'audit révèle un **double amortissement** (linéaire et angulaire) qui rend le comportement du kite "mollasson" et supprime la réactivité naturelle.

### Impact Global
- ❌ **8% de perte linéaire par frame** → comportement trop amorti
- ❌ **15% de perte angulaire par frame** → rotations trop lentes
- ⚠️ **Double comptage** avec les forces aérodynamiques
- ✅ **Physique émergente supprimée** par les multiplicateurs globaux

---

## 📊 Inventaire Détaillé des Dampings

### 1️⃣ **linearDamping: 0.92** ❌ ARTIFICIEL - PRIORITÉ HAUTE

**Définition**
📁 [SimulationConfig.ts:41](../src/simulation/config/SimulationConfig.ts#L41)
```typescript
linearDamping: 0.92, // Friction air réaliste (8% de perte par frame)
```

**Application**
📁 [KiteController.ts:176](../src/simulation/controllers/KiteController.ts#L176)
```typescript
// Amortissement : simule la résistance de l'air
this.state.velocity.multiplyScalar(CONFIG.physics.linearDamping);
```

**Analyse Physique**
- ❌ **Non physique**: La traînée doit être proportionnelle à v², pas un pourcentage fixe
- ❌ **Indépendant de**: vitesse réelle, surface exposée, orientation du kite, densité de l'air
- ❌ **Appliqué**: À chaque frame, quelle que soit la situation
- 📈 **Impact**: 8% de perte = 0.92^60 ≈ 1.2% restant après 1 seconde à 60 fps

**Conséquence**
- Le kite perd de la vitesse même sans raison physique
- Double comptage avec la traînée aérodynamique calculée dans `AerodynamicsCalculator`
- Comportement "mollasson" qui masque la physique réaliste

**Équivalent Physique Correct**
```typescript
// Force de traînée quadratique : F = 0.5 × ρ × v² × Cd × A
const speed = velocity.length();
const dragForceMagnitude = 0.5 * airDensity * speed * speed * dragCoeff * area;
const deceleration = dragForceMagnitude / mass;
velocity.sub(velocity.clone().normalize().multiplyScalar(deceleration * deltaTime));
```

**Recommandation**: **Supprimer** et laisser la traînée aérodynamique gérer l'amortissement

---

### 2️⃣ **angularDamping: 0.85** ❌ ARTIFICIEL - PRIORITÉ HAUTE

**Définition**
📁 [SimulationConfig.ts:40](../src/simulation/config/SimulationConfig.ts#L40)
```typescript
angularDamping: 0.85, // Amortissement angulaire équilibré
```

**Application**
📁 [KiteController.ts:232](../src/simulation/controllers/KiteController.ts#L232)
```typescript
this.state.angularVelocity.multiplyScalar(CONFIG.physics.angularDamping);
```

**Analyse Physique**
- ❌ **Non physique**: La résistance rotationnelle doit être proportionnelle à ω², pas un pourcentage
- ❌ **Indépendant de**: vitesse angulaire, forme du kite, surface exposée
- ❌ **Même amortissement**: Que le kite tourne vite ou lentement
- 📈 **Impact**: 15% de perte = 0.85^60 ≈ 0.04% restant après 1 seconde à 60 fps

**Conséquence**
- Rotations trop amorties, réponse lente aux couples
- Double comptage avec `angularDragCoeff`
- Le kite ne peut pas développer de rotations naturelles

**Équivalent Physique Correct**
```typescript
// Couple de traînée rotationnelle quadratique : τ = -k × ω × |ω|
const omega = angularVelocity.length();
const dragTorqueMagnitude = rotationalDragCoeff * omega * omega;
const dragTorque = angularVelocity.clone()
  .normalize()
  .multiplyScalar(-dragTorqueMagnitude);
const angularDeceleration = dragTorque.divideScalar(inertia);
angularVelocity.add(angularDeceleration.multiplyScalar(deltaTime));
```

**Recommandation**: **Supprimer** et laisser la traînée rotationnelle physique gérer l'amortissement

---

### 3️⃣ **angularDragCoeff: 0.1** ⚠️ SEMI-PHYSIQUE - PRIORITÉ MOYENNE

**Définition**
📁 [SimulationConfig.ts:42](../src/simulation/config/SimulationConfig.ts#L42)
```typescript
angularDragCoeff: 0.1, // Résistance rotation augmentée pour moins d'oscillations
```

**Application**
📁 [KiteController.ts:209-211](../src/simulation/controllers/KiteController.ts#L209-L211)
```typescript
// Couple d'amortissement (résistance à la rotation dans l'air)
const dampTorque = this.state.angularVelocity
  .clone()
  .multiplyScalar(-CONFIG.physics.angularDragCoeff);
const effectiveTorque = torque.clone().add(dampTorque);
```

**Analyse Physique**
- ✅ **Proportionnel à ω**: Meilleur que le damping global
- ⚠️ **Linéaire**: Devrait être proportionnel à ω × |ω| (quadratique)
- ❌ **Double comptage**: Appliqué EN PLUS de `angularDamping` (ligne 232)
- 💡 **Amélioration possible**: Rendre quadratique

**Conséquence**
- Tentative de modéliser la physique, mais incomplète
- Double amortissement avec `angularDamping`
- Valeur arbitraire non basée sur la géométrie réelle

**Amélioration Suggérée**
```typescript
// Rendre le couple quadratique (plus réaliste)
const omega = this.state.angularVelocity.length();
const dampTorque = this.state.angularVelocity
  .clone()
  .multiplyScalar(-CONFIG.physics.angularDragCoeff * omega);
```

**Recommandation**: **Améliorer** (rendre quadratique) puis **fusionner** avec le système aérodynamique

---

### 4️⃣ **liftScale: 1.5** ⚠️ COMPENSATOIRE - PRIORITÉ MOYENNE

**Définition**
📁 [SimulationConfig.ts:45](../src/simulation/config/SimulationConfig.ts#L45)
```typescript
liftScale: 1.5, // Portance augmentée pour meilleur vol
```

**Application**
📁 [AerodynamicsCalculator.ts:202](../src/simulation/physics/AerodynamicsCalculator.ts#L202)
```typescript
const lift = globalLift.multiplyScalar(CONFIG.aero.liftScale);
```

**Analyse Physique**
- ⚠️ **Compensatoire**: Masque des erreurs dans le calcul aérodynamique
- 💡 **Justifications possibles**:
  - Compense l'absence de courbure du profil (camber)
  - Compense l'absence de flex dynamique du tissu
  - Compense les effets 3D non modélisés
- ❌ **Problème**: Empêche de valider si la physique est correcte

**Conséquence**
- Impossible de savoir si le calcul de portance est correct
- Comportement de vol artificiellement amélioré
- Masque des bugs potentiels dans `AerodynamicsCalculator`

**Recommandation**: **Supprimer temporairement** pour valider le calcul aérodynamique, puis **réintégrer** via un modèle de profil réaliste si nécessaire

---

### 5️⃣ **GROUND_FRICTION: 0.85** ✅ ACCEPTABLE - PRIORITÉ BASSE

**Définition**
📁 [PhysicsConstants.ts:28](../src/simulation/config/PhysicsConstants.ts#L28)
```typescript
static readonly GROUND_FRICTION = 0.85; // Le sol freine le kite de 15% s'il le touche
```

**Application**
📁 [ConstraintSolver.ts:165-166](../src/simulation/physics/ConstraintSolver.ts)
```typescript
velocity.x *= PhysicsConstants.GROUND_FRICTION;
velocity.z *= PhysicsConstants.GROUND_FRICTION;
```

**Analyse Physique**
- ✅ **Acceptable**: Friction au sol est un phénomène réel
- ⚠️ **Simplification**: Devrait dépendre de la force normale et du coefficient de friction
- 💡 **Contextuellement correct**: Pour un cerf-volant touchant le sol, une friction "catastrophique" est acceptable
- 📝 **Impact limité**: N'affecte que Y=0 (contact sol)

**Modèle Physique Correct (si nécessaire)**
```typescript
// Friction de Coulomb : F_friction = μ × N
const normalForce = mass * gravity;
const frictionForce = frictionCoeff * normalForce;
const frictionDeceleration = frictionForce / mass;
velocity.sub(velocity.clone().normalize().multiplyScalar(frictionDeceleration * deltaTime));
```

**Recommandation**: **Conserver** tel quel (acceptable pour la simulation)

---

## 🔴 Problèmes Critiques Identifiés

### Problème #1: Double Amortissement Linéaire

Le code applique **deux fois** l'amortissement linéaire:

1. **`linearDamping` (artificiel)** - [KiteController.ts:176](../src/simulation/controllers/KiteController.ts#L176)
   ```typescript
   this.state.velocity.multiplyScalar(CONFIG.physics.linearDamping); // 8% de perte
   ```

2. **Traînée aérodynamique (physique)** - `AerodynamicsCalculator.ts`
   ```typescript
   const drag = windDir.clone().multiplyScalar(dragComponent);
   ```

**Conséquence**: Amortissement **excessif**, comportement trop "mou"

---

### Problème #2: Double Amortissement Angulaire

Le code applique **deux fois** l'amortissement angulaire:

1. **`angularDragCoeff` (couple proportionnel à ω)** - [KiteController.ts:209-211](../src/simulation/controllers/KiteController.ts#L209-L211)
   ```typescript
   const dampTorque = this.state.angularVelocity
     .clone()
     .multiplyScalar(-CONFIG.physics.angularDragCoeff);
   ```

2. **`angularDamping` (multiplicateur global)** - [KiteController.ts:232](../src/simulation/controllers/KiteController.ts#L232)
   ```typescript
   this.state.angularVelocity.multiplyScalar(CONFIG.physics.angularDamping); // 15% de perte
   ```

**Conséquence**: Rotations **trop amorties**, réponse lente

---

### Problème #3: Indépendance de la Physique Réelle

Les dampings globaux (`linearDamping` et `angularDamping`) sont appliqués **indépendamment** de:
- ❌ La vitesse actuelle (devrait être proportionnel à v²)
- ❌ L'orientation du kite (surface exposée variable)
- ❌ La densité de l'air (déjà dans `CONFIG.physics.airDensity` mais pas utilisée)
- ❌ La géométrie du kite (aire, masse, inertie)

**Conséquence**: Comportement **non physique**, physique émergente **supprimée**

---

## 📈 Tableau Récapitulatif

| Damping | Valeur | Fichier | Ligne | Type | Légitimité | Impact | Action |
|---------|--------|---------|-------|------|------------|--------|--------|
| **linearDamping** | 0.92 | SimulationConfig.ts | 41 | ❌ Artificiel | Très faible | **Fort** | **SUPPRIMER** |
| **angularDamping** | 0.85 | SimulationConfig.ts | 40 | ❌ Artificiel | Très faible | **Fort** | **SUPPRIMER** |
| **angularDragCoeff** | 0.1 | SimulationConfig.ts | 42 | ⚠️ Semi-physique | Moyenne | Modéré | **AMÉLIORER** |
| **liftScale** | 1.5 | SimulationConfig.ts | 45 | ⚠️ Compensatoire | Moyenne | Fort | **RÉÉVALUER** |
| **GROUND_FRICTION** | 0.85 | PhysicsConstants.ts | 28 | ✅ Acceptable | Bonne | Faible | **CONSERVER** |

---

## ✅ Plan d'Action Recommandé

### Phase 1: Suppression Progressive des Dampings Artificiels

**Objectif**: Éliminer les dampings globaux pour révéler la physique pure

#### Étape 1.1: Réduction Progressive (Test)
```typescript
// SimulationConfig.ts
physics: {
  linearDamping: 0.92 → 0.95 → 0.98 → 0.995 → 1.0   // Réduire progressivement
  angularDamping: 0.85 → 0.90 → 0.95 → 0.99 → 1.0    // Réduire progressivement
}
```

**Observations à chaque étape**:
- Stabilité de la simulation
- Réactivité du kite
- Oscillations éventuelles
- Comportement de vol global

#### Étape 1.2: Suppression Complète (Cible)
```typescript
// SimulationConfig.ts
physics: {
  linearDamping: 1.0,      // Désactivé (100% conservé)
  angularDamping: 1.0,     // Désactivé (100% conservé)
}
```

**Risques**:
- ⚠️ Peut révéler des instabilités numériques
- ⚠️ Peut nécessiter un solver de contraintes plus robuste
- ⚠️ Peut nécessiter un pas de temps plus petit

**Mitigation**:
- Fixer les instabilités **dans les solveurs physiques**, pas avec des dampings
- Améliorer `ConstraintSolver.ts` si nécessaire
- Réduire `deltaTimeMax` si nécessaire

---

### Phase 2: Amélioration du Damping Angulaire (Physique Réaliste)

**Objectif**: Remplacer le couple linéaire par un couple quadratique réaliste

#### Étape 2.1: Rendre `angularDragCoeff` Quadratique
```typescript
// KiteController.ts - updateOrientation()
// AVANT (linéaire):
const dampTorque = this.state.angularVelocity
  .clone()
  .multiplyScalar(-CONFIG.physics.angularDragCoeff);

// APRÈS (quadratique):
const omega = this.state.angularVelocity.length();
const dampTorque = this.state.angularVelocity
  .clone()
  .normalize()
  .multiplyScalar(-CONFIG.physics.angularDragCoeff * omega * omega);
```

#### Étape 2.2: Calibrer le Coefficient
```typescript
// SimulationConfig.ts
physics: {
  angularDragCoeff: 0.05,  // Réduit de 50% (car quadratique = effet plus fort)
}
```

---

### Phase 3: Réévaluation de `liftScale`

**Objectif**: Vérifier si la portance est correctement calculée sans facteur compensatoire

#### Étape 3.1: Supprimer Temporairement
```typescript
// SimulationConfig.ts
aero: {
  liftScale: 1.0,  // Désactiver le multiplicateur
}
```

#### Étape 3.2: Observer le Comportement
- Le kite vole-t-il correctement ?
- La portance semble-t-elle réaliste ?
- Y a-t-il des bugs dans `AerodynamicsCalculator` ?

#### Étape 3.3: Action Corrective
**Si le kite ne vole plus**:
- ✅ Corriger le calcul de portance dans `AerodynamicsCalculator`
- ✅ Vérifier les surfaces, coefficients aérodynamiques
- ✅ Implémenter un modèle de profil réaliste (camber)

**Si le kite vole correctement**:
- ✅ Conserver `liftScale = 1.0`
- ✅ Le calcul était sous-estimé, maintenant corrigé

---

### Phase 4: Implémentation de Modèles Physiques Avancés (Optionnel)

**Objectif**: Remplacer les simplifications par des modèles physiques complets

#### Modèle de Traînée Linéaire Réaliste
```typescript
// KiteController.ts - nouvelle méthode
private applyAerodynamicDrag(velocity: THREE.Vector3, deltaTime: number): void {
  const speed = velocity.length();
  if (speed < 0.01) return;

  // Force de traînée : F = 0.5 × ρ × v² × Cd × A
  const dragCoeff = 0.8; // Coefficient de traînée typique pour un kite
  const dragForceMagnitude =
    0.5 * CONFIG.physics.airDensity * speed * speed *
    dragCoeff * CONFIG.kite.area;

  // Décélération : a = F / m
  const deceleration = dragForceMagnitude / CONFIG.kite.mass;

  // Application dans la direction opposée au mouvement
  const dragVector = velocity.clone()
    .normalize()
    .multiplyScalar(-deceleration * deltaTime);

  velocity.add(dragVector);
}
```

#### Modèle de Traînée Rotationnelle Réaliste
```typescript
// KiteController.ts - nouvelle méthode
private applyRotationalDrag(
  angularVelocity: THREE.Vector3,
  deltaTime: number
): THREE.Vector3 {
  const omega = angularVelocity.length();
  if (omega < 0.01) return new THREE.Vector3();

  // Couple de traînée : τ = -k × ω² × ω_normalized
  const rotationalDragCoeff = 0.05; // À calibrer expérimentalement
  const dragTorqueMagnitude = rotationalDragCoeff * omega * omega;

  const dragTorque = angularVelocity.clone()
    .normalize()
    .multiplyScalar(-dragTorqueMagnitude);

  return dragTorque;
}
```

---

## 🧪 Protocole de Test

### Test #1: Mesurer l'Impact Actuel

```typescript
// KiteController.ts - integratePhysics()
console.log('Vitesse avant damping:', this.state.velocity.length().toFixed(3), 'm/s');
this.state.velocity.multiplyScalar(CONFIG.physics.linearDamping);
console.log('Vitesse après damping:', this.state.velocity.length().toFixed(3), 'm/s');
console.log('Perte:', ((1 - CONFIG.physics.linearDamping) * 100).toFixed(1), '%');
```

**Résultats attendus**:
- Perte constante de 8% par frame, quelle que soit la vitesse
- Révèle le comportement non physique

---

### Test #2: Comparaison Avant/Après

**Métriques à observer**:
1. **Temps de décélération**: Temps pour passer de 10 m/s à 1 m/s
2. **Réactivité**: Temps de réponse à un changement de contrôle
3. **Stabilité**: Oscillations, divergences, NaN
4. **Réalisme**: Comportement de vol général

**Configuration de test**:
```typescript
// Conditions identiques
wind: { speed: 18, direction: 0, turbulence: 3 }
kite: { position: (0, 5, -10) }
controls: { rotation: 0 }
```

**Tableau de comparaison**:
| Métrique | Avant (damping ON) | Après (damping OFF) | Commentaire |
|----------|-------------------|-------------------|-------------|
| Décélération | ? s | ? s | |
| Réactivité | ? ms | ? ms | |
| Stabilité | ✅/❌ | ✅/❌ | |
| Réalisme | 😐 | 😊 | |

---

### Test #3: Validation Physique

**Vérifier que la physique émergente fonctionne**:

1. **Test de chute libre**:
   - Désactiver toutes les forces sauf la gravité
   - Le kite doit tomber à 9.81 m/s² (gravité)
   - Vérifier: a = F/m = (m × g) / m = g ✅

2. **Test de portance**:
   - Vent de 18 km/h (5 m/s)
   - Kite à 45° d'incidence
   - Vérifier: Lift = 0.5 × ρ × v² × Cl × A ✅

3. **Test de conservation d'énergie**:
   - Dans le vide (sans vent, sans friction)
   - L'énergie totale doit rester constante: E = ½mv² + mgh ✅

---

## 📝 Conclusion

### État Actuel
- ❌ **2 dampings artificiels majeurs** (linearDamping, angularDamping)
- ⚠️ **2 dampings semi-physiques** (angularDragCoeff, liftScale)
- ✅ **1 damping acceptable** (groundFriction)
- 🔴 **Double amortissement** linéaire et angulaire

### Impact Global
Les dampings actuels **suppriment la physique émergente**:
- 8% de perte linéaire par frame = comportement "mollasson"
- 15% de perte angulaire par frame = rotations trop lentes
- Double comptage avec les forces aérodynamiques
- Impossibilité de valider si la physique est correcte

### Recommandation Forte
**Supprimer progressivement tous les dampings artificiels** (Phase 1) et laisser la physique pure s'exprimer. Le kite devrait trouver son équilibre naturellement grâce à:
- La gravité (déjà implémentée)
- Les forces aérodynamiques (lift + drag, déjà calculées)
- Les contraintes des lignes (ConstraintSolver)
- La masse et l'inertie réalistes (maintenant calculées correctement)

Si des instabilités apparaissent, les corriger **dans les solveurs physiques**, pas avec des dampings globaux.

---

## 📚 Fichiers Concernés

| Fichier | Rôle | Modifications Nécessaires |
|---------|------|--------------------------|
| [SimulationConfig.ts](../src/simulation/config/SimulationConfig.ts) | Configuration globale | Supprimer/réduire dampings artificiels |
| [KiteController.ts](../src/simulation/controllers/KiteController.ts) | Contrôleur du kite | Retirer applications de damping, implémenter modèles physiques |
| [PhysicsConstants.ts](../src/simulation/config/PhysicsConstants.ts) | Constantes physiques | Conserver GROUND_FRICTION |
| [AerodynamicsCalculator.ts](../src/simulation/physics/AerodynamicsCalculator.ts) | Calcul aérodynamique | Réévaluer liftScale, valider calculs |
| [ConstraintSolver.ts](../src/simulation/physics/ConstraintSolver.ts) | Contraintes physiques | Améliorer robustesse si instabilités |

---

**Auteur**: Claude Code
**Date**: 1er octobre 2025
**Branche**: `feature/damping-improvements`
**Prochaine étape**: Implémenter Phase 1 (réduction progressive des dampings)
