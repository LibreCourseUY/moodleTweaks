import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromeManifest, firefoxManifest } from "./manifest-targets.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIST = join(ROOT, "dist");
const CHROME_DIR = join(DIST, "chrome");
const FIREFOX_DIR = join(DIST, "firefox");

const manifest = JSON.parse(
  await readFile(join(ROOT, "manifest.json"), "utf8")
);
const pkg = JSON.parse(
  await readFile(join(ROOT, "package.json"), "utf8")
);

if (manifest.version !== pkg.version) {
  console.error(
    `version drift: manifest.json ${manifest.version} != package.json ${pkg.version}`
  );
  process.exit(1);
}

async function stage(dir, derive) {
  await cp(join(ROOT, "src"), join(dir, "src"), { recursive: true });
  if (existsSync(join(ROOT, "LICENSE"))) {
    await cp(join(ROOT, "LICENSE"), join(dir, "LICENSE"));
  }
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify(derive(manifest), null, 2) + "\n"
  );
}

async function zipChrome() {
  const target = join(DIST, `MoodleTweaks-${manifest.version}-chrome.zip`);
  if (existsSync(target)) await rm(target, { force: true });
  try {
    execFileSync("zip", ["-r", "-q", target, "."], { cwd: CHROME_DIR });
  } catch {
    execFileSync(
      "python3",
      [
        "-c",
        "import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2])",
        join(DIST, `MoodleTweaks-${manifest.version}-chrome`),
        CHROME_DIR,
      ]
    );
  }
  return target;
}

async function zipFirefox() {
  const out = join(DIST, "web-ext-out");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const res = spawnSync(
    "npx",
    ["--no-install", "web-ext", "build", "--source-dir", FIREFOX_DIR, "--artifacts-dir", out],
    { cwd: ROOT, stdio: "inherit" }
  );
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
  const produced = (await readdir(out)).find((f) => f.endsWith(".zip"));
  if (!produced) {
    console.error("web-ext build produced no zip");
    process.exit(1);
  }
  const target = join(DIST, `MoodleTweaks-${manifest.version}-firefox.zip`);
  await rename(join(out, produced), target);
  await rm(out, { recursive: true, force: true });
  return target;
}

await rm(DIST, { recursive: true, force: true });
await mkdir(CHROME_DIR, { recursive: true });
await mkdir(FIREFOX_DIR, { recursive: true });

await stage(CHROME_DIR, chromeManifest);
console.log(`staged ${CHROME_DIR}`);

await stage(FIREFOX_DIR, firefoxManifest);
console.log(`staged ${FIREFOX_DIR}`);

const chromeZip = await zipChrome();
const firefoxZip = await zipFirefox();

console.log(`built ${chromeZip}`);
console.log(`built ${firefoxZip}`);