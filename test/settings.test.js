"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createWindow, evalSrc } = require("./helpers");

function loadSettings() {
  const env = createWindow({});
  evalSrc(env.window, "shared/settings.js");
  return env.window.MoodleTweaks;
}

test("settings expose storage key and defaults", () => {
  const shared = loadSettings();
  assert.ok(shared);
  assert.equal(shared.KEY, "moodleTweaksSettings");
  // Spread into a plain object: DEFAULTS lives in the jsdom realm and its
  // prototype differs from node:assert's expected literal.
  assert.deepEqual({ ...shared.DEFAULTS }, {
    enabled: true,
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
    homeImages: false,
    upcoming: false,
    toolbarBadge: false,
    customCss: "",
  });
});

test("defaults object is frozen", () => {
  const shared = loadSettings();
  assert.ok(Object.isFrozen(shared.DEFAULTS));
});

test("normalize fills missing values from defaults", () => {
  const shared = loadSettings();
  const next = shared.normalize({ dark: true });
  assert.equal(next.dark, true);
  assert.equal(next.theme, true);
  assert.equal(next.density, "comfortable");
  assert.equal(next.fontScale, 100);
});

test("normalize migrates the legacy boolean compact key", () => {
  const shared = loadSettings();
  assert.equal(shared.normalize({ compact: true }).density, "compact");
  assert.equal(shared.normalize({ compact: false }).density, "comfortable");
  // density wins when both are present.
  assert.equal(
    shared.normalize({ compact: false, density: "compact" }).density,
    "compact"
  );
  assert.equal(shared.normalize({}).compact, undefined);
});

test("normalize clamps and sanitizes the font scale", () => {
  const shared = loadSettings();
  assert.equal(shared.normalize({ fontScale: 500 }).fontScale, 130);
  assert.equal(shared.normalize({ fontScale: 10 }).fontScale, 85);
  assert.equal(shared.normalize({ fontScale: "nope" }).fontScale, 100);
  assert.equal(shared.normalize({ fontScale: 112.6 }).fontScale, 113);
});

test("normalize falls back on invalid enum values", () => {
  const shared = loadSettings();
  assert.equal(
    shared.normalize({ darkVariant: "neon" }).darkVariant,
    "default"
  );
  assert.equal(shared.normalize({ density: "sparse" }).density, "comfortable");
});

test("normalize coerces booleans and keeps customCss a string", () => {
  const shared = loadSettings();
  const next = shared.normalize({
    theme: 0,
    dark: "yes",
    customCss: { nope: true },
  });
  assert.equal(next.theme, false);
  assert.equal(next.dark, true);
  assert.equal(next.customCss, "");
});

test("normalize treats the master flag as an explicit boolean", () => {
  const shared = loadSettings();
  // Ausente en datos viejos => encendido.
  assert.equal(shared.normalize({}).enabled, true);
  assert.equal(shared.normalize({ enabled: false }).enabled, false);
  assert.equal(shared.normalize({ enabled: 0 }).enabled, false);
  assert.equal(shared.normalize({ enabled: "no" }).enabled, true);
});
