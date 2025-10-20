# 🔧 PLAN DE DÉBOGAGE - Trouver Où le Système Casse

**Objectif**: Identifier à quelle étape le mécanisme de contrôle échoue

---

## 🎯 DIAGNOSTIC PROGRESSIF

### ÉTAPE 1️⃣ : La Barre Rotatione-t-elle ?

**Point de contrôle**: `PilotSystem.updateBarRotation()`

```typescript
// Ajouter dans DebugSystem.update():

const controlBar = entityManager.getEntity('controlBar');
const barTransform = controlBar?.getComponent<TransformComponent>('transform');

if (barTransform) {
  const euler = new THREE.Euler().setFromQuaternion(barTransform.quaternion);
  console.log(`📊 [DIAG-1] Bar Rotation:`);
  console.log(`   angle (degrees): ${(euler.y * 180 / Math.PI).toFixed(2)}`);
  console.log(`   quaternion: (${barTransform.quaternion.x.toFixed(3)}, ${barTransform.quaternion.y.toFixed(3)}, ${barTransform.quaternion.z.toFixed(3)}, ${barTransform.quaternion.w.toFixed(3)})`);
}

// ATTENDU:
// - Quand vous pressez Q: angle devrait aller vers -30°
// - Quand vous pressez D: angle devrait aller vers +30°
// - Quand vous relâchez: angle devrait retourner à 0°

// ✓ PASSE: La barre rotatione
// ✗ ÉCHOUE: Vérifier InputSystem et PilotSystem
```

---

### ÉTAPE 2️⃣ : Les Points d'Attache Bougent-ils ?

**Point de contrôle**: Points d'attache de la barre

```typescript
// Ajouter dans DebugSystem.update():

const controlBar = entityManager.getEntity('controlBar');
const barGeometry = controlBar?.getComponent<GeometryComponent>('geometry');
const barTransform = controlBar?.getComponent<TransformComponent>('transform');

if (barGeometry && barTransform) {
  const leftAttach = barGeometry.getPointWorld('leftHandle', controlBar);
  const rightAttach = barGeometry.getPointWorld('rightHandle', controlBar);
  
  console.log(`📊 [DIAG-2] Bar Attachment Points:`);
  console.log(`   leftHandle (monde): (${leftAttach.x.toFixed(3)}, ${leftAttach.y.toFixed(3)}, ${leftAttach.z.toFixed(3)})`);
  console.log(`   rightHandle (monde): (${rightAttach.x.toFixed(3)}, ${rightAttach.y.toFixed(3)}, ${rightAttach.z.toFixed(3)})`);
  
  // Afficher la différence avec frame précédent
  if (!this.prevLeftAttach) {
    this.prevLeftAttach = leftAttach.clone();
    this.prevRightAttach = rightAttach.clone();
  } else {
    const deltaLeft = new THREE.Vector3().subVectors(leftAttach, this.prevLeftAttach);
    const deltaRight = new THREE.Vector3().subVectors(rightAttach, this.prevRightAttach);
    console.log(`   Δ leftHandle: (${deltaLeft.x.toFixed(4)}, ${deltaLeft.y.toFixed(4)}, ${deltaLeft.z.toFixed(4)})`);
    console.log(`   Δ rightHandle: (${deltaRight.x.toFixed(4)}, ${deltaRight.y.toFixed(4)}, ${deltaRight.z.toFixed(4)})`);
    this.prevLeftAttach.copy(leftAttach);
    this.prevRightAttach.copy(rightAttach);
  }
}

// ATTENDU (quand barre à gauche):
// - leftHandle Y diminue (descend)
// - rightHandle Y augmente (monte)
// - Δ sont non-zéro pendant la rotation

// ✓ PASSE: Points d'attache bougent géométriquement
// ✗ ÉCHOUE: Problème dans PilotSystem ou géométrie de la barre
```

---

### ÉTAPE 3️⃣ : Les Distances Mesurées Changent-elles ?

**Point de contrôle**: Distances entre barre et kite

```typescript
// Ajouter dans DebugSystem.update():

const kite = entityManager.getEntity('kite');
const controlBar = entityManager.getEntity('controlBar');
const kiteGeometry = kite?.getComponent<GeometryComponent>('geometry');
const barGeometry = controlBar?.getComponent<GeometryComponent>('geometry');
const kiteTransform = kite?.getComponent<TransformComponent>('transform');
const barTransform = controlBar?.getComponent<TransformComponent>('transform');

if (kiteGeometry && barGeometry && kiteTransform && barTransform) {
  const ctrlGauche = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
  const ctrlDroit = kiteGeometry.getPointWorld('CTRL_DROIT', kite);
  const barLeft = barGeometry.getPointWorld('leftHandle', controlBar);
  const barRight = barGeometry.getPointWorld('rightHandle', controlBar);
  
  const dist_left = barLeft.distanceTo(ctrlGauche);
  const dist_right = barRight.distanceTo(ctrlDroit);
  
  console.log(`📊 [DIAG-3] Line Distances:`);
  console.log(`   distance(barLeft → CTRL_gauche): ${dist_left.toFixed(3)} m`);
  console.log(`   distance(barRight → CTRL_droit): ${dist_right.toFixed(3)} m`);
  console.log(`   asymmetry Δ: ${Math.abs(dist_left - dist_right).toFixed(3)} m`);
  
  // Afficher les positions pour vérifier
  console.log(`   barLeft: (${barLeft.x.toFixed(3)}, ${barLeft.y.toFixed(3)}, ${barLeft.z.toFixed(3)})`);
  console.log(`   CTRL_gauche: (${ctrlGauche.x.toFixed(3)}, ${ctrlGauche.y.toFixed(3)}, ${ctrlGauche.z.toFixed(3)})`);
}

// ATTENDU (quand barre à gauche):
// - dist_left > dist_right (asymétrie)
// - Δ augmente progressivement
// - Les valeurs changent chaque frame

// ✓ PASSE: Distances deviennent asymétriques
// ✗ ÉCHOUE: Les CTRL points ne bougent pas OU les bridles ne changent pas
```

---

### ÉTAPE 4️⃣ : Les Tensions Deviennent-elles Asymétriques ?

**Point de contrôle**: `ConstraintSystem.updatePBD()` - Tensions des lignes

```typescript
// Ajouter dans DebugSystem.update():

const leftLine = entityManager.getEntity('leftLine');
const rightLine = entityManager.getEntity('rightLine');
const leftLineComp = leftLine?.getComponent<LineComponent>('line');
const rightLineComp = rightLine?.getComponent<LineComponent>('line');

if (leftLineComp && rightLineComp) {
  console.log(`📊 [DIAG-4] Line Tensions:`);
  console.log(`   leftLine - current: ${leftLineComp.currentLength.toFixed(3)} m, rest: ${leftLineComp.restLength.toFixed(3)} m`);
  console.log(`   leftLine - elongation: ${leftLineComp.state.elongation.toFixed(3)} m, tension: ${leftLineComp.currentTension.toFixed(2)} N`);
  console.log(`   `);
  console.log(`   rightLine - current: ${rightLineComp.currentLength.toFixed(3)} m, rest: ${rightLineComp.restLength.toFixed(3)} m`);
  console.log(`   rightLine - elongation: ${rightLineComp.state.elongation.toFixed(3)} m, tension: ${rightLineComp.currentTension.toFixed(2)} N`);
  console.log(`   `);
  console.log(`   asymmetry: Δ tension = ${Math.abs(leftLineComp.currentTension - rightLineComp.currentTension).toFixed(2)} N`);
}

// ATTENDU (quand barre à gauche):
// - leftLine.currentLength > rightLine.currentLength
// - leftLine.currentTension > rightLine.currentTension
// - Asymétrie > 0

// ✓ PASSE: Tensions asymétriques
// ✗ ÉCHOUE: Distances ne changent pas (DIAG-3) OU ConstraintSystem ne calcule pas correctement
```

---

### ÉTAPE 5️⃣ : Les Torques Sont-ils Générés ?

**Point de contrôle**: `ConstraintSystem.updatePBD()` - Calcul des torques

```typescript
// ⚠️ Nécessite modification du ConstraintSystem pour exposer les torques
// Ajouter dans PhysicsComponent ou créer un DebugComponent

// Dans ConstraintSystem.updatePBD(), avant d'ajouter les torques:
if (!kitePhysics.debugTorques) {
  kitePhysics.debugTorques = { left: new THREE.Vector3(), right: new THREE.Vector3() };
}

// Ligne gauche
const torqueLeft = new THREE.Vector3().crossVectors(r_gauche, force_gauche);
kitePhysics.debugTorques.left.copy(torqueLeft);

// Ligne droite
const torqueRight = new THREE.Vector3().crossVectors(r_droit, force_droit);
kitePhysics.debugTorques.right.copy(torqueRight);

// Puis dans DebugSystem:
const kitePhysics = kite?.getComponent<PhysicsComponent>('physics');
if (kitePhysics?.debugTorques) {
  const τ_left = kitePhysics.debugTorques.left;
  const τ_right = kitePhysics.debugTorques.right;
  const τ_net = new THREE.Vector3().addVectors(τ_left, τ_right);
  
  console.log(`📊 [DIAG-5] Torques:`);
  console.log(`   τ_left: (${τ_left.x.toFixed(3)}, ${τ_left.y.toFixed(3)}, ${τ_left.z.toFixed(3)}) N⋅m`);
  console.log(`   τ_right: (${τ_right.x.toFixed(3)}, ${τ_right.y.toFixed(3)}, ${τ_right.z.toFixed(3)}) N⋅m`);
  console.log(`   τ_net: (${τ_net.x.toFixed(3)}, ${τ_net.y.toFixed(3)}, ${τ_net.z.toFixed(3)}) N⋅m`);
  console.log(`   |τ_net|: ${τ_net.length().toFixed(3)} N⋅m`);
}

// ATTENDU (quand barre à gauche):
// - τ_left et τ_right sont NON-NULS
// - τ_left ≠ -τ_right (ne s'annulent pas)
// - τ_net.length() > 0.01 (significatif)

// ✓ PASSE: Torques significatifs générés
// ✗ ÉCHOUE: Les forces ne créent pas de torques (points CTRL symétriques ?)
```

---

### ÉTAPE 6️⃣ : Le Quaternion du Kite Change-t-il ?

**Point de contrôle**: `PhysicsSystem.update()` - Intégration des torques

```typescript
// Ajouter dans DebugSystem.update():

const kite = entityManager.getEntity('kite');
const kiteTransform = kite?.getComponent<TransformComponent>('transform');
const kitePhysics = kite?.getComponent<PhysicsComponent>('physics');

if (kiteTransform && kitePhysics) {
  const euler = new THREE.Euler().setFromQuaternion(kiteTransform.quaternion);
  const eulerDeg = new THREE.Vector3(
    euler.x * 180 / Math.PI,
    euler.y * 180 / Math.PI,
    euler.z * 180 / Math.PI
  );
  
  console.log(`📊 [DIAG-6] Kite Rotation:`);
  console.log(`   quaternion: (${kiteTransform.quaternion.x.toFixed(4)}, ${kiteTransform.quaternion.y.toFixed(4)}, ${kiteTransform.quaternion.z.toFixed(4)}, ${kiteTransform.quaternion.w.toFixed(4)})`);
  console.log(`   euler (deg): pitch=${eulerDeg.x.toFixed(2)}°, roll=${eulerDeg.z.toFixed(2)}°, yaw=${eulerDeg.y.toFixed(2)}°`);
  console.log(`   angularVelocity: (${kitePhysics.angularVelocity.x.toFixed(4)}, ${kitePhysics.angularVelocity.y.toFixed(4)}, ${kitePhysics.angularVelocity.z.toFixed(4)}) rad/s`);
}

// ATTENDU (quand barre à gauche):
// - euler angles CHANGENT (surtout Z pour roll)
// - quaternion CHANGE chaque frame
// - angularVelocity ≠ 0

// ✓ PASSE: Kite rotatione !
// ✗ ÉCHOUE: PhysicsSystem ne traite pas les torques correctement
```

---

### ÉTAPE 7️⃣ : La Géométrie du Kite Reflète-t-elle la Rotation ?

**Point de contrôle**: Visualisation 3D

```typescript
// Ajouter dans DebugSystem.update():

// Afficher la spine du kite pour vérifier l'orientation
const kite = entityManager.getEntity('kite');
const kiteTransform = kite?.getComponent<TransformComponent>('transform');
const kiteGeometry = kite?.getComponent<GeometryComponent>('geometry');

if (kiteTransform && kiteGeometry) {
  const spineBase = kiteGeometry.getPointWorld('SPINE_BAS', kite);
  const spineTop = kiteGeometry.getPointWorld('NEZ', kite);
  
  console.log(`📊 [DIAG-7] Spine Orientation:`);
  console.log(`   SPINE_BAS (monde): (${spineBase.x.toFixed(3)}, ${spineBase.y.toFixed(3)}, ${spineBase.z.toFixed(3)})`);
  console.log(`   NEZ (monde): (${spineTop.x.toFixed(3)}, ${spineTop.y.toFixed(3)}, ${spineTop.z.toFixed(3)})`);
  
  // Direction de la spine
  const spineDir = new THREE.Vector3().subVectors(spineTop, spineBase).normalize();
  console.log(`   spine direction: (${spineDir.x.toFixed(3)}, ${spineDir.y.toFixed(3)}, ${spineDir.z.toFixed(3)})`);
  
  // Angle avec la verticale (Y)
  const angleWithVertical = Math.acos(Math.abs(spineDir.y)) * 180 / Math.PI;
  console.log(`   angle from vertical: ${angleWithVertical.toFixed(2)}°`);
}

// ATTENDU (quand barre à gauche):
// - spine direction change
// - angle from vertical > 0 (spine n'est plus verticale)
// - Kite s'incline visuellement

// ✓ PASSE: Kite se penche visuellement !
// ✗ ÉCHOUE: Rotation du quaternion ne se reflète pas géométriquement
```

---

## 📋 CHECKLIST DE DIAGNOSTIC

Exécutez dans l'ordre et notez les résultats:

```
[ ] DIAG-1: Barre rotatione
    Result: _______________

[ ] DIAG-2: Points d'attache bougent
    Result: _______________

[ ] DIAG-3: Distances changent asymétriquement
    Result: _______________

[ ] DIAG-4: Tensions deviennent asymétriques
    Result: _______________

[ ] DIAG-5: Torques significatifs générés
    Result: _______________

[ ] DIAG-6: Quaternion du kite change
    Result: _______________

[ ] DIAG-7: Géométrie reflète la rotation
    Result: _______________
```

---

## 🎯 INTERPRÉTATION DES RÉSULTATS

### Scénario A: ✓✓✓✓✓✓✓ (Tous passent)
→ **Le système fonctionne correctement !**  
→ Le kite devrait se pencher. Si ce n'est pas visible en 3D, c'est un problème de rendu.

### Scénario B: ✓✓✓✗✗✗✗ (Échoue à DIAG-4)
→ **Tensions ne changent pas asymétriquement**
→ Causes possibles:
   - Les bridles ne se mettent pas à jour (BridleConstraintSystem)
   - Les CTRL points ne bougent pas
   - Mesure incorrecte des distances

### Scénario C: ✓✓✓✓✗✗✗ (Échoue à DIAG-5)
→ **Torques ne sont pas générés correctement**
→ Causes possibles:
   - Points CTRL trop proches du centre (r trop petit)
   - Forces générées mais pas appliquées
   - Calcul du cross product erroné

### Scénario D: ✓✓✓✓✓✗✗ (Échoue à DIAG-6)
→ **PhysicsSystem ne traite pas les torques**
→ Causes possibles:
   - Intégrateur quaternion incorrect
   - Torques accumulés mais non consommés
   - Velocity clearing (adaptive damping) les annule

### Scénario E: ✓✓✓✓✓✓✗ (Échoue à DIAG-7)
→ **Rotation calculée mais pas reflétée géométriquement**
→ Causes possibles:
   - RenderSystem ne lit pas le quaternion
   - MeshComponent pas à jour
   - GeometryComponent ne transforme pas les points

---

## 🚀 PROCHAINES ACTIONS

1. **Ajouter le logging** pour les 7 diagnostics
2. **Lancer le jeu** avec la barre mouvante
3. **Observer la console** et noter où ça casse
4. **Corriger le système identifié**
5. **Re-tester** jusqu'à ✓✓✓✓✓✓✓

