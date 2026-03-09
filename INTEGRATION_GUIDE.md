# Guide d'Intégration dans Apache Superset

## 📝 Fichier à Modifier : MainPreset.js

**Chemin :** `C:\Users\minh\Documents\WORK\Superset\superset\superset-frontend\src\visualizations\presets\MainPreset.js`

### 1. Ajouter l'import en haut du fichier

```javascript
// Trouver la section des imports (vers le début du fichier)
// Ajouter cette ligne avec les autres imports :

import { SupersetBreweryExtensionTest1ChartPlugin } from 'superset-brewery-extension-test-1';
```

### 2. Enregistrer le plugin

```javascript
// Dans la classe MainPreset, méthode constructor()
// Trouver la section plugins: [...]
// Ajouter à la fin du tableau :

export default class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      presets: [new ChartControls()],
      plugins: [
        // ... autres plugins existants ...
        new SupersetBreweryExtensionTest1ChartPlugin().configure({ 
          key: 'superset-brewery-extension-test-1' 
        }),
      ],
    });
  }
}
```

## 🚀 Démarrage de Superset

### Terminal 1 : Backend Flask

```powershell
cd C:\Users\minh\Documents\WORK\Superset\superset
venv\Scripts\activate
$env:FLASK_ENV="development"
superset run -p 8088 --with-threads --reload --debugger
```

**URL Backend :** http://localhost:8088

### Terminal 2 : Frontend React

```powershell
cd C:\Users\minh\Documents\WORK\Superset\superset\superset-frontend
npm run dev-server
```

**URL Frontend (mode dev) :** http://localhost:9000

### Terminal 3 : Votre Extension (Watch Mode)

```powershell
cd C:\Users\minh\Documents\WORK\Superset\Extension\superset_brewery_extension_test_1
npm run dev
```

## 🧪 Tester Votre Extension

1. Ouvrez **http://localhost:9000**
2. Connectez-vous avec vos credentials admin
3. Allez dans **Charts > + Chart**
4. Sélectionnez un dataset (ou créez-en un)
5. Dans la liste des visualizations, cherchez **"Brewery Extension Test 1"**
6. Configurez les colonnes et visualisez !

## 📊 Créer un Dataset de Test

### Option 1 : Upload CSV

1. **Data > Upload CSV to database**
2. Uploadez votre fichier avec les colonnes :
   - `Simulation_run`
   - `Probe_instance`
   - `Probe_run`
   - `StockMeasure`
   - `csm_run_id`
   - `run_name`

### Option 2 : Via SQLite (Recommandé)

Créez un script Python `create_test_db.py` :

```python
import pandas as pd
import sqlite3

# Vos données CSV
data = """Simulation_run,Probe_instance,Probe_run,StockMeasure,csm_run_id,run_name
run-mr5l0lgnk1k9,StockProbe,0,50,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,1,47,run-mr5l0lgnk1k9,ReferenceScenario
run-o6kgpq357v5m,StockProbe,0,50,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,1,45,run-o6kgpq357v5m,PROD-15427-UpdatedDataset"""

# Créer DataFrame
from io import StringIO
df = pd.read_csv(StringIO(data))

# Créer DB SQLite
conn = sqlite3.connect('simulation_stock.db')
df.to_sql('stock_simulation', conn, if_exists='replace', index=False)
conn.close()

print("✅ Database created: simulation_stock.db")
```

Exécutez :
```powershell
python create_test_db.py
```

Puis dans Superset :
- **Data > Database Connections > + Database**
- Choisir **SQLite**
- URI : `sqlite:///C:/Users/minh/Documents/WORK/Superset/simulation_stock.db`

## 🔍 Debugging

### Vérifier que le plugin est chargé

Dans la console du navigateur (F12) :

```javascript
// Lister tous les plugins
Object.keys(window.mainPreset.plugins)

// Chercher votre plugin
window.mainPreset.plugins.find(p => p.key === 'superset-brewery-extension-test-1')
```

### Logs utiles

Dans `src/SupersetBreweryExtensionTest1.tsx`, les `console.log` afficheront :
- Les props reçues
- Les données du chart

## 🐛 Problèmes Courants

### "Module not found: superset-brewery-extension-test-1"

```powershell
cd C:\Users\minh\Documents\WORK\Superset\superset\superset-frontend
npm list superset-brewery-extension-test-1
# Si absent, réinstaller :
npm install -S ..\..\Extension\superset_brewery_extension_test_1
```

### Le plugin n'apparaît pas dans la liste

1. Vérifiez que MainPreset.js a bien été modifié
2. Redémarrez le dev-server (`npm run dev-server`)
3. Videz le cache du navigateur (Ctrl+Shift+R)

### Changements dans l'extension ne s'appliquent pas

Assurez-vous que `npm run dev` tourne dans le terminal 3

## 📚 Ressources

- [Documentation Superset](https://superset.apache.org/docs/intro)
- [Creating a Custom Viz Plugin](https://superset.apache.org/docs/contributing/creating-viz-plugins)
- [Repository de votre extension](https://github.com/minhmachcosmo/superset-brewery-extension-test-1)
