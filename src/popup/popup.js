/*
 * MoodleTweaks — popup.js
 * Panel de opciones: lee y guarda los ajustes en chrome.storage.
 */
(function () {
  "use strict";

  const shared = globalThis.MoodleTweaks || {};
  const DEFAULTS = shared.DEFAULTS || {};
  const STORAGE_KEY = shared.KEY || "moodleTweaksSettings";
  const normalize =
    shared.normalize ||
    function (raw) {
      return Object.assign({}, DEFAULTS, raw || {});
    };

  const api = globalThis.chrome || globalThis.browser;
  const area =
    api && api.storage ? api.storage.sync || api.storage.local : null;

  const controls = Array.prototype.slice.call(
    document.querySelectorAll("[data-key]")
  );
  const items = Array.prototype.slice.call(
    document.querySelectorAll(".moodle-tweaks-item")
  );
  const groups = Array.prototype.slice.call(
    document.querySelectorAll(".moodle-tweaks-group")
  );
  const master = document.getElementById("master");
  const resetAllButton = document.getElementById("reset");
  const status = document.getElementById("status");
  const search = document.getElementById("search");
  const searchEmpty = document.getElementById("search-empty");
  const siteStatus = document.getElementById("site-status");
  const siteStatusText = document.getElementById("site-status-text");
  const fontScaleValue = document.getElementById("font-scale-value");
  const versionEl = document.getElementById("version");
  const welcomeButton = document.getElementById("open-welcome");

  let current = normalize(DEFAULTS);
  let statusTimer = null;
  let saveTimer = null;

  function flash(message) {
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () {
      status.textContent = "";
    }, 1500);
  }

  function readSettings(callback) {
    if (!area) {
      callback(normalize(DEFAULTS));
      return;
    }
    try {
      area.get(STORAGE_KEY, function (result) {
        callback(normalize(result && result[STORAGE_KEY]));
      });
    } catch (err) {
      callback(normalize(DEFAULTS));
    }
  }

  function writeSettings(next) {
    if (!area) return;
    try {
      const payload = {};
      payload[STORAGE_KEY] = next;
      const maybePromise = area.set(payload);
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(function () {});
      }
    } catch (err) {
      /* almacenamiento no disponible */
    }
  }

  function readControl(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "range" || el.type === "number") return Number(el.value);
    return el.value;
  }

  function writeControl(el, value) {
    if (el.type === "checkbox") {
      el.checked = Boolean(value);
    } else if (value !== undefined && value !== null) {
      el.value = String(value);
    }
  }

  function collect() {
    const next = Object.assign({}, current);
    controls.forEach(function (el) {
      next[el.dataset.key] = readControl(el);
    });
    return normalize(next);
  }

  function saveNow(message) {
    writeSettings(collect());
    if (message) flash(message);
  }

  function saveSoon() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      writeSettings(collect());
    }, 250);
  }

  function syncFontScaleOutput() {
    const el = document.querySelector('[data-key="fontScale"]');
    if (fontScaleValue && el) fontScaleValue.textContent = el.value + "%";
  }

  function masterToggles() {
    return controls.filter(function (el) {
      return el.type === "checkbox" && el.dataset.master !== "off";
    });
  }

  function syncMaster() {
    if (!master) return;
    master.checked = Boolean(current.enabled);
  }

  // El modo oscuro automatico anula el interruptor manual.
  function syncDependent() {
    const auto = document.querySelector('[data-key="darkAuto"]');
    const dark = document.querySelector('[data-key="dark"]');
    const autoOn = Boolean(auto && auto.checked);
    if (dark) {
      dark.disabled = autoOn;
      const item = dark.closest(".moodle-tweaks-item");
      if (item) item.classList.toggle("is-disabled", autoOn);
    }
    syncFontScaleOutput();
  }

  function render(next) {
    current = normalize(next);
    controls.forEach(function (el) {
      writeControl(el, current[el.dataset.key]);
    });
    syncDependent();
    syncMaster();
  }

  /* ---- Busqueda ---------------------------------------------------------- */

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function applySearch(query) {
    const q = normalizeText(query).trim();
    items.forEach(function (item) {
      const hay = normalizeText(
        item.textContent + " " + (item.dataset.search || "")
      );
      item.hidden = q.length > 0 && hay.indexOf(q) === -1;
    });
    let anyVisible = false;
    groups.forEach(function (group) {
      const visible = group.querySelector(".moodle-tweaks-item:not([hidden])");
      group.hidden = !visible;
      if (visible) anyVisible = true;
    });
    if (searchEmpty) searchEmpty.hidden = anyVisible || !q;
  }

  /* ---- Sitio actual ------------------------------------------------------ */

  function tabsQuery(options, callback) {
    if (!api || !api.tabs || !api.tabs.query) {
      callback(null);
      return;
    }
    let done = false;
    const finish = function (tabs) {
      if (done) return;
      done = true;
      callback(tabs);
    };
    try {
      const maybe = api.tabs.query(options, finish);
      if (maybe && typeof maybe.then === "function") {
        maybe.then(finish).catch(function () {
          finish(null);
        });
      }
    } catch (err) {
      finish(null);
    }
  }

  function detectSite() {
    if (!siteStatus) return;
    tabsQuery({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs && tabs[0];
      const url = tab && tab.url;
      const active =
        typeof url === "string" && /^https:\/\/eva\.fing\.edu\.uy\//.test(url);
      siteStatus.classList.toggle("is-active", active);
      if (siteStatusText) {
        siteStatusText.textContent = active
          ? "Activo en este sitio"
          : "No estás en EVA";
      }
    });
  }

  /* ---- Version y bienvenida --------------------------------------------- */

  function renderVersion() {
    if (!versionEl) return;
    try {
      if (api && api.runtime && api.runtime.getManifest) {
        versionEl.textContent =
          api.runtime.getManifest().version || versionEl.textContent;
      }
    } catch (err) {
      /* ignore */
    }
  }

  function openWelcome() {
    if (!api || !api.runtime || !api.runtime.getURL) return;
    const url = api.runtime.getURL("src/welcome/welcome.html");
    if (api.tabs && api.tabs.create) api.tabs.create({ url: url });
    else window.open(url, "_blank");
    window.close();
  }

  /* ---- Eventos ----------------------------------------------------------- */

  controls.forEach(function (el) {
    if (el.tagName === "TEXTAREA") return;
    if (el.type === "range") {
      el.addEventListener("input", function () {
        syncFontScaleOutput();
        saveSoon();
      });
      return;
    }
    el.addEventListener("change", function () {
      syncDependent();
      syncMaster();
      saveNow("Guardado");
    });
  });

  const customCss = document.querySelector('[data-key="customCss"]');
  if (customCss) {
    customCss.addEventListener("input", function () {
      saveSoon();
    });
  }

  document.querySelectorAll("[data-reset]").forEach(function (button) {
    button.addEventListener("click", function () {
      const key = button.dataset.reset;
      const control = document.querySelector('[data-key="' + key + '"]');
      if (!control) return;
      const fallback = Object.prototype.hasOwnProperty.call(DEFAULTS, key)
        ? DEFAULTS[key]
        : "";
      writeControl(control, fallback);
      syncDependent();
      syncMaster();
      saveNow("Restablecido");
    });
  });

  if (master) {
    master.addEventListener("change", function () {
      const value = master.checked;
      current = Object.assign({}, current, { enabled: value });
      masterToggles().forEach(function (el) {
        el.checked = value;
      });
      syncDependent();
      saveNow(value ? "Activado" : "Desactivado");
    });
  }

  if (resetAllButton) {
    resetAllButton.addEventListener("click", function () {
      render(Object.assign({}, DEFAULTS));
      saveNow("Valores restablecidos");
    });
  }

  if (search) {
    search.addEventListener("input", function () {
      applySearch(search.value);
    });
  }

  if (welcomeButton) {
    welcomeButton.addEventListener("click", openWelcome);
  }

  renderVersion();
  detectSite();
  readSettings(render);
})();
