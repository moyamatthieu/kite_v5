# Kite Simulator V8 🪁

Simulateur de cerf-volant delta basé sur la physique avec architecture **Entity-Component-System (ECS) pure**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.160-green.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg)](https://vitejs.dev/)
[![ECS](https://img.shields.io/badge/Architecture-ECS%20Pure-orange.svg)]()

---

## 🎯 Vue d'Ensemble

Ce projet est un simulateur autonome de cerf-volant delta utilisant une **simulation physique réaliste** et une architecture logicielle moderne basée sur le pattern Entity-Component-System (ECS) pur.

### ✨ Caractéristiques principales

- **Physique Avancée** 
  - Modèle aérodynamique réaliste (portance, traînée, couple)
  - Système complet de bridles avec trilatération 3D
  - Physique des lignes (tension, amortissement)
  - Calcul du vent apparent dynamique
  - Support des modes de contrainte : Position-Based Dynamics (PBD) ou Spring-Force

- **Architecture ECS Pure**
  - Séparation stricte entre données (Components) et logique (Systems)
  - Chaque système opère sur les entités possédant les composants requis
  - Gestion centralisée des entités et des systèmes
  - Ordre d'exécution des systèmes défini et critique

- **Stack Technique Moderne**
  - TypeScript 5.3+ avec types stricts
  - Three.js 0.160 pour le rendu 3D
  - Vite 5.4 pour le développement rapide
  - ESLint pour la qualité du code

---

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+ et npm
- Git

### Installation et Lancement

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
npm run dev        # Lance le serveur Vite (rechargement à chaud)
npm run build      # Build optimisé pour la production (→ dist/)
npm run preview    # Prévisualise le build de production localement
npm run type-check # Vérifie les types TypeScript sans compiler
npm run lint       # Analyse le code avec ESLint
npm run lint:fix   # Corrige automatiquement les problèmes de style
```

---

## 📁 Structure du Projet

```
kite_v5/
├── src/
│   ├── main.ts                          # Point d'entrée (initialise SimulationApp)
│   └── ecs/
│       ├── SimulationApp.ts             # Orchestrateur principal
│       │   └── Gère : EntityManager, SystemManager, boucle de simulation
│       │
│       ├── core/
│       │   ├── Entity.ts                # Conteneur de composants
│       │   ├── Component.ts             # Interface de base pour les composants
│       │   ├── EntityManager.ts         # Registre central des entités
│       │   ├── System.ts                # Classe de base pour les systèmes
│       │   └── SystemManager.ts         # Gestionnaire de systèmes avec ordre d'exécution
│       │
│       ├── components/                  # 📦 Données pures (13 composants)
│       │   ├── TransformComponent.ts    # Position, rotation, échelle
│       │   ├── PhysicsComponent.ts      # Masse, vélocité, forces
│       │   ├── KiteComponent.ts         # Données spécifiques au kite
│       │   ├── BridleComponent.ts       # Longueurs des bridles
│       │   ├── LineComponent.ts         # Données des lignes de vol
│       │   ├── AerodynamicsComponent.ts # Coefficients aérodynamiques
│       │   ├── InputComponent.ts        # Entrées utilisateur
│       │   ├── GeometryComponent.ts     # Géométrie et points du kite
│       │   ├── PilotComponent.ts        # Données du pilote
│       │   ├── VisualComponent.ts       # Configuration visuelle
│       │   ├── MeshComponent.ts         # Référence au mesh Three.js
│       │   ├── DebugComponent.ts        # Données de debug
│       │   └── index.ts                 # Exports
│       │
│       ├── entities/                    # 🏭 Factories d'entités (8 factories)
│       │   ├── KiteFactory.ts           # Crée l'entité kite avec tous les composants
│       │   ├── LineFactory.ts           # Crée les lignes de vol (2 entités)
│       │   ├── ControlBarFactory.ts     # Crée la barre de contrôle
│       │   ├── BridleFactory.ts         # Crée les bridles (6 entités)
│       │   ├── PilotFactory.ts          # Crée l'entité pilote
│       │   ├── UIFactory.ts             # Crée l'UI
│       │   ├── DebugFactory.ts          # Crée les entités de debug
│       │   └── index.ts                 # Exports
│       │
│       ├── systems/                     # 🔧 Logique métier (18 systèmes)
│       │   ├── InputSystem.ts           # Capture les entrées utilisateur
│       │   ├── InputSyncSystem.ts       # Synchronise les entrées avec les composants
│       │   ├── WindSystem.ts            # Calcule le vent apparent
│       │   ├── AeroSystem.ts            # Calcule les forces aérodynamiques
│       │   ├── BridleConstraintSystem.ts# Gère les contraintes des bridles
│       │   ├── ConstraintSystem.ts      # Gère les contraintes des lignes
│       │   ├── PhysicsSystem.ts         # Intégration physique (Euler)
│       │   ├── PilotSystem.ts           # Logique du pilote
│       │   ├── RenderSystem.ts          # Initialise la scène Three.js
│       │   ├── GeometryRenderSystem.ts  # Affiche la géométrie du kite
│       │   ├── LineRenderSystem.ts      # Affiche les lignes de vol
│       │   ├── BridleRenderSystem.ts    # Affiche les bridles
│       │   ├── CameraControlsSystem.ts  # Caméra interactive
│       │   ├── EnvironmentSystem.ts     # Environnement (sol, ciel)
│       │   ├── UISystem.ts              # Interface utilisateur
│       │   ├── DebugSystem.ts           # Vecteurs et info debug
│       │   ├── LoggingSystem.ts         # Logging et monitoring
│       │   └── index.ts                 # Exports
│       │
│       ├── config/
│       │   ├── Config.ts                # Configuration centralisée (physique, initialisation, debug)
│       │   ├── KiteGeometry.ts          # Points et géométrie du kite delta
│       │   ├── KiteSurfaceDefinition.ts # Source unique de vérité pour les surfaces
│       │   └── Colors.ts                # Palette de couleurs
│       │
│       ├── utils/
│       │   ├── Logging.ts               # Système de logging structuré
│       │   ├── MathUtils.ts             # Utilitaires mathématiques
│       │   └── VectorUtils.ts           # Utilitaires pour vecteurs
│       │
│       └── index.html                   # Point d'entrée HTML
│
├── legacy/
│   └── ecs/                             # Ancienne architecture (archivée, non utilisée)
│
├── external/
│   └── makani-master/                   # Référence : code Google Makani
│
├── public/                              # Assets statiques
├── package.json
├── tsconfig.json
├── vite.config.ts
├── eslint.config.js
└── README.md                            # Ce fichier
```

---

## 🏗️ Architecture ECS Pure

L'architecture respecte strictement le pattern ECS :

### 1. **Entities** (`src/ecs/core/Entity.ts`)
- Identifiants uniques avec collection de composants
- Pas de logique métier, seulement gestion de composants
- Créées via des Factories dans `src/ecs/entities/`

### 2. **Components** (`src/ecs/components/`)
- **Données pures uniquement** (POJO)
- Pas de méthodes, pas de logique
- Chaque composant a un `type` unique pour les queries
- Sérialisable et modifiable par les systèmes

#### Exemples de composants

```typescript
// Données de position/rotation
TransformComponent { position, rotation, scale }

// Données physiques
PhysicsComponent { 
  mass, 
  velocity, 
  forces, 
  inertia, 
  damping 
}

// Entrées utilisateur
InputComponent { 
  isPaused, 
  leftRightInput, 
  upDownInput, 
  liftScale, 
  dragScale 
}
```

### 3. **Systems** (`src/ecs/systems/`)
- **Contiennent toute la logique métier**
- Opèrent sur les entités possédant des composants spécifiques
- Cycle de vie : `initialize()` → `update()` → `dispose()`
- Ordre d'exécution critique, défini dans `SimulationApp.ts`

#### Pipeline d'exécution typique

```
1. InputSystem              → Capture clavier/souris
2. InputSyncSystem          → Met à jour InputComponent
3. WindSystem               → Calcule vent apparent
4. AeroSystem               → Forces aérodynamiques
5. BridleConstraintSystem   → Contraintes bridles
6. ConstraintSystem         → Contraintes lignes
7. PhysicsSystem            → Intégration (position/rotation)
8. PilotSystem              → Logique du pilote
9. RenderSystem + Géométrie → Affichage
10. CameraControlsSystem    → Caméra
11. UISystem                → Interface
12. DebugSystem             → Debug visuel
13. LoggingSystem           → Stats
```

---

## 🔬 Physique et Modèle Aérodynamique

### Modèle Référence : Google Makani
Le modèle physique est fortement inspiré du projet **Makani** (`external/makani-master/`). Consultez ce code pour comprendre les algorithmes de calcul des forces.

### Systèmes Physiques Clés

#### **1. WindSystem** (`src/ecs/systems/WindSystem.ts`)
Calcule le vent apparent :
```
Vent_apparent = Vent_ambiant - Vitesse_kite + Turbulence
```
- Vent défini dans le plan horizontal XZ (Y = vertical)
- Direction : 0° = +X (Est), 90° = +Z (Sud), 180° = -X (Ouest), 270° = -Z (Nord)
- Synchronisation automatique avec `InputComponent` (vitesse, direction, turbulence via UI)

#### **2. AeroSystem** (`src/ecs/systems/AeroSystem.ts`)
Calcule les forces aérodynamiques :
- Portance (`CL = CL0 + CLAlpha × α`)
- Traînée (`CD = CD0 + CDquad × α²`)
- Couple de tangage
- Surfaces : 4 surfaces delta (nez haut/bas, droit haut/bas)

#### **3. BridleConstraintSystem** (`src/ecs/systems/BridleConstraintSystem.ts`)
Gère les bridles :
- **Trilatération 3D** pour calculer les positions CTRL
- Applique les contraintes de longueur
- Support de deux modes : `pbd` (géométrique) ou `spring-force` (physique)

#### **4. ConstraintSystem** (`src/ecs/systems/ConstraintSystem.ts`)
Gère les lignes de vol :
- Tension dans les lignes
- Amortissement visqueux
- Même modes de contrainte que les bridles

#### **5. PhysicsSystem** (`src/ecs/systems/PhysicsSystem.ts`)
Intégration physique :
- Intégrateur Euler explicite
- Mise à jour position : `p += v × dt`
- Mise à jour rotation : `ω += α × dt`
- Damping linéaire et angulaire

### Configuration Physique

Les paramètres physiques sont définis dans `src/ecs/config/Config.ts` :

```typescript
CONFIG = {
  kite: {
    mass: 0.12,           // kg
    wingspan: 1.65,       // m
    chord: 0.65,          // m
    surfaceArea: 0.54,    // m²
    inertia: {
      Ixx: 0.0315,        // kg⋅m² (pitch)
      Iyy: 0.0042,        // kg⋅m² (yaw)
      Izz: 0.0110         // kg⋅m² (roll)
    }
  },
  lines: {
    length: 15,           // m
    maxTension: 10,       // N
    constraintMode: 'spring-force' // ou 'pbd'
  },
  bridles: {
    nez: 0.65,            // m
    inter: 0.65,          // m
    centre: 0.65          // m
  },
  aero: {
    airDensity: 1.225,    // kg/m³
    CL0: 0.0,
    CLAlpha: 0.105,       // par degré
    CD0: 0.08,
    // ... plus de paramètres
  },
  wind: {
    speed: 12,            // m/s
    direction: 270,       // degrés
    turbulence: 0         // %
  }
}
```

---

## 🎨 Rendu 3D avec Three.js

Le rendu est géré par plusieurs systèmes :

### **RenderSystem**
- Initialise la scène Three.js
- Configure lumières, caméra, renderer
- Gère le context de rendu partagé

### **GeometryRenderSystem**
- Crée et met à jour la géométrie du kite
- Applique la transformation (position + rotation)
- Utilise `GeometryComponent` et `MeshComponent`

### **LineRenderSystem** et **BridleRenderSystem**
- Affichent les lignes et bridles avec des segments colorés
- Se mettent à jour en temps réel

### **DebugSystem**
- Affiche les vecteurs de force (vent, portance, traînée)
- Affiche les axes locaux du kite
- Affiche les points de contrôle

---

## 🛠️ Développement et Contribution

### Principes Strictes de Code

1. **ECS Pur** : Respecter la séparation données/logique
   - ✅ Les components sont des conteneurs de données pures
   - ✅ La logique réside UNIQUEMENT dans les systems
   - ❌ Ne JAMAIS ajouter de méthodes aux components

2. **TypeScript Strict** : Types explicites, pas de `any`
   ```typescript
   // ✅ BON
   function calculate(value: number): string { ... }
   
   // ❌ MAUVAIS
   function calculate(value: any): any { ... }
   ```

3. **Nommage Explicite** : Clarté avant concision
   ```typescript
   // ✅ BON
   const windApparentVelocity = new THREE.Vector3(...);
   
   // ❌ MAUVAIS
   const wav = new THREE.Vector3(...);
   ```

4. **Ordre des Systèmes** : CRITIQUE !
   - L'ordre d'exécution dans `SimulationApp.createSystems()` est critique
   - Respectez la dépendance : Entrées → Vent → Aéro → Contraintes → Physique → Rendu
   - Documentez toujours le numéro de priorité

### Alias de Chemins

Utilisez les alias configurés dans `vite.config.ts` :

```typescript
// ✅ BIEN
import { Entity } from '@ecs/core';
import { TransformComponent } from '@ecs/components';
import { PhysicsSystem } from '@ecs/systems';
import { CONFIG } from '@ecs/config';

// ❌ MAL
import { Entity } from '../../../core/Entity';
```

### Workflow Recommandé

1. **Lire les instructions** : Vérifier `.github/copilot-instructions.md`
2. **Structurer la réflexion** : Utiliser la pensée séquentielle pour les problèmes complexes
3. **Tester localement** : `npm run type-check && npm run lint`
4. **Valider le build** : `npm run build`

---

## 📊 Statut du Projet

### ✅ Réalisé

- [x] **Migration ECS Pure** : Architecture complètement migrée et stable
- [x] **Physique de Base** : Gravité, forces aérodynamiques, intégrateur Euler
- [x] **Système de Bridles** : Trilatération 3D fonctionnelle, positions CTRL calculées
- [x] **Système de Lignes** : Contraintes géométriques et physiques
- [x] **Rendu 3D** : Kite, lignes, bridles, environnement
- [x] **Contrôles Caméra** : OrbitControls interactifs
- [x] **Interface Utilisateur** : Contrôles pour le vent, paramètres physiques, pause/play
- [x] **System de Debug** : Vecteurs de force, info physiques

### 🎯 En cours

- [ ] Optimisation des performances (réduction des allocations)
- [ ] Tests et validation physique approfondie
- [ ] Turbulences réalistes
- [ ] Export/import de configurations

### 📋 Plateforme de Développement

- **Branches actives** :
  - `main` : Stable, prêt pour production
  - `develop` : Intégration des features
  - Branches de features : `feature/xxx`, `fix/xxx`, etc.

- **Branche courante** : `refactor-bridles` (optimisation des bridles et trilatération)

---

## 🎓 Ressources et Références

- **Google Makani** : `external/makani-master/` - Projet de référence pour la physique
- **TypeScript** : https://www.typescriptlang.org/
- **Three.js** : https://threejs.org/
- **Vite** : https://vitejs.dev/

---

## 📝 Conventions de Nommage

### Types et Interfaces
```typescript
type ComponentType<T extends Component> = T['type'];
interface SimulationContext { ... }
```

### Constantes
```typescript
const MAX_DELTA_TIME = 0.05;
const MS_TO_SECONDS = 1000;
```

### Méthodes Privées/Publiques
```typescript
// Public (interface)
update(context: SimulationContext): void { ... }

// Privé (détail d'implémentation)
private calculateAeroForces(): void { ... }
```

---

**Dernière mise à jour** : 20 octobre 2025  
**Branche actuelle** : refactor-bridles  
**Version** : 1.0.0
