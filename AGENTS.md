# AGENTS.md — Brewery Process Chart Plugin

Instructions pour les agents IA travaillant sur ce dépôt.

---

## Vue d'ensemble du projet

Plugin Apache Superset custom qui remplace un line chart par un **diagramme de process animé** (SVG + React) modélisant une brasserie/bar : 6 postes, animations temps-réel, popups contextuels, barre de satisfaction.

- **Dépôt** : `https://github.com/minhmachcosmo/superset-brewery-extension-test-1`
- **Branche active** : `v2-brewery-process`
- **Superset** : Docker 4.1.1, `localhost:9000` (webpack-dev-server via `start_dev.ps1`)
- **React** : 16.13.1 — **ne pas utiliser de hooks React 18**

---

## Build

```powershell
# Dans le répertoire racine du projet
npm run build          # CJS + ESM + types TypeScript
```

- Build réussi = `Successfully compiled 8 files with Babel` (×2) + `tsc --build` sans erreur
- Après build : hard refresh `localhost:9000` dans Superset pour voir les changements
- Ne jamais laisser le build en état d'erreur avant un commit

---

## Tests

```powershell
npm test               # Jest (peu de tests actuellement)
```

Vérification fonctionnelle manuelle dans Superset : lecture des 6 stations, play/pause, slider, popups, barre satisfaction.

---

## Commandes Git

```powershell
git add -A
git commit -m "type: description courte"
git push origin v2-brewery-process
```

Convention de message : `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.

---

## Structure des fichiers clés

```
src/
  BreweryProcessChart.tsx   # Composant principal — SVG animé + layout React
  detailGenerators.ts       # PRNG mulberry32 + 5 générateurs de données contextuelles
  types.ts                  # Interfaces TypeScript (StationConfig, FlowConnection, ProcessChartProps, etc.)
  plugin/
    index.ts                # Point d'entrée du plugin (loadChart → BreweryProcessChart)
    controlPanel.ts         # Panneau de configuration Superset (4 colonnes + 2 options)
    buildQuery.ts           # Construction de la requête SQL
    transformProps.ts       # Transformation des props Superset → props React

simulation_stock.db         # Base SQLite (table: stock_simulation, 432 lignes)
generate_brewery_data.py    # Script de génération des données
PROGRESS_V2.md              # Suivi d'avancement V2
SPEC_V2_BREWERY_PROCESS.md  # Spec principale V2
SPEC_V2_1_DETAIL_POPUPS.md  # Spec V2.1 — popups contextuels
SPEC_V2_2_SATISFACTION_BAR.md # Spec V2.2 — barre de satisfaction
```

---

## Schéma des données

Table SQLite : `stock_simulation`

| Colonne | Type | Rôle |
|---|---|---|
| `Probe_instance` | TEXT | ID de la station (ex. `CustomerProbe`) |
| `Probe_run` | INTEGER | Step temporel (0–23) |
| `StockMeasure` | REAL | Valeur mesurée |
| `run_name` | TEXT | Nom du scénario (ex. `ReferenceScenario`) |
| `Simulation_run` | TEXT | ID de run (ignoré dans le chart) |
| `csm_run_id` | TEXT | ID CSM (ignoré dans le chart) |

**Mapping Superset → composant** :
- `time_column` → `Probe_run`
- `station_column` → `Probe_instance`
- `value_column` → `StockMeasure`
- `scenario_column` → `run_name`

**6 stations** (IDs exacts à respecter) :

| ID | Label | maxCapacity |
|---|---|---|
| `StockProbe` | STOCK | 50 |
| `BarProbe` | PREPARATION | 15 |
| `WaiterProbe` | SERVEURS | 5 |
| `CustomerProbe` | CLIENTS | 30 |
| `TableProbe` | TABLES | 12 |
| `ServedProbe` | SORTIE | 100 |

---

## Conventions de code

### Style général
- **Tout le CSS est inline** (`React.CSSProperties`) — aucun fichier `.css` externe
- **Pas de bibliothèques UI** (pas de Material UI, Ant Design, etc.)
- Composants définis comme fonctions nommées dans `BreweryProcessChart.tsx`
- Constantes de layout en haut du fichier (`VB_W`, `VB_H`, `CARD_W`, `CARD_H`, `STATIONS`, `CONNECTIONS`)

### PRNG déterministe (`detailGenerators.ts`)
- Algorithme : **mulberry32**
- Seed : `hashString(scenario) * 10000 + step * 100 + salt`
- Résultat garanti : mêmes inputs → mêmes outputs → popups reproductibles
- Ne jamais utiliser `Math.random()` dans les générateurs

### Layout flex du composant principal
```
outerDiv (flex column, height fixe depuis Superset, overflow: hidden)
  ├── barStyle          flexShrink: 0  — barre de contrôle noire
  ├── SatisfactionBar   flexShrink: 0  — barre satisfaction dynamique
  ├── svgArea           flex: 1, minHeight: 0  — SVG + popup
  └── timelineStyle     flexShrink: 0  — slider
```

> **Important** : `minHeight: 0` sur le div SVG est obligatoire pour que le flex item puisse rétrécir correctement quand `overflow: visible` est défini (nécessaire pour les popups).

### Popups
- Positionnement : `position: absolute` dans le div SVG area (`overflow: visible`)
- Fermeture : clic extérieur via `document.addEventListener('mousedown', onOutside)`
- Style : `getPopupStyle(station)` adapte la position selon le quadrant de la station

### Couleurs
| Seuil | Couleur |
|---|---|
| ≥ 50% capacité | `#27ae60` (vert) |
| 20–50% | `#f39c12` (orange) |
| < 20% | `#e74c3c` (rouge) — pastille clignote |

---

## Pièges connus

| Piège | Solution |
|---|---|
| Flex item avec `overflow: visible` ne rétrécit pas | Ajouter `minHeight: 0` |
| `overflow: hidden` sur le container coupe les éléments ajoutés en bas | Vérifier que `flex: 1` + `minHeight: 0` absorbent bien l'espace |
| React 18 hooks (`useId`, `useSyncExternalStore`, etc.) | Non disponibles — React 16 uniquement |
| `Math.random()` dans les générateurs | Interdit — utiliser `makePRNG(scenario, step, salt)` |
| Modification des IDs de stations | Les IDs `StockProbe`, `BarProbe`, etc. sont la clé du dataMap — ne pas changer |

---

## Workflow recommandé pour une nouvelle feature

1. Lire la spec correspondante dans `SPEC_V2_*.md`
2. Lire `PROGRESS_V2.md` pour identifier les tâches
3. Implémenter dans `src/BreweryProcessChart.tsx` (ou `detailGenerators.ts` si nouveau générateur)
4. `npm run build` — 0 erreurs obligatoire
5. `git add -A && git commit -m "feat: ..." && git push origin v2-brewery-process`
6. Mettre à jour `PROGRESS_V2.md` avec le hash de commit
