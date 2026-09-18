# Contributing a MoodleTweaks

Gracias por querer colaborar. Este archivo resume el flujo de trabajo, las
convenciones del código y qué conviene saber antes de tocar algo.

## Stack y requisitos

- **Node.js 20+** (CI corre en Node 20 y 22). Sin build de desarrollo: los
  archivos de `src/` se cargan tal cual en el navegador.
- `npm install` una sola vez. Todo es devDependency.

## Instalación y recarga

- **Chrome / Edge / Brave**: `chrome://extensions` → modo desarrollador →
  *Cargar descomprimida* → raíz del repo.
- **Firefox**: `about:debugging#/runtime/this-firefox` → *Cargar complemento
  temporal* → `manifest.json`. Para recarga automática: `web-ext run`.

Al cargar descomprimida, el manifest raíz conserva `background.service_worker`
**y** `background.scripts` para que funcione en ambos navegadores; el build
genera versiones limpias por destino.

## Antes de escribir código

La extensión es un set de **módulos independientes**, cada uno prendido con una
clave en los settings y (salvo los que son 100% JS) gateado por una clase en
`<html>` con prefijo `moodle-tweaks-*`:

| Nivel | Archivo | Qué define |
| --- | --- | --- |
| Defaults + normalización | `src/shared/settings.js` | Esquema exacto en `chrome.storage`. |
| Aplicación de clases | `src/content/moodle-tweaks.js` | `CLASS_MAP`, cache, barra, badge, observador. |
| Estilos | `src/content/css/<modulo>.css` | Todo anidado bajo `html.moodle-tweaks-<modulo>`. |
| Popup | `src/popup/` | UI de configuración (escribe `chrome.storage.sync`). |
| Service worker | `src/background/service-worker.js` | Badge y onboarding. |

Cambios de settings que toquen el esquema: sumar la clave a los defaults en
`settings.js`, la normalización, el `CLASS_MAP` si gatera una clase, el popup si
tiene UI y el objeto `activeSettings()` en el content script (para el estado
"maestro apagado"). No olvidar el test de normalización.

## Convenciones

- **CSS**: *native nesting*, sin preprocesador. Cada regla vive anidada bajo
  `html.moodle-tweaks-<modulo>` (Chrome 112+ / Firefox 117+). `dark.css` y
  `compact.css` se cargan al final para ganar empates de especificidad.
- **Selector de clase**: prefijo `moodle-tweaks-*` (kebab). Elementos del popup
  usan el mismo prefijo como bloque BEM (`moodle-tweaks-item`,
  `moodle-tweaks-upcoming-bar__label`).
- **Sin `eval` ni script inline** — los `<style>`/`<script>` se crean por DOM.
- **Comentarios en español**, cortos, explicando el *por qué* (no el qué).
- **Settings scheme**: las claves de storage usan camelCase
  (`moodleTweaksSettings`, `moodleTweaksSettingsCache`), las de CSS kebab-case
  (`moodle-tweaks-dark`, `--moodle-tweaks-font-scale`). No mezclarlas.

### El contrato de la cache

El content script escribe un espejo de los settings en el `localStorage` del
sitio (clave `moodleTweaksSettingsCache`) y lo lee sincrónicamente en
`document_start` para evitar el flash al navegar. Reglas:

- Todo módulo que aplique clases/estilos **debe** reflejarse en esa cache: se
  lee con `readCache()` y se reescribe en `applySettings()`.
- La cache es un snapshot best-effort: `normalize()` la completa con los
  defaults al leerla; nunca confíes en que traiga todas las claves.

## Tests

```bash
npm test        # runner nativo + jsdom
npm run lint    # ESLint (JS) + Stylelint (CSS)
npm run build   # valida versión + empaqueta dist/ y zips
npm run lint:firefox
```

- Los tests evalúan **los archivos reales de `src/`** contra jsdom, así que
  actualizar `src/` estira la cobertura automáticamente.
- El harness (`test/helpers.js`) inyecta un `chrome.storage` falso, una cache y
  un polyfill de `requestAnimationFrame`. Usá `makeChromeMock`, `settle` y
  `closeEnv`; nunca tomes atajos con `window.close()` sin `settle`.
- Un módulo nuevo necesita al menos: un test de settings (si cambia el esquema)
  y un test del content script (si agrega clases/DOM).

## Git y releases

- Ramas cortas y commits atómicos, en inglés o español, describiendo el "qué".
- La versión vive **en dos lugares** que deben coincidir: `manifest.json` y
  `package.json` (el build falla si divergen).
- Publicar = `npm run build` local + tag `v<versión>` + push. El workflow
  `release.yml` corre tests, lintea el paquete de Firefox y crea un *draft*
  Release con los zips.

## Gotchas que ya nos mordieron

- En dark mode, un override cuyo selector empata en especificidad con el tema
  `fing` **pierde** (el CSS del tema llega después). Comprobá siempre la
  complejidad del selector del tema antes de escribir el override.
- Gradientes/backgrounds inline en el modo oscuro: hay que neutralizar también
  `background-image`, no solo `background-color`.
- `:not()` encadenados dentro de un `:where()` **deben** vivir en una sola
  línea: un salto de línea los vuelve comodines y silenciosamente neutraliza la
  exclusión.

Más detalle sobre modo oscuro: [`docs/dark-mode.md`](docs/dark-mode.md).