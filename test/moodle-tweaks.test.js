"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  makeChromeMock,
  makeMatchMedia,
  loadContentScript,
  settle,
  closeEnv,
  STORAGE_KEY,
} = require("./helpers");

function classes(env) {
  return env.document.documentElement.classList;
}

function cacheOf(env) {
  const raw = env.window.localStorage.getItem("moodleTweaksSettingsCache");
  return raw ? JSON.parse(raw) : null;
}

test("applies cached classes immediately, before async storage resolves", async () => {
  const cache = {
    theme: true,
    dark: true,
    navigation: false,
    activities: true,
    forum: true,
    calendar: true,
    highlight: true,
    backToTop: true,
    compact: false,
  };
  const chrome = makeChromeMock({ dark: false, navigation: true });
  const env = loadContentScript({ cache, chrome });

  assert.ok(classes(env).contains("moodle-tweaks-dark"));
  assert.ok(!classes(env).contains("moodle-tweaks-navigation"));

  await settle(env);

  assert.ok(!classes(env).contains("moodle-tweaks-dark"));
  assert.ok(classes(env).contains("moodle-tweaks-navigation"));
  await closeEnv(env);
});

test("reconciles settings from storage and rewrites the cache", async () => {
  const chrome = makeChromeMock({ dark: true, compact: true });
  const env = loadContentScript({ chrome });

  assert.ok(!classes(env).contains("moodle-tweaks-dark"));

  await settle(env);

  assert.ok(classes(env).contains("moodle-tweaks-dark"));
  assert.ok(classes(env).contains("moodle-tweaks-compact"));
  assert.equal(cacheOf(env).dark, true);
  assert.equal(cacheOf(env).density, "compact");
  await closeEnv(env);
});

test("applies defaults when nothing is stored or cached", async () => {
  const env = loadContentScript({});

  assert.ok(classes(env).contains("moodle-tweaks-theme"));
  assert.ok(classes(env).contains("moodle-tweaks-navigation"));
  assert.ok(classes(env).contains("moodle-tweaks-highlight"));
  assert.ok(!classes(env).contains("moodle-tweaks-dark"));
  assert.ok(!classes(env).contains("moodle-tweaks-compact"));
  await closeEnv(env);
});

test("live storage.onChanged changes apply immediately", async () => {
  const chrome = makeChromeMock();
  const env = loadContentScript({ chrome });

  await settle(env);
  assert.ok(!classes(env).contains("moodle-tweaks-dark"));

  chrome.storage.sync.set({ [STORAGE_KEY]: { dark: true } });
  await settle(env);

  assert.ok(classes(env).contains("moodle-tweaks-dark"));
  assert.equal(cacheOf(env).dark, true);
  await closeEnv(env);
});

test("back-to-top button is created when enabled", async () => {
  const chrome = makeChromeMock({ backToTop: true });
  const env = loadContentScript({ chrome });

  await settle(env);

  const button = env.document.querySelector(".moodle-tweaks-back-to-top");
  assert.ok(button);
  assert.equal(button.getAttribute("aria-label"), "Volver arriba");
  await closeEnv(env);
});

test("back-to-top visibility follows scroll position", async () => {
  const chrome = makeChromeMock({ backToTop: true });
  const env = loadContentScript({ chrome });

  await settle(env);
  const button = env.document.querySelector(".moodle-tweaks-back-to-top");
  assert.ok(!button.classList.contains("is-visible"));

  env.window.scrollY = 500;
  env.window.dispatchEvent(new env.window.Event("scroll"));
  assert.ok(button.classList.contains("is-visible"));

  env.window.scrollY = 0;
  env.window.dispatchEvent(new env.window.Event("scroll"));
  assert.ok(!button.classList.contains("is-visible"));
  await closeEnv(env);
});

test("back-to-top button is removed when disabled", async () => {
  const chrome = makeChromeMock({ backToTop: true });
  const env = loadContentScript({ chrome });

  await settle(env);
  assert.ok(env.document.querySelector(".moodle-tweaks-back-to-top"));

  chrome.storage.sync.set({ [STORAGE_KEY]: { backToTop: false } });
  await settle(env);

  assert.equal(env.document.querySelector(".moodle-tweaks-back-to-top"), null);
  await closeEnv(env);
});

test("marks own forum posts matching the current user", async () => {
  const chrome = makeChromeMock({ highlight: true });
  const html = [
    "<!DOCTYPE html><html><body>",
    '<div id="nav-notification-popover-container" data-userid="42"></div>',
    '<div class="forumpost" id="mine"><a ',
    'href="https://eva.fing.edu.uy/user/view.php?id=42&amp;course=1">yo</a></div>',
    '<div class="forumpost" id="other"><a ',
    'href="https://eva.fing.edu.uy/user/view.php?id=7&amp;course=1">otro</a></div>',
    "</body></html>",
  ].join("");
  const env = loadContentScript({ chrome, html });

  await settle(env);

  assert.ok(env.document.getElementById("mine").classList.contains("moodle-tweaks-mine"));
  assert.ok(
    !env.document.getElementById("other").classList.contains("moodle-tweaks-mine")
  );
  await closeEnv(env);
});

test("unmarks own posts when highlighting is disabled", async () => {
  const chrome = makeChromeMock({ highlight: true });
  const html = [
    "<!DOCTYPE html><html><body>",
    '<div class="popover-region" data-userid="42"></div>',
    '<div class="forumpost" id="mine"><a ',
    'href="https://eva.fing.edu.uy/user/view.php?id=42&amp;course=1">yo</a></div>',
    "</body></html>",
  ].join("");
  const env = loadContentScript({ chrome, html });

  await settle(env);
  const mine = env.document.getElementById("mine");
  assert.ok(mine.classList.contains("moodle-tweaks-mine"));

  chrome.storage.sync.set({ [STORAGE_KEY]: { highlight: false } });
  await settle(env);

  assert.ok(!mine.classList.contains("moodle-tweaks-mine"));
  await closeEnv(env);
});

test("observer marks posts added after page load", async () => {
  const chrome = makeChromeMock({ highlight: true });
  const html = [
    "<!DOCTYPE html><html><body>",
    '<div id="nav-notification-popover-container" data-userid="42"></div>',
    "</body></html>",
  ].join("");
  const env = loadContentScript({ chrome, html });

  await settle(env);

  const post = env.document.createElement("div");
  post.className = "forumpost";
  post.innerHTML =
    '<a href="https://eva.fing.edu.uy/user/view.php?id=42&amp;course=1">yo</a>';
  env.document.body.appendChild(post);

  await settle(env);

  assert.ok(post.classList.contains("moodle-tweaks-mine"));
  await closeEnv(env);
});

test("observer ignores mutations that add no forum posts", async () => {
  const chrome = makeChromeMock({ highlight: true });
  const html = [
    "<!DOCTYPE html><html><body>",
    '<div id="nav-notification-popover-container" data-userid="42"></div>',
    "</body></html>",
  ].join("");
  const env = loadContentScript({ chrome, html });
  await settle(env);

  let frames = 0;
  const originalRaf = env.window.requestAnimationFrame;
  env.window.requestAnimationFrame = function (callback) {
    frames++;
    return originalRaf(callback);
  };

  const div = env.document.createElement("div");
  div.id = "unrelated";
  div.innerHTML = "<p>cargando contenido</p><section><article/></section>";
  env.document.body.appendChild(div);
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.strictEqual(frames, 0);

  const post = env.document.createElement("div");
  post.className = "forumpost";
  post.innerHTML =
    '<a href="https://eva.fing.edu.uy/user/view.php?id=42&amp;course=1">yo</a>';
  env.document.body.appendChild(post);

  await settle(env);

  assert.ok(post.classList.contains("moodle-tweaks-mine"));
  await closeEnv(env);
});

test("applies the selected dark variant class", async () => {
  const chrome = makeChromeMock({ dark: true, darkVariant: "amoled" });
  const env = loadContentScript({ chrome });
  await settle(env);

  assert.ok(classes(env).contains("moodle-tweaks-dark"));
  assert.ok(classes(env).contains("moodle-tweaks-dark-amoled"));
  assert.ok(!classes(env).contains("moodle-tweaks-dark-dim"));

  chrome.storage.sync.set({
    [STORAGE_KEY]: { dark: true, darkVariant: "dim" },
  });
  await settle(env);

  assert.ok(classes(env).contains("moodle-tweaks-dark-dim"));
  assert.ok(!classes(env).contains("moodle-tweaks-dark-amoled"));
  await closeEnv(env);
});

test("follows the system preference when darkAuto is on", async () => {
  const darkSystem = loadContentScript({
    chrome: makeChromeMock({ dark: true, darkAuto: true }),
    matchMedia: makeMatchMedia({ "(prefers-color-scheme: dark)": true }),
  });
  await settle(darkSystem);
  assert.ok(classes(darkSystem).contains("moodle-tweaks-dark"));

  // With the system in light mode, darkAuto overrides the manual flag.
  const lightSystem = loadContentScript({
    chrome: makeChromeMock({ dark: true, darkAuto: true }),
    matchMedia: makeMatchMedia({}),
  });
  await settle(lightSystem);
  assert.ok(!classes(lightSystem).contains("moodle-tweaks-dark"));

  await closeEnv(darkSystem);
  await closeEnv(lightSystem);
});

test("writes the font scale custom property", async () => {
  const chrome = makeChromeMock({ fontScale: 120 });
  const env = loadContentScript({ chrome });
  await settle(env);

  assert.equal(
    env.document.documentElement.style.getPropertyValue("--moodle-tweaks-font-scale"),
    "1.200"
  );

  chrome.storage.sync.set({ [STORAGE_KEY]: { fontScale: 100 } });
  await settle(env);
  assert.equal(
    env.document.documentElement.style.getPropertyValue("--moodle-tweaks-font-scale"),
    ""
  );
  await closeEnv(env);
});

test("injects and removes custom CSS", async () => {
  const chrome = makeChromeMock({ customCss: ".moodle-tweaks-test { color: red; }" });
  const env = loadContentScript({ chrome });
  await settle(env);

  const style = env.document.getElementById("moodle-tweaks-custom-css");
  assert.ok(style);
  assert.match(style.textContent, /moodle-tweaks-test/);

  chrome.storage.sync.set({ [STORAGE_KEY]: { customCss: "" } });
  await settle(env);
  assert.equal(env.document.getElementById("moodle-tweaks-custom-css"), null);
  await closeEnv(env);
});

test("density toggles the moodle-tweaks-compact class", async () => {
  const chrome = makeChromeMock({ density: "compact" });
  const env = loadContentScript({ chrome });
  await settle(env);
  assert.ok(classes(env).contains("moodle-tweaks-compact"));

  chrome.storage.sync.set({ [STORAGE_KEY]: { density: "comfortable" } });
  await settle(env);
  assert.ok(!classes(env).contains("moodle-tweaks-compact"));
  await closeEnv(env);
});

function dashboardHtml() {
  return [
    "<!DOCTYPE html><html><body>",
    '<div id="theme_boost-drawers-courseindex" class="drawer show" ',
    'data-preference="drawer-open-index">',
    '<input type="checkbox" data-toggler="drawers" data-action="toggle" ',
    'data-target="theme_boost-drawers-courseindex">',
    "</div></body></html>",
  ].join("");
}

test("collapses the course index when the dashboard cleanup is on", async () => {
  const env = loadContentScript({
    chrome: makeChromeMock({ cleanDashboard: true }),
    html: dashboardHtml(),
  });
  await settle(env);

  assert.equal(
    env.document.querySelector('[data-toggler="drawers"]').checked,
    true,
    "expected the collapse control to be activated"
  );
  await closeEnv(env);
});

test("leaves the course index open when the dashboard cleanup is off", async () => {
  const env = loadContentScript({
    chrome: makeChromeMock({ cleanDashboard: false }),
    html: dashboardHtml(),
  });
  await settle(env);

  assert.equal(
    env.document.querySelector('[data-toggler="drawers"]').checked,
    false
  );
  await closeEnv(env);
});

function fetchEvents(events) {
  return function () {
    return Promise.resolve({
      json: () => Promise.resolve([{ error: false, data: { events } }]),
    });
  };
}

test("renders the upcoming deadlines bar from the calendar endpoint", async () => {
  const now = Math.floor(Date.now() / 1000);
  const events = [
    {
      name: "TP1",
      timesort: now + 3600,
      url: "https://eva.fing.edu.uy/mod/x",
      coursename: "PI",
    },
    {
      name: "Parcial",
      timesort: now + 2 * 86400,
      url: "https://eva.fing.edu.uy/mod/y",
      coursename: "PI",
    },
  ];
  const html =
    '<!DOCTYPE html><html><body><input name="sesskey" value="abc"></body></html>';
  const env = loadContentScript({
    chrome: makeChromeMock({ upcoming: true }),
    html,
    fetch: fetchEvents(events),
  });
  await settle(env);

  const bar = env.document.getElementById("moodle-tweaks-upcoming-bar");
  assert.ok(bar);
  const names = Array.from(
    bar.querySelectorAll(".moodle-tweaks-upcoming-bar__name")
  ).map((n) => n.textContent);
  assert.deepEqual(names, ["TP1", "Parcial"]);
  await closeEnv(env);
});

test("does not render the upcoming bar when disabled", async () => {
  const env = loadContentScript({
    chrome: makeChromeMock({ upcoming: false }),
    fetch: fetchEvents([
      { name: "TP1", timesort: Math.floor(Date.now() / 1000) + 3600 },
    ]),
  });
  await settle(env);
  assert.equal(env.document.getElementById("moodle-tweaks-upcoming-bar"), null);
  await closeEnv(env);
});

test("sends unread counts to the toolbar badge when enabled", async () => {
  // Markup real de Moodle: el contador de mensajes repite el numero en un
  // <span class="sr-only">, que no debe contarse dos veces.
  const html = [
    "<!DOCTYPE html><html><body>",
    '<div id="nav-notification-popover-container">',
    '<div class="count-container" data-region="count-container" aria-hidden="true">2</div></div>',
    '<div data-region="popover-region-messages">',
    '<div class="count-container" data-region="count-container">',
    '<span aria-hidden="true">5</span>',
    '<span class="sr-only">Hay 5 conversaciones sin leer</span>',
    "</div></div>",
    "</body></html>",
  ].join("");
  const chrome = makeChromeMock({ toolbarBadge: true });
  const env = loadContentScript({ chrome, html });
  await settle(env);

  const badge = chrome._messages
    .filter((message) => message.type === "eva:badge")
    .pop();
  assert.ok(badge, "expected a badge message");
  assert.equal(badge.text, "7", "2 notifications + 5 messages, not 55");
  await closeEnv(env);
});

test("clears the toolbar badge when disabled", async () => {
  const chrome = makeChromeMock({ toolbarBadge: false });
  const env = loadContentScript({ chrome });
  await settle(env);

  const badge = chrome._messages
    .filter((message) => message.type === "eva:badge")
    .pop();
  assert.ok(badge);
  assert.equal(badge.text, "");
  await closeEnv(env);
});

test("the master flag disables every feature when off", async () => {
  const chrome = makeChromeMock({
    enabled: false,
    customCss: ".x { color: red; }",
    backToTop: true,
    dark: true,
  });
  const env = loadContentScript({ chrome });
  await settle(env);

  assert.ok(!classes(env).contains("moodle-tweaks-theme"));
  assert.ok(!classes(env).contains("moodle-tweaks-dark"));
  assert.ok(!classes(env).contains("moodle-tweaks-navigation"));
  assert.equal(env.document.getElementById("moodle-tweaks-custom-css"), null);
  assert.equal(env.document.querySelector(".moodle-tweaks-back-to-top"), null);

  chrome.storage.sync.set({ [STORAGE_KEY]: { enabled: true, theme: true } });
  await settle(env);
  assert.ok(classes(env).contains("moodle-tweaks-theme"));
  await closeEnv(env);
});

const HOME_HTML = [
  "<!DOCTYPE html><html><body>",
  '<img id="banner" src="https://eva.fing.edu.uy/theme/img/banner.jpg" width="600" height="200">',
  '<img id="course" src="https://eva.fing.edu.uy/course/img/cover.jpg" width="300" height="150">',
  '<img id="icon" class="icon" src="https://eva.fing.edu.uy/pix/icon.png" width="32" height="32">',
  '<img id="avatar" class="userpicture" src="https://eva.fing.edu.uy/pix/u/avatar.png">',
  '<img id="tiny" src="https://eva.fing.edu.uy/pix/tiny.gif" width="16" height="16">',
  "</body></html>",
].join("");

const ORIGINAL_BANNER = "https://eva.fing.edu.uy/theme/img/banner.jpg";

function bannerDone(env) {
  return env.document
    .getElementById("banner")
    .hasAttribute("data-moodle-tweaks-home");
}

async function waitForHomeImages(env, what) {
  const start = Date.now();
  while (!bannerDone(env)) {
    if (Date.now() - start > 2000) {
      throw new Error("tiempo de espera agotado: " + what);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function homeCacheKeys(env) {
  return Object.keys(env.window.chrome._store).filter((key) =>
    key.startsWith("moodleTweaksHomeImg")
  );
}

test("themes eligible homepage images in two tones on /", async () => {
  const chrome = makeChromeMock({ homeImages: true });
  const env = loadContentScript({
    chrome,
    url: "https://eva.fing.edu.uy/",
    html: HOME_HTML,
    media: true,
  });
  await settle(env);
  await waitForHomeImages(env, "banner entintada");

  const banner = env.document.getElementById("banner");
  const course = env.document.getElementById("course");
  assert.ok(banner.src.indexOf("data:") === 0, "banner con src de datos");
  assert.ok(course.src.indexOf("data:") === 0, "tarjeta de curso con src de datos");
  assert.equal(
    banner.getAttribute("data-moodle-tweaks-home-orig"),
    ORIGINAL_BANNER
  );

  const icon = env.document.getElementById("icon");
  const avatar = env.document.getElementById("avatar");
  const tiny = env.document.getElementById("tiny");
  assert.ok(!icon.hasAttribute("data-moodle-tweaks-home"), "icono sin tocar");
  assert.ok(
    !avatar.hasAttribute("data-moodle-tweaks-home"),
    "avatar sin tocar"
  );
  assert.ok(!tiny.hasAttribute("data-moodle-tweaks-home"), "miniatura sin tocar");
  assert.ok(homeCacheKeys(env).length >= 2, "cache por imagen escrito");

  await closeEnv(env);
});

test("themes homepage images on /index.php too", async () => {
  const env = loadContentScript({
    chrome: makeChromeMock({ homeImages: true }),
    url: "https://eva.fing.edu.uy/index.php",
    html: HOME_HTML,
    media: true,
  });
  await settle(env);
  await waitForHomeImages(env, "banner entintada en index.php");

  const banner = env.document.getElementById("banner");
  assert.ok(banner.src.indexOf("data:") === 0, "banner con src de datos");
  assert.equal(banner.src, "data:image/png;base64,AA==");
  await closeEnv(env);
});

test("does not touch images outside the homepage", async () => {
  const env = loadContentScript({
    chrome: makeChromeMock({ homeImages: true }),
    html: HOME_HTML,
    media: true,
  });
  await settle(env);
  await new Promise((resolve) => setTimeout(resolve, 30));

  const banner = env.document.getElementById("banner");
  assert.equal(banner.src, ORIGINAL_BANNER);
  assert.ok(!banner.hasAttribute("data-moodle-tweaks-home"));
  assert.equal(homeCacheKeys(env).length, 0);
  await closeEnv(env);
});

test("restores the original srcs when homeImages is turned off", async () => {
  const chrome = makeChromeMock({ homeImages: true });
  const env = loadContentScript({
    chrome,
    url: "https://eva.fing.edu.uy/",
    html: HOME_HTML,
    media: true,
  });
  await settle(env);
  await waitForHomeImages(env, "banner entintada antes de apagar");
  assert.ok(
    env.document.getElementById("banner").src.indexOf("data:") === 0
  );

  chrome.storage.sync.set({
    [STORAGE_KEY]: { homeImages: false },
  });
  await settle(env);

  const banner = env.document.getElementById("banner");
  assert.equal(banner.src, ORIGINAL_BANNER);
  assert.ok(!banner.hasAttribute("data-moodle-tweaks-home"));
  assert.ok(!banner.hasAttribute("data-moodle-tweaks-home-orig"));
  await closeEnv(env);
});

test("re-themes when the palette changes via dark mode", async () => {
  const chrome = makeChromeMock({ homeImages: true });
  const env = loadContentScript({
    chrome,
    url: "https://eva.fing.edu.uy/",
    html: HOME_HTML,
    media: true,
  });
  await settle(env);
  await waitForHomeImages(env, "banner entintada en claro");
  const lightKeys = homeCacheKeys(env).length;
  assert.ok(lightKeys >= 2);

  // jsdom no calcula las custom properties de las hojas de estilo: emulamos
  // el cambio de paleta que en un navegador real produce la clase oscura.
  const html = env.document.documentElement;
  html.style.setProperty("--moodle-tweaks-text", "#11161c");
  html.style.setProperty("--moodle-tweaks-surface", "#e2e8f0");
  chrome.storage.sync.set({
    [STORAGE_KEY]: { homeImages: true, dark: true },
  });
  await settle(env);

  const start = Date.now();
  while (homeCacheKeys(env).length <= lightKeys) {
    if (Date.now() - start > 2000) {
      throw new Error("la paleta oscura no re-entinto las imagenes");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  const banner = env.document.getElementById("banner");
  assert.ok(banner.hasAttribute("data-moodle-tweaks-home"));
  assert.ok(banner.src.indexOf("data:") === 0, "re-entintada con paleta oscura");
  await closeEnv(env);
});

test("the master flag disables homepage theming even when enabled", async () => {
  const chrome = makeChromeMock({ enabled: false, homeImages: true });
  const env = loadContentScript({
    chrome,
    url: "https://eva.fing.edu.uy/",
    html: HOME_HTML,
    media: true,
  });
  await settle(env);
  await new Promise((resolve) => setTimeout(resolve, 30));

  const banner = env.document.getElementById("banner");
  assert.equal(banner.src, ORIGINAL_BANNER);
  assert.ok(!banner.hasAttribute("data-moodle-tweaks-home"));
  assert.equal(homeCacheKeys(env).length, 0);
  await closeEnv(env);
});