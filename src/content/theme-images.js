/*
 * MoodleTweaks — content/theme-images.js
 * Motor de entintado de imagenes (dos tonos).
 * Convierte las imagenes a una paleta binaria — sombras hacia el color de
 * texto y luces hacia el color de superficie — tomada de los design tokens de
 * MoodleTweaks.
 * Solo se invoca en la pagina principal ("/" o "/index.php"); los helpers se
 * exponen en globalThis.MoodleTweaks para que los use moodle-tweaks.js.
 */
(function () {
  "use strict";

  const shared = globalThis.MoodleTweaks || (globalThis.MoodleTweaks = {});

  const DEFAULT_QUALITY = 2.7;
  const DEFAULT_POINT = 200;
  const QUALITY_KEY = "moodleTweaksHomeQuality";

  const api = globalThis.chrome || globalThis.browser;

  function storageGet(key) {
    if (!api || !api.storage || !api.storage.local) {
      return Promise.resolve({});
    }
    return new Promise(function (resolve) {
      try {
        api.storage.local.get(String(key), function (result) {
          resolve(result || {});
        });
      } catch (err) {
        resolve({});
      }
    });
  }

  function storageSet(payload) {
    if (!api || !api.storage || !api.storage.local) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      try {
        const maybe = api.storage.local.set(payload);
        if (maybe && typeof maybe.then === "function") {
          maybe.then(resolve, resolve);
        } else {
          resolve();
        }
      } catch (err) {
        resolve();
      }
    });
  }

  function hexToRgb(color) {
    if (!color) return { r: 0, g: 0, b: 0, a: 0 };
    color = color.trim();
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1,
        };
      }
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 1,
        };
      }
      if (hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: parseInt(hex.slice(6, 8), 16) / 255,
        };
      }
    }
    const match = color.match(
      /rgba?\([\s]*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?[\s]*\)/i
    );
    if (match) {
      const alpha = match[4] === undefined ? 1 : parseFloat(match[4]);
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
        a: Number.isNaN(alpha) ? 1 : alpha,
      };
    }
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // La portada de EVA vive en "/" o "/index.php". En cualquier otra pagina el
  // contenido (fotos de actividades, avatares, etc.).
  function isHomepage() {
    const path = globalThis.location && globalThis.location.pathname;
    return path === "/" || path === "/index.php";
  }

  // Este par de colores hace que la caché se invalide sola cuando cambia la
  // paleta (p. ej. al prender el modo oscuro): los tonos quedan en la clave.
  function saltFor(color1, color2, point) {
    const tag = function (color) {
      if (!color) return "none";
      return (
        color.r +
        "x" +
        color.g +
        "x" +
        color.b +
        (color.a !== 1 ? "o" + Math.round(color.a * 255) : "")
      );
    };
    return tag(color1) + ":" + tag(color2) + ":" + point;
  }

  let cachedQuality;

  function readQuality() {
    if (cachedQuality !== undefined) {
      return Promise.resolve(cachedQuality);
    }
    return storageGet(QUALITY_KEY).then(function (result) {
      const value = Number(result && result[QUALITY_KEY]);
      cachedQuality = Number.isFinite(value) && value > 0 ? value : DEFAULT_QUALITY;
      return cachedQuality;
    });
  }

  // Pinta una sola imagen en dos tonos y guarda el resultado (data URL) en
  // chrome.storage.local para no repetir el trabajo en cada visita.
  function themeImage(element, key, color1, color2, point) {
    return new Promise(function (resolve) {
      if (!element || !element.src) return resolve();
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onerror = function () {
        resolve();
      };
      img.onload = function () {
        readQuality().then(function (quality) {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", {
              willReadFrequently: true,
            });
            if (!ctx) return resolve();
            ctx.imageSmoothingEnabled = true;
            const width = element.naturalWidth || element.width || 0;
            const height = element.naturalHeight || element.height || 0;
            canvas.width = Math.max(1, Math.round(width * quality));
            canvas.height = Math.max(1, Math.round(height * quality));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
              if (avg < point && color1.a !== 0) {
                data[i] = color1.r;
                data[i + 1] = color1.g;
                data[i + 2] = color1.b;
              } else if (avg > point && color2.a !== 0) {
                data[i] = color2.r;
                data[i + 1] = color2.g;
                data[i + 2] = color2.b;
              }
            }
            ctx.putImageData(imageData, 0, 0);
            const png = canvas.toDataURL("image/png", 1);
            element.src = png;
            storageSet({ [key]: png });
            resolve();
          } catch (error) {
            // Canvas no disponible (imagen tainted) o almacenamiento lleno.
            resolve();
          }
        });
      };
      img.src = element.src;
    });
  }

  // Procesa una lista de imagenes. options: { color1, color2, point }. Si no
  // se pasan colores, usa los tokens de la pagina (texto = sombras,
  // superficie = luces), por lo que sigue el modo oscuro automaticamente.
  async function processImages(elements, prefix, options = {}) {
    const color1 = hexToRgb(options.color1 || fallbackColors().color1);
    const color2 = hexToRgb(options.color2 || fallbackColors().color2);
    const point = options.point === undefined ? DEFAULT_POINT : options.point;
    const salt = saltFor(color1, color2, point);
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const key = prefix + ":" + salt + ":" + i;
      const cached = await storageGet(key);
      if (cached && cached[key]) {
        element.src = cached[key];
      } else {
        await themeImage(element, key, color1, color2, point);
      }
    }
  }

  function fallbackColors() {
    const root =
      (globalThis.document && globalThis.document.documentElement) || null;
    let text = "#ffffff";
    let surface = "#232d37";
    if (root) {
      try {
        const cs = globalThis.getComputedStyle(root);
        text = cs.getPropertyValue("--moodle-tweaks-border").trim() || surface;
        surface =cs.getPropertyValue("--moodle-tweaks-text").trim() || text;
          
      } catch (err) {
        /* tokens no disponibles */
      }
    }
    return { color1: text, color2: surface };
  }

  shared.hexToRgb = hexToRgb;
  shared.isHomepage = isHomepage;
  shared.themeImage = themeImage;
  shared.processImages = processImages;
  shared.fallbackColors = fallbackColors;
  shared.IMAGE_PREFIX = "moodleTweaksHomeImg";
})();