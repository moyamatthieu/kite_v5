# 🧹 PLAN DE NETTOYAGE - BRIDLES ET CONTRAINTES

**Date**: 19 octobre 2025  
**Commit de départ**: 8146813  
**Branche**: ecs-pure-rewrite

## 📋 CHECKLIST DE NETTOYAGE

### Phase 1: AUDIT CODE (À faire maintenant)

- [ ] **BridleConstraintSystem.ts**
  - [ ] Vérifier imports (types corrects?)
  - [ ] Vérifier cache lastLengths initialization
  - [ ] Vérifier condition de changement
  - [ ] Vérifier solveTrilateration() pour cas limites
  - [ ] Ajouter JSDoc complète
  - [ ] Vérifier pas de console.log en debug

- [ ] **BridleRenderSystem.ts**
  - [ ] Vérifier imports
  - [ ] Vérifier création entités bridles
  - [ ] Vérifier transformation matrix
  - [ ] Vérifier pas de memory leaks
  - [ ] Ajouter JSDoc complète

- [ ] **BridleFactory.ts**
  - [ ] Vérifier factory pattern
  - [ ] Vérifier 6 entités bien créées
  - [ ] Ajouter JSDoc complète
  - [ ] Vérifier noms d'ID cohérents

- [ ] **InputSyncSystem.ts**
  - [ ] Vérifier 3 méthodes updateBridleXyz
  - [ ] Vérifier pas d'erreurs de type
  - [ ] Ajouter logging cohérent

- [ ] **SimulationApp.ts**
  - [ ] Vérifier import BridleFactory
  - [ ] Vérifier création bridles au bon endroit
  - [ ] Vérifier entités bien enregistrées

- [ ] **GeometryRenderSystem.ts**
  - [ ] Vérifier createKiteBridles() et createControlPointMarkers() bien désactivées
  - [ ] Vérifier pas d'appels fantômes

### Phase 2: REFACTORING

- [ ] **Types génériques**
  - [ ] BridleLengths interface bien définie?
  - [ ] Utiliser partout où nécessaire

- [ ] **Noms de variables**
  - [ ] p1Local, p2Local → peut être plus explicite?
  - [ ] bridleConnections → structure claire?
  - [ ] lastLengths → bien nommé?

- [ ] **Éliminer la duplication**
  - [ ] createKiteBridles() et BridleRenderSystem - vraiment similaire?
  - [ ] updateBridleNez/Inter/Centre - peut être une seule méthode?

- [ ] **Error handling**
  - [ ] Null checks partout?
  - [ ] Cas limites trilatération?
  - [ ] Division par zéro?

### Phase 3: DOCUMENTATION

- [ ] **JSDoc complète**
  - [ ] BridleConstraintSystem: expliquer trilatération
  - [ ] BridleRenderSystem: expliquer workflow
  - [ ] BridleFactory: expliquer structure

- [ ] **Commentaires explicatifs**
  - [ ] Trilatération 3D algorithm
  - [ ] Pourquoi Priority 10?
  - [ ] Pourquoi pas à chaque frame?

- [ ] **README update**
  - [ ] Expliquer sliders brides
  - [ ] Expliquer pyramide géométrique
  - [ ] Expliquer workflow complet

### Phase 4: TESTING

- [ ] **Tests visuels**
  - [ ] 6 brides affichées?
  - [ ] Pas de double affichage?
  - [ ] Brides bougent avec sliders?

- [ ] **Tests physique**
  - [ ] Stabilité kite?
  - [ ] Pas d'oscillations?
  - [ ] Damping fonctionne?

- [ ] **Tests edge cases**
  - [ ] Sliders à min/max?
  - [ ] Changements rapides?
  - [ ] Reset simulation?

### Phase 5: COMMIT FINAL

- [ ] Tous les points des Phase 1-4 cochés
- [ ] Build passe sans warning
- [ ] Pas de console.log en production
- [ ] Faire commit "Cleanup: Bridles et contraintes nettoyées et documentées"

## 📊 PROGRESSION

```
État actuel: PRÉ-NETTOYAGE ████░░░░░░░░░░░░░░ 20%

À faire:
- Audit code: ████░░░░░░░░░░░░░░ 
- Refactoring: ░░░░░░░░░░░░░░░░░░░░
- Documentation: ░░░░░░░░░░░░░░░░░░░░
- Testing: ░░░░░░░░░░░░░░░░░░░░
- Commit final: ░░░░░░░░░░░░░░░░░░░░
```

## 🎯 OBJECTIF FINAL

Que le code soit:
- ✅ **Propre**: Pas de duplication, noms clairs
- ✅ **Documenté**: JSDoc, commentaires explicatifs
- ✅ **Robuste**: Error handling, cas limites
- ✅ **Performant**: Pas de memory leaks, optimisé
- ✅ **Testé**: Visuels et physique vérifiés
- ✅ **Maintenable**: Prêt pour l'intégration

