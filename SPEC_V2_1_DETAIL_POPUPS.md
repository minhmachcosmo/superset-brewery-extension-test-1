# SPEC V2.1 — Détails contextuels interactifs (popups au clic sur stations)

Branche : `v2-brewery-process`  
Prérequis : V2 fonctionnelle (commit `fd56653`)

---

## Objectif

Ajouter de l'interactivité au diagramme de process : **au clic sur une station**, un overlay (popup) apparaît avec un contenu **contextuel différent par type de station**. Ceci nécessite une nouvelle base de données d'entrée avec les données détaillées (clients, serveurs, tables, stock items).

---

## Vue UI — Popup générique

```
┌───────────────────────────────────────────────────────────┐
│  🍺 Brewery Simulation          ▶ ⏸ ×2  Step 12 / 23    │
│ ┌───────────────────────────────────────────────────────┐ │
│ │                                                       │ │
│ │   [STOCK]  ──▶  [PREP.]  ──▶  [SERVEURS]            │ │
│ │                                      │                │ │
│ │   [SORTIE] ◀── [TABLES]  ◀──  [CLIENTS] ← clic!     │ │
│ │                                      │                │ │
│ │              ┌──── 👥 CLIENTS ─── Step 12 ──────────┐ │ │
│ │              │                                       │ │ │
│ │              │  Sparkline historique                  │ │ │
│ │              │  30┤        ╱╲                        │ │ │
│ │              │  20┤   ╱──╱  ╲                       │ │ │
│ │              │  10┤ ╱        ╲──                     │ │ │
│ │              │    └───────────┤──────                │ │ │
│ │              │    0    6    12↑   18    23           │ │ │
│ │              │                                       │ │ │
│ │              │  Nom        Attente   Satisfaction    │ │ │
│ │              │  ─────────  ────────  ────────────    │ │ │
│ │              │  Client #1  2 min     😊 95%          │ │ │
│ │              │  Client #2  5 min     😐 60%          │ │ │
│ │              │  Client #3  12 min    😡 20%          │ │ │
│ │              │  Client #4  1 min     😊 98%          │ │ │
│ │              │                                       │ │ │
│ │              │  Moy. satisfaction: 68%  ████████░░   │ │ │
│ │              │                              [×]      │ │ │
│ │              └───────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────────┘ │
│  ┌─ Timeline ─────────────────────────────────────────┐   │
│  │  ●━━━━━━━━━━━━━━━━━━╸○──────────────────────────── │   │
│  └────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

- L'overlay s'affiche **par-dessus** le SVG, positionné à côté de la station cliquée
- Bouton `[×]` pour fermer, ou clic à l'extérieur
- Le contenu se **met à jour** quand le step avance (animation en cours)
- L'overlay est un `<div>` HTML positionné en absolute (pas du SVG) pour faciliter le scrolling/texte

---

## Contenu contextuel par station

### 📦 STOCK — Détail des items en réserve

```
┌──── 📦 STOCK ─── Step 12 ──────────────────┐
│                                              │
│  Sparkline : [courbe 0→23 avec curseur]     │
│  Valeur : 38 / 50  (76%)                   │
│  Min: 22  |  Max: 50  |  Moy: 37.4         │
│                                              │
│  Produit       Qté   Statut                 │
│  ──────────    ───   ─────────              │
│  Blonde IPA    12    🟢 OK                   │
│  Stout         8     🟢 OK                   │
│  Pilsner       6     🟡 Bas                  │
│  Wheat Beer    4     🟡 Bas                  │
│  Porter        5     🟢 OK                   │
│  Lager         3     🔴 Critique             │
│                                              │
│  Prévision rupture : ~5 steps               │
│                                    [×]      │
└──────────────────────────────────────────────┘
```

**Données nécessaires** : table `stock_items`

### 🍺 PREPARATION — Commandes en cours

```
┌──── 🍺 PREPARATION ─── Step 12 ─────────────┐
│                                               │
│  Sparkline + stats (Min/Max/Moy)             │
│                                               │
│  Commande #    Produit     Statut   Durée    │
│  ──────────    ─────────   ──────   ──────   │
│  CMD-041       Blonde IPA  🟢 Prêt  1 min    │
│  CMD-042       Stout       🟡 Prep  3 min    │
│  CMD-043       Pilsner     🟡 Prep  2 min    │
│  CMD-044       Wheat Beer  🔴 Att.  5 min    │
│                                               │
│  Temps moyen préparation : 2.8 min           │
│                                     [×]      │
└───────────────────────────────────────────────┘
```

**Données nécessaires** : table `preparation_orders`

### 🧑‍🍳 SERVEURS — Liste des serveurs avec statut

```
┌──── 🧑‍🍳 SERVEURS ─── Step 12 ────────────────┐
│                                               │
│  Sparkline + stats                            │
│                                               │
│  Serveur     Statut     Clients servis        │
│  ──────────  ─────────  ──────────────        │
│  Alice       🟢 Actif   12                    │
│  Bob         🟢 Actif   9                     │
│  Charlie     🟡 Pause   7                     │
│  Diana       🟢 Actif   15                    │
│  Eve         ⚫ Absent   0                    │
│                                               │
│  Total servis ce step : 43                    │
│                                     [×]      │
└───────────────────────────────────────────────┘
```

**Données nécessaires** : table `waiters`

### 👥 CLIENTS — Liste avec satisfaction

```
┌──── 👥 CLIENTS ─── Step 12 ──────────────────┐
│                                               │
│  Sparkline + stats                            │
│                                               │
│  Client       Arrivée  Attente  Satisfaction  │
│  ───────────  ───────  ───────  ────────────  │
│  Client #1    Step 2   2 min    😊 95%        │
│  Client #2    Step 5   5 min    😐 60%        │
│  Client #3    Step 8   12 min   😡 20%        │
│  Client #4    Step 11  1 min    😊 98%        │
│  Client #5    Step 7   8 min    😟 40%        │
│  ...                                          │
│                                               │
│  Moy. satisfaction: 63%  ████████░░ 😐        │
│  Clients en attente: 7 / 18                   │
│                                     [×]      │
└───────────────────────────────────────────────┘
```

**Données nécessaires** : table `clients`

### 🪑 TABLES — Plan de salle visuel

```
┌──── 🪑 TABLES ─── Step 12 ───────────────────┐
│                                               │
│  Sparkline + stats                            │
│                                               │
│  Plan de salle (grille 3×4) :                │
│  ┌────┐ ┌────┐ ┌────┐                        │
│  │ T1 │ │ T2 │ │ T3 │                        │
│  │ 🟢 │ │ 🔴 │ │ 🟢 │                        │
│  │ 2p  │ │ 4p │ │ 2p │                        │
│  └────┘ └────┘ └────┘                        │
│  ┌────┐ ┌────┐ ┌────┐                        │
│  │ T4 │ │ T5 │ │ T6 │                        │
│  │ 🔴 │ │ 🟢 │ │ 🟡 │                        │
│  │ 6p  │ │ 2p │ │ 4p │                        │
│  └────┘ └────┘ └────┘                        │
│  ┌────┐ ┌────┐ ┌────┐                        │
│  │ T7 │ │ T8 │ │ T9 │                        │
│  │ 🔴 │ │ 🔴 │ │ ⚫ │                         │
│  │ 4p │ │ 2p │ │ réserv│                      │
│  └────┘ └────┘ └────┘                        │
│  ┌────┐ ┌────┐ ┌────┐                        │
│  │T10 │ │T11 │ │T12 │                        │
│  │ 🟢 │ │ 🔴 │ │ 🟢 │                        │
│  │ 2p │ │ 6p │ │ 4p │                        │
│  └────┘ └────┘ └────┘                        │
│                                               │
│  🟢 Libre  🔴 Occupée  🟡 Réservée  ⚫ HS    │
│  Occupées: 8/12  |  Places assises: 24/40    │
│                                     [×]      │
└───────────────────────────────────────────────┘
```

**Données nécessaires** : table `tables_layout`

### 🚪 SORTIE — Stats globales

```
┌──── 🚪 SORTIE ─── Step 12 ───────────────────┐
│                                                │
│  Sparkline + stats                             │
│                                                │
│  Clients servis total : 42                     │
│  Débit : 3.5 clients/step                     │
│                                                │
│  Satisfaction globale :                        │
│  😊 Très satisfait (>80%)  : 18  (43%)        │
│  😐 Satisfait (50-80%)     : 14  (33%)        │
│  😟 Mécontent (20-50%)     : 7   (17%)        │
│  😡 Très mécontent (<20%)  : 3   (7%)         │
│                                                │
│  ████████████████████░░░░░░░ 73% global       │
│                                      [×]      │
└────────────────────────────────────────────────┘
```

**Données nécessaires** : table `clients` (réutilise les données de satisfaction)

---

## Nouvelle base de données : `brewery_input.db`

### Pourquoi une base séparée

- `simulation_stock.db` = **sortie** de simulation (probes agrégés)
- `brewery_input.db` = **entrée** détaillée (clients, serveurs, tables, stock items, commandes)
- Séparation claire : la DB d'input alimente les popups, la DB de simulation alimente le diagramme principal
- Les deux sont montées en bind mount dans Docker

### Schéma des tables

#### `stock_items` — Produits en réserve

```sql
CREATE TABLE stock_items (
    run_name       TEXT,     -- ReferenceScenario, PROD-..., TestSuperset2
    step           INTEGER,  -- 0→23
    product_name   TEXT,     -- Blonde IPA, Stout, Pilsner, ...
    quantity       INTEGER,  -- Quantité en stock
    max_quantity   INTEGER,  -- Capacité max par produit
    status         TEXT      -- ok, low, critical
);
```

- 6 produits × 24 steps × 3 scénarios = **432 lignes**
- `status` = "ok" si qty > 50% max, "low" si 20-50%, "critical" si < 20%

#### `preparation_orders` — Commandes en préparation

```sql
CREATE TABLE preparation_orders (
    run_name       TEXT,     -- Scénario
    step           INTEGER,  -- 0→23
    order_id       TEXT,     -- CMD-001, CMD-002, ...
    product_name   TEXT,     -- Blonde IPA, Stout, ...
    status         TEXT,     -- ready, preparing, waiting
    duration_min   REAL      -- Temps de préparation en minutes
);
```

- ~3-6 commandes actives par step × 24 steps × 3 scénarios = **~360 lignes**
- Les commandes apparaissent et disparaissent (lifespan 2-4 steps)

#### `waiters` — Serveurs

```sql
CREATE TABLE waiters (
    run_name       TEXT,     -- Scénario
    step           INTEGER,  -- 0→23
    waiter_name    TEXT,     -- Alice, Bob, Charlie, Diana, Eve
    status         TEXT,     -- active, break, off
    clients_served INTEGER   -- Cumulatif pour ce serveur
);
```

- 5 serveurs × 24 steps × 3 scénarios = **360 lignes**

#### `clients` — Clients individuels

```sql
CREATE TABLE clients (
    run_name       TEXT,     -- Scénario
    step           INTEGER,  -- 0→23
    client_id      TEXT,     -- Client #1, Client #2, ...
    arrival_step   INTEGER,  -- Step d'arrivée
    wait_minutes   REAL,     -- Temps d'attente actuel
    satisfaction   REAL,     -- 0.0 → 1.0
    status         TEXT      -- waiting, seated, served, left
);
```

- ~5-20 clients présents par step × 24 steps × 3 scénarios = **~720 lignes**
- Les clients arrivent, attendent, sont servis, et partent
- `satisfaction` = `max(0, 1.0 - wait_minutes * 0.08)` (baisse de 8% par minute d'attente)

#### `tables_layout` — État des tables

```sql
CREATE TABLE tables_layout (
    run_name       TEXT,     -- Scénario
    step           INTEGER,  -- 0→23
    table_id       TEXT,     -- T1, T2, ..., T12
    seats          INTEGER,  -- 2, 4, ou 6
    status         TEXT,     -- free, occupied, reserved, maintenance
    client_id      TEXT      -- NULL si libre, sinon réf vers clients
);
```

- 12 tables × 24 steps × 3 scénarios = **864 lignes**

### Total estimé : ~2736 lignes dans `brewery_input.db`

---

## Script de génération : `generate_brewery_input.py`

### Logique de génération

Le script doit être **cohérent** avec `generate_brewery_data.py` :

1. **Lire** `simulation_stock.db` pour connaître les valeurs agrégées par step/scénario
2. **Distribuer** les valeurs agrégées en données individuelles :
   - `CustomerProbe = 18` au step 12 → générer 18 lignes dans `clients` avec des `arrival_step` et `wait_minutes` variés
   - `WaiterProbe = 3` au step 12 → 3 serveurs actifs, 1 en pause, 1 absent dans `waiters`
   - `TableProbe = 8` au step 12 → 8 tables occupées sur 12 dans `tables_layout`
   - `StockProbe = 38` au step 12 → distribuer en 6 produits dans `stock_items` (total = 38)
   - `BarProbe = 6` au step 12 → 6 commandes actives dans `preparation_orders`

3. **Satisfaction client** : calculée à partir de `wait_minutes`
   - `satisfaction = max(0, 1.0 - wait_minutes * 0.08)`
   - Emoji mapping : ≥0.8 → 😊, ≥0.5 → 😐, ≥0.2 → 😟, <0.2 → 😡

4. **Noms des produits** (cohérents à travers toutes les tables) :
   ```python
   PRODUCTS = ['Blonde IPA', 'Stout', 'Pilsner', 'Wheat Beer', 'Porter', 'Lager']
   ```

5. **Noms des serveurs** :
   ```python
   WAITERS = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']
   ```

### Sortie

```powershell
python generate_brewery_input.py
# → Crée brewery_input.db avec 5 tables
# → Affiche un résumé : nb lignes par table, par scénario
```

---

## Docker — Monter la nouvelle base

### Modifier `docker-compose.simple.yml`

Ajouter le bind mount :

```yaml
volumes:
  - ./simulation_stock.db:/app/simulation_stock.db:ro
  - ./brewery_input.db:/app/brewery_input.db:ro       # ← NOUVEAU
  - ./superset_config.py:/app/pythonpath/superset_config.py:ro
  - superset_home:/app/superset_home
```

### Créer un second dataset dans Superset

1. **Settings → Database Connections → +** → SQLite → `sqlite:////app/brewery_input.db`
2. Ou ajouter dans la même connexion SQLite existante si Superset le permet

### Requête dans buildQuery

Le plugin continue d'utiliser `simulation_stock.db` (table `stock_simulation`) pour le diagramme principal. Les données de `brewery_input.db` sont chargées **via une seconde requête** ou via un champ `TextControl` qui configure le dataset d'input.

**Option recommandée** : ne pas faire de seconde requête Superset. Charger les données d'input directement côté Python (route custom) ou les intégrer dans la même DB.

**Option la plus simple** : ajouter les 5 tables dans `simulation_stock.db` directement. Comme ça, une seule connexion DB et le `buildQuery` peut être étendu pour faire une seconde query.

→ **Décision : tout dans `simulation_stock.db`** pour simplicité.

---

## Architecture technique

### Données : tout dans `simulation_stock.db`

Le script `generate_brewery_input.py` ajoute les 5 tables dans `simulation_stock.db` (sans toucher à `stock_simulation` existante).

### Requête : multi-query dans `buildQuery.ts`

```typescript
export default function buildQuery(formData: QueryFormData) {
  const { time_column, station_column, value_column, scenario_column } = formData;

  const mainColumns = [time_column, station_column, value_column, scenario_column].filter(Boolean);

  return buildQueryContext(formData, baseQueryObject => [
    // Query 0 — données principales (diagramme)
    {
      ...baseQueryObject,
      columns: mainColumns,
      metrics: [],
      groupby: [],
    },
    // Query 1 — détails clients
    {
      ...baseQueryObject,
      columns: ['run_name', 'step', 'client_id', 'arrival_step', 'wait_minutes', 'satisfaction', 'status'],
      metrics: [],
      groupby: [],
      datasource: 'clients',  // Table spécifique
    },
    // ... autres queries pour stock_items, waiters, etc.
  ]);
}
```

> **⚠️ Contrainte Superset** : `buildQueryContext` n'accepte qu'un seul datasource par chart. Les multi-queries portent toutes sur le même dataset.

**Solution alternative (recommandée)** : créer **une vue SQL** ou **une seule table dénormalisée** qui combine tout, OU charger les données de détail directement dans `transformProps` via les données principales + calcul côté client.

**Solution retenue** : **Calcul côté client** — le composant React génère les données de détail à partir des valeurs agrégées + une seed déterministe par step/scénario. Cela évite de changer le buildQuery et le dataset Superset.

---

## Solution retenue : Détails générés côté client

### Pourquoi

- Zéro changement au `buildQuery.ts` (les 432 lignes de `stock_simulation` suffisent)
- Zéro nouveau dataset dans Superset
- Zéro seconde DB
- Les noms/attributs sont générés de manière **déterministe** (seed = step + scénario)
- Le résultat est visuellement identique à des vraies données

### Comment

Un fichier utilitaire `src/detailGenerators.ts` contient les fonctions qui, à partir de `(scenario, step, stationId, aggregateValue)`, génèrent les lignes de détail :

```typescript
// Exemple d'API :
generateClientDetails(scenario, step, customerCount) → ClientDetail[]
generateWaiterDetails(scenario, step, activeWaiters) → WaiterDetail[]
generateTableDetails(scenario, step, occupiedTables) → TableDetail[]
generateStockItemDetails(scenario, step, totalStock) → StockItemDetail[]
generateOrderDetails(scenario, step, barCount) → OrderDetail[]
```

Chaque fonction utilise un **PRNG seedé** (`mulberry32` ou simple hash) pour que les mêmes inputs produisent toujours les mêmes outputs (pas de randomness visible).

### Fichier `generate_brewery_input.py`

Ce fichier **reste utile** comme documentation / validation des données. Il peut être exécuté pour vérifier que la logique de distribution est cohérente. Mais les données ne sont **pas stockées en DB** — elles sont calculées à la volée dans le frontend.

---

## Plan d'exécution (ordre strict)

### Phase 1 — Générateur de détails côté client

> **Fichier à créer : `src/detailGenerators.ts`**

1. Définir les types : `ClientDetail`, `WaiterDetail`, `TableDetail`, `StockItemDetail`, `OrderDetail`
2. Implémenter un PRNG seedé simple (ex: `mulberry32`)
3. Implémenter `generateClientDetails(scenario, step, count)` :
   - Génère `count` clients avec `arrival_step`, `wait_minutes`, `satisfaction`, `status`
   - `satisfaction = max(0, 1.0 - wait_minutes * 0.08)`
   - Noms : `Client #1` → `Client #N`
4. Implémenter `generateWaiterDetails(scenario, step, activeCount)` :
   - 5 serveurs fixes (Alice, Bob, Charlie, Diana, Eve)
   - `activeCount` sont "active", le reste est "break" ou "off"
   - `clients_served` = cumulatif basé sur les steps précédents
5. Implémenter `generateTableDetails(scenario, step, occupiedCount)` :
   - 12 tables fixes (T1→T12), seats = [2,4,2,6,2,4,4,2,4,2,6,4]
   - `occupiedCount` sont "occupied", le reste est "free" (sauf T9 = "maintenance")
6. Implémenter `generateStockItemDetails(scenario, step, totalStock)` :
   - 6 produits : Blonde IPA, Stout, Pilsner, Wheat Beer, Porter, Lager
   - Distribuer `totalStock` entre les 6 produits (proportions via seed)
   - `status` = ok/low/critical basé sur qty vs max
7. Implémenter `generateOrderDetails(scenario, step, barCount)` :
   - `barCount` commandes actives avec un produit et un statut (ready/preparing/waiting)

### Phase 2 — Composant popup overlay

> **Fichier à modifier : `src/BreweryProcessChart.tsx`**

1. Ajouter un state `selectedStation: string | null` (null = pas de popup)
2. Rendre les `StationCard` cliquables : `onClick={() => setSelectedStation(config.id)}`
3. Ajouter un composant `<DetailPopup>` positionné en `position: absolute` sur la zone SVG
4. `<DetailPopup>` contient :
   - Header : icône + nom station + step actuel + bouton ×
   - Section sparkline : SVG `<polyline>` des valeurs historiques de cette station (toutes données déjà chargées via `dataMap`)
   - Section stats : Min / Max / Moy calculés depuis `dataMap`
   - Section détails : contenu spécifique à la station (switch/case sur `stationId`)
5. Clic à l'extérieur ou bouton × → `setSelectedStation(null)`
6. Le popup se repositionne intelligemment pour ne pas sortir du chart (ex: si station est à droite, popup s'ouvre à gauche)

### Phase 3 — Sparkline (commun à toutes les stations)

> **Composant inline dans `BreweryProcessChart.tsx`**

```typescript
function Sparkline({ values, currentIdx, width, height }: { ... }) {
  // SVG <polyline> simple
  // Trait gris pour l'historique complet
  // Point rouge sur le currentIdx
  // Zone colorée sous la courbe (fill avec opacité)
}
```

- `width` = largeur du popup - padding
- `height` = 60px fixe
- `values` = toutes les valeurs de cette station pour ce scénario (24 points)

### Phase 4 — Contenu spécifique par station

> **Dans `<DetailPopup>`, switch sur `selectedStation`**

| Station | Composant | Données source |
|---|---|---|
| StockProbe | `<StockItemsTable>` | `generateStockItemDetails()` |
| BarProbe | `<OrdersTable>` | `generateOrderDetails()` |
| WaiterProbe | `<WaitersTable>` | `generateWaiterDetails()` |
| CustomerProbe | `<ClientsTable>` | `generateClientDetails()` |
| TableProbe | `<FloorPlan>` | `generateTableDetails()` |
| ServedProbe | `<SatisfactionSummary>` | `generateClientDetails()` (agrégé) |

### Phase 5 — Build et test

1. `npm run build` — 0 erreurs TypeScript
2. Hard refresh `localhost:9000`
3. Tester :
   - [ ] Clic sur chaque station → popup s'ouvre avec bon contenu
   - [ ] Bouton × et clic extérieur → popup se ferme
   - [ ] Sparkline affiche la courbe correcte avec marqueur
   - [ ] Données de détail changent avec le step (play en cours)
   - [ ] Popup ne déborde pas du chart (repositionnement)
   - [ ] Changer de scénario → données de détail cohérentes
   - [ ] Satisfaction clients : emojis corrects selon % 
4. Commit + push

---

## Fichiers impactés

| Fichier | Action | Description |
|---|---|---|
| `src/detailGenerators.ts` | **CRÉER** | PRNG seedé + 5 fonctions de génération de détails |
| `src/types.ts` | **MODIFIER** | Ajouter `ClientDetail`, `WaiterDetail`, `TableDetail`, `StockItemDetail`, `OrderDetail` |
| `src/BreweryProcessChart.tsx` | **MODIFIER** | Ajouter `selectedStation` state, clic handler, `<DetailPopup>`, sparkline |
| `src/plugin/buildQuery.ts` | **AUCUN** | Pas de changement |
| `src/plugin/controlPanel.ts` | **AUCUN** | Pas de changement |
| `src/plugin/transformProps.ts` | **AUCUN** | Pas de changement |
| `docker-compose.simple.yml` | **AUCUN** | Pas de changement |
| `generate_brewery_data.py` | **AUCUN** | Pas de changement |

---

## Contraintes techniques

1. **Zéro nouvelle requête Superset** — Les détails sont calculés côté client à partir des valeurs agrégées
2. **PRNG déterministe** — Mêmes inputs → mêmes outputs (pas de `Math.random()`)
3. **Pas de nouvelle DB** — Tout utilise les données déjà chargées (432 lignes)
4. **Popup en HTML** (pas SVG) — Plus facile pour le texte, scrolling, et overflow
5. **Compatible React 16.13.1** — Pas de hooks React 18
6. **`npm run build` doit passer** — TypeScript strict

---

## Critères de succès

1. ✅ Clic sur une station → popup contextuel s'ouvre
2. ✅ Chaque station a un contenu différent (6 types)
3. ✅ Sparkline avec marqueur de step actuel
4. ✅ Stats Min/Max/Moy
5. ✅ Détails cohérents avec la valeur agrégée (ex: 18 clients affichés quand CustomerProbe = 18)
6. ✅ Satisfaction clients avec emojis
7. ✅ Plan de salle visuel pour les tables
8. ✅ Données déterministes (pas de variation au refresh)
9. ✅ Popup se ferme au clic × ou clic extérieur
10. ✅ `npm run build` passe sans erreur
