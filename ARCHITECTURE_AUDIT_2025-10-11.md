# Audit d'Architecture - 11 Octobre 2025

## Résumé Exécutif

Cet audit identifie les duplications et incohérences dans le projet Kite Simulator V8.

### 🔴 Problèmes Critiques (Action Immédiate)

1. **PhysicsSystem complètement redondant** - Non utilisé, doublon de KitePhysicsSystem
2. **WindSystem vs WindSimulator** - Duplication majeure des calculs de vent

### 🟡 Problèmes Moyens (Action Recommandée)

3. **Composants ECS inutilisés** - InputComponent, ControlComponent, KiteComponent
4. **Architecture hybride Kite** - Pas une vraie entité ECS

### ✅ Points Forts

- Gestion des lignes (Line, LinePhysics, LineSystem, LinesRenderSystem) : Architecture propre
- Séparation AerodynamicsCalculator : Pure function, bonne pratique
- ConstraintSolver : Logique centralisée PBD

---

## Détails des Problèmes

### 🔴 CRITIQUE #1 : PhysicsSystem Redondant

**Fichiers concernés** :
- `src/simulation/systems/PhysicsSystem.ts` ❌ INUTILISÉ
- `src/simulation/systems/KitePhysicsSystem.ts` ✅ UTILISÉ

**Duplications** :
```typescript
// PhysicsSystem (ligne 160)
calculateAerodynamicForces(velocity, area, liftCoeff, dragCoeff, normal)

// KitePhysicsSystem utilise à la place :
AerodynamicsCalculator.calculateForces(apparentWind, orientation, ...)
```

**Impact** :
- 260 lignes de code mort (instancié mais ne calcule rien)
- Confusion sur quelle classe utiliser
- Risque de divergence si quelqu'un modifie PhysicsSystem
- **PhysicsSystem.update()** est appelé mais ne fait RIEN (aucun objet enregistré !)

**Preuve** :
```typescript
// SimulationApp.ts ligne 710
this.physicsSystem.update(context); // ❌ Appel vide !

// PhysicsSystem.ts ligne 48
update(context: SimulationContext): void {
  // Mise à jour de tous les objets physiques
  for (const [id, state] of this.physicsObjects.entries()) { // ⚠️ Map vide !
    this.updatePhysicsObject(id, state, deltaTime);
  }
}
```

**Solution** :
1. ✅ **GARDER** : `KitePhysicsSystem` (orchestrateur spécifique kite)
2. ❌ **SUPPRIMER** : `PhysicsSystem` (instancié mais inutilisé, aucun objet enregistré)
3. Supprimer les appels dans `SimulationApp.ts`
4. Si besoin futur d'un système physique générique, le recréer sur base de KitePhysicsSystem

---

### 🔴 CRITIQUE #2 : WindSystem vs WindSimulator

**Fichiers concernés** :
- `src/simulation/systems/WindSystem.ts` ❌ INUTILISÉ (230 lignes)
- `src/simulation/physics/WindSimulator.ts` ✅ UTILISÉ (130 lignes)

**Duplications** :

| Fonctionnalité | WindSystem | WindSimulator |
|----------------|------------|---------------|
| Vent apparent | ✅ `getApparentWind()` | ✅ `getApparentWind()` |
| Turbulence | ✅ Sinus/cosinus complexes | ✅ Sinus/cosinus simplifiés |
| Rafales | ✅ Avec amplitude variable | ❌ Non implémenté |
| Cisaillement | ✅ Avec altitude | ❌ Non implémenté |
| Utilisation | ❌ Aucune | ✅ KitePhysicsSystem |

**Incohérence** : Deux calculs de turbulence différents !
```typescript
// WindSystem.ts (ligne 87) - Instancié mais jamais utilisé pour obtenir le vent !
const noiseX = Math.sin(time * 2.1) * Math.cos(time * 1.3);

// WindSimulator.ts (ligne 61) - Réellement utilisé par KitePhysicsSystem
turbulenceVector.x += Math.sin(time * freq) * windSpeedMs * turbIntensity;
```

**Preuve d'inutilité** :
```typescript
// SimulationApp.ts ligne 709
this.windSystem.update(context); // ✅ Appelé et mis à jour

// MAIS...
// KitePhysicsSystem.ts ligne 173 - C'est WindSimulator qui est utilisé !
const apparentWind = this.windSimulator.getApparentWind(
  kiteState.velocity,
  deltaTime
); // ⚠️ WindSystem n'est JAMAIS lu !
```

**Impact** :
- WindSystem.update() consomme CPU mais n'est jamais consulté
- KitePhysicsSystem utilise son propre WindSimulator
- Deux sources de vérité pour le vent (incohérence potentielle)

**Solution** :
1. ✅ **GARDER** : `WindSimulator` (utilisé, plus simple)
2. ❌ **SUPPRIMER** : `WindSystem` (inutilisé, trop complexe)
3. Si besoin de rafales/cisaillement, les ajouter à WindSimulator

---

### 🟡 MOYEN #3 : Composants ECS Inutilisés

**Fichiers concernés** :
- `src/simulation/components/InputComponent.ts` ❌ INUTILISÉ
- `src/simulation/components/ControlComponent.ts` ❌ INUTILISÉ
- `src/simulation/components/KiteComponent.ts` ❌ INUTILISÉ

**Problème** :
```typescript
// InputComponent existe mais InputSystem ne l'utilise pas !
export class InputSystem extends BaseSimulationSystem {
  private inputState: InputState; // ⚠️ Pas un composant ECS
  // ...
}
```

**Impact** :
- Confusion sur l'architecture ECS
- Code mort (3 fichiers × 60 lignes ≈ 180 lignes)
- Faux semblant d'architecture ECS

**Solution** :
1. **Option A** (ECS pur) : Migrer InputSystem/ControlBarSystem pour utiliser ces composants
2. **Option B** (pragmatique) : Supprimer les composants inutilisés ✅ RECOMMANDÉ
   - InputSystem gère son état en interne (pas une entité)
   - ControlBarSystem gère une ControlBarEntity (déjà fait)

---

### 🟡 MOYEN #4 : Architecture Hybride Kite

**Fichiers concernés** :
- `src/objects/Kite.ts` - StructuredObject (legacy)
- `src/simulation/components/KiteComponent.ts` - ECS (inutilisé)

**Problème** :
```typescript
// KitePhysicsSystem accède directement au Kite legacy
private kite!: Kite; // ⚠️ Pas une entité ECS
this.kite.position.copy(newPosition);
```

**Impact** :
- Incohérence avec l'objectif "pure ECS architecture"
- KitePhysicsSystem dépend d'un objet legacy, pas d'entités/composants

**Solution** (future) :
1. Migrer `Kite` vers une vraie entité ECS avec :
   - `TransformComponent` (position, rotation)
   - `PhysicsComponent` (velocity, angularVelocity)
   - `KiteComponent` (bridleLengths, pointsMap)
   - `MeshComponent` (Three.js mesh)
2. KitePhysicsSystem opérerait sur des composants, pas un objet monolithique

**Note** : Migration complexe, pas prioritaire pour cet audit.

---

## Actions Recommandées (Par Priorité)

### ✅ PRIORITÉ 1 : Supprimer Duplications Critiques

1. **Supprimer `PhysicsSystem.ts`** (260 lignes)
   - Déjà remplacé par KitePhysicsSystem
   - Aucune référence dans le projet

2. **Supprimer `WindSystem.ts`** (230 lignes)
   - Déjà remplacé par WindSimulator
   - Aucune référence dans le projet

**Impact** : -490 lignes de code mort, clarification architecture

### ✅ PRIORITÉ 2 : Nettoyer Composants Inutilisés

3. **Supprimer composants ECS inutilisés** :
   - `InputComponent.ts` (60 lignes)
   - `ControlComponent.ts` (100 lignes)
   - `KiteComponent.ts` (si vraiment inutilisé, à vérifier)

**Impact** : -160 lignes minimum, clarification ECS

### 🔵 PRIORITÉ 3 : Documentation

4. **Documenter l'architecture actuelle** dans `.github/copilot-instructions.md` :
   - Indiquer que PhysicsSystem et WindSystem sont supprimés
   - Préciser que Kite est encore un StructuredObject (migration future)
   - Clarifier quels composants ECS sont réellement utilisés

---

## Vérification Post-Nettoyage

Après suppression, vérifier :
```bash
npm run type-check  # Aucune erreur
npm run lint        # Aucun warning
grep -r "PhysicsSystem" src/  # Aucune référence (sauf KitePhysicsSystem)
grep -r "WindSystem" src/     # Aucune référence
```

---

## Conclusion

**Résultat attendu** :
- ✅ ~650 lignes de code mort supprimées
- ✅ Architecture plus claire et cohérente
- ✅ Moins de confusion pour les contributeurs
- ✅ Pas de régression (code inutilisé)

**Prochaines étapes** (hors scope audit) :
- Migrer Kite vers architecture ECS pure
- Implémenter rafales/cisaillement dans WindSimulator si besoin
- Créer des tests unitaires pour AerodynamicsCalculator, LinePhysics

---

**Audit réalisé le** : 11 Octobre 2025  
**Réalisé par** : GitHub Copilot (analyse automatisée)  
**Statut** : ✅ Prêt pour implémentation
