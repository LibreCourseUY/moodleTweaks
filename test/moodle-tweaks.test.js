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