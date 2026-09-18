"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readSrc } = require("./helpers");

function loadWorker() {
  const calls = { badge: [], created: [], installed: [], message: null };
  const chrome = {
    runtime: {
      getURL: (path) => "chrome-extension://moodletweaks/" + path,
      onInstalled: {
        addListener(fn) {
          calls.installed.push(fn);
        },
      },
      onMessage: {
        addListener(fn) {
          calls.message = fn;
        },
      },
    },
    tabs: {
      create(options) {
        calls.created.push(options);
      },
    },
    action: {
      setBadgeText(options) {
        calls.badge.push(options.text);
      },
      setBadgeBackgroundColor() {},
      setBadgeTextColor() {},
    },
  };
  const fakeGlobal = { chrome };
  new Function("globalThis", readSrc("background/service-worker.js"))(fakeGlobal);
  assert.equal(calls.installed.length, 1, "worker registers onInstalled");
  assert.ok(calls.message, "worker registers onMessage");
  return calls;
}

test("opens the welcome page on first install", () => {
  const calls = loadWorker();
  calls.installed.forEach((fn) => fn({ reason: "install" }));
  assert.equal(calls.created.length, 1);
  assert.match(calls.created[0].url, /welcome\.html$/);
});

test("does not open the welcome page on update", () => {
  const calls = loadWorker();
  calls.installed.forEach((fn) => fn({ reason: "update" }));
  assert.equal(calls.created.length, 0);
});

test("sets and clears the action badge from content-script messages", () => {
  const calls = loadWorker();
  calls.message({ type: "eva:badge", text: "3" });
  calls.message({ type: "eva:badge", text: "" });
  calls.message({ type: "otra-cosa", text: "9" });
  assert.deepEqual(calls.badge, ["3", ""]);
});
