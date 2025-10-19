# 🚀 Guide de Passage en Mode Dynamique

Ce document explique comment passer du mode **statique/cinématique** actuel au mode **dynamique** complet avec simulation physique.

---

## 📊 État Actuel (Mode Statique)

### Configuration
- **Kite:** `isKinematic = true` dans `KiteFactory.ts`
- **Physique:** Les systèmes PhysicsSystem et ConstraintSystem **sautent** les entités cinématiques
- **Position:** Fixe, définie dans `CONFIG.initialization`

### Code Concerné

**KiteFactory.ts**
```typescript
entity.addComponent(new PhysicsComponent({
  mass: CONFIG.kite.mass,
  isKinematic: true  // ← Mode statique
}));
```

**PhysicsSystem.ts**
```typescript
if (physics.isKinematic) {
  this.clearForces(physics);
  return; // Skip physics
}
```

**ConstraintSystem.ts**
```typescript
if (kitePhysics?.isKinematic) {
  return; // Skip constraints
}
```

---

## 🔄 Passage en Mode Dynamique

### Étape 1 : Désactiver le mode cinématique

**Fichier :** `src/ecs/entities/KiteFactory.ts`

```typescript
// AVANT
entity.addComponent(new PhysicsComponent({
  mass: CONFIG.kite.mass,
  isKinematic: true  // ← Statique
}));

// APRÈS
entity.addComponent(new PhysicsComponent({
  mass: CONFIG.kite.mass,
  isKinematic: false  // ← Dynamique !
}));
```

### Étape 2 : Ajuster la position initiale (optionnel)

Le kite va tomber sous l'effet de la gravité. Pour un lancement réaliste :

**Option A : Départ en vol stabilisé**
```typescript
// Dans KiteFactory.ts
const velocity = new THREE.Vector3(
  0,    // Pas de dérive latérale
  0,    // Pas de montée/descente initiale
  -5    // Avance vers l'avant (vent apparent)
);

entity.addComponent(new PhysicsComponent({
  mass: CONFIG.kite.mass,
  velocity: velocity,  // Vitesse initiale
  isKinematic: false
}));
```

**Option B : Départ au sol (décollage)**
```typescript
// Dans Config.ts
initialization: {
  kiteAltitude: 0,      // Au sol
  kiteDistance: 15
}
```

### Étape 3 : Activer le vent

**Fichier :** `src/ecs/config/Config.ts`

```typescript
wind: {
  speed: 8.0,           // m/s (vent moyen)
  direction: 0,         // degrés (0 = vent de face)
  turbulence: 0.1,      // Variation de vitesse
  gustFrequency: 0.5    // Fréquence des rafales
}
```

### Étape 4 : Vérifier les paramètres physiques

**Masse et inertie** (déjà configurés dans `Config.ts`) :
```typescript
kite: {
  mass: 0.06,  // 60g - OK pour kite 1.65m
  inertia: {
    Ixx: 0.015,
    Iyy: 0.020,
    Izz: 0.005
  }
}
```

**Coefficients aérodynamiques** :
```typescript
aerodynamics: {
  CL0: 0.0,        // Portance à alpha=0
  CLAlpha: 0.08,   // Pente de portance
  CD0: 0.05,       // Traînée parasite
  CM: -0.1         // Moment de tangage
}
```

---

## 🎮 Contrôles Disponibles

Une fois en mode dynamique, les contrôles suivront ce flux :

1. **InputSystem** (P10) : Capture clavier/souris
2. **PilotSystem** (P55) : Traduit en déplacement de la barre
3. **WindSystem** (P20) : Calcule vent apparent
4. **AeroSystem** (P30) : Calcule forces aérodynamiques
5. **ConstraintSystem** (P40) : Applique contraintes des lignes
6. **PhysicsSystem** (P50) : Intègre les forces → mouvement

### Touches (à implémenter dans InputSystem)

```typescript
// Exemple de contrôles à ajouter
'ArrowLeft'  → Barre à gauche  → Kite tourne à gauche
'ArrowRight' → Barre à droite  → Kite tourne à droite
'ArrowUp'    → Tirer la barre  → Kite accélère
'ArrowDown'  → Pousser la barre → Kite ralentit
```

---

## ⚠️ Points d'Attention

### 1. Stabilité Numérique

Le kite peut devenir instable si :
- Le pas de temps est trop grand
- Les forces sont mal équilibrées
- Les contraintes sont trop raides

**Solution :** Ajuster dans `ConstraintSystem.ts` :
```typescript
const LINE_PROJECTION_STRENGTH = 0.3;  // Réduire si oscillations
const BRIDLE_CORRECTION_FACTOR = 0.1;  // Réduire si instable
```

### 2. Vitesse de Simulation

Pour ralentir/accélérer la physique :

**Fichier :** `src/ecs/config/Config.ts`
```typescript
simulation: {
  timeScale: 0.5  // 0.5 = ralenti 50%, 2.0 = x2 vitesse
}
```

### 3. Limites de Sécurité

Ajouter des gardes dans `PhysicsSystem.ts` :
```typescript
// Limiter vitesse maximale
const MAX_VELOCITY = 50; // m/s
if (physics.velocity.length() > MAX_VELOCITY) {
  physics.velocity.normalize().multiplyScalar(MAX_VELOCITY);
}

// Limiter altitude minimale
if (transform.position.y < 0.5) {
  transform.position.y = 0.5;
  physics.velocity.y = Math.max(0, physics.velocity.y);
}
```

---

## 🧪 Test Progressif

### Phase 1 : Gravité seule
```typescript
isKinematic: false
wind.speed: 0  // Pas de vent
```
→ Le kite doit tomber verticalement

### Phase 2 : Gravité + Vent
```typescript
isKinematic: false
wind.speed: 8  // Vent moyen
```
→ Le kite doit se soulever et planer

### Phase 3 : Contrôles
Implémenter InputSystem pour contrôler la barre
→ Le kite doit répondre aux commandes

---

## 📝 Checklist de Passage

- [ ] Mettre `isKinematic: false` dans KiteFactory
- [ ] Configurer vent (vitesse ~8 m/s)
- [ ] Tester stabilité avec timeScale réduit (0.5)
- [ ] Vérifier que PhysicsSystem applique la gravité
- [ ] Vérifier que AeroSystem calcule portance/traînée
- [ ] Vérifier que ConstraintSystem maintient longueur des lignes
- [ ] Implémenter contrôles dans InputSystem
- [ ] Ajuster paramètres de stabilité si nécessaire
- [ ] Tester crash au sol et rebond
- [ ] Ajuster caméra pour suivre le kite

---

## 🔗 Fichiers à Modifier

1. **src/ecs/entities/KiteFactory.ts** - Désactiver isKinematic
2. **src/ecs/config/Config.ts** - Configurer vent et simulation
3. **src/ecs/systems/InputSystem.ts** - Implémenter contrôles
4. **src/ecs/systems/ConstraintSystem.ts** - Ajuster si instable
5. **src/ecs/systems/PhysicsSystem.ts** - Ajouter limites de sécurité

---

**Prêt à décoller ! 🪁**
