# 🔧 BUGFIX : Système de Bridage - Application des Forces PBD

**Date** : 17 octobre 2025  
**Branche** : `clean-code-refactor-autonomous`  
**Fichier corrigé** : `src/ecs/systems/ConstraintSolver.ts`

---

## 🔴 Problème Identifié

Le cerf-volant ne volait pas correctement et présentait un comportement instable :

### Symptômes observés
- **Attitude erratique** : Oscillations violentes (Pitch: -97° → 163° → -89°, Roll jusqu'à -94°)
- **Contraintes violées** : Distance CTRL-Handle dépassant massivement la limite (15.1m → 20.1m au lieu de 15.0m)
- **Tensions irréalistes** : Forces de bridage atteignant 400N+ sur un kite de 60g
- **Chute incontrôlée** : Le kite tombait en tournant au lieu de voler sur sa fenêtre de vol
- **Lignes tendues en permanence** : Les deux lignes à leur longueur maximale constamment

### Logs révélateurs
```
🐛 [ConstraintSolver] CTRL line constraint enforced: 20.107m -> 15.000m
🐛 [KitePhysicsSystem] Kite State | Pos: [0.0, 8.3, -19.0] | Vel: 0.5 m/s | Att: [P:31°, R:-78°, Y:-21°]
🐛 [PureBridleSystem] Bridle conservation: Σ(T_brides)=403.4N (left: nez=67.6, inter=72.0, centre=68.3)
```

---

## 🔍 Diagnostic

### Architecture PBD (Position-Based Dynamics)

Le système de bridage utilise une architecture en 3 étapes :

1. **Trilatération géométrique** : Calcul de la position des CTRL par résolution des 4 contraintes sphériques
   - 1 contrainte de ligne : `|CTRL - HANDLE| ≤ 15m`
   - 3 contraintes de brides : `|CTRL - KITE_POINT| = 0.65m`

2. **Application des forces PBD** : Translation des contraintes géométriques en forces physiques sur le kite

3. **Collision sol** : Gestion des collisions avec le terrain

### Bug Critical

Dans `ConstraintSolver.solveConstraintsGlobal()`, **l'étape 2 (application des forces) n'était JAMAIS exécutée** !

```typescript
// ❌ CODE BUGUÉ (avant correction)
static solveConstraintsGlobal(...) {
  this.solveFreePointConstraints(ctrlLeftEntity, ...);  // ✅ Étape 1
  this.solveFreePointConstraints(ctrlRightEntity, ...); // ✅ Étape 1
  this.handleGroundCollision(...);                      // ✅ Étape 3
  // ❌ ÉTAPE 2 MANQUANTE : enforceBridleConstraints() jamais appelé !
}
```

**Conséquence** : Les CTRL étaient positionnés correctement par géométrie pure, mais le kite ne ressentait AUCUNE force de tension des brides. C'est comme calculer où les fils devraient être sans tirer dessus !

---

## ✅ Correction Appliquée

Ajout de l'appel manquant à `enforceBridleConstraints()` dans la méthode `solveConstraintsGlobal()` :

```typescript
// ✅ CODE CORRIGÉ
static solveConstraintsGlobal(
  kiteEntity: Entity,
  ctrlLeftEntity: Entity,
  ctrlRightEntity: Entity,
  handles: HandlePositions,
  bridleLengths: BridleLengths,
  newKitePosition: THREE.Vector3,
  kiteState: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
  leftLineEntity?: Entity | null,
  rightLineEntity?: Entity | null
): void {
  // ÉTAPE 1 : Positionner CTRL par trilatération (géométrie pure)
  this.solveFreePointConstraints(ctrlLeftEntity, handles.left, ...);
  this.solveFreePointConstraints(ctrlRightEntity, handles.right, ...);

  // ÉTAPE 2 : ✅ FIX CRITIQUE - Appliquer forces PBD sur kite depuis CTRL
  this.enforceBridleConstraints(
    kiteEntity,
    ctrlLeftEntity,
    ctrlRightEntity,
    newKitePosition,
    kiteState,
    bridleLengths
  );

  // ÉTAPE 3 : Collision sol
  this.handleGroundCollision(kiteEntity, newKitePosition, kiteState.velocity);
}
```

### Principe physique restauré

Avec cette correction, l'architecture PBD complète est respectée :

1. **Géométrie** : Les CTRL trouvent leur position d'équilibre par trilatération 3D contrainte
2. **Physique** : Le kite reçoit les forces de rappel PBD depuis les CTRL via les 6 brides
3. **Stabilité** : Les itérations successives (boucle PBD dans `KiteController`) convergent vers un équilibre stable

---

## 🎯 Résultat Attendu

Après cette correction, le cerf-volant devrait :

- ✅ **Voler sur sa fenêtre de vol** : Position stable sur la sphère définie par longueur lignes + brides
- ✅ **Attitude stable** : Orientation cohérente avec le vent apparent et les forces aérodynamiques
- ✅ **Tensions réalistes** : Forces de bridage proportionnelles au poids et à la traction
- ✅ **Contraintes respectées** : Distance CTRL-Handle maintenue à 15.0m ±1cm
- ✅ **Réponse aux commandes** : Réactivité correcte aux inputs pilote (gauche/droite)

---

## 📊 Tests de Validation

### Checklist de vérification

- [ ] Le kite atteint une position stable en quelques secondes
- [ ] Les contraintes de lignes sont respectées (distance ≤ 15.0m)
- [ ] L'attitude reste dans une plage réaliste (Pitch: 0-45°, Roll: ±15°)
- [ ] Les tensions de brides sont < 100N en vol normal
- [ ] Le kite répond aux inputs sans oscillations
- [ ] Pas de NaN/Infinity dans les logs
- [ ] Framerate stable (>55 FPS)

### Logs à surveiller

```bash
# Vérifier convergence des contraintes
grep "CTRL line constraint enforced" logs

# Vérifier stabilité de l'attitude
grep "Kite State" logs | tail -20

# Vérifier tensions réalistes
grep "Bridle conservation" logs | tail -10
```

---

## 🔄 Améliorations Futures

### Optimisations potentielles

1. **Nombre d'itérations PBD** : Ajuster `PhysicsConstants.CONSTRAINT_ITERATIONS` si convergence lente
2. **Stiffness des brides** : Calibrer `bridgeStiffness` dans `BridleSystem.calculateBridleTensions()` pour réalisme
3. **Damping** : Ajouter amortissement sur corrections PBD pour éviter rebonds
4. **Point CENTRE partagé** : Évaluer si nécessaire de séparer en CENTRE_GAUCHE / CENTRE_DROIT

### Monitoring

- Activer logs DEBUG temporairement pour validation détaillée
- Utiliser `PBDDiagnostics` pour tracker convergence des contraintes
- Visualiser les forces de brides avec `ControlPointDebugRenderer`

---

## 📚 Références

- **Documentation physique** : `PHYSICS_MODEL.md` Section 8 (Contraintes PBD)
- **Architecture ECS** : `.github/copilot-instructions.md` (Flux de données ECS)
- **Constantes** : `src/ecs/config/PhysicsConstants.ts`

---

**Note** : Ce bugfix est CRITIQUE pour la stabilité du simulateur. Sans l'application des forces PBD, le système de bridage est purement géométrique et ne peut pas maintenir le kite en vol.
