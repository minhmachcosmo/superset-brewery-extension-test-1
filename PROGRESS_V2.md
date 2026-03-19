# Avancement — V2 Brewery Process Animated SVG Chart

Branche : `v2-brewery-process`  
Spec de référence : `SPEC_V2_BREWERY_PROCESS.md`  
Démarré le : 2025

---

## Vue d'ensemble

| Phase | Description | Statut |
|---|---|---|
| 0 | Générer les données enrichies (6 probes × 24 steps × 3 scénarios) | ✅ Terminé |
| 1 | Modifier les fichiers plugin (types, controlPanel, buildQuery, transformProps) | ✅ Terminé |
| 2 | Créer le composant SVG animé (BreweryProcessChart.tsx) | ✅ Terminé |
| 3 | Build + test fonctionnel dans Superset | ✅ Build OK (0 erreurs TS) |
| 4 | Polish, commit, tag v2.0.0 | ✅ Terminé |

---

## Phase 0 — Données enrichies

### Tâches
- [x] Créer `generate_brewery_data.py`
- [x] Exécuter le script (432 lignes générées)
- [x] Copier dans Docker + restart
- [x] Vérifier : 6 probes, 24 steps, 3 scénarios

### Données générées
| Probe_instance | Capacité max | Scénario Reference | Scénario PROD | Scénario Test |
|---|---|---|---|---|
| StockProbe | 50 | -2/step, resupply step 12 | -4/step, épuisé step 12 | -2→-4/step, resupply step 14 |
| BarProbe | 15 | suit la demande (4-12) | suit stock (→0) | stressé step 8+ |
| WaiterProbe | 5 | pic step 8-10 | drop quand bar vide | max 5 dès step 8 |
| TableProbe | 12 | pic step 9-10 | pic step 5, chute | saturé (10-12) step 8+ |
| CustomerProbe | 30 | pic step 8 | pic step 5, fuite | doublé step 8+ |
| ServedProbe | 100 | cumulatif croissant | plateau step 12 | croît plus vite step 8+ |

---

## Phase 1 — Fichiers plugin

### Tâches
- [x] `src/types.ts` — Ajouté `StationConfig`, `FlowConnection`, `ProcessChartProps`
- [x] `src/plugin/controlPanel.ts` — 4 colonnes query + 2 options (vitesse, capacités JSON)
- [x] `src/plugin/buildQuery.ts` — Lit `time_column`, `station_column`, `value_column`, `scenario_column`
- [x] `src/plugin/transformProps.ts` — Restructuré avec les 4 champs

---

## Phase 2 — Composant SVG

### Tâches
- [x] Créer `src/BreweryProcessChart.tsx`
  - [x] Barre de contrôle (Play/Pause, ×Speed, Scenario dropdown, Step label)
  - [x] SVG 820×460 avec 6 `StationCard` positionnées en U inversé
  - [x] 5 `FlowArrow` animées avec `stroke-dashoffset`
  - [x] Timeline slider en bas
  - [x] `useEffect` autoplay avec cleanup
- [x] Modifier `src/plugin/index.ts` — `loadChart` → `BreweryProcessChart`
- [x] Renommer station BAR → PREPARATION (commit fd56653)

### Positionnement stations (viewBox 820×460)
```
Stock(35,55) ──▶ Preparation(335,55) ──▶ Waiters(635,55)
                                                │
Served(35,300) ◀── Tables(335,300) ◀── Customers(635,300)
```

---

## Phase 3 — Build & Test

### Checklist de validation
- [x] `npm run build` — 0 erreurs TypeScript
- [ ] Hard refresh `localhost:9000` — ⏳ en attente test utilisateur
- [ ] Les 6 stations s'affichent au step 0
- [ ] Play/Pause fonctionne, valeurs changent avec animation
- [ ] Slider timeline navigue correctement
- [ ] Dropdown scénario : comportements différents visibles
- [ ] Couleurs vert/jaune/rouge correctes selon % capacité
- [ ] Pastille rouge clignote si < 20%
- [ ] Flèches animées (tirets qui coulent)
- [ ] Chart responsive (resize fenêtre)

---

## Phase 4 — Finalisation

### Tâches
- [x] Supprimer `src/SupersetBreweryExtensionTest1.tsx` (V1 taggée v1.0.0)
- [x] `git commit` — `030588b feat: V2 brewery process animated SVG chart`
- [x] `git commit` — `fd56653 refactor: rename BAR station to PREPARATION`
- [ ] `git tag -a v2.0.0` — après validation visuelle dans Superset
- [ ] `git push origin v2.0.0`

---

## Journal des modifications

| Fichier | Action | Statut |
|---|---|---|
| `generate_brewery_data.py` | Créé | ✅ |
| `simulation_stock.db` | Régénéré (432 lignes) | ✅ |
| `src/types.ts` | Modifié | ✅ |
| `src/plugin/controlPanel.ts` | Modifié | ✅ |
| `src/plugin/buildQuery.ts` | Modifié | ✅ |
| `src/plugin/transformProps.ts` | Modifié | ✅ |
| `src/BreweryProcessChart.tsx` | Créé | ✅ |
| `src/plugin/index.ts` | Modifié | ✅ |
| `src/SupersetBreweryExtensionTest1.tsx` | Supprimé | ✅ |
