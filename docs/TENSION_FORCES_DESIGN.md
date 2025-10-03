# Implémentation des Tensions comme Forces Physiques Réelles

**Date** : 3 octobre 2025  
**Branche** : `feature/tension-forces-physics`  
**Objectif** : Ajouter forces de tension pour les **brides** (stabilisation interne) tout en gardant les lignes principales comme contraintes PBD (retenue à distance fixe)

---

## 📋 Contexte

### État Actuel (AS-IS)

Dans la version actuelle, les tensions sont **calculées mais pas appliquées** :

```typescript
// PhysicsEngine.ts (ligne ~115)
// CALCUL DES TENSIONS (pour affichage/debug uniquement)
// Les lignes ne TIRENT PAS le kite - elles le RETIENNENT à distance max
this.lineSystem.calculateLineTensions(kite, newRotation, pilotPosition);

// CALCUL DES TENSIONS DES BRIDES (pour affichage/debug uniquement)
const bridleTensions = this.bridleSystem.calculateBridleTensions(kite);
```

**Modèle actuel :**
- Forces = Aérodynamique + Gravité
- Lignes/Brides = Contraintes PBD (distance maximale)
- Tensions = Affichage uniquement

**Problèmes identifiés :**
1. ❌ Les brides n'exercent pas de forces de stabilisation interne
2. ❌ L'équilibre du kite ne dépend pas des brides (uniquement contraintes géométriques)
3. ❌ L'orientation du kite n'est pas stabilisée par les tensions différentielles des brides
4. ⚠️  Les lignes principales **retiennent** correctement à distance fixe (PBD OK)
5. ❌ Les brides ne stabilisent pas l'angle d'attaque dynamiquement

---

## 🎯 Objectif (TO-BE)

### Architecture Cible

**Nouveau modèle physique hybride : Lignes PBD + Forces Brides**

```
PhysicsEngine.update():
  1. Calculer vent apparent
  2. Calculer forces aérodynamiques
  3. NOUVEAU: Calculer forces de tension des BRIDES (structure interne)
  4. Appliquer toutes les forces (aéro + gravité + brides)
  5. Intégrer position/vélocité (F=ma, T=Iα)
  6. Appliquer contraintes PBD lignes principales (distance fixe)
  7. Appliquer contraintes PBD brides (distance max - sécurité)
```

**Principe clé :** 
- **Lignes principales** = Contraintes PBD pures (retenue à distance fixe, pas de forces)
- **Brides** = Forces de tension + contraintes PBD (stabilisation + sécurité)
- Les brides agissent comme ressorts internes qui stabilisent l'angle d'attaque

---

## 🔬 Physique des Tensions

### 1. Lignes Principales (Pilote → Kite) - INCHANGÉ

**Les lignes principales restent des contraintes PBD pures** (comportement actuel correct) :

```typescript
// Contrainte géométrique uniquement - PAS de forces
ConstraintSolver.enforceLineConstraints(kite, newPosition, state, handles);

// Résultat : distance(CTRL_GAUCHE, HANDLE_LEFT) = lineLength (fixe)
//           distance(CTRL_DROIT, HANDLE_RIGHT) = lineLength (fixe)
```

**Pourquoi ne pas ajouter de forces sur les lignes principales ?**
- Les lignes Dyneema sont **quasi-inextensibles** (élasticité négligeable)
- Elles se comportent comme des **tiges rigides** en tension
- Le modèle PBD actuel est **physiquement correct** pour ce cas
- Ajouter des forces créerait une **redondance** et des **instabilités**

**Tension calculée** (pour affichage uniquement) :
```typescript
// La tension est réelle, mais elle n'applique pas de force
// C'est la réaction aux contraintes géométriques
const tension = LinePhysics.calculateTension(line, distance, velocity);
```

### 2. Forces de Bride (Structure Interne)

Chaque bride (6 au total) exerce une force interne qui stabilise la géométrie :

```typescript
// Bride : NEZ → CTRL_GAUCHE
const bridleVector = ctrlGauche.sub(nez);
const distance = bridleVector.length();
const direction = bridleVector.normalize();

const tension = LinePhysics.calculateTension(bridle, distance, velocity);
const bridleForce_atNez = direction.multiplyScalar(tension);      // Tire le NEZ vers CTRL
const bridleForce_atCtrl = direction.multiplyScalar(-tension);    // Tire le CTRL vers NEZ
```

**Effet sur l'équilibre :**
- Si NEZ trop loin → bride tire le NEZ vers l'arrière
- Si CTRL trop loin → bride tire le CTRL vers l'avant
- Stabilisation naturelle de l'angle d'attaque

### 3. Équilibre Statique (Hovering)

Au point d'équilibre (kite immobile dans le vent) :

```
ΣF = 0  →  F_aero + F_gravity + F_bridles = 0
ΣT = 0  →  T_aero + T_bridles = 0

(Les lignes principales n'apparaissent pas car contraintes, pas forces)
```

**Exemple typique :**
- Portance (lift) = 50 N vers le haut
- Gravité = 5 N vers le bas
- Traînée (drag) = 30 N vers l'arrière
- **Lignes principales** : Contraintes géométriques (distance fixe maintenue par PBD)
- **Forces brides** : ~10-20 N internes qui stabilisent l'angle d'attaque
  - Brides NEZ → tirent le nez vers l'arrière si angle trop grand
  - Brides CENTRE → tirent le centre vers l'avant si angle trop petit
  - Équilibre dynamique qui stabilise naturellement

---

## 🏗️ Plan d'Implémentation

### Phase 1 : Architecture des Forces de Tension

**Fichier** : `src/simulation/physics/TensionForceCalculator.ts`

```typescript
export interface TensionForceResult {
  // Forces linéaires
  force: THREE.Vector3;           // Force totale en N
  applicationPoint: string;        // Point d'application (nom anatomique)
  
  // Couple (torque)
  torque: THREE.Vector3;          // Moment en N⋅m
  
  // Debug
  tension: number;                 // Tension en N
  direction: THREE.Vector3;        // Direction normalisée
}

export class TensionForceCalculator {
  /**
   * Calcule la force exercée par une ligne sur le kite
   */
  static calculateLineForce(
    line: Line,
    kitePoint: THREE.Vector3,
    handlePoint: THREE.Vector3,
    kiteVelocity: THREE.Vector3,
    kiteCenter: THREE.Vector3
  ): TensionForceResult {
    // 1. Vecteur ligne
    const lineVector = new THREE.Vector3().subVectors(kitePoint, handlePoint);
    const distance = lineVector.length();
    const direction = lineVector.clone().normalize();
    
    // 2. Vélocité relative du point d'attache
    const leverArm = new THREE.Vector3().subVectors(kitePoint, kiteCenter);
    const pointVelocity = kiteVelocity.clone(); // Simplifié (TODO: ajouter ω × r)
    
    // 3. Calculer tension via LinePhysics
    const tension = LinePhysics.calculateTension(line, distance, pointVelocity);
    
    // 4. Force = tension × direction (vers le pilote)
    const force = direction.multiplyScalar(-tension);
    
    // 5. Couple = r × F
    const torque = new THREE.Vector3().crossVectors(leverArm, force);
    
    return { force, torque, applicationPoint: line.kitePoint, tension, direction };
  }
  
  /**
   * Calcule les forces exercées par une bride interne
   */
  static calculateBridleForces(
    bridle: Line,
    startPoint: THREE.Vector3,
    endPoint: THREE.Vector3,
    kiteVelocity: THREE.Vector3
  ): { startForce: TensionForceResult, endForce: TensionForceResult } {
    // Bride tire dans les deux sens (action-réaction)
    const bridleVector = new THREE.Vector3().subVectors(endPoint, startPoint);
    const distance = bridleVector.length();
    const direction = bridleVector.clone().normalize();
    
    // Vélocité relative (simplifié)
    const relativeVelocity = new THREE.Vector3(); // TODO: tenir compte rotation
    
    const tension = LinePhysics.calculateTension(bridle, distance, relativeVelocity);
    
    // Force au point de départ (tire vers end)
    const forceStart = direction.clone().multiplyScalar(tension);
    
    // Force au point d'arrivée (tire vers start)
    const forceEnd = direction.clone().multiplyScalar(-tension);
    
    return {
      startForce: {
        force: forceStart,
        torque: new THREE.Vector3(), // TODO: calculer
        applicationPoint: bridle.attachments.kitePoint,
        tension,
        direction
      },
      endForce: {
        force: forceEnd,
        torque: new THREE.Vector3(), // TODO: calculer
        applicationPoint: bridle.attachments.barPoint,
        tension,
        direction: direction.clone().negate()
      }
    };
  }
}
```

### Phase 2 : Intégration dans PhysicsEngine

**Fichier** : `src/simulation/physics/PhysicsEngine.ts`

```typescript
update(deltaTime: number, targetBarRotation: number, isPaused: boolean = false): void {
  // ... code existant ...
  
  // ÉTAPE 1 : Forces aérodynamiques (existant)
  const { lift, drag, torque: aeroTorque } = AerodynamicsCalculator.calculateForces(
    apparentWind,
    kite.quaternion
  );
  
  // ÉTAPE 2 : Forces de gravité (existant)
  const gravity = new THREE.Vector3(0, -CONFIG.kite.mass * CONFIG.physics.gravity, 0);
  
  // ÉTAPE 3 : NOUVEAU - Forces des brides (structure interne)
  const bridleForces = this.calculateBridleForces(kite);
  const bridleForcesTotal = bridleForces.totalForce;
  const bridleTorqueTotal = bridleForces.totalTorque;
  
  // ÉTAPE 4 : Somme de TOUTES les forces
  const totalForce = new THREE.Vector3()
    .add(lift)
    .add(drag)
    .add(gravity)
    .add(bridleForcesTotal);   // NOUVEAU - brides uniquement
  
  // ÉTAPE 5 : Somme de TOUS les couples
  const totalTorque = new THREE.Vector3()
    .add(aeroTorque)
    .add(bridleTorqueTotal);   // NOUVEAU - brides uniquement
  
  // ÉTAPE 7 : Intégration + Contraintes PBD (existant)
  this.kiteController.update(totalForce, totalTorque, handles, deltaTime);
  
  // Les contraintes PBD restent comme filet de sécurité
}

private calculateBridleForces(kite: Kite) {
  // Calculer forces pour les 6 brides
  // Retourner somme totale
  // TODO: implémenter
}
```

### Phase 3 : Adaptation du ConstraintSolver

**Pour les lignes principales :** AUCUN CHANGEMENT (comportement actuel correct)

```typescript
// ConstraintSolver.ts - enforceLineConstraints() INCHANGÉ
// Les lignes restent des contraintes strictes (distance = lineLength)

static enforceLineConstraints(/* ... */) {
  // Comportement actuel : OK
  // Maintient distance exacte entre CTRL et HANDLE
  // C'est physiquement correct pour Dyneema quasi-inextensible
}
```

**Pour les brides :** Ajouter filet de sécurité

```typescript
static enforceBridleConstraints(/* ... */) {
  // AVANT : Contrainte stricte (distance = bridleLength exactement)
  // APRÈS : Contrainte de distance MAXIMALE uniquement (sécurité)
  
  if (distance > maxBridleLength * 1.02) {  // 2% de marge
    // Appliquer correction PBD (sécurité)
  }
  
  // Sinon : laisser les forces de brides gérer la distance
}
```

### Phase 4 : Paramétrage et Tuning

**Fichier** : `src/simulation/config/SimulationConfig.ts`

```typescript
export const CONFIG = {
  // ... existant ...
  
  tensionForces: {
    enabled: true,                    // Toggle pour A/B testing
    
    // Poids des forces de tension (0-1)
    lineForceWeight: 1.0,             // 100% = forces pleines
    bridleForceWeight: 1.0,           // 100% = stabilisation complète
    
    // Lissage temporel
    forceSmoothingFactor: 0.85,       // Lerp pour éviter oscillations
    
    // Seuil de tension minimale
    minTensionThreshold: 5.0,         // N - en dessous = ignorer
    
    // Contraintes PBD comme sécurité
    pbd: {
      maxLineExtension: 1.05,         // 5% d'extension max
      maxBridleExtension: 1.02,       // 2% d'extension max (plus rigide)
      iterations: 3,                   // Iterations PBD
    }
  }
};
```

---

## 🧪 Tests et Validation

### Scénarios de Test

#### Test 1 : Hovering Stable
**Setup :**
- Vent constant 8 m/s
- Kite au zénith (90°)
- Lignes égales

**Résultat attendu :**
- ✅ Kite reste stable (oscillations < 10 cm)
- ✅ Angle d'attaque stable (~15-20°)
- ✅ Tensions lignes équilibrées (~40N chacune)

#### Test 2 : Turn à Gauche
**Setup :**
- Tirer ligne gauche (rotation barre -30°)
- Vent 8 m/s

**Résultat attendu :**
- ✅ Tension gauche augmente (~60N)
- ✅ Tension droite diminue (~20N)
- ✅ Couple net → rotation horaire
- ✅ Kite tourne à gauche

#### Test 3 : Stabilisation par Brides
**Setup :**
- Perturber l'angle d'attaque (+10°)
- Observer retour à l'équilibre

**Résultat attendu :**
- ✅ Brides NEZ tirées → ramènent le nez
- ✅ Retour à angle stable en < 2s
- ✅ Pas d'oscillations excessives

#### Test 4 : Sécurité PBD
**Setup :**
- Force externe extrême (rafale 20 m/s)
- Vérifier que les lignes ne cassent pas

**Résultat attendu :**
- ✅ Contraintes PBD empêchent extension > 5%
- ✅ Tensions calculées > maxTension
- ✅ Kite ralenti par contraintes

---

## 📊 Métriques de Réussite

### Physique
- [ ] Équilibre stable au zénith (oscillations < 10 cm)
- [ ] Réponse cohérente aux commandes (turn < 3s)
- [ ] Stabilisation angle d'attaque par brides (< 2s)
- [ ] Conservation énergie (pas de gain/perte irréaliste)

### Performance
- [ ] Framerate stable 60 FPS
- [ ] Calculs de tension < 2 ms total
- [ ] Pas d'instabilités numériques

### UX
- [ ] Visualisation tensions en temps réel (HUD)
- [ ] Feedback visuel sur lignes (couleur tension)
- [ ] Toggle forces/contraintes pour A/B testing

---

## 🚧 Risques et Mitigations

### Risque 1 : Instabilité Numérique
**Symptôme :** Oscillations explosives, kite "vibre"
**Cause :** Forces de tension trop raides + deltaTime trop grand
**Mitigation :**
- Lissage temporel des forces (lerp 0.85)
- Limiter deltaTime max (0.016s)
- Damping augmenté sur lignes/brides

### Risque 2 : Double Comptage des Forces
**Symptôme :** Kite trop stable/rigide
**Cause :** Forces de tension + contraintes PBD = redondance
**Mitigation :**
- Contraintes PBD = sécurité uniquement (> 105%)
- Forces de tension = comportement normal (< 105%)

### Risque 3 : Comportement Irréaliste
**Symptôme :** Kite ne réagit plus comme avant
**Cause :** Paramètres de tension incorrects
**Mitigation :**
- Toggle pour comparer ancien/nouveau modèle
- Tuning progressif des poids (0.0 → 1.0)
- Tests A/B avec utilisateurs

---

## 📅 Planning

### Sprint 1 : Foundation (3-5 jours)
- [ ] Créer `TensionForceCalculator.ts`
- [ ] Implémenter `calculateLineForce()`
- [ ] Implémenter `calculateBridleForces()`
- [ ] Tests unitaires sur calculs de forces

### Sprint 2 : Intégration (3-5 jours)
- [ ] Modifier `PhysicsEngine.update()`
- [ ] Ajouter forces lignes au total
- [ ] Ajouter forces brides au total
- [ ] Adapter `ConstraintSolver` (sécurité seulement)

### Sprint 3 : Tuning (5-7 jours)
- [ ] Tests hovering stable
- [ ] Tests turns gauche/droite
- [ ] Tests stabilisation brides
- [ ] Ajuster paramètres (weights, smoothing, thresholds)

### Sprint 4 : Validation (2-3 jours)
- [ ] Tests de régression
- [ ] Documentation utilisateur
- [ ] Merge vers main

**Durée totale estimée :** 13-20 jours

---

## 📚 Références

### Documents Existants
- `docs/LINE_PHYSICS_AUDIT_2025-10-01.md` — Audit des tensions actuelles
- `docs/BRIDLES_AS_LINES_DESIGN.md` — Architecture des brides
- `docs/OOP_LINE_ARCHITECTURE.md` — Architecture lignes

### Littérature Physique
- Position-Based Dynamics (Müller et al. 2007)
- Kite Physics (Loyd 2012)
- Tension-based Control Systems

### Code Critique
- `src/simulation/physics/LinePhysics.ts` — Calcul tension Hooke
- `src/simulation/physics/ConstraintSolver.ts` — PBD actuel
- `src/simulation/controllers/KiteController.ts` — Intégration forces

---

**Auteur:** Matthieu (avec assistance AI)  
**Statut:** 🔵 Design Document - Prêt pour implémentation  
**Prochaine étape:** Créer `TensionForceCalculator.ts` et commencer Sprint 1
