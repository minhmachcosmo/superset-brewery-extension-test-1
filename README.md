# 📊 Superset Brewery Extension Test 1

Extension Apache Superset pour visualiser des simulations de stock de bar avec des graphiques interactifs.

## 🚀 Quick Start

### Build du Plugin

```bash
npm ci
npm run build
```

### Mode Développement

```bash
npm run dev
```

### Installation dans Superset

```bash
# Dans superset-frontend/
npm i -S ../../superset-brewery-extension-test-1
```

## 📚 Documentation Complète

- **[USAGE.md](USAGE.md)** - Guide d'utilisation et configuration
- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - Installation et intégration dans Superset
- **[LLM_GUIDE.md](LLM_GUIDE.md)** - Guide pour LLMs (standards du projet)

## 🎯 Features

- ✅ Graphique en ligne interactif avec ECharts
- ✅ Comparaison multi-scénarios
- ✅ Zoom et navigation
- ✅ Export d'images
- ✅ Configuration flexible (axes, séries, style)

## 🔗 Links

- [GitHub Repository](https://github.com/minhmachcosmo/superset-brewery-extension-test-1)
- [Apache Superset](https://superset.apache.org)

---

### Installation Complète

Pour l'installation complète de Superset et l'intégration, voir **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)**

If your Superset plugin exists in the `superset-frontend` directory and you wish to resolve TypeScript errors about `@superset-ui/core` not being resolved correctly, add the following to your `tsconfig.json` file:

```
"references": [
  {
    "path": "../../packages/superset-ui-chart-controls"
  },
  {
    "path": "../../packages/superset-ui-core"
  }
]
```

You may also wish to add the following to the `include` array in `tsconfig.json` to make Superset types available to your plugin:

```
"../../types/**/*"
```

Finally, if you wish to ensure your plugin `tsconfig.json` is aligned with the root Superset project, you may add the following to your `tsconfig.json` file:

```
"extends": "../../tsconfig.json",
```

After this edit the `superset-frontend/src/visualizations/presets/MainPreset.js` and make the following changes:

```js
import { SupersetBreweryExtensionTest1 } from 'superset-brewery-extension-test-1';
```

to import the plugin and later add the following to the array that's passed to the `plugins` property:
```js
new SupersetBreweryExtensionTest1().configure({ key: 'superset-brewery-extension-test-1' }),
```

After that the plugin should show up when you run Superset, e.g. the development server:

```
npm run dev-server
```
