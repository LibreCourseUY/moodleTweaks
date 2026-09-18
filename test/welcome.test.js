"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readSrc, loadWelcome } = require("./helpers");

test("welcome page shows the extension version", async () => {
  const { document, dom } = await loadWelcome();
  assert.equal(document.getElementById("version").textContent, "1.1.0");
  dom.window.close();
});

test("welcome page links its stylesheet and script", () => {
  const html = readSrc("welcome/welcome.html");
  assert.match(html, /href="welcome\.css"/);
  assert.match(html, /src="welcome\.js"/);
});

test("welcome page tolerates a missing runtime API", async () => {
  const { document, dom } = await loadWelcome({ chrome: {} });
  assert.ok(document.getElementById("version"));
  dom.window.close();
});
