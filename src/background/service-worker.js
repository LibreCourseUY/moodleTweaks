/*
 * MoodleTweaks — background service worker / event page.
 * - Abre la pagina de bienvenida la primera vez que se instala.
 * - Refleja en el icono de la barra el contador que envia el content script.
 */
(function () {
  "use strict";

  const api = globalThis.chrome || globalThis.browser;
  if (!api || !api.runtime) return;

  const BADGE_COLOR = "#004987";
  const BADGE_TEXT_COLOR = "#ffffff";

  function action() {
    return api.action || api.browserAction || null;
  }

  function setBadge(text) {
    const target = action();
    if (!target || typeof target.setBadgeText !== "function") return;
    const value = text ? String(text) : "";
    try {
      target.setBadgeText({ text: value });
    } catch (err) {
      /* API no disponible */
    }
    if (!value) return;
    try {
      if (typeof target.setBadgeBackgroundColor === "function") {
        target.setBadgeBackgroundColor({ color: BADGE_COLOR });
      }
    } catch (err) {
      /* ignore */
    }
    try {
      if (typeof target.setBadgeTextColor === "function") {
        target.setBadgeTextColor({ color: BADGE_TEXT_COLOR });
      }
    } catch (err) {
      /* ignore */
    }
  }

  api.runtime.onInstalled.addListener(function (details) {
    if (!details || details.reason !== "install") return;
    try {
      api.tabs.create({ url: api.runtime.getURL("src/welcome/welcome.html") });
    } catch (err) {
      /* pestañas no disponibles */
    }
  });

  api.runtime.onMessage.addListener(function (message) {
    if (!message || message.type !== "eva:badge") return;
    setBadge(message.text);
  });
})();
