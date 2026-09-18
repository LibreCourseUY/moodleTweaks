"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { ROOT } = require("./helpers");

const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const exists = (p) => existsSync(join(ROOT, p));

test("manifest is a valid MV3 extension", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.permissions.includes("storage"));
  assert.deepEqual(
    manifest.host_permissions,
    ["https://eva.fing.edu.uy/*"]
  );
});

test("every referenced icon file exists", () => {
  const icons = new Set();
  Object.values(manifest.icons || {}).forEach((p) => icons.add(p));
  Object.values(manifest.action && manifest.action.default_icon || {}).forEach(
    (p) => icons.add(p)
  );
  assert.ok(icons.size > 0, "expected icon paths in manifest");
  for (const p of icons) {
    assert.equal(exists(p), true, `missing icon: ${p}`);
  }
});

test("popup entry point exists", () => {
  assert.equal(exists(manifest.action.default_popup), true);
});

test("content scripts run at document_start on the EVA domain", () => {
  const scripts = manifest.content_scripts;
  assert.ok(Array.isArray(scripts) && scripts.length === 1);
  assert.equal(scripts[0].run_at, "document_start");
  assert.ok(scripts[0].matches.includes("https://eva.fing.edu.uy/*"));
});

test("every referenced content script css and js exists", () => {
  const scripts = manifest.content_scripts[0];
  assert.ok(scripts.css.length > 0, "expected css files");
  for (const p of scripts.css) {
    assert.equal(exists(p), true, `missing css: ${p}`);
  }
  for (const p of scripts.js) {
    assert.equal(exists(p), true, `missing js: ${p}`);
  }
});

test("content script css files use native nesting-friendly names", () => {
  const css = manifest.content_scripts[0].css;
  assert.ok(css.every((p) => p.startsWith("src/content/css/")));
});

test("background entry points exist for both browsers", () => {
  assert.ok(manifest.background, "expected a background key");
  const paths = new Set();
  if (manifest.background.service_worker) {
    paths.add(manifest.background.service_worker);
  }
  (manifest.background.scripts || []).forEach((p) => paths.add(p));
  assert.ok(paths.size > 0, "expected at least one background script");
  for (const p of paths) {
    assert.equal(exists(p), true, `missing background script: ${p}`);
  }
});

test("welcome page is bundled", () => {
  assert.equal(exists("src/welcome/welcome.html"), true);
});
