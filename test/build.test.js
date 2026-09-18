"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { ROOT } = require("./helpers");

const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));

const loadTargets = () => import("../scripts/manifest-targets.mjs");

test("chrome manifest keeps service_worker and drops background.scripts", async () => {
  const { chromeManifest } = await loadTargets();
  const out = chromeManifest(manifest);
  assert.equal(
    out.background.service_worker,
    manifest.background.service_worker
  );
  assert.equal("scripts" in out.background, false);
});

test("firefox manifest keeps background.scripts and drops service_worker", async () => {
  const { firefoxManifest } = await loadTargets();
  const out = firefoxManifest(manifest);
  assert.deepEqual(out.background.scripts, manifest.background.scripts);
  assert.equal("service_worker" in out.background, false);
});

test("chrome manifest keeps the gecko block untouched", async () => {
  const { chromeManifest } = await loadTargets();
  const out = chromeManifest(manifest);
  assert.deepEqual(out.browser_specific_settings, manifest.browser_specific_settings);
});

test("firefox manifest keeps the gecko block untouched", async () => {
  const { firefoxManifest } = await loadTargets();
  const out = firefoxManifest(manifest);
  assert.deepEqual(out.browser_specific_settings, manifest.browser_specific_settings);
});

test("transforms never mutate the source manifest", async () => {
  const { chromeManifest, firefoxManifest } = await loadTargets();
  const snapshot = structuredClone(manifest);
  chromeManifest(manifest);
  firefoxManifest(manifest);
  assert.deepEqual(manifest, snapshot);
  assert.ok(manifest.background.service_worker);
  assert.ok(Array.isArray(manifest.background.scripts));
});

test("transforms preserve shared fields and version", async () => {
  const { chromeManifest, firefoxManifest } = await loadTargets();
  for (const out of [chromeManifest(manifest), firefoxManifest(manifest)]) {
    assert.equal(out.manifest_version, 3);
    assert.equal(out.version, manifest.version);
    assert.deepEqual(out.host_permissions, manifest.host_permissions);
    assert.deepEqual(out.content_scripts, manifest.content_scripts);
    assert.deepEqual(out.permissions, manifest.permissions);
  }
});