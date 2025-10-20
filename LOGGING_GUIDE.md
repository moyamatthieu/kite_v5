# 📊 Système de Logging de la Simulation - Guide d'Utilisation

## 🎯 Vue d'ensemble

Le projet a maintenant **2 systèmes de logging complémentaires** :

### 1️⃣ `LoggingSystem.ts` (Existant)
- **Priorité**: 80
- **Fréquence**: Toutes les 2 secondes (configurable)
- **Affichage**: Console (colorée et formatée)
- **Contenu**: Position, vitesse, altitude du kite
- **Usage**: Suivi simple et continu en temps réel
- **Avantage**: Léger, toujours actif, idéal pour le suivi global

### 2️⃣ `SimulationLogger.ts` (Nouveau)
- **Priorité**: 45 (APRÈS ConstraintSystem, AVANT PhysicsSystem)
- **Fréquence**: Toutes les 100ms (configurable)
- **Affichage**: Console structurée + Exports
- **Contenu**: 
  - Positions complètes (barre, handles, lignes, CTRL, spine)
  - Forces et tensions détaillées
  - Rotation du kite (quaternion, euler)
  - Bridles et distances
  - Angular dynamics complets
- **Usage**: Débogage détaillé et analyse des données
- **Avantage**: Données exportables (JSON/CSV), traçabilité complète

---

## 🚀 Comment Utiliser

### Option A: Logging Simple (Console)

Le `LoggingSystem` fonctionne **automatiquement** :

```
Console output toutes les 2 secondes :
t=5.23s | Pos: X=0.15 Y=8.50 Z=-120.30 | Vel: 7.19 m/s | Alt: 8.50 m
```

C'est tout ! Aucune action nécessaire.

---

### Option B: Logging Détaillé (Diagnostic)

#### Étape 1 : Ouvrir la Console du Navigateur
```
F12 → Onglet "Console"
```

#### Étape 2 : Arrêter et Exporter les Logs
```javascript
// Dans la console du navigateur:
window.kiteLogger.stop()
```

**Résultat** :
- Les fichiers sont téléchargés automatiquement :
  - `simulation-log.json` - Données structurées brutes
  - `simulation-log.csv` - Format Excel/R pour analyse

---

## 📋 Format des Logs

### Log Console (Formaté)

```
========================================================================================================================
📊 FRAME 150 | 10:30:45.234
========================================================================================================================

🎮 BAR STATE:
  Rotation: -15.50°
  Handle Left: (-0.256, -0.082, 0.000)
  Handle Right: (+0.256, +0.082, 0.000)

🔗 LINES:
  Left: distance=150.234m, tension=12.45N
  Right: distance=150.876m, tension=8.32N
  Asymmetry: ΔT = 4.13N

🎯 CTRL POINTS:
  Left: (-0.325, -0.145, 0.892)
  Right: (+0.298, -0.089, 0.905)

🪁 KITE STATE:
  Position: (0.105, 8.742, -122.456)
  Velocity: (0.234, 0.105, -7.234) m/s
  Rotation (Euler): pitch=-2.34°, roll=4.56°, yaw=1.23°
  Spine Direction: (0.025, 0.987, -0.156)

⚙️ ANGULAR DYNAMICS:
  ω: (0.0012, 0.0045, -0.0032) rad/s
  τ_total: (0.234, 0.567, -0.123) N⋅m
  |τ_total|: 0.634 N⋅m

⚡ FORCES:
  Total: (0.234, -14.715, -0.567) N
  Gravity: (0.000, -1.471, 0.000) N

🌉 BRIDLES:
  Nez: 1.500m, Inter: 2.000m, Centre: 2.500m

========================================================================================================================
```

### Export JSON
```json
[
  {
    "frameNumber": 1,
    "timestamp": 1634756445234,
    "barRotation": -15.5,
    "barHandles": {
      "left": { "x": -0.256, "y": -0.082, "z": 0 },
      "right": { "x": 0.256, "y": 0.082, "z": 0 }
    },
    "lineDistances": {
      "left": 150.234,
      "right": 150.876
    },
    "lineTensions": {
      "left": 12.45,
      "right": 8.32
    },
    "kitePosition": { "x": 0.105, "y": 8.742, "z": -122.456 },
    "kiteRotation": {
      "quaternion": { "x": 0.012, "y": 0.034, "z": -0.056, "w": 0.998 },
      "euler": { "pitch": -2.34, "roll": 4.56, "yaw": 1.23 }
    },
    "kiteVelocity": { "x": 0.234, "y": 0.105, "z": -7.234 },
    "kiteAngularVelocity": { "x": 0.0012, "y": 0.0045, "z": -0.0032 },
    "torques": {
      "total": { "x": 0.234, "y": 0.567, "z": -0.123 }
    },
    "bridles": { "nez": 1.5, "inter": 2.0, "centre": 2.5 }
  },
  ...
]
```

### Export CSV
```
frame,timestamp,barRotation,barHandleLeftX,barHandleLeftY,...,torqueTotalX,torqueTotalY,torqueTotalZ,bridleNez,bridleInter,bridleCentre
1,1634756445234,-15.5,-0.256,-0.082,...,0.234,0.567,-0.123,1.5,2.0,2.5
2,1634756445334,-14.8,-0.245,-0.078,...,0.245,0.589,-0.115,1.5,2.0,2.5
3,1634756445434,-14.1,-0.234,-0.074,...,0.256,0.611,-0.107,1.5,2.0,2.5
...
```

---

## 🎛️ API Complète

### Dans la Console du Navigateur

```javascript
// Afficher l'API disponible
window.kiteLogger

// Arrêter et exporter tous les logs
window.kiteLogger.stop()

// Exporter uniquement en JSON
window.kiteLogger.exportJSON()

// Exporter uniquement en CSV
window.kiteLogger.exportCSV()

// Récupérer l'historique complet en mémoire
const history = window.kiteLogger.getHistory()
console.log(history[0])  // Premier frame

// Afficher les logs formatés
window.kiteLogger.printLogs()

// Récupérer les logs formatés en texte
const logs = window.kiteLogger.getLogs()
```

---

## 🔍 Cas d'Usage

### Cas 1 : Diagnostiquer un Bug de Rotation

1. **Démarrer la simulation** avec barre commande
2. **Ouvrir la console** (F12)
3. **Faire l'action** (ex: tirer à gauche)
4. **Exporter les logs**
   ```javascript
   window.kiteLogger.stop()
   ```
5. **Analyser le CSV** dans Excel/LibreCalc/R:
   - Regarder la colonne `kiteRotationRoll`
   - Doit AUGMENTER quand on tire à gauche
   - Si elle ne change pas → problème de torque
   - Si elle change → le mécanisme fonctionne !

### Cas 2 : Vérifier l'Asymétrie des Tensions

```javascript
const history = window.kiteLogger.getHistory()

// Chercher un frame avec asymétrie significative
history.forEach((entry, idx) => {
  const asymmetry = Math.abs(entry.lineTensions.left - entry.lineTensions.right)
  if (asymmetry > 1.0) {
    console.log(`Frame ${idx}: Asymmetry = ${asymmetry.toFixed(2)}N`)
    console.log(`  Left tension: ${entry.lineTensions.left.toFixed(2)}N`)
    console.log(`  Right tension: ${entry.lineTensions.right.toFixed(2)}N`)
  }
})
```

### Cas 3 : Analyser la Trajectoire

```python
# Dans Python (après export CSV)
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('simulation-log.csv')

# Tracer la position du kite
plt.figure(figsize=(12, 5))
plt.subplot(1, 2, 1)
plt.plot(df['kitePositionX'], df['kitePositionY'], '.-')
plt.xlabel('X (m)')
plt.ylabel('Y (altitude, m)')
plt.title('Trajectoire du kite (vue XY)')
plt.grid(True)

plt.subplot(1, 2, 2)
plt.plot(df['barRotation'], df['kiteRotationRoll'], '.-')
plt.xlabel('Bar Rotation (°)')
plt.ylabel('Kite Roll (°)')
plt.title('Relation barre ↔ rotation kite')
plt.grid(True)

plt.show()
```

---

## ⚙️ Configuration

### Changer la Fréquence de Logging

Le logger enregistre **toutes les 100ms** par défaut.

Pour modifier, il faut éditer `SimulationLogger.ts` :

```typescript
private logInterval = 100; // en millisecondes

// Exemples:
private logInterval = 50;   // Plus fréquent (20 fps)
private logInterval = 200;  // Moins fréquent (5 fps)
```

---

## 📊 Comparaison : LoggingSystem vs SimulationLogger

| Aspect | LoggingSystem | SimulationLogger |
|--------|---------------|------------------|
| **Priorité** | 80 (très tard) | 45 (après contraintes) |
| **Fréquence** | 2000 ms | 100 ms |
| **Détail** | Basique (pos, vel, alt) | Complet (all forces/torques) |
| **Format Console** | Simple | Structuré/formaté |
| **Export** | Non | JSON + CSV |
| **Overhead** | Faible | Modéré |
| **Usage** | Suivi continu | Débogage détaillé |
| **Toujours actif** | ✅ Oui | ✅ Oui |

---

## 🛠️ Débogage Guidé

### Pour trouver le bug de rotation manquante :

**Étape 1**: Lancer la simulation et faire mouvoir la barre
```
F12 → Console
```

**Étape 2**: Après quelques secondes, exporter
```javascript
window.kiteLogger.stop()
```

**Étape 3**: Ouvrir `simulation-log.csv` dans Excel

**Étape 4**: Vérifier ces colonnes dans l'ordre :
1. `barRotation` → doit changer (barre rotatione ✓/✗)
2. `barHandleLeftY` → doit augmenter/diminuer (géométrie ✓/✗)
3. `lineDistLeft` et `lineDistRight` → doivent avoir écart (asymétrie ✓/✗)
4. `lineTensionLeft` et `lineTensionRight` → doivent être inégales (forces ✓/✗)
5. `torqueTotalX/Y/Z` → magnitude doit être > 0.01 (torques ✓/✗)
6. `kiteRotationRoll` ou `kiteRotationPitch` → doit changer (rotation ✓/✗)
7. `spineDirectionX/Y/Z` → doit s'écarter de (0, 1, 0) (orientation ✓/✗)

Si une étape échoue → c'est là que le bug est !

---

## 💾 Où Trouver les Fichiers

Les fichiers téléchargés apparaissent dans le dossier `Téléchargements`:
- Windows: `C:\Users\[user]\Downloads\`
- Mac: `~/Downloads/`
- Linux: `~/Downloads/`

---

## 🎓 Exemple Complet de Session

```javascript
// 1. Lancer la simulation (elle est déjà en cours)

// 2. Faire une action (ex: tirez Q pour bar left pendant 3 secondes)

// 3. Exporter les données
window.kiteLogger.stop()
// → Télécharge simulation-log.json et simulation-log.csv

// 4. Analyser dans la console
const history = window.kiteLogger.getHistory()
console.log(`Logged ${history.length} frames`)
console.log(`Duration: ${(history[history.length-1].timestamp - history[0].timestamp)/1000} seconds`)

// 5. Chercher des anomalies
const maxTorque = Math.max(...history.map(h => h.torques.total.length()))
console.log(`Max torque: ${maxTorque.toFixed(3)} N⋅m`)

const maxRotation = Math.max(...history.map(h => Math.abs(h.kiteRotation.euler.roll)))
console.log(`Max roll rotation: ${maxRotation.toFixed(2)}°`)
```

---

## ✅ Prêt à l'Emploi

Le système est **prêt à l'emploi** dès maintenant :

1. ✅ `LoggingSystem` fonctionne automatiquement
2. ✅ `SimulationLogger` fonctionne automatiquement
3. ✅ API console disponible via `window.kiteLogger`
4. ✅ Exports JSON/CSV fonctionnels

Aucune configuration supplémentaire nécessaire !

