"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeChromeMock, loadPopup, flush } = require("./helpers");

function input(document, key) {
  return document.querySelector(`input[data-key="${key}"]`);
}

function control(document, key) {
  return document.querySelector(`[data-key="${key}"]`);
}

test("renders stored settings into the controls", async () => {
  const chrome = makeChromeMock({ dark: true });
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  assert.equal(input(document, "theme").checked, true);
  assert.equal(input(document, "dark").checked, true);
  assert.equal(control(document, "density").value, "comfortable");
  assert.equal(control(document, "darkVariant").value, "default");
  assert.equal(control(document, "fontScale").value, "100");
  assert.equal(
    document.getElementById("master").checked,
    true,
    "master reflects the persisted enabled flag (default on)"
  );

  dom.window.close();
});

test("a toggle change persists to storage and flashes status", async () => {
  const chrome = makeChromeMock();
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  input(document, "dark").checked = true;
  input(document, "dark").dispatchEvent(new dom.window.Event("change"));
  await flush();

  assert.equal(chrome._store.moodleTweaksSettings.dark, true);
  assert.equal(document.getElementById("status").textContent, "Guardado");

  dom.window.close();
});

test("a select change persists to storage", async () => {
  const chrome = makeChromeMock();
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  const density = control(document, "density");
  density.value = "compact";
  density.dispatchEvent(new dom.window.Event("change"));
  await flush();

  assert.equal(chrome._store.moodleTweaksSettings.density, "compact");

  dom.window.close();
});

test("master toggle enables every feature setting", async () => {
  const chrome = makeChromeMock();
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  const master = document.getElementById("master");
  master.checked = true;
  master.dispatchEvent(new dom.window.Event("change"));
  await flush();

  for (const toggle of document.querySelectorAll(
    'input[type="checkbox"][data-key]'
  )) {
    if (toggle.dataset.master === "off") continue;
    assert.equal(toggle.checked, true, `expected ${toggle.dataset.key} checked`);
  }
  assert.equal(chrome._store.moodleTweaksSettings.dark, true);
  assert.equal(chrome._store.moodleTweaksSettings.toolbarBadge, true);
  assert.equal(document.getElementById("status").textContent, "Activado");

  dom.window.close();
});

test("master off disables the global flag and every feature setting", async () => {
  const chrome = makeChromeMock();
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  const master = document.getElementById("master");
  master.checked = false;
  master.dispatchEvent(new dom.window.Event("change"));
  await flush();

  assert.equal(chrome._store.moodleTweaksSettings.enabled, false);
  for (const toggle of document.querySelectorAll(
    'input[type="checkbox"][data-key]'
  )) {
    if (toggle.dataset.master === "off") continue;
    assert.equal(toggle.checked, false, `expected ${toggle.dataset.key} off`);
  }
  assert.equal(document.getElementById("status").textContent, "Desactivado");

  dom.window.close();
});

test("reset restores defaults and syncs the master toggle", async () => {
  const chrome = makeChromeMock({ dark: true, density: "compact" });
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  document.getElementById("reset").dispatchEvent(new dom.window.Event("click"));
  await flush();

  assert.equal(input(document, "dark").checked, false);
  assert.equal(control(document, "density").value, "comfortable");
  assert.equal(input(document, "theme").checked, true);
  assert.equal(
    document.getElementById("master").checked,
    true,
    "master follows defaults (enabled on)"
  );
  assert.equal(chrome._store.moodleTweaksSettings.enabled, true);
  assert.equal(chrome._store.moodleTweaksSettings.dark, false);
  assert.equal(chrome._store.moodleTweaksSettings.density, "comfortable");
  assert.equal(
    document.getElementById("status").textContent,
    "Valores restablecidos"
  );

  dom.window.close();
});

test("per-feature reset only touches that key", async () => {
  const chrome = makeChromeMock({ dark: true, fontScale: 120 });
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  document
    .querySelector('[data-reset="dark"]')
    .dispatchEvent(new dom.window.Event("click"));
  await flush();

  assert.equal(input(document, "dark").checked, false);
  assert.equal(control(document, "fontScale").value, "120");
  assert.equal(chrome._store.moodleTweaksSettings.dark, false);
  assert.equal(chrome._store.moodleTweaksSettings.fontScale, 120);
  assert.equal(document.getElementById("status").textContent, "Restablecido");

  dom.window.close();
});

test("search filters items, ignoring accents", async () => {
  const chrome = makeChromeMock();
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  const search = document.getElementById("search");
  search.value = "tamanio";
  search.dispatchEvent(new dom.window.Event("input"));
  await flush();

  assert.equal(control(document, "fontScale").closest(".moodle-tweaks-item").hidden, false);
  assert.equal(document.querySelector('[data-item="forum"]').hidden, true);
  assert.equal(
    document.querySelector('[data-item="forum"]').closest(".moodle-tweaks-group").hidden,
    true
  );

  search.value = "";
  search.dispatchEvent(new dom.window.Event("input"));
  await flush();
  assert.equal(document.querySelector('[data-item="forum"]').hidden, false);

  dom.window.close();
});

test("darkAuto disables the manual dark toggle", async () => {
  const chrome = makeChromeMock();
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  const auto = input(document, "darkAuto");
  auto.checked = true;
  auto.dispatchEvent(new dom.window.Event("change"));
  await flush();

  assert.equal(input(document, "dark").disabled, true);

  auto.checked = false;
  auto.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.equal(input(document, "dark").disabled, false);

  dom.window.close();
});

test("shows whether the extension is active on the current site", async () => {
  const onEva = await loadPopup({ chrome: makeChromeMock() });
  await flush();
  assert.equal(
    onEva.document.getElementById("site-status").classList.contains("is-active"),
    true
  );
  assert.equal(
    onEva.document.getElementById("site-status-text").textContent,
    "Activo en este sitio"
  );
  onEva.dom.window.close();

  const offEva = await loadPopup({
    chrome: makeChromeMock({}, { tabUrl: "https://example.com/" }),
  });
  await flush();
  assert.equal(
    offEva.document.getElementById("site-status").classList.contains("is-active"),
    false
  );
  assert.equal(
    offEva.document.getElementById("site-status-text").textContent,
    "No estás en EVA"
  );
  offEva.dom.window.close();
});

test("shows the extension version", async () => {
  const { dom, document } = await loadPopup({ chrome: makeChromeMock() });
  await flush();
  assert.equal(document.getElementById("version").textContent, "1.1.0");
  dom.window.close();
});

test("a range change updates the readout and persists", async () => {
  const chrome = makeChromeMock();
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  const scale = control(document, "fontScale");
  scale.value = "125";
  scale.dispatchEvent(new dom.window.Event("input"));
  assert.equal(document.getElementById("font-scale-value").textContent, "125%");

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(chrome._store.moodleTweaksSettings.fontScale, 125);

  dom.window.close();
});

test("the custom CSS box persists on input", async () => {
  const chrome = makeChromeMock();
  const { dom, document } = await loadPopup({ chrome });
  await flush();

  const css = control(document, "customCss");
  css.value = ".moodle-tweaks-test { color: red; }";
  css.dispatchEvent(new dom.window.Event("input"));

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(
    chrome._store.moodleTweaksSettings.customCss,
    ".moodle-tweaks-test { color: red; }"
  );

  dom.window.close();
});
