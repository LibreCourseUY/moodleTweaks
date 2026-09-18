/*
 * MoodleTweaks — content script
 * Aplica los ajustes guardados al documento y agrega mejoras que
 * requieren JavaScript (boton volver arriba, resaltar posts propios,
 * barra de proximas entregas, contador de la barra de herramientas).
 */
(function () {
  "use strict";

  const shared = globalThis.MoodleTweaks || {};
  const DEFAULTS = shared.DEFAULTS || {
    theme: true,
    dark: false,
    darkAuto: false,
    darkVariant: "default",
    navigation: true,
    activities: true,
    forum: true,
    calendar: true,
    highlight: true,
    backToTop: true,
    density: "comfortable",
    fontScale: 100,
    cleanDashboard: false,
    upcoming: false,
    toolbarBadge: false,
    customCss: "",
  };
  const STORAGE_KEY = shared.KEY || "moodleTweaksSettings";
  const normalize =
    shared.normalize ||
    function (raw) {
      return Object.assign({}, DEFAULTS, raw || {});
    };

  // Copia local (sincrona) de los ajustes. chrome.storage es asincrono y en
  // document_start todavia no respondio, asi que leemos esta cache del propio
  // sitio para aplicar el estado antes del primer pintado y evitar el
  // parpadeo al navegar entre paginas.
  const CACHE_KEY = "moodleTweaksSettingsCache";
  const UPCOMING_CACHE_KEY = "moodleTweaksUpcomingCache";
  const UPCOMING_HIDDEN_KEY = "moodleTweaksUpcomingHidden";
  const UPCOMING_TTL = 5 * 60 * 1000; // 5 minutos
  const UPCOMING_DAYS = 14;

  // Preferimos la API estilo callback (chrome) por compatibilidad Chrome/Firefox.
  const api = globalThis.chrome || globalThis.browser;
  const storageArea =
    api && api.storage ? api.storage.sync || api.storage.local : null;
  const root = document.documentElement;

  // Marcas booleanas que activan los modulos CSS.
  const CLASS_MAP = {
    theme: "moodle-tweaks-theme",
    navigation: "moodle-tweaks-navigation",
    activities: "moodle-tweaks-activities",
    forum: "moodle-tweaks-forum",
    calendar: "moodle-tweaks-calendar",
    highlight: "moodle-tweaks-highlight",
    cleanDashboard: "moodle-tweaks-dashboard",
    upcoming: "moodle-tweaks-upcoming",
  };

  let settings = Object.assign({}, DEFAULTS);
  let backToTopButton = null;
  let observationScheduled = false;
  let domReady = false;
  let upcomingRequested = false;
  let dashboardApplied = false;

  /* ---------------------------------------------------------------- utils */

  function readSettings(callback) {
    if (!storageArea) {
      callback(normalize(DEFAULTS));
      return;
    }
    try {
      storageArea.get(STORAGE_KEY, function (result) {
        const stored = result && result[STORAGE_KEY];
        callback(normalize(stored));
      });
    } catch (err) {
      callback(normalize(DEFAULTS));
    }
  }

  function readCache() {
    try {
      const raw = globalThis.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function writeCache(next) {
    try {
      globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch (err) {
      /* almacenamiento del sitio no disponible */
    }
  }

  function prefersDark() {
    try {
      return Boolean(
        globalThis.matchMedia &&
          globalThis.matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch (err) {
      return false;
    }
  }

  function prefersReducedMotion() {
    try {
      return Boolean(
        globalThis.matchMedia &&
          globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (err) {
      return false;
    }
  }

  function resolveDark(next) {
    return next.darkAuto ? prefersDark() : Boolean(next.dark);
  }

  // Un modulo esta activo solo si el interruptor maestro y su propia clave lo
  // estan.
  function featureOn(key) {
    return Boolean(settings.enabled && settings[key]);
  }

  // Cuando el interruptor maestro esta apagado, forzamos un estado neutro sin
  // tocar lo que el usuario haya configurado.
  function activeSettings() {
    if (settings.enabled) return settings;
    return Object.assign({}, settings, {
      theme: false,
      dark: false,
      darkAuto: false,
      navigation: false,
      activities: false,
      forum: false,
      calendar: false,
      highlight: false,
      backToTop: false,
      cleanDashboard: false,
      upcoming: false,
      toolbarBadge: false,
      customCss: "",
      fontScale: 100,
    });
  }

  function applyFontScale(scale) {
    const clamped = Math.min(130, Math.max(85, Number(scale) || 100));
    if (clamped === 100) {
      root.style.removeProperty("--moodle-tweaks-font-scale");
    } else {
      root.style.setProperty("--moodle-tweaks-font-scale", (clamped / 100).toFixed(3));
    }
  }

  function applyCustomCss(css) {
    let style = document.getElementById("moodle-tweaks-custom-css");
    const value = typeof css === "string" ? css : "";
    if (!value.trim()) {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = "moodle-tweaks-custom-css";
      (document.head || root).appendChild(style);
    }
    // textContent no se reparsea como HTML: no hay riesgo de romper el <style>.
    style.textContent = value;
  }

  function applyAppearance(next) {
    Object.keys(CLASS_MAP).forEach(function (key) {
      root.classList.toggle(CLASS_MAP[key], Boolean(next[key]));
    });

    root.classList.toggle("moodle-tweaks-compact", next.density === "compact");

    const dark = resolveDark(next);
    root.classList.toggle("moodle-tweaks-dark", dark);
    root.classList.toggle("moodle-tweaks-dark-dim", dark && next.darkVariant === "dim");
    root.classList.toggle(
      "moodle-tweaks-dark-amoled",
      dark && next.darkVariant === "amoled"
    );

    applyFontScale(next.fontScale);
    applyCustomCss(next.customCss);
  }

  /* ------------------------------------------------------------ back to top */

  function createBackToTop() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "moodle-tweaks-back-to-top";
    button.setAttribute("aria-label", "Volver arriba");
    button.setAttribute("title", "Volver arriba");
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M12 4l-8 8h5v8h6v-8h5z"/></svg>';

    button.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });

    const onScroll = function () {
      button.classList.toggle("is-visible", window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    button._moodletweaksScroll = onScroll;
    return button;
  }

  function syncBackToTop(enabled) {
    if (!document.body) return;
    if (enabled && !backToTopButton) {
      backToTopButton = createBackToTop();
      document.body.appendChild(backToTopButton);
    } else if (!enabled && backToTopButton) {
      if (backToTopButton._moodletweaksScroll) {
        window.removeEventListener("scroll", backToTopButton._moodletweaksScroll);
      }
      backToTopButton.remove();
      backToTopButton = null;
    }
  }

  /* --------------------------------------------------- resaltar posts propios */

  function getCurrentUserId() {
    const el = document.querySelector(
      "#nav-notification-popover-container[data-userid], .popover-region[data-userid]"
    );
    return el ? el.getAttribute("data-userid") : null;
  }

  function markOwnPosts() {
    if (!featureOn("highlight")) {
      document
        .querySelectorAll(".forumpost.moodle-tweaks-mine")
        .forEach((p) => p.classList.remove("moodle-tweaks-mine"));
      return;
    }

    const userId = getCurrentUserId();
    if (!userId) return;

    const posts = document.querySelectorAll(".forumpost:not(.moodle-tweaks-mine)");
    if (!posts.length) return;

    posts.forEach(function (post) {
      const link = post.querySelector(
        'a[href*="user/view.php?id="], a[href*="user/profile.php?id="]'
      );
      if (!link) return;
      const match = (link.getAttribute("href") || "").match(/[?&]id=(\d+)/);
      if (match && match[1] === userId) {
        post.classList.add("moodle-tweaks-mine");
      }
    });
  }

  /* --------------------------------------------------- limpiar el dashboard */

  // Colapsa el indice del curso apoyandose en el propio control de Moodle, que
  // ademas persiste la preferencia. Solo actua cuando el cajon arranca abierto.
  function collapseCourseIndex() {
    const drawer = document.querySelector('[data-preference="drawer-open-index"]');
    if (!drawer) return;

    const tryCollapse = function () {
      if (drawer.classList.contains("not-initialized")) return false;
      if (!drawer.classList.contains("show")) return true;
      const toggle = document.querySelector(
        '[data-toggler="drawers"][data-action="toggle"][data-target="' +
          drawer.id +
          '"]'
      );
      if (!toggle) return false;
      toggle.click();
      return true;
    };

    if (tryCollapse()) return;
    const observer = new MutationObserver(function () {
      if (tryCollapse()) observer.disconnect();
    });
    observer.observe(drawer, { attributes: true, attributeFilter: ["class"] });
    window.setTimeout(function () {
      observer.disconnect();
    }, 10000);
  }

  function syncDashboard(enabled) {
    if (!enabled) {
      dashboardApplied = false;
      return;
    }
    if (dashboardApplied) return;
    dashboardApplied = true;
    collapseCourseIndex();
  }

  /* ------------------------------------------------ proximas entregas (barra) */

  function readSesskey() {
    const input = document.querySelector('input[name="sesskey"]');
    if (input && input.value) return input.value;
    const scripts = document.querySelectorAll("script");
    for (let i = 0; i < scripts.length; i++) {
      const text = scripts[i].textContent || "";
      const match = text.match(/"sesskey"\s*:\s*"([^"]+)"/);
      if (match) return match[1];
    }
    return null;
  }

  function normalizeEvents(events) {
    const nowSec = Date.now() / 1000;
    return events
      .map(function (ev) {
        const time = Number(ev.timesort || ev.timestart || 0);
        const action = ev.action || {};
        return {
          name: String(ev.name || action.name || "Evento"),
          time: time,
          url: String(ev.url || action.url || ""),
          course: String(ev.coursename || ""),
        };
      })
      .filter((e) => e.time && e.time >= nowSec - 300)
      .sort((a, b) => a.time - b.time)
      .slice(0, 8);
  }

  function parseUpcomingResponse(response) {
    const first = Array.isArray(response) ? response[0] : null;
    if (!first || first.error) return [];
    const events = (first.data && first.data.events) || [];
    return normalizeEvents(events);
  }

  function fetchUpcoming() {
    const sesskey = readSesskey();
    if (!sesskey || !globalThis.fetch) return Promise.resolve([]);
    const now = Math.floor(Date.now() / 1000);
    const payload = [
      {
        index: 0,
        methodname: "core_calendar_get_action_events_by_timesort",
        args: {
          limitnum: 20,
          timesortfrom: now,
          timesortto: now + UPCOMING_DAYS * 86400,
          limittononsuspendedevents: true,
        },
      },
    ];
    return globalThis
      .fetch(
        globalThis.location.origin +
          "/lib/ajax/service.php?sesskey=" +
          encodeURIComponent(sesskey),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        }
      )
      .then((res) => res.json())
      .then(parseUpcomingResponse)
      .catch(() => []);
  }

  function loadUpcoming() {
    try {
      const raw = globalThis.sessionStorage.getItem(UPCOMING_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (
          cached &&
          cached.at &&
          Date.now() - cached.at < UPCOMING_TTL &&
          Array.isArray(cached.events)
        ) {
          return Promise.resolve(cached.events);
        }
      }
    } catch (err) {
      /* sessionStorage no disponible */
    }
    return fetchUpcoming().then(function (events) {
      try {
        globalThis.sessionStorage.setItem(
          UPCOMING_CACHE_KEY,
          JSON.stringify({ at: Date.now(), events: events })
        );
      } catch (err) {
        /* ignore */
      }
      return events;
    });
  }

  function formatWhen(timeSec) {
    const date = new Date(timeSec * 1000);
    const diff = date.getTime() - Date.now();
    const days = Math.floor(diff / 86400000);
    let relative;
    if (diff < 0) relative = "ahora";
    else if (days <= 0) relative = "hoy";
    else if (days === 1) relative = "manana";
    else relative = "en " + days + " dias";
    let exact = "";
    try {
      exact = date.toLocaleString("es", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (err) {
      exact = date.toLocaleString();
    }
    return { relative: relative, exact: exact };
  }

  function renderUpcoming(events) {
    let bar = document.getElementById("moodle-tweaks-upcoming-bar");
    let hidden = false;
    try {
      hidden = globalThis.sessionStorage.getItem(UPCOMING_HIDDEN_KEY) === "1";
    } catch (err) {
      hidden = false;
    }

    if (!events || !events.length || hidden) {
      if (bar) bar.remove();
      root.classList.remove("moodle-tweaks-upcoming-ready");
      return;
    }

    if (!bar) {
      bar = document.createElement("div");
      bar.id = "moodle-tweaks-upcoming-bar";
      bar.className = "moodle-tweaks-upcoming-bar";
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", "Proximas entregas");

      const label = document.createElement("span");
      label.className = "moodle-tweaks-upcoming-bar__label";
      label.textContent = "Proximas entregas";

      const list = document.createElement("ul");
      list.className = "moodle-tweaks-upcoming-bar__list";

      const close = document.createElement("button");
      close.type = "button";
      close.className = "moodle-tweaks-upcoming-bar__close";
      close.setAttribute("aria-label", "Ocultar");
      close.textContent = "\u00d7";
      close.addEventListener("click", function () {
        try {
          globalThis.sessionStorage.setItem(UPCOMING_HIDDEN_KEY, "1");
        } catch (err) {
          /* ignore */
        }
        renderUpcoming([]);
      });

      bar.appendChild(label);
      bar.appendChild(list);
      bar.appendChild(close);
      (document.body || root).appendChild(bar);
    }

    const list = bar.querySelector(".moodle-tweaks-upcoming-bar__list");
    list.textContent = "";
    events.forEach(function (ev) {
      const when = formatWhen(ev.time);
      const item = document.createElement("li");
      item.className = "moodle-tweaks-upcoming-bar__item";

      const link = document.createElement("a");
      link.className = "moodle-tweaks-upcoming-bar__link";
      link.href = ev.url || "#";
      link.title = ev.name + (ev.course ? " \u00b7 " + ev.course : "");

      const whenEl = document.createElement("span");
      whenEl.className = "moodle-tweaks-upcoming-bar__when";
      whenEl.textContent = when.relative;
      whenEl.title = when.exact;

      const nameEl = document.createElement("span");
      nameEl.className = "moodle-tweaks-upcoming-bar__name";
      nameEl.textContent = ev.name;

      link.appendChild(whenEl);
      link.appendChild(nameEl);
      item.appendChild(link);
      list.appendChild(item);
    });

    root.classList.add("moodle-tweaks-upcoming-ready");
  }

  function syncUpcoming(enabled) {
    if (!domReady) return;
    if (!enabled) {
      renderUpcoming([]);
      return;
    }
    if (upcomingRequested) return;
    upcomingRequested = true;
    loadUpcoming().then(function (events) {
      if (!featureOn("upcoming")) return;
      renderUpcoming(events);
      updateBadge(events);
    });
  }

  /* ----------------------------------------------- contador de la barra (badge) */

  function readCount(el) {
    if (!el) return 0;
    // Moodle repite el numero en un <span class="sr-only"> ("5Hay 5 ..."), asi
    // que primero buscamos el span visible y si no, tomamos el primer numero.
    const visible = el.querySelector(
      'span[aria-hidden="true"], span:not(.sr-only):not(.visually-hidden)'
    );
    const text = (visible ? visible.textContent : el.textContent) || "";
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  function unreadCount() {
    return (
      readCount(
        document.querySelector(
          "#nav-notification-popover-container .count-container, .popover-region-notifications .count-container"
        )
      ) +
      readCount(
        document.querySelector(
          '[data-region="popover-region-messages"] .count-container'
        )
      )
    );
  }

  function sendBadge(text) {
    if (!api || !api.runtime || !api.runtime.sendMessage) return;
    try {
      // En Chrome devuelve una promesa; si el service worker no responde,
      // atajamos el rechazo para no ensuciar la consola.
      const result = api.runtime.sendMessage({ type: "eva:badge", text: text });
      if (result && typeof result.catch === "function") {
        result.catch(function () {});
      }
    } catch (err) {
      /* canal de mensajes no disponible */
    }
  }

  function updateBadge(upcomingEvents) {
    if (!featureOn("toolbarBadge")) {
      sendBadge("");
      return;
    }
    let total = unreadCount();
    (upcomingEvents || []).forEach(function (ev) {
      if (ev.time * 1000 - Date.now() < 7 * 86400000) total += 1;
    });
    sendBadge(total > 0 ? (total > 99 ? "99+" : String(total)) : "");
  }

  /* ------------------------------------------------------------ observador */

  // En paginas grandes casi todas las mutaciones no tocan el foro; si ninguna
  // de la trama introdujo un .forumpost no programamos trabajo, y el rAF
  // colapsa las mutaciones relevantes acumuladas en una sola pasada.
  function hasRelevantMutation(mutations) {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches(".forumpost") || node.querySelector(".forumpost")) {
          return true;
        }
      }
    }
    return false;
  }

  function scheduleUpdate() {
    if (observationScheduled) return;
    observationScheduled = true;
    window.requestAnimationFrame(function () {
      observationScheduled = false;
      markOwnPosts();
    });
  }

  function startObserver() {
    const observer = new MutationObserver(function (mutations) {
      if (hasRelevantMutation(mutations)) scheduleUpdate();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /* ------------------------------------------------------------- arranque */

  // Aplicamos de forma sincrona el ultimo estado conocido (cache) antes de
  // que el navegador pinte. Esto cubre tambien los modulos apagados.
  settings = normalize(Object.assign({}, DEFAULTS, readCache() || {}));
  applyAppearance(activeSettings());

  function onReady() {
    domReady = true;
    syncBackToTop(featureOn("backToTop"));
    markOwnPosts();
    startObserver();
    syncDashboard(featureOn("cleanDashboard"));
    syncUpcoming(featureOn("upcoming"));
    updateBadge();
  }

  function applySettings(next) {
    settings = normalize(next);
    applyAppearance(activeSettings());
    writeCache(settings);
    syncBackToTop(featureOn("backToTop"));
    if (featureOn("highlight")) {
      markOwnPosts();
    } else {
      document
        .querySelectorAll(".forumpost.moodle-tweaks-mine")
        .forEach((p) => p.classList.remove("moodle-tweaks-mine"));
    }
    if (domReady) {
      syncDashboard(featureOn("cleanDashboard"));
      syncUpcoming(featureOn("upcoming"));
      updateBadge();
    }
  }

  // Arrancamos la lectura real en document_start (no en DOMContentLoaded) para
  // reconciliar cuanto antes; la cache ya dejo la pagina en el estado correcto.
  readSettings(applySettings);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady, { once: true });
  } else {
    onReady();
  }

  if (api && api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener(function (changes, area) {
      if ((area === "sync" || area === "local") && changes[STORAGE_KEY]) {
        applySettings(changes[STORAGE_KEY].newValue || {});
      }
    });
  }

  // Si el usuario sigue el tema del sistema, reaccionamos a sus cambios.
  if (globalThis.matchMedia) {
    try {
      const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
      const onSchemeChange = function () {
        if (settings.enabled && settings.darkAuto) {
          applyAppearance(activeSettings());
        }
      };
      if (mq.addEventListener) mq.addEventListener("change", onSchemeChange);
      else if (mq.addListener) mq.addListener(onSchemeChange);
    } catch (err) {
      /* matchMedia no disponible */
    }
  }
})();
