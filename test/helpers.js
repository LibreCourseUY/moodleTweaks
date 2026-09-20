"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = join(__dirname, "..");
const SRC = (p) => join(ROOT, "src", p);

const STORAGE_KEY = "moodleTweaksSettings";

function readSrc(file) {
  return readFileSync(SRC(file), "utf8");
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// Wait for pending jsdom work: storage callbacks, mutation-observer deliveries
// and outstanding animation frames. Closing a window while an animation-frame
// is pending makes jsdom's rAF interval tick against a closed window and blow
// up, so draining frames before close() is required.
async function settle(env) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (env.window.requestAnimationFrame) {
    for (let i = 0; i < 2; i++) {
      await new Promise((resolve) => env.window.requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

async function closeEnv(env) {
  await settle(env);
  env.dom.window.close();
}

function makeStorageArea(store, listeners) {
  return {
    get(key, callback) {
      const deliver = function () {
        const result = {};
        if (Object.prototype.hasOwnProperty.call(store, key)) {
          result[key] = store[key];
        }
        return result;
      };
      if (typeof callback === "function") {
        setTimeout(() => callback(deliver()), 0);
        return;
      }
      return new Promise((resolve) => {
        setTimeout(() => resolve(deliver()), 0);
      });
    },
    set(payload) {
      const entries = Object.entries(payload);
      setTimeout(() => {
        for (const [key, value] of entries) {
          const change = { oldValue: store[key], newValue: value };
          store[key] = value;
          for (const listener of listeners) {
            listener({ [key]: change }, "sync");
          }
        }
      }, 0);
      return Promise.resolve();
    },
  };
}

function makeChromeMock(initialSettings = {}, options = {}) {
  const store = { [STORAGE_KEY]: Object.assign({}, initialSettings) };
  const listeners = [];
  const area = makeStorageArea(store, listeners);
  const messages = [];
  const tabUrl = options.tabUrl || "https://eva.fing.edu.uy/";
  const tabs = [{ url: tabUrl }];
  return {
    _store: store,
    _messages: messages,
    storage: {
      sync: area,
      local: area,
      onChanged: {
        addListener(fn) {
          listeners.push(fn);
        },
      },
    },
    runtime: {
      sendMessage(message) {
        messages.push(message);
        return Promise.resolve();
      },
      getManifest() {
        return { version: "1.2.0" };
      },
      getURL(path) {
        return "chrome-extension://moodletweaks/" + path;
      },
    },
    tabs: {
      query(_queryInfo, callback) {
        if (typeof callback === "function") callback(tabs);
        return Promise.resolve(tabs);
      },
      create() {
        return Promise.resolve({});
      },
    },
  };
}

// Minimal matchMedia stand-in driven by explicit query matches. Overrides is a
// map like { "(prefers-color-scheme: dark)": true }.
function makeMatchMedia(overrides = {}) {
  return function matchMedia(query) {
    return {
      matches: Boolean(overrides[query]),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  };
}

// jsdom's own rAF (pretendToBeVisual) schedules callbacks on a setInterval that
// crashes when the window is closed with an observer delivery pending (close()
// removes body children, firing the content script's MutationObserver, which
// requests an animation frame against a torn-down document). We polyfill rAF
// with a plain timer and swallow errors so teardown-time frames are harmless.
function installRafPolyfill(window) {
  let rafId = 0;
  const timers = new Map();
  window.requestAnimationFrame = function (callback) {
    const handle = ++rafId;
    const timer = setTimeout(function () {
      timers.delete(handle);
      try {
        callback(performance.now());
      } catch {
        /* window may already be closed */
      }
    }, 16);
    timers.set(handle, timer);
    return handle;
  };
  window.cancelAnimationFrame = function (handle) {
    const timer = timers.get(handle);
    if (timer) {
      clearTimeout(timer);
      timers.delete(handle);
    }
  };
}

/* jsdom no renderiza canvas ni carga imagenes reales. Para probar el motor
 * de entintado simulamos un Image cuyo src dispara onload y un contexto 2D que
 * devuelve un bitmap vacio pero funcional. */
function installFakeImage(window) {
  window.Image = class FakeImage {
    constructor() {
      this.crossOrigin = "";
      this.onload = null;
      this.onerror = null;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this._src = "";
    }

    set src(value) {
      this._src = value;
      setTimeout(() => {
        if (typeof this.onload === "function") this.onload();
      }, 0);
    }

    get src() {
      return this._src;
    }
  };
}

function installFakeCanvas(window) {
  window.HTMLCanvasElement.prototype.getContext = function () {
    return {
      imageSmoothingEnabled: true,
      drawImage() {},
      getImageData(x, y, width, height) {
        return {
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
        };
      },
      putImageData() {},
    };
  };
  // jsdom devuelve null sin el paquete "canvas"; usamos un data URL estable.
  window.HTMLCanvasElement.prototype.toDataURL = function () {
    return "data:image/png;base64,AA==";
  };
}

function createWindow(options = {}) {
  const {
    url = "https://eva.fing.edu.uy/course/view.php?id=123",
    html = "<!DOCTYPE html><html><body></body></html>",
    chrome = null,
    cache = null,
    matchMedia = null,
    fetch = null,
    media = false,
  } = options;

  const dom = new JSDOM(html, {
    url,
    runScripts: "outside-only",
  });
  const window = dom.window;
  const { document } = window;

  installRafPolyfill(window);
  if (media) {
    installFakeImage(window);
    installFakeCanvas(window);
  }

  if (chrome) {
    try {
      Object.defineProperty(window, "chrome", {
        value: chrome,
        configurable: true,
        writable: true,
      });
    } catch {
      window.chrome = chrome;
    }
  }
  if (cache !== null) {
    window.localStorage.setItem("moodleTweaksSettingsCache", JSON.stringify(cache));
  }
  if (matchMedia) {
    window.matchMedia = matchMedia;
  }
  if (fetch) {
    window.fetch = fetch;
  }
  window.scrollTo = () => {};
  Object.defineProperty(window, "scrollY", {
    value: 0,
    configurable: true,
    writable: true,
  });
  return { dom, window, document };
}

function evalSrc(window, file) {
  window.eval(readSrc(file));
}

function loadContentScript(options = {}) {
  const env = createWindow(options);
  evalSrc(env.window, "shared/settings.js");
  evalSrc(env.window, "content/theme-images.js");
  evalSrc(env.window, "content/moodle-tweaks.js");
  return env;
}

async function loadPopup(options = {}) {
  const { chrome = makeChromeMock(), url = "https://eva.fing.edu.uy/" } = options;
  const dom = await JSDOM.fromFile(SRC("popup/popup.html"), {
    url,
    runScripts: "outside-only",
  });
  const window = dom.window;
  installRafPolyfill(window);

  if (chrome) {
    try {
      Object.defineProperty(window, "chrome", {
        value: chrome,
        configurable: true,
        writable: true,
      });
    } catch {
      window.chrome = chrome;
    }
  }
  evalSrc(window, "shared/settings.js");
  evalSrc(window, "popup/popup.js");
  return { dom, window, document: dom.window.document };
}

async function loadWelcome(options = {}) {
  const chrome = options.chrome === undefined ? makeChromeMock() : options.chrome;
  const dom = await JSDOM.fromFile(SRC("welcome/welcome.html"), {
    runScripts: "outside-only",
  });
  const window = dom.window;
  if (chrome) {
    try {
      Object.defineProperty(window, "chrome", {
        value: chrome,
        configurable: true,
        writable: true,
      });
    } catch {
      window.chrome = chrome;
    }
  }
  evalSrc(window, "welcome/welcome.js");
  return { dom, window, document: window.document };
}

module.exports = {
  ROOT,
  STORAGE_KEY,
  readSrc,
  flush,
  settle,
  closeEnv,
  makeChromeMock,
  makeMatchMedia,
  createWindow,
  evalSrc,
  loadContentScript,
  loadPopup,
  loadWelcome,
};
