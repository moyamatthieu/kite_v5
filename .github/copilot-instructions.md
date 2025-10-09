
# Kite Simulator - Instructions pour Agents IA

## Vue d'Ensemble du Dépôt

**Kite Simulator** est une simulation physique de cerf-volant autonome basée sur le web, construite avec TypeScript et Three.js. Elle simule une dynamique de vol de cerf-volant réaliste en utilisant un comportement émergent basé sur la physique—aucune animation scriptée.

## Modélisation du Comportement Aérodynamique et Cinématique d'une Aile de Kite

L'objet de cette analyse est de décrire le comportement cinématique et aérodynamique d'une aile de kite (ou voile de traction) modélisée comme une structure tridimensionnelle rigide.

### Structure et Déplacements Contraints

L'aile de kite est conceptualisée comme une entité non déformable, composée d'une ossature (les frames ou lattes) et de surfaces porteuses rigides. Sous l'effet des forces aérodynamiques générées par le vent, cette structure est mise en mouvement jusqu'à ce qu'elle atteigne les limites imposées par la géométrie du système de liaison avec le pilote.

Ces limites sont strictement définies par la longueur totale des lignes de vol et des brides (les lignes de connexion entre les lignes de vol et l'aile elle-même). Une fois cet allongement maximal atteint, le système de lignes et de brides est entièrement tendu, définissant la frontière de l'espace de vol accessible à l'aile.

### La Sphère de Vol et le Mouvement Latéral

L'aile est alors constamment plaquée contre cette frontière par la pression continue du vent. Géométriquement, l'espace de vol est donc une calotte sphérique dont le rayon R est égal à la somme de la longueur des lignes de vol et de celle des brides. L'aile évolue ainsi sur la surface de cette sphère de vol de rayon :

**R = Longueur des Lignes + Longueur des Brides**

L'effet aérodynamique fondamental est généré par l'inclinaison des surfaces de l'aile (son angle d'attaque et l'angle de site par rapport au vent). Cette inclinaison, conjuguée à la contrainte de distance maximale imposée par les lignes, génère une force latérale (composante propulsive ou de portance) qui ne peut se traduire que par un déplacement tangentiel sur la sphère de vol. L'aile se déplace ainsi dans son propre plan "vers l'avant" (perpendiculairement à la direction des lignes vers le pilote), décrivant un arc sur la surface de la sphère.

### Point d'Équilibre (Zénith)

Lorsque la barre de contrôle est relâchée ou maintenue en position neutre, le kite tend à trouver un point d'équilibre dynamique. Ce point correspond généralement au zénith de la sphère de vol (le point le plus haut par rapport au pilote, idéalement au-dessus de sa tête).

À ce point d'équilibre supérieur, l'inclinaison des surfaces portantes de l'aile par rapport au vent relatif (qui est alors plus horizontal) devient minimale, se rapprochant de l'horizontale (ou d'un angle d'attaque très faible). Par conséquent, la force aérodynamique totale et la pression du vent exercée sur ces surfaces diminuent drastiquement, permettant au kite de se stabiliser avec une traction minimale. C'est la position de "repos" ou de sécurité relative.

### Mécanisme de Direction par la Barre de Contrôle

L'action du pilote sur la barre n'est pas simplement une déviation, mais une modification asymétrique de la géométrie de l'aile.

**1. Déclenchement des virages**

Lorsque le pilote tire ou pousse sur un côté de la barre de contrôle (une action appelée "barre à droite" ou "barre à gauche"), il provoque une variation différentielle de la longueur des lignes arrière (lignes de direction) connectées aux extrémités (ou aux tips) de l'aile.

- Ligne déplacée en arrière : La ligne tire et déplace le CTRL correspondant en arrière.
- Ligne déplacée en avant : Simultanément, la ligne du côté opposé se déplace et déplace en avant le CTRL.

**2. Modification de l'Angle d'Attaque (Twist)**

Cette asymétrie de tension a pour effet de déplacer la structure dans l'espace 3D, provoquant une modification des forces sur les faces ce qui change l'équilibre et entraîne une rotation.

**3. Création d'un Couple Aérodynamique**

L'augmentation de l'angle d'attaque sur le côté tiré entraîne une augmentation significative des forces aérodynamiques générées sur cette demi-aile (principalement la force de portance).

L'aile génère plus de traction (portance et traînée induite) sur le côté où l'AOA est accru.

Cette dissymétrie de force entre les deux moitiés de l'aile crée un couple de rotation (ou moment de lacet) autour de son centre de gravité, forçant l'aile à pivoter sur la sphère de vol dans la direction du côté tiré.

**4. Conséquence Cinématique**

La rotation de l'aile réoriente son axe de vol. L'aile commence alors à se déplacer selon une trajectoire courbe sur la sphère de vol, obéissant à la nouvelle direction induite par l'asymétrie de portance. La vitesse et l'amplitude de ce virage dépendent directement de l'intensité de l'action sur la barre et de l'efficacité aérodynamique de l'aile.

**Faits clés :**
- Langage : TypeScript (modules ES), commentaires français/anglais coexistent
- Framework : Three.js v0.160.0 (version fixée—les changements d'API peuvent casser le code)
- Build : Serveur dev Vite sur http://localhost:3001
- Taille : ~30 fichiers source, architecture modulaire
- Physique : Position-Based Dynamics (PBD), comportement émergent uniquement

## Commandes Essentielles

**TOUJOURS exécuter `npm install` avant toute commande de build ou dev.**

```bash
npm install          # Installer les dépendances (TOUJOURS en premier)
npm run dev # Le serveur de développement est **déjà actif** en arrière-plan sur le port 3001. **NE PAS relancer** cette commande.
npm run build        # Builder le bundle de production
npm run preview      # Prévisualiser le build de production

```

**Notes :**
- Le serveur dev utilise le port 3001 (voir `vite.config.ts`)
- Vérifier la disponibilité : `curl http://localhost:3001` avant de démarrer une seconde instance
- Les avertissements de taille de bundle (>500KB) sont attendus à cause de Three.js

## Alias de Chemins (OBLIGATOIRE)

Configurés dans **à la fois** `vite.config.ts` et `tsconfig.json`. **Les casser cassera la plupart des imports.**

```typescript
@/*          → src/*
@core/*      → src/core/*
@base/*      → src/base/*
@objects/*   → src/objects/*
@factories/* → src/factories/*
@types       → src/types/index  // Note: pas de /* final
```

Toujours utiliser les alias dans les imports—jamais de chemins relatifs comme `../../types`.

## Vue d'Ensemble de l'Architecture

### Flux de Données (boucle de simulation 60 FPS)

```
main.ts
  └─> Simulation (SimulationApp.ts) — orchestrateur central
       ├─> PhysicsEngine.update(deltaTime, barRotation)
       │    ├─> ControlBarManager.setRotation() — rotation douce de la barre
       │    ├─> WindSimulator.getApparentWind() — vent + turbulence - vitesse du kite
       │    ├─> AerodynamicsCalculator.calculateForces() — portance/traînée/couple par surface
       │    ├─> LineSystem.calculateLineTensions() — valeurs de tension (affichage uniquement)
       │    ├─> BridleSystem.calculateBridleTensions() — tensions des brides (affichage uniquement)
       │    ├─> kite.updateBridleVisualization() — colorer les brides par tension
       │    ├─> KiteController.update() — intégrer forces → vitesse → position
       │    │    ├─> integratePhysics() — F=ma, T=Iα (lois de Newton)
       │    │    └─> ConstraintSolver.enforceLineConstraints() — longueur de ligne PBD
       │    │    └─> ConstraintSolver.enforceBridleConstraints() — longueur de bride PBD
       │    │    └─> ConstraintSolver.enforceGroundConstraint() — empêcher pénétration du sol
       │    └─> state.velocity modifiée par les contraintes (retour PBD)
       ├─> updateControlLines() — mises à jour visuelles des lignes
       ├─> RenderManager.render() — rendu Three.js
       └─> UIManager.update() — mises à jour du HUD (position, vitesse, tensions)
```

**Points critiques :**
- `PhysicsEngine.update()` orchestre toute la physique, appelée 60 fois/seconde
- **Les tensions sont uniquement pour l'affichage** — lignes/brides sont des contraintes PBD, pas des générateurs de force
- Les forces proviennent de : aérodynamique + gravité (lignes/brides contraignent seulement la géométrie)
- ConstraintSolver s'exécute APRÈS l'intégration des forces pour appliquer les contraintes de distance

### Abstractions Fondamentales

**Pattern StructuredObject** (voir `src/core/StructuredObject.ts`) :
- Tous les objets 3D étendent `StructuredObject` (qui étend `Node3D`)
- Doivent implémenter : `definePoints()`, `buildStructure()`, `buildSurfaces()`
- Utilise des **points anatomiques nommés** (ex: "tip", "center", "left_wing") pour le positionnement
- Points stockés dans `Map<string, THREE.Vector3>`, accessibles via `getPoint(name)`
- Exemple : `src/objects/organic/Kite.ts` définit 12 points anatomiques

**Node3D** (`src/core/Node3D.ts`) :
- Abstraction compatible Godot sur `THREE.Group`
- Fournit une structure arborescente et des hooks de cycle de vie

**Pattern Factory** :
- `FrameFactory` : Crée des structures rigides (cylindres entre points nommés)
- `SurfaceFactory` : Crée des matériaux et maillages
- `LineFactory` : Crée des instances de lignes physiques (utilisé par LineSystem)
- `BridleFactory` : Crée 6 instances de lignes de bride (3 gauches + 3 droites)
- `PointFactory` : Calcule tous les points anatomiques du kite incluant les points d'attache des brides
- Les factories préservent les conventions de nommage et la création cohérente d'objets

### Structure des Modules

```
src/
├── main.ts                    # Point d'entrée de l'application
├── simulation.ts              # Shim de compatibilité → SimulationApp
├── core/                      # Classes fondamentales (Node3D, StructuredObject, Primitive)
├── base/                      # Patterns BaseFactory
├── factories/                 # Création d'objets (Frame, Surface, Line, Point, Bridle)
├── objects/
│   ├── organic/Kite.ts        # Modèle 3D principal du kite (exemple StructuredObject)
│   └── mechanical/Line.ts     # Entité ligne (données pures, pas de logique)
├── simulation/
│   ├── SimulationApp.ts       # Orchestrateur principal (FICHIER CRITIQUE)
│   ├── physics/               # PhysicsEngine, WindSimulator, LineSystem, BridleSystem,
│   │                          # LinePhysics, AerodynamicsCalculator, ConstraintSolver
│   ├── controllers/           # KiteController, ControlBarManager, InputHandler
│   ├── rendering/             # RenderManager, DebugRenderer
│   ├── config/                # SimulationConfig, PhysicsConstants, KiteGeometry
│   ├── ui/                    # UIManager
│   └── types/                 # WindTypes, PhysicsTypes, BridleTypes
└── types/index.ts             # TYPES CENTRALISÉS (les changements ont un impact large)
```

## Règles Critiques de Développement

### 1. Standards de Code Propre (Tels qu'Appliqués Ici)

1. **Un seul niveau d'indentation** par fonction dans la mesure du possible—préférer les retours anticipés
2. **Éviter `else`** quand une clause de garde suffit
3. **Encapsuler les primitives du domaine** dans de petites classes/types (exception : math/coords Three.js)
4. **Noms descriptifs**, éviter les abréviations (sauf noms courts Three.js courants comme `pos`, `rot`)
5. **Petites micro-classes** avec responsabilité unique (voir `Line.ts` comme objet de données pures)

### 2. Pensée Séquentielle pour Tâches Non-Triviales (REQUIS)

- Décomposer les tâches, former des hypothèses, vérifier, itérer

## Fichiers Critiques & Dépendances

**Fichiers nécessitant une attention particulière :**
- `src/simulation/SimulationApp.ts` — les changements affectent toute l'application (orchestrateur central)
- `src/simulation/physics/PhysicsEngine.ts` — cœur de la boucle physique, tous les sous-systèmes y sont connectés
- `src/types/index.ts` — les changements de types globaux ont un impact large
- `vite.config.ts` & `tsconfig.json` — garder les alias de chemins synchronisés
- `src/core/StructuredObject.ts` — classe de base pour tous les objets 3D

## Contrôles

- **Touches Fléchées ↑↓** : Tourner la barre de contrôle (interpolation douce)
- **Souris** : Orbiter la caméra autour de la scène
- **R** : Réinitialiser la simulation à l'état initial
- **Curseurs UI** : Ajuster les longueurs de brides en temps réel (NEZ: 0.30-0.80m, INTER/CENTRE: 0.30-0.80m)

## Travaux Récents & Contexte Technique

**Branche actuelle :** `feature/tension-forces-physics` (implémentation de la physique des brides)
**Dernière fusion :** Brides implémentées comme 6 lignes physiques (contraintes PBD)
- Voir `docs/BRIDLES_AS_LINES_DESIGN.md`
- Nouveau : `BridleSystem.ts`, `BridleTypes.ts` dans `src/simulation/physics/`
- Chaque bride est une instance `Line` avec son propre calcul de tension
- **BridleFactory** crée les brides avec les bons paramètres physiques (longueur, rigidité, amortissement)
- **ConstraintSolver.enforceBridleConstraints()** applique les 6 contraintes de distance des brides
- Tensions des brides calculées pour la visualisation uniquement (colorées par tension)

**Correction récente :** Calcul de surface corrigé (Oct 2025)
- Précédent : valeurs codées en dur (0.68 m² total, 47% d'erreur sur les triangles supérieurs)
- Actuel : `KiteGeometry.calculateTriangleArea()` calcule les surfaces exactes à partir des sommets
- Nouveau total : 0.5288 m² (réduction de 22% par rapport aux valeurs incorrectes)
- Impact : Les forces aérodynamiques sont maintenant physiquement précises
- Voir `CHANGELOG_surfaces.md` pour les détails de validation
- Tâches de développement actuelles et checklist de tests

**Rôle des brides** : Elles sont un **système d'ajustement d'angle**, PAS des éléments porteurs !

Comme les câbles qui ajustent l'angle d'une voile de bateau : elles ne portent pas la charge, elles **orientent** la surface pour recevoir le vent correctement.

**Modification des longueurs de brides** :
```
Brides plus courtes → CTRL plus proche de NEZ → Angle d'attaque plus bas → Moins de portance
Brides plus longues → CTRL plus loin de NEZ → Angle d'attaque plus élevé → Plus de portance
```

**Critique** : Les brides ne TIRENT PAS, elles RETIENNENT à distance maximale. L'équilibre dépend de la **géométrie imposée** par les brides (qui détermine l'angle d'attaque), pas des forces internes.

**Mettre à jour ce fichier** si vous modifiez l'architecture, les conventions ou les workflows majeurs.



