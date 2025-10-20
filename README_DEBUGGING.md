# 📖 Guide de Navigation - Documents d'Analyse et Débogage

## 🎯 Toi cherches...

### Je ne comprends pas comment fonctionne la simulation
→ **Lis**: `CONTROL_MECHANISM_ANALYSIS.md`
- Phases 1-10 du mécanisme expliquées en détail
- Diagrammes ASCII du flux
- Questions clés clarifiées
- 300+ lignes de réflexion structurée

### Je veux déboguer le bug "le kite ne se penche pas"
→ **Utilise**: `DEBUG_CHECKLIST.md`
- 7 diagnostics progressifs avec code prêt à copier
- Résultats attendus pour chaque étape
- Scénarios d'interprétation
- Workflow pas-à-pas

### Je veux utiliser le logging pour analyser
→ **Lis**: `LOGGING_GUIDE.md`
- Comment utiliser LoggingSystem (simple)
- Comment utiliser SimulationLogger (détaillé)
- API complète exposée
- 3 cas d'usage avec code
- Exemples Python/Excel/R

### Je veux une vue d'ensemble de ce qui a été fait
→ **Lis**: `SESSION_SUMMARY.md`
- Tout ce qui a été réalisé dans cette session
- Clarifications apportées
- Systèmes implémentés
- État final du projet
- Prochaines étapes

### Je veux comprendre l'architecture ECS du projet
→ **Lis**: `.github/copilot-instructions.md`
- Architecture ECS pure expliquée
- Séparation données/logique
- Ordre d'exécution des systèmes
- Best practices du projet

---

## 📊 Résumé Rapide des Documents

| Document | Lignes | Focus | Audience |
|----------|--------|-------|----------|
| CONTROL_MECHANISM_ANALYSIS.md | 350+ | Comment fonctionne la barre/kite | Designers/Développeurs |
| DEBUG_CHECKLIST.md | 300+ | Comment déboguer pas-à-pas | Débogueurs/Développeurs |
| LOGGING_GUIDE.md | 350+ | Comment utiliser les outils | Tous |
| SESSION_SUMMARY.md | 350+ | Qu'a-t-on fait ? | Tous |
| LOGGING_GUIDE.md | 350+ | Comment utiliser le logging | Utilisateurs |

---

## 🔄 Flux de Débogage Recommandé

```
1. Lire CONTROL_MECHANISM_ANALYSIS.md (5 min)
   ↓ Comprendre le mécanisme
   
2. Lire DEBUG_CHECKLIST.md section "DIAGNOSTIC PROGRESSIF" (2 min)
   ↓ Connaître les 7 étapes
   
3. Lancer le jeu et faire bouger la barre
   
4. F12 → Console
   window.kiteLogger.stop()
   ↓ Exporte simulation-log.csv
   
5. Vérifier chaque colonne du CSV dans l'ordre
   ↓ Trouver l'étape qui échoue
   
6. Lire la section correspondante de DEBUG_CHECKLIST.md
   ↓ Avoir le code de diagnostic spécifique
   
7. Corriger le système correspondant
```

---

## 🚀 Utilisation Rapide

### Démarrer le Logging
```bash
npm run dev
# La simulation démarre, le logging est actif automatiquement
```

### Exporter les Données
```javascript
// Console navigateur (F12)
window.kiteLogger.stop()
// → Télécharge simulation-log.json et simulation-log.csv
```

### Analyser les Données
```python
# Python (après téléchargement du CSV)
import pandas as pd
df = pd.read_csv('simulation-log.csv')

# Voir les colonnes disponibles
print(df.columns)

# Chercher des anomalies
print(df[['barRotation', 'kiteRotationRoll', 'torqueTotalZ']])
```

---

## 📱 Commandes Console Clés

```javascript
// STOP ET EXPORTER
window.kiteLogger.stop()

// EXPORTER UNIQUEMENT
window.kiteLogger.exportJSON()
window.kiteLogger.exportCSV()

// ACCÉDER AUX DONNÉES
const history = window.kiteLogger.getHistory()
console.log(history[0])  // Premier frame

// RECHERCHER DES PATTERNS
history.forEach((h, i) => {
  if (h.lineTensions.left > 10) {
    console.log(`Frame ${i}: Haute tension gauche`)
  }
})
```

---

## 🎓 Cas d'Usage Complets

### Cas 1: "Pourquoi le torque n'augmente pas ?"
```
1. Ouvrir DEBUG_CHECKLIST.md → DIAG-5
2. Copier le code de logging des torques
3. Coller dans DebugSystem.update()
4. Lancer avec npm run dev
5. Vérifier les valeurs de τ dans la console
6. Si τ = 0 → Voir la section DIAG-5 pour causes possibles
```

### Cas 2: "Le CSV ne montre rien"
```
1. Vérifier que le logging est activé
   window.kiteLogger ← doit exister dans la console
2. Lancer une action pendant 3-5 secondes
3. PUIS exporter: window.kiteLogger.stop()
4. Vérifier que les fichiers ont été téléchargés
5. Ouvrir simulation-log.csv dans Excel
```

### Cas 3: "Analyser la trajectoire 3D"
```
1. Exporter les données: window.kiteLogger.stop()
2. Ouvrir simulation-log.csv dans R ou Python
3. Utiliser code d'exemple du LOGGING_GUIDE.md
4. Créer plots 2D/3D pour visualiser
```

---

## ⚙️ Configuration

### Changer la Fréquence du Logging

**SimulationLogger.ts - Ligne 83**:
```typescript
private logInterval = 100; // milliseconds
// 100 = 10 Hz (une entrée tous les 100ms)
// 50  = 20 Hz (plus détaillé)
// 200 = 5 Hz (moins d'overhead)
```

### Ajouter des Colonnes Custom

**SimulationLogger.ts - Ligne 200+**:
```typescript
// Ajouter un nouveau champ à LogEntry interface
faces: Array<{...}>;  // ← Exemple

// Puis le populer dans collectLogEntry()
entry.faces = [...];  // Calculer les données

// Elles apparaîtront dans le JSON et le CSV
```

---

## 💾 Fichiers Générés

### Après `window.kiteLogger.stop()`

```
~/Downloads/
├── simulation-log.json    (150 KB - 1000+ frames)
└── simulation-log.csv     (50 KB - format Excel/R)
```

### Contenu du JSON
```json
[
  {
    "frameNumber": 1,
    "timestamp": 1634756445234,
    "barRotation": -15.5,
    "barHandles": {...},
    "lineDistances": {...},
    "kitePosition": {...},
    "kiteRotation": {...},
    "torques": {...},
    ...
  },
  ...
]
```

### Contenu du CSV
```
frame,timestamp,barRotation,...,torqueTotalX,torqueTotalY,torqueTotalZ
1,1634756445234,-15.5,...,0.234,0.567,-0.123
2,1634756445334,-14.8,...,0.245,0.589,-0.115
3,1634756445434,-14.1,...,0.256,0.611,-0.107
```

---

## 🔗 Architecture Documentation

Pour les détails techniques complets, voir:

- **`.github/copilot-instructions.md`** - Architecture ECS du projet
- **`README.md`** - Guide d'installation et démarrage
- **`src/ecs/SimulationApp.ts`** - Pipeline des systèmes

---

## ✅ Checklist: "Suis-je prêt à déboguer ?"

- [ ] J'ai lu `CONTROL_MECHANISM_ANALYSIS.md` (comprendre le système)
- [ ] J'ai lu `DEBUG_CHECKLIST.md` section DIAGNOSTIC PROGRESSIF
- [ ] Je sais comment faire `window.kiteLogger.stop()`
- [ ] Je sais ouvrir un CSV dans Excel/LibreCalc
- [ ] J'ai identifié le bug avec la checklist
- [ ] Je sais où corriger le problème

Si toutes les cases sont cochées → **Tu es prêt !**

---

## 🚨 Troubleshooting

### Q: `window.kiteLogger` n'existe pas
```
A: Le logger n'a pas initialisé correctement
   1. Vérifier que npm run dev fonctionne
   2. Attendre 1-2 secondes après démarrage
   3. Ouvrir la console et regarder les logs 📊
```

### Q: Les fichiers ne se téléchargent pas
```
A: Problème de permissions navigateur
   1. Autoriser les téléchargements pop-up
   2. Vérifier le dossier Téléchargements
   3. Essayer dans un onglet privé/incognito
```

### Q: Le CSV est vide
```
A: Pas assez de frames logger
   1. Attendre au moins 3-5 secondes dans le jeu
   2. Faire une action pour générer de la variation
   3. PUIS exporter: window.kiteLogger.stop()
```

### Q: Je veux relancer le logging
```
A: Recharger la page
   F5 ou Ctrl+R
   (Le logging recommence depuis zéro)
```

---

## 📞 Support Rapide

**Issue**: Lire cette section → CONTROL_MECHANISM_ANALYSIS.md → DEBUG_CHECKLIST.md

**Question technique**: Vérifier LOGGING_GUIDE.md

**Besoin d'aide**: Ajouter du console.log() dans DebugSystem.ts (voir code des DIAG-* dans DEBUG_CHECKLIST.md)

---

## 🎉 Résumé Final

Vous avez maintenant:
- ✅ 4 documents d'analyse/documentation complets
- ✅ 1 système de logging détaillé et exportable
- ✅ 1 API console pour contrôler le logging
- ✅ Guide de débogage pas-à-pas
- ✅ Exemples de code pour tous les cas

**Tout ce qu'il faut pour déboguer systématiquement !**

Bon débogage ! 🚀

