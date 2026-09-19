# MoodleTweaks

> [!IMPORTANT]
> LibrecourseUY es un proyecto de software open source, independiente y comunitario. Las herramientas, funcionalidades y recursos disponibles en esta plataforma incluyendo "MoodleTweaks" fueron creados y mantenidos por miembros, contribuidores y colaboradores de LibrecourseUY.
>
> La herramienta "MoodleTweaks" no está afiliada, asociada, patrocinada, avalada, autorizada ni respaldada por ninguna institución educativa u organización, incluyendo sin limitarse a la Universidad de la República (UdelaR) y la Facultad de Ingeniería (FING), ni por cátedras, docentes, unidades académicas o dependencias administrativas.
>
> Cualquier referencia a nombres, siglas, materias, planes de estudio, marcas o instituciones se utiliza únicamente con fines descriptivos e informativos, y no implica relación institucional, aprobación ni carácter oficial.
>
> El software y el contenido asociado se proporcionan "tal cual" (AS IS), sin garantías de ningún tipo. El uso del proyecto es bajo su propia responsabilidad.
>
> Al continuar, usted reconoce y acepta estos términos, y que cualquier interpretación de oficialidad es incorrecta.


Extensión de navegador (Manifest V3 para Chrome y Firefox) que mejora la
navegación y unifica el estilo visual de [EVA FING](https://eva.fing.edu.uy/),
el entorno virtual de la Facultad de Ingeniería (Moodle 4.x con el tema
`fing`).

Aplica una estética consistente, agrega modo oscuro (manual, automático y con
variantes AMOLED/dim), escala tipográfica y densidad ajustables, y pule
componentes clave como la barra de navegación, los foros, el calendario y el
panel principal. Incluye además una barra de próximas entregas, un contador en
el ícono, una caja de CSS personalizado y estilos de impresión.

## Características

Cada módulo se activa o desactiva desde el popup. Los módulos basados en CSS
se controlan con una clase en `<html>`; los demás se implementan en el content
script o en el service worker.

| Módulo | Clave | Clase / implementación | Descripción |
| --- | --- | --- | --- |
| Tema consistente | `theme` | `html.moodle-tweaks-theme` | Paleta, tipografía y componentes uniformes (base). |
| Modo oscuro | `dark` | `html.moodle-tweaks-dark` | Superficies y texto oscuros. |
| Oscuro automático | `darkAuto` | `prefers-color-scheme` | Sigue la preferencia del sistema. |
| Variante de oscuro | `darkVariant` | `html.moodle-tweaks-dark-dim` · `html.moodle-tweaks-dark-amoled` | Estándar, tenue (*dim*) o negro puro (AMOLED). |
| Escala de fuente | `fontScale` | `--moodle-tweaks-font-scale` | Escala todo el texto entre 85 % y 130 %. |
| Densidad | `density` | `html.moodle-tweaks-compact` | Vista cómoda o compacta. |
| Navegación mejorada | `navigation` | `html.moodle-tweaks-navigation` | Barra, migas, submenús e índice del curso. |
| Resaltar elementos | `highlight` | `html.moodle-tweaks-highlight` | Activos, no leídos y tus publicaciones. |
| Botón "volver arriba" | `backToTop` | JS (`moodle-tweaks.js`) | Botón flotante que aparece al hacer scroll. |
| Contenido de cursos | `activities` | `html.moodle-tweaks-activities` | Secciones, actividades y listados. |
| Foros | `forum` | `html.moodle-tweaks-forum` | Debates y publicaciones más legibles. |
| Calendario | `calendar` | `html.moodle-tweaks-calendar` | Vista mensual clara y ordenada. |
| Panel limpio | `cleanDashboard` | `html.moodle-tweaks-dashboard` + JS | Oculta el banner gigante y colapsa el índice del curso. |
| Próximas entregas | `upcoming` | JS + `html.moodle-tweaks-upcoming` | Barra con tareas y eventos próximos (web service del calendario). |
| Contador en el ícono | `toolbarBadge` | JS + service worker | Badge con avisos, mensajes y entregas próximas. |
| CSS personalizado | `customCss` | `<style>` inyectado | Override para usuarios avanzados. |

## Instalación

La extensión no está publicada en las tiendas; se instala en modo desarrollo.

### Chrome / Edge / Brave

1. Abrí `chrome://extensions` (o `edge://extensions`).
2. Activá el **Modo de desarrollador** (arriba a la derecha).
3. Elegí **Cargar descomprimida** y seleccioná la raíz de este repositorio
   (donde está `manifest.json`).
4. Fijá MoodleTweaks a la barra de herramientas y abrilo en EVA FING.

### Firefox

1. Abrí `about:debugging#/runtime/this-firefox`.
2. Elegí **Cargar complemento temporal**.
3. Seleccioná el archivo `manifest.json`.

Requiere Firefox 140+ (142+ en Android). Para desarrollo con recarga
automática se puede usar [`web-ext`](https://extensionworkshop.com/web-ext/):
`web-ext run`.

## Uso

Hacé clic en el ícono de la extensión para abrir el popup. Ahí podés:

- Activar o desactivar todo con el interruptor maestro (`enabled`).
- Prender o apagar cada módulo por separado, con **restablecer** por fila.
- Buscar ajustes por nombre y ver si la extensión está **activa en el sitio**
  que tenés abierto.
- Ajustar el modo oscuro (manual/automático y variante), la escala de fuente y
  la densidad, y escribir tu propio CSS en **Avanzado**.
- Restablecer todos los valores por defecto.

La primera vez que se instala se abre una página de bienvenida con el resumen
de las funciones y la versión. El enlace **Bienvenida** del pie vuelve a
abrirla.

Los cambios se guardan en `chrome.storage` (sincronizado si está disponible) y
se aplican al instante en las pestañas abiertas de EVA FING.

## Estructura del proyecto

```
manifest.json              Configuración MV3 y puntos de entrada.
package.json               Metadatos y scripts de tests/build.
scripts/
  manifest-targets.mjs     Derivación del manifest por navegador (chrome/firefox).
  build.mjs                Empaquetado de dist/ y zips versionados.
src/
  shared/settings.js       Defaults, normalización y clave compartidos.
  background/
    service-worker.js      Badge del ícono y apertura de la bienvenida.
  content/
    moodle-tweaks.js          Content script: clases, barra, badge y observador.
    css/
      base.css             Tokens de diseño, escala de fuente y accesibilidad.
      navigation.css       Barra, migas, submenús, índice del curso.
      course.css           Contenido de cursos y listados.
      forum.css            Listado de debates y publicaciones.
      calendar.css         Vista mensual.
      highlight.css        Resaltados de activos/no leídos/propios.
      dashboard.css        Panel limpio (banner y cursos compactos).
      compact.css          Densidad compacta (se carga al final).
      back-to-top.css      Botón flotante (lo inyecta el content script).
      upcoming.css         Barra de próximas entregas.
      dark.css             Modo oscuro y variantes (se carga al final).
      print.css            Estilos de impresión.
  popup/
    popup.html / popup.css / popup.js
  welcome/
    welcome.html / welcome.css / welcome.js
  icons/                   Íconos (SVG + PNG en varios tamaños).
test/                      Tests con node:test + jsdom.
TODO.md                    Backlog de próximas features.
```

## Desarrollo

No hay paso de build para desarrollo: los archivos de `src/` se cargan tal
cual. Alcanza con recargar la extensión y la página. El paso de build en
`package.json` es solo para empaquetar releases (ver más abajo).

- **CSS**: se usa *native nesting* (Chrome 112+ / Firefox 117+), sin
  preprocesador. Cada módulo se anida bajo `html.moodle-tweaks-<modulo>`.
- **Orden de carga**: `dark.css` va al final para ganar los empates de
  especificidad e overridear a los demás módulos.
- **Sin `eval` ni scripts inline**, compatible con la CSP de las tiendas.

### Checks y build

Instalá las dependencias una sola vez:

```bash
npm ci        # o npm install
```

Comandos disponibles:

| Comando | Qué hace |
| --- | --- |
| `npm test` | Corre la suite (`node --test` + `jsdom`). |
| `npm run build` | Empaqueta `dist/chrome` y `dist/firefox` y genera los zips versionados. Falla si la versión de `manifest.json` y `package.json` no coinciden. |
| `npm run lint:firefox` | Valida el paquete de Firefox con el linter de AMO (`web-ext lint`). Correr después del build. |

Para correr todo como en CI: `npm test && npm run build && npm run lint:firefox`
(es lo que hace `.github/workflows/ci.yml` en cada push/PR).

Los tests corren con el runner nativo de Node (`node --test`) y `jsdom`, y
cubren la normalización/migración de settings, la lógica del content script
(clases desde cache, reconciliación con `storage`, botón volver arriba, modo
oscuro automático y variantes, escala de fuente, CSS personalizado, densidad,
panel limpio, barra de entregas y badge), el popup (búsqueda, reset por fila,
sitio activo, versión), la validez del `manifest.json` y la derivación del
manifest por navegador en `scripts/manifest-targets.mjs`.

## Empaquetado / release

El desarrollo no requiere build, pero para publicar se genera un paquete por
navegador. El único lugar donde difieren es el `manifest.json` — el código en
`src/` es idéntico:

- **Chrome / Edge / Brave**: `background.service_worker`, sin `background.scripts`
  (los reviewers de la tienda rechazan ese key).
- **Firefox**: `background.scripts` (event page), con `browser_specific_settings`.

Los comandos están en [Checks y build](#checks-y-build): `npm run build` arma
`dist/chrome` y `dist/firefox`, y `npm run lint:firefox` valida el paquete de
Firefox.

Los artefactos quedan en `dist/`: `MoodleTweaks-<versión>-chrome.zip` (sirve
también para Edge/Brave/Opera) y `MoodleTweaks-<versión>-firefox.zip`. El build
falla si la versión de `manifest.json` no coincide con la de `package.json`.

Un tag `v<versión>` (ej. `v1.1.0`) dispara el workflow **Release** en CI: corre
los tests, empaqueta, lintea el paquete de Firefox y crea un **GitHub Release**
en borrador con ambos zips adjuntos. El CI también empaqueta en cada push/PR.

## Cómo funciona

En `document_start`, el content script lee una cache del propio `localStorage`
del sitio (clave `moodleTweaksSettingsCache`) y aplica las clases `moodle-tweaks-*` **antes
del primer pintado**, para evitar el parpadeo al navegar entre páginas.
Inmediatamente después lee la configuración real de `chrome.storage`, la
reconcilia y reescribe la cache. También escucha `storage.onChanged` para
reflejar cambios en vivo.

El popup escribe en `chrome.storage.sync` (con fallback a `local`). El content
script envía al service worker el contador de avisos/mensajes/entregas, que lo
pinta como badge sobre el ícono, y la página de bienvenida usa el mismo
`shared/settings.js` para mostrar la versión.

En `dark.css` los overrides se comparan contra la especificidad del tema `fing`
(que se carga después que este content script); para no perder los empates se
usan selectores `html.moodle-tweaks-dark ...` más específicos y `!important` puntuales.

## Permisos

| Permiso | Motivo |
| --- | --- |
| `storage` | Guardar y sincronizar las preferencias. |
| `https://eva.fing.edu.uy/*` | Inyectar CSS/JS únicamente en EVA FING. |

La extensión no recolecta datos ni se comunica con servidores externos.

## Roadmap

Ver [`TODO.md`](TODO.md) para la lista de features e ideas pendientes.

## Licencia

[MIT](LICENSE) © 2026
