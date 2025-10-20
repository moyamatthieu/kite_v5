# Diagnostic et Fix : Mode PBD Non Fonctionnel

**Date :** 20 octobre 2025  
**Branche :** `fix/pbd-mode-investigation`  
**Commit :** 817dec6

---

## 🔴 Problème Initial

Le mode de contrainte **Spring-Force** fonctionnait correctement, mais le mode **PBD (Position-Based Dynamics)** ne fonctionnait pas. Le kite présentait un comportement erratique et instable en mode PBD.

---

## 🔍 Investigation Systématique

### 1. Architecture du Système de Contraintes

Le système utilise deux modes de contrainte de lignes :

#### Mode **Spring-Force** (fonctionnel)
- Calcule l'extension de chaque ligne
- Applique des forces ressort : `F = -k × extension - c × vitesse`
- Distribue force/torque selon le point d'attache
- **Respecte l'architecture ECS pure** : modifie uniquement `PhysicsComponent`

#### Mode **PBD** (dysfonctionnel)
- Sauvegarde l'état initial (position, quaternion)
- Calcule positions monde CTRL avec état initial
- Itère pour résoudre les contraintes (Gauss-Seidel)
- Applique les corrections finales
- **BUG** : Modifiait incorrectement les points CTRL locaux

### 2. Ordre d'Exécution des Systèmes

```
1. BridleConstraintSystem (priorité 10) - Recalcule CTRL si longueurs changent
2. WindSystem (priorité 20) - Calcule le vent
3. AeroSystem (priorité 30) - Forces aéro (utilise CTRL via getPointWorld)
4. ConstraintSystem (priorité 40) - Contraintes lignes (PBD ou Force)
5. PhysicsSystem (priorité 50) - Intègre les forces
```

### 3. Rôle de BridleConstraintSystem

- **Priorité 10** (très haute, avant les autres systèmes)
- S'exécute **UNIQUEMENT** quand les longueurs de brides changent (via UI)
- Recalcule les positions **LOCALES** des points `CTRL_GAUCHE` et `CTRL_DROIT`
- Utilise la **trilatération 3D** pour résoudre la pyramide formée par :
  - 3 points anatomiques (NEZ, INTER, CENTRE)
  - 3 distances (longueurs des brides)
  - 1 point sommet (CTRL) à calculer

---

## 🐛 Bug Identifié

### Localisation
**Fichier :** `src/ecs/systems/ConstraintSystem.ts`  
**Lignes :** 193-213 (supprimées)

### Code Problématique

```typescript
// 🔧 SYNCHRONISATION CRITIQUE: Les CTRL doivent être recalculés après la correction PBD
const bridle = kite.getComponent<any>('bridle');
if (bridle && kiteGeometry) {
  const ctrlGaucheOld = kiteGeometry.getPoint('CTRL_GAUCHE');
  const ctrlDroitOld = kiteGeometry.getPoint('CTRL_DROIT');
  
  if (ctrlGaucheOld && ctrlDroitOld) {
    // Appliquer la même transformation (rotation + translation) aux CTRL
    ctrlGaucheOld.applyQuaternion(deltaQuaternion).add(deltaPosition);
    ctrlDroitOld.applyQuaternion(deltaQuaternion).add(deltaPosition);
    
    kiteGeometry.setPoint('CTRL_GAUCHE', ctrlGaucheOld);
    kiteGeometry.setPoint('CTRL_DROIT', ctrlDroitOld);
  }
}
```

### Analyse du Bug

#### Ce que le code faisait :
1. **Récupérait** les points CTRL en coordonnées **LOCALES** via `getPoint()`
2. **Appliquait** des transformations `deltaQuaternion` et `deltaPosition` (coordonnées **WORLD**)
3. **Stockait** ces points transformés comme nouveaux points **LOCAUX** via `setPoint()`

#### Pourquoi c'est incorrect :

**Violation de l'architecture ECS pure :**
- Les points dans `GeometryComponent` sont en coordonnées **LOCALES** du kite
- Ces coordonnées locales sont **FIXES** et ne changent pas avec le mouvement du kite
- Seuls `TransformComponent.position` et `TransformComponent.quaternion` changent
- Les positions **WORLD** sont recalculées dynamiquement via `getPointWorld()`

**Effet cumulatif destructeur :**
```
Frame 1: CTRL locaux corrects
  → Correction PBD modifie position/quaternion
  → Code bugué applique deltaQuaternion aux points locaux ❌
  
Frame 2: CTRL locaux corrompus
  → getPointWorld() utilise les points locaux corrompus
  → Correction PBD basée sur positions incorrectes
  → Code bugué corrompt encore plus les points locaux ❌
  
Frame 3: CTRL locaux très corrompus
  → Comportement erratique du kite
  → Instabilité exponentielle
```

### Pourquoi le Mode Force Fonctionnait

Le mode Spring-Force **n'avait pas ce bug** car :
- Utilise `getPointWorld()` pour lire les positions monde ✅
- Applique des forces au `PhysicsComponent` ✅
- **Ne modifie JAMAIS** les points locaux du `GeometryComponent` ✅
- Respecte la séparation ECS pure entre composants ✅

---

## ✅ Solution Appliquée

### Changement

**Supprimé :** Tout le bloc de code lignes 193-213 qui modifiait les points CTRL locaux

**Remplacé par :** Un commentaire expliquant l'architecture correcte

```typescript
// ✅ ARCHITECTURE ECS PURE : Les points CTRL locaux restent INCHANGÉS
// Seuls position/quaternion du kite changent. Les positions WORLD des CTRL
// seront automatiquement correctes via getPointWorld() qui applique le transform.
// Les points CTRL locaux ne sont modifiés QUE par BridleConstraintSystem
// lors des changements de longueurs de brides.
```

### Principe Architectural Respecté

**Séparation des responsabilités :**
- **`BridleConstraintSystem`** : Gère les positions LOCALES des points CTRL via trilatération
  - S'exécute UNIQUEMENT quand les longueurs de brides changent
  - Modifie les données dans `GeometryComponent`

- **`ConstraintSystem`** : Gère les contraintes de lignes
  - Mode PBD : Modifie UNIQUEMENT `TransformComponent` (position/quaternion)
  - Mode Force : Modifie UNIQUEMENT `PhysicsComponent` (forces/torques)
  - **Ne touche JAMAIS** à `GeometryComponent`

**Flux de données :**
```
BridleConstraintSystem (si longueurs changent)
  ↓ Modifie GeometryComponent (points CTRL locaux)
  
ConstraintSystem (chaque frame)
  ↓ Lit GeometryComponent.getPointWorld(CTRL)
  ↓ Modifie TransformComponent (PBD) ou PhysicsComponent (Force)
  
GeometryComponent.getPointWorld()
  ↓ Combine points locaux + TransformComponent
  ↓ Retourne positions monde correctes
```

---

## 🧪 Validation

### Tests Effectués
- [x] Compilation TypeScript : `npm run type-check` ✅
- [x] Vérification qu'aucun autre code ne modifie les points CTRL locaux ✅
- [x] Serveur de développement démarré : `http://localhost:3002` ✅
- [ ] Test manuel du mode PBD en action

### Points de Validation
1. Le kite doit rester stable en mode PBD
2. Les lignes doivent rester tendues correctement
3. Pas de comportement erratique ou d'oscillations
4. Les points CTRL doivent rester à leur position relative correcte
5. Le changement de longueurs de brides (sliders) doit fonctionner

---

## 📚 Leçons Apprises

### Architecture ECS Pure
1. **Components** = conteneurs de données pures (POJO)
2. **Local vs World** : bien distinguer coordonnées locales et monde
3. **Immutabilité relative** : les points géométriques locaux sont fixes
4. **Responsabilité unique** : un seul système modifie un aspect donné

### Debugging de Problèmes Subtils
1. Utiliser la réflexion structurée pour décomposer le problème
2. Comparer le code qui fonctionne (Force) vs celui qui ne fonctionne pas (PBD)
3. Tracer le flux de données à travers les systèmes
4. Identifier les violations architecturales
5. Chercher les effets cumulatifs sur plusieurs frames

### Code Review
- Les commentaires "SYNCHRONISATION CRITIQUE" peuvent cacher des bugs
- La "synchronisation" n'est souvent pas nécessaire avec une bonne architecture
- Tester les deux modes (PBD et Force) systématiquement

---

## 🔗 Fichiers Modifiés

- `src/ecs/systems/ConstraintSystem.ts` : Suppression du bloc bugué (lignes 193-213)

## 🔗 Fichiers Analysés

- `src/ecs/systems/ConstraintSystem.ts` : Système de contraintes dual mode
- `src/ecs/systems/BridleConstraintSystem.ts` : Système de trilatération des CTRL
- `src/ecs/components/GeometryComponent.ts` : Composant géométrie (points locaux)
- `src/ecs/entities/KiteFactory.ts` : Factory de création du kite
- `src/ecs/config/KiteGeometry.ts` : Définition géométrique du kite

---

## 📝 Références

### Documentation Makani
Le modèle PBD est inspiré du projet open-source **Makani** de Google.  
Source : `external/makani-master/`

### Configuration
- **Iterations PBD** : `CONFIG.lines.pbd.iterations` (défaut : 10)
- **Compliance** : `CONFIG.lines.pbd.compliance` (défaut : 0.0001)
- **Max Lambda** : `CONFIG.lines.pbd.maxLambda` (défaut : 100)
- **Max Correction** : `CONFIG.lines.pbd.maxCorrection` (défaut : 0.5)

---

**Statut :** ✅ **FIX APPLIQUÉ - EN ATTENTE DE VALIDATION MANUELLE**
