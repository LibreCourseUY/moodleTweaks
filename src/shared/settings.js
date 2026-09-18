/*
 * MoodleTweaks — shared/settings.js
 * Valores por defecto, clave de almacenamiento y normalización compartidos
 * entre el content script, el popup y la página de bienvenida.
 * Se expone en globalThis.MoodleTweaks.
 */
(function () {
  "use strict";

  const DEFAULTS = Object.freeze({
    enabled: true, // Interruptor maestro global
    theme: true, // Paleta y componentes consistentes (base)
    dark: false, // Modo oscuro manual
    darkAuto: false, // Seguir prefers-color-scheme
    darkVariant: "default", // "default" | "dim" | "amoled"
    navigation: true, // Barra, migas, submenus e indice del curso
    activities: true, // Contenido de cursos y listados
    forum: true, // Foros
    calendar: true, // Calendario
    highlight: true, // Resaltar activos, no leidos y publicaciones propias
    backToTop: true, // Boton "volver arriba"
    density: "comfortable", // "comfortable" | "compact"
    fontScale: 100, // Escala tipografica global (85-130 %)
    cleanDashboard: false, // Banner compacto e indice colapsado
    upcoming: false, // Barra de proximas entregas
    toolbarBadge: false, // Contador en el icono de la barra
    customCss: "", // CSS personalizado del usuario
  });

  const KEY = "moodleTweaksSettings";

  const DARK_VARIANTS = ["default", "dim", "amoled"];
  const DENSITIES = ["comfortable", "compact"];
  const MIN_FONT_SCALE = 85;
  const MAX_FONT_SCALE = 130;

  // Metadatos para que el popup y la bienvenida no dupliquen listas.
  const FEATURES = Object.freeze([
    { key: "enabled", group: "advanced", type: "boolean" },
    { key: "theme", group: "style", type: "boolean" },
    { key: "dark", group: "style", type: "boolean" },
    { key: "darkAuto", group: "style", type: "boolean" },
    { key: "darkVariant", group: "style", type: "enum" },
    { key: "fontScale", group: "style", type: "number" },
    { key: "density", group: "style", type: "enum" },
    { key: "navigation", group: "nav", type: "boolean" },
    { key: "highlight", group: "nav", type: "boolean" },
    { key: "backToTop", group: "nav", type: "boolean" },
    { key: "activities", group: "pages", type: "boolean" },
    { key: "forum", group: "pages", type: "boolean" },
    { key: "calendar", group: "pages", type: "boolean" },
    { key: "cleanDashboard", group: "pages", type: "boolean" },
    { key: "upcoming", group: "pages", type: "boolean" },
    { key: "toolbarBadge", group: "advanced", type: "boolean" },
    { key: "customCss", group: "advanced", type: "string" },
  ]);

  function clampNumber(value, min, max, fallback) {
    const num = typeof value === "number" ? value : parseFloat(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
  }

  // Combina lo almacenado con los valores por defecto, migra la vieja clave
  // booleana `compact` y sanea los tipos para que el resto del código pueda
  // asumir un objeto siempre válido.
  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const out = Object.assign({}, DEFAULTS, source);

    // Migracion: `compact: true` pasa a `density: "compact"`.
    if (source.density === undefined && source.compact !== undefined) {
      out.density = source.compact ? "compact" : "comfortable";
    }
    if (DENSITIES.indexOf(out.density) === -1) out.density = DEFAULTS.density;

    if (DARK_VARIANTS.indexOf(out.darkVariant) === -1) {
      out.darkVariant = DEFAULTS.darkVariant;
    }

    out.fontScale = clampNumber(
      out.fontScale,
      MIN_FONT_SCALE,
      MAX_FONT_SCALE,
      DEFAULTS.fontScale
    );

    out.customCss = typeof out.customCss === "string" ? out.customCss : "";

    // Interruptor maestro: ausente en datos viejos => encendido.
    out.enabled =
      source.enabled === undefined ? DEFAULTS.enabled : Boolean(source.enabled);

    // Fuerza booleanos en las claves que lo son.
    FEATURES.forEach(function (feature) {
      if (feature.type === "boolean") out[feature.key] = Boolean(out[feature.key]);
    });

    delete out.compact;
    return out;
  }

  globalThis.MoodleTweaks = {
    DEFAULTS: DEFAULTS,
    KEY: KEY,
    FEATURES: FEATURES,
    DARK_VARIANTS: DARK_VARIANTS,
    DENSITIES: DENSITIES,
    MIN_FONT_SCALE: MIN_FONT_SCALE,
    MAX_FONT_SCALE: MAX_FONT_SCALE,
    normalize: normalize,
  };
})();
