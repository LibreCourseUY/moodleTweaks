# Features

Guía de cada módulo: qué hace, en qué archivo vive y cómo interactúa con el
resto. La tabla de resumen con claves de settings y clases está en el
[README](../README.md#características); acá entra el detalle.

## Theme (`theme`)

`html.moodle-tweaks-theme` · `src/content/css/base.css`

La base del aspecto. Define los *design tokens* (`--moodle-tweaks-*`: paleta,
superficies, radius, sombras, tipografía), la escala de fuente
(`--moodle-tweaks-font-scale`), la reforma de componentes compartidos (botones,
links, inputs, tablas, tarjetas) y la accesibilidad (focos reforzados,
`prefers-reduced-motion`).

Depende de nada. Todos los demás módulos consumen sus tokens.

## Modo oscuro (`dark` + `darkAuto` + `darkVariant`)

`html.moodle-tweaks-dark` / `html.moodle-tweaks-dark-dim` /
`html.moodle-tweaks-dark-amoled` · `src/content/css/dark.css` + JS en
`moodle-tweaks.js`

- `dark` enciende el modo oscuro manualmente.
- `darkAuto` lo deriva de `prefers-color-scheme`; cuando está prendido, un
  listener reacciona a los cambios de preferencia del sistema en vivo. Si
  `darkAuto` está activo, el toggle manual de `dark` se deshabilita en el popup.
- `darkVariant` ajusta la variante: `default`, `dim` (intermedio) o `amoled`
  (negro puro). Se traduce a las clases `moodle-tweaks-dark-dim`/
  `moodle-tweaks-dark-amoled` sobre `moodle-tweaks-dark`.

Es el módulo con más trampas del tema default. Todas documentadas en
[`docs/dark-mode.md`](docs/dark-mode.md).

## Escala de fuente (`fontScale`) y densidad (`density`)

- `fontScale` (85–130) se escribe como CSS custom property
  `--moodle-tweaks-font-scale` sobre `<html>`; `base.css` la aplica a los
  elementos textuales. En 100 se quita la propiedad (state neutro).
- `density` (`comfortable` | `compact`) prende `html.moodle-tweaks-compact`,
  definido en `src/content/css/compact.css` (se carga al final). Los valores
  legados con la clave booleana `compact` migran automáticamente en
  `settings.js`.

## Navegación (`navigation`)

`html.moodle-tweaks-navigation` · `src/content/css/navigation.css`

Refina la barra superior (búsqueda expandida solo en escritorio, sombra,
distancias), contexto de curso, migas, submenús, índice lateral y el menú de
usuario. En móvil se respeta el comportamiento original del tema.

## Contenido de cursos (`activities`)

`html.moodle-tweaks-activities` · `src/content/css/course.css`

Secciones (`format_onetopic`, tabs), tarjetas de actividad, estados de
finalización, badges, etiquetas/libre y disponibilidad. No toca la rejilla
interna de la actividad (la define el tema).

## Foros (`forum`) y resaltados (`highlight`)

`html.moodle-tweaks-forum` / `html.moodle-tweaks-highlight` ·
`src/content/css/forum.css`, `src/content/css/highlight.css` + JS

- `forum` da forma a las listas y publicaciones.
- `highlight` marca posts propios con `moodle-tweaks-mine` (comparando el
  `data-userid` del popover de notificaciones contra `user/view.php?id=`) y
  resalta no leídos / estados. El re-escaneo de posts dinámicos lo hace un
  `MutationObserver` sobre todo el documento, **filtrado por mutaciones que
  agregan `.forumpost`** y coalescido con `requestAnimationFrame` para no barrer
  el documento en cada mutación de páginas grandes (ver `moodle-tweaks.js`).

## Calendario (`calendar`) y próximas entregas (`upcoming`)

`html.moodle-tweaks-calendar` / `html.moodle-tweaks-upcoming` ·
`src/content/css/calendar.css`, `src/content/css/upcoming.css` + JS

- `calendar` limpia la vista mensual (rejilla, hoy, eventos pasados/futuros).
- `upcoming` agrega una barra fija con tareas y eventos próximos. Consulta
  `core_calendar_get_action_events_by_timesort` vía
  `/lib/ajax/service.php` con el `sesskey` de la página y cachea el resultado
  en (`moodleTweaksUpcomingCache`); el botón de cerrar recuerda su estado en
  (`moodleTweaksUpcomingHidden`). Se apoya en el módulo `calendar`.

## Panel limpio (`cleanDashboard`)

`html.moodle-tweaks-dashboard` + JS · `src/content/css/dashboard.css`

Oculta el banner gigante, compacta los bloques de cursos y **colapsa el índice
del curso** haciendo clic en el propio toggle de Moodle (así la preferencia se
persiste en el servidor). Solo actúa cuando el cajón arranca abierto.

## Imágenes de portada (`homeImages`)

`src/content/theme-images.js` + JS en `moodle-tweaks.js`

Solo en la página principal (`/` o `/index.php`), convierte las imágenes del
banner y de las tarjetas de cursos a **dos tonos**: las sombras toman el color
de texto y las luces el color de superficie de los tokens de MoodleTweaks, por
lo que sigue el modo oscuro y sus variantes automáticamente.

- `theme-images.js` es el motor de entintado: dibuja la
  imagen en un canvas (con `quality` 2.7, configurable en
  `moodleTweaksHomeQuality`), separa cada píxel según su brillo contra el
  umbral `point` (200) y cachea el resultado en `chrome.storage.local`. La
  clave de caché incluye los colores usados, así que al cambiar la paleta se
  re-entinta sin reutilizar datos viejos.
- `moodle-tweaks.js` selecciona las imágenes candidatas (descarta iconos del
  tema, avatares, logos, data URLs y miniaturas < 64 px), guarda el `src`
  original en un `data-` attribute y lo restaura al apagar la feature o al
  cambiar de paleta (p. ej. al prender el modo oscuro).

## Botón volver arriba (`backToTop`)

100% JS (`moodle-tweaks.js`) · `src/content/css/back-to-top.css`

Botón flotante inyectado en `body` que aparece al superar 400 px de scroll
(respeta `prefers-reduced-motion`). Se elimina del DOM al apagarse.

## Contador en el ícono (`toolbarBadge`)

`src/content/moodle-tweaks.js` → `src/background/service-worker.js`

El content script cuenta avisos/mensajes/entregas en la página y se los manda
por `chrome.runtime.sendMessage` al service worker, que los pinta como badge.
Se limpia al apagarse.

## Onboarding (`src/welcome/`)

Al instalarse (no al actualizar) el service worker abre la página de bienvenida,
que lista las features y muestra la versión desde `settings.js`.

## CSS personalizado (`customCss`)

El content script inyecta un `<style id="moodle-tweaks-custom-css">` con el
texto crudo (via `textContent`, no HTML). Se elimina si queda vacío y el popup
persiste la caja con un debounce.

## Impresión

`print.css` (siempre activo) recorta colores, colapsa la navegación y deja solo
el contenido. No está gateado por clases.