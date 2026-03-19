# SPEC V2.2 — Barre de satisfaction globale dans le chart principal

Branche : `v2-brewery-process`  
Prérequis : V2.1 fonctionnelle (commit `a5e30ab`)

---

## Objectif

Ajouter une **barre de satisfaction globale** toujours visible sous la timeline du chart principal, sans ouvrir de popup. Cette barre donne un indicateur temps-réel de l'état de la brasserie à chaque step.

---

## Vue UI cible

```
┌───────────────────────────────────────────────────────────────┐
│  🍺 Brewery Simulation   [Scénario ▾]   ▶ ×2  Step 12 / 23  │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │                                                           │ │
│ │   [STOCK]  ──▶  [PREP.]  ──▶  [SERVEURS]                │ │
│ │                                      │                    │ │
│ │   [SORTIE] ◀── [TABLES]  ◀──  [CLIENTS]                 │ │
│ │                                                           │ │
│ └───────────────────────────────────────────────────────────┘ │
│  ┌─ Timeline ─────────────────────────────────────────────┐   │
│  │  ●━━━━━━━━━━━━━━━━━━╸○──────────────────────────────── │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─ Satisfaction ─────────────────────────────────────────┐   │
│  │  😊 Satisfaction globale              73% ▲ (+3%)      │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │████████████████████│░░░░░░░░░░│░░░░░░│░░│        │  │   │
│  │  │  #27ae60  43%      │#f39c12 33│#e67e22│🔴│        │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │  😊 43%      😐 33%      😟 17%      😡 7%            │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

---

## Design détaillé

### Structure de la barre (hauteur fixe 38px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [emoji] Satisfaction globale                    [pct]% [flèche] ([delta]%) │  ← ligne 1
│  ┌─────────────────────────────────────────────────────────────────────┐    │  ← ligne 2
│  │ segment vert │ segment jaune │ segment orange │ segment rouge      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  😊 [n]%        😐 [n]%          😟 [n]%          😡 [n]%                  │  ← ligne 3
└──────────────────────────────────────────────────────────────────────────────┘
```

### Ligne 1 — Label + pourcentage + tendance

| Élément | Valeur | Style |
|---|---|---|
| Emoji | `satisfactionEmoji(avgSat)` | fontSize 14 |
| Label | `"Satisfaction globale"` | fontSize 11, color `#666`, fontWeight `bold` |
| Pourcentage | `Math.round(avgSat * 100) + "%"` | fontSize 13, fontWeight `bold`, couleur dynamique |
| Flèche tendance | `▲` / `▼` / `─` | fontSize 11, vert si ▲, rouge si ▼, gris si ─ |
| Delta | `(+3%)` / `(-5%)` / `(=)` | fontSize 10, même couleur que la flèche |

**Couleur dynamique du pourcentage** :

| Score | Couleur |
|---|---|
| ≥ 70% | `#27ae60` (vert) |
| 50–70% | `#f39c12` (jaune-orange) |
| < 50% | `#e74c3c` (rouge) |

### Ligne 2 — Barre segmentée (stacked bar)

4 segments côte à côte, chacun proportionnel au % de clients dans cette catégorie :

| Segment | Couleur | Condition | Texte dans le segment |
|---|---|---|---|
| Très satisfait | `#27ae60` | satisfaction ≥ 0.8 | rien (trop petit) |
| Satisfait | `#f39c12` | 0.5 ≤ sat < 0.8 | rien |
| Mécontent | `#e67e22` | 0.2 ≤ sat < 0.5 | rien |
| Très mécontent | `#e74c3c` | sat < 0.2 | rien |

- Hauteur de la barre : **8px**
- Border-radius : **4px** (arrondi aux extrémités)
- Chaque segment a `transition: width 0.4s ease` pour animer les changements
- Si un segment est à 0%, il n'est pas rendu (pas de div vide)

### Ligne 3 — Légende compacte

4 items en ligne avec emojis + pourcentage en gras coloré :

```
😊 43%      😐 33%      😟 17%      😡 7%
```

| Item | Emoji | Couleur du % |
|---|---|---|
| Très satisfait | 😊 | `#27ae60` |
| Satisfait | 😐 | `#f39c12` |
| Mécontent | 😟 | `#e67e22` |
| Très mécontent | 😡 | `#e74c3c` |

### Fond dynamique du conteneur

Le fond du conteneur change subtilement selon le score global pour donner un feedback visuel immédiat :

| Score global | Background | Border-left |
|---|---|---|
| ≥ 70% | `#eafaf1` (vert très pâle) | `3px solid #27ae60` |
| 50–70% | `#fef9e7` (jaune pâle) | `3px solid #f39c12` |
| < 50% | `#fdecea` (rouge pâle) | `3px solid #e74c3c` |

---

## Source de données

### Calcul de la satisfaction

On réutilise **`generateClientDetails()`** de `src/detailGenerators.ts` (déjà existant).

```typescript
// Dans le main component BreweryProcessChart :
const customerCount = currentValues['CustomerProbe'] ?? 0;
const clients = generateClientDetails(scenario, currentStep ?? 0, customerCount);
```

Chaque `ClientDetail` a un champ `satisfaction` (0.0 → 1.0) calculé via :  
`satisfaction = max(0, 1.0 - waitMinutes * 0.08)`

### Calcul des groupes

```typescript
const veryHappy = clients.filter(c => c.satisfaction >= 0.8).length;
const happy     = clients.filter(c => c.satisfaction >= 0.5 && c.satisfaction < 0.8).length;
const unhappy   = clients.filter(c => c.satisfaction >= 0.2 && c.satisfaction < 0.5).length;
const veryUnhappy = clients.filter(c => c.satisfaction < 0.2).length;
const total = clients.length || 1; // avoid /0
const avgSat = clients.reduce((a, c) => a + c.satisfaction, 0) / total;
```

### Calcul de la tendance (delta vs step précédent)

```typescript
const prevStep = steps[Math.max(0, stepIdx - 1)];
const prevCustomerCount = dataMap.get(scenario)?.get(prevStep)?.get('CustomerProbe') ?? 0;
const prevClients = generateClientDetails(scenario, prevStep ?? 0, prevCustomerCount);
const prevAvgSat = prevClients.length > 0
  ? prevClients.reduce((a, c) => a + c.satisfaction, 0) / prevClients.length
  : 0;
const deltaSat = avgSat - prevAvgSat;
```

---

## Architecture technique

### Position dans le layout

```
outerDiv (flex column)
  ├── barStyle          (control bar — noir, flexShrink: 0)
  ├── svgArea           (flex: 1, SVG + popup)
  ├── timelineStyle     (slider — gris clair, flexShrink: 0)
  └── satisfactionBar   (NOUVEAU — ~38px, fond dynamique, flexShrink: 0)
```

### Composant `SatisfactionBar`

Défini comme une **fonction React** dans `BreweryProcessChart.tsx` (même pattern que `StockContent`, `PrepContent`, etc.).

```typescript
interface SatisfactionBarProps {
  clients: ClientDetail[];
  prevClients: ClientDetail[];
}

function SatisfactionBar({ clients, prevClients }: SatisfactionBarProps) {
  // ... calculs + rendu
}
```

### Visibilité conditionnelle

La barre n'apparaît que si `customerCount > 0` (pas de barre vide au step 0 si aucun client).

---

## Plan d'exécution (ordre strict)

### Phase V2.2-1 — Calcul satisfaction dans le composant principal

> **Fichier à modifier : `src/BreweryProcessChart.tsx`**

1. Ajouter un `useMemo` qui calcule les données de satisfaction à partir de `currentValues['CustomerProbe']` :
   - Appel `generateClientDetails(scenario, currentStep, customerCount)`
   - Calcul des 4 groupes (veryHappy, happy, unhappy, veryUnhappy)
   - Calcul `avgSat` (moyenne)
   - Calcul `deltaSat` vs step précédent (même logique avec `prevStep`)
2. Encapsuler dans un objet `satisfactionData` :
   ```typescript
   const satisfactionData = useMemo(() => {
     const customerCount = currentValues['CustomerProbe'] ?? 0;
     if (customerCount <= 0) return null;
     const clients = generateClientDetails(scenario, currentStep ?? 0, customerCount);
     // ... calculs
     return { avgSat, deltaSat, groups, total: clients.length };
   }, [scenario, currentStep, currentValues, steps, stepIdx, dataMap]);
   ```

### Phase V2.2-2 — Composant `SatisfactionBar`

> **Fichier à modifier : `src/BreweryProcessChart.tsx`**

Ajouter le composant `SatisfactionBar` entre `PopupContent` et `StationCard` (zone des sous-composants).

**Props** :
```typescript
interface SatisfactionBarProps {
  avgSat: number;       // 0.0–1.0
  deltaSat: number;     // diff vs previous step
  groups: { veryHappy: number; happy: number; unhappy: number; veryUnhappy: number };
  total: number;        // nombre total de clients
}
```

**Rendu** :
```tsx
function SatisfactionBar({ avgSat, deltaSat, groups, total }: SatisfactionBarProps) {
  const pct = Math.round(avgSat * 100);
  const pctColor = pct >= 70 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c';
  const bg = pct >= 70 ? '#eafaf1' : pct >= 50 ? '#fef9e7' : '#fdecea';
  const border = pct >= 70 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c';

  // Tendance
  const arrow = deltaSat > 0.01 ? '▲' : deltaSat < -0.01 ? '▼' : '─';
  const arrowColor = deltaSat > 0.01 ? '#27ae60' : deltaSat < -0.01 ? '#e74c3c' : '#999';
  const deltaText = deltaSat > 0.01 ? `(+${Math.round(deltaSat * 100)}%)`
                   : deltaSat < -0.01 ? `(${Math.round(deltaSat * 100)}%)`
                   : '(=)';

  // Segments (% du total)
  const segs = [
    { w: groups.veryHappy / total * 100,  color: '#27ae60' },
    { w: groups.happy / total * 100,      color: '#f39c12' },
    { w: groups.unhappy / total * 100,    color: '#e67e22' },
    { w: groups.veryUnhappy / total * 100, color: '#e74c3c' },
  ];

  return (
    <div style={{
      padding: '5px 14px 6px',
      background: bg,
      borderLeft: `3px solid ${border}`,
      flexShrink: 0,
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      {/* Ligne 1 — Label + pct + tendance */}
      ...
      {/* Ligne 2 — Stacked bar */}
      ...
      {/* Ligne 3 — Légende emojis */}
      ...
    </div>
  );
}
```

### Phase V2.2-3 — Intégration dans le JSX principal

> **Fichier à modifier : `src/BreweryProcessChart.tsx`**

Ajouter `<SatisfactionBar>` après le `<div style={timelineStyle}>` et avant la fermeture du `</div>` outerDiv :

```tsx
      {/* ── Timeline ─── */}
      <div style={timelineStyle}>...</div>

      {/* ── Satisfaction bar (NOUVEAU) ─── */}
      {satisfactionData && (
        <SatisfactionBar
          avgSat={satisfactionData.avgSat}
          deltaSat={satisfactionData.deltaSat}
          groups={satisfactionData.groups}
          total={satisfactionData.total}
        />
      )}

    </div> {/* fin outerDiv */}
```

### Phase V2.2-4 — Build + test + commit

1. `npm run build` — 0 erreurs TypeScript
2. Hard refresh `localhost:9000`
3. Tester :
   - [ ] Barre visible sous la timeline quand CustomerProbe > 0
   - [ ] Barre absente au step 0 si aucun client
   - [ ] Fond vert/jaune/rouge change selon le score
   - [ ] Bordure gauche colorée correctement
   - [ ] Barre segmentée : proportions cohérentes avec les données
   - [ ] Segments animés (transition width) quand le step avance
   - [ ] Flèche tendance ▲/▼/─ correcte vs step précédent
   - [ ] Delta % affiché correctement
   - [ ] Changement de scénario → satisfaction change
   - [ ] Play ▶ : la barre se met à jour en temps réel
   - [ ] Emojis légende : couleurs correctes
4. `git add -A && git commit -m "feat: V2.2 global satisfaction bar below timeline"`
5. `git push origin v2-brewery-process`

---

## Fichiers impactés

| Fichier | Action | Description |
|---|---|---|
| `src/BreweryProcessChart.tsx` | **MODIFIER** | `useMemo` satisfaction + composant `SatisfactionBar` + JSX |
| `src/detailGenerators.ts` | **AUCUN** | `generateClientDetails()` déjà existant |
| `src/types.ts` | **AUCUN** | `ClientDetail` déjà défini |
| `src/plugin/buildQuery.ts` | **AUCUN** | Pas de changement |
| `src/plugin/controlPanel.ts` | **AUCUN** | Pas de changement |
| `src/plugin/transformProps.ts` | **AUCUN** | Pas de changement |

---

## Contraintes techniques

1. **Zéro nouveau fichier** — Tout dans `BreweryProcessChart.tsx`
2. **Réutilise `generateClientDetails()`** — Même PRNG seedé, mêmes données
3. **`flexShrink: 0`** — La barre ne se compresse pas quand le chart est petit
4. **Transitions CSS** — `transition: width 0.4s ease` sur les segments, `transition: color 0.3s ease` sur le %
5. **Pas de nouvelles dépendances**
6. **`npm run build` doit passer** — TypeScript strict
7. **Compatible React 16.13.1**

---

## Critères de succès

1. ✅ Barre visible sous la timeline avec score global
2. ✅ 4 segments colorés proportionnels aux groupes de satisfaction
3. ✅ Fond + bordure gauche changent de couleur selon le score
4. ✅ Flèche tendance ▲/▼ avec delta %
5. ✅ Légende emoji compacte en une ligne
6. ✅ Transitions animées sur les segments
7. ✅ Données déterministes (PRNG seedé)
8. ✅ Barre masquée si 0 clients
9. ✅ Se met à jour en temps réel pendant le play
10. ✅ `npm run build` passe sans erreur
