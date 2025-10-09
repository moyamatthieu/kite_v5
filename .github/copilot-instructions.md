# Kite Simulator - Instructions pour Agents IA

## Vue d'Ensemble du Dépôt

**Kite Simulator V8** est une simulation physique de cerf-volant autonome basée sur le web, construite avec TypeScript et Three.js. Elle simule une dynamique de vol de cerf-volant réaliste en utilisant un comportement émergent basé sur la physique—aucune animation scriptée. **Architecture ECS-inspired** avec systèmes modulaires (Physics, Wind, Input, Render).

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
- Taille : ~30 fichiers source, architecture ECS-inspired modulaire
- Physique : Position-Based Dynamics (PBD), comportement émergent uniquement

## Commandes Essentielles

**TOUJOURS exécuter `npm install` avant toute commande de build ou dev.**

```bash
npm install          # Installer les dépendances (TOUJOURS en premier)
npm run dev          # Serveur de développement Vite sur http://localhost:3001
npm run build        # Builder le bundle de production
npm run preview      # Prévisualiser le build de production
npm run type-check   # Vérification des types TypeScript
npm run lint         # Linter les fichiers TypeScript
npm run lint:fix     # Auto-corriger les problèmes de linting
npm run test-ecs     # Tester l'intégration ECS
npm run validate-migration # Valider la migration vers ECS
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

## Vue d'Ensemble de l'Architecture ECS-Inspired

### Flux de Données (boucle de simulation 60 FPS)

```
main.ts
  └─> SimulationApp (SimulationApp.ts) — orchestrateur ECS central
       ├─> PhysicsSystem.update() — forces, contraintes PBD, intégration physique
       │    ├─> WindSystem.getApparentWind() — vent + turbulence - vitesse du kite
       │    ├─> AerodynamicsCalculator.calculateForces() — portance/traînée/couple par surface
       │    ├─> LineSystem.calculateLineTensions() — valeurs de tension (affichage uniquement)
       │    ├─> BridleSystem.calculateBridleTensions() — tensions des brides (affichage uniquement)
       │    ├─> kite.updateBridleVisualization() — colorer les brides par tension
       │    └─> ConstraintSolver.enforceConstraints() — PBD pour lignes/brides/ground
       ├─> InputSystem.update() — contrôles lissés de la barre
       ├─> RenderSystem.render() — rendu Three.js optimisé
       └─> UIManager.update() — mises à jour du HUD
```

**Configuration ECS :**
```typescript
const sim = new SimulationApp({
  enableLegacyComponents: false, // Mode ECS pur recommandé
  enableRenderSystem: true,      // Rendu 3D activé
  physics: { gravityEnabled: true, airResistanceEnabled: true },
  wind: { baseSpeed: 8.0, turbulenceEnabled: true }
});
```

**Points critiques :**
- `SimulationApp.ts` orchestre tous les systèmes ECS, appelé 60 fois/seconde
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

**Systèmes ECS** (`src/simulation/systems/`) :
- `PhysicsSystem` : Gestion des forces, contraintes PBD, intégration physique
- `WindSystem` : Simulation du vent avec turbulence
- `InputSystem` : Gestion des contrôles utilisateur (barre, souris)
- `RenderSystem` : Rendu Three.js et gestion de scène

### Structure des Modules

```
src/
├── main.ts                    # Point d'entrée de l'application
├── simulation.ts              # Shim de compatibilité → SimulationApp
├── core/                      # Classes fondamentales (Node3D, StructuredObject, Primitive)
├── base/                      # Patterns BaseFactory, BaseSimulationSystem
├── factories/                 # Création d'objets (Frame, Surface, Line, Point, Bridle)
├── objects/
│   ├── organic/Kite.ts        # Modèle 3D principal du kite (exemple StructuredObject)
│   └── mechanical/Line.ts     # Entité ligne (données pures, pas de logique)
├── simulation/
│   ├── SimulationApp.ts       # Orchestrateur ECS principal (FICHIER CRITIQUE)
│   ├── systems/               # Systèmes ECS modulaires (Physics, Wind, Input, Render)
│   ├── physics/               # Sous-systèmes physiques (AerodynamicsCalculator, ConstraintSolver)
│   ├── controllers/           # Contrôleurs (KiteController, ControlBarManager)
│   ├── rendering/             # Rendu (RenderManager, DebugRenderer)
│   ├── config/                # Configuration (SimulationConfig, PhysicsConstants, KiteGeometry)
│   ├── ui/                    # Interface utilisateur (UIManager)
│   └── types/                 # Types spécialisés (WindTypes, PhysicsTypes, BridleTypes)
└── types/index.ts             # TYPES CENTRALISÉS (les changements ont un impact large)
```

## Règles Critiques de Développement

### 1. Standards de Code Propre (Tels qu'Appliqués Ici)

1. **Un seul niveau d'indentation** par fonction dans la mesure du possible—préférer les retours anticipés
2. **Éviter `else`** quand une clause de garde suffit
3. **Encapsuler les primitives du domaine** dans de petites classes/types (exception : math/coords Three.js)
4. **Noms descriptifs**, éviter les abréviations (sauf noms courts Three.js courants comme `pos`, `rot`)
5. **Petites micro-classes** avec responsabilité unique (voir `Line.ts` comme objet de données pures)

### 2. Architecture ECS

- **Séparation claire** : Chaque système ECS gère un aspect spécifique (physique, vent, entrée, rendu)
- **Communication via contexte** : Les systèmes communiquent via un `SimulationContext` partagé
- **Configuration flexible** : Possibilité d'activer/désactiver les composants legacy pour compatibilité
- **Modularité** : Ajout/suppression de systèmes sans casser l'architecture

### 3. Pensée Séquentielle pour Tâches Non-Triviales (REQUIS)

- Décomposer les tâches, former des hypothèses, vérifier, itérer

## Fichiers Critiques & Dépendances

**Fichiers nécessitant une attention particulière :**
- `src/simulation/SimulationApp.ts` — orchestrateur ECS central, tous les systèmes y sont connectés
- `src/simulation/systems/PhysicsSystem.ts` — cœur de la physique ECS
- `src/types/index.ts` — types globaux, changements ont impact large
- `vite.config.ts` & `tsconfig.json` — alias de chemins doivent rester synchronisés
- `src/core/StructuredObject.ts` — classe de base pour tous les objets 3D
- `src/objects/organic/Kite.ts` — géométrie du kite et points anatomiques

## Contrôles

- **Touches Fléchées ↑↓** : Tourner la barre de contrôle (interpolation douce)
- **Souris** : Orbiter la caméra autour de la scène
- **R** : Réinitialiser la simulation à l'état initial
- **Curseurs UI** : Ajuster les longueurs de brides en temps réel (NEZ: 0.30-0.80m, INTER/CENTRE: 0.30-0.80m)

## Travaux Récents & Contexte Technique

**Branche actuelle :** `refactor/code-cleanup` (refactorisation générale et nettoyage du code)
**Dernière fusion :** Migration complète vers architecture ECS réussie (Phase 5 terminée)

**Architecture ECS implémentée :**
- ✅ Systèmes modulaires : PhysicsSystem, WindSystem, InputSystem, RenderSystem
- ✅ Orchestrateur central : SimulationApp.ts avec configuration flexible
- ✅ Compatibilité backward : Mode hybride ECS/legacy disponible
- ✅ Performance : 61 FPS en simulation, build 518KB (gzipped: 132KB)

**Correction récente :** Calcul de surface corrigé (Oct 2025)
- Précédent : valeurs codées en dur (0.68 m² total, 47% d'erreur sur les triangles supérieurs)
- Actuel : `KiteGeometry.calculateTriangleArea()` calcule les surfaces exactes à partir des sommets
- Nouveau total : 0.5288 m² (réduction de 22% par rapport aux valeurs incorrectes)
- Impact : Les forces aérodynamiques sont maintenant physiquement précises
- Voir `CHANGELOG_surfaces.md` pour les détails de validation

**Rôle des brides** : Elles sont un **système d'ajustement d'angle**, PAS des éléments porteurs !

Comme les câbles qui ajustent l'angle d'une voile de bateau : elles ne portent pas la charge, elles **orientent** la surface pour recevoir le vent correctement.

**Modification des longueurs de brides** :
```
Brides plus courtes → CTRL plus proche de NEZ → Angle d'attaque plus bas → Moins de portance
Brides plus longues → CTRL plus loin de NEZ → Angle d'attaque plus élevé → Plus de portance
```

**Critique** : Les brides ne TIRENT PAS, elles RETIENNENT à distance maximale. L'équilibre dépend de la **géométrie imposée** par les brides (qui détermine l'angle d'attaque), pas des forces internes.

**Mettre à jour ce fichier** si vous modifiez l'architecture, les conventions ou les workflows majeurs.

## Guides d'Ingénierie de Prompts pour Grok Code Fast 1

Pour les développeurs utilisant des outils de codage agentiques

grok-code-fast-1 est un modèle agentique léger conçu pour exceller en tant que pair-programmeur dans la plupart des outils de codage courants. Pour optimiser votre expérience, nous présentons quelques directives afin que vous puissiez accélérer vos tâches de codage quotidiennes.

### Fournir le contexte nécessaire

La plupart des outils de codage rassemblent le contexte nécessaire pour vous. Cependant, il est souvent préférable d'être spécifique en sélectionnant le code spécifique que vous souhaitez utiliser comme contexte. Cela permet à grok-code-fast-1 de se concentrer sur votre tâche et d'éviter les déviations inutiles. Essayez de spécifier les chemins de fichiers pertinents, les structures de projet ou les dépendances, et évitez de fournir un contexte non pertinent.

**Invite sans contexte à éviter**
Améliorer la gestion des erreurs

**Bonne invite avec contexte spécifié**
Mes codes d'erreur sont définis dans @errors.ts, pouvez-vous utiliser cela comme référence pour ajouter une gestion d'erreur appropriée et des codes d'erreur à @sql.ts où je fais des requêtes

### Définir des objectifs et exigences explicites

Définissez clairement vos objectifs et le problème spécifique que vous voulez que grok-code-fast-1 résolve. Les requêtes détaillées et concrètes peuvent mener à de meilleures performances. Essayez d'éviter les invites vagues ou sous-spécifiées, car elles peuvent entraîner des résultats sous-optimaux.

**Invite vague à éviter**
Créer un traqueur de nourriture

**Bonne invite détaillée**
Créer un traqueur de nourriture qui montre la répartition de la consommation calorique par jour divisée par différents nutriments lorsque j'entre un aliment. Faites en sorte que je puisse voir un aperçu ainsi que des tendances de haut niveau.

### Affiner continuellement vos invites

grok-code-fast-1 est un modèle hautement efficace, offrant jusqu'à 4x la vitesse et 1/10e du coût des autres modèles agentiques leaders. Cela vous permet de tester vos idées complexes à une vitesse et une rentabilité sans précédent. Même si la sortie initiale n'est pas parfaite, nous vous suggérons fortement de profiter de l'itération unique, rapide et rentable pour affiner votre requête—en utilisant les suggestions ci-dessus (par exemple, ajouter plus de contexte) ou en référant aux échecs spécifiques de la première tentative.

**Exemple d'invite bonne avec raffinement**
L'approche précédente n'a pas considéré le processus lourd en E/S qui peut bloquer le thread principal, nous pourrions vouloir l'exécuter dans sa propre boucle de thread afin qu'il ne bloque pas la boucle d'événements au lieu d'utiliser la version de la bibliothèque asynchrone

### Assigner des tâches agentiques

Nous encourageons les utilisateurs à essayer grok-code-fast-1 pour des tâches de style agentique plutôt que des requêtes uniques. Nos modèles Grok 4 sont plus adaptés aux Q&R uniques tandis que grok-code-fast-1 est votre compagnon idéal pour naviguer dans de grandes montagnes de code avec des outils pour vous livrer des réponses précises.

Une bonne façon de penser à cela est :

grok-code-fast-1 est excellent pour travailler rapidement et sans relâche pour vous trouver la réponse ou implémenter le changement requis.
Grok 4 est meilleur pour plonger en profondeur dans des concepts complexes et un débogage difficile lorsque vous fournissez tout le contexte nécessaire à l'avance.

### Pour les développeurs construisant des agents de codage via l'API xAI

Avec grok-code-fast-1, nous avons voulu apporter un modèle agentique aux mains des développeurs. En dehors de nos partenaires de lancement, nous accueillons tous les développeurs à essayer grok-code-fast-1 dans des domaines riches en appels d'outils car la vitesse rapide et le faible coût le rendent efficace et abordable pour utiliser de nombreux outils afin de trouver la bonne réponse.

Comme mentionné dans le billet de blog, grok-code-fast-1 est un modèle de raisonnement avec des appels d'outils entrelacés pendant sa réflexion. Nous envoyons également une réflexion résumée via l'API compatible OpenAI pour un meilleur support UX. Plus de détails sur l'API peuvent être trouvés à https://docs.x.ai/docs/guides/function-calling.

#### Contenu de raisonnement

grok-code-fast-1 est un modèle de raisonnement, et nous exposons sa trace de réflexion via `chunk.choices[0].delta.reasoning_content`. Veuillez noter que les traces de réflexion ne sont accessibles qu'en mode streaming.

#### Utiliser l'appel d'outils natif

grok-code-fast-1 offre un support de première classe pour l'appel d'outils natif et a été spécifiquement conçu avec l'appel d'outils natif à l'esprit. Nous encourageons à l'utiliser au lieu des sorties d'appel d'outils basées sur XML, ce qui pourrait nuire aux performances.

#### Donner un prompt système détaillé

Soyez thorough et donnez beaucoup de détails dans votre prompt système. Un prompt système bien écrit qui décrit la tâche, les attentes et les cas limites dont le modèle doit être conscient peut faire une différence jour et nuit. Pour plus d'inspiration, reportez-vous aux Meilleures Pratiques Utilisateur ci-dessus.

#### Introduire le contexte au modèle

grok-code-fast-1 est habitué à voir beaucoup de contexte dans l'invite utilisateur initiale. Nous recommandons aux développeurs d'utiliser des balises XML ou du contenu formaté en Markdown pour marquer diverses sections du contexte et ajouter de la clarté à certaines sections. Des en-têtes Markdown descriptifs/balises XML et leurs définitions correspondantes permettront à grok-code-fast-1 d'utiliser le contexte plus efficacement.

#### Optimiser pour les hits de cache

Nos hits de cache sont un gros contributeur à la vitesse d'inférence rapide de grok-code-fast-1. Dans les tâches agentiques où le modèle utilise plusieurs outils en séquence, la plupart du préfixe reste le même et est donc automatiquement récupéré du cache pour accélérer l'inférence. Nous recommandons de ne pas changer ou augmenter l'historique des prompts, car cela pourrait entraîner des misses de cache et donc des vitesses d'inférence considérablement plus lentes.



