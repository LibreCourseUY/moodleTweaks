/*
 * MoodleTweaks — welcome.js
 * Rellena la version de la extension en la pagina de bienvenida.
 */
(function () {
  "use strict";

  const api = globalThis.chrome || globalThis.browser;
  const versionEl = document.getElementById("version");
  if (!versionEl || !api || !api.runtime || !api.runtime.getManifest) return;

  try {
    const version = api.runtime.getManifest().version;
    if (version) versionEl.textContent = version;
  } catch (err) {
    /* ignore */
  }
})();
