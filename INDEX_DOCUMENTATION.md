# 📚 Index des Documents d'Architecture

## Documents d'Analyse - 11 Janvier 2025

### 🎯 Pour Commencer (Lecture Rapide - 5 min)
**[REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)** - Résumé Exécutif  
- Problème principal : SimulationApp.ts trop long (781 lignes)
- Solution proposée : Entity Factories
- Impact estimé : -42% lignes
- Plan en 5 phases (30 min à 3h selon ambition)
- **👉 COMMENCER ICI si temps limité**

---

### 📊 Pour Comprendre en Détail (Lecture Complète - 15 min)
**[ARCHITECTURE_IMPROVEMENTS_2025-01-11.md](./ARCHITECTURE_IMPROVEMENTS_2025-01-11.md)** - Analyse Complète  
- Analyse détaillée des 781 lignes de SimulationApp.ts
- Exemple complet : ControlBarEntityFactory
- Implémentation code complète (130 lignes → 15 lignes)
- Plan d'implémentation progressif (5 phases)
- Checklist de migration
- Améliorations additionnelles (Entity IDs typés, Config validation, etc.)
- Principes SOLID appliqués

---

### 🎨 Pour Visualiser (Lecture Visuelle - 10 min)
**[ARCHITECTURE_VISUAL.md](./ARCHITECTURE_VISUAL.md)** - Diagrammes & Comparaisons  
- Diagrammes avant/après
- Flux de création d'entité visuel
- Métriques (taille, complexité, testabilité)
- Patterns appliqués
- Courbe d'évolution projet
- Code avant/après côte à côte
- **👉 UTILE pour présentation visuelle**

---

## Documents de Contexte (Historique)

### Nettoyage Architecture (11 Octobre 2025)
**[ARCHITECTURE_CLEANUP_SUMMARY.md](./ARCHITECTURE_CLEANUP_SUMMARY.md)**  
- Suppression PhysicsSystem.ts (unused)
- Suppression WindSystem.ts (unused)
- Suppression InputComponent.ts & ControlComponent.ts (unused)
- -650 lignes de code mort éliminées

**[ARCHITECTURE_AUDIT_2025-10-11.md](./ARCHITECTURE_AUDIT_2025-10-11.md)**  
- Audit complet des duplications
- Identification code mort
- Recommandations appliquées

---

### Diagnostics Lignes de Contrôle (11 Octobre 2025)
**[DIAGNOSTIC_LIGNES.md](./DIAGNOSTIC_LIGNES.md)**  
- Investigation lignes invisibles
- Calcul géométrique (rayon 0.015m → 0.043° angle)
- Diagnostic problème initialisation

**[CORRECTION_LIGNES.md](./CORRECTION_LIGNES.md)**  
- Corrections appliquées (tubeRadius 0.08m → 0.005m)
- Fix timing initialization (createLineEntities déplacé)
- Résolution warning "kite ou controlBarSystem manquant"

---

## Documentation Technique

### Architecture Générale
**[.github/copilot-instructions.md](./.github/copilot-instructions.md)**  
- Vue d'ensemble architecture ECS
- Commandes développement
- Structure projet
- Patterns et principes
- **👉 SOURCE DE VÉRITÉ pour architecture globale**

---

### Modèle Physique
**[PHYSICS_MODEL.md](./PHYSICS_MODEL.md)**  
- Modèle physique kite
- Aérodynamique
- Contraintes (lignes, brides)
- Position-Based Dynamics
- **👉 Référence pour comprendre physique simulation**

---

## Navigation Rapide par Objectif

### 🎯 "Je veux refactoriser SimulationApp.ts"
1. Lire **[REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)** (5 min)
2. Consulter **[ARCHITECTURE_VISUAL.md](./ARCHITECTURE_VISUAL.md)** (exemples visuels)
3. Suivre **Phase 1** de **[ARCHITECTURE_IMPROVEMENTS_2025-01-11.md](./ARCHITECTURE_IMPROVEMENTS_2025-01-11.md)**

---

### 📚 "Je veux comprendre l'architecture complète"
1. Lire **[.github/copilot-instructions.md](./.github/copilot-instructions.md)**
2. Lire **[ARCHITECTURE_IMPROVEMENTS_2025-01-11.md](./ARCHITECTURE_IMPROVEMENTS_2025-01-11.md)**
3. Consulter **[PHYSICS_MODEL.md](./PHYSICS_MODEL.md)** pour physique

---

### 🐛 "Je debug un problème"
1. **Lignes invisibles** → **[DIAGNOSTIC_LIGNES.md](./DIAGNOSTIC_LIGNES.md)** + **[CORRECTION_LIGNES.md](./CORRECTION_LIGNES.md)**
2. **Code dupliqué** → **[ARCHITECTURE_AUDIT_2025-10-11.md](./ARCHITECTURE_AUDIT_2025-10-11.md)**
3. **Physique** → **[PHYSICS_MODEL.md](./PHYSICS_MODEL.md)**

---

### 🔍 "Je cherche du code mort ou des duplications"
1. Lire **[ARCHITECTURE_AUDIT_2025-10-11.md](./ARCHITECTURE_AUDIT_2025-10-11.md)**
2. Consulter **[ARCHITECTURE_CLEANUP_SUMMARY.md](./ARCHITECTURE_CLEANUP_SUMMARY.md)** (déjà fait)

---

### ✅ "Je veux valider l'architecture actuelle"
- **État actuel** : ECS pur en cours de migration
- **Systèmes migrés** : ControlBar, Lines, Pilot (✅)
- **Systèmes legacy** : Kite (StructuredObject, en cours)
- **Code propre** : 0 erreurs TypeScript, PhysicsSystem/WindSystem supprimés
- **Prochain objectif** : Refactor SimulationApp.ts (voir REFACTOR_SUMMARY.md)

---

## Chronologie des Modifications

```
2025-01-11 : Analyse architecture & proposition refactor
  ├─ ARCHITECTURE_IMPROVEMENTS_2025-01-11.md (analyse complète)
  ├─ REFACTOR_SUMMARY.md (résumé exécutif)
  ├─ ARCHITECTURE_VISUAL.md (visualisations)
  └─ INDEX_DOCUMENTATION.md (ce fichier)

2025-10-11 : Nettoyage architecture
  ├─ ARCHITECTURE_AUDIT_2025-10-11.md (audit)
  ├─ ARCHITECTURE_CLEANUP_SUMMARY.md (cleanup)
  ├─ DIAGNOSTIC_LIGNES.md (investigation)
  └─ CORRECTION_LIGNES.md (corrections)

Historique :
  - Migration ECS progressive (2024-2025)
  - Documentation physique (PHYSICS_MODEL.md)
  - Instructions Copilot (.github/copilot-instructions.md)
```

---

## Statut Actuel du Projet

### ✅ Complété
- [x] Architecture ECS de base
- [x] Migration ControlBarSystem (ECS pur)
- [x] Migration LinesRenderSystem (ECS pur)
- [x] Migration PilotSystem (ECS pur)
- [x] Suppression code mort (PhysicsSystem, WindSystem, Components unused)
- [x] Correction lignes invisibles (tubeRadius, timing initialization)
- [x] 0 erreurs TypeScript

### 🔄 En Cours
- [ ] Migration complète Kite vers ECS pur (actuellement StructuredObject)
- [ ] Refactor SimulationApp.ts (781 lignes → ~450 lignes) ← **RECOMMANDÉ**

### 📋 Planifié
- [ ] Entity Factories (Phase 1-4, voir REFACTOR_SUMMARY.md)
- [ ] Debug visualization réactivée (TODOs actuels)
- [ ] Tests unitaires pour factories
- [ ] Documentation patterns Entity Factories

---

## Contact & Contribution

### Avant de Modifier l'Architecture
1. Lire **[.github/copilot-instructions.md](./.github/copilot-instructions.md)**
2. Suivre principe **"Progressive, incremental refactoring"**
3. Valider avec `npm run type-check` après chaque changement
4. Tester manuellement dans le navigateur
5. Commit atomique avec message descriptif

### Questions Fréquentes
- **"SimulationApp.ts est trop long, que faire ?"**  
  → Lire **[REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)**, commencer Phase 1 (30 min)

- **"Où ajouter une nouvelle entité ?"**  
  → Créer factory dans `src/simulation/factories/` (pattern existant)

- **"Comment tester l'architecture ?"**  
  → `npm run type-check`, `npm run lint`, test manuel navigateur

---

**Dernière mise à jour :** 11 Janvier 2025  
**Mainteneur :** Équipe Kite Simulator V8  
**Licence :** Voir LICENSE
