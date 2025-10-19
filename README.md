# Kite Simulator V8 🪁

Simulateur de cerf-volant delta basé sur la physique avec architecture **Entity-Component-System (ECS) pure**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.171-green.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg)](https://vitejs.dev/)
[![ECS](https://img.shields.io/badge/Architecture-ECS%20Pure-orange.svg)]()

---

## 🎯 Vue d'Ensemble

Ce projet est un simulateur de cerf-volant delta utilisant une **simulation physique réaliste** et une architecture logicielle moderne.

- **Physique Avancée** : Modèle aérodynamique (lift/drag), système de bridage complet, physique des lignes (tension, amortissement) et calcul du vent apparent.
- **Architecture ECS Pure** : Le code suit un pattern Entity-Component-System strict, garantissant une séparation nette entre les données (Components) et la logique (Systems) pour une meilleure maintenabilité et performance.
- **Stack Technique** : TypeScript, Three.js pour le rendu 3D et Vite pour un environnement de développement rapide.

L'objectif est d'obtenir une simulation stable, performante et physiquement cohérente, tout en maintenant un code propre et modulaire.

---

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+ et npm
- Git

### Installation
```bash
# 1. Cloner le dépôt
git clone <repository-url>
cd kite_v5

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```
Le simulateur est accessible sur **http://localhost:3001**. Le rechargement à chaud est activé.

### Commandes Utiles
```bash
npm run dev        # Lance le serveur de développement Vite
npm run build      # Build le projet pour la production
npm run type-check # Vérifie les types TypeScript sans compiler
npm run lint       # Analyse le code avec ESLint
npm run lint:fix   # Corrige automatiquement les problèmes de style
```

---

## 📁 Structure du Projet

La structure du projet reflète l'architecture ECS et la séparation des responsabilités.

```
kite_v5/
├── public/                  # Fichiers statiques
├── src/
│   ├── main.ts              # Point d'entrée principal
│   └── ecs/                 # Implémentation de l'architecture ECS pure
│       ├── SimulationApp.ts # Orchestrateur principal de la simulation
│       ├── components/      # Composants (données pures)
│       ├── core/            # Moteur ECS (Entity, Component, System)
│       ├── entities/        # Factories d'entités
│       └── systems/         # Systèmes (logique métier)
├── legacy/
│   └── ecs/                 # Ancienne implémentation ECS (archivée)
├── external/
│   └── makani-master/       # Code source de référence du projet Google Makani
└── index.html               # Fichier HTML principal
```

---

## 🏗️ Architecture ECS

L'architecture sépare strictement les concepts :
1.  **Entities** : Des identifiants uniques qui représentent des objets dans la simulation (ex: le cerf-volant, le pilote).
2.  **Components** : Des conteneurs de données pures, sans aucune logique (ex: `PositionComponent`, `PhysicsComponent`).
3.  **Systems** : La logique qui opère sur les entités possédant un certain ensemble de composants (ex: `PhysicsSystem`, `RenderSystem`).

Ce modèle facilite l'ajout de nouvelles fonctionnalités et le raisonnement sur le comportement du simulateur.

---

## 🔬 Intégration du Modèle Makani

Une partie de la recherche pour ce simulateur s'est basée sur le projet open-source **Makani** de Google, une référence en matière de modélisation de systèmes aéroportés.

- **Analyse Aérodynamique** : Les modèles de forces, de flexion de la structure et d'amortissement physique ont été étudiés et adaptés depuis Makani.
- **Validation Physique** : Le comportement de notre simulation est comparé aux données et algorithmes de Makani pour valider la justesse des calculs, notamment pour la tension dans les lignes et la réponse du cerf-volant au vent.

Cette intégration a permis d'améliorer significativement le réalisme de la simulation.

---

## 🛠️ Développement et Contribution

### Principes de Code
1.  **Code Propre** : Pas de "rustines". On refactorise pour maintenir la qualité.
2.  **ECS Pur** : Respecter la séparation données/logique. Les composants ne contiennent que des données.
3.  **TypeScript Strict** : Utiliser des types explicites et éviter `any`.
4.  **Nommage Explicite** : Les noms de variables et de fonctions doivent être clairs et descriptifs.

### Alias de Chemins
Utilisez les alias configurés dans `tsconfig.json` pour des imports propres :
```typescript
// ✅ Bien
import { Entity } from '@ecs/core';
import { TransformComponent } from '@ecs/components';

// ❌ Mal
import { Entity } from '../core/Entity';
```
- `@ecs/*` pointe vers les différents dossiers de `src/ecs/`.

---

## 📈 Statut du Projet

- ✅ **Migration ECS Pure Terminée** : L'ancienne architecture a été entièrement remplacée.
- ✅ **Base de Simulation Stable** : La physique de base et le rendu sont fonctionnels.
- 🎯 **En cours** : Optimisation des performances et ajout de comportements plus complexes (turbulences, interactions avancées).

---

**Dernière mise à jour** : 18 octobre 2025
