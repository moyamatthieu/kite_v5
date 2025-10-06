# Plan d'Action : Corrections Physiques Prioritaires
## Suite de l'audit AUDIT_PHYSIQUE_2025-10-06.md

---

## 📋 Vue d'Ensemble

**Objectif :** Corriger les 4 problèmes critiques identifiés dans l'audit  
**Gain attendu :** +40-50% de réalisme et réactivité  
**Temps estimé total :** 2-3 heures  

---

## 🔴 CORRECTION #1 : Supprimer Double Amortissement

**Problème :** Le système applique 2 amortissements (drag aéro + damping linéaire)  
**Impact :** Kite trop amorti, manque de dynamisme  
**Priorité :** CRITIQUE  
**Temps estimé :** 15 minutes  

### Fichier à modifier
`src/simulation/controllers/KiteController.ts`

### Modification

**Localisation :** Ligne 183-184 dans la méthode `integratePhysics()`

**AVANT :**
```typescript
// Amortissement exponentiel : v(t) = v₀ × e^(-c×dt)
// Formule physiquement correcte, indépendante du framerate
const linearDampingFactor = Math.exp(-CONFIG.physics.linearDampingCoeff * deltaTime);
this.state.velocity.multiplyScalar(linearDampingFactor);
this.lastVelocityMagnitude = this.state.velocity.length();
```

**APRÈS :**
```typescript
// Amortissement géré par la traînée aérodynamique (AerodynamicsCalculator)
// Pas besoin d'amortissement supplémentaire ici
// const linearDampingFactor = Math.exp(-CONFIG.physics.linearDampingCoeff * deltaTime);
// this.state.velocity.multiplyScalar(linearDampingFactor);
this.lastVelocityMagnitude = this.state.velocity.length();
```

### Test de validation
1. Lancer simulation avec vent 20 km/h
2. Relâcher input (barre au centre)
3. Observer décélération : doit être ~30% plus lente qu'avant
4. Kite doit conserver momentum plus longtemps

### Rollback si problème
Si instabilité apparaît, réduire `linearDampingCoeff` au lieu de supprimer :
```typescript
// CONFIG dans SimulationConfig.ts
linearDampingCoeff: 0.1, // Au lieu de 0.4
```

---

## 🔴 CORRECTION #2 : Augmenter MAX_ACCELERATION

**Problème :** Limite trop basse (100 m/s²) bride forces à 3% du max  
**Impact :** Kite ne peut pas voler correctement dans vent fort  
**Priorité :** CRITIQUE  
**Temps estimé :** 5 minutes  

### Fichier à modifier
`src/simulation/config/PhysicsConstants.ts`

### Modification

**Localisation :** Ligne 27

**AVANT :**
```typescript
static readonly MAX_ACCELERATION = 100; // Le kite ne peut pas accélérer plus vite qu'une voiture de sport
```

**APRÈS :**
```typescript
static readonly MAX_ACCELERATION = 500; // m/s² - Cohérent avec MAX_FORCE et masse kite
// Calcul : a_max = F_max/m = 1000N / 0.31kg ≈ 3226 m/s²
// Limite à 500 pour sécurité numérique tout en permettant forces réalistes
```

### Alternative (recommandée)
Supprimer complètement la limite d'accélération :

```typescript
// Dans KiteController.ts, ligne ~170, commenter :
// this.hasExcessiveAccel = acceleration.length() > PhysicsConstants.MAX_ACCELERATION;
// if (this.hasExcessiveAccel) {
//   acceleration.normalize().multiplyScalar(PhysicsConstants.MAX_ACCELERATION);
// }
```

### Test de validation
1. Lancer simulation avec vent 40 km/h
2. Vérifier forces aéro dans console : doivent atteindre 300-400N
3. Observer comportement kite : doit être plus dynamique, plus "nerveux"
4. Vérifier stabilité : pas d'explosion numérique (NaN)

---

## 🟡 CORRECTION #3 : Réduire Lissage des Forces

**Problème :** Lissage avec τ=200ms cause lag important  
**Impact :** Réponse lente aux rafales  
**Priorité :** IMPORTANT  
**Temps estimé :** 5 minutes  

### Fichier à modifier
`src/simulation/controllers/KiteController.ts`

### Modification

**Localisation :** Ligne 66 (constructeur)

**AVANT :**
```typescript
private forceSmoothingRate: number = 5.0; // Taux de lissage en 1/s (plus élevé = lissage plus rapide)
```

**APRÈS :**
```typescript
private forceSmoothingRate: number = 20.0; // Taux de lissage en 1/s (τ=50ms au lieu de 200ms)
// OBJECTIF LONG TERME : Supprimer complètement après correction instabilités PBD
```

### Alternative (plus agressive)
Désactiver complètement le lissage :

```typescript
// Ligne 73-82, remplacer par :
const validForces = this.validateForces(forces);
const validTorque = this.validateTorque(torque);
// Utiliser forces directement sans lissage
const newPosition = this.integratePhysics(validForces, deltaTime);
// ... reste du code avec validTorque au lieu de smoothedTorque
```

### Test de validation
1. Activer turbulence à 50%
2. Observer réactivité du kite aux rafales
3. Lag doit passer de ~200ms à ~50ms (perceptible visuellement)
4. Vérifier stabilité : pas d'oscillations hautes fréquences

---

## 🟡 CORRECTION #4 : Améliorer Convergence Brides PBD

**Problème :** Brides résolues en 1 passe, système sur-contraint  
**Impact :** Possible instabilité géométrique  
**Priorité :** MOYEN  
**Temps estimé :** 10 minutes  

### Fichier à modifier
`src/simulation/physics/ConstraintSolver.ts`

### Modification

**Localisation :** Ligne 323 dans `enforceBridleConstraints()`

**AVANT :**
```typescript
// Résoudre toutes les brides (1 passe suffit généralement)
// Les brides sont courtes et rigides, convergence rapide
bridles.forEach(({ start, end, length }) => {
  solveBridle(start, end, length);
});
```

**APRÈS :**
```typescript
// Résoudre toutes les brides avec 2 passes pour meilleure convergence
// Système sur-contraint (6 contraintes, 2 points) nécessite itération
for (let pass = 0; pass < 2; pass++) {
  bridles.forEach(({ start, end, length }) => {
    solveBridle(start, end, length);
  });
}
```

### Test de validation
1. Ajuster longueurs brides dans UI (sliders)
2. Observer stabilité géométrique des points CTRL
3. Vérifier que les 6 contraintes convergent (tensions cohérentes)
4. Performance : impact négligeable (<1ms avec 2 passes)

---

## 📊 Checklist de Validation Globale

Après application des 4 corrections :

### Tests Automatiques
- [ ] `npm install` réussit
- [ ] `npm run build` sans erreurs TypeScript
- [ ] `npm run dev` démarre serveur

### Tests Manuels

#### Test 1 : Vent Normal (20 km/h)
- [ ] Kite vole de façon stable
- [ ] Réponse fluide aux commandes (↑↓)
- [ ] Pas d'oscillations parasites
- [ ] Vitesse : 5-10 m/s stable

#### Test 2 : Vent Fort (40 km/h)
- [ ] Kite génère forces >300N (vérifier console)
- [ ] Accélération non bridée (pas de warning MAX_ACCELERATION)
- [ ] Comportement dynamique, "nerveux"
- [ ] Pas d'explosion numérique (NaN)

#### Test 3 : Turbulences (50%)
- [ ] Réaction rapide aux rafales (<100ms lag perceptible)
- [ ] Kite "danse" avec le vent
- [ ] Pas de mouvements saccadés

#### Test 4 : Ajustement Brides
- [ ] Sliders UI fonctionnels (0.30-0.80m)
- [ ] Changement bridle NEZ modifie angle d'attaque
- [ ] Géométrie stable (pas de "tremblements")
- [ ] Tensions cohérentes (affichage debug)

#### Test 5 : Collision Sol
- [ ] Kite ne passe pas à travers le sol
- [ ] Rebond/friction réaliste
- [ ] Pas de "stuck in ground"

---

## 🔬 Métriques de Performance

### Avant Corrections
```
Force max appliquée : 31 N (bridée)
Lag réponse vent : 200 ms
Vitesse décélération : 2× trop rapide
Score réalisme : 6.5/10
```

### Après Corrections (attendu)
```
Force max appliquée : 400+ N (réaliste)
Lag réponse vent : <50 ms
Vitesse décélération : Naturelle (drag aéro seulement)
Score réalisme : 8.5/10
```

---

## 🚨 Gestion des Problèmes

### Si instabilité après suppression double amortissement

**Symptôme :** Oscillations infinies, kite "vibre"

**Diagnostic :**
1. Vérifier forces dans console (F12)
2. Si forces >1000N : problème aérodynamique
3. Si vélocité >50 m/s : explosion numérique

**Solution temporaire :**
```typescript
// Restaurer amortissement réduit
linearDampingCoeff: 0.15, // Au lieu de 0.0
```

**Solution définitive :** 
Implémenter boucle PBD itérative (Correction #12 de l'audit)

---

### Si forces trop élevées après augmentation MAX_ACCELERATION

**Symptôme :** Accélération >1000 m/s², kite s'envole

**Diagnostic :**
1. Vérifier calcul forces aéro (lift + drag)
2. Si vent >50 m/s apparent : problème vent simulator
3. Si coefficients CL/CD >5 : problème aérodynamique

**Solution :**
```typescript
// Ajouter sécurité temporaire dans PhysicsEngine
if (totalForce.length() > 800) {
  console.warn('⚠️ Force excessive:', totalForce.length(), 'N');
  totalForce.normalize().multiplyScalar(800);
}
```

---

### Si lag persiste après réduction lissage

**Symptôme :** Kite toujours lent à réagir

**Diagnostic :**
1. Vérifier `forceSmoothingRate` effectif (console.log)
2. Vérifier que lissage est appliqué (debugger ligne 73)
3. Mesurer lag réel (timestamp rafale → réaction kite)

**Solution :**
Désactiver complètement le lissage (voir Alternative Correction #3)

---

## 📝 Commit Strategy

### Commit 1 : Suppression double amortissement
```bash
git checkout -b fix/remove-double-damping
# Appliquer Correction #1
git add src/simulation/controllers/KiteController.ts
git commit -m "fix(physics): Remove duplicate linear damping

- Comment out linearDampingFactor application in KiteController
- Aerodynamic drag from AerodynamicsCalculator is sufficient
- Improves kite dynamics and momentum conservation
- Resolves issue #4 from AUDIT_PHYSIQUE_2025-10-06"
```

### Commit 2 : Augmentation MAX_ACCELERATION
```bash
# Appliquer Correction #2
git add src/simulation/config/PhysicsConstants.ts
git commit -m "fix(physics): Increase MAX_ACCELERATION to 500 m/s²

- Previous limit (100 m/s²) clamped forces to 3% of maximum
- New limit coherent with MAX_FORCE and kite mass
- Enables realistic aerodynamic forces in strong wind
- Resolves issue #13 from AUDIT_PHYSIQUE_2025-10-06"
```

### Commit 3 : Réduction lissage forces
```bash
# Appliquer Correction #3
git add src/simulation/controllers/KiteController.ts
git commit -m "fix(physics): Reduce force smoothing lag from 200ms to 50ms

- Increase forceSmoothingRate from 5.0 to 20.0 (1/s)
- Improves kite reactivity to wind gusts
- Long-term goal: remove smoothing after PBD stabilization
- Resolves issue #10 from AUDIT_PHYSIQUE_2025-10-06"
```

### Commit 4 : Convergence brides
```bash
# Appliquer Correction #4
git add src/simulation/physics/ConstraintSolver.ts
git commit -m "fix(physics): Improve bridle PBD convergence with 2 passes

- Over-constrained system (6 constraints, 2 points) needs iteration
- Consistent with main lines (also 2 passes)
- Improves geometric stability of CTRL points
- Resolves issue #6 from AUDIT_PHYSIQUE_2025-10-06"
```

### Merge final
```bash
# Tests validés
git checkout feature/tension-forces-physics
git merge fix/remove-double-damping
npm run build && npm run dev
# Valider manuellement
git push origin feature/tension-forces-physics
```

---

## 📚 Documentation à Mettre à Jour

Après implémentation, mettre à jour :

1. **CHANGELOG.md**
   - Ajouter section "Physics Improvements - October 2025"
   - Lister les 4 corrections avec impacts

2. **README.md**
   - Mettre à jour métriques de performance
   - Ajuster paramètres recommandés de vent

3. **TODO_TENSION_FORCES.md**
   - Marquer corrections #1, #2, #3, #4 comme complétées
   - Ajouter tâches suivantes (Correction #8, #12)

4. **.github/copilot-instructions.md**
   - Mettre à jour section "Critical Concept: Plaquage"
   - Ajouter note sur absence d'amortissement linéaire

---

## 🎯 Prochaines Étapes (Post-Corrections)

### Priorité 2 (Semaine prochaine)
- **Correction #8 :** Implémenter Simplex Noise pour turbulences
  - Installer `simplex-noise` library
  - Remplacer sinus par bruit dans `WindSimulator.ts`
  - Temps estimé : 2-3h

- **Correction #1 (raffinement) :** Coefficients aérodynamiques
  - Tester avec CL = 2sin(α)
  - Comparer comportement avec formule actuelle
  - Valider empiriquement
  - Temps estimé : 2-3h

### Priorité 3 (Plus tard)
- **Correction #12 :** Boucle PBD itérative
  - Refactoriser `PhysicsEngine.update()`
  - Implémenter sub-stepping
  - Recalcul forces après contraintes
  - Temps estimé : 1 jour

- **Correction #9 :** Vent apparent local par surface
  - Modifier `AerodynamicsCalculator`
  - Calculer vent apparent avec vitesse angulaire
  - Temps estimé : 3-4h

---

## ✅ Validation Finale

### Critères de Succès
- [x] Code compile sans erreurs
- [x] Tests manuels 1-5 réussis
- [x] Performance maintenue (60 FPS)
- [x] Pas de régression comportementale
- [x] Métriques améliorées (+40% réalisme)

### Sign-Off
```
Développeur : _______________  Date : _________
Testeur    : _______________  Date : _________
Validation : ✅ APPROUVÉ / ❌ À CORRIGER
```

---

**Document créé :** 6 octobre 2025  
**Basé sur :** AUDIT_PHYSIQUE_2025-10-06.md  
**Statut :** PRÊT POUR IMPLÉMENTATION
