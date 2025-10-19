<!-- 
PAUSE RELECTURE - 19 OCTOBRE 2025
====================================

Commit AVANT nettoyage: 8146813
Message: "WIP: Bridles dynamiques et contraintes - avant nettoyage"

ÉTAT ACTUEL
===========

✅ Fonctionnel mais nécessite nettoyage complet
✅ Build passe (338 modules)
✅ Pas d'erreurs TypeScript

-->

# 📋 RELECTURE CODE - BRIDLES ET CONTRAINTES

## 1. FICHIERS MODIFIÉS/CRÉÉS

### ✅ CRÉÉS (Nouveaux)
- `src/ecs/entities/BridleFactory.ts` - Factory pour entités brides
- `src/ecs/systems/BridleConstraintSystem.ts` - Calcul positions CTRL via trilatération
- `src/ecs/systems/BridleRenderSystem.ts` - Affichage dynamique des brides

### 📝 MODIFIÉS
- `src/ecs/SimulationApp.ts` - Import BridleFactory, création entités brides
- `src/ecs/entities/index.ts` - Export BridleFactory
- `src/ecs/components/InputComponent.ts` - Propriétés bridleNez/Inter/Centre
- `src/ecs/systems/InputSyncSystem.ts` - Sync sliders vers BridleComponent
- `src/ecs/systems/GeometryRenderSystem.ts` - Désactivé double affichage brides
- `src/ecs/config/Config.ts` - Config bridles
- `src/ecs/config/UIConfig.ts` - UI sliders brides
- `index.html` - Ajout sliders HTML
- Et autres...

## 2. ARCHITECTURE NOUVELLE

```
Brides (Pyramide géométrique)
├─ Base: 3 points anatomiques (NEZ, INTER, CENTRE)
├─ Sommet: 2 points de contrôle (CTRL_GAUCHE, CTRL_DROIT)
└─ Arêtes: 6 lignes (3 par côté)

Workflow:
─────────
UI Slider → InputComponent → InputSyncSystem → BridleComponent
                                                    ↓
                                        BridleConstraintSystem (si changement)
                                            ↓ Trilatération 3D
                                        GeometryComponent (positions CTRL)
                                            ↓
                                        BridleRenderSystem
                                            ↓
                                        Entités bridles visibles
```

## 3. SYSTÈMES EN JEU

### BridleConstraintSystem (Priority 10)
**Purpose**: Calculer positions CTRL basées sur longueurs brides
**Exécution**: UNIQUEMENT quand longueurs changent (optimisé!)
**Input**: BridleComponent.lengths
**Output**: GeometryComponent positions (CTRL_GAUCHE, CTRL_DROIT)
**Algorithm**: Trilatération 3D + Gauss-Newton refinement

⚠️ À VÉRIFIER:
- [ ] Trilatération correcte mathématiquement?
- [ ] Gauss-Newton converge bien?
- [ ] Positions CTRL valides après calcul?

### BridleRenderSystem (Priority 56)
**Purpose**: Afficher les 6 brides visuellement
**Exécution**: Chaque frame
**Input**: GeometryComponent (positions locales), TransformComponent
**Output**: 6 entités bridles avec positions monde mises à jour
**Rendu**: LineBasicMaterial gris (0x333333)

⚠️ À VÉRIFIER:
- [ ] Positions converties correctement local→monde?
- [ ] Les 6 bridles s'affichent correctement?
- [ ] Performance acceptable?

### InputSyncSystem (Priority 5)
**Purpose**: Synchroniser changements UI vers composants
**Exécution**: Chaque frame (vérifie si changement)
**Methods**: updateBridleNez/Inter/Centre
**Input**: InputComponent.bridleXyz
**Output**: BridleComponent.lengths

⚠️ À VÉRIFIER:
- [ ] Les 3 sliders sont bien lus?
- [ ] Les valeurs sont bien propagées?
- [ ] Cache des "lastBridle*" fonctionne?

## 4. DONNÉES IMPORTANTES

### Config.ts
```typescript
bridles: {
  nez: 0.65,      // m
  inter: 0.65,    // m
  centre: 0.65    // m
}
```

### Entités bridles créées
- bridle-ctrl-gauche-nez
- bridle-ctrl-gauche-inter
- bridle-ctrl-gauche-centre
- bridle-ctrl-droit-nez
- bridle-ctrl-droit-inter
- bridle-ctrl-droit-centre

## 5. POINTS D'ATTENTION - À NETTOYER

### 🔴 CRITIQUE
- [ ] **Deux fois la même logique?** Vérifier GeometryRenderSystem.createKiteBridles/Markers (désactivé mais toujours présent)
- [ ] **BridleConstraintSystem peut planter?** Vérifier solveTrilateration() pour cas limites
- [ ] **Performance?** 6 entités bridles + BridleRenderSystem chaque frame

### 🟡 IMPORTANT
- [ ] **Commentaires JSDoc à ajouter** partout
- [ ] **Cas d'erreur non gérés** (positions nulles, distances négatives, etc)
- [ ] **Pas d'initialisation des bridles** - elles commencent à (0,0,0)
- [ ] **Console.log() à transformer en système de debug**
- [ ] **Types any à remplacer** (vérifier any casts)
- [ ] **Import unused?** À vérifier

### 🟢 À REVOIR
- [ ] Types générique (BridleLengths interface bien définie?)
- [ ] Noms de variables clairs? (ex: p1Local, p2World - ok mais peut être amélioré)
- [ ] Fichier BridleFactory.ts bien structuré?
- [ ] Pas de duplication code?

## 6. TESTS À FAIRE

### Visuels
- [ ] Les 6 brides s'affichent bien
- [ ] Pas de double affichage
- [ ] Pas de sphères rouges/vertes parasites
- [ ] Les brides bougent quand slider change

### Physique
- [ ] Kite se stabilise (pas d'oscillations infinies)
- [ ] Effet ressort des lignes fonctionne
- [ ] Damping fonctionne correctement

### Performance
- [ ] 60 FPS maintenu?
- [ ] Pas de lag en changeant sliders

### Edge cases
- [ ] Slider à min/max
- [ ] Changement rapide multiple sliders
- [ ] Slider lors vol simulé
- [ ] Reset simulation

## 7. STRUCTURE CODE À VÉRIFIER

BridleConstraintSystem.ts
- [ ] Import correct
- [ ] Priorité 10 ok?
- [ ] Cache lastLengths correct?
- [ ] Condition changeChanged bien codée?
- [ ] Method solveTrilateration() - logique valide?

BridleRenderSystem.ts
- [ ] Import correct
- [ ] Priorité 56 ok?
- [ ] Entités bridles bien récupérées?
- [ ] Transformation matrix correct?
- [ ] Pas de memory leak (disposal)?

BridleFactory.ts
- [ ] Factory pattern bien appliquée?
- [ ] Les 6 entités bien créées?
- [ ] VisualComponent bien configuré?

## 8. APRÈS NETTOYAGE - À FAIRE

- [ ] Générer commit "Cleanup: Bridles et contraintes nettoyées"
- [ ] Ajouter tests unitaires pour trilatération
- [ ] Documentation technique des brides
- [ ] Exemple d'utilisation des sliders dans README
- [ ] Possibilité futur: Animations bridles en debug mode?

