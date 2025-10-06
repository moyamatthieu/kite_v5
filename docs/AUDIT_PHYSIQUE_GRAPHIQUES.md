# Graphiques et Diagrammes de Diagnostic Physique
## Complément visuel à AUDIT_PHYSIQUE_2025-10-06.md

---

## 📊 Diagramme 1 : Flux de Forces dans la Boucle Physique

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRAME N (16.7ms @ 60Hz)                     │
└─────────────────────────────────────────────────────────────────┘

  INPUT                    CALCUL FORCES              INTÉGRATION
  ─────                    ─────────────              ───────────
    
    🎮                         ☁️ VENT                    📐 EULER
   Pilote  ──────────────>  WindSimulator  ─────>   a = F/m
   (↑↓)                    - Vent de base           v' = v + a·dt
                          - Turbulences             x' = x + v'·dt
                          - Vent apparent                │
                                  │                      │
                                  ▼                      ▼
                              ✈️ AERO                 🔗 PBD
                        AerodynamicsCalc          ConstraintSolver
                        - Lift (portance)         - Lignes
                        - Drag (traînée)          - Brides
                        - Torque                  - Sol
                                  │                      │
                                  ▼                      ▼
                          F_total = Σ Forces      x_corrigé, v_corrigé
                          - Lift                        │
                          - Drag                        │
                          - Gravity                     ▼
                          - [❌ PAS lignes]        🎨 RENDU
                                                   Position finale
                                                   
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️ PROBLÈME #12 : Forces calculées avec position FRAME N-1     │
│                   Contraintes appliquées sur position FRAME N    │
│                   → LAG d'un frame entre forces et géométrie     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📉 Diagramme 2 : Impact du Double Amortissement (Problème #4)

### Scénario : Kite à v = 10 m/s, relâchement input

```
SANS AMORTISSEMENT (théorique)
──────────────────────────────
v(t) = v₀ × e^(-k×t)    où k dépend UNIQUEMENT de drag aéro

Vitesse
   │
10 │●
   │ ╲
 8 │  ╲
   │   ╲___
 6 │      ╲___
   │          ╲___
 4 │              ╲___
   │                  ╲___
 2 │                      ╲___
   │                          ●───────────
 0 └──────────────────────────────────────► Temps (s)
   0    1    2    3    4    5    6    7

   Décélération naturelle (traînée aérodynamique)


AVEC DOUBLE AMORTISSEMENT (actuel)
───────────────────────────────────
v(t) = v₀ × e^(-(k_aero + k_linear)×t)

Vitesse
   │
10 │●
   │ ╲
 8 │  ╲
   │   ╲
 6 │    ╲
   │     ╲
 4 │      ╲___
   │          ╲___
 2 │              ╲___
   │                  ●─────────────────
 0 └──────────────────────────────────────► Temps (s)
   0    1    2    3    4    5    6    7

   Décélération TROP RAPIDE (kite "mou", pas dynamique)
   
┌──────────────────────────────────────────────────────────────┐
│ IMPACT : Kite ralentit 2× trop vite                        │
│ SOLUTION : Supprimer linearDampingFactor (ligne 183)        │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Diagramme 3 : Bridage par MAX_ACCELERATION (Problème #13)

### Analyse des limites de force

```
Force Calculée (Aérodynamique)
      │
 1000 │                                    ← MAX_FORCE (théorique)
      │
  600 │
      │         ╔══════════════╗
  400 │    ╔════╣ ZONE RÉELLE  ║
      │    ║    ╚══════════════╝
  200 │    ║         (vent normal 20-30 km/h)
      │════╝
      └─────────────────────────────────────────► Vitesse vent (km/h)
      0    10    20    30    40    50


Accélération Résultante
      │
3226  │                                    ← a_max théorique = F_max/m
      │                                       (si MAX_FORCE appliquée)
      │
 500  │
      │
 100  │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ← MAX_ACCELERATION (actuel)
      │            ╔═════════╗              ⚠️ CLAMPING ici !
  50  │       ╔════╣ RÉEL    ║
      │       ║    ╚═════════╝
      │═══════╝                           
      └─────────────────────────────────────────► Vitesse vent (km/h)
      0    10    20    30    40    50

Force EFFECTIVE appliquée = m × MAX_ACCELERATION = 0.31 × 100 = 31 N
                                                                ════
                                                                ⚠️ 3% seulement !
                                                                
┌────────────────────────────────────────────────────────────────┐
│ CONSÉQUENCE : Forces aéro réduites de 400N à 31N              │
│ Le kite ne peut PAS voler correctement dans vent > 25 km/h    │
│                                                                 │
│ SOLUTION : MAX_ACCELERATION = 500 m/s² (ou supprimer limite)   │
└────────────────────────────────────────────────────────────────┘
```

---

## 📈 Diagramme 4 : Lissage des Forces (Problème #10)

### Impact sur la réactivité

```
Force Aéro Réelle (instantanée)
      │           ╭──╮
  400 │    ╭──────╯  ╰────╮
      │    │               ╰──╮
  200 │────╯                  ╰────
      │
    0 └────────────────────────────────► Temps
           Rafale de vent
           
           
Force Appliquée (lissée, τ=200ms)
      │               ╭───╮
  400 │          ╭────╯   ╰────╮
      │      ╭───╯             ╰───╮
  200 │──────╯                     ╰──
      │   ◄─────►                       
    0 └──●───────────────────────────────► Temps
         LAG 200ms !
         
         
Réponse du Kite
      │                   Lent à monter
      │               ╭────────
      │          ╭────╯        Lent à descendre
      │      ╭───╯                 ╰───╮
      │──────╯                         ╰────
      └────────────────────────────────────► Temps
           ◄────► ◄────►
           Retards cumulés

┌──────────────────────────────────────────────────────────────┐
│ IMPACT : Kite réagit avec 200ms de retard aux rafales       │
│                                                               │
│ SOLUTION COURT TERME : forceSmoothingRate = 20.0 (τ=50ms)   │
│ SOLUTION LONG TERME : Supprimer lissage, corriger PBD       │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Diagramme 5 : Boucle PBD Correcte vs Actuelle

### Algorithme Position-Based Dynamics Standard

```
┌─────────────────────────────────────────────────┐
│         PBD CORRECT (itératif)                  │
└─────────────────────────────────────────────────┘

POUR chaque sub-step (typiquement 3-5 iterations):
  │
  ├─> 1. Calculer forces avec position/orientation ACTUELLE
  │      F_aero(x_n, q_n, v_n)
  │
  ├─> 2. Intégration Euler
  │      x_pred = x_n + v_n·dt + (F/m)·dt²
  │      q_pred = q_n + ω_n·dt
  │
  ├─> 3. Appliquer contraintes (PBD)
  │      x_corr, q_corr = SolveConstraints(x_pred, q_pred)
  │
  ├─> 4. Mettre à jour position
  │      x_n+1 = x_corr
  │      q_n+1 = q_corr
  │
  └─> 5. Recalculer vitesse
       v_n+1 = (x_n+1 - x_n) / dt
       
  ↑──────────────────┘ RÉPÉTER jusqu'à convergence


┌─────────────────────────────────────────────────┐
│         IMPLÉMENTATION ACTUELLE (1 passe)       │
└─────────────────────────────────────────────────┘

  1. Calculer forces avec x_(n-1), q_(n-1)    ← ⚠️ Frame précédent !
     F_aero(x_(n-1), ...)
  
  2. Intégration Euler
     x_pred = x_n + v_n·dt + (F/m)·dt²
  
  3. Contraintes PBD (2 passes lignes, 1 passe brides)
     x_n+1 = SolveConstraints(x_pred)
  
  4. FIN (pas de réitération)
  
  
┌──────────────────────────────────────────────────────────────┐
│ CONSÉQUENCE : Forces calculées ont 1 frame de retard        │
│ À 60 Hz : erreur temporelle de 16.7 ms                      │
│                                                               │
│ CAUSE PROBABLE : Oscillations hautes fréquences masquées    │
│                  par le lissage des forces (#10)             │
└──────────────────────────────────────────────────────────────┘
```

---

## 📐 Diagramme 6 : Coefficients Aérodynamiques (Problème #1)

### Comparaison Modèle Actuel vs Théorique

```
Coefficient de Portance (CL) vs Angle d'Attaque
      │
  2.0 │                              ╱ Théorie plaque plane
      │                            ╱  CL = 2×sin(α)
      │                          ╱
  1.5 │                        ╱
      │                      ╱
      │                    ╱
  1.0 │                  ╱
      │               ╱╲       ╱╲ Actuel
      │             ╱    ╲   ╱    CL = sin(α)×cos(α)
  0.5 │           ╱        ╲╱
      │         ╱
      │       ╱
    0 └─────────────────────────────────────────► α (degrés)
      0°   15°   30°   45°   60°   75°   90°
                   ▲
                   │
            Peak à 45° (actuel)
            Au lieu de croissance continue


Coefficient de Traînée (CD) vs Angle d'Attaque
      │
  2.0 │                              ╱ Théorie : CD = 2×sin²(α)
      │                            ╱
      │                          ╱
  1.5 │                        ╱
      │                      ╱
      │                    ╱
  1.0 │                  ╱  ╱ Actuel : CD = sin²(α)
      │                ╱  ╱
      │              ╱  ╱   (facteur 2 manquant)
  0.5 │            ╱  ╱
      │          ╱  ╱
      │        ╱  ╱
    0 └─────────────────────────────────────────► α (degrés)
      0°   15°   30°   45°   60°   75°   90°


┌──────────────────────────────────────────────────────────────┐
│ OBSERVATION : Formules actuelles donnent ~50% de la portance│
│               et ~50% de la traînée théoriques               │
│                                                               │
│ HYPOTHÈSE : Kite gonflable ≠ plaque plane pure              │
│             Coefficients actuels peuvent être empiriquement  │
│             corrects pour un profil bombé                    │
│                                                               │
│ RECOMMANDATION : Valider par comparaison avec données réelles│
└──────────────────────────────────────────────────────────────┘
```

---

## 🌊 Diagramme 7 : Turbulences Périodiques vs Aléatoires (Problème #8)

```
ACTUEL : Sinusoïdes (périodique)
──────────────────────────────────
Vent X
  │     ╱╲      ╱╲      ╱╲      ╱╲      ╱╲
  │    ╱  ╲    ╱  ╲    ╱  ╲    ╱  ╲    ╱  ╲
  ├───╯────╰──╯────╰──╯────╰──╯────╰──╯────╰───
  │                                  ▲
  │                                  │
  │                          Répétition exacte !
  └──────────────────────────────────────────────► Temps
  
  
RECOMMANDÉ : Simplex/Perlin Noise (aléatoire)
──────────────────────────────────────────────
Vent X
  │   ╱╲  ╱╲     ╱╲ ╱╲
  │  ╱  ╲╱  ╲   ╱  ╲  ╲    ╱╲  ╱╲
  ├─╯        ╲ ╱    ╲  ╲  ╱  ╲╱  ╲─────
  │           ╲╱      ╲  ╲╱
  │                    ╲╱   Variations imprévisibles
  └──────────────────────────────────────────────► Temps
  

SPECTRE DE FRÉQUENCES
─────────────────────

Actuel (sinus)           Perlin Noise         Kolmogorov (réel)
      │                        │                      │
Amp   │  ●                     │   ●●●●●              │    ●●●●●●
      │                        │       ●●●            │          ●●●●
      │                        │          ●●          │              ●●●
      │                        │            ●         │                 ●●
      └─────► Freq             └─────► Freq           └─────► Freq
      Pic unique               Spectre large          Spectre -5/3
      (0.5 Hz)                 (0.1-10 Hz)            (turbulence vraie)


┌──────────────────────────────────────────────────────────────┐
│ IMPACT : Turbulences actuelles prévisibles, non réalistes   │
│                                                               │
│ SOLUTION : Utiliser simplex-noise library                    │
│   npm install simplex-noise                                  │
│   const turbX = simplex.noise2D(time*freq, seed)            │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 Diagramme 8 : Priorisation des Corrections

```
                        IMPACT SUR SIMULATION
                              (axe Y)
      ÉLEVÉ ▲
            │
            │   #13 MAX_ACCEL    #4 Double
            │      ●              Amortissement
            │                        ●
            │
            │
            │                    #10 Lissage
      MOYEN │                       Forces
            │                         ●
            │
            │   #12 Ordre           #1 Coeff     #8 Turbulences
            │   Forces/PBD          Aéro           Périodiques
            │      ●                  ●               ●
            │
      FAIBLE│               #6 Brides    #3 liftDir
            │               1 passe        ●
            │                 ●
            │                        #11 Inertie   #7 Masse locale
            │                            ●            ●
            └────────────────────────────────────────────────►
           FACILE                              COMPLEXE
                         EFFORT IMPLÉMENTATION
                              (axe X)

LÉGENDE :
  ● #13, #4  → PRIORITÉ 1 : Impact élevé, effort faible (1-2h)
  ● #10      → PRIORITÉ 2 : Impact moyen, effort faible (30min)
  ● #8, #1   → PRIORITÉ 3 : Impact moyen, effort moyen (2-3h)
  ● #12      → PRIORITÉ 4 : Impact élevé, EFFORT ÉLEVÉ (1 jour, refacto)
  ● Autres   → OPTIMISATION : Impact faible
```

---

## 📊 Diagramme 9 : Métriques de Qualité Physique

### Avant vs Après Corrections

```
┌──────────────────────────────────────────────────────────────┐
│                    SCORES PAR CATÉGORIE                       │
└──────────────────────────────────────────────────────────────┘

Précision Forces      ████████░░ 80%  (après #4, #13)
Aérodynamiques        ██████░░░░ 60%  (avant)

Réactivité            █████████░ 90%  (après #10)
Temporelle            ████░░░░░░ 40%  (avant)

Réalisme              ████████░░ 80%  (après #8)
Environnement         ██████░░░░ 60%  (avant)

Cohérence             █████████░ 90%  (après #12)
Physique              ██████░░░░ 60%  (avant)

Stabilité             ████████░░ 80%  (après corrections)
Numérique             ████████░░ 80%  (avant - déjà bon)


┌──────────────────────────────────────────────────────────────┐
│           SCORE GLOBAL : 6.5/10 → 8.5/10                     │
│                                                               │
│   Gain attendu après corrections P1-P3 : +30% qualité        │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧪 Diagramme 10 : Scénarios de Test

### Tests de Validation Post-Correction

```
TEST 1 : Vent Fort (40 km/h)
─────────────────────────────

AVANT (bridé)                 APRÈS (corrigé)
     │                             │
 400 │                         ╔═══╧════╗
     │                         ║ NORMAL ║
Force│                         ║  400N  ║
 200 │                         ╚═══╦════╝
     │    ╔════╗                   │
  31 │════╣CLAMPED               │
     │    ╚════╝  ⚠️ Trop faible  │
   0 └──────────────────────────────────► Temps
   
   ✅ ATTENDU : Kite génère force correcte à 40 km/h


TEST 2 : Rafale Soudaine
─────────────────────────

AVANT (lissé)                 APRÈS (réactif)
Vent │   ╱───╮                    │   ╱───╮
     │  ╱    ╰──                  │  ╱    ╰──
     ├─╯                          ├─╯
     └────────► Temps             └────────► Temps
     
Kite │     ╱──╮                   │   ╱─╮
Pos. │   ╱╱   ╰──                 │  ╱  ╰─
     ├──╯                         ├─╯
     └────────► Temps             └────────► Temps
       LAG 200ms                    LAG <50ms
       
   ✅ ATTENDU : Réponse <50ms aux changements de vent


TEST 3 : Rotation Rapide (Input ↑ puis ↓)
──────────────────────────────────────────

Angle│     ╱╲
     │    ╱  ╲
     │   ╱    ╲___
     ├──╯
     └────────────► Temps
     
   ✅ ATTENDU : Oscillations amorties en <2s
                (pas de rebonds infinis)


TEST 4 : Vol Stationnaire (vent constant 20 km/h)
──────────────────────────────────────────────────

Position│  ○ ○ ○○○○○ ○  ○
Kite    │
        ├──────────────────
        └────────────────────► Temps
        
   ✅ ATTENDU : Oscillations < ±0.3m
                (turbulence naturelle seulement)
```

---

## 🎓 Annexe : Formules Physiques Clés

```
┌──────────────────────────────────────────────────────────────┐
│                    ÉQUATIONS FONDAMENTALES                    │
└──────────────────────────────────────────────────────────────┘

1. NEWTON (2ème loi)
   ─────────────────
   F = m × a
   a = dv/dt
   v = dx/dt
   
   → Intégration Euler semi-implicite :
     v(t+Δt) = v(t) + (F/m)×Δt
     x(t+Δt) = x(t) + v(t+Δt)×Δt
     

2. AÉRODYNAMIQUE (plaque plane)
   ─────────────────────────────
   Pression dynamique : q = ½ρv²
   
   Force de portance : L = q × A × CL
   avec CL = 2sin(α)        (théorie)
   ou   CL = sin(α)cos(α)   (actuel - approximation)
   
   Force de traînée : D = q × A × CD
   avec CD = 2sin²(α)       (théorie)
   ou   CD = sin²(α)        (actuel - approximation)
   

3. ROTATION (corps rigide)
   ─────────────────────────
   Couple : τ = I × α_angulaire
   avec I = moment d'inertie (kg·m²)
   
   τ = r × F  (produit vectoriel)
   
   Quaternion : q' = q + ½Ω·q·Δt
   où Ω = matrice vitesse angulaire


4. POSITION-BASED DYNAMICS (PBD)
   ────────────────────────────────
   Contrainte : C(x) = ||x₁ - x₂|| - L = 0
   
   Gradient : ∇C = (x₁ - x₂) / ||x₁ - x₂||
   
   Lambda : λ = -C / (Σ wᵢ||∇Cᵢ||²)
   avec wᵢ = 1/mᵢ
   
   Correction : Δxᵢ = λ × wᵢ × ∇Cᵢ


5. AMORTISSEMENT EXPONENTIEL
   ──────────────────────────
   Formule continue : v(t) = v₀ × e^(-k×t)
   
   Formule discrète (correcte) :
   v(t+Δt) = v(t) × e^(-k×Δt)
   
   ⚠️ PAS v(t+Δt) = v(t) × (1 - k×Δt)
      (instable pour grands Δt)
```

---

**Document généré automatiquement**  
**Complément de : AUDIT_PHYSIQUE_2025-10-06.md**
