# SPEC V2 — Brewery Process Animated SVG Chart

## Objectif

Remplacer le line chart V1 par un **diagramme de process animé** montrant les postes d'un bar/brasserie avec des stocks qui évoluent en temps réel. Démontrer la capacité d'interactivité d'un plugin React custom impossible avec un chart natif Superset.

---

## Vue UI cible

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🍺 Brewery Simulation                  ▶ ⏸ ⏩×2   Step: 3 / 24      │
│  Scenario: [ ReferenceScenario ▼ ]                                     │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │                                                                     │ │
│ │  ┌───────────┐        ┌───────────┐        ┌───────────┐           │ │
│ │  │ 📦 STOCK  │ ─ ─ ▶  │ 🍺 BAR    │ ─ ─ ▶  │ 🧑‍🍳 SERVEURS│          │ │
│ │  │           │  flux   │           │  flux   │           │          │ │
│ │  │  ██████░░ │   3/h   │  ████░░░░ │   5/h   │   3 / 5   │          │ │
│ │  │  38 / 50  │        │   6 / 15  │        │  actifs   │          │ │
│ │  │  76%  🟢  │        │  40%  🟡  │        │  60%  🟢  │          │ │
│ │  └───────────┘        └───────────┘        └─────┬─────┘          │ │
│ │                                                   │                │ │
│ │                                              flux  5/h             │ │
│ │                                                   │                │ │
│ │                                                   ▼                │ │
│ │  ┌───────────┐        ┌───────────┐        ┌───────────┐          │ │
│ │  │ 🚪 SORTIE │ ◀ ─ ─  │ 🪑 TABLES │ ◀ ─ ─  │ 👥 CLIENTS│          │ │
│ │  │           │  flux   │           │        │           │          │ │
│ │  │  cumul:   │   2/h   │  ██████░░ │        │   18      │          │ │
│ │  │  12 servis│        │  8 / 12   │        │  en salle │          │ │
│ │  │       🟢  │        │  67%  🟡  │        │       🟢  │          │ │
│ │  └───────────┘        └───────────┘        └───────────┘          │ │
│ │                                                                     │ │
│ │  ─ ─ ▶  = flux animé (tirets qui "coulent" en CSS)                 │ │
│ │  Épaisseur flèche proportionnelle au volume du flux                │ │
│ │  🟢 > 50%   🟡 20-50%   🔴 < 20%                                  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─ Timeline ──────────────────────────────────────────────────────┐   │
│  │  ●━━━━━━━━━━●━━━━━━━━━━●━━━╸○──────────────────────────────── │   │
│  │  0          6          12    ↑15         18         24         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Éléments visuels

| Élément | Rendu |
|---|---|
| **Station card** | Rectangle arrondi SVG (`rx=12`) avec ombre portée, icône emoji, nom, jauge horizontale, valeur `N / max`, pastille couleur |
| **Jauge** | Rectangle interne dont `width` est proportionnel au % de remplissage. Couleur via `hsl()` : 120→vert, 60→jaune, 0→rouge |
| **Pastille** | Cercle SVG rempli selon le seuil (>50% vert, 20-50% jaune, <20% rouge). Clignotante si <20% via animation CSS |
| **Flèches de flux** | Paths SVG avec `stroke-dasharray` + animation `stroke-dashoffset` pour effet de tirets qui "coulent". Épaisseur = `strokeWidth` 2→6px proportionnel au delta de stock entre 2 steps |
| **Contrôles** | Barre HTML (pas SVG) en haut : boutons ▶/⏸, vitesse ×1/×2/×4, dropdown scénario, label step |
| **Timeline** | `<input type="range">` stylé en bas du chart, cliquable pour naviguer à un step |

### Interactions

- **Play/Pause** : `setInterval` qui incrémente `currentStep` à chaque tick
- **Vitesse** : toggle cyclique ×1 → ×2 → ×4 (modifie l'intervalle)
- **Clic timeline** : set `currentStep` directement, met en pause
- **Dropdown scénario** : filtre les données côté client (pas de re-requête)
- **Hover station** : tooltip avec la valeur exacte et le delta vs step précédent

---

## Données

### État actuel de `simulation_stock.db`

```
Table : stock_simulation
Colonnes : Simulation_run, Probe_instance, Probe_run, StockMeasure, csm_run_id, run_name
Données : 30 lignes (3 scénarios × 10 steps × 1 probe "StockProbe")
Scénarios : ReferenceScenario, PROD-15427-UpdatedDataset, TestSuperset2
Probe_run : 0 → 9
StockMeasure : 10 → 50
```

### Données à générer (6 probes × 24 steps × 3 scénarios = ~432 lignes)

| Probe_instance | Icône | Description | Capacité max | Comportement typique |
|---|---|---|---|---|
| `StockProbe` | 📦 | Bières en réserve (cave) | 50 | Diminue, resupply possible au step 12 |
| `BarProbe` | 🍺 | Bières prêtes au comptoir | 15 | Alimenté par Stock, vidé par Serveurs |
| `WaiterProbe` | 🧑‍🍳 | Serveurs actifs sur le terrain | 5 | Fluctue avec l'affluence (monte le soir) |
| `TableProbe` | 🪑 | Tables occupées | 12 | Monte progressivement, plateau en soirée |
| `CustomerProbe` | 👥 | Clients présents dans le bar | 30 | Monte puis descend en fin de soirée |
| `ServedProbe` | 🚪 | Clients servis (cumulatif sortie) | 100 | Toujours croissant |

#### Logique de simulation cohérente

Les valeurs ne sont pas aléatoires mais simulées de manière causale :

```
Stock ──(alimente)──▶ Bar ──(distribué par)──▶ Serveurs ──(servent)──▶ Tables
                                                                         │
                                                                    Clients assis
                                                                         │
                                                                    Sortie (cumul)
```

- Quand `Stock` baisse de N, `Bar` monte de ~N (avec latence)
- Quand `Bar` baisse de N, c'est que N bières ont été servies → `Serveurs` actifs
- `Tables` occupées = `Clients` - clients debout au bar
- `ServedProbe` = somme cumulative des clients qui ont fini et sont partis

#### Divergence entre scénarios

| Scénario | Particularité |
|---|---|
| `ReferenceScenario` | Déroulement normal, stock suffisant, resupply au step 12 |
| `PROD-15427-UpdatedDataset` | Stock s'épuise vite (pas de resupply), bar tombe à 0 au step 16, serveurs inactifs |
| `TestSuperset2` | Affluence doublée à partir du step 8, tables saturées, serveurs débordés |

### Script de génération

> **Fichier à créer : `generate_brewery_data.py`** (racine du projet)

Le script doit :
1. Générer les ~432 lignes selon la logique causale ci-dessus
2. Écrire dans `simulation_stock.db` (table `stock_simulation`, même schéma que V1)
3. Être idempotent (DROP TABLE IF EXISTS + CREATE)
4. Afficher un résumé en console (nb lignes, scénarios, probes)

Après exécution :
```powershell
python generate_brewery_data.py
docker cp simulation_stock.db superset_brewery:/app/simulation_stock.db
docker restart superset_brewery
```

---

## Architecture des fichiers

### Fichiers à modifier

```
src/
├── BreweryProcessChart.tsx          # NOUVEAU — Composant React SVG principal
├── SupersetBreweryExtensionTest1.tsx # SUPPRIMER — N'est plus utilisé (V1 line chart)
├── index.ts                          # MODIFIER — Pointer vers BreweryProcessChart
├── types.ts                          # MODIFIER — Nouveaux types pour le process chart
└── plugin/
    ├── index.ts                      # MODIFIER — loadChart pointe vers BreweryProcessChart
    ├── buildQuery.ts                 # MODIFIER — 4 colonnes au lieu de 3
    ├── controlPanel.ts               # MODIFIER — Nouveaux champs (station, scénario, vitesse, capacités)
    └── transformProps.ts             # MODIFIER — Restructure les données en Map<step, Map<station, value>>
```

### Fichiers à créer

```
generate_brewery_data.py              # Script Python de génération des données enrichies
src/BreweryProcessChart.tsx           # Composant principal (SVG + contrôles)
```

### Fichiers à supprimer

```
src/SupersetBreweryExtensionTest1.tsx # Line chart V1 (remplacé, code taggé v1.0.0)
```

---

## Spécification détaillée par fichier

### 1. `generate_brewery_data.py`

```python
# Entrée : rien (paramètres hard-codés)
# Sortie : simulation_stock.db avec table stock_simulation

# Schema (identique à V1) :
# Simulation_run TEXT    — ID technique du run (ex: "run-abc123")
# Probe_instance TEXT    — Nom du probe (ex: "StockProbe", "BarProbe", ...)
# Probe_run      INTEGER — Step temporel 0→23
# StockMeasure   REAL    — Valeur mesurée
# csm_run_id     TEXT    — Même que Simulation_run
# run_name       TEXT    — Nom lisible du scénario

# 3 scénarios × 6 probes × 24 steps = 432 lignes
# Les valeurs suivent la logique causale décrite dans la section Données
```

### 2. `src/types.ts`

```typescript
// Garder StockSimulationDataRecord tel quel (le schéma DB ne change pas)

// Ajouter :
export interface StationConfig {
  id: string;           // Probe_instance name (ex: "StockProbe")
  label: string;        // Nom affiché (ex: "STOCK")
  icon: string;         // Emoji (ex: "📦")
  maxCapacity: number;  // Capacité max pour calcul du %
  x: number;            // Position X dans le SVG (en % du viewBox)
  y: number;            // Position Y dans le SVG (en % du viewBox)
}

export interface FlowConnection {
  from: string;  // StationConfig.id source
  to: string;    // StationConfig.id destination
}

export interface ProcessChartProps {
  width: number;
  height: number;
  data: StockSimulationDataRecord[];
  timeColumn: string;       // Nom de colonne Probe_run
  stationColumn: string;    // Nom de colonne Probe_instance
  valueColumn: string;      // Nom de colonne StockMeasure
  scenarioColumn: string;   // Nom de colonne run_name
  animationSpeed: number;   // 1, 2, ou 4
  stationCapacities: string; // JSON string ex: '{"StockProbe":50,"BarProbe":15,...}'
}
```

### 3. `src/plugin/controlPanel.ts`

Section **Query** :
```
┌──────────────────────────────────────────┐
│ Time Column       [ Probe_run ▼ ]        │  ← SelectControl, mapStateToProps tuples
│ Station Column    [ Probe_instance ▼ ]   │  ← SelectControl, mapStateToProps tuples
│ Value Column      [ StockMeasure ▼ ]     │  ← SelectControl, mapStateToProps tuples
│ Scenario Column   [ run_name ▼ ]         │  ← SelectControl, mapStateToProps tuples
│ Filters           [ ... ]                │  ← adhoc_filters (standard)
│ Row Limit         [ 10000 ]              │  ← sharedControls.row_limit
└──────────────────────────────────────────┘
```

Section **Chart Options** :
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Animation Speed   [ ×1 ▼ ]               │  ← SelectControl, choices [[1,"×1"],[2,"×2"],[4,"×4"]]
│ Station Capacities (JSON)                 │  ← TextControl, default: voir ci-dessous
│ {"StockProbe":50,"BarProbe":15,"WaiterProbe":5,"TableProbe":12,                │
│  "CustomerProbe":30,"ServedProbe":100}                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

> **Important** : chaque `SelectControl` doit utiliser `mapStateToProps` avec `.map(c => [c.column_name, c.verbose_name || c.column_name])` — jamais passer des objets bruts (voir piège V1).

### 4. `src/plugin/buildQuery.ts`

```typescript
// Lire 4 champs depuis formData : time_column, station_column, value_column, scenario_column
// Construire : SELECT time, station, value, scenario FROM table ORDER BY time, station
// Garder metrics: [], groupby: [] (pas d'agrégation)
```

### 5. `src/plugin/transformProps.ts`

```typescript
// Entrée : chartProps.queriesData[0].data = tableau plat de StockSimulationDataRecord[]
// Sortie : ProcessChartProps

// Restructuration :
// 1. Extraire les scenarios uniques → string[]
// 2. Extraire les steps uniques triés → number[]
// 3. Créer la structure indexée :
//    Map<scenarioName, Map<stepNumber, Map<stationId, value>>>
//    Pour accès O(1) : dataMap.get("ReferenceScenario").get(3).get("StockProbe") → 41
```

### 6. `src/BreweryProcessChart.tsx` — Composant principal

#### Structure du composant

```
<div style={{ width, height, position: 'relative' }}>

  {/* Barre de contrôle en haut — HTML pas SVG */}
  <ControlBar>
    <PlayPauseButton onClick={toggle} />
    <SpeedButton onClick={cycleSpeed} label="×2" />
    <ScenarioDropdown options={scenarios} value={currentScenario} onChange={set} />
    <StepLabel>Step {currentStep} / {maxStep}</StepLabel>
  </ControlBar>

  {/* Zone SVG principale */}
  <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid meet">

    {/* 6 stations positionnées en U inversé */}
    <StationCard station={stockConfig}  value={38} maxCapacity={50}  />
    <StationCard station={barConfig}    value={6}  maxCapacity={15}  />
    <StationCard station={waiterConfig} value={3}  maxCapacity={5}   />
    <StationCard station={clientConfig} value={18} maxCapacity={30}  />
    <StationCard station={tableConfig}  value={8}  maxCapacity={12}  />
    <StationCard station={servedConfig} value={12} maxCapacity={100} />

    {/* Flèches de flux entre stations */}
    <FlowArrow from={stockPos} to={barPos}    flux={deltaStock} />
    <FlowArrow from={barPos}   to={waiterPos} flux={deltaBar}   />
    <FlowArrow from={waiterPos} to={tablePos} flux={deltaWaiter} />
    <FlowArrow from={tablePos} to={clientPos} flux={deltaTable}  />
    <FlowArrow from={clientPos} to={servedPos} flux={deltaServed} />

  </svg>

  {/* Timeline en bas — HTML pas SVG */}
  <TimelineSlider min={0} max={maxStep} value={currentStep} onChange={setStep} />

</div>
```

#### Sous-composants SVG (définis dans le même fichier)

**`StationCard`** :
```
┌─────────────────────────────┐  ← <rect> rx=12, fill=white, filter=drop-shadow
│  📦  STOCK                  │  ← <text> emoji + label
│  ████████░░░░  76%          │  ← <rect> background + <rect> fill (width animé)
│  38 / 50          🟢        │  ← <text> valeur + <circle> pastille couleur
└─────────────────────────────┘
```

- La jauge utilise `transition: width 0.5s ease` (via style inline, pas CSS externe)
- Couleur jauge : `hsl(${percent * 1.2}, 80%, 45%)` → vert à 100%, rouge à 0%
- Pastille clignotante si percent < 20% : `@keyframes blink` dans un `<style>` SVG

**`FlowArrow`** :
```
─ ─ ─ ─ ▶   (tirets animés qui "coulent" de gauche à droite)
```

- `<path>` ou `<line>` avec `stroke-dasharray="10,5"` et `marker-end` triangle
- Animation : `<animate attributeName="stroke-dashoffset" from="15" to="0" dur="1s" repeatCount="indefinite" />`
- `strokeWidth` = `Math.max(2, Math.min(6, Math.abs(flux) / 2))`
- Opacité réduite si flux = 0

#### State React

```typescript
const [currentStep, setCurrentStep] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
const [speed, setSpeed] = useState(1);                // 1, 2, 4
const [currentScenario, setCurrentScenario] = useState('');  // premier scénario par défaut
```

#### useEffect pour l'autoplay

```typescript
useEffect(() => {
  if (!isPlaying) return;
  const interval = setInterval(() => {
    setCurrentStep(prev => (prev >= maxStep ? 0 : prev + 1));  // loop
  }, 1000 / speed);
  return () => clearInterval(interval);
}, [isPlaying, speed, maxStep]);
```

#### Positionnement des stations (en coords SVG viewBox 800×450)

```
Ligne du haut (y=80) :    StockProbe (x=80)   →  BarProbe (x=340)   →  WaiterProbe (x=600)
                                                                              │
Ligne du bas  (y=320) :   ServedProbe (x=80)  ←  TableProbe (x=340)  ←  CustomerProbe (x=600)
```

Chaque carte fait ~160×120px dans le viewBox.

### 7. `src/plugin/index.ts`

```typescript
// Changer loadChart pour pointer vers BreweryProcessChart
loadChart: () => import('../BreweryProcessChart'),
```

---

## Contraintes techniques

### À respecter impérativement

1. **Zéro lib externe** — Pas d'ECharts pour cette V2. SVG pur + React. Les dépendances `echarts` et `echarts-for-react` de `package.json` peuvent rester (V1 taggée) mais ne doivent pas être importées dans le nouveau code.

2. **Format tuples SelectControl** — Chaque `mapStateToProps` doit mapper en `[value, label]`. Ne jamais passer `state.datasource?.columns` directement.

3. **buildQuery : champs custom** — Lire `formData.time_column`, `formData.station_column`, etc. Ne pas utiliser `formData.cols`.

4. **Pas de CSS externe / fichier .css** — Tout en style inline ou CSS-in-JS (`styled` de `@superset-ui/core`). Les animations SVG utilisent `<animate>` ou `<style>` inline dans le SVG.

5. **Schéma DB identique** — La table `stock_simulation` garde exactement les mêmes colonnes que V1. Seul le contenu change (plus de probes, plus de steps).

6. **`npm run build` doit passer** — TypeScript strict, pas de `any` sauf dans `mapStateToProps` et `transformProps` (convention existante V1).

7. **Compatible React 16.13.1** — C'est la version dans Superset 4.1.1. Pas de React 18 features (pas de `useId`, pas de `startTransition`).

### Rappels de l'environnement

- **Node** : 18.19.1 (via nvm-windows)
- **Superset** : 4.1.1 (Docker `apache/superset:4.1.1` + frontend cloné)
- **Build plugin** : `npm run build` dans le dossier plugin
- **Dev server** : `start_dev.ps1` → `localhost:9000`
- **Login** : admin / admin
- **Tag V1** : `v1.0.0` (git tag, code sûr pour rollback)

---

## Plan d'exécution (ordre strict)

### Phase 0 — Générer les données enrichies
1. Créer `generate_brewery_data.py` avec la logique de simulation causale
2. Exécuter le script : `python generate_brewery_data.py`
3. Copier dans Docker : `docker cp simulation_stock.db superset_brewery:/app/simulation_stock.db`
4. Redémarrer Docker : `docker restart superset_brewery`
5. Vérifier : `docker exec superset_brewery python3 -c "..."` → 432 lignes, 6 probes, 24 steps

### Phase 1 — Modifier les fichiers plugin (query + types)
1. Modifier `src/types.ts` — Ajouter `StationConfig`, `FlowConnection`, `ProcessChartProps`
2. Modifier `src/plugin/controlPanel.ts` — 4 colonnes query + 2 options chart
3. Modifier `src/plugin/buildQuery.ts` — 4 colonnes depuis formData
4. Modifier `src/plugin/transformProps.ts` — Restructurer en Map indexée

### Phase 2 — Créer le composant SVG
1. Créer `src/BreweryProcessChart.tsx` — Layout complet avec :
   - Barre de contrôle (Play/Pause, Speed, Scenario dropdown, Step label)
   - Zone SVG avec 6 `StationCard` + 5 `FlowArrow`
   - Timeline slider en bas
2. Modifier `src/plugin/index.ts` — `loadChart` pointe vers `BreweryProcessChart`
3. Modifier `src/index.ts` si nécessaire — re-exporter le bon composant

### Phase 3 — Build et test
1. `npm run build` dans le dossier plugin — vérifier 0 erreurs
2. Hard refresh `localhost:9000`
3. Aller dans Charts → choisir le plugin → configurer les 4 colonnes
4. Vérifier :
   - [ ] Les 6 stations s'affichent avec les bonnes valeurs au step 0
   - [ ] Play/Pause fonctionne, les valeurs changent
   - [ ] Le slider timeline permet de naviguer
   - [ ] Le dropdown scénario filtre correctement
   - [ ] Les couleurs (vert/jaune/rouge) sont correctes
   - [ ] Les flèches sont animées
   - [ ] Le chart est responsive (resize la fenêtre)

### Phase 4 — Polish et commit
1. Ajuster les positions/tailles si nécessaire
2. Supprimer `src/SupersetBreweryExtensionTest1.tsx` (V1 déjà taggée)
3. Mettre à jour `SUPERSET_PLUGIN_GUIDE.md` si nécessaire
4. `git add -A && git commit -m "feat: V2 brewery process animated SVG chart"`
5. `git tag -a v2.0.0 -m "v2.0.0 - Animated brewery process diagram"`
6. `git push && git push origin v2.0.0`

---

## Critères de succès

1. ✅ Le chart affiche 6 stations avec jauges colorées
2. ✅ L'animation play/pause fonctionne avec boucle
3. ✅ Les flèches de flux s'animent (tirets qui coulent)
4. ✅ Le dropdown scénario montre des comportements différents (PROD = stock crash, Test = tables saturées)
5. ✅ Le slider timeline permet navigation directe
6. ✅ Aucune lib externe ajoutée (SVG pur)
7. ✅ `npm run build` passe sans erreur
8. ✅ Fonctionne dans Superset 4.1.1 (React 16.13.1)

---

## Specs complémentaires (évolutions)

| Version | Spec | Description | Statut |
|---|---|---|---|
| V2.1 | `SPEC_V2_1_DETAIL_POPUPS.md` | Popups contextuels au clic sur chaque station (sparkline + détails) | ✅ Terminé — commit a5e30ab |
| V2.2 | `SPEC_V2_2_SATISFACTION_BAR.md` | Barre de satisfaction globale sous la timeline (stacked bar + tendance) | ⬜ À implémenter |
